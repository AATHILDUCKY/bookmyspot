"""
Availability & slot computation.

Design (single source of truth)
───────────────────────────────
There is exactly one feasibility function, ``_is_bookable``. Both the slot
list shown to customers (``get_available_slots``) and the server-side accept
rule used at booking time (``is_slot_bookable``) call it. They cannot drift.

Windows
───────
``AvailabilitySlot`` rows describe per-weekday open intervals. We split them
into two pools at fetch time:

  • saloon_windows: rows with staff_id IS NULL.
    These are the shop's open hours and the only source of truth for "is the
    shop open?" and chair-capacity (``max_bookings``).

  • staff_windows[staff_id]: rows belonging to a specific staff member.
    These describe that staff's personal shift. If a staff has no rows,
    they inherit the saloon's hours.

This split fixes a real bug in the previous implementation: any window row
(including staff-only ones extending past closing) was treated as "the shop
is open then", so the slot list could offer times after the shop had closed.

Core rules for a candidate ``[start, end)``
───────────────────────────────────────────
  1. Shop must be open: ``[start, end)`` must fit inside at least one
     saloon_window. The matching window's ``max_bookings`` defines chair cap.

  2. Chair capacity: number of overlapping bookings < shop window capacity.

  3. If specific staff requested:
        - staff must be active,
        - staff must be on shift for the FULL ``[start, end)`` — i.e. the
          interval fits inside one of their windows (or the saloon window if
          they have no windows of their own),
        - that staff must have no overlapping booking.

  4. If any-staff request:
        - at least one active staff must be on shift AND free for the full
          interval,
        - anonymous bookings (staff_id = NULL) consume that count too.

  5. For today's date, ``start`` must be ≥ ``now + lead_minutes`` (default 0).
     Slots strictly in the past are never offered or accepted.

Complexity
──────────
One DB round-trip each for: saloon windows, staff windows, active staff,
day bookings, closed-day exceptions. The slot generator iterates
O(W · S/STEP · B) where W is the number of saloon windows, S is the average
window span, STEP = 15 min, and B is the day's booking count. For the data
sizes we expect (≤ a few windows, ≤ a few thousand bookings/day), this is
well under a millisecond.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from models import AvailabilitySlot, Booking, BookingStatus, Service, SlotException, Staff

SLOT_STEP_MINUTES = 15
# Minimum lead time before a booking can start (in minutes). Per-saloon
# settings could override this in the future; 0 by default keeps current
# behavior for non-today dates and only blocks slots that have already begun.
DEFAULT_LEAD_MINUTES = 0


# ─────────────────────── interval helpers ────────────────────────────


def _intervals_overlap(a_start: time, a_end: time, b_start: time, b_end: time) -> bool:
    """Half-open: [a_start, a_end) ∩ [b_start, b_end) ≠ ∅."""
    return a_start < b_end and a_end > b_start


def _overlapping(bookings: Iterable[Booking], cs: time, ce: time) -> list[Booking]:
    return [b for b in bookings if _intervals_overlap(b.start_time, b.end_time, cs, ce)]


@dataclass(frozen=True)
class _Window:
    start: time
    end: time
    capacity: int  # only meaningful for saloon-level windows


def _row_to_window(row: AvailabilitySlot, *, default_capacity: int = 1) -> _Window:
    return _Window(
        start=row.start_time,
        end=row.end_time,
        capacity=max(1, row.max_bookings or default_capacity),
    )


def _containing_window(windows: list[_Window], start: time, end: time) -> Optional[_Window]:
    """Return the first window that fully contains ``[start, end)`` or None."""
    for w in windows:
        if w.start <= start and end <= w.end:
            return w
    return None


# ─────────────────────── data loading ────────────────────────────────


def _load_windows(db: Session, saloon_id: int, weekday: int):
    """Fetch & split availability rows into saloon-wide and per-staff pools."""
    rows = (
        db.query(AvailabilitySlot)
        .filter(
            AvailabilitySlot.saloon_id == saloon_id,
            AvailabilitySlot.weekday == weekday,
            AvailabilitySlot.is_active.is_(True),
        )
        .all()
    )
    saloon_windows: list[_Window] = []
    staff_windows: dict[int, list[_Window]] = {}
    for r in rows:
        if r.staff_id is None:
            saloon_windows.append(_row_to_window(r))
        else:
            staff_windows.setdefault(r.staff_id, []).append(_row_to_window(r))
    return saloon_windows, staff_windows


def _active_staff_ids(db: Session, saloon_id: int) -> list[int]:
    rows = (
        db.query(Staff.id)
        .filter(Staff.saloon_id == saloon_id, Staff.is_active.is_(True))
        .all()
    )
    return [r[0] for r in rows]


def _day_bookings(db: Session, saloon_id: int, for_date: date) -> list[Booking]:
    return (
        db.query(Booking)
        .filter(
            Booking.saloon_id == saloon_id,
            Booking.booking_date == for_date,
            Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed]),
        )
        .all()
    )


def _is_closed(db: Session, saloon_id: int, for_date: date) -> bool:
    return (
        db.query(SlotException)
        .filter(
            SlotException.saloon_id == saloon_id,
            SlotException.date == for_date,
            SlotException.is_closed.is_(True),
        )
        .first()
        is not None
    )


# ─────────────────────── core feasibility ────────────────────────────


def _staff_on_shift(
    saloon_windows: list[_Window],
    staff_windows: dict[int, list[_Window]],
    staff_id: int,
    start: time,
    end: time,
) -> bool:
    """A staff member is on shift for [start, end) iff the interval fits in
    one of their personal windows AND inside saloon hours. If they have no
    personal windows, they inherit the saloon's hours."""
    own = staff_windows.get(staff_id)
    if not own:
        return _containing_window(saloon_windows, start, end) is not None
    return (
        _containing_window(own, start, end) is not None
        and _containing_window(saloon_windows, start, end) is not None
    )


