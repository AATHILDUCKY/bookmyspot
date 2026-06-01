'use client';

import { DragEvent as ReactDragEvent, MouseEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutGrid,
  LayoutList,
  MessageCircle,
  Phone,
  PhoneCall,
  Plus,
  Receipt,
  Search,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth,
  format, isSameDay, isSameMonth, startOfMonth, subMonths,
} from 'date-fns';
import { api } from '@/lib/api';
import { formatLkr } from '@/lib/currency';
import { OwnerCalendarBooking, OwnerCalendarPayload } from '@/types';
import { cn } from '@/lib/utils';

type ViewMode = 'day' | 'month' | 'list';
type StatusFilter = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

/* Day-view time range: 7am → 9pm (14 hours) */
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;
const HOUR_HEIGHT = 64; // px per hour in day view
const PX_PER_MIN = HOUR_HEIGHT / 60;
const TIME_COL_WIDTH = 56;

const statusStyles: Record<string, { badge: string; dot: string; block: string; blockBorder: string }> = {
  pending:   { badge: 'bg-amber-50 text-amber-700 border-amber-200',     dot: 'bg-amber-400',   block: 'bg-amber-50',     blockBorder: 'border-l-amber-400' },
  confirmed: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', block: 'bg-emerald-50',   blockBorder: 'border-l-emerald-500' },
  completed: { badge: 'bg-sky-50 text-sky-700 border-sky-200',           dot: 'bg-sky-500',     block: 'bg-sky-50',       blockBorder: 'border-l-sky-500' },
  cancelled: { badge: 'bg-slate-50 text-slate-500 border-slate-200',     dot: 'bg-slate-300',   block: 'bg-slate-50',     blockBorder: 'border-l-slate-300' },
};

