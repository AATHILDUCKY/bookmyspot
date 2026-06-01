'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Flag,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { PaginatedResponse } from '@/types';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

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

type Tab = 'open' | 'resolved' | 'dismissed';

const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'open',      label: 'Open',      icon: ShieldAlert },
  { key: 'resolved',  label: 'Resolved',  icon: ShieldCheck },
  { key: 'dismissed', label: 'Dismissed', icon: XCircle },
];

interface PendingAction {
  report: Report;
  type: 'resolve' | 'dismiss';
}

export default function AdminReportsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('open');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const { data: payload, isLoading } = useQuery<PaginatedResponse<Report>>({
    queryKey: ['admin-reports', tab, q, page],
    queryFn: async () => (await api.get('/admin/reports', {
      params: { status: tab, q: q.trim() || undefined, page, page_size: 10 },
    })).data,
    staleTime: 30_000,
  });
  const reports = payload?.items ?? [];

  // Counts
  const { data: openCount } = useQuery<number>({
    queryKey: ['admin-reports-count', 'open'],
    queryFn: async () => ((await api.get('/admin/reports', { params: { status: 'open' } })).data as Report[]).length,
    staleTime: 30_000,
  });
  const { data: resolvedCount } = useQuery<number>({
    queryKey: ['admin-reports-count', 'resolved'],
    queryFn: async () => ((await api.get('/admin/reports', { params: { status: 'resolved' } })).data as Report[]).length,
    staleTime: 60_000,
  });
  const { data: dismissedCount } = useQuery<number>({
    queryKey: ['admin-reports-count', 'dismissed'],
    queryFn: async () => ((await api.get('/admin/reports', { params: { status: 'dismissed' } })).data as Report[]).length,
    staleTime: 60_000,
  });

  const counts = { open: openCount ?? 0, resolved: resolvedCount ?? 0, dismissed: dismissedCount ?? 0 };

  const update = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: 'resolve' | 'dismiss' }) =>
      api.patch(`/admin/reports/${id}/${action}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
      qc.invalidateQueries({ queryKey: ['admin-reports-count'] });
      qc.invalidateQueries({ queryKey: ['admin-analytics'] });
      setPending(null);
    },
  });

  const filtered = useMemo(() => {
    if (!q.trim()) return reports;
    const lower = q.toLowerCase();
    return reports.filter((r) =>
      [r.reason, r.details, String(r.id), String(r.reporter_id), String(r.saloon_id ?? ''), String(r.review_id ?? '')]
        .some((v) => v?.toLowerCase().includes(lower)),
    );
  }, [reports, q]);

  return (
    <div className='mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 space-y-4 pb-24'>
      {/* Header */}
      <div className='rounded-2xl border border-border bg-white p-4 sm:p-5'>
        <div className='flex items-center justify-between gap-3 flex-wrap'>
          <div className='flex items-center gap-3 min-w-0'>
            <div className='h-10 w-10 rounded-2xl bg-red-50 flex items-center justify-center shrink-0'>
              <Flag size={18} className='text-red-600' />
            </div>
            <div className='min-w-0'>
              <h1 className='text-base font-bold text-foreground lg:text-xl'>Reports</h1>
              <p className='text-[11px] text-muted-foreground'>
                Triage user-submitted reports on shops and reviews.
              </p>
            </div>
          </div>
          <div className='relative w-full sm:w-72'>
            <Search size={13} className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none' />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder='Search reason, details, ID…'
              className='w-full h-9 rounded-xl border border-border bg-white pl-8 pr-3 text-xs focus:outline-none focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
            />
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className='grid grid-cols-3 gap-2'>
        {(['open', 'resolved', 'dismissed'] as const).map((key) => (
          <button
            key={key}
            onClick={() => { setTab(key); setPage(1); }}
            className={cn(
              'rounded-2xl border bg-white p-3 text-left transition-all hover:shadow-sm',
              tab === key ? 'border-brand-ink ring-2 ring-brand-ink/10' : 'border-border',
            )}
          >
            <p className={cn(
              'text-2xl font-bold leading-none tabular-nums',
              key === 'open' ? 'text-red-600' : key === 'resolved' ? 'text-emerald-700' : 'text-muted-foreground',
            )}>
              {counts[key]}
            </p>
            <p className='text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-1.5'>
              {key}
            </p>
          </button>
        ))}
      </div>

      {/* Tabs (mirrored from stats so users can switch from either) */}
      <div className='flex items-center gap-1.5 overflow-x-auto scrollbar-none'>
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => { setTab(key); setPage(1); }}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 h-9 rounded-full border px-3 text-xs font-semibold transition-colors',
                active
                  ? 'border-brand-ink bg-brand-ink text-white'
                  : 'border-border bg-white text-foreground hover:bg-muted/40',
              )}
            >
              <Icon size={12} />
              {label}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className='rounded-2xl border border-border bg-white overflow-hidden'>
        {isLoading ? (
          <div className='p-4 space-y-2'>
            {[1, 2, 3].map((i) => <div key={i} className='h-20 rounded-xl bg-muted/40 animate-pulse' />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className='py-14 flex flex-col items-center text-center px-4'>
            <div className='h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-2'>
              <ShieldCheck size={18} className='text-emerald-600' />
            </div>
            <p className='text-sm font-medium text-foreground'>
              {tab === 'open' ? 'All clear — no open reports' : `No ${tab} reports`}
            </p>
            {q && <p className='text-[11px] text-muted-foreground mt-0.5'>No matches for “{q}”.</p>}
          </div>
        ) : (
          <div className='divide-y divide-border'>
            {filtered.map((r) => (
              <div key={r.id} className='px-4 py-3 hover:bg-muted/20 transition-colors'>
                <div className='flex items-start gap-3'>
                  <div className={cn(
                    'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
                    r.status === 'open' ? 'bg-red-50 text-red-600'
                      : r.status === 'resolved' ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    <Flag size={14} />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-1.5 flex-wrap'>
                      <p className='text-sm font-semibold text-foreground truncate'>{r.reason}</p>
                      <span className={cn(
                        'text-[9px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0',
                        r.status === 'open' ? 'bg-red-50 border border-red-200 text-red-600'
                          : r.status === 'resolved' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                          : 'bg-muted text-muted-foreground',
                      )}>
                        {r.status}
                      </span>
                      <span className='text-[10px] text-muted-foreground'>
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className='mt-0.5 text-xs text-muted-foreground line-clamp-2'>
                      {r.details || <span className='italic'>No additional detail provided.</span>}
                    </p>
                    <div className='mt-1 flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap'>
                      <span>Reporter #{r.reporter_id}</span>
                      {r.saloon_id != null && (
                        <Link href={`/shops/${r.saloon_id}`} className='inline-flex items-center gap-0.5 text-brand-sage hover:text-brand-ink'>
                          Shop #{r.saloon_id} <ExternalLink size={9} />
                        </Link>
                      )}
                      {r.review_id != null && <span>· Review #{r.review_id}</span>}
                    </div>
                  </div>

                  {r.status === 'open' && (
                    <div className='flex items-center gap-1 shrink-0'>
                      <button
                        onClick={() => setPending({ report: r, type: 'resolve' })}
                        title='Resolve'
                        aria-label='Resolve'
                        className='h-8 w-8 rounded-lg border border-emerald-200 bg-white flex items-center justify-center text-emerald-700 hover:bg-emerald-50 transition-colors'
                      >
                        <CheckCircle2 size={12} />
                      </button>
                      <button
                        onClick={() => setPending({ report: r, type: 'dismiss' })}
                        title='Dismiss'
                        aria-label='Dismiss'
                        className='h-8 w-8 rounded-lg border border-border bg-white flex items-center justify-center text-muted-foreground hover:bg-muted/40 transition-colors'
                      >
                        <XCircle size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {payload && payload.total > 0 && (
        <PaginationBar
          page={payload.page}
          pages={payload.pages}
          total={payload.total}
          pageSize={payload.page_size}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(payload.pages, p + 1))}
        />
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.type === 'resolve' ? 'Resolve this report?' : 'Dismiss this report?'}
        description={
          pending?.type === 'resolve'
            ? 'Marks the report as actioned. It will move to the Resolved tab.'
            : 'Marks the report as not actionable. It will move to the Dismissed tab.'
        }
        confirmLabel={pending?.type === 'resolve' ? 'Resolve' : 'Dismiss'}
        tone={pending?.type === 'resolve' ? 'success' : 'info'}
        isLoading={update.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && update.mutate({ id: pending.report.id, action: pending.type })}
      />
    </div>
  );
}

function PaginationBar({ page, pages, total, pageSize, onPrev, onNext }: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <div className='flex flex-col gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-xs text-muted-foreground shadow-card sm:flex-row sm:items-center sm:justify-between'>
      <span>Showing {start}-{end} of {total}</span>
      <div className='flex items-center gap-2'>
        <button onClick={onPrev} disabled={page <= 1} className='inline-flex h-9 items-center gap-1 rounded-xl border border-border px-3 font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-40 hover:bg-muted/40'>
          <ArrowLeft size={13} /> Prev
        </button>
        <span className='min-w-16 text-center font-semibold text-foreground'>Page {page}/{pages}</span>
        <button onClick={onNext} disabled={page >= pages} className='inline-flex h-9 items-center gap-1 rounded-xl border border-border px-3 font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-40 hover:bg-muted/40'>
          Next <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
