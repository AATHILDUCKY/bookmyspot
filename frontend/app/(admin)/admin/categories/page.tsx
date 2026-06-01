'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeOff, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Category } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type CategoryForm = {
  name: string;
  slug: string;
  description: string;
  icon: string;
  sort_order: string;
  is_active: boolean;
};

function emptyForm(): CategoryForm {
  return { name: '', slug: '', description: '', icon: '', sort_order: '100', is_active: true };
}

export default function AdminCategoriesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CategoryForm>(emptyForm());

  const { data = [], isLoading } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: async () => (await api.get('/admin/categories')).data,
  });

  const create = useMutation({
    mutationFn: async (payload: Partial<Category>) => api.post('/admin/categories', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-categories'] }); qc.invalidateQueries({ queryKey: ['categories'] }); closeForm(); },
  });
  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<Category> }) => api.patch(`/admin/categories/${id}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-categories'] }); qc.invalidateQueries({ queryKey: ['categories'] }); closeForm(); },
  });
  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-categories'] }); qc.invalidateQueries({ queryKey: ['categories'] }); },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  }
  function openEdit(cat: Category) {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? '',
      icon: cat.icon ?? '',
      sort_order: String(cat.sort_order ?? 100),
      is_active: cat.is_active ?? true,
    });
    setShowForm(true);
  }
  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm());
  }

  function submit() {
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim() || null,
      icon: form.icon.trim() || null,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    };
    if (!payload.name) return;
    if (editing) update.mutate({ id: editing.id, payload });
    else create.mutate(payload);
  }

  const isSaving = create.isPending || update.isPending;
  const error = (create.error || update.error) as { response?: { data?: { detail?: string } } } | null;
  const errorMsg = error?.response?.data?.detail;

  return (
    <div className='mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 space-y-4 pb-24'>
      <div className='rounded-2xl border border-border bg-white p-4 shadow-card sm:p-5 lg:p-6'>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-3'>
          <div className='h-10 w-10 rounded-2xl bg-brand-peach/60 flex items-center justify-center'>
            <Tag size={18} className='text-brand-ink' />
          </div>
          <div>
            <h1 className='text-xl font-bold text-foreground lg:text-2xl'>Business categories</h1>
            <p className='text-xs text-muted-foreground'>Salon, spa, beauty, grooming, and related shop types.</p>
          </div>
        </div>
        <Button onClick={openCreate} variant='gradient' className='rounded-xl'>
          <Plus size={15} /> Add
        </Button>
      </div>
      <div className='mt-4 grid grid-cols-3 gap-2 sm:max-w-md'>
        <div className='rounded-xl bg-muted/50 px-3 py-2'>
          <p className='text-lg font-bold text-foreground'>{data.length}</p>
          <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>Total</p>
        </div>
        <div className='rounded-xl bg-emerald-50 px-3 py-2'>
          <p className='text-lg font-bold text-emerald-700'>{data.filter((c) => c.is_active).length}</p>
          <p className='text-[10px] uppercase tracking-wide text-emerald-700/70'>Active</p>
        </div>
        <div className='rounded-xl bg-muted/50 px-3 py-2'>
          <p className='text-lg font-bold text-foreground'>{data.filter((c) => !c.is_active).length}</p>
          <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>Hidden</p>
        </div>
      </div>
      </div>

      {showForm && (
        <div className='rounded-2xl border border-border bg-white p-4 space-y-3 shadow-card lg:p-5'>
          <div className='flex items-center justify-between'>
            <h2 className='text-sm font-bold text-foreground'>{editing ? 'Edit category' : 'New category'}</h2>
            <button onClick={closeForm} className='h-8 w-8 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-muted/40'>
              <X size={14} />
            </button>
          </div>

          <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
            <div className='space-y-1 col-span-2'>
              <Label className='text-xs font-medium text-muted-foreground'>Name <span className='text-red-500'>*</span></Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder='e.g. Salon' />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs font-medium text-muted-foreground'>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} placeholder='auto from name' />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs font-medium text-muted-foreground'>Sort order</Label>
              <Input type='number' value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} />
            </div>
            <div className='space-y-1 col-span-2 lg:col-span-4'>
              <Label className='text-xs font-medium text-muted-foreground'>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder='Hair, colour, styling' />
            </div>
            <div className='space-y-1 lg:col-span-2'>
              <Label className='text-xs font-medium text-muted-foreground'>Icon key (optional)</Label>
              <Input value={form.icon} onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))} placeholder='e.g. scissors' />
            </div>
            <div className='space-y-1 flex flex-col justify-end lg:col-span-2'>
              <Label className='text-xs font-medium text-muted-foreground'>Active</Label>
              <button
                type='button'
                onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
                className={cn(
                  'h-10 rounded-xl border text-xs font-semibold transition-colors',
                  form.is_active ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-muted/40 border-border text-muted-foreground',
                )}
              >
                {form.is_active ? 'Active' : 'Hidden'}
              </button>
            </div>
          </div>

          {errorMsg && <p className='text-xs text-red-600'>{errorMsg}</p>}

          <div className='flex gap-2 pt-1'>
            <Button variant='outline' onClick={closeForm} className='rounded-xl'>Cancel</Button>
            <Button variant='gradient' disabled={isSaving || !form.name.trim()} onClick={submit} className='rounded-xl flex-1'>
              {isSaving ? 'Saving…' : editing ? 'Save changes' : 'Create category'}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className='text-sm text-muted-foreground'>Loading…</p>
      ) : data.length === 0 ? (
        <div className='rounded-2xl border border-dashed border-border bg-white p-8 text-center'>
          <p className='text-sm font-semibold text-foreground'>No categories yet</p>
          <p className='text-xs text-muted-foreground mt-1'>Click <strong>Add</strong> to create the first one.</p>
        </div>
      ) : (
        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
          {data.map((cat) => (
            <div key={cat.id} className='rounded-2xl border border-border bg-white p-3.5 flex items-center gap-3 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover'>
              <div className='h-10 w-10 rounded-xl bg-brand-peach/40 flex items-center justify-center shrink-0'>
                <Tag size={15} className='text-brand-ink' />
              </div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2'>
                  <p className='text-sm font-semibold text-foreground truncate'>{cat.name}</p>
                  {!cat.is_active && (
                    <span className='inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full'>
                      <EyeOff size={9} /> Hidden
                    </span>
                  )}
                </div>
                <p className='text-[11px] text-muted-foreground truncate'>
                  <span className='font-mono'>{cat.slug}</span>
                  {cat.description ? ` · ${cat.description}` : ''}
                </p>
              </div>
              <div className='flex items-center gap-1 shrink-0'>
                <button
                  onClick={() => openEdit(cat)}
                  className='h-8 w-8 rounded-lg border border-border bg-white flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  aria-label='Edit'
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => { if (confirm(`Delete "${cat.name}"? Shops assigned to it will lose this tag.`)) remove.mutate(cat.id); }}
                  className='h-8 w-8 rounded-lg border border-border bg-white flex items-center justify-center text-red-500 hover:bg-red-50'
                  aria-label='Delete'
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
