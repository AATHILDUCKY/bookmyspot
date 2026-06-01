'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Phone,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { PaginatedResponse, User } from '@/types';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { cn } from '@/lib/utils';

type Status = 'active' | 'suspended' | 'deleted';
type RoleFilter = 'all' | 'customer' | 'owner' | 'admin';

const STATUS_TABS: { key: Status; label: string; icon: LucideIcon }[] = [
  { key: 'active',    label: 'Active',    icon: ShieldCheck },
  { key: 'suspended', label: 'Suspended', icon: XCircle },
  { key: 'deleted',   label: 'Deleted',   icon: Trash2 },
];

const ROLE_OPTIONS: { key: RoleFilter; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'customer', label: 'Customers' },
  { key: 'owner',    label: 'Owners' },
  { key: 'admin',    label: 'Admins' },
];

interface PendingAction {
  user: User;
  type: 'suspend' | 'delete' | 'activate' | 'restore';
}

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>('active');
  const [role, setRole] = useState<RoleFilter>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const { data: payload, isLoading } = useQuery<PaginatedResponse<User>>({
    queryKey: ['admin-users', status, role, q, page],
    queryFn: async () => (await api.get('/admin/users', {
      params: {
        status,
        role: role === 'all' ? undefined : role,
        q: q.trim() || undefined,
        page,
        page_size: 10,
      },
    })).data,
    staleTime: 10_000,
  });
  const users = payload?.items ?? [];

  // Lightweight counts (for tab badges) — fetch once without filters per status.
  const { data: activeCount } = useQuery<number>({
    queryKey: ['admin-users-count', 'active'],
    queryFn: async () => ((await api.get('/admin/users', { params: { status: 'active' } })).data as User[]).length,
    staleTime: 30_000,
  });
  const { data: suspendedCount } = useQuery<number>({
    queryKey: ['admin-users-count', 'suspended'],
    queryFn: async () => ((await api.get('/admin/users', { params: { status: 'suspended' } })).data as User[]).length,
    staleTime: 30_000,
  });
  const { data: deletedCount } = useQuery<number>({
    queryKey: ['admin-users-count', 'deleted'],
    queryFn: async () => ((await api.get('/admin/users', { params: { status: 'deleted' } })).data as User[]).length,
    staleTime: 30_000,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['admin-users'] });
    qc.invalidateQueries({ queryKey: ['admin-users-count'] });
    qc.invalidateQueries({ queryKey: ['admin-analytics'] });
  }

  const suspend = useMutation({
    mutationFn: async (id: number) => api.patch(`/admin/users/${id}/suspend`),
    onSuccess: () => { invalidate(); setPending(null); },
  });
  const activate = useMutation({
    mutationFn: async (id: number) => api.patch(`/admin/users/${id}/activate`),
    onSuccess: () => { invalidate(); setPending(null); },
  });
  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/users/${id}`),
    onSuccess: () => { invalidate(); setPending(null); },
  });
  const restore = useMutation({
    mutationFn: async (id: number) => api.post(`/admin/users/${id}/restore`),
    onSuccess: () => { invalidate(); setPending(null); },
  });

  const counts = useMemo(() => ({
    active: activeCount ?? 0,
    suspended: suspendedCount ?? 0,
    deleted: deletedCount ?? 0,
  }), [activeCount, suspendedCount, deletedCount]);

  function runPending() {
    if (!pending) return;
    const { user, type } = pending;
    if (type === 'suspend')  suspend.mutate(user.id);
    if (type === 'activate') activate.mutate(user.id);
    if (type === 'delete')   remove.mutate(user.id);
    if (type === 'restore')  restore.mutate(user.id);
  }

  const isMutating = suspend.isPending || activate.isPending || remove.isPending || restore.isPending;

  return (
    <div className='mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 space-y-4 pb-24'>

      {/* Header */}
      <div className='rounded-2xl border border-border bg-white p-4 sm:p-5'>
        <div className='flex items-center justify-between gap-3 flex-wrap'>
          <div className='flex items-center gap-3 min-w-0'>
            <div className='h-10 w-10 rounded-2xl bg-brand-peach/60 flex items-center justify-center shrink-0'>
              <UserCog size={18} className='text-brand-ink' />
            </div>
            <div className='min-w-0'>
              <h1 className='text-base font-bold text-foreground lg:text-xl'>Users</h1>
              <p className='text-[11px] text-muted-foreground'>
                Manage customers, owners, and admin accounts. Deleted users can be restored.
              </p>
            </div>
          </div>

          {/* Search */}
          <div className='relative w-full sm:w-72'>
            <Search size={13} className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none' />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder='Search name, email, phone…'
              className='w-full h-9 rounded-xl border border-border bg-white pl-8 pr-3 text-xs focus:outline-none focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
            />
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div className='flex gap-1.5 overflow-x-auto scrollbar-none'>
        {STATUS_TABS.map(({ key, label, icon: Icon }) => {
          const active = status === key;
          return (
            <button
              key={key}
              onClick={() => { setStatus(key); setPage(1); }}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 h-9 rounded-full border px-3 text-xs font-semibold transition-colors',
                active
                  ? 'border-brand-ink bg-brand-ink text-white'
                  : 'border-border bg-white text-foreground hover:bg-muted/40',
              )}
            >
              <Icon size={12} />
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
      </div>

      {/* Role chips */}
      <div className='flex gap-1.5 overflow-x-auto scrollbar-none'>
        {ROLE_OPTIONS.map(({ key, label }) => {
          const active = role === key;
          return (
            <button
              key={key}
              onClick={() => { setRole(key); setPage(1); }}
              className={cn(
                'shrink-0 h-7 rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                active
                  ? 'border-brand-sage bg-brand-sage/15 text-brand-sage'
                  : 'border-border bg-white text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className='rounded-2xl border border-border bg-white overflow-hidden'>
        {isLoading ? (
          <div className='p-4 space-y-2'>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className='h-14 rounded-xl bg-muted/40 animate-pulse' />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className='py-14 flex flex-col items-center text-center px-4'>
            <div className='h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-2'>
              <Users size={18} className='text-muted-foreground' />
            </div>
            <p className='text-sm font-medium text-foreground'>
              No {status} users{role !== 'all' ? ` (${role}s)` : ''}{q ? ` match “${q}”` : ''}
            </p>
            <p className='text-[11px] text-muted-foreground mt-0.5'>Try a different filter.</p>
          </div>
        ) : (
          <div className='divide-y divide-border'>
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                status={status}
                onAction={(type) => setPending({ user: u, type })}
              />
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

      {/* Confirm dialog */}
      <ConfirmDialog
        open={Boolean(pending)}
        title={confirmTitle(pending)}
        description={confirmBody(pending)}
        confirmLabel={confirmLabel(pending)}
        tone={confirmTone(pending)}
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

/* ───── Row ───── */

function UserRow({ user, status, onAction }: {
  user: User;
  status: Status;
  onAction: (type: PendingAction['type']) => void;
}) {
  const isAdmin = user.role === 'admin';
  const roleTint = ROLE_TINTS[user.role] ?? ROLE_TINTS.customer;
  return (
    <div className='flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors'>
      <div className='h-9 w-9 rounded-full bg-gradient-to-br from-brand-peach/60 to-brand-tan/40 border border-brand-tan/30 flex items-center justify-center shrink-0 overflow-hidden'>
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar_url} alt='' className='h-full w-full object-cover' />
        ) : (
          <span className='text-[11px] font-bold text-brand-ink'>{user.name?.[0]?.toUpperCase() || '?'}</span>
        )}
      </div>

      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-1.5 flex-wrap'>
          <p className='text-sm font-semibold text-foreground truncate'>{user.name}</p>
          <span className={cn('inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide', roleTint)}>
            {user.role}
          </span>
          {isAdmin && (
            <span className='text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0'>
              Protected
            </span>
          )}
        </div>
        <div className='mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground'>
          <span className='inline-flex items-center gap-0.5 truncate'>
            <Mail size={9} /> {user.email}
          </span>
          {user.phone && (
            <span className='inline-flex items-center gap-0.5 truncate'>
              <Phone size={9} /> {user.phone}
            </span>
          )}
        </div>
      </div>

      <div className='flex items-center gap-1 shrink-0'>
        {isAdmin ? (
          <span className='text-[10px] text-muted-foreground italic px-2'>No actions</span>
        ) : status === 'active' ? (
          <>
            <IconButton onClick={() => onAction('suspend')} tone='amber' icon={XCircle} title='Suspend' />
            <IconButton onClick={() => onAction('delete')}  tone='red'   icon={Trash2}  title='Delete' />
          </>
        ) : status === 'suspended' ? (
          <>
            <IconButton onClick={() => onAction('activate')} tone='emerald' icon={ShieldCheck} title='Reactivate' />
            <IconButton onClick={() => onAction('delete')}   tone='red'     icon={Trash2}      title='Delete' />
          </>
        ) : (
          <IconButton onClick={() => onAction('restore')} tone='emerald' icon={RotateCcw} title='Restore' />
        )}
      </div>
    </div>
  );
}

const ROLE_TINTS: Record<string, string> = {
  admin:    'bg-brand-ink/5 border-brand-ink/20 text-brand-ink',
  owner:    'bg-amber-50 border-amber-200 text-amber-700',
  customer: 'bg-sky-50 border-sky-200 text-sky-700',
};

function IconButton({ onClick, tone, icon: Icon, title }: {
  onClick: () => void;
  tone: 'red' | 'amber' | 'emerald';
  icon: LucideIcon;
  title: string;
}) {
  const tones = {
    red:     'border-red-200 text-red-600 hover:bg-red-50',
    amber:   'border-amber-200 text-amber-700 hover:bg-amber-50',
    emerald: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
  };
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn('h-8 w-8 rounded-lg border bg-white flex items-center justify-center transition-colors', tones[tone])}
    >
      <Icon size={12} />
    </button>
  );
}

/* ───── Confirm copy ───── */

function confirmTitle(p: PendingAction | null) {
  if (!p) return '';
  return {
    suspend:  `Suspend ${p.user.name}?`,
    delete:   `Delete ${p.user.name}?`,
    activate: `Reactivate ${p.user.name}?`,
    restore:  `Restore ${p.user.name}?`,
  }[p.type];
}

function confirmBody(p: PendingAction | null): React.ReactNode {
  if (!p) return '';
  const email = <span className='font-semibold text-foreground'>{p.user.email}</span>;
  switch (p.type) {
    case 'suspend':
      return <>The account ({email}) will be temporarily disabled. You can reactivate it any time from the Suspended tab.</>;
    case 'delete':
      return <>{email} will be moved to the Deleted tab. They lose access immediately. You can restore the account later.</>;
    case 'activate':
      return <>{email} regains full access immediately.</>;
    case 'restore':
      return <>{email} is restored to the Active list and can sign in again.</>;
  }
}

function confirmLabel(p: PendingAction | null) {
  if (!p) return 'Confirm';
  return {
    suspend:  'Suspend account',
    delete:   'Move to deleted',
    activate: 'Reactivate',
    restore:  'Restore account',
  }[p.type];
}

function confirmTone(p: PendingAction | null): 'danger' | 'warning' | 'info' | 'success' {
  if (!p) return 'info';
  return p.type === 'delete' ? 'danger'
    : p.type === 'suspend' ? 'warning'
    : 'success';
}
