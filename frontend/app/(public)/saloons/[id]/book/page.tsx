'use client';

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Scissors,
  UsersRound,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatLkr } from '@/lib/currency';
import { SlotPicker } from '@/components/shared/SlotPicker';
import { AvailabilitySlot, Saloon } from '@/types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { parseSaloonIdFromSlug } from '@/lib/slug';
import { RequireAuth } from '@/components/shared/RequireAuth';

const STEPS = ['Service', 'Date & Time', 'Confirm'];

export default function BookPageWrapper({ params }: { params: Promise<{ id: string }> }) {
  return (
    <RequireAuth>
      <BookPage params={params} />
    </RequireAuth>
  );
}

function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: routeParam } = use(params);
  const idNum = parseSaloonIdFromSlug(routeParam);
  const id = idNum === null ? '' : String(idNum);
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const queryClient = useQueryClient();

  const { data: saloon, isLoading: saloonLoading, isError: saloonError } = useQuery<Saloon>({
    queryKey: ['saloon', id],
    queryFn: async () => (await api.get(`/saloons/${id}`)).data,
  });
  const { data: availability, isFetching: availabilityLoading, isError: availabilityError } = useQuery<{ slots: AvailabilitySlot[] }>({
    queryKey: ['availability', id, serviceId, staffId, bookingDate],
    enabled: !!serviceId && !!bookingDate,
    queryFn: async () =>
      (await api.get(`/saloons/${id}/availability`, { params: { date: bookingDate, service_id: serviceId, staff_id: staffId || undefined } })).data,
  });

  const activeServices = useMemo(() => (saloon?.services ?? []).filter((s) => s.is_active !== false), [saloon?.services]);
  const activeStaff = useMemo(() => (saloon?.staff ?? []).filter((p) => p.is_active !== false), [saloon?.staff]);
  const selectedService = useMemo(() => activeServices.find((s) => s.id === serviceId), [activeServices, serviceId]);
  const today = new Date().toISOString().slice(0, 10);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/bookings', {
        saloon_id: Number(id),
        service_id: serviceId,
        staff_id: staffId,
        booking_date: bookingDate,
        start_time: startTime,
      });
      return data;
    },
    onMutate: () => {
      toast.loading('Confirming your booking...', { id: 'booking-submit' });
    },
    onSuccess: async (booking) => {
      toast.success('Booking placed! Opening details...', { id: 'booking-submit' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
      router.push(`/bookings/${booking.id}`);
    },
    onError: async (err: any) => {
      // The server runs `is_slot_bookable` again at write time; if a slot just
      // became infeasible (race, past time, beyond shop hours, staff conflict)
      // it returns 400 with a detail string. Surface that, then refetch
      // availability so the picker drops the stale slot.
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : 'Booking failed. Please choose another slot and try again.';
      toast.error(msg, { id: 'booking-submit' });
      setStartTime('');
      await queryClient.invalidateQueries({ queryKey: ['availability', id, serviceId, staffId, bookingDate] });
    },
  });

  if (saloonLoading) {
    return (
      <div className='mx-auto max-w-2xl px-4 py-8 space-y-3'>
        <Skeleton className='h-5 w-1/4' />
        <Skeleton className='h-2.5 rounded-full' />
        <Skeleton className='h-16 rounded-2xl' />
        <Skeleton className='h-40 rounded-2xl' />
      </div>
    );
  }
  if (saloonError || !saloon) {
    return (
      <div className='mx-auto max-w-2xl px-4 py-8'>
        <div className='text-center rounded-2xl border border-dashed border-border p-12 text-sm text-muted-foreground'>
          Saloon not found.
        </div>
      </div>
    );
  }

  const dateLabel = bookingDate
    ? new Date(bookingDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : '';

  return (
    <div className='mx-auto max-w-2xl px-4 py-8 space-y-6'>
      {/* Step indicator */}
      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          {STEPS.map((s, i) => (
            <div key={s} className='flex items-center gap-1.5'>
              <div className={cn(
                'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors',
                i + 1 < step
                  ? 'border-brand-ink bg-brand-ink text-white'
                  : i + 1 === step
                    ? 'border-brand-ink bg-white text-brand-ink'
                    : 'border-border bg-white text-muted-foreground',
              )}>
                {i + 1 < step ? <CheckCircle2 size={12} /> : i + 1}
              </div>
              <span className={cn(
                'text-xs font-medium hidden sm:inline',
                i + 1 <= step ? 'text-brand-ink' : 'text-muted-foreground',
              )}>
                {s}
              </span>
              {i < STEPS.length - 1 && (
                <div className={cn('h-0.5 w-8 sm:w-16 mx-1 rounded-full transition-colors', i + 1 < step ? 'bg-brand-ink' : 'bg-border')} />
              )}
            </div>
          ))}
        </div>
        <div className='h-1.5 rounded-full bg-muted overflow-hidden'>
          <div
            className='h-full rounded-full bg-brand-ink transition-all duration-300'
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Saloon context chip */}
      <div className='flex items-center gap-3 rounded-2xl border border-border bg-white shadow-card p-4'>
        {saloon.cover_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={saloon.cover_image} alt='' className='h-12 w-12 rounded-xl border object-cover shrink-0' />
        ) : (
          <div className='h-12 w-12 rounded-xl border bg-muted flex items-center justify-center shrink-0'>
            <CalendarCheck size={20} className='text-muted-foreground' />
          </div>
        )}
        <div>
          <p className='font-semibold text-foreground'>{saloon.name}</p>
          <p className='text-sm text-muted-foreground'>{saloon.city}</p>
        </div>
      </div>

      {/* Step 1 – Service */}
      {step === 1 && (
        <div className='space-y-3'>
          <h2 className='text-lg font-bold text-foreground'>Choose a service</h2>
          {activeServices.length === 0 ? (
            <div className='rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground'>
              This saloon has no active services right now.
            </div>
          ) : (
            <div className='space-y-2.5'>
              {activeServices.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setServiceId(s.id); setStartTime(''); }}
                  className={cn(
                    'w-full rounded-2xl border p-4 text-left transition-all hover:shadow-card',
                    serviceId === s.id
                      ? 'border-brand-ink bg-brand-peach/30 ring-2 ring-brand-tan/40'
                      : 'border-border bg-white',
                  )}
                >
                  <div className='flex items-center justify-between gap-3'>
                    <div className='flex items-center gap-2.5'>
                      <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', serviceId === s.id ? 'bg-brand-ink' : 'bg-muted')}>
                        <Scissors size={16} className={serviceId === s.id ? 'text-white' : 'text-muted-foreground'} />
                      </div>
                      <p className='font-semibold text-foreground'>{s.name}</p>
                    </div>
                    {serviceId === s.id && <CheckCircle2 size={18} className='text-brand-ink shrink-0' />}
                  </div>
                  <div className='mt-2.5 flex flex-wrap gap-3 text-sm text-muted-foreground pl-11'>
                    <span className='inline-flex items-center gap-1'><Clock size={13} />{s.duration_minutes} min</span>
                    <span className='font-semibold text-foreground'>{formatLkr(s.price)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2 – Date & Time */}
      {step === 2 && (
        <div className='space-y-4'>
          <h2 className='text-lg font-bold text-foreground'>Pick a date & time</h2>

          {activeStaff.length > 0 && (
            <div className='space-y-1.5'>
              <label className='text-sm font-medium text-foreground flex items-center gap-2'>
                <UsersRound size={15} className='text-brand-sage' /> Staff preference
              </label>
              <select
                className='w-full h-11 rounded-xl border border-border bg-white px-3 text-sm focus:outline-none focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/10 transition-all'
                onChange={(e) => { setStaffId(e.target.value ? Number(e.target.value) : null); setStartTime(''); }}
              >
                <option value=''>Any available staff</option>
                {activeStaff.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
              </select>
            </div>
          )}

          <div className='space-y-1.5'>
            <label className='text-sm font-medium text-foreground flex items-center gap-2'>
              <CalendarDays size={15} className='text-brand-sage' /> Date
            </label>
            <input
              type='date'
              min={today}
              value={bookingDate}
              onChange={(e) => { setBookingDate(e.target.value); setStartTime(''); }}
              className='w-full h-11 rounded-xl border border-border bg-white px-3 text-sm focus:outline-none focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/10 transition-all'
            />
          </div>

          {bookingDate && (
            <div className='space-y-2'>
              <p className='text-sm font-medium text-foreground'>Available slots</p>
              {availabilityLoading ? (
                <div className='grid grid-cols-3 gap-2'>
                  {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className='h-11 rounded-xl' />)}
                </div>
              ) : availabilityError ? (
                <p className='text-sm text-red-600'>Could not load slots. Try another date.</p>
              ) : (
                <SlotPicker slots={availability?.slots ?? []} value={startTime} onChange={setStartTime} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3 – Confirm */}
      {step === 3 && (
        <div className='space-y-4'>
          <h2 className='text-lg font-bold text-foreground'>Confirm your booking</h2>
          <div className='rounded-2xl border border-border bg-white shadow-card overflow-hidden'>
            <div className='bg-brand-peach/40 border-b border-border px-5 py-3'>
              <p className='text-xs font-semibold uppercase tracking-widest text-brand-sage'>Booking summary</p>
            </div>
            <div className='divide-y divide-border'>
              <SummaryRow icon={CalendarCheck} label='Saloon' value={saloon.name} />
              <SummaryRow
                icon={Scissors}
                label='Service'
                value={`${selectedService?.name} · ${formatLkr(selectedService?.price ?? 0)} · ${selectedService?.duration_minutes} min`}
              />
              <SummaryRow icon={CalendarDays} label='Date' value={dateLabel} />
              <SummaryRow icon={Clock} label='Time' value={startTime.slice(0, 5)} />
            </div>
          </div>

          {mutation.isError && (
            <div className='rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
              Booking failed. Please choose another slot and try again.
            </div>
          )}

          <Button
            variant='gradient'
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className='w-full rounded-xl h-12 text-base gap-2'
          >
            <CalendarCheck size={18} />
            {mutation.isPending ? 'Confirming…' : 'Confirm booking'}
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className='flex justify-between pt-2'>
        <Button
          variant='outline'
          disabled={step === 1}
          onClick={() => setStep((s) => s - 1)}
          className='rounded-xl px-6'
        >
          Back
        </Button>
        {step < 3 && (
          <Button
            variant='gradient'
            disabled={
              (step === 1 && (!serviceId || !activeServices.length)) ||
              (step === 2 && (!bookingDate || !startTime))
            }
            onClick={() => setStep((s) => s + 1)}
            className='rounded-xl px-6'
          >
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className='flex items-center gap-3 px-5 py-3.5'>
      <Icon size={15} className='shrink-0 text-brand-sage' />
      <span className='w-16 shrink-0 text-sm text-muted-foreground'>{label}</span>
      <span className='text-sm font-medium text-foreground'>{value}</span>
    </div>
  );
}
