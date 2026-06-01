'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Clock3,
  DollarSign,
  ImagePlus,
  Scissors,
  Sparkles,
  Store,
  TrendingUp,
  UsersRound,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatLkr } from '@/lib/currency';
import { useOwnerDashboard } from '@/lib/hooks/useOwnerDashboard';
import { useUnreadNotificationCount } from '@/lib/hooks/useNotifications';
import { Booking, Saloon } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface OwnerAnalytics {
  total_bookings: number;
  revenue: number;
  peak_hours: { hour: number; count: number }[];
  popular_services: { name: string; count: number }[];
  monthly_trend: { month: string; count: number }[];
}

function toMins(value: string) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export default function OwnerDashboardPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: analytics } = useOwnerDashboard() as { data?: OwnerAnalytics };
  const { data: saloons = [] } = useQuery<Saloon[]>({
    queryKey: ['owner-saloons'],
    queryFn: async () => (await api.get('/owner/saloons/me')).data,
  });
  const { data: todayBookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ['owner-bookings', 'today'],
    queryFn: async () => (await api.get('/owner/bookings', { params: { date: new Date().toISOString().slice(0, 10) } })).data,
  });
  const { data: pendingBookings = [] } = useQuery<Booking[]>({
    queryKey: ['owner-bookings', 'pending'],
    queryFn: async () => (await api.get('/owner/bookings', { params: { status: 'pending' } })).data,
  });
  const { data: notifStat } = useUnreadNotificationCount(Boolean(user));

  const saloon = saloons[0];
  const setupItems = useMemo(() => [
    { done: Boolean(saloon?.name), label: 'Profile' },
    { done: Boolean(saloon?.services?.length), label: 'Services' },
    { done: Boolean(saloon?.staff?.length), label: 'Staff' },
    { done: Boolean(saloon?.cover_image), label: 'Photo' },
  ], [saloon]);
  const setupScore = setupItems.filter((i) => i.done).length;
  const unreadAlerts = notifStat?.count ?? 0;
  const isOpen = saloon?.is_open !== false;

  const toggleOpen = useMutation({
    mutationFn: async (next: boolean) => {
      if (!saloon?.id) throw new Error('Set up your saloon first.');
      return api.patch(`/owner/saloons/${saloon.id}`, { is_open: next });
    },
    onMutate: async (next: boolean) => {
      await qc.cancelQueries({ queryKey: ['owner-saloons'] });
      const previous = qc.getQueryData<Saloon[]>(['owner-saloons']);
      qc.setQueryData<Saloon[]>(['owner-saloons'], (old) =>
        old?.map((s) => (s.id === saloon?.id ? { ...s, is_open: next } : s)) ?? old,
      );
      return { previous };
    },
    onError: (_err, _next, ctx) => { if (ctx?.previous) qc.setQueryData(['owner-saloons'], ctx.previous); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['owner-saloons'] }),
  });

  const nowMins = useMemo(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }, []);
  const sortedToday = useMemo(
    () => [...todayBookings].sort((a, b) => toMins(a.start_time) - toMins(b.start_time)),
    [todayBookings],
  );
  const nextBooking = sortedToday.find(
    (b) => b.status !== 'cancelled' && toMins(b.end_time) >= nowMins,
  );
  const completedToday = todayBookings.filter((b) => b.status === 'completed').length;
  const upcomingCount = sortedToday.filter((b) => b.status !== 'cancelled' && toMins(b.start_time) > nowMins).length;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const peakMax = Math.max(1, ...(analytics?.peak_hours?.map((p) => p.count) ?? [0]));
  const popularMax = Math.max(1, ...(analytics?.popular_services?.map((s) => s.count) ?? [0]));

  return (
    <div className='section-shell space-y-4 sm:space-y-5 pb-24 lg:pb-6'>

      {/* ─── HERO ─── */}
      <div className='relative overflow-hidden rounded-3xl bg-brand-ink text-white'>
        <div className='pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-brand-peach/10 blur-3xl' />
        <div className='pointer-events-none absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-brand-sage/10 blur-3xl' />

        <div className='relative px-5 py-5 sm:px-7 sm:py-6'>
          <div className='flex items-start justify-between gap-3'>
            <div className='min-w-0 flex-1'>
              <p className='text-[11px] font-semibold uppercase tracking-widest text-brand-sage/90'>
                {greeting}, {user?.name?.split(' ')[0] || 'there'}
              </p>
              <h1 className='mt-1 text-xl sm:text-2xl font-bold leading-tight truncate'>
                {saloon?.name || 'Set up your salon'}
              </h1>
              <div className='mt-2 flex items-center gap-1.5 flex-wrap'>
                {saloon?.is_approved ? (
                  <span className='inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300'>
                    <CheckCircle2 size={10} /> Live
                  </span>
                ) : saloon ? (
                  <span className='inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300'>
                    <Clock size={10} /> Pending approval
                  </span>
                ) : null}
                {saloon && (
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                    isOpen
                      ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                      : 'bg-red-500/15 border-red-400/30 text-red-300',
                  )}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />
                    {isOpen ? 'Open now' : 'Closed'}
                  </span>
                )}
              </div>
            </div>

            {saloon && (
              <button
                type='button'
                role='switch'
                aria-checked={isOpen}
                disabled={toggleOpen.isPending}
                onClick={() => toggleOpen.mutate(!isOpen)}
                className={cn(
                  'shrink-0 relative h-9 w-16 rounded-full transition-colors duration-200 shadow-inner disabled:opacity-60',
                  isOpen ? 'bg-emerald-500' : 'bg-white/15',
                )}
                aria-label={isOpen ? 'Close shop' : 'Open shop'}
              >
                <span className={cn(
                  'absolute top-0.5 h-8 w-8 rounded-full bg-white shadow-lg transition-transform duration-200 flex items-center justify-center',
                  isOpen ? 'translate-x-7' : 'translate-x-0.5',
                )}>
                  {isOpen
                    ? <Sparkles size={13} className='text-emerald-600' />
                    : <Store size={13} className='text-muted-foreground' />}
                </span>
              </button>
            )}
          </div>

          {/* Up next strip */}
          {nextBooking ? (
            <Link
              href={`/owner/bookings?id=${nextBooking.id}&date=${nextBooking.booking_date}`}
              className='mt-4 flex items-center gap-3 rounded-2xl bg-white/10 border border-white/15 px-3.5 py-2.5 hover:bg-white/15 transition-colors group'
            >
              <div className='h-9 w-9 rounded-xl bg-brand-peach/30 border border-brand-peach/30 flex items-center justify-center shrink-0'>
                <CalendarClock size={16} className='text-brand-peach' />
              </div>
              <div className='flex-1 min-w-0'>
                <p className='text-[10px] font-semibold uppercase tracking-widest text-brand-sage/80'>Up next</p>
                <p className='text-sm font-semibold text-white truncate'>
                  {nextBooking.start_time.slice(0, 5)} · Booking #{nextBooking.id}
                </p>
              </div>
              <ChevronRight size={16} className='text-white/40 group-hover:text-white/80 transition-colors shrink-0' />
            </Link>
          ) : todayBookings.length === 0 ? (
            <div className='mt-4 flex items-center gap-3 rounded-2xl bg-white/8 border border-white/10 px-3.5 py-2.5'>
              <div className='h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0'>
                <CalendarDays size={16} className='text-white/60' />
              </div>
              <div>
                <p className='text-sm font-semibold text-white'>No bookings today</p>
                <p className='text-[11px] text-white/55'>Enjoy a quiet day — or share your link to drive bookings.</p>
              </div>
            </div>
          ) : (
            <div className='mt-4 flex items-center gap-3 rounded-2xl bg-white/8 border border-white/10 px-3.5 py-2.5'>
              <div className='h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0'>
                <CheckCircle2 size={16} className='text-emerald-300' />
              </div>
              <div>
                <p className='text-sm font-semibold text-white'>All done for today</p>
                <p className='text-[11px] text-white/55'>{completedToday} appointment{completedToday !== 1 ? 's' : ''} completed.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── SETUP NUDGE (only when incomplete) ─── */}
      {saloon && setupScore < 4 && (
        <Link
          href='/owner/saloon/setup'
          className='block rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 hover:shadow-card-hover transition-all group'
        >
          <div className='flex items-center justify-between gap-3'>
            <div className='flex items-center gap-3 min-w-0'>
              <div className='h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0'>
                <Sparkles size={18} className='text-amber-600' />
              </div>
              <div className='min-w-0'>
                <p className='text-sm font-bold text-amber-900'>Complete your setup</p>
                <p className='text-[11px] text-amber-700/80'>
                  {setupScore} of 4 steps complete — finish to go live faster
                </p>
              </div>
            </div>
            <ArrowRight size={16} className='text-amber-700 group-hover:translate-x-0.5 transition-transform shrink-0' />
          </div>
          <div className='mt-3 grid grid-cols-4 gap-1.5'>
            {setupItems.map(({ done, label }) => (
              <div key={label} className='space-y-1'>
                <div className={cn(
                  'h-1 rounded-full transition-colors',
                  done ? 'bg-emerald-500' : 'bg-amber-200',
                )} />
                <p className={cn(
                  'text-[10px] font-medium truncate',
                  done ? 'text-emerald-700' : 'text-amber-700/70',
                )}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </Link>
      )}

      {/* ─── STAT TILES ─── */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
        <StatTile
          icon={CalendarDays}
          label='Today'
          value={todayBookings.length}
          hint={`${upcomingCount} upcoming`}
          accent='blue'
        />
        <StatTile
          icon={Clock3}
          label='Pending'
          value={pendingBookings.length}
          hint={pendingBookings.length > 0 ? 'Needs review' : 'All clear'}
          accent={pendingBookings.length > 0 ? 'amber' : 'sage'}
          href='/owner/bookings'
        />
        <StatTile
          icon={DollarSign}
          label='Revenue'
          value={formatLkr(analytics?.revenue ?? 0, 0)}
          hint={`${analytics?.total_bookings ?? 0} bookings`}
          accent='peach'
          href='/owner/analytics'
        />
        <StatTile
          icon={Bell}
          label='Alerts'
          value={unreadAlerts}
          hint={unreadAlerts ? 'Unread' : 'All read'}
          accent={unreadAlerts ? 'amber' : 'sage'}
        />
      </div>

      {/* ─── MAIN ROW ─── */}
      <div className='grid gap-4 lg:grid-cols-3'>
        {/* Today's schedule (2/3) */}
        <div className='lg:col-span-2 rounded-2xl border border-border bg-white shadow-card overflow-hidden'>
          <div className='flex items-center justify-between px-5 py-4 border-b border-border'>
            <div className='flex items-center gap-2'>
              <CalendarClock size={15} className='text-brand-sage' />
              <h2 className='text-sm font-bold text-foreground'>Today&apos;s schedule</h2>
              {todayBookings.length > 0 && (
                <span className='text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full'>
                  {todayBookings.length}
                </span>
              )}
            </div>
            <Link
              href='/owner/bookings'
              className='inline-flex items-center gap-1 text-xs font-medium text-brand-sage hover:text-brand-ink transition-colors'
            >
              All bookings <ArrowRight size={11} />
            </Link>
          </div>

          {bookingsLoading ? (
            <div className='p-4 space-y-2.5'>
              {[1, 2, 3].map((i) => <Skeleton key={i} className='h-14 rounded-xl' />)}
            </div>
          ) : sortedToday.length ? (
            <div className='divide-y divide-border'>
              {sortedToday.slice(0, 6).map((booking) => {
                const isPast = toMins(booking.end_time) < nowMins;
                const isCurrent = toMins(booking.start_time) <= nowMins && toMins(booking.end_time) >= nowMins;
                const isNext = booking.id === nextBooking?.id && !isCurrent;
                return (
                  <Link
                    key={booking.id}
                    href={`/owner/bookings?id=${booking.id}&date=${booking.booking_date}`}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40',
                      isCurrent && 'bg-emerald-50/60 hover:bg-emerald-50',
                      isNext && 'bg-brand-peach/15 hover:bg-brand-peach/25',
                      isPast && 'opacity-55',
                    )}
                  >
                    <div className='flex flex-col items-center w-12 shrink-0'>
                      <p className='text-sm font-bold text-foreground tabular-nums leading-none'>
                        {booking.start_time.slice(0, 5)}
                      </p>
                      <p className='text-[10px] text-muted-foreground tabular-nums mt-0.5'>
                        {booking.end_time.slice(0, 5)}
                      </p>
                    </div>
                    <div className={cn(
                      'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
                      isCurrent ? 'bg-emerald-500 text-white shadow-sm' : 'bg-brand-peach/40 text-brand-ink',
                    )}>
                      {isCurrent ? <Zap size={14} /> : <CalendarClock size={14} />}
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-semibold text-foreground truncate flex items-center gap-1.5'>
                        Booking #{booking.id}
                        {isCurrent && <span className='text-[9px] font-bold text-emerald-700 uppercase tracking-wide bg-emerald-100 px-1.5 py-0.5 rounded-full'>Now</span>}
                        {isNext && <span className='text-[9px] font-bold text-brand-ink uppercase tracking-wide bg-brand-peach/60 px-1.5 py-0.5 rounded-full'>Next</span>}
                      </p>
                      <p className='text-[11px] text-muted-foreground truncate'>
                        Customer #{booking.customer_id}
                        {booking.staff_id ? ` · Staff #${booking.staff_id}` : ''}
                      </p>
                    </div>
                    <Badge variant={booking.status as 'pending' | 'confirmed' | 'completed' | 'cancelled'}>
                      {booking.status}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={CalendarDays} message='No appointments today.' hint='Free time for marketing and admin work.' />
          )}
        </div>

        {/* Quick actions (1/3) */}
        <div className='rounded-2xl border border-border bg-white shadow-card overflow-hidden'>
          <div className='flex items-center gap-2 px-5 py-4 border-b border-border'>
            <Zap size={15} className='text-brand-sage' />
            <h2 className='text-sm font-bold text-foreground'>Quick actions</h2>
          </div>
          <div className='p-3 grid grid-cols-2 gap-2'>
            <QuickAction href='/owner/bookings' icon={CalendarDays} label='Calendar' />
            <QuickAction href='/owner/saloon/setup' icon={Scissors} label='Services' />
            <QuickAction href='/owner/saloon/setup' icon={UsersRound} label='Staff' />
            <QuickAction href='/owner/analytics' icon={BarChart3} label='Analytics' />
            <QuickAction href='/owner/saloon/setup' icon={Clock} label='Hours' />
            <QuickAction href='/owner/saloon/setup' icon={ImagePlus} label='Photos' />
          </div>
        </div>
      </div>

      {/* ─── INSIGHTS ─── */}
      <div className='grid gap-4 md:grid-cols-2'>
        {/* Top services */}
        <div className='rounded-2xl border border-border bg-white shadow-card overflow-hidden'>
          <div className='flex items-center justify-between px-5 py-4 border-b border-border'>
            <div className='flex items-center gap-2'>
              <TrendingUp size={15} className='text-brand-sage' />
              <h2 className='text-sm font-bold text-foreground'>Top services</h2>
            </div>
            <Link
              href='/owner/analytics'
              className='inline-flex items-center gap-1 text-xs font-medium text-brand-sage hover:text-brand-ink transition-colors'
            >
              Details <ArrowRight size={11} />
            </Link>
          </div>
          <div className='p-4 space-y-3'>
            {analytics?.popular_services?.length ? (
              analytics.popular_services.slice(0, 5).map((service) => {
                const pct = (service.count / popularMax) * 100;
                return (
                  <div key={service.name}>
                    <div className='flex items-center justify-between text-xs mb-1.5'>
                      <span className='font-medium text-foreground truncate flex items-center gap-1.5 min-w-0'>
                        <Scissors size={11} className='text-brand-sage shrink-0' />
                        <span className='truncate'>{service.name}</span>
                      </span>
                      <span className='text-muted-foreground tabular-nums shrink-0 ml-2 font-semibold'>
                        {service.count}
                      </span>
                    </div>
                    <div className='h-1.5 rounded-full bg-muted overflow-hidden'>
                      <div
                        className='h-full rounded-full bg-gradient-to-r from-brand-sage to-brand-ink transition-all duration-500'
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState icon={BarChart3} message='No data yet.' hint='Appears after first bookings.' />
            )}
          </div>
        </div>

        {/* Peak hours */}
        <div className='rounded-2xl border border-border bg-white shadow-card overflow-hidden'>
          <div className='flex items-center justify-between px-5 py-4 border-b border-border'>
            <div className='flex items-center gap-2'>
              <Clock size={15} className='text-brand-sage' />
              <h2 className='text-sm font-bold text-foreground'>Peak hours</h2>
            </div>
            <Link
              href='/owner/analytics'
              className='inline-flex items-center gap-1 text-xs font-medium text-brand-sage hover:text-brand-ink transition-colors'
            >
              Details <ArrowRight size={11} />
            </Link>
          </div>
          <div className='p-4'>
            {analytics?.peak_hours?.length ? (
              <div className='flex items-end justify-between gap-1 h-32'>
                {analytics.peak_hours.slice(0, 12).map((h) => {
                  const heightPct = (h.count / peakMax) * 100;
                  return (
                    <div key={h.hour} className='flex flex-col items-center justify-end gap-1 flex-1 min-w-0'>
                      <span className='text-[9px] font-semibold text-muted-foreground tabular-nums'>{h.count}</span>
                      <div
                        className='w-full rounded-t-md bg-gradient-to-t from-brand-ink to-brand-sage min-h-[4px] transition-all duration-500'
                        style={{ height: `${heightPct}%` }}
                      />
                      <span className='text-[9px] text-muted-foreground tabular-nums'>
                        {String(h.hour).padStart(2, '0')}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={Clock3} message='No data yet.' hint='Appears after bookings.' />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, hint, accent, href }: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint: string;
  accent: 'blue' | 'peach' | 'sage' | 'amber';
  href?: string;
}) {
  const accents = {
    blue:  'bg-brand-blue/40 border-brand-blue/40 text-brand-ink',
    peach: 'bg-brand-peach/60 border-brand-tan/40 text-brand-ink',
    sage:  'bg-brand-sage/15 border-brand-sage/25 text-brand-sage',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  const content = (
    <div className='rounded-2xl border border-border bg-white p-3.5 transition-all hover:shadow-card-hover hover:-translate-y-0.5 h-full'>
      <div className='flex items-center justify-between mb-2'>
        <div className={cn('h-8 w-8 rounded-xl border flex items-center justify-center', accents[accent])}>
          <Icon size={14} />
        </div>
        {href && <ArrowUpRight size={13} className='text-muted-foreground' />}
      </div>
      <p className='text-xl font-bold text-foreground leading-tight tabular-nums'>{value}</p>
      <p className='text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-1'>{label}</p>
      <p className='text-[10px] text-muted-foreground mt-0.5'>{hint}</p>
    </div>
  );
  return href ? <Link href={href} className='block'>{content}</Link> : content;
}

function EmptyState({ icon: Icon, message, hint }: { icon: LucideIcon; message: string; hint?: string }) {
  return (
    <div className='flex flex-col items-center justify-center py-8 text-center'>
      <div className='h-10 w-10 rounded-2xl bg-muted/60 flex items-center justify-center mb-2'>
        <Icon size={16} className='text-muted-foreground' />
      </div>
      <p className='text-sm font-medium text-foreground'>{message}</p>
      {hint && <p className='text-[11px] text-muted-foreground mt-0.5'>{hint}</p>}
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      href={href}
      className='flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-white p-3 hover:bg-brand-peach/20 hover:border-brand-tan/40 transition-colors'
    >
      <div className='h-9 w-9 rounded-xl bg-brand-peach/40 flex items-center justify-center'>
        <Icon size={15} className='text-brand-ink' />
      </div>
      <span className='text-[11px] font-semibold text-foreground'>{label}</span>
    </Link>
  );
}
