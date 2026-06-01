"""
Booking creation with correct overlap-aware conflict detection.

We delegate the *single source of truth* for "is this interval bookable?" to
`availability_service.is_slot_bookable`, which uses proper half-open interval
overlap checks and honors per-staff scoping + window capacity. This guarantees
that the slot-list shown to customers and the server-side accept rule never
drift apart.
"""
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models import Booking, BookingStatus, Saloon, Service, Staff
from services.availability_service import is_slot_bookable, pick_available_staff


def calc_end_time(booking_date, start_time, duration_minutes: int):
    return (datetime.combine(booking_date, start_time) + timedelta(minutes=duration_minutes)).time()


def create_booking(db: Session, customer_id: int, payload):
    saloon = (
        db.query(Saloon)
        .filter(
            Saloon.id == payload.saloon_id,
            Saloon.is_active.is_(True),
            Saloon.is_approved.is_(True),
        )
        .first()
    )
    if not saloon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Saloon not found or unavailable')

    service = (
        db.query(Service)
        .filter(
            Service.id == payload.service_id,
            Service.saloon_id == payload.saloon_id,
            Service.is_active.is_(True),
        )
        .first()
    )
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Service not found')

    if payload.staff_id:
        staff = (
            db.query(Staff)
            .filter(
                Staff.id == payload.staff_id,
                Staff.saloon_id == payload.saloon_id,
                Staff.is_active.is_(True),
            )
            .first()
        )
        if not staff:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Staff member not found')

    end_time = calc_end_time(payload.booking_date, payload.start_time, service.duration_minutes)

    # Authoritative server-side conflict check (proper interval overlap +
    # capacity from working window + per-staff capacity = 1).
    if not is_slot_bookable(
        db,
        saloon_id=payload.saloon_id,
        for_date=payload.booking_date,
        start_time=payload.start_time,
        end_time=end_time,
        staff_id=payload.staff_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Selected slot is unavailable. Another booking overlaps this time.',
        )

    # If customer didn't pick a staff, auto-assign the least-loaded free staff.
    # This makes the "one staff = one customer per slot" invariant enforceable
    # by all subsequent availability queries.
    assigned_staff_id = payload.staff_id
    if assigned_staff_id is None:
        assigned_staff_id = pick_available_staff(
            db,
            saloon_id=payload.saloon_id,
            for_date=payload.booking_date,
            start_time=payload.start_time,
            end_time=end_time,
        )
        # If the saloon has no staff configured at all, fall back to None.
        # If staff exist but none free, is_slot_bookable above would have already
        # rejected; this is just a defensive belt-and-suspenders check.

    booking = Booking(
        customer_id=customer_id,
        saloon_id=payload.saloon_id,
        service_id=payload.service_id,
        staff_id=assigned_staff_id,
        booking_date=payload.booking_date,
        start_time=payload.start_time,
        end_time=end_time,
        notes=payload.notes,
        status=BookingStatus.pending,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking
