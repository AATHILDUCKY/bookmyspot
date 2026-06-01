'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  MapPin,
  Phone,
  Search,
  Store,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PaginatedResponse, Saloon } from '@/types';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { saloonHref } from '@/lib/slug';
import { cn } from '@/lib/utils';

type Filter = 'pending' | 'approved' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'all',      label: 'All' },
];

interface PendingAction {
  saloon: Saloon;
  type: 'approve' | 'reject';
}

export default function AdminSaloonsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('pending');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const { data: payload, isLoading } = useQuery<PaginatedResponse<Saloon>>({
    queryKey: ['admin-saloons', filter, q, page],
    queryFn: async () => {
      const params: Record<string, unknown> = {};
      if (filter === 'pending') params.approved = false;
      if (filter === 'approved') params.approved = true;
      params.q = q.trim() || undefined;
      params.page = page;
      params.page_size = 10;
      return (await api.get('/admin/saloons', { params })).data;
    },
  });
  const shops = payload?.items ?? [];

  // Tab counts
  const { data: pendingCount } = useQuery<number>({
    queryKey: ['admin-saloons-count', 'pending'],
    queryFn: async () => ((await api.get('/admin/saloons', { params: { approved: false } })).data as Saloon[]).length,
    staleTime: 30_000,
  });
  const { data: approvedCount } = useQuery<number>({
    queryKey: ['admin-saloons-count', 'approved'],
    queryFn: async () => ((await api.get('/admin/saloons', { params: { approved: true } })).data as Saloon[]).length,
    staleTime: 30_000,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['admin-saloons'] });
    qc.invalidateQueries({ queryKey: ['admin-saloons-count'] });
    qc.invalidateQueries({ queryKey: ['admin-analytics'] });
  }

  const approve = useMutation({
    mutationFn: async (id: number) => api.patch(`/admin/saloons/${id}/approve`),
    onSuccess: () => { invalidate(); setPending(null); },
  });
  const reject = useMutation({
    mutationFn: async (id: number) => api.patch(`/admin/saloons/${id}/reject`),
    onSuccess: () => { invalidate(); setPending(null); },
  });

  const filtered = useMemo(() => {
    if (!q.trim()) return shops;
    const lower = q.toLowerCase();
    return shops.filter((s) =>
      [s.name, s.city, s.address, s.phone].some((v) => v?.toLowerCase().includes(lower)),
    );
  }, [shops, q]);

  const counts = {
    pending: pendingCount ?? 0,
    approved: approvedCount ?? 0,
    all: (pendingCount ?? 0) + (approvedCount ?? 0),
  };

  function runPending() {
    if (!pending) return;
    if (pending.type === 'approve') approve.mutate(pending.saloon.id);
    if (pending.type === 'reject')  reject.mutate(pending.saloon.id);
  }

  const isMutating = approve.isPending || reject.isPending;

  return (
    <div className='mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 space-y-4 pb-24'>
      {/* Header */}
      <div className='rounded-2xl border border-border bg-white p-4 sm:p-5'>
        <div className='flex items-center justify-between gap-3 flex-wrap'>
          <div className='flex items-center gap-3 min-w-0'>
            <div className='h-10 w-10 rounded-2xl bg-brand-peach/60 flex items-center justify-center shrink-0'>
              <Store size={18} className='text-brand-ink' />
            </div>
            <div className='min-w-0'>
              <h1 className='text-base font-bold text-foreground lg:text-xl'>Shops</h1>
              <p className='text-[11px] text-muted-foreground'>
                Review salon, spa, beauty, and grooming shop registrations.
              </p>
            </div>
          </div>
          <div className='relative w-full sm:w-72'>
            <Search size={13} className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none' />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder='Search shop, city, phone…'
              className='w-full h-9 rounded-xl border border-border bg-white pl-8 pr-3 text-xs focus:outline-none focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className='flex items-center gap-1.5 overflow-x-auto scrollbar-none'>
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => { setFilter(key); setPage(1); }}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 h-9 rounded-full border px-3 text-xs font-semibold transition-colors',
                active
                  ? 'border-brand-ink bg-brand-ink text-white'
                  : 'border-border bg-white text-foreground hover:bg-muted/40',
              )}
            >
              {key === 'pending' && <Clock3 size={12} />}
              {key === 'approved' && <BadgeCheck size={12} />}
              {label}
              <span className={cn(
                'inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-bold',
                active ? 'bg-white/20 text-white' : 'bg-muted text-foreground',
              )}>
                {counts[key]}
              </span>
            </button>
          );
        })}
        <span className='ml-auto text-[10px] text-muted-foreground shrink-0 pr-1'>
          {payload?.total ?? 0} total
        </span>
      </div>

      {/* List */}
      <div className='rounded-2xl border border-border bg-white overflow-hidden'>
        {isLoading ? (
          <div className='p-4 space-y-2'>
            {[1, 2, 3].map((i) => <div key={i} className='h-16 rounded-xl bg-muted/40 animate-pulse' />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className='py-14 flex flex-col items-center text-center px-4'>
            <div className='h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-2'>
              <Store size={18} className='text-muted-foreground' />
            </div>
            <p className='text-sm font-medium text-foreground'>
              {q ? `No shops match "${q}"` : filter === 'pending' ? 'No shops waiting for approval' : 'No shops found'}
            </p>
          </div>
        ) : (
          <div className='divide-y divide-border'>
            {filtered.map((s) => (
              <div key={s.id} className='flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors'>
                <div className='h-11 w-11 rounded-xl border border-border bg-muted overflow-hidden shrink-0'>
                  {s.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.cover_image} alt='' className='h-full w-full object-cover' />
                  ) : (
                    <div className='h-full w-full flex items-center justify-center'>
                      <Store size={16} className='text-muted-foreground' />
                    </div>
                  )}
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-1.5 flex-wrap'>
                    <p className='text-sm font-semibold text-foreground truncate'>{s.name}</p>
                    {s.is_approved ? (
                      <span className='inline-flex items-center gap-0.5 rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0 text-[9px] font-bold text-emerald-700 uppercase'>
                        <BadgeCheck size={9} /> Approved
                      </span>
                    ) : (
                      <span className='inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0 text-[9px] font-bold text-amber-700 uppercase'>
                        <Clock3 size={9} /> Pending
                      </span>
                    )}
                  </div>
                  <p className='mt-0.5 text-[10px] text-muted-foreground truncate inline-flex items-center gap-1'>
                    <MapPin size={9} /> {s.address}, {s.city}
                  </p>
                  <p className='text-[10px] text-muted-foreground truncate inline-flex items-center gap-2'>
                    <span className='inline-flex items-center gap-0.5'><Phone size={9} /> {s.phone}</span>
                    <span>· Owner #{s.owner_id}</span>
                  </p>
                </div>

                <div className='flex items-center gap-1 shrink-0'>
                  {!s.is_approved ? (
                    <>
                      <button
                        onClick={() => setPending({ saloon: s, type: 'approve' })}
                        title='Approve'
                        aria-label='Approve'
                        className='h-8 w-8 rounded-lg border border-emerald-200 bg-white flex items-center justify-center text-emerald-700 hover:bg-emerald-50 transition-colors'
                      >
                        <CheckCircle2 size={12} />
                      </button>
                      <button
                        onClick={() => setPending({ saloon: s, type: 'reject' })}
                        title='Reject'
                        aria-label='Reject'
                        className='h-8 w-8 rounded-lg border border-red-200 bg-white flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors'
                      >
                        <XCircle size={12} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setPending({ saloon: s, type: 'reject' })}
                      title='Revoke approval'
                      aria-label='Revoke approval'
                      className='h-8 px-2 rounded-lg border border-red-200 bg-white text-[10px] font-semibold text-red-600 hover:bg-red-50 transition-colors'
                    >
                      Revoke
                    </button>
                  )}
                  <Link
                    href={saloonHref(s)}
                    title='Open shop page'
                    className='h-8 w-8 rounded-lg border border-border bg-white flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors'
                  >
                    <ExternalLink size={11} />
                  </Link>
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
        title={pending?.type === 'approve' ? `Approve ${pending.saloon.name}?` : `Reject ${pending?.saloon.name}?`}
        description={
          pending?.type === 'approve'
            ? <>This shop will be visible to customers in search results immediately.</>
            : <>The owner will need to re-submit. Existing customers won&apos;t see this shop until it&apos;s re-approved.</>
        }
        confirmLabel={pending?.type === 'approve' ? 'Approve shop' : 'Reject shop'}
        tone={pending?.type === 'approve' ? 'success' : 'danger'}
        isLoading={isMutating}
        onCancel={() => setPending(null)}
        onConfirm={runPending}
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
