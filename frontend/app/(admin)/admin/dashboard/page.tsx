'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Sparkles,
  ShieldAlert,
  Store,
  Users,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { Saloon, User } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface AdminAnalytics {
  total_saloons: number;
  total_users: number;
  bookings_today: number;
  open_reports: number;
  active_users?: number;
  pending_saloons?: number;
  approved_saloons?: number;
  total_bookings?: number;
}

interface Report {
  id: number;
  reporter_id: number;
  review_id?: number | null;
  saloon_id?: number | null;
  reason: string;
  details?: string | null;
  status: string;
  created_at: string;
}

const METRIC_STYLES = [
  { accent: 'bg-brand-blue/40 border-brand-blue/40 text-brand-ink',  href: '/admin/saloons' },
  { accent: 'bg-brand-peach/60 border-brand-tan/40 text-brand-ink',  href: '/admin/users' },
  { accent: 'bg-brand-sage/15 border-brand-sage/25 text-brand-sage', href: undefined },
  { accent: 'bg-red-50 border-red-200 text-red-700',                 href: '/admin/reports' },
];

export default function AdminDashboardPage() {
  const qc = useQueryClient();
  const { data: analytics, isLoading: analyticsLoading } = useQuery<AdminAnalytics>({
    queryKey: ['admin-analytics'],
    queryFn: async () => (await api.get('/admin/analytics')).data,
  });
  const { data: pendingSaloons, isLoading: saloonsLoading } = useQuery<Saloon[]>({
    queryKey: ['admin-saloons', 'pending'],
    queryFn: async () => (await api.get('/admin/saloons', { params: { approved: false } })).data,
  });
  const { data: users } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get('/admin/users')).data,
  });
  const { data: reports, isLoading: reportsLoading } = useQuery<Report[]>({
    queryKey: ['admin-reports', 'open'],
    queryFn: async () => (await api.get('/admin/reports', { params: { status: 'open' } })).data,
  });

  const approve = useMutation({
    mutationFn: async (id: number) => api.patch(`/admin/saloons/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-saloons'] });
      qc.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
  });
  const reject = useMutation({
    mutationFn: async (id: number) => api.patch(`/admin/saloons/${id}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-saloons'] });
      qc.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
  });
  const updateReport = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: 'resolve' | 'dismiss' }) =>
      api.patch(`/admin/reports/${id}/${action}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
      qc.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
  });

  const totalUsers = users?.length ?? 0;
  const activeUsers = users?.filter((u) => u.is_active).length ?? 0;
  const owners = users?.filter((u) => u.role === 'owner').length ?? 0;
  const customers = users?.filter((u) => u.role === 'customer').length ?? 0;
  const admins = users?.filter((u) => u.role === 'admin').length ?? 0;

  const metrics = [
    { icon: Store, label: 'Total shops', value: analytics?.total_saloons ?? 0 },
    { icon: Users, label: 'Total users', value: analytics?.total_users ?? 0 },
    { icon: CalendarCheck, label: 'Bookings today', value: analytics?.bookings_today ?? 0 },
    { icon: AlertTriangle, label: 'Open reports', value: analytics?.open_reports ?? 0 },
  ];

  return (
    <div className='mx-auto w-full max-w-[1500px] px-4 md:px-6 lg:px-8 py-5 md:py-7 space-y-5 md:space-y-6'>
      {/* ── Compact header strip ───────────────────────────── */}
      <header className='flex flex-col gap-3 md:flex-row md:items-end md:justify-between'>
        <div>
          <p className='text-[11px] font-bold uppercase tracking-widest text-brand-sage'>Overview</p>
          <h1 className='text-2xl md:text-3xl font-bold text-foreground leading-tight'>Admin Dashboard</h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            Triage what needs attention now. Drill into any section from the sidebar.
          </p>
        </div>
        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <span className='inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 font-semibold'>
            <span className='h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse' />
            Live
          </span>
          <span className='hidden md:inline'>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
        </div>
      </header>

      {/* ── Metric tiles ───────────────────────────────────── */}
      <div className='grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4'>
        {metrics.map(({ icon: Icon, label, value }, i) => {
          const style = METRIC_STYLES[i];
          const content = (
            <div className='rounded-2xl border border-border bg-white p-4 md:p-5 transition-all hover:shadow-card-hover hover:-translate-y-0.5 h-full'>
              <div className='flex items-center justify-between mb-2.5'>
                <div className={cn('h-9 w-9 rounded-xl border flex items-center justify-center', style.accent)}>
                  <Icon size={16} />
                </div>
                {style.href && <ArrowRight size={13} className='text-muted-foreground' />}
              </div>
              <p className='text-2xl md:text-3xl font-bold text-foreground leading-tight tabular-nums'>
                {analyticsLoading ? <span className='inline-block h-7 w-14 animate-pulse rounded bg-muted' /> : value}
              </p>
              <p className='text-[10px] md:text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mt-1.5'>{label}</p>
            </div>
          );
          return style.href ? (
            <Link key={label} href={style.href} className='block'>{content}</Link>
          ) : (
            <div key={label}>{content}</div>
          );
        })}
      </div>

      {/* ── Pending approvals + user mix ───────────────────── */}
      <div className='grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]'>
        {/* Pending shop approvals */}
        <div className='rounded-2xl border border-border bg-white shadow-card overflow-hidden'>
          <SectionHeader icon={Clock3} title='Pending shop approvals' href='/admin/saloons' count={pendingSaloons?.length ?? 0} />
          <div className='divide-y divide-border'>
            {saloonsLoading ? (
              <div className='p-4 space-y-3'>
                {[1, 2, 3].map((i) => <Skeleton key={i} className='h-16 rounded-xl' />)}
              </div>
            ) : pendingSaloons?.length ? (
              pendingSaloons.slice(0, 6).map((saloon) => (
                <div key={saloon.id} className='grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center'>
                  <div>
                    <div className='flex flex-wrap items-center gap-2'>
                      <p className='font-semibold text-foreground'>{saloon.name}</p>
                      <Badge variant='pending'>Pending</Badge>
                    </div>
                    <p className='mt-1 text-sm text-muted-foreground'>{saloon.address}, {saloon.city}</p>
                    <p className='mt-0.5 text-xs text-muted-foreground'>Owner #{saloon.owner_id} · {saloon.phone}</p>
                  </div>
                  <div className='flex gap-2'>
                    <Button
                      size='sm'
                      disabled={approve.isPending}
                      onClick={() => approve.mutate(saloon.id)}
                      className='bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl'
                    >
                      <CheckCircle2 size={14} /> Approve
                    </Button>
                    <Button
                      size='sm'
                      variant='outline'
                      disabled={reject.isPending}
                      onClick={() => reject.mutate(saloon.id)}
                      className='border-red-200 text-red-700 hover:bg-red-50 rounded-xl'
                    >
                      <XCircle size={14} /> Reject
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className='flex flex-col items-center justify-center py-10 text-center px-4'>
                <div className='h-10 w-10 rounded-2xl bg-muted flex items-center justify-center mb-2'>
                  <CheckCircle2 size={18} className='text-muted-foreground' />
                </div>
                <p className='text-sm text-muted-foreground'>No shops waiting for approval</p>
              </div>
            )}
          </div>
        </div>

        {/* User mix */}
        <div className='rounded-2xl border border-border bg-white shadow-card overflow-hidden flex flex-col'>
          <SectionHeader icon={BadgeCheck} title='User breakdown' href='/admin/users' count={totalUsers} />
          <div className='p-5 space-y-5 flex-1'>
            {/* Headline numbers */}
            <div className='grid grid-cols-2 gap-3'>
              <div className='rounded-xl bg-muted/40 px-3 py-2.5'>
                <p className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>Active</p>
                <p className='text-xl font-bold text-foreground tabular-nums'>{activeUsers}</p>
              </div>
              <div className='rounded-xl bg-muted/40 px-3 py-2.5'>
                <p className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>Inactive</p>
                <p className='text-xl font-bold text-foreground tabular-nums'>{Math.max(0, totalUsers - activeUsers)}</p>
              </div>
            </div>

            <div className='space-y-3.5'>
              <BreakdownRow label='Active users' value={activeUsers} total={totalUsers} color='bg-emerald-500' />
              <BreakdownRow label='Customers' value={customers} total={totalUsers} color='bg-brand-sage' />
              <BreakdownRow label='Owners' value={owners} total={totalUsers} color='bg-brand-blue' />
              <BreakdownRow label='Admins' value={admins} total={totalUsers} color='bg-brand-ink' />
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick actions strip (desktop) ─────────────────── */}
      <div className='hidden lg:grid grid-cols-3 xl:grid-cols-4 gap-4'>
        <Link href='/admin/saloons?status=pending' className='group rounded-2xl border border-border bg-white p-4 hover:shadow-card-hover hover:-translate-y-0.5 transition-all'>
          <div className='flex items-center gap-3'>
            <div className='h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center'>
              <Clock3 size={18} />
            </div>
            <div className='min-w-0'>
              <p className='text-sm font-semibold text-foreground'>Pending shops</p>
              <p className='text-xs text-muted-foreground'>Review and approve new listings</p>
            </div>
            <ArrowRight size={14} className='ml-auto text-muted-foreground group-hover:translate-x-0.5 transition' />
          </div>
        </Link>
        <Link href='/admin/reports?status=open' className='group rounded-2xl border border-border bg-white p-4 hover:shadow-card-hover hover:-translate-y-0.5 transition-all'>
          <div className='flex items-center gap-3'>
            <div className='h-10 w-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center'>
              <ShieldAlert size={18} />
            </div>
            <div className='min-w-0'>
              <p className='text-sm font-semibold text-foreground'>Open reports</p>
              <p className='text-xs text-muted-foreground'>Resolve or dismiss flagged content</p>
            </div>
            <ArrowRight size={14} className='ml-auto text-muted-foreground group-hover:translate-x-0.5 transition' />
          </div>
        </Link>
        <Link href='/admin/analytics' className='group rounded-2xl border border-border bg-white p-4 hover:shadow-card-hover hover:-translate-y-0.5 transition-all'>
          <div className='flex items-center gap-3'>
            <div className='h-10 w-10 rounded-xl bg-brand-peach/60 text-brand-ink flex items-center justify-center'>
              <Sparkles size={18} />
            </div>
            <div className='min-w-0'>
              <p className='text-sm font-semibold text-foreground'>Analytics</p>
              <p className='text-xs text-muted-foreground'>Charts, activity, and platform health</p>
            </div>
            <ArrowRight size={14} className='ml-auto text-muted-foreground group-hover:translate-x-0.5 transition' />
          </div>
        </Link>
        <Link href='/admin/users' className='group rounded-2xl border border-border bg-white p-4 hover:shadow-card-hover hover:-translate-y-0.5 transition-all'>
          <div className='flex items-center gap-3'>
            <div className='h-10 w-10 rounded-xl bg-brand-blue/40 text-brand-ink flex items-center justify-center'>
              <Users size={18} />
            </div>
            <div className='min-w-0'>
              <p className='text-sm font-semibold text-foreground'>Manage users</p>
              <p className='text-xs text-muted-foreground'>Activate, suspend, edit roles</p>
            </div>
            <ArrowRight size={14} className='ml-auto text-muted-foreground group-hover:translate-x-0.5 transition' />
          </div>
        </Link>
      </div>

      {/* Report triage */}
      <div className='rounded-2xl border border-border bg-white shadow-card overflow-hidden'>
        <SectionHeader icon={ShieldAlert} title='Report triage' href='/admin/reports' count={reports?.length ?? 0} />
        <div className='divide-y divide-border'>
          {reportsLoading ? (
            <div className='p-4 space-y-3'>
              {[1, 2, 3].map((i) => <Skeleton key={i} className='h-16 rounded-xl' />)}
            </div>
          ) : reports?.length ? (
            reports.slice(0, 5).map((report) => (
              <div key={report.id} className='grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center'>
                <div>
                  <p className='font-semibold text-foreground'>{report.reason}</p>
                  <p className='mt-1 text-sm text-muted-foreground'>{report.details || 'No additional detail provided.'}</p>
                  <p className='mt-0.5 text-xs text-muted-foreground'>
                    Reporter #{report.reporter_id} · Shop #{report.saloon_id ?? '-'} · Review #{report.review_id ?? '-'}
                  </p>
                </div>
                <div className='flex gap-2'>
                  <Button
                    size='sm'
                    disabled={updateReport.isPending}
                    onClick={() => updateReport.mutate({ id: report.id, action: 'resolve' })}
                    className='bg-brand-ink text-white hover:bg-brand-ink/90 rounded-xl'
                  >
                    <CheckCircle2 size={14} /> Resolve
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={updateReport.isPending}
                    onClick={() => updateReport.mutate({ id: report.id, action: 'dismiss' })}
                    className='rounded-xl'
                  >
                    <XCircle size={14} /> Dismiss
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className='flex flex-col items-center justify-center py-10 text-center px-4'>
              <div className='h-10 w-10 rounded-2xl bg-muted flex items-center justify-center mb-2'>
                <ShieldAlert size={18} className='text-muted-foreground' />
              </div>
              <p className='text-sm text-muted-foreground'>No reports need attention</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, href, count }: { icon: LucideIcon; title: string; href: string; count: number }) {
  return (
    <div className='flex items-center justify-between px-5 py-4 border-b border-border'>
      <div className='flex items-center gap-2'>
        <Icon size={16} className='text-brand-sage' />
        <h2 className='text-sm font-semibold text-foreground'>{title}</h2>
        <span className='rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'>{count}</span>
      </div>
      <Link href={href} className='inline-flex items-center gap-1 text-xs font-medium text-brand-sage hover:text-brand-ink transition-colors'>
        View all <ArrowRight size={13} />
      </Link>
    </div>
  );
}

function BreakdownRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className='flex items-center justify-between text-sm mb-1.5'>
        <span className='text-muted-foreground'>{label}</span>
        <span className='font-semibold text-foreground'>{value}</span>
      </div>
      <div className='h-1.5 rounded-full bg-muted overflow-hidden'>
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
