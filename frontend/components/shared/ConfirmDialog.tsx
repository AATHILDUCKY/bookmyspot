'use client';

import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, Trash2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'danger' | 'warning' | 'info' | 'success';

interface Props {
  open: boolean;
  title: string;
  description: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
  icon?: LucideIcon;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const toneStyles: Record<Tone, { iconBg: string; iconColor: string; confirmBg: string; defaultIcon: LucideIcon }> = {
  danger:  { iconBg: 'bg-red-50',     iconColor: 'text-red-600',    confirmBg: 'bg-red-600 hover:bg-red-700',                  defaultIcon: Trash2 },
  warning: { iconBg: 'bg-amber-50',   iconColor: 'text-amber-600',  confirmBg: 'bg-amber-600 hover:bg-amber-700',              defaultIcon: AlertTriangle },
  info:    { iconBg: 'bg-brand-blue/40', iconColor: 'text-brand-ink', confirmBg: 'bg-brand-ink hover:opacity-90',                 defaultIcon: ShieldAlert },
  success: { iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', confirmBg: 'bg-emerald-600 hover:bg-emerald-700',         defaultIcon: CheckCircle2 },
};

export function ConfirmDialog({
  open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'danger', icon, isLoading, onConfirm, onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && !isLoading) onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isLoading, onCancel, onConfirm]);

  if (!open) return null;

  const styles = toneStyles[tone];
  const Icon = icon ?? styles.defaultIcon;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in'>
      <div className='absolute inset-0 bg-black/55 backdrop-blur-sm' onClick={onCancel} />
      <div className='relative w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden'>
        {/* Close (X) */}
        <button
          onClick={onCancel}
          aria-label='Close'
          className='absolute top-3 right-3 h-8 w-8 rounded-xl border border-border bg-white/80 flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors'
        >
          <X size={13} />
        </button>

        <div className='px-6 pt-6 pb-2'>
          <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center mb-3', styles.iconBg)}>
            <Icon size={22} className={styles.iconColor} />
          </div>
          <h2 className='text-base font-bold text-foreground'>{title}</h2>
          <div className='mt-1.5 text-sm text-muted-foreground leading-relaxed'>
            {description}
          </div>
        </div>

        <div className='px-5 pt-5 pb-5 flex gap-2'>
          <button
            type='button'
            onClick={onCancel}
            disabled={isLoading}
            className='flex-1 h-11 rounded-xl border border-border bg-white text-sm font-semibold text-foreground hover:bg-muted/40 disabled:opacity-60 transition-colors'
          >
            {cancelLabel}
          </button>
          <button
            type='button'
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'flex-1 h-11 rounded-xl text-sm font-semibold text-white shadow-md disabled:opacity-60 transition-opacity inline-flex items-center justify-center gap-1.5',
              styles.confirmBg,
            )}
          >
            {isLoading && <span className='h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin' />}
            {isLoading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
