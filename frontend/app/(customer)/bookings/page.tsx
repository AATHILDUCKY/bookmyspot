'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  RefreshCw,
  Scissors,
  Sparkles,
  Star,
  Timer,
  XCircle,
} from 'lucide-react';
import { useBookings } from '@/lib/hooks/useBookings';
import { StarRating } from '@/components/reviews/StarRating';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatLkr } from '@/lib/currency';
import { cn } from '@/lib/utils';
import type { Booking, BookingStatus } from '@/types';

const TABS = [
  { key: 'upcoming', label: 'Upcoming', icon: CalendarDays },
  { key: 'past', label: 'Past', icon: Clock },
  { key: 'cancelled', label: 'Cancelled', icon: XCircle },
] as const;

type Tab = (typeof TABS)[number]['key'];

const EMPTY: Record<Tab, { icon: typeof CalendarDays; title: string; sub: string; action?: { label: string; href: string } }> = {
  upcoming: {
    icon: Sparkles,
    title: 'No upcoming appointments',
    sub: 'Find a salon you love and book your next visit in seconds.',
    action: { label: 'Browse shops', href: '/shops' },
  },
  past: { icon: Clock, title: 'No past visits yet', sub: 'Once you complete a booking, it will appear here.' },
  cancelled: { icon: XCircle, title: 'No cancelled bookings', sub: "You haven't cancelled any appointments." },
};