function OwnerBookingsPageContent() {
  const qc = useQueryClient();
  const today = useMemo(() => new Date(), []);

  const [view, setView] = useState<ViewMode>('day');
  const [cursor, setCursor] = useState(today);             // month being viewed (Month view) / day (Day view)
  const [selectedDay, setSelectedDay] = useState(today);   // day for Day view & Month-selection
  const [selectedBooking, setSelectedBooking] = useState<OwnerCalendarBooking | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [staffFilter, setStaffFilter] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  /* Fetch month range so the month-grid dots always populate */
  const range = useMemo(() => ({
    start: startOfMonth(view === 'day' ? selectedDay : cursor),
    end: endOfMonth(view === 'day' ? selectedDay : cursor),
  }), [view, cursor, selectedDay]);

  const { data, isFetching } = useQuery<OwnerCalendarPayload>({
    queryKey: ['owner-calendar', format(range.start, 'yyyy-MM-dd'), format(range.end, 'yyyy-MM-dd')],
    queryFn: async () => (await api.get('/owner/calendar', {
      params: { start_date: format(range.start, 'yyyy-MM-dd'), end_date: format(range.end, 'yyyy-MM-dd') },
    })).data,
  });

  const confirmBooking = useMutation({
    mutationFn: async (id: number) => (await api.patch(`/owner/bookings/${id}/confirm`)).data,
    onSuccess: (updatedBooking: OwnerCalendarBooking) => {
      qc.invalidateQueries({ queryKey: ['owner-calendar'] });
      qc.invalidateQueries({ queryKey: ['owner-bookings'] });
      setSelectedBooking((prev) => {
        if (!prev || prev.id !== updatedBooking.id) return prev;
        return { ...prev, status: 'confirmed' };
      });
    },
  });

  const completeBooking = useMutation({
    mutationFn: async (id: number) => (await api.patch(`/owner/bookings/${id}/complete`)).data,
    onSuccess: (updatedBooking: OwnerCalendarBooking) => {
      qc.invalidateQueries({ queryKey: ['owner-calendar'] });
      qc.invalidateQueries({ queryKey: ['owner-bookings'] });
      setSelectedBooking((prev) => {
        if (!prev || prev.id !== updatedBooking.id) return prev;
        return { ...prev, status: 'completed' };
      });
    },
  });

  /* ─── Drag-to-reschedule ─── */
  const [pendingMove, setPendingMove] = useState<{ booking: OwnerCalendarBooking; newStartTime: string; newEndTime: string } | null>(null);

  const moveBooking = useMutation({
    mutationFn: async (args: { id: number; date: string; start: string; staff_id: number | null }) =>
      (await api.patch(`/owner/bookings/${args.id}/move`, {
        booking_date: args.date,
        start_time: args.start,
        staff_id: args.staff_id,
      })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner-calendar'] });
      setPendingMove(null);
    },
  });

  /* ─── Deep-link focus: ?id=...&date=YYYY-MM-DD ─── */
  const searchParams = useSearchParams();
  const focusedRef = useRef(false);
  const focusedFromUrlRef = useRef(false);

  // On mount: if a date is in the URL, jump there and switch to Day view.
  useEffect(() => {
    if (focusedFromUrlRef.current) return;
    const dateStr = searchParams.get('date');
    if (!dateStr) return;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return;
    const target = new Date(y, m - 1, d);
    setSelectedDay(target);
    setCursor(target);
    setView('day');
    focusedFromUrlRef.current = true;
  }, [searchParams]);

  // Once calendar data arrives, select the matching booking exactly once.
  useEffect(() => {
    if (focusedRef.current) return;
    const idStr = searchParams.get('id');
    if (!idStr) return;
    const id = Number(idStr);
    const found = data?.bookings?.find((b) => b.id === id);
    if (found) {
      setSelectedBooking(found);
      focusedRef.current = true;
    }
  }, [searchParams, data?.bookings]);

  /* ─── Filtered bookings ─── */
  const allBookings = data?.bookings ?? [];
  const staff = data?.staff ?? [];

  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allBookings.filter((b) => {
      const matchSearch = !q || [b.customer_name, b.service_name, b.staff_name, b.status].some((v) => v?.toLowerCase().includes(q));
      const matchStaff = staffFilter === 'all' || b.staff_id === staffFilter;
      const matchStatus = statusFilter === 'all' || b.status === statusFilter;
      return matchSearch && matchStaff && matchStatus;
    });
  }, [allBookings, search, staffFilter, statusFilter]);

  const selectedDayBookings = useMemo(() =>
    filteredBookings.filter((b) => isSameDay(new Date(`${b.booking_date}T00:00:00`), selectedDay))
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [filteredBookings, selectedDay]
  );

  /* ─── Today's headline data ─── */
  const todayBookings = useMemo(() =>
    allBookings.filter((b) => isSameDay(new Date(`${b.booking_date}T00:00:00`), today)),
    [allBookings, today]
  );
  const todayRevenue = todayBookings.reduce((sum, b) => sum + Number(b.service_price || 0), 0);
  const pendingCount = allBookings.filter((b) => b.status === 'pending').length;
  const confirmedCount = allBookings.filter((b) => b.status === 'confirmed').length;
  const monthRevenue = allBookings.reduce((sum, b) => sum + Number(b.service_price || 0), 0);

  const isToday = isSameDay(selectedDay, today);

  return (
    <div className='mx-auto max-w-2xl px-4 py-4 sm:py-6 space-y-4 pb-24'>

      {/* ── Compact header ── */}
      <div className='rounded-2xl border border-border bg-white p-4 surface-soft'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase tracking-widest text-brand-sage'>
              {format(today, 'EEEE')} · {format(today, 'MMM d')}
            </p>
            <h1 className='mt-0.5 text-xl font-bold text-foreground'>Bookings</h1>
            <p className='text-xs text-muted-foreground mt-0.5'>
              {todayBookings.length === 0
                ? 'No appointments today'
                : `${todayBookings.length} appointment${todayBookings.length !== 1 ? 's' : ''} today`}
            </p>
          </div>

          <div className='flex items-center gap-2'>
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className={cn(
                'h-10 w-10 rounded-xl border flex items-center justify-center transition-colors',
                searchOpen ? 'bg-brand-ink border-brand-ink text-white' : 'border-border text-muted-foreground hover:bg-muted/50'
              )}
              aria-label='Search'
            >
              {searchOpen ? <X size={16} /> : <Search size={16} />}
            </button>
            <div className='h-10 w-10 rounded-xl bg-gradient-to-br from-brand-peach to-brand-tan/40 flex items-center justify-center shrink-0'>
              <CalendarDays size={18} className='text-brand-ink' />
            </div>
          </div>
        </div>

        {todayBookings.length > 0 && (
          <div className='mt-4 pt-3 border-t border-border/50 flex items-end justify-between'>
            <div>
              <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>Today&apos;s revenue</p>
              <p className='text-2xl font-bold text-foreground leading-tight'>{formatLkr(todayRevenue, 0)}</p>
            </div>
            <span className='text-xs text-muted-foreground'>
              {todayBookings.filter((b) => b.status === 'confirmed').length} confirmed
            </span>
          </div>
        )}
      </div>

      {/* ── Search bar ── */}
      {searchOpen && (
        <div className='rounded-2xl border border-border bg-white p-2'>
          <div className='relative'>
            <Search size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search customer, service, staff…'
              className='w-full rounded-xl bg-muted/40 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-sage/40'
            />
          </div>
        </div>
      )}

      {/* ── Stat grid ── */}
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
        <StatCard icon={CalendarDays} label='Today'     value={String(todayBookings.length)} tone='peach' />
        <StatCard icon={Clock3}       label='Pending'   value={String(pendingCount)} tone='tan' />
        <StatCard icon={CheckCircle2} label='Confirmed' value={String(confirmedCount)} tone='sage' />
        <StatCard icon={Receipt}      label='Revenue'   value={formatLkr(monthRevenue, 0)} tone='blue' />
      </div>

      {/* ── View toggle ── */}
      <div className='flex items-center gap-2'>
        <div className='inline-flex items-center gap-1 bg-muted/50 rounded-xl p-1'>
          <ViewToggleBtn active={view === 'day'}   onClick={() => setView('day')}   icon={Clock3}     label='Day' />
          <ViewToggleBtn active={view === 'month'} onClick={() => setView('month')} icon={LayoutGrid} label='Month' />
          <ViewToggleBtn active={view === 'list'}  onClick={() => setView('list')}  icon={LayoutList} label='List' />
        </div>
        {isFetching && <span className='text-[10px] text-muted-foreground'>Syncing…</span>}
      </div>

      {/* ── DAY VIEW (Google-Calendar style time blocks) ── */}
      {view === 'day' && (
        <DayView
          selectedDay={selectedDay}
          today={today}
          bookings={selectedDayBookings}
          onPrev={() => setSelectedDay(addDays(selectedDay, -1))}
          onNext={() => setSelectedDay(addDays(selectedDay, 1))}
          onToday={() => setSelectedDay(today)}
          onSelectBooking={setSelectedBooking}
          onMoveRequest={(b, newStart, newEnd) => setPendingMove({ booking: b, newStartTime: newStart, newEndTime: newEnd })}
        />
      )}

      {/* ── MONTH VIEW ── */}
      {view === 'month' && (
        <>
          <div className='rounded-2xl border border-border bg-white overflow-hidden'>
            <div className='flex items-center justify-between px-4 py-3 border-b border-border'>
              <button
                onClick={() => setCursor(subMonths(cursor, 1))}
                className='h-8 w-8 rounded-lg border border-border bg-white flex items-center justify-center hover:bg-muted/50 transition-colors'
              >
                <ChevronLeft size={15} />
              </button>
              <div className='flex items-center gap-2'>
                <p className='text-sm font-bold text-foreground'>{format(cursor, 'MMMM yyyy')}</p>
                {!isSameMonth(cursor, today) && (
                  <button
                    onClick={() => { setCursor(today); setSelectedDay(today); }}
                    className='rounded-full bg-brand-peach/60 px-2.5 py-0.5 text-[10px] font-semibold text-brand-ink hover:bg-brand-peach transition-colors'
                  >
                    Today
                  </button>
                )}
              </div>
              <button
                onClick={() => setCursor(addMonths(cursor, 1))}
                className='h-8 w-8 rounded-lg border border-border bg-white flex items-center justify-center hover:bg-muted/50 transition-colors'
              >
                <ChevronRight size={15} />
              </button>
            </div>

            <MonthCalendar
              cursor={cursor}
              today={today}
              selectedDay={selectedDay}
              bookings={filteredBookings}
              onSelectDay={(d) => { setSelectedDay(d); setView('day'); }}
            />
          </div>

          {/* Tap-prompt */}
          <p className='text-center text-[11px] text-muted-foreground'>
            Tap a day to view its time-blocked schedule
          </p>
        </>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <>
          {/* Status pills */}
          <div className='flex items-center gap-1.5 overflow-x-auto -mx-4 px-4 pb-1'>
            {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium capitalize border transition-colors whitespace-nowrap',
                  statusFilter === s
                    ? 'bg-brand-ink text-white border-brand-ink'
                    : 'bg-white border-border text-muted-foreground hover:bg-muted/50'
                )}
              >
                {s === 'all' ? 'All' : s}
                {s !== 'all' && (
                  <span className='ml-1.5 opacity-70'>{allBookings.filter((b) => b.status === s).length}</span>
                )}
              </button>
            ))}
          </div>

          {staff.length > 1 && (
            <div className='flex items-center gap-1.5 overflow-x-auto -mx-4 px-4'>
              <span className='shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1'>
                <UsersRound size={11} /> Staff
              </span>
              <button
                onClick={() => setStaffFilter('all')}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors',
                  staffFilter === 'all' ? 'bg-brand-ink text-white border-brand-ink' : 'bg-white border-border text-muted-foreground'
                )}
              >
                All
              </button>
              {staff.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setStaffFilter(p.id)}
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors whitespace-nowrap',
                    staffFilter === p.id ? 'bg-brand-ink text-white border-brand-ink' : 'bg-white border-border text-muted-foreground'
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          <div className='rounded-2xl border border-border bg-white overflow-hidden'>
            {filteredBookings.length === 0 ? (
              <EmptyList />
            ) : (
              <GroupedList
                bookings={filteredBookings}
                onSelect={setSelectedBooking}
                onConfirm={(id) => confirmBooking.mutate(id)}
                confirmingId={confirmBooking.isPending ? confirmBooking.variables : undefined}
                onComplete={(id) => completeBooking.mutate(id)}
                completingId={completeBooking.isPending ? completeBooking.variables : undefined}
              />
            )}
          </div>
        </>
      )}

      {/* FAB */}
      <div className='fixed bottom-20 sm:bottom-6 right-4 z-30'>
        <button className='h-14 w-14 rounded-full bg-gradient-to-br from-brand-ink to-[#2a2724] text-white shadow-xl hover:shadow-2xl active:scale-95 transition-all flex items-center justify-center'>
          <Plus size={22} />
        </button>
      </div>

      {/* Booking detail sheet */}
      {selectedBooking && (
        <BookingSheet
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onConfirm={() => confirmBooking.mutate(selectedBooking.id)}
          isConfirming={confirmBooking.isPending && confirmBooking.variables === selectedBooking.id}
          onComplete={() => completeBooking.mutate(selectedBooking.id)}
          isCompleting={completeBooking.isPending && completeBooking.variables === selectedBooking.id}
        />
      )}

      {/* Drag-to-reschedule confirmation */}
      {pendingMove && (
        <MoveConfirmModal
          booking={pendingMove.booking}
          newStartTime={pendingMove.newStartTime}
          newEndTime={pendingMove.newEndTime}
          isSaving={moveBooking.isPending}
          onCancel={() => setPendingMove(null)}
          onConfirm={() => moveBooking.mutate({
            id: pendingMove.booking.id,
            date: pendingMove.booking.booking_date,
            start: pendingMove.newStartTime,
            staff_id: pendingMove.booking.staff_id ?? null,
          })}
        />
      )}
    </div>
  );
}