def _is_bookable(
    saloon_windows: list[_Window],
    staff_windows: dict[int, list[_Window]],
    active_staff_ids: list[int],
    day_bookings: list[Booking],
    start: time,
    end: time,
    requested_staff_id: Optional[int],
) -> bool:
    # Rule 1 — shop open?
    shop_window = _containing_window(saloon_windows, start, end)
    if shop_window is None:
        return False

    # Rule 2 — chair capacity.
    overlapping = _overlapping(day_bookings, start, end)
    if len(overlapping) >= shop_window.capacity:
        return False

    # No staff configured at all: chair-only model is sufficient.
    if not active_staff_ids:
        return True

    # Rule 3 — specific staff requested.
    if requested_staff_id is not None:
        if requested_staff_id not in active_staff_ids:
            return False
        if not _staff_on_shift(saloon_windows, staff_windows, requested_staff_id, start, end):
            return False
        for b in overlapping:
            if b.staff_id == requested_staff_id:
                return False
        return True

    # Rule 4 — any-staff: ≥1 active staff must be on shift AND free.
    busy_specific = {b.staff_id for b in overlapping if b.staff_id is not None}
    anonymous_used = sum(1 for b in overlapping if b.staff_id is None)
    candidate_free_staff = 0
    for sid in active_staff_ids:
        if sid in busy_specific:
            continue
        if not _staff_on_shift(saloon_windows, staff_windows, sid, start, end):
            continue
        candidate_free_staff += 1
    return candidate_free_staff - anonymous_used > 0


# ─────────────────────── time / lead-time helpers ────────────────────


