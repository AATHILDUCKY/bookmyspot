'use client';

import Link from 'next/link';
import { ArrowRight, CalendarCheck, CheckCircle2, Clock, Flame, Heart, MapPin, Scissors, Search, Shield, Sparkles, Star, Zap } from 'lucide-react';
import { useSaloons } from '@/lib/hooks/useSaloons';
import { SaloonCard } from '@/components/shared/SaloonCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';

const FEATURES = [
  {
    icon: Search,
    title: 'Discover saloons',
    desc: 'Find by name, city, service, or GPS.',
    color: 'bg-brand-peach text-brand-ink',
  },
  {
    icon: CalendarCheck,
    title: 'Instant booking',
    desc: 'Pick a slot, confirm in seconds.',
    color: 'bg-brand-blue text-brand-ink',
  },
  {
    icon: Star,
    title: 'Verified reviews',
    desc: 'Real ratings from real customers.',
    color: 'bg-brand-tan text-brand-ink',
  },
  {
    icon: Shield,
    title: 'Trusted platform',
    desc: 'All saloons reviewed and approved.',
    color: 'bg-brand-sage/20 text-brand-sage',
  },
];

export default function HomePage() {
  const { user } = useAuth();
  const { data, isLoading } = useSaloons({ page: 1, limit: 8 });

  return (
    <div className='flex flex-col'>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className='relative overflow-hidden bg-brand-ink px-4 pt-10 pb-16 sm:pt-16 sm:pb-24 lg:px-8 lg:pt-20 lg:pb-28'>
        {/* Decorative blobs */}
        <div className='pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full bg-brand-peach/8 blur-3xl lg:h-[28rem] lg:w-[28rem] lg:-top-32 lg:-right-32' />
        <div className='pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-brand-tan/8 blur-2xl lg:h-[24rem] lg:w-[24rem] lg:-left-20' />
        <div className='pointer-events-none absolute top-1/2 left-1/3 h-40 w-40 rounded-full bg-brand-blue/10 blur-2xl' />
        {/* Subtle grid texture (desktop only) */}
        <div
          className='pointer-events-none absolute inset-0 hidden lg:block opacity-[0.06]'
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className='relative mx-auto max-w-4xl lg:max-w-7xl lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:items-center'>
          {/* ── Left: copy + CTAs (kept identical at base/sm) ── */}
          <div>
            <div className='inline-flex items-center gap-2 rounded-full bg-white/8 border border-white/12 px-3.5 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm mb-5'>
              <Scissors size={12} strokeWidth={2.5} />
              Sri Lanka&apos;s premium beauty and grooming booking platform
            </div>

            <h1 className='text-3xl sm:text-5xl md:text-6xl font-bold text-white leading-tight tracking-tight lg:text-[4.25rem] lg:leading-[1.05]'>
              Book your perfect<br />
              <span className='bg-gradient-to-r from-brand-peach to-brand-blue bg-clip-text text-transparent'>
                salon slot
              </span>{' '}
              instantly
            </h1>
            <p className='mt-4 text-base sm:text-lg text-white/50 max-w-xl lg:mt-5 lg:text-xl'>
              Discover top-rated shops, compare services, and lock in your appointment in seconds.
            </p>

            {/* CTA row */}
            <div className='mt-7 flex flex-wrap gap-3 lg:mt-9'>
              <Link href='/shops'>
                <Button size='lg' className='rounded-xl bg-white text-brand-ink hover:bg-brand-cream shadow-lg lg:h-14 lg:px-7 lg:text-base'>
                  <Search size={18} />
                  Explore shops
                  <ArrowRight size={16} />
                </Button>
              </Link>
              {!user && (
                <Link href='/register'>
                  <Button size='lg' variant='outline' className='rounded-xl border-white/20 bg-white/8 text-white hover:bg-white/15 backdrop-blur-sm lg:h-14 lg:px-7 lg:text-base'>
                    Join free
                  </Button>
                </Link>
              )}
            </div>

            {/* Mobile search shortcut — unchanged */}
            <Link href='/shops' className='mt-6 flex sm:hidden items-center gap-3 rounded-2xl bg-white/8 border border-white/12 backdrop-blur-sm px-4 py-3.5'>
              <Search size={17} className='text-white/50 shrink-0' />
              <span className='text-sm text-white/40'>Search for a shop near you...</span>
            </Link>

            {/* Stats pills */}
            <div className='mt-8 flex flex-wrap gap-3 lg:mt-10 lg:gap-4'>
              {[
                { icon: MapPin, label: '50+ cities' },
                { icon: Star, label: '4.8 avg rating' },
                { icon: Zap, label: '2 min booking' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className='flex items-center gap-1.5 rounded-full bg-white/8 border border-white/10 px-3 py-1.5 text-xs text-white/60 lg:px-4 lg:py-2 lg:text-sm'>
                  <Icon size={12} className='lg:hidden' />
                  <Icon size={14} className='hidden lg:block' />
                  {label}
                </div>
              ))}
            </div>

            {/* Trust strip (desktop only) */}
            <div className='hidden lg:flex items-center gap-5 mt-10 pt-6 border-t border-white/10'>
              <div className='flex -space-x-2'>
                {[
                  'from-brand-peach to-brand-tan',
                  'from-brand-blue to-brand-sage',
                  'from-brand-sage/70 to-emerald-500',
                  'from-amber-400 to-orange-500',
                ].map((c, i) => (
                  <div
                    key={i}
                    className={`h-8 w-8 rounded-full bg-gradient-to-br ${c} ring-2 ring-brand-ink`}
                  />
                ))}
              </div>
              <div className='text-xs text-white/55 leading-relaxed'>
                <p className='font-semibold text-white'>10,000+ customers</p>
                <p>book through bookmyspot every month</p>
              </div>
            </div>
          </div>

          {/* ── Right: floating mock visual (desktop only) ── */}
          <div className='hidden lg:flex relative h-[520px] xl:h-[560px] items-center justify-center'>
            {/* Big soft glow behind the stack */}
            <div className='absolute inset-0 m-auto h-80 w-80 rounded-full bg-gradient-to-br from-brand-peach/25 via-brand-tan/20 to-brand-sage/20 blur-3xl' />

            {/* Phone-ish frame */}
            <div className='relative h-full w-full max-w-md mx-auto'>
              {/* Main booking card */}
              <div className='absolute top-6 left-1/2 -translate-x-1/2 w-[88%] rounded-3xl bg-white shadow-2xl shadow-black/40 p-5 rotate-[-2deg]'>
                <div className='flex items-center gap-3'>
                  <div className='h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-peach via-brand-tan to-brand-sage/60 flex items-center justify-center'>
                    <Scissors size={18} className='text-brand-ink' strokeWidth={2.4} />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-bold text-foreground truncate'>Glow Studio · Colombo</p>
                    <p className='flex items-center gap-1 text-[11px] text-muted-foreground'>
                      <Star size={10} fill='#f59e0b' className='text-amber-500' />
                      4.9 · 1.2K followers
                    </p>
                  </div>
                  <Heart size={16} className='text-rose-500' fill='currentColor' />
                </div>
                <div className='mt-4 rounded-2xl bg-gradient-to-br from-brand-peach/40 via-white to-brand-blue/20 border border-border/40 p-3'>
                  <p className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>Next available</p>
                  <p className='mt-0.5 text-lg font-bold text-foreground tabular-nums'>Today · 3:30 PM</p>
                  <div className='mt-2 flex items-center gap-3 text-[11px] text-muted-foreground'>
                    <span className='flex items-center gap-1'>
                      <Clock size={11} className='text-brand-sage' />
                      45 min
                    </span>
                    <span className='h-3 w-px bg-border' />
                    <span className='flex items-center gap-1'>
                      <Sparkles size={11} className='text-brand-sage' />
                      Bridal mehendi
                    </span>
                  </div>
                </div>
                <button className='mt-3 w-full rounded-xl bg-brand-ink text-white text-xs font-semibold py-2.5 flex items-center justify-center gap-1.5'>
                  Confirm booking
                  <ArrowRight size={13} />
                </button>
              </div>

              {/* Floating "Confirmed" pill (top-right) */}
              <div className='absolute top-2 right-0 rounded-2xl bg-white shadow-xl shadow-black/30 px-3.5 py-2.5 rotate-[6deg] flex items-center gap-2'>
                <div className='h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center'>
                  <CheckCircle2 size={16} className='text-emerald-600' />
                </div>
                <div>
                  <p className='text-[11px] font-bold text-foreground'>Booking confirmed</p>
                  <p className='text-[10px] text-muted-foreground'>2 minutes ago</p>
                </div>
              </div>

              {/* Floating "Trending now" chip (bottom-left) */}
              <div className='absolute bottom-16 left-0 rounded-2xl bg-white shadow-xl shadow-black/30 px-3.5 py-2.5 rotate-[-5deg] flex items-center gap-2'>
                <div className='h-8 w-8 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center'>
                  <Flame size={16} className='text-white' />
                </div>
                <div>
                  <p className='text-[11px] font-bold text-foreground'>Trending now</p>
                  <p className='text-[10px] text-muted-foreground'>Bridal mehendi · Nail art</p>
                </div>
              </div>

              {/* Floating "120 saved" pill (bottom-right) */}
              <div className='absolute bottom-2 right-4 rounded-2xl bg-brand-ink text-white shadow-xl shadow-black/40 px-3.5 py-2.5 rotate-[4deg] flex items-center gap-2'>
                <Heart size={14} className='text-rose-400' fill='currentColor' />
                <div>
                  <p className='text-[11px] font-bold'>You saved 12 shops</p>
                  <p className='text-[10px] text-white/50'>Find them in Favourites</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className='px-4 py-10 sm:py-14 lg:py-20 bg-gradient-to-b from-background to-brand-peach/20 lg:px-8'>
        <div className='mx-auto max-w-4xl lg:max-w-7xl'>
          {/* Section heading — desktop only */}
          <div className='hidden lg:block mb-10 text-center max-w-2xl mx-auto'>
            <p className='text-xs font-bold uppercase tracking-widest text-brand-sage mb-2'>Why bookmyspot</p>
            <h2 className='text-3xl xl:text-4xl font-bold text-foreground leading-tight'>
              Everything you need to <span className='gradient-text'>look your best</span>
            </h2>
            <p className='mt-3 text-base text-muted-foreground'>
              From discovery to confirmation, we&apos;ve made beauty booking effortless.
            </p>
          </div>

          <div className='grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:gap-6'>
            {FEATURES.map(({ icon: Icon, title, desc, color }) => (
              <div
                key={title}
                className='group rounded-2xl border border-border bg-white p-4 shadow-card flex flex-col gap-3 lg:p-6 lg:gap-4 lg:hover:shadow-card-hover lg:hover:-translate-y-1 lg:transition-all lg:duration-300'
              >
                <div className={`h-10 w-10 flex items-center justify-center rounded-xl ${color} lg:h-14 lg:w-14 lg:rounded-2xl lg:group-hover:scale-110 lg:transition-transform`}>
                  <Icon size={20} className='lg:hidden' />
                  <Icon size={26} className='hidden lg:block' />
                </div>
                <div>
                  <p className='text-sm font-semibold text-foreground lg:text-lg'>{title}</p>
                  <p className='mt-0.5 text-xs text-muted-foreground leading-relaxed lg:text-sm lg:mt-1.5'>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured shops ─────────────────────────────────── */}
      <section className='px-4 pb-12 sm:pb-16 lg:pb-24 lg:px-8 lg:pt-20'>
        <div className='mx-auto max-w-7xl'>
          <div className='flex items-end justify-between mb-6 lg:mb-10'>
            <div>
              <p className='text-xs font-semibold uppercase tracking-widest text-brand-sage mb-1 lg:mb-2'>Discover</p>
              <h2 className='text-xl sm:text-2xl font-bold text-foreground lg:text-4xl lg:leading-tight'>
                Featured <span className='lg:gradient-text'>Shops</span>
              </h2>
              <p className='hidden lg:block mt-2 text-base text-muted-foreground max-w-lg'>
                Hand-picked top-rated places near you. Updated daily.
              </p>
            </div>
            <Link
              href='/shops'
              className='inline-flex items-center gap-1 text-sm font-medium text-brand-sage hover:text-brand-ink transition-colors lg:rounded-xl lg:border lg:border-border lg:bg-white lg:px-4 lg:py-2.5 lg:shadow-sm lg:hover:shadow-card-hover lg:hover:-translate-y-0.5 lg:transition-all'
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {isLoading ? (
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 xl:grid-cols-4 2xl:grid-cols-5'>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className='rounded-2xl border overflow-hidden'>
                  <Skeleton className='h-44 rounded-none lg:h-52' />
                  <div className='p-4 space-y-2'>
                    <Skeleton className='h-4 w-3/4' />
                    <Skeleton className='h-3 w-1/2' />
                    <div className='flex gap-2 mt-3'>
                      <Skeleton className='h-5 w-16 rounded-full' />
                      <Skeleton className='h-5 w-20 rounded-full' />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 xl:grid-cols-4 2xl:grid-cols-5'>
              {data?.map((s) => <SaloonCard key={s.id} saloon={s} />)}
            </div>
          )}
        </div>
      </section>

      {/* ── Owner CTA ────────────────────────────────────────── */}
      <section className='mx-4 mb-12 rounded-3xl bg-brand-ink p-6 sm:p-10 overflow-hidden relative lg:mx-8 lg:mb-20 lg:p-0'>
        <div className='pointer-events-none absolute -top-10 -right-10 h-48 w-48 rounded-full bg-brand-peach/8 blur-2xl lg:h-96 lg:w-96 lg:-top-32 lg:-right-32' />
        <div className='pointer-events-none hidden lg:block absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-brand-sage/15 blur-3xl' />

        {/* Desktop 2-column wrapper; on mobile/tablet, only the left column shows */}
        <div className='relative lg:mx-auto lg:max-w-7xl lg:grid lg:grid-cols-[1fr_1fr] lg:gap-12 lg:items-center lg:p-12 xl:p-16'>
          {/* Left: copy */}
          <div className='max-w-lg lg:max-w-none'>
            <p className='text-xs font-semibold uppercase tracking-widest text-brand-sage mb-2 lg:text-sm'>For shop owners</p>
            <h2 className='text-xl sm:text-2xl font-bold text-white lg:text-4xl xl:text-5xl lg:leading-tight'>
              Grow your <span className='bg-gradient-to-r from-brand-peach to-brand-blue bg-clip-text text-transparent'>beauty business</span>
            </h2>
            <p className='mt-2 text-sm text-white/50 lg:mt-4 lg:text-lg lg:max-w-md'>
              Manage bookings, staff, analytics and customers from one powerful dashboard.
            </p>

            {/* Desktop feature ticks */}
            <ul className='hidden lg:flex flex-col gap-2.5 mt-6 text-sm text-white/70'>
              {[
                'Instant calendar with staff & service-level slots',
                'Customer follow base, reviews, and reports triage',
                'Insights into bookings, revenue and busy hours',
              ].map((line) => (
                <li key={line} className='flex items-start gap-2.5'>
                  <CheckCircle2 size={16} className='mt-0.5 shrink-0 text-brand-sage' />
                  {line}
                </li>
              ))}
            </ul>

            <Link href='/register' className='mt-5 inline-flex lg:mt-8'>
              <Button className='rounded-xl bg-white text-brand-ink hover:bg-brand-cream lg:h-14 lg:px-7 lg:text-base'>
                Start for free <ArrowRight size={15} />
              </Button>
            </Link>
          </div>

          {/* Right: dashboard-style visual (desktop only) */}
          <div className='hidden lg:block relative h-[420px] xl:h-[460px]'>
            {/* Glow */}
            <div className='absolute inset-0 m-auto h-72 w-72 rounded-full bg-gradient-to-br from-brand-peach/20 to-brand-sage/20 blur-3xl' />

            {/* Main "analytics" card */}
            <div className='absolute top-4 left-6 right-6 rounded-3xl bg-white shadow-2xl shadow-black/40 p-5'>
              <div className='flex items-center justify-between mb-4'>
                <div>
                  <p className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>This week</p>
                  <p className='text-2xl font-bold text-foreground tabular-nums'>147 bookings</p>
                </div>
                <span className='inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold'>
                  <span className='h-1.5 w-1.5 rounded-full bg-emerald-500' />
                  +24%
                </span>
              </div>

              {/* Sparkline-ish bars */}
              <div className='flex items-end justify-between h-24 gap-1.5'>
                {[35, 45, 30, 60, 50, 80, 95].map((h, i) => (
                  <div
                    key={i}
                    className='flex-1 rounded-t-md bg-gradient-to-t from-brand-ink/80 to-brand-sage'
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className='mt-2 flex justify-between text-[10px] font-medium text-muted-foreground'>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <span key={i} className='w-4 text-center'>{d}</span>
                ))}
              </div>
            </div>

            {/* Floating "Upcoming" card */}
            <div className='absolute bottom-6 left-0 w-[60%] rounded-2xl bg-white shadow-xl shadow-black/30 p-4 rotate-[-3deg]'>
              <div className='flex items-center justify-between'>
                <p className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground'>Upcoming</p>
                <span className='text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5'>Confirmed</span>
              </div>
              <p className='mt-1 text-sm font-bold text-foreground'>Bridal mehendi</p>
              <p className='mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground'>
                <Clock size={11} className='text-brand-sage' />
                Today · 4:00 PM · Priya
              </p>
            </div>

            {/* Floating "Revenue" pill */}
            <div className='absolute bottom-2 right-0 rounded-2xl bg-brand-ink text-white shadow-xl shadow-black/40 px-4 py-3 rotate-[4deg]'>
              <p className='text-[10px] font-bold uppercase tracking-wider text-white/50'>Today</p>
              <p className='text-lg font-bold tabular-nums'>LKR 84,500</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
