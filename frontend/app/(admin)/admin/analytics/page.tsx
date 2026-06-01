'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, CalendarCheck, PieChart as PieIcon, Store, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';

interface ChartPoint {
  name?: string;
  value?: number;
  date?: string;
  bookings?: number;
}

interface AdminAnalytics {
  total_saloons: number;
  total_users: number;
  bookings_today: number;
  open_reports: number;
  active_users: number;
  pending_saloons: number;
  approved_saloons: number;
  total_bookings: number;
  users_by_role: ChartPoint[];
  shops_by_status: ChartPoint[];
  reports_by_status: ChartPoint[];
  bookings_last_14_days: ChartPoint[];
}

const COLORS = ['#8f917c', '#bac8e0', '#d0bea3', '#1f1f1f'];

export default function AdminAnalyticsPage() {
  const { data, isLoading } = useQuery<AdminAnalytics>({
    queryKey: ['admin-analytics'],
    queryFn: async () => (await api.get('/admin/analytics')).data,
  });

  const cards = [
    { label: 'Total shops', value: data?.total_saloons ?? 0, icon: Store, detail: `${data?.pending_saloons ?? 0} pending` },
    { label: 'Active users', value: data?.active_users ?? 0, icon: Users, detail: `${data?.total_users ?? 0} total` },
    { label: 'Bookings today', value: data?.bookings_today ?? 0, icon: CalendarCheck, detail: `${data?.total_bookings ?? 0} all time` },
    { label: 'Open reports', value: data?.open_reports ?? 0, icon: Activity, detail: 'Needs moderation' },
  ];

  return (
    <div className='mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 space-y-5 pb-24'>
      <header className='rounded-2xl border border-border bg-white p-5 shadow-card lg:p-6'>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
          <div>
            <p className='text-[11px] font-bold uppercase tracking-widest text-brand-sage'>Insights</p>
            <h1 className='mt-1 text-2xl font-bold tracking-tight text-foreground lg:text-3xl'>Analytics</h1>
            <p className='mt-1 max-w-2xl text-sm text-muted-foreground'>
              Monitor shop approvals, user growth, booking activity, and moderation workload.
            </p>
          </div>
          <div className='inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700'>
            <span className='h-1.5 w-1.5 rounded-full bg-emerald-500' />
            Live platform data
          </div>
        </div>
      </header>

      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        {cards.map(({ label, value, icon: Icon, detail }) => (
          <div key={label} className='rounded-2xl border border-border bg-white p-4 shadow-card lg:p-5'>
            <div className='flex items-center justify-between'>
              <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-brand-peach/50 text-brand-ink'>
                <Icon size={18} />
              </div>
              <span className='text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>{detail}</span>
            </div>
            <p className='mt-4 text-3xl font-bold tabular-nums text-foreground'>
              {isLoading ? <span className='block h-8 w-20 animate-pulse rounded bg-muted' /> : value}
            </p>
            <p className='mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>{label}</p>
          </div>
        ))}
      </div>

      <div className='grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]'>
        <ChartCard title='Bookings trend' icon={CalendarCheck}>
          <ResponsiveContainer width='100%' height={300}>
            <AreaChart data={data?.bookings_last_14_days ?? []} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id='bookingsFill' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%' stopColor='#8f917c' stopOpacity={0.35} />
                  <stop offset='95%' stopColor='#8f917c' stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray='3 3' stroke='#eee8e4' />
              <XAxis dataKey='date' tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(5)} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type='monotone' dataKey='bookings' stroke='#8f917c' strokeWidth={2} fill='url(#bookingsFill)' />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title='Shop approval mix' icon={PieIcon}>
          <ResponsiveContainer width='100%' height={300}>
            <PieChart>
              <Pie data={data?.shops_by_status ?? []} dataKey='value' nameKey='name' innerRadius={62} outerRadius={96} paddingAngle={4}>
                {(data?.shops_by_status ?? []).map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className='grid gap-5 lg:grid-cols-2'>
        <ChartCard title='Users by role' icon={Users}>
          <ResponsiveContainer width='100%' height={280}>
            <BarChart data={data?.users_by_role ?? []} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray='3 3' stroke='#eee8e4' />
              <XAxis dataKey='name' tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey='value' radius={[8, 8, 0, 0]} fill='#bac8e0' />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title='Reports by status' icon={Activity}>
          <ResponsiveContainer width='100%' height={280}>
            <BarChart data={data?.reports_by_status ?? []} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray='3 3' stroke='#eee8e4' />
              <XAxis dataKey='name' tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey='value' radius={[8, 8, 0, 0]} fill='#d0bea3' />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className='rounded-2xl border border-border bg-white p-4 shadow-card lg:p-5'>
      <div className='mb-4 flex items-center gap-2'>
        <span className='flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 text-brand-sage'>
          <Icon size={16} />
        </span>
        <h2 className='text-sm font-bold text-foreground'>{title}</h2>
      </div>
      {children}
    </section>
  );
}
