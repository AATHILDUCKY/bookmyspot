import { CalendarDays, Clock, Scissors } from 'lucide-react';
import { Booking, BookingStatus } from '@/types';
import { cn } from '@/lib/utils';

type EnrichedBooking = Booking & {
  saloon_name?: string | null;
  service_name?: string | null;
};

const statusConfig: Record<BookingStatus, { label: string; dot: string; badge: string }> = {
  pending:   { label: 'Pending',   dot: 'bg-amber-400',    badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { label: 'Confirmed', dot: 'bg-emerald-500',  badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  completed: { label: 'Completed', dot: 'bg-sky-500',      badge: 'bg-sky-50 text-sky-700 border-sky-200' },
  cancelled: { label: 'Cancelled', dot: 'bg-slate-300',    badge: 'bg-slate-50 text-slate-500 border-slate-200' },
};

export function BookingCard({ booking }: { booking: EnrichedBooking }) {
  const status = statusConfig[booking.status] ?? statusConfig.pending;

  const dateLabel = (() => {
    try {
      return new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      });
    } catch { return booking.booking_date; }
  })();

  return (
    <div className='group relative rounded-2xl bg-white border border-border/60 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 p-4 overflow-hidden'>
      {/* Subtle status accent stripe at left */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1', status.dot)} />

      <div className='flex items-start justify-between gap-3 pl-1'>
        <div className='min-w-0 flex-1'>
          <p className='truncate font-semibold text-sm text-foreground'>
            {booking.saloon_name ?? `Booking #${booking.id}`}
          </p>
          {booking.service_name && (
            <p className='mt-1 flex items-center gap-1.5 text-xs text-muted-foreground truncate'>
              <Scissors size={11} className='shrink-0 text-brand-sage' />
              {booking.service_name}
            </p>
          )}
        </div>
        <span className={cn('shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize', status.badge)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
          {status.label}
        </span>
      </div>

      <div className='mt-3 flex items-center gap-3 pl-1 text-xs text-muted-foreground'>
        <span className='flex items-center gap-1.5'>
          <CalendarDays size={12} className='text-brand-sage' />
          {dateLabel}
        </span>
        <span className='h-3 w-px bg-border' />
        <span className='flex items-center gap-1.5'>
          <Clock size={12} className='text-brand-sage' />
          {booking.start_time.slice(0, 5)} – {booking.end_time.slice(0, 5)}
        </span>
      </div>
    </div>
  );
}
