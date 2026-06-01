'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Scissors,
  Sparkles,
  Star,
  Store,
  Timer,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Booking, BookingStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ReviewModal } from '@/components/reviews/ReviewModal';
import { StarRating } from '@/components/reviews/StarRating';

const STATUS_CONFIG: Record<BookingStatus, {
  label: string;
  icon: typeof CheckCircle2;
  banner: string;
}> = {
  pending: {
    label: 'Pending confirmation',
    icon: Clock,
    banner: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  confirmed: {
    label: 'Confirmed',
    icon: CheckCircle2,
    banner: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    banner: 'bg-sky-50 border-sky-200 text-sky-800',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    banner: 'bg-slate-50 border-slate-200 text-slate-600',
  },
};

type EnrichedBooking = Booking & {
  saloon_name?: string;
  service_name?: string;
  staff_name?: string;
};

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const { data: booking, isLoading, isError } = useQuery<EnrichedBooking>({
    queryKey: ['booking', id],
    queryFn: async () => (await api.get(`/bookings/${id}`)).data,
  });
  const { data: queue } = useQuery<{ position: number; estimated_wait_minutes: number }>({
    queryKey: ['booking-queue', id],
    enabled: Boolean(booking) && booking?.status === 'confirmed',
    queryFn: async () => (await api.get(`/bookings/${id}/queue`)).data,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => api.patch(`/bookings/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['booking', id] });
      setConfirmCancel(false);
    },
  });

  if (isLoading) {
    return (
      <div className='mx-auto max-w-xl px-4 py-8 space-y-3'>
        <Skeleton className='h-5 w-28' />
        <Skeleton className='h-20 rounded-2xl' />
        <Skeleton className='h-48 rounded-2xl' />
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className='mx-auto max-w-xl px-4 py-8'>
        <div className='flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border'>
          <div className='h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3'>
            <AlertCircle size={24} className='text-muted-foreground' />
          </div>
          <p className='font-semibold text-foreground'>Booking not found</p>
          <Link href='/bookings' className='mt-4'>
            <Button variant='outline' size='sm' className='rounded-xl'>Back to bookings</Button>
          </Link>
        </div>
      </div>
    );
  }

  const config = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = config.icon;

  const dateLabel = (() => {
    try {
      return new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      });
    } catch { return booking.booking_date; }
  })();

  return (
    <div className='mx-auto max-w-xl px-4 py-8 space-y-4'>
      {/* Back */}
      <Link href='/bookings' className='inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors'>
        <ArrowLeft size={15} /> My bookings
      </Link>

      {/* Status banner */}
      <div className={cn('flex items-center gap-3 rounded-2xl border p-4', config.banner)}>
        <div className='h-10 w-10 rounded-xl bg-white/50 flex items-center justify-center shrink-0'>
          <StatusIcon size={20} />
        </div>
        <div>
          <p className='font-semibold'>{config.label}</p>
          <p className='text-sm opacity-70'>Booking #{booking.id}</p>
        </div>
        <Badge variant={booking.status} className='ml-auto' />
      </div>

      {/* Queue position */}
      {queue && (
        <div className='flex items-center gap-3 rounded-2xl border border-brand-tan/40 bg-brand-peach/40 p-4'>
          <div className='h-10 w-10 rounded-xl bg-brand-tan/50 flex items-center justify-center shrink-0'>
            <Sparkles size={18} className='text-brand-ink' />
          </div>
          <div>
            <p className='font-semibold text-brand-ink'>Queue position #{queue.position}</p>
            <p className='text-sm text-brand-sage'>Estimated wait: ~{queue.estimated_wait_minutes} min</p>
          </div>
        </div>
      )}

      {/* Review — only for completed bookings */}
      {booking.status === 'completed' && (
        booking.has_review ? (
          <div className='rounded-2xl border border-border bg-white shadow-card p-5'>
            <p className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>Your review</p>
            <div className='mt-2 flex items-center gap-2'>
              <StarRating value={booking.review_rating ?? 0} size={18} />
              <span className='text-sm font-semibold text-foreground'>{booking.review_rating}/5</span>
            </div>
            {booking.review_comment && (
              <p className='mt-2 text-sm text-foreground/80 leading-relaxed whitespace-pre-line'>{booking.review_comment}</p>
            )}
          </div>
        ) : (
          <div className='relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5'>
            <div className='absolute -top-6 -right-6 h-24 w-24 rounded-full bg-amber-200/40 blur-2xl' />
            <div className='relative flex items-start gap-3'>
              <div className='h-11 w-11 shrink-0 rounded-2xl bg-amber-400/20 flex items-center justify-center'>
                <Star size={22} className='text-amber-500 fill-amber-400' />
              </div>
              <div className='min-w-0'>
                <p className='font-bold text-foreground'>How was your visit?</p>
                <p className='mt-0.5 text-sm text-muted-foreground'>
                  Rate {booking.saloon_name ?? 'this shop'} and help others choose.
                </p>
                <Button onClick={() => setReviewOpen(true)} variant='gradient' size='sm' className='mt-3 rounded-xl gap-1.5'>
                  <Star size={14} /> Rate &amp; review
                </Button>
              </div>
            </div>
          </div>
        )
      )}

      {/* Details card */}
      <div className='rounded-2xl border border-border bg-white shadow-card overflow-hidden'>
        <div className='border-b border-border bg-muted/30 px-5 py-3.5'>
          <p className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>Appointment details</p>
        </div>
        <div className='divide-y divide-border'>
          <DetailRow icon={CalendarDays} label='Date' value={dateLabel} />
          <DetailRow icon={Clock} label='Time' value={`${booking.start_time.slice(0, 5)} – ${booking.end_time.slice(0, 5)}`} />
          {booking.saloon_name && <DetailRow icon={Store} label='Saloon' value={booking.saloon_name} />}
          {booking.service_name && <DetailRow icon={Scissors} label='Service' value={booking.service_name} />}
          <DetailRow
            icon={Timer}
            label='Status'
            value={<Badge variant={booking.status}>{config.label}</Badge>}
          />
        </div>
      </div>

      {/* Cancel */}
      {booking.status !== 'cancelled' && booking.status !== 'completed' && (
        <div>
          {!confirmCancel ? (
            <Button
              variant='outline'
              onClick={() => setConfirmCancel(true)}
              className='border-red-200 text-red-700 hover:bg-red-50 rounded-xl'
            >
              <XCircle size={16} /> Cancel booking
            </Button>
          ) : (
            <div className='rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3'>
              <div>
                <p className='font-semibold text-red-800'>Cancel this booking?</p>
                <p className='text-sm text-red-700 mt-0.5'>This action cannot be undone.</p>
              </div>
              <div className='flex gap-2'>
                <Button
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate()}
                  className='bg-red-600 hover:bg-red-700 text-white rounded-xl'
                  size='sm'
                >
                  {cancelMutation.isPending ? 'Cancelling…' : 'Yes, cancel'}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setConfirmCancel(false)}
                  className='rounded-xl'
                >
                  Keep booking
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <ReviewModal
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        bookingId={booking.id}
        saloonId={booking.saloon_id}
        saloonName={booking.saloon_name}
        serviceName={booking.service_name}
      />
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: React.ReactNode }) {
  return (
    <div className='flex items-center gap-3 px-5 py-3.5'>
      <Icon size={16} className='shrink-0 text-brand-sage' />
      <span className='w-16 shrink-0 text-sm text-muted-foreground'>{label}</span>
      <span className='text-sm font-medium text-foreground'>{value}</span>
    </div>
  );
}
