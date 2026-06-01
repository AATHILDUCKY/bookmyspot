'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  ChevronRight,
  Home,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Shield,
  Sparkles,
  Store,
  UserRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { API_BASE, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { User } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const MAX_AVATAR_BYTES = 20 * 1024;

const PROVINCES = [
  'Western Province', 'Central Province', 'Southern Province', 'Northern Province',
  'Eastern Province', 'North Western Province', 'North Central Province',
  'Uva Province', 'Sabaragamuwa Province',
];

const DISTRICTS_BY_PROVINCE: Record<string, string[]> = {
  'Western Province':       ['Colombo', 'Gampaha', 'Kalutara'],
  'Central Province':       ['Kandy', 'Matale', 'Nuwara Eliya'],
  'Southern Province':      ['Galle', 'Matara', 'Hambantota'],
  'Northern Province':      ['Jaffna', 'Kilinochchi', 'Mannar', 'Mullaitivu', 'Vavuniya'],
  'Eastern Province':       ['Trincomalee', 'Batticaloa', 'Ampara'],
  'North Western Province': ['Kurunegala', 'Puttalam'],
  'North Central Province': ['Anuradhapura', 'Polonnaruwa'],
  'Uva Province':           ['Badulla', 'Monaragala'],
  'Sabaragamuwa Province':  ['Ratnapura', 'Kegalle'],
};

export default function ProfilePage() {
  const { user, updateUser } = useAuth();

  /* form state */
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [province, setProvince] = useState(user?.province ?? '');
  const [district, setDistrict] = useState(user?.district ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [avatarDataUrl, setAvatarDataUrl] = useState('');
  const [preview, setPreview] = useState(getAvatarSrc(user?.avatar_url));
  const [imageInfo, setImageInfo] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);

  const roleProfile = useMemo(() => getRoleProfile(user?.role), [user?.role]);

  /* Clear district if it isn't valid for the chosen province */
  useEffect(() => {
    if (!province) return;
    const valid = DISTRICTS_BY_PROVINCE[province] ?? [];
    if (district && !valid.includes(district)) {
      setDistrict('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [province]);

  /* sync from auth user on mount/update */
  useEffect(() => {
    if (!user) return;
    setName(user.name ?? '');
    setPhone(user.phone ?? '');
    setProvince(user.province ?? '');
    setDistrict(user.district ?? '');
    setCity(user.city ?? '');
    setAddress(user.address ?? '');
    setPreview(getAvatarSrc(user.avatar_url));
  }, [user]);

  const onAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setImageInfo('Optimizing…');
    try {
      const optimized = await convertImageToSmallWebp(file);
      setAvatarDataUrl(optimized.dataUrl);
      setPreview(optimized.dataUrl);
      setImageInfo(`Ready · ${(optimized.bytes / 1024).toFixed(1)}KB`);
      // Auto-save the avatar immediately
      await saveProfile({ avatarOnly: optimized.dataUrl });
    } catch (err) {
      setAvatarDataUrl('');
      setImageInfo('');
      setError(err instanceof Error ? err.message : 'Could not optimize image.');
    } finally {
      event.target.value = '';
    }
  };

  async function saveProfile(opts: { avatarOnly?: string } = {}) {
    if (!user) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const payload = opts.avatarOnly
        ? { avatar_data_url: opts.avatarOnly }
        : {
            name, phone,
            avatar_data_url: avatarDataUrl || null,
            city: city || null,
            district: district || null,
            province: province || null,
            address: address || null,
          };
      const { data } = await api.patch<User>('/auth/me', payload);
      updateUser(data);
      setPreview(getAvatarSrc(data.avatar_url));
      setAvatarDataUrl('');
      setMessage(opts.avatarOnly ? 'Photo updated.' : 'Profile updated.');
      setEditingPersonal(false);
      setEditingLocation(false);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.detail || 'Unable to update profile.');
      else setError('Unable to update profile.');
    } finally {
      setSaving(false);
    }
  }

  /* completion percentage (Instagram-style) */
  const fields = [name, phone, province, district, city, address, preview ? 'x' : ''];
  const filled = fields.filter(Boolean).length;
  const progress = Math.round((filled / fields.length) * 100);

  const memberSince = user?.created_at ? new Date(user.created_at) : null;
  const memberYear = memberSince?.getFullYear() ?? '';
  const monthsAgo = memberSince ? Math.max(1, Math.round((Date.now() - memberSince.getTime()) / (30 * 24 * 60 * 60 * 1000))) : 0;

  if (!user) return null; // RequireAuth layout already redirects to /login

  const inEdit = editingPersonal || editingLocation;
  const accountActions = getAccountActions(user.role);

  return (
    <div className='mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 pb-28'>
      <div className='hidden lg:flex items-end justify-between gap-6 mb-6'>
        <div>
          <p className='text-xs font-bold uppercase tracking-widest text-brand-sage'>Account settings</p>
          <h1 className='mt-2 text-3xl font-bold tracking-tight text-foreground'>Profile</h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            Keep your platform account, contact details, and location ready for daily operations.
          </p>
        </div>
        <Link
          href={roleProfile.href}
          className='inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground shadow-card transition-all hover:border-brand-sage/50 hover:shadow-card-hover'
        >
          <Shield size={16} className='text-brand-sage' />
          {roleProfile.title}
          <ChevronRight size={15} className='text-muted-foreground' />
        </Link>
      </div>

      <div className='grid gap-4 lg:grid-cols-12 lg:gap-6 lg:items-start'>
      {/* ── Profile header card (Instagram-style) ── */}
      <div className='rounded-2xl border border-border bg-white overflow-hidden shadow-card lg:sticky lg:top-24 lg:col-span-4'>
        {/* Cover gradient */}
        <div className='relative h-20 sm:h-24 lg:h-36 bg-gradient-to-br from-brand-peach via-brand-tan/50 to-brand-sage/30'>
          {/* Status badge */}
          <div className={cn(
            'absolute top-2 right-2 lg:top-4 lg:right-4 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold backdrop-blur-md',
            user.is_active ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'
          )}>
            <BadgeCheck size={10} />
            {user.is_active ? 'Active' : 'Suspended'}
          </div>
        </div>

        {/* Info block */}
        <div className='px-4 pt-3 pb-4 lg:px-6 lg:pb-6'>
          <div className='flex items-end gap-3 -mt-10 lg:-mt-14 lg:gap-4'>
            {/* Avatar with camera overlay */}
            <label className='relative h-20 w-20 rounded-2xl border-4 border-white bg-muted shadow-md overflow-hidden shrink-0 cursor-pointer group lg:h-28 lg:w-28'>
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt='' className='h-full w-full object-cover' />
              ) : (
                <div className='h-full w-full flex items-center justify-center bg-brand-peach/40'>
                  <UserRound size={30} className='text-brand-ink' />
                </div>
              )}
              <div className='absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center'>
                <Camera size={18} className='text-white opacity-0 group-hover:opacity-100 transition-opacity' />
              </div>
              <input type='file' accept='image/*' onChange={onAvatarChange} className='sr-only' />
            </label>

            <div className='flex-1 min-w-0 pb-1'>
              <h1 className='text-base font-bold text-foreground truncate lg:text-xl'>{user.name}</h1>
              <p className='text-xs text-muted-foreground truncate flex items-center gap-1 lg:mt-1'>
                <Mail size={10} />
                {user.email}
              </p>
            </div>

            {/* Role pill */}
            <span className='inline-flex items-center gap-1 rounded-full bg-brand-peach/60 border border-brand-tan/40 px-2.5 py-1 text-[10px] font-semibold text-brand-ink shrink-0'>
              <Shield size={10} />
              {roleProfile.label}
            </span>
          </div>

          {/* Stat row (Instagram-style) */}
          <div className='mt-4 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-2 lg:mt-6 lg:p-3'>
            <StatPill value={memberYear ? String(memberYear) : '—'} label='Member' />
            <StatPill value={monthsAgo > 0 ? `${monthsAgo}mo` : '—'} label='Active' />
            <StatPill value={`${progress}%`} label='Complete' />
          </div>

          {/* Completion progress bar */}
          <div className='mt-3'>
            <div className='flex items-center justify-between mb-1.5'>
              <p className='text-[11px] font-medium text-muted-foreground'>Profile completion</p>
              <p className='text-[11px] font-semibold text-foreground'>{filled}/{fields.length}</p>
            </div>
            <div className='h-1.5 rounded-full bg-muted overflow-hidden'>
              <div
                className='h-full rounded-full bg-gradient-to-r from-brand-sage to-brand-ink transition-all duration-500'
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {imageInfo && (
            <p className='mt-3 text-[11px] text-emerald-700 flex items-center gap-1'>
              <CheckCircle2 size={11} /> {imageInfo}
            </p>
          )}
        </div>
      </div>

      <div className='space-y-4 lg:col-span-8'>
        <div className='grid gap-4 xl:grid-cols-2'>
      {/* ── Personal info card ── */}
      <EditableCard
        title='Personal info'
        icon={UserRound}
        isEditing={editingPersonal}
        onEdit={() => { setMessage(''); setError(''); setEditingPersonal(true); }}
        onCancel={() => {
          setEditingPersonal(false);
          setError('');
          setName(user.name ?? '');
          setPhone(user.phone ?? '');
        }}
      >
        {editingPersonal ? (
          <div className='space-y-3'>
            <Field label='Full name' required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='Your full name' />
            </Field>
            <Field label='Phone number'>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder='+94 77 000 0000' />
            </Field>
          </div>
        ) : (
          <div className='space-y-1.5'>
            <ReadRow icon={UserRound} value={user.name || 'Not set'} placeholder={!user.name} />
            <ReadRow icon={Phone} value={phone || 'Phone not set'} placeholder={!phone} />
            <ReadRow icon={Mail} value={user.email} />
          </div>
        )}
      </EditableCard>

      {/* ── Location card ── */}
      <EditableCard
        title='Location'
        icon={MapPin}
        isEditing={editingLocation}
        onEdit={() => { setMessage(''); setError(''); setEditingLocation(true); }}
        onCancel={() => {
          setEditingLocation(false);
          setError('');
          setProvince(user.province ?? '');
          setDistrict(user.district ?? '');
          setCity(user.city ?? '');
          setAddress(user.address ?? '');
        }}
      >
        {editingLocation ? (
          <div className='space-y-3'>
            <Field label='Province'>
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className='w-full min-h-11 rounded-xl border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-sage/40'
              >
                <option value=''>Select province</option>
                {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <div className='grid gap-3 sm:grid-cols-2'>
              <Field label='District'>
                <DistrictAutocomplete province={province} value={district} onChange={setDistrict} />
              </Field>
              <Field label='City'>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder='Nugegoda' />
              </Field>
            </div>
            <Field label='Street address'>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder='12, Main Street' />
            </Field>
          </div>
        ) : (
          <div className='space-y-1.5'>
            <ReadRow
              icon={Home}
              value={address || 'Address not set'}
              placeholder={!address}
            />
            <ReadRow
              icon={MapPin}
              value={
                [city, district].filter(Boolean).join(', ') ||
                province ||
                'Location not set'
              }
              placeholder={!city && !district && !province}
              badge={province && city ? province.replace(' Province', '') : undefined}
            />
          </div>
        )}
      </EditableCard>
        </div>

      {/* ── Role action card ── */}
      <Link href={roleProfile.href} className='block group'>
        <div className='rounded-2xl border border-border bg-white p-4 lg:p-5 flex items-center gap-3 hover:border-brand-sage/40 hover:shadow-card-hover transition-all shadow-card'>
          <div className='h-11 w-11 lg:h-12 lg:w-12 rounded-xl bg-gradient-to-br from-brand-peach to-brand-tan/40 flex items-center justify-center shrink-0'>
            <Store size={18} className='text-brand-ink' />
          </div>
          <div className='flex-1 min-w-0'>
            <p className='text-sm font-semibold text-foreground lg:text-base'>{roleProfile.title}</p>
            <p className='text-xs text-muted-foreground line-clamp-2'>{roleProfile.description}</p>
          </div>
          <ChevronRight size={16} className='text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform' />
        </div>
      </Link>

      {/* ── Account actions ── */}
      <div className='rounded-2xl border border-border bg-white p-2 shadow-card lg:grid lg:grid-cols-2 lg:gap-2'>
        {accountActions.map(({ href, label, Icon, tint }) => (
          <Link key={href} href={href} className='flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors'>
            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', tint)}>
              <Icon size={14} />
            </div>
            <span className='text-sm font-medium text-foreground flex-1'>{label}</span>
            <ChevronRight size={14} className='text-muted-foreground' />
          </Link>
        ))}
      </div>

      {/* Messages */}
      {message && (
        <div className='flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700'>
          <CheckCircle2 size={14} className='shrink-0' /> {message}
        </div>
      )}
      {error && (
        <div className='rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700'>
          {error}
        </div>
      )}
      </div>
      </div>

      {/* ── Sticky bottom save bar (only when editing) ── */}
      {inEdit && (
        <div className='fixed bottom-16 sm:bottom-4 lg:bottom-6 inset-x-0 z-30 px-4 pointer-events-none'>
          <div className='mx-auto max-w-7xl flex items-center justify-end pointer-events-auto sm:px-6 lg:px-8'>
            <button
              onClick={() => saveProfile()}
              disabled={saving}
              className='h-12 px-5 rounded-full bg-brand-ink text-white text-sm font-semibold shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 lg:rounded-xl'
            >
              <Sparkles size={15} />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Components ─── */

function EditableCard({ title, icon: Icon, isEditing, onEdit, onCancel, children }: {
  title: string;
  icon: LucideIcon;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className='rounded-2xl border border-border bg-white p-3.5 shadow-card lg:p-5'>
      <div className='flex items-center justify-between mb-2.5 lg:mb-4'>
        <div className='flex items-center gap-2'>
          <span className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-sage/10 text-brand-sage'>
            <Icon size={14} />
          </span>
          <h3 className='text-sm font-bold text-foreground lg:text-base'>{title}</h3>
        </div>
        <button
          onClick={isEditing ? onCancel : onEdit}
          className='inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors lg:rounded-lg lg:px-3 lg:py-1.5'
        >
          {isEditing ? (<><X size={11} /> Cancel</>) : (<><Pencil size={10} /> Edit</>)}
        </button>
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className='space-y-1'>
      <Label className='text-xs font-medium text-muted-foreground'>
        {label} {required && <span className='text-red-500'>*</span>}
      </Label>
      {children}
    </div>
  );
}

function ReadRow({ icon: Icon, value, placeholder, badge }: { icon: LucideIcon; value: string; placeholder?: boolean; badge?: string }) {
  return (
    <div className='flex items-center gap-2 rounded-xl px-1 py-1 lg:bg-muted/25 lg:px-3 lg:py-2'>
      <Icon size={13} className={cn('shrink-0', placeholder ? 'text-muted-foreground/50' : 'text-brand-sage')} />
      <p className={cn('text-xs flex-1 min-w-0 truncate lg:text-sm', placeholder ? 'text-muted-foreground/70 italic' : 'text-foreground')}>{value}</p>
      {badge && (
        <span className='inline-flex items-center gap-0.5 rounded-full bg-brand-peach/60 px-1.5 py-0.5 text-[9px] font-medium text-brand-ink shrink-0 lg:text-[10px]'>
          {badge}
        </span>
      )}
    </div>
  );
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className='flex flex-col items-center justify-center py-1'>
      <span className='text-base font-bold text-foreground leading-none'>{value}</span>
      <span className='text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide'>{label}</span>
    </div>
  );
}

function DistrictAutocomplete({ province, value, onChange }: {
  province: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const districts = DISTRICTS_BY_PROVINCE[province] ?? [];
  const q = value.trim().toLowerCase();
  const filtered = q
    ? districts.filter((d) => d.toLowerCase().includes(q))
    : districts;

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const disabled = !province;
  const exactMatch = districts.some((d) => d.toLowerCase() === q);

  return (
    <div ref={wrapRef} className='relative'>
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => { if (!disabled) setOpen(true); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        disabled={disabled}
        placeholder={disabled ? 'Pick a province first' : 'Start typing your district…'}
      />
      {open && !disabled && filtered.length > 0 && (
        <div className='absolute z-30 left-0 right-0 mt-1 rounded-xl border border-border bg-white shadow-lg overflow-hidden max-h-56 overflow-y-auto'>
          {filtered.map((d) => {
            const isSelected = d.toLowerCase() === q;
            return (
              <button
                key={d}
                type='button'
                onClick={() => { onChange(d); setOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs hover:bg-brand-peach/30 transition-colors border-b border-border/40 last:border-b-0',
                  isSelected && 'bg-brand-peach/20 font-semibold',
                )}
              >
                {q ? highlight(d, q) : d}
              </button>
            );
          })}
        </div>
      )}
      {open && !disabled && filtered.length === 0 && (
        <div className='absolute z-30 left-0 right-0 mt-1 rounded-xl border border-border bg-white shadow-lg px-3 py-2.5 text-[11px] text-muted-foreground'>
          No district in {province.replace(' Province', '')} matches “{value}”.
        </div>
      )}
      {!disabled && value && !exactMatch && (
        <p className='mt-1 text-[10px] text-amber-600'>
          Pick a suggestion to save a valid district.
        </p>
      )}
    </div>
  );
}

function highlight(text: string, query: string) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className='font-bold text-brand-ink'>{text.slice(i, i + query.length)}</span>
      {text.slice(i + query.length)}
    </>
  );
}

/* ─── Helpers ─── */
function getAvatarSrc(url?: string | null) {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

function getRoleProfile(role?: string) {
  if (role === 'admin') {
    return {
      label: 'Admin',
      title: 'Admin dashboard',
      description: 'Manage approvals, users, reports, and analytics.',
      href: '/admin/dashboard',
    };
  }
  if (role === 'owner') {
    return {
      label: 'Shop owner',
      title: 'Saloon setup',
      description: 'Manage your shop profile, services, staff and gallery.',
      href: '/owner/saloon/setup',
    };
  }
  return {
    label: 'Customer',
    title: 'Customer dashboard',
    description: 'View bookings, favourites, and discover new salons.',
    href: '/customer/dashboard',
  };
}

function getAccountActions(role: User['role']): Array<{ href: string; label: string; Icon: LucideIcon; tint: string }> {
  if (role === 'admin') {
    return [
      { href: '/admin/users', label: 'User management', Icon: UserRound, tint: 'bg-brand-blue/40 text-brand-ink' },
      { href: '/admin/reports', label: 'Review reports', Icon: Shield, tint: 'bg-red-50 text-red-600' },
    ];
  }

  if (role === 'owner') {
    return [
      { href: '/owner/saloon/setup', label: 'Pin shop location', Icon: MapPin, tint: 'bg-emerald-50 text-emerald-700' },
      { href: '/bookings', label: 'My bookings', Icon: Sparkles, tint: 'bg-muted/60 text-brand-sage' },
    ];
  }

  return [
    { href: '/bookings', label: 'My bookings', Icon: Sparkles, tint: 'bg-muted/60 text-brand-sage' },
    { href: '/favourites', label: 'Favourite shops', Icon: Store, tint: 'bg-brand-peach/60 text-brand-ink' },
  ];
}

async function convertImageToSmallWebp(file: File): Promise<{ dataUrl: string; bytes: number }> {
  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image optimizer is not available in this browser.');

  const maxSourceSide = Math.max(image.width, image.height);
  for (const size of [512, 384, 320, 256, 192, 160, 128, 96]) {
    const scale = Math.min(1, size / maxSourceSide);
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42, 0.32, 0.24]) {
      const blob = await canvasToWebpBlob(canvas, quality);
      if (blob.size <= MAX_AVATAR_BYTES) {
        return { dataUrl: await blobToDataUrl(blob), bytes: blob.size };
      }
    }
  }

  throw new Error('Could not compress image under 20KB.');
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image file.')); };
    image.src = url;
  });
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('WebP conversion failed.'));
      else resolve(blob);
    }, 'image/webp', quality);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not encode optimized image.'));
    reader.readAsDataURL(blob);
  });
}