export default function OwnerBookingsPage() {
  return (
    <Suspense fallback={null}>
      <OwnerBookingsPageContent />
    </Suspense>
  );
}

/* ─── Day view (Google Calendar style time blocks) ─── */
function DayView({ selectedDay, today, bookings, onPrev, onNext, onToday, onSelectBooking, onMoveRequest }: {
  selectedDay: Date;
  today: Date;
  bookings: OwnerCalendarBooking[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelectBooking: (b: OwnerCalendarBooking) => void;
  onMoveRequest: (b: OwnerCalendarBooking, newStartTime: string, newEndTime: string) => void;
}) {
  const isViewingToday = isSameDay(selectedDay, today);
  const isPastDay = selectedDay < today && !isViewingToday;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(new Date());

  // Tick "now" every minute so the indicator stays current
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll to current hour (today) or first booking on mount/day change
  useEffect(() => {
    if (!scrollRef.current) return;
    let scrollHour = DAY_START_HOUR;
    if (isViewingToday) {
      scrollHour = Math.max(DAY_START_HOUR, now.getHours() - 1);
    } else if (bookings.length > 0) {
      scrollHour = Math.max(DAY_START_HOUR, Number(bookings[0].start_time.slice(0, 2)) - 1);
    }
    const y = (scrollHour - DAY_START_HOUR) * HOUR_HEIGHT;
    scrollRef.current.scrollTo({ top: y, behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay.toDateString()]);

  // Layout: compute overlapping clusters → assign column index + width
  const positioned = useMemo(() => layoutBookings(bookings), [bookings]);

  // Current-time line position (only show if viewing today and within range)
  const nowMinutes = (now.getHours() - DAY_START_HOUR) * 60 + now.getMinutes();
  const showNowLine = isViewingToday && nowMinutes >= 0 && nowMinutes <= (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const nowTop = nowMinutes * PX_PER_MIN;

  const totalHeight = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT;
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  /* ─── Drag-to-reschedule ─── */
  const dragStateRef = useRef<{ booking: OwnerCalendarBooking; grabOffsetPx: number } | null>(null);
  const gridInnerRef = useRef<HTMLDivElement | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [hoverTopPx, setHoverTopPx] = useState<number | null>(null);

  function bookingDurationMin(b: OwnerCalendarBooking) {
    return timeToMinutes(b.end_time) - timeToMinutes(b.start_time);
  }

  function handleDragStart(e: ReactDragEvent<HTMLButtonElement>, booking: OwnerCalendarBooking) {
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      e.preventDefault();
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragStateRef.current = { booking, grabOffsetPx: e.clientY - rect.top };
    setDraggingId(booking.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(booking.id));
    // Use a transparent drag image so our absolute block stays the visual anchor.
    const ghost = document.createElement('div');
    ghost.style.width = '1px';
    ghost.style.height = '1px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => ghost.remove(), 0);
  }

  function snapMinutesFromClientY(clientY: number): number | null {
    const state = dragStateRef.current;
    const container = gridInnerRef.current;
    if (!state || !container) return null;
    const rect = container.getBoundingClientRect();
    const yInContent = clientY - rect.top - state.grabOffsetPx;
    const rawMinutes = yInContent / PX_PER_MIN;
    return Math.max(0, Math.round(rawMinutes / 15) * 15);
  }

  function handleGridDragOver(e: ReactDragEvent<HTMLDivElement>) {
    if (!dragStateRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const snapped = snapMinutesFromClientY(e.clientY);
    if (snapped == null) return;
    setHoverTopPx(snapped * PX_PER_MIN);
  }

  function handleGridDrop(e: ReactDragEvent<HTMLDivElement>) {
    e.preventDefault();
    const state = dragStateRef.current;
    setDraggingId(null);
    setHoverTopPx(null);
    dragStateRef.current = null;
    if (!state) return;

    const snapped = snapMinutesFromClientY(e.clientY);
    if (snapped == null) return;

    const durationMin = bookingDurationMin(state.booking);
    const dayStartMin = DAY_START_HOUR * 60;
    const dayEndMin = DAY_END_HOUR * 60;
    const newStartTotal = dayStartMin + snapped;
    if (newStartTotal + durationMin > dayEndMin) return;

    const hh = String(Math.floor(newStartTotal / 60)).padStart(2, '0');
    const mm = String(newStartTotal % 60).padStart(2, '0');
    const newStart = `${hh}:${mm}:00`;
    if (newStart === state.booking.start_time) return;

    const endTotal = newStartTotal + durationMin;
    const ehh = String(Math.floor(endTotal / 60)).padStart(2, '0');
    const emm = String(endTotal % 60).padStart(2, '0');
    const newEnd = `${ehh}:${emm}:00`;

    onMoveRequest(state.booking, newStart, newEnd);
  }

  function handleDragEnd() {
    dragStateRef.current = null;
    setDraggingId(null);
    setHoverTopPx(null);
  }

  async function handleQuickConfirm(e: MouseEvent<HTMLButtonElement>, bookingId: number) {
    e.stopPropagation();
    if (confirmingId === bookingId) return;
    setConfirmingId(bookingId);
    try {
      await api.patch(`/owner/bookings/${bookingId}/confirm`);
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <div className='rounded-2xl border border-border bg-white overflow-hidden'>
      {/* Day nav header */}
      <div className='flex items-center justify-between px-4 py-3 border-b border-border'>
        <button
          onClick={onPrev}
          className='h-8 w-8 rounded-lg border border-border bg-white flex items-center justify-center hover:bg-muted/50 transition-colors'
          aria-label='Previous day'
        >
          <ChevronLeft size={15} />
        </button>

        <div className='flex flex-col items-center'>
          <div className='flex items-center gap-2'>
            <p className={cn('text-sm font-bold', isViewingToday ? 'text-brand-ink' : 'text-foreground')}>
              {isViewingToday ? 'Today' : format(selectedDay, 'EEE, MMM d')}
            </p>
            {!isViewingToday && (
              <button
                onClick={onToday}
                className='rounded-full bg-brand-peach/60 px-2.5 py-0.5 text-[10px] font-semibold text-brand-ink hover:bg-brand-peach transition-colors'
              >
                Today
              </button>
            )}
          </div>
          <p className='text-[11px] text-muted-foreground'>
            {format(selectedDay, 'EEEE, MMMM d')}
            {bookings.length > 0 && ` · ${bookings.length} booking${bookings.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <button
          onClick={onNext}
          className='h-8 w-8 rounded-lg border border-border bg-white flex items-center justify-center hover:bg-muted/50 transition-colors'
          aria-label='Next day'
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Scrollable time grid */}
      <div
        ref={scrollRef}
        className='relative overflow-y-auto'
        style={{ maxHeight: '60vh', minHeight: 380 }}
      >
        <div
          ref={gridInnerRef}
          className='relative'
          style={{ height: totalHeight }}
          onDragOver={handleGridDragOver}
          onDrop={handleGridDrop}
          onDragLeave={() => setHoverTopPx(null)}
        >
          {/* Hour rows */}
          {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i).map((hour) => (
            <div
              key={hour}
              className='absolute inset-x-0 flex items-start'
              style={{ top: (hour - DAY_START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
            >
              {/* Hour label */}
              <div
                className='shrink-0 pt-0 pr-2 text-right'
                style={{ width: TIME_COL_WIDTH }}
              >
                <span className='text-[10px] font-semibold text-muted-foreground -translate-y-1.5 inline-block'>
                  {formatHour(hour)}
                </span>
              </div>
              {/* Hour line */}
              <div className='flex-1 border-t border-border/50 h-full relative'>
                {/* Half-hour faint line */}
                <div
                  className='absolute inset-x-0 border-t border-dashed border-border/30'
                  style={{ top: HOUR_HEIGHT / 2 }}
                />
              </div>
            </div>
          ))}

          {/* Booking blocks */}
          <div className='absolute inset-0' style={{ paddingLeft: TIME_COL_WIDTH }}>
            {positioned.map(({ booking, col, total }) => {
              const startMin = timeToMinutes(booking.start_time) - DAY_START_HOUR * 60;
              const endMin   = timeToMinutes(booking.end_time)   - DAY_START_HOUR * 60;
              const top    = Math.max(0, startMin * PX_PER_MIN);
              const height = Math.max(24, (endMin - startMin) * PX_PER_MIN - 2);
              const widthPercent = 100 / total;
              const leftPercent  = col * widthPercent;
              const style = statusStyles[booking.status] ?? statusStyles.pending;

              const isDraggable = booking.status !== 'cancelled' && booking.status !== 'completed';
              const isDragging = draggingId === booking.id;
              return (
                <button
                  key={booking.id}
                  onClick={() => onSelectBooking(booking)}
                  draggable={isDraggable}
                  onDragStart={(e) => handleDragStart(e, booking)}
                  onDragEnd={handleDragEnd}
                  title={isDraggable ? 'Drag to reschedule · click to view' : undefined}
                  className={cn(
                    'absolute rounded-lg border-l-4 shadow-sm overflow-hidden text-left active:scale-[0.99] transition-all hover:shadow-md',
                    style.block, style.blockBorder,
                    isDraggable && 'cursor-grab active:cursor-grabbing',
                    isDragging && 'opacity-40 ring-2 ring-brand-ink/30',
                  )}
                  style={{
                    top,
                    height,
                    left: `calc(${leftPercent}% + 2px)`,
                    width: `calc(${widthPercent}% - 4px)`,
                  }}
                >
                  <div className='px-2 py-1 h-full flex flex-col gap-0.5 overflow-hidden'>
                    <p className='text-[11px] font-bold text-foreground leading-tight truncate'>
                      {booking.customer_name}
                    </p>
                    <p className='text-[10px] text-muted-foreground leading-tight truncate'>
                      {booking.service_name}
                    </p>
                    {booking.status === 'pending' && height >= 64 && (
                      <button
                        onClick={(e) => handleQuickConfirm(e, booking.id)}
                        disabled={confirmingId === booking.id}
                        className='mt-0.5 inline-flex h-5 items-center justify-center rounded-md bg-brand-ink px-1.5 text-[9px] font-semibold text-white disabled:opacity-60'
                      >
                        {confirmingId === booking.id ? '...' : 'Confirm'}
                      </button>
                    )}
                    {height >= 50 && (
                      <p className='text-[9px] text-muted-foreground/80 mt-auto'>
                        {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Drag drop indicator */}
          {hoverTopPx != null && draggingId != null && (
            <div
              className='absolute inset-x-0 pointer-events-none z-20 flex items-center'
              style={{ top: hoverTopPx, paddingLeft: TIME_COL_WIDTH - 6 }}
            >
              <div className='h-2.5 w-2.5 rounded-full bg-brand-ink shadow-sm' />
              <div className='flex-1 h-0.5 bg-brand-ink' />
              <span className='ml-1 mr-2 rounded-md bg-brand-ink px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums'>
                {String(Math.floor((DAY_START_HOUR * 60 + hoverTopPx / PX_PER_MIN) / 60)).padStart(2, '0')}:
                {String(Math.round((DAY_START_HOUR * 60 + hoverTopPx / PX_PER_MIN) % 60)).padStart(2, '0')}
              </span>
            </div>
          )}

          {/* Now indicator */}
          {showNowLine && (
            <div
              className='absolute inset-x-0 pointer-events-none z-10 flex items-center'
              style={{ top: nowTop, paddingLeft: TIME_COL_WIDTH - 6 }}
            >
              <div className='h-2 w-2 rounded-full bg-red-500 -ml-0' />
              <div className='flex-1 h-px bg-red-500' />
            </div>
          )}
        </div>
      </div>

      {/* Empty state for past or empty days */}
      {bookings.length === 0 && (
        <div className='border-t border-border px-4 py-6 text-center bg-muted/20'>
          <p className='text-xs text-muted-foreground'>
            {isPastDay ? 'No bookings on this day.' : isViewingToday ? 'No bookings today — perfect for walk-ins.' : 'No bookings scheduled.'}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Month calendar ─── */
function MonthCalendar({ cursor, today, selectedDay, bookings, onSelectDay }: {
  cursor: Date;
  today: Date;
  selectedDay: Date;
  bookings: OwnerCalendarBooking[];
  onSelectDay: (d: Date) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const gridStart = addDays(monthStart, -firstWeekday);
  const gridEnd = addDays(monthEnd, (6 - ((monthEnd.getDay() + 6) % 7)));
  const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const bookingsByDay = bookings.reduce<Record<string, OwnerCalendarBooking[]>>((acc, b) => {
    if (!acc[b.booking_date]) acc[b.booking_date] = [];
    acc[b.booking_date].push(b);
    return acc;
  }, {});

  return (
    <div>
      <div className='grid grid-cols-7'>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className='py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>{d}</div>
        ))}
      </div>
      <div className='grid grid-cols-7 gap-px bg-border/40'>
        {gridDays.map((day) => {
          const inMonth = isSameMonth(day, cursor);
          const isTodayDay = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDay);
          const dayBookings = bookingsByDay[format(day, 'yyyy-MM-dd')] ?? [];
          const pendingHere = dayBookings.some((b) => b.status === 'pending');

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={cn(
                'relative bg-white min-h-[52px] sm:min-h-[64px] p-1.5 flex flex-col items-center justify-start transition-colors',
                !inMonth && 'bg-muted/20',
                isSelected && !isTodayDay && 'bg-brand-peach/30',
                'hover:bg-muted/40',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all',
                  isTodayDay && 'bg-brand-ink text-white shadow-sm',
                  !isTodayDay && isSelected && 'bg-brand-ink/10 text-brand-ink ring-2 ring-brand-ink/30',
                  !isTodayDay && !isSelected && inMonth && 'text-foreground',
                  !inMonth && 'text-muted-foreground/40',
                )}
              >
                {format(day, 'd')}
              </span>

              {dayBookings.length > 0 && (
                <div className='mt-1 flex items-center gap-0.5'>
                  {dayBookings.slice(0, 3).map((b) => (
                    <div key={b.id} className={cn('h-1.5 w-1.5 rounded-full', statusStyles[b.status]?.dot ?? 'bg-slate-300')} />
                  ))}
                  {dayBookings.length > 3 && (
                    <span className='text-[8px] font-bold text-muted-foreground ml-0.5'>+{dayBookings.length - 3}</span>
                  )}
                </div>
              )}

              {pendingHere && !isTodayDay && (
                <span className='absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400 ring-2 ring-white' />
              )}
            </button>
          );
        })}
      </div>

      <div className='flex items-center justify-center gap-3 px-4 py-2 border-t border-border/50 bg-muted/20'>
        <span className='inline-flex items-center gap-1 text-[10px] text-muted-foreground'>
          <span className='h-1.5 w-1.5 rounded-full bg-amber-400' /> Pending
        </span>
        <span className='inline-flex items-center gap-1 text-[10px] text-muted-foreground'>
          <span className='h-1.5 w-1.5 rounded-full bg-emerald-500' /> Confirmed
        </span>
        <span className='inline-flex items-center gap-1 text-[10px] text-muted-foreground'>
          <span className='h-1.5 w-1.5 rounded-full bg-sky-500' /> Done
        </span>
      </div>
    </div>
  );
}

/* ─── Grouped list ─── */
function GroupedList({ bookings, onSelect, onConfirm, confirmingId, onComplete, completingId }: {
  bookings: OwnerCalendarBooking[];
  onSelect: (b: OwnerCalendarBooking) => void;
  onConfirm: (id: number) => void;
  confirmingId: number | undefined;
  onComplete: (id: number) => void;
  completingId: number | undefined;
}) {
  const sorted = [...bookings].sort((a, b) => {
    if (a.booking_date !== b.booking_date) return a.booking_date.localeCompare(b.booking_date);
    return a.start_time.localeCompare(b.start_time);
  });

  const grouped = sorted.reduce<Record<string, OwnerCalendarBooking[]>>((acc, b) => {
    if (!acc[b.booking_date]) acc[b.booking_date] = [];
    acc[b.booking_date].push(b);
    return acc;
  }, {});

  return (
    <div className='divide-y divide-border'>
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <div className='sticky top-0 z-10 bg-muted/60 backdrop-blur-sm px-4 py-1.5 flex items-center justify-between'>
            <p className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wide'>
              {format(new Date(`${date}T00:00:00`), 'EEE, MMM d')}
            </p>
            <span className='text-[10px] text-muted-foreground'>{items.length}</span>
          </div>
          <div className='divide-y divide-border/50'>
            {items.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                onClick={() => onSelect(b)}
                onConfirm={onConfirm}
                isConfirming={confirmingId === b.id}
                onComplete={onComplete}
                isCompleting={completingId === b.id}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BookingRow({ booking, onClick, onConfirm, isConfirming, onComplete, isCompleting }: {
  booking: OwnerCalendarBooking;
  onClick: () => void;
  onConfirm: (id: number) => void;
  isConfirming: boolean;
  onComplete: (id: number) => void;
  isCompleting: boolean;
}) {
  const style = statusStyles[booking.status] ?? statusStyles.pending;
  const phone = booking.customer_phone;
  const isPending = booking.status === 'pending';
  const isConfirmed = booking.status === 'confirmed';
  return (
    <div className='w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40 transition-colors'>
      <button onClick={onClick} className='flex items-center gap-3 flex-1 min-w-0 text-left'>
        <div className={cn('h-10 w-1 rounded-full shrink-0', style.dot)} />
        <div className='shrink-0 w-12'>
          <p className='text-xs font-bold text-foreground'>{formatTime(booking.start_time)}</p>
          <p className='text-[10px] text-muted-foreground'>{booking.service_duration_minutes}m</p>
        </div>
        <div className='flex-1 min-w-0'>
          <p className='text-sm font-semibold text-foreground truncate'>{booking.customer_name}</p>
          <p className='text-[11px] text-muted-foreground truncate'>{booking.service_name}{booking.staff_name ? ` · ${booking.staff_name}` : ''}</p>
        </div>
      </button>

      {/* Quick actions */}
      <div className='flex items-center gap-1 shrink-0'>
        {phone && (
          <a
            href={`tel:${phone}`}
            onClick={(e) => e.stopPropagation()}
            className='h-8 w-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-700 inline-flex items-center justify-center transition-all'
            aria-label={`Call ${booking.customer_name}`}
          >
            <Phone size={14} />
          </a>
        )}

        {isPending ? (
          <button
            onClick={(e) => { e.stopPropagation(); onConfirm(booking.id); }}
            disabled={isConfirming}
            className='inline-flex items-center gap-1 h-8 rounded-xl bg-brand-ink hover:opacity-90 active:scale-95 text-white px-2.5 text-[11px] font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed'
            aria-label='Confirm booking'
          >
            <CheckCheck size={12} />
            {isConfirming ? '…' : 'Confirm'}
          </button>
        ) : isConfirmed ? (
          <button
            onClick={(e) => { e.stopPropagation(); onComplete(booking.id); }}
            disabled={isCompleting}
            className='inline-flex items-center gap-1 h-8 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white px-2.5 text-[11px] font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed'
            aria-label='Complete booking'
          >
            <CheckCircle2 size={12} />
            {isCompleting ? '…' : 'Complete'}
          </button>
        ) : (
          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize', style.badge)}>
            {booking.status}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Bottom sheet ─── */
function BookingSheet({ booking, onClose, onConfirm, isConfirming, onComplete, isCompleting }: {
  booking: OwnerCalendarBooking;
  onClose: () => void;
  onConfirm: () => void;
  isConfirming: boolean;
  onComplete: () => void;
  isCompleting: boolean;
}) {
  const style = statusStyles[booking.status] ?? statusStyles.pending;
  const phone = booking.customer_phone;
  const canConfirm = booking.status === 'pending';
  const canComplete = booking.status === 'confirmed';
  const isCompleted = booking.status === 'completed';

  return (
    <div className='fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4'>
      <div className='absolute inset-0 bg-black/40 backdrop-blur-sm' onClick={onClose} />
      <div className='relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col'>
        <div className='sm:hidden flex justify-center pt-2.5 pb-1'>
          <div className='h-1 w-10 rounded-full bg-muted-foreground/30' />
        </div>

        {/* ── Customer card (avatar + name + status + close) ── */}
        <div className='px-5 pt-3 pb-3'>
          <div className='flex items-start justify-between gap-3'>
            <div className='flex items-center gap-3 min-w-0'>
              <div className='h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-peach to-brand-tan/40 flex items-center justify-center shrink-0'>
                <span className='text-base font-bold text-brand-ink'>{booking.customer_name[0]?.toUpperCase()}</span>
              </div>
              <div className='min-w-0'>
                <p className='text-base font-bold text-foreground truncate'>{booking.customer_name}</p>
                <p className='text-[11px] text-muted-foreground'>
                  {format(new Date(`${booking.booking_date}T00:00:00`), 'EEE, MMM d')} · {formatTime(booking.start_time)}
                </p>
              </div>
            </div>
            <div className='flex items-center gap-2 shrink-0'>
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize', style.badge)}>
                {booking.status}
              </span>
              <button onClick={onClose} className='h-8 w-8 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors'>
                <X size={13} />
              </button>
            </div>
          </div>

          {/* ── Prominent phone CTA card ── */}
          {phone ? (
            <div className='mt-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-50/40 p-3 flex items-center gap-3'>
              <div className='h-11 w-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm'>
                <Phone size={18} />
              </div>
              <div className='flex-1 min-w-0'>
                <p className='text-[10px] uppercase tracking-wide font-semibold text-emerald-700/80'>Customer phone</p>
                <a href={`tel:${phone}`} className='text-base font-bold text-emerald-900 tracking-tight tabular-nums hover:underline'>
                  {phone}
                </a>
              </div>
              <div className='flex items-center gap-1.5 shrink-0'>
                <a
                  href={`tel:${phone}`}
                  className='h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all'
                  aria-label={`Call ${booking.customer_name}`}
                >
                  <PhoneCall size={14} />
                  Call
                </a>
                <a
                  href={`sms:${phone}`}
                  className='h-10 w-10 rounded-xl bg-white border border-border hover:bg-muted/50 active:scale-95 text-foreground inline-flex items-center justify-center transition-all'
                  aria-label='Send SMS'
                >
                  <MessageCircle size={15} />
                </a>
              </div>
            </div>
          ) : (
            <div className='mt-3 rounded-2xl border border-dashed border-border bg-muted/20 p-3 flex items-center gap-3'>
              <div className='h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0'>
                <Phone size={16} className='text-muted-foreground' />
              </div>
              <p className='text-xs text-muted-foreground'>No phone number on file for this customer.</p>
            </div>
          )}

          {/* Fast visible booking state actions */}
          <div className='mt-3 space-y-2'>
            {canConfirm && (
              <button
                onClick={onConfirm}
                disabled={isConfirming}
                className='w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-brand-ink text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity'
              >
                <CheckCheck size={16} />
                {isConfirming ? 'Confirming...' : 'Confirm booking'}
              </button>
            )}
            {canComplete && (
              <button
                onClick={onComplete}
                disabled={isCompleting}
                className='w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-sky-600 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sky-700 transition-colors'
              >
                <CheckCircle2 size={16} />
                {isCompleting ? 'Completing...' : 'Complete visit'}
              </button>
            )}
            {isCompleted && (
              <div className='rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-center'>
                <p className='text-xs font-semibold text-sky-800'>Visit completed</p>
                <p className='mt-0.5 text-[11px] text-sky-700'>The customer can now add a rating and review.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Booking details ── */}
        <div className='px-5 py-3 space-y-2.5 overflow-y-auto flex-1 border-t border-border'>
          <DetailRow icon={Sparkles}    label='Service'  value={`${booking.service_name} · ${booking.service_duration_minutes} min`} />
          <DetailRow icon={Clock3}      label='Time'     value={`${formatTime(booking.start_time)} – ${formatTime(booking.end_time)}`} />
          <DetailRow icon={UsersRound}  label='Staff'    value={booking.staff_name || 'Any available'} />
          <DetailRow icon={Receipt}     label='Price'    value={formatLkr(booking.service_price)} />
          <DetailRow icon={AlertCircle} label='Payment'  value={booking.payment_status} />
          {booking.notes && <DetailRow icon={LayoutList} label='Notes' value={booking.notes} />}
        </div>

        {/* Bottom spacer for easier thumb reach + avoiding crowded edge */}
        <div className='h-3 border-t border-border bg-muted/20' />
      </div>
    </div>
  );
}

/* ─── Small components ─── */
function StatCard({ icon: Icon, label, value, tone }: {
  icon: LucideIcon; label: string; value: string; tone: 'peach' | 'blue' | 'tan' | 'sage';
}) {
  return (
    <div className={cn(
      'rounded-2xl border p-3',
      tone === 'peach' && 'surface-peach border-brand-tan/30',
      tone === 'blue'  && 'surface-blue border-[#9ab3d0]/30',
      tone === 'tan'   && 'surface-tan border-[#b8a48b]/30',
      tone === 'sage'  && 'surface-sage border-brand-sage/25',
    )}>
      <Icon size={14} className='text-brand-ink/70' />
      <p className='mt-1.5 text-lg font-bold text-foreground leading-tight'>{value}</p>
      <p className='text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5'>{label}</p>
    </div>
  );
}

function ViewToggleBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: LucideIcon; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
        active ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className='flex items-start gap-3'>
      <Icon size={13} className='text-brand-sage mt-0.5 shrink-0' />
      <div className='min-w-0 flex-1'>
        <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>{label}</p>
        <p className='text-sm font-medium text-foreground capitalize break-words'>{value}</p>
      </div>
    </div>
  );
}

function EmptyList() {
  return (
    <div className='flex flex-col items-center gap-3 py-12 px-4 text-center'>
      <div className='h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center'>
        <LayoutList size={22} className='text-muted-foreground' />
      </div>
      <p className='font-semibold text-foreground'>No bookings found</p>
      <p className='text-xs text-muted-foreground max-w-xs'>Try changing the filter or check back later.</p>
    </div>
  );
}

/* ─── Layout & time helpers ─── */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Position overlapping bookings side-by-side.
 * Each cluster of mutually-overlapping bookings is laid out in columns.
 */
function layoutBookings(bookings: OwnerCalendarBooking[]): { booking: OwnerCalendarBooking; col: number; total: number }[] {
  const sorted = [...bookings].sort((a, b) => {
    if (a.start_time !== b.start_time) return a.start_time.localeCompare(b.start_time);
    return a.end_time.localeCompare(b.end_time);
  });

  type Item = { booking: OwnerCalendarBooking; col: number };
  const placed: Item[] = [];
  // For each booking, find first available column where no overlap
  for (const b of sorted) {
    const bStart = timeToMinutes(b.start_time);
    const bEnd = timeToMinutes(b.end_time);
    // Find columns occupied during [bStart, bEnd)
    const usedCols = new Set<number>();
    for (const p of placed) {
      const pStart = timeToMinutes(p.booking.start_time);
      const pEnd = timeToMinutes(p.booking.end_time);
      if (pStart < bEnd && pEnd > bStart) usedCols.add(p.col);
    }
    let col = 0;
    while (usedCols.has(col)) col += 1;
    placed.push({ booking: b, col });
  }

  // For each booking, compute "total" = max number of columns in its overlap cluster
  return placed.map((p) => {
    const bStart = timeToMinutes(p.booking.start_time);
    const bEnd = timeToMinutes(p.booking.end_time);
    const overlappingCols = new Set<number>([p.col]);
    for (const q of placed) {
      const qStart = timeToMinutes(q.booking.start_time);
      const qEnd = timeToMinutes(q.booking.end_time);
      if (qStart < bEnd && qEnd > bStart) overlappingCols.add(q.col);
    }
    const total = Math.max(...overlappingCols) + 1;
    return { booking: p.booking, col: p.col, total };
  });
}

function formatHour(hour: number) {
  const s = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12} ${s}`;
}

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const s = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${s}`;
}

/* ─── Move confirmation modal ─── */
function MoveConfirmModal({ booking, newStartTime, newEndTime, isSaving, onCancel, onConfirm }: {
  booking: OwnerCalendarBooking;
  newStartTime: string;
  newEndTime: string;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && !isSaving) onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm, isSaving]);

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in'>
      <div className='absolute inset-0 bg-black/55 backdrop-blur-sm' onClick={onCancel} />
      <div className='relative w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden'>
        {/* Header strip */}
        <div className='relative bg-gradient-to-br from-brand-ink to-[#2a2724] text-white px-6 pt-5 pb-12'>
          <div className='absolute -top-10 -right-10 h-32 w-32 rounded-full bg-brand-peach/15 blur-2xl pointer-events-none' />
          <div className='relative flex items-center gap-2.5'>
            <div className='h-9 w-9 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center'>
              <CalendarDays size={16} className='text-brand-peach' />
            </div>
            <div>
              <p className='text-[10px] font-semibold uppercase tracking-widest text-brand-sage'>Reschedule</p>
              <p className='text-base font-bold leading-tight'>{booking.customer_name}</p>
              <p className='text-[11px] text-white/60 leading-tight'>{booking.service_name}</p>
            </div>
          </div>
        </div>

        {/* Body — old vs new */}
        <div className='-mt-7 mx-5 mb-5 rounded-2xl bg-white border border-border shadow-sm p-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3'>
          <div className='text-center'>
            <p className='text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>From</p>
            <p className='text-lg font-bold text-foreground tabular-nums leading-tight mt-1 line-through decoration-red-400'>
              {formatTime(booking.start_time)}
            </p>
            <p className='text-[10px] text-muted-foreground tabular-nums'>
              {formatTime(booking.end_time)}
            </p>
          </div>
          <div className='h-9 w-9 rounded-full bg-brand-peach/40 border border-brand-tan/40 flex items-center justify-center'>
            <ChevronRight size={14} className='text-brand-ink' />
          </div>
          <div className='text-center'>
            <p className='text-[10px] font-semibold uppercase tracking-wide text-emerald-700'>To</p>
            <p className='text-lg font-bold text-emerald-700 tabular-nums leading-tight mt-1'>
              {formatTime(newStartTime)}
            </p>
            <p className='text-[10px] text-muted-foreground tabular-nums'>
              {formatTime(newEndTime)}
            </p>
          </div>
        </div>

        {/* Helper text */}
        <p className='px-6 text-xs text-muted-foreground text-center'>
          The customer will receive a notification about the new time.
        </p>

        {/* Actions */}
        <div className='px-5 pt-4 pb-5 flex gap-2'>
          <button
            type='button'
            onClick={onCancel}
            disabled={isSaving}
            className='flex-1 h-11 rounded-xl border border-border bg-white text-sm font-semibold text-foreground hover:bg-muted/40 disabled:opacity-60 transition-colors'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={onConfirm}
            disabled={isSaving}
            className='flex-1 h-11 rounded-xl bg-gradient-to-r from-brand-ink to-[#2a2724] text-sm font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-60 transition-opacity inline-flex items-center justify-center gap-1.5'
          >
            {isSaving ? (
              <>
                <span className='h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin' />
                Saving…
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                Confirm reschedule
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