export default function BookingsPage() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const { data, isLoading, isFetching, refetch } = useBookings(tab);
  const empty = EMPTY[tab];

  // Compute the "hero" next-up booking and split the rest by date group.
  const { hero, groups } = useMemo(() => groupBookings(data ?? [], tab), [data, tab]);

  return (
    <div className='mx-auto max-w-3xl px-4 pt-6 pb-28 md:pb-10 space-y-6'>
      {/* ─── Header ─── */}
      <header className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-3 min-w-0'>
          <div className='h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-peach via-brand-tan to-brand-sage/60 flex items-center justify-center shadow-sm shrink-0'>
            <CalendarDays size={22} className='text-brand-ink' strokeWidth={2.2} />
          </div>
          <div className='min-w-0'>
            <h1 className='text-xl sm:text-2xl font-bold text-foreground leading-tight'>My Bookings</h1>
            <p className='text-xs sm:text-sm text-muted-foreground truncate'>
              Track every visit in one place.
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className={cn(
            'h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition',
            isFetching && 'pointer-events-none',
          )}
          aria-label='Refresh'
        >
          <RefreshCw size={16} className={cn(isFetching && 'animate-spin')} />
        </button>
      </header>

      {/* ─── Tab pills ─── */}
      <div className='flex gap-1.5 rounded-2xl border border-border bg-muted/40 p-1'>
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = tab === key;
          const showCount = isActive && data;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-all relative',
                isActive
                  ? 'bg-white text-brand-ink shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon size={15} strokeWidth={2} />
              <span>{label}</span>
              {showCount && data.length > 0 && (
                <span className={cn(
                  'ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                  'bg-brand-ink text-white',
                )}>
                  {data.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Loading skeletons ─── */}
      {isLoading && (
        <div className='space-y-3'>
          <Skeleton className='h-36 rounded-3xl' />
          <Skeleton className='h-24 rounded-2xl' />
          <Skeleton className='h-24 rounded-2xl' />
        </div>
      )}

      {/* ─── Empty state ─── */}
      {!isLoading && (!data || data.length === 0) && (
        <EmptyState empty={empty} />
      )}

      {/* ─── Content ─── */}
      {!isLoading && data && data.length > 0 && (
        <div className='space-y-5'>
          {hero && tab === 'upcoming' && <HeroBookingCard booking={hero} />}

          {groups.map(({ key, label, items }) => (
            <section key={key} className='space-y-2.5'>
              <div className='flex items-center gap-2 px-1'>
                <h2 className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                  {label}
                </h2>
                <span className='text-xs text-muted-foreground/70'>· {items.length}</span>
                <div className='flex-1 h-px bg-border/60 ml-1' />
              </div>
              <div className='space-y-2.5'>
                {items.map((b) => (
                  <Link key={b.id} href={`/bookings/${b.id}`} className='block'>
                    <BookingRow booking={b} />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Hero next-upcoming card                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

function HeroBookingCard({ booking }: { booking: Booking }) {
  const status = STATUS[booking.status];
  const start = parseBookingDateTime(booking.booking_date, booking.start_time);
  const relative = formatRelativeUpcoming(start);
  const dateLabel = start.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <Link
      href={`/bookings/${booking.id}`}
      className='block group relative overflow-hidden rounded-3xl shadow-card-hover hover:shadow-lg transition-all duration-300'
    >
      {/* Gradient backdrop */}
      <div className='absolute inset-0 bg-gradient-to-br from-brand-ink via-[#2a2724] to-brand-ink' />
      {/* Decorative blobs */}
      <div className='absolute -top-10 -right-10 h-40 w-40 rounded-full bg-brand-sage/30 blur-3xl' />
      <div className='absolute -bottom-12 -left-8 h-44 w-44 rounded-full bg-brand-peach/20 blur-3xl' />

      <div className='relative p-5 sm:p-6 text-white'>
        <div className='flex items-start justify-between gap-3'>
          <div className='inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider'>
            <Sparkles size={11} />
            Next up
          </div>
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize border',
            'bg-white/10 border-white/20 text-white',
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
            {status.label}
          </span>
        </div>

        <h3 className='mt-4 text-xl sm:text-2xl font-bold leading-tight truncate'>
          {booking.saloon_name ?? `Booking #${booking.id}`}
        </h3>
        {booking.service_name && (
          <p className='mt-1 flex items-center gap-1.5 text-sm text-white/70'>
            <Scissors size={13} />
            <span className='truncate'>{booking.service_name}</span>
            {booking.service_price != null && (
              <span className='ml-1 font-semibold text-white'>· {formatLkr(booking.service_price, 0)}</span>
            )}
          </p>
        )}

        <div className='mt-5 flex items-center justify-between gap-3'>
          <div>
            <p className='text-[11px] uppercase tracking-wider text-white/50'>{dateLabel}</p>
            <p className='mt-0.5 text-2xl font-bold tabular-nums'>
              {formatTime(booking.start_time)}
            </p>
            <p className='mt-0.5 text-xs text-brand-sage font-semibold'>{relative}</p>
          </div>
          <div className='shrink-0'>
            <span className='inline-flex items-center gap-1.5 rounded-full bg-white text-brand-ink font-semibold text-sm px-3.5 py-2 shadow-sm group-hover:gap-2.5 transition-all'>
              Details
              <ArrowRight size={14} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Row card                                                                */
/* ──────────────────────────────────────────────────────────────────────── */

function BookingRow({ booking }: { booking: Booking }) {
  const status = STATUS[booking.status];
  const start = parseBookingDateTime(booking.booking_date, booking.start_time);
  const day = start.getDate();
  const month = start.toLocaleDateString('en-US', { month: 'short' });
  const isCompleted = booking.status === 'completed';

  return (
    <div className='group relative flex items-stretch gap-3 rounded-2xl bg-white border border-border/60 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 p-3 overflow-hidden'>
      {/* Date tile (left) */}
      <div className={cn(
        'shrink-0 w-14 rounded-xl flex flex-col items-center justify-center text-center',
        status.tile,
      )}>
        <span className='text-[10px] font-bold uppercase tracking-wider opacity-80'>{month}</span>
        <span className='text-xl font-bold leading-none tabular-nums mt-0.5'>{day}</span>
      </div>

      {/* Body */}
      <div className='flex-1 min-w-0 flex flex-col justify-center'>
        <div className='flex items-start justify-between gap-2'>
          <p className='font-semibold text-sm text-foreground truncate'>
            {booking.saloon_name ?? `Booking #${booking.id}`}
          </p>
          <span className={cn(
            'shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
            status.badge,
          )}>
            {isCompleted && <CheckCircle2 size={9} />}
            {!isCompleted && <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />}
            {status.label}
          </span>
        </div>
        {booking.service_name && (
          <p className='mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground truncate'>
            <Scissors size={10} className='shrink-0 text-brand-sage' />
            <span className='truncate'>{booking.service_name}</span>
          </p>
        )}
        <div className='mt-1.5 flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground'>
          <span className='flex items-center gap-1'>
            <Clock size={11} className='text-brand-sage' />
            <span className='tabular-nums'>{formatTime(booking.start_time)} – {formatTime(booking.end_time)}</span>
          </span>
          {booking.service_duration_minutes != null && (
            <span className='flex items-center gap-1'>
              <Timer size={11} className='text-brand-sage' />
              {booking.service_duration_minutes} min
            </span>
          )}
          {booking.saloon_city && (
            <span className='flex items-center gap-1 min-w-0'>
              <MapPin size={11} className='text-brand-sage shrink-0' />
              <span className='truncate'>{booking.saloon_city}</span>
            </span>
          )}
        </div>

        {/* Review state for completed visits */}
        {isCompleted && (
          booking.has_review ? (
            <div className='mt-1.5 flex items-center gap-1.5'>
              <StarRating value={booking.review_rating ?? 0} size={12} />
              <span className='text-[11px] text-muted-foreground'>You rated {booking.review_rating}/5</span>
            </div>
          ) : (
            <span className='mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700 w-fit'>
              <Star size={10} className='fill-amber-400 text-amber-400' /> Rate your visit
            </span>
          )
        )}
      </div>

      <ChevronRight size={16} className='self-center shrink-0 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition' />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Empty state                                                             */
/* ──────────────────────────────────────────────────────────────────────── */

function EmptyState({ empty }: { empty: (typeof EMPTY)[Tab] }) {
  const Icon = empty.icon;
  return (
    <div className='relative overflow-hidden rounded-3xl border border-dashed border-border bg-gradient-to-br from-brand-peach/20 via-white to-brand-sage/10 px-6 py-14 text-center'>
      <div className='absolute -top-6 -right-6 h-24 w-24 rounded-full bg-brand-tan/20 blur-2xl' />
      <div className='relative mx-auto h-16 w-16 rounded-3xl bg-white shadow-sm flex items-center justify-center mb-4'>
        <Icon size={26} className='text-brand-ink' strokeWidth={1.75} />
      </div>
      <p className='relative font-bold text-foreground text-base'>{empty.title}</p>
      <p className='relative mt-1.5 text-sm text-muted-foreground max-w-xs mx-auto'>{empty.sub}</p>
      {empty.action && (
        <Link href={empty.action.href} className='relative mt-5 inline-block'>
          <Button variant='gradient' className='rounded-xl px-5'>
            {empty.action.label}
            <ArrowRight size={14} className='ml-1' />
          </Button>
        </Link>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Status palette                                                          */
/* ──────────────────────────────────────────────────────────────────────── */

const STATUS: Record<BookingStatus, { label: string; dot: string; badge: string; tile: string }> = {
  pending: {
    label: 'Pending',
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    tile: 'bg-amber-50 text-amber-700 border border-amber-100',
  },
  confirmed: {
    label: 'Confirmed',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    tile: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  },
  completed: {
    label: 'Completed',
    dot: 'bg-sky-500',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    tile: 'bg-sky-50 text-sky-700 border border-sky-100',
  },
  cancelled: {
    label: 'Cancelled',
    dot: 'bg-slate-300',
    badge: 'bg-slate-50 text-slate-500 border-slate-200',
    tile: 'bg-slate-50 text-slate-500 border border-slate-100',
  },
};

/* ──────────────────────────────────────────────────────────────────────── */
/*  Date helpers                                                            */
/* ──────────────────────────────────────────────────────────────────────── */

function parseBookingDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}`);
}

function formatTime(t: string): string {
  // t is "HH:MM:SS"; render as "h:mm AM/PM" without seconds.
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return t.slice(0, 5);
  const period = h >= 12 ? 'PM' : 'AM';
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:${String(m).padStart(2, '0')} ${period}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / (24 * 3600 * 1000));
}

function formatRelativeUpcoming(when: Date): string {
  const now = new Date();
  const diffMs = when.getTime() - now.getTime();
  const days = daysBetween(when, now);
  if (diffMs < 0) return 'Started';
  const hours = diffMs / (1000 * 60 * 60);
  if (days === 0) {
    if (hours < 1) return `In ${Math.max(1, Math.round(diffMs / 60000))} min`;
    return `In ${Math.round(hours)}h · today`;
  }
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  if (days < 14) return 'Next week';
  return `In ${Math.round(days / 7)} weeks`;
}

type Group = { key: string; label: string; items: Booking[] };

function groupBookings(items: Booking[], tab: Tab): { hero: Booking | null; groups: Group[] } {
  if (items.length === 0) return { hero: null, groups: [] };

  if (tab === 'upcoming') {
    // First item (soonest) becomes the hero; group the rest.
    const [first, ...rest] = items;
    const buckets: Record<string, Group> = {
      today: { key: 'today', label: 'Today', items: [] },
      tomorrow: { key: 'tomorrow', label: 'Tomorrow', items: [] },
      week: { key: 'week', label: 'This week', items: [] },
      later: { key: 'later', label: 'Later', items: [] },
    };
    const now = new Date();
    for (const b of rest) {
      const when = parseBookingDateTime(b.booking_date, b.start_time);
      const d = daysBetween(when, now);
      if (d <= 0) buckets.today.items.push(b);
      else if (d === 1) buckets.tomorrow.items.push(b);
      else if (d < 7) buckets.week.items.push(b);
      else buckets.later.items.push(b);
    }
    return {
      hero: first,
      groups: Object.values(buckets).filter((g) => g.items.length > 0),
    };
  }

  // Past / cancelled — group by month.
  const map = new Map<string, Group>();
  for (const b of items) {
    const when = parseBookingDateTime(b.booking_date, b.start_time);
    const key = `${when.getFullYear()}-${when.getMonth()}`;
    const label = when.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    let group = map.get(key);
    if (!group) {
      group = { key, label, items: [] };
      map.set(key, group);
    }
    group.items.push(b);
  }
  return { hero: null, groups: Array.from(map.values()) };
}