def _snap_up(dt: datetime, step: timedelta) -> datetime:
    """Round ``dt`` up to the next multiple of ``step`` from midnight."""
    base = datetime.combine(dt.date(), time(0, 0))
    delta = dt - base
    step_s = int(step.total_seconds())
    delta_s = int(delta.total_seconds())
    aligned_s = ((delta_s + step_s - 1) // step_s) * step_s
    return base + timedelta(seconds=aligned_s)


def _earliest_start(for_date: date, lead_minutes: int) -> datetime:
    """For today: now + lead. For future days: midnight. For past days:
    midnight (the loop's window comparisons will yield nothing)."""
    now = datetime.now()
    today = now.date()
    if for_date < today:
        return datetime.combine(for_date, time(23, 59))  # effectively no slots
    if for_date == today:
        return now + timedelta(minutes=max(0, lead_minutes))
    return datetime.combine(for_date, time(0, 0))


# ─────────────────────── public API ─────────────────────────────────


def get_available_slots(
    db: Session,
    saloon_id: int,
    for_date: date,
    service_id: int,
    staff_id: int | None = None,
    lead_minutes: int = DEFAULT_LEAD_MINUTES,
):
    if _is_closed(db, saloon_id, for_date):
        return []

    service = (
        db.query(Service)
        .filter(
            Service.id == service_id,
            Service.saloon_id == saloon_id,
            Service.is_active.is_(True),
        )
        .first()
    )
    if not service:
        return []

    saloon_windows, staff_windows = _load_windows(db, saloon_id, for_date.weekday())
    if not saloon_windows:
        return []

    day_bookings = _day_bookings(db, saloon_id, for_date)
    active_staff_ids = _active_staff_ids(db, saloon_id)

    duration = timedelta(minutes=service.duration_minutes)
    step = timedelta(minutes=SLOT_STEP_MINUTES)
    floor_dt = _earliest_start(for_date, lead_minutes)

    seen: dict[str, dict] = {}
    for w in saloon_windows:
        win_start = datetime.combine(for_date, w.start)
        win_end = datetime.combine(for_date, w.end)
        cursor = _snap_up(max(win_start, floor_dt), step)
        while cursor + duration <= win_end:
            cs = cursor.time()
            ce = (cursor + duration).time()
            if _is_bookable(
                saloon_windows,
                staff_windows,
                active_staff_ids,
                day_bookings,
                cs,
                ce,
                staff_id,
            ):
                key = cs.strftime("%H:%M:%S")
                seen[key] = {"start_time": key, "end_time": ce.strftime("%H:%M:%S")}
            cursor += step

    return sorted(seen.values(), key=lambda s: s["start_time"])


def is_slot_bookable(
    db: Session,
    saloon_id: int,
    for_date: date,
    start_time: time,
    end_time: time,
    staff_id: int | None = None,
    lead_minutes: int = DEFAULT_LEAD_MINUTES,
) -> bool:
    """Authoritative server-side check used during booking creation."""
    if _is_closed(db, saloon_id, for_date):
        return False

    # Reject past / too-soon starts.
    floor_dt = _earliest_start(for_date, lead_minutes)
    if datetime.combine(for_date, start_time) < floor_dt:
        return False

    saloon_windows, staff_windows = _load_windows(db, saloon_id, for_date.weekday())
    if not saloon_windows:
        return False

    return _is_bookable(
        saloon_windows,
        staff_windows,
        _active_staff_ids(db, saloon_id),
        _day_bookings(db, saloon_id, for_date),
        start_time,
        end_time,
        staff_id,
    )


def pick_available_staff(
    db: Session,
    saloon_id: int,
    for_date: date,
    start_time: time,
    end_time: time,
) -> int | None:
    """Return the staff_id of the *least-loaded, on-shift, free* staff,
    or None if no staff exists or none is eligible.

    Fairness rule: when multiple staff are eligible, pick the one with the
    fewest bookings on that day so workload spreads across the team.
    """
    staff_ids = _active_staff_ids(db, saloon_id)
    if not staff_ids:
        return None

    saloon_windows, staff_windows = _load_windows(db, saloon_id, for_date.weekday())
    bookings = _day_bookings(db, saloon_id, for_date)
    busy_at_slot = {
        b.staff_id for b in bookings
        if b.staff_id is not None
        and _intervals_overlap(b.start_time, b.end_time, start_time, end_time)
    }

    eligible = [
        s for s in staff_ids
        if s not in busy_at_slot
        and _staff_on_shift(saloon_windows, staff_windows, s, start_time, end_time)
    ]
    if not eligible:
        return None

    load: dict[int, int] = {s: 0 for s in eligible}
    for b in bookings:
        if b.staff_id in load:
            load[b.staff_id] += 1
    return min(eligible, key=lambda s: load[s])
