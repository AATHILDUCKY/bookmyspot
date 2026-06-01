'use client';

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  BarChart3, CalendarDays, Clock3, Scissors, Sparkles, TrendingUp, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useOwnerDashboard } from '@/lib/hooks/useOwnerDashboard';
import { formatLkr } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface OwnerAnalytics {
  total_bookings: number;
  revenue: number;
  peak_hours: { hour: number; count: number }[];
  popular_services: { name: string; count: number }[];
  monthly_trend: { month: string; count: number }[];
}

/* Brand-aligned chart palette */
const BRAND_COLORS = ['#1f1f1f', '#8f917c', '#d0bea3', '#bac8e0', '#ebdbd3', '#a8a48c', '#c4b8a0'];

export default function OwnerAnalyticsPage() {
  const { data, isLoading } = useOwnerDashboard() as { data?: OwnerAnalytics; isLoading: boolean };

  const totalBookings = data?.total_bookings ?? 0;
  const totalRevenue = data?.revenue ?? 0;
  const avgRevenuePerBooking = totalBookings ? totalRevenue / totalBookings : 0;
  const peakHour = data?.peak_hours?.[0];

  const monthly = (data?.monthly_trend ?? []).map((p) => ({
    month: format(new Date(p.month), 'MMM'),
    bookings: p.count,
  }));
  const hourly = (data?.peak_hours ?? []).slice(0, 12).map((s) => ({
    hour: `${String(s.hour).padStart(2, '0')}h`,
    bookings: s.count,
  }));
  const serviceShare = (data?.popular_services ?? []).map((service, i) => ({
    name: service.name,
    count: service.count,
    fill: BRAND_COLORS[i % BRAND_COLORS.length],
  }));

  /* Trend direction (last vs previous month) */
  const trend = monthly.length >= 2
    ? monthly[monthly.length - 1].bookings - monthly[monthly.length - 2].bookings
    : 0;
  const trendPercent = monthly.length >= 2 && monthly[monthly.length - 2].bookings > 0
    ? Math.round((trend / monthly[monthly.length - 2].bookings) * 100)
    : 0;

  return (
    <div className='mx-auto max-w-2xl px-4 py-4 sm:py-6 space-y-4 pb-20'>

      {/* ── Compact header ── */}
      <div className='rounded-2xl border border-border bg-white p-4 surface-soft'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase tracking-widest text-brand-sage'>Owner insights</p>
            <h1 className='mt-0.5 text-xl font-bold text-foreground'>Analytics</h1>
            <p className='text-xs text-muted-foreground mt-0.5'>Bookings, demand and trends at a glance.</p>
          </div>
          <div className='h-10 w-10 rounded-xl bg-gradient-to-br from-brand-peach to-brand-tan/40 flex items-center justify-center shrink-0'>
            <BarChart3 size={18} className='text-brand-ink' />
          </div>
        </div>

        {/* Headline number — revenue */}
        <div className='mt-4 flex items-end justify-between'>
          <div>
            <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>Total revenue</p>
            <p className='text-2xl font-bold text-foreground leading-tight'>{formatLkr(totalRevenue, 0)}</p>
          </div>
          {trend !== 0 && (
            <div className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold',
              trend > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            )}>
              <ArrowUpRight size={11} className={trend > 0 ? '' : 'rotate-90'} />
              {trend > 0 ? '+' : ''}{trendPercent}%
            </div>
          )}
        </div>
      </div>

      {/* ── Stat grid (2x2 mobile, 4 columns desktop) ── */}
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
        <StatCard icon={CalendarDays} label='Bookings'    value={String(totalBookings)} tone='peach' />
        <StatCard icon={Wallet}       label='Avg. value'  value={formatLkr(avgRevenuePerBooking, 0)} tone='blue' />
        <StatCard icon={Clock3}       label='Peak hour'   value={peakHour ? `${String(peakHour.hour).padStart(2, '0')}:00` : '—'} tone='tan' />
        <StatCard icon={Scissors}     label='Services'    value={String(serviceShare.length)} tone='sage' />
      </div>

      {/* ── Monthly trend ── */}
      <ChartCard title='Monthly trend' icon={TrendingUp} subtitle={`${monthly.length} month${monthly.length !== 1 ? 's' : ''}`}>
        {monthly.length > 0 ? (
          <div className='h-48 sm:h-56 -mx-2'>
            <ResponsiveContainer width='100%' height='100%'>
              <AreaChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id='trendFill' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#1f1f1f' stopOpacity={0.25} />
                    <stop offset='95%' stopColor='#1f1f1f' stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray='3 3' stroke='hsl(20 18% 90%)' vertical={false} />
                <XAxis dataKey='month' tick={{ fill: '#6b6b65', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#6b6b65', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid hsl(20 18% 88%)', fontSize: 12, padding: '6px 10px' }}
                  cursor={{ stroke: '#8f917c', strokeDasharray: '3 3' }}
                />
                <Area type='monotone' dataKey='bookings' stroke='#1f1f1f' strokeWidth={2} fill='url(#trendFill)' />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState loading={isLoading} icon={TrendingUp} message='Booking trends will appear here.' />
        )}
      </ChartCard>

      {/* ── Peak hours ── */}
      <ChartCard title='Peak hours' icon={Clock3} subtitle='When customers book most'>
        {hourly.length > 0 ? (
          <div className='h-44 sm:h-52 -mx-2'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={hourly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='hsl(20 18% 90%)' vertical={false} />
                <XAxis dataKey='hour' tick={{ fill: '#6b6b65', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#6b6b65', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid hsl(20 18% 88%)', fontSize: 12, padding: '6px 10px' }}
                  cursor={{ fill: 'rgba(143,145,124,0.08)' }}
                />
                <Bar dataKey='bookings' radius={[6, 6, 0, 0]} fill='#8f917c' />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState loading={isLoading} icon={Clock3} message='Peak hour data will appear here.' />
        )}
      </ChartCard>

      {/* ── Services breakdown — pie + list ── */}
      <ChartCard title='Service breakdown' icon={Sparkles} subtitle={`${serviceShare.length} active service${serviceShare.length !== 1 ? 's' : ''}`}>
        {serviceShare.length ? (
          <div className='flex flex-col sm:flex-row gap-4 items-center'>
            {/* Pie */}
            <div className='h-40 w-40 shrink-0 relative'>
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie data={serviceShare} dataKey='count' nameKey='name' innerRadius={42} outerRadius={70} paddingAngle={2} stroke='none'>
                    {serviceShare.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid hsl(20 18% 88%)', fontSize: 12, padding: '6px 10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none'>
                <span className='text-xl font-bold text-foreground leading-none'>{totalBookings}</span>
                <span className='text-[9px] uppercase text-muted-foreground mt-0.5'>Bookings</span>
              </div>
            </div>

            {/* List */}
            <div className='w-full space-y-1.5'>
              {serviceShare.slice(0, 6).map((service) => {
                const share = totalBookings ? Math.round((service.count / totalBookings) * 100) : 0;
                return (
                  <div key={service.name} className='flex items-center gap-2.5'>
                    <span className='h-2.5 w-2.5 rounded-full shrink-0' style={{ backgroundColor: service.fill }} />
                    <span className='text-xs font-medium text-foreground truncate flex-1'>{service.name}</span>
                    <div className='flex items-center gap-2 shrink-0'>
                      <span className='text-xs text-muted-foreground'>{service.count}</span>
                      <span className='text-[10px] font-semibold text-brand-ink bg-muted/50 px-1.5 py-0.5 rounded-full min-w-[36px] text-center'>
                        {share}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState loading={isLoading} icon={Scissors} message='Service stats appear after bookings are completed.' />
        )}
      </ChartCard>

      {/* ── Top services bars (mobile-friendly list) ── */}
      {serviceShare.length > 0 && (
        <ChartCard title='Top performers' icon={Sparkles} subtitle='Most booked services'>
          <div className='space-y-2.5'>
            {serviceShare.slice(0, 5).map((service, i) => {
              const share = totalBookings ? (service.count / totalBookings) * 100 : 0;
              return (
                <div key={service.name} className='space-y-1'>
                  <div className='flex items-center justify-between text-xs'>
                    <span className='flex items-center gap-2 font-medium text-foreground'>
                      <span className='h-5 w-5 rounded-full bg-muted/60 flex items-center justify-center text-[10px] font-bold text-muted-foreground'>{i + 1}</span>
                      {service.name}
                    </span>
                    <span className='text-muted-foreground'>{service.count}</span>
                  </div>
                  <div className='h-1.5 rounded-full bg-muted overflow-hidden'>
                    <div
                      className='h-full rounded-full transition-all duration-500'
                      style={{ width: `${share}%`, backgroundColor: service.fill }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}
    </div>
  );
}

/* ─── Components ─── */

function StatCard({ icon: Icon, label, value, tone }: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: 'peach' | 'blue' | 'tan' | 'sage';
}) {
  return (
    <div className={cn(
      'rounded-2xl border p-3',
      tone === 'peach' && 'surface-peach border-brand-tan/30',
      tone === 'blue'  && 'surface-blue border-[#9ab3d0]/30',
      tone === 'tan'   && 'surface-tan border-[#b8a48b]/30',
      tone === 'sage'  && 'surface-sage border-brand-sage/25',
    )}>
      <div className='flex items-center justify-between'>
        <Icon size={14} className='text-brand-ink/70' />
      </div>
      <p className='mt-2 text-lg font-bold text-foreground leading-tight'>{value}</p>
      <p className='text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5'>{label}</p>
    </div>
  );
}

function ChartCard({ title, icon: Icon, subtitle, children }: {
  title: string;
  icon: LucideIcon;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className='rounded-2xl border border-border bg-white p-4'>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <Icon size={14} className='text-brand-sage' />
          <h3 className='text-sm font-bold text-foreground'>{title}</h3>
        </div>
        {subtitle && <span className='text-[11px] text-muted-foreground'>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ loading, icon: Icon, message }: { loading: boolean; icon: LucideIcon; message: string }) {
  return (
    <div className='flex h-40 flex-col items-center justify-center text-center'>
      <div className='h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center mb-2'>
        <Icon size={16} className='text-muted-foreground' />
      </div>
      <p className='text-xs text-muted-foreground max-w-xs'>{loading ? 'Loading…' : message}</p>
    </div>
  );
}
