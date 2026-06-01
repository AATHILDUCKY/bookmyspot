'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarCheck, Clock3, Heart, Search, Sparkles, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BookingCard } from '@/components/shared/BookingCard';
import { SaloonCard } from '@/components/shared/SaloonCard';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBookings } from '@/lib/hooks/useBookings';
import { useUnreadNotificationCount } from '@/lib/hooks/useNotifications';
import { Saloon } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const STAT_STYLES = [
  { bg: 'bg-brand-peach border-brand-tan/50', icon: 'text-brand-ink bg-brand-tan/60' },
  { bg: 'bg-brand-blue border-brand-blue/50', icon: 'text-brand-ink bg-white/50' },
  { bg: 'bg-brand-tan border-brand-tan/50', icon: 'text-brand-ink bg-brand-peach/60' },
  { bg: 'bg-brand-sage/15 border-brand-sage/25', icon: 'text-brand-sage bg-brand-sage/20' },
];

export default function CustomerDashboardPage() {
  const { user } = useAuth();
  const { data: upcoming = [], isLoading: bookingsLoading } = useBookings('upcoming');
  const { data: past = [] } = useBookings('past');
  const { data: notifStat } = useUnreadNotificationCount(Boolean(user));
  const { data: favourites, isLoading: favouritesLoading } = useQuery<{ items: Saloon[] }>({
    queryKey: ['favourites'],
    enabled: Boolean(user),
    queryFn: async () => (await api.get('/favourites')).data,
  });
  const { data: featured = [] } = useQuery<Saloon[]>({
    queryKey: ['saloons', 'customer-dashboard'],
    queryFn: async () => (await api.get('/saloons', { params: { sort: 'rating', limit: 3 } })).data,
  });

  const nextBooking = upcoming[0];
  const unread = notifStat?.count ?? 0;

  const stats = [
    { icon: CalendarCheck, label: 'Upcoming', value: upcoming.length },
    { icon: Clock3, label: 'Past visits', value: past.length },
    { icon: Heart, label: 'Saved', value: favourites?.items?.length ?? 0 },
    { icon: UserRound, label: 'Alerts', value: unread },
  ];

  return (
    <div className='section-shell space-y-6'>
      {/* Hero welcome banner — warm peach */}
      <div className='relative overflow-hidden rounded-3xl bg-brand-peach p-6 sm:p-8'>
        <div className='pointer-events-none absolute -top-8 -right-8 h-48 w-48 rounded-full bg-brand-tan/40 blur-2xl' />
        <div className='pointer-events-none absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-brand-blue/25 blur-xl' />
        <div className='relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-widest text-brand-sage mb-1'>Your dashboard</p>
            <h1 className='text-2xl sm:text-3xl font-bold leading-snug text-brand-ink'>
              Hi {user?.name?.split(' ')[0] || 'there'} 👋
            </h1>
            <p className='mt-1.5 text-sm text-brand-sage'>
              {nextBooking
                ? `Next appointment on ${nextBooking.booking_date} at ${nextBooking.start_time.slice(0, 5)}`
                : 'No upcoming bookings. Book your next visit!'}
            </p>
          </div>
          <Link href='/shops'>
            <Button className='bg-brand-ink text-white hover:bg-brand-ink/90 rounded-xl shrink-0'>
              <Search size={16} />
              Find shops
            </Button>
          </Link>
        </div>

        {/* Next booking card inside hero */}
        {nextBooking && (
          <Link href={`/bookings/${nextBooking.id}`} className='relative mt-5 flex items-center justify-between rounded-2xl bg-white/50 border border-brand-tan/40 backdrop-blur-sm px-4 py-3 hover:bg-white/60 transition-colors'>
            <div className='flex items-center gap-3'>
              <div className='h-9 w-9 rounded-xl bg-brand-tan/50 flex items-center justify-center'>
                <Sparkles size={17} className='text-brand-ink' />
              </div>
              <div>
                <p className='text-sm font-semibold text-brand-ink'>Booking #{nextBooking.id}</p>
                <p className='text-xs text-brand-sage'>{nextBooking.booking_date} · {nextBooking.start_time.slice(0, 5)}</p>
              </div>
            </div>
            <ArrowRight size={16} className='text-brand-sage' />
          </Link>
        )}
      </div>

      {/* Stat cards */}
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        {stats.map(({ icon: Icon, label, value }, i) => {
          const style = STAT_STYLES[i];
          return (
            <div key={label} className={cn('rounded-2xl border p-4', style.bg)}>
              <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center mb-3', style.icon)}>
                <Icon size={18} />
              </div>
              <p className='text-2xl font-bold text-brand-ink'>{value}</p>
              <p className='text-xs text-brand-sage mt-0.5'>{label}</p>
            </div>
          );
        })}
      </div>

      {/* Two-column section */}
      <div className='grid gap-5 xl:grid-cols-2'>
        {/* Upcoming bookings */}
        <div className='rounded-2xl border border-border bg-white shadow-card overflow-hidden'>
          <SectionHeader title='Upcoming bookings' href='/bookings' />
          <div className='divide-y divide-border'>
            {bookingsLoading ? (
              <div className='p-4 space-y-3'>
                {[1, 2].map((i) => <Skeleton key={i} className='h-20 rounded-xl' />)}
              </div>
            ) : upcoming.slice(0, 3).length ? (
              <div className='p-4 space-y-3'>
                {upcoming.slice(0, 3).map((b) => (
                  <Link key={b.id} href={`/bookings/${b.id}`} className='block hover:opacity-90 transition-opacity'>
                    <BookingCard booking={b} />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CalendarCheck}
                message='No upcoming appointments'
                action={{ label: 'Book now', href: '/shops' }}
              />
            )}
          </div>
        </div>

        {/* Saved favourites */}
        <div className='rounded-2xl border border-border bg-white shadow-card overflow-hidden'>
          <SectionHeader title='Saved favourites' href='/favourites' />
          <div className='p-4'>
            {favouritesLoading ? (
              <div className='space-y-3'>
                {[1, 2].map((i) => <Skeleton key={i} className='h-24 rounded-xl' />)}
              </div>
            ) : favourites?.items?.length ? (
              <div className='grid gap-3'>
                {favourites.items.slice(0, 2).map((s) => <SaloonCard key={s.id} saloon={s} />)}
              </div>
            ) : (
              <EmptyState
                icon={Heart}
                message='No saved shops yet'
                action={{ label: 'Explore', href: '/shops' }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Top-rated shops */}
      <div className='rounded-2xl border border-border bg-white shadow-card overflow-hidden'>
        <SectionHeader title='Top-rated shops' href='/shops' />
        <div className='p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {featured.map((s) => <SaloonCard key={s.id} saloon={s} />)}
          {!featured.length && <EmptyState icon={Search} message='No featured shops yet.' />}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className='flex items-center justify-between px-5 py-4 border-b border-border'>
      <h2 className='text-sm font-semibold text-foreground'>{title}</h2>
      <Link href={href} className='inline-flex items-center gap-1 text-xs font-medium text-brand-sage hover:text-brand-ink transition-colors'>
        View all <ArrowRight size={13} />
      </Link>
    </div>
  );
}

function EmptyState({ icon: Icon, message, action }: { icon: LucideIcon; message: string; action?: { label: string; href: string } }) {
  return (
    <div className='flex flex-col items-center justify-center py-10 text-center px-4'>
      <div className='h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3'>
        <Icon size={22} className='text-muted-foreground' />
      </div>
      <p className='text-sm text-muted-foreground'>{message}</p>
      {action && (
        <Link href={action.href} className='mt-3'>
          <Button variant='outline' size='sm' className='rounded-xl'>{action.label}</Button>
        </Link>
      )}
    </div>
  );
}
