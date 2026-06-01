'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  ImagePlus,
  Mail,
  MapPin,
  Minus,
  Navigation,
  Pencil,
  Phone,
  Plus,
  QrCode,
  Scissors,
  Search,
  Sparkles,
  Store,
  Sun,
  Trash2,
  UploadCloud,
  UsersRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { formatLkr } from '@/lib/currency';
import { fileToWebpDataUrlUnderLimit } from '@/lib/imageCompression';
import { Category, Saloon } from '@/types';
import { MapLocationPicker } from '@/components/maps/MapLocationPicker';
import { ShopQrModal } from '@/components/owner/ShopQrModal';
import { saloonHref } from '@/lib/slug';
import { Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type ServiceDraft = { id: string; name: string; price: string; duration_minutes: string; tags: string; description: string };
type StaffDraft = { id: string; name: string; bio: string; avatar_url: string };
type ImageDraft = { id: string; url: string };
type AvailabilityPayload = { weekdays: number[]; start_time: string; end_time: string; max_bookings: number };

const MAX_GALLERY_IMAGE_BYTES = 100 * 1024;
const MAX_THUMBNAIL_BYTES = 40 * 1024;

const STEPS: { id: number; label: string; icon: LucideIcon }[] = [
  { id: 1, label: 'Profile',      icon: Store },
  { id: 2, label: 'Services',     icon: Scissors },
  { id: 3, label: 'Staff',        icon: UsersRound },
  { id: 4, label: 'Hours',        icon: CalendarClock },
  { id: 5, label: 'Gallery',      icon: ImagePlus },
];

export default function OwnerSaloonSetupPage() {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);

  const { data: saloons } = useQuery<Saloon[]>({
    queryKey: ['owner-saloons'],
    queryFn: async () => (await api.get('/owner/saloons/me')).data,
  });
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/categories')).data,
  });
  const current = saloons?.[0];
  const services = current?.services ?? [];
  const staff = current?.staff ?? [];
  const images = current?.images ?? [];
  const availabilitySlots = current?.availability_slots ?? [];
  const hasAvailability = availabilitySlots.some((slot) => slot.is_active !== false);

  const [form, setForm] = useState({ name: '', description: '', address: '', city: '', phone: '', email: '', cover_image: '', lat: '', lng: '' });
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [serviceDrafts, setServiceDrafts] = useState<ServiceDraft[]>([createServiceDraft()]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingBasics, setEditingBasics] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffDrafts, setStaffDrafts] = useState<StaffDraft[]>([createStaffDraft()]);
  const [staffMessage, setStaffMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [imageDrafts, setImageDrafts] = useState<ImageDraft[]>([createImageDraft()]);
  const [mapInput, setMapInput] = useState('');
  const [mapMessage, setMapMessage] = useState('');
  const [thumbnailMessage, setThumbnailMessage] = useState('');
  const [availabilityMessage, setAvailabilityMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    if (current) {
      setForm({
        name: current.name ?? '',
        description: current.description ?? '',
        address: current.address ?? '',
        city: current.city ?? '',
        phone: current.phone ?? '',
        email: current.email ?? '',
        cover_image: current.cover_image ?? '',
        lat: current.lat ? String(current.lat) : '',
        lng: current.lng ? String(current.lng) : '',
      });
      setSelectedCategoryIds((current.categories ?? []).map((c) => c.id));
    }
  }, [current]);

  /* ─── Mutations ─── */
  const saveProfile = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        email: form.email || null,
        cover_image: form.cover_image || null,
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
        category_ids: selectedCategoryIds,
      };
      return current ? api.patch(`/owner/saloons/${current.id}`, payload) : api.post('/owner/saloons', payload);
    },
    onSuccess: () => {
      setEditingBasics(false);
      setEditingLocation(false);
      qc.invalidateQueries({ queryKey: ['owner-saloons'] });
    },
  });

  const saveServices = useMutation({
    mutationFn: async (drafts: ServiceDraft[]) => {
      if (!current?.id) return [];
      const valid = drafts.filter((d) => d.name.trim() && Number(d.price) >= 0 && Number(d.duration_minutes) > 0);
      return Promise.all(valid.map((d) => api.post('/owner/services', {
        saloon_id: current.id,
        name: d.name.trim(),
        price: Number(d.price),
        duration_minutes: Number(d.duration_minutes),
        description: composeServiceDescription(d.description, d.tags),
      })));
    },
    onSuccess: () => {
      setServiceDrafts([createServiceDraft()]);
      qc.invalidateQueries({ queryKey: ['owner-saloons'] });
    },
  });

  const deleteStaff = useMutation({
    mutationFn: async (staffId: number) => api.delete(`/owner/staff/${staffId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owner-saloons'] }),
  });

  const saveStaff = useMutation({
    onMutate: () => setStaffMessage(null),
    mutationFn: async (drafts: StaffDraft[]) => {
      if (!current?.id) throw new Error('Save your shop profile first.');
      const normalized = drafts
        .map((d) => ({ ...d, name: d.name.trim(), bio: d.bio.trim() }))
        .filter((d) => d.name);
      if (!normalized.length) throw new Error('Add at least one staff member name.');

      const deduped: StaffDraft[] = [];
      const seen = new Set<string>();
      for (const item of normalized) {
        const key = item.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(item);
      }
      const serviceIds = services.map((s) => s.id);
      const results = await Promise.allSettled(deduped.map((d) => api.post('/owner/staff', {
        saloon_id: current.id,
        name: d.name,
        bio: d.bio || null,
        avatar_url: d.avatar_url || null,
        service_ids: serviceIds,
      })));

      const failed = results.filter((r) => r.status === 'rejected').length;
      const created = results.length - failed;
      if (!created) throw new Error('Could not add staff members. Please try again.');
      return { created, failed };
    },
    onSuccess: ({ created, failed }) => {
      setStaffDrafts([createStaffDraft()]);
      setStaffMessage({
        type: failed ? 'warning' : 'success',
        text: failed
          ? `${created} member${created !== 1 ? 's' : ''} added, ${failed} failed. You can retry failed entries.`
          : `${created} member${created !== 1 ? 's' : ''} added successfully.`,
      });
      qc.invalidateQueries({ queryKey: ['owner-saloons'] });
    },
    onError: (error) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setStaffMessage({ type: 'error', text: detail || (error instanceof Error ? error.message : 'Could not add staff members.') });
    },
  });

  const saveAvailability = useMutation({
    onMutate: () => setAvailabilityMessage(null),
    mutationFn: async (payload: AvailabilityPayload) => {
      if (!current?.id) throw new Error('Save your profile first.');
      if (!payload.weekdays.length) throw new Error('Select at least one weekday.');
      if (!payload.start_time || !payload.end_time) throw new Error('Choose both start and end time.');
      if (payload.end_time <= payload.start_time) throw new Error('End time must be after start time.');
      if (!Number.isFinite(payload.max_bookings) || payload.max_bookings < 1) throw new Error('Max bookings must be at least 1.');
      return api.post('/owner/availability', {
        saloon_id: current.id,
        slots: payload.weekdays.map((weekday) => ({
          saloon_id: current.id, weekday,
          start_time: `${payload.start_time}:00`,
          end_time: `${payload.end_time}:00`,
          max_bookings: payload.max_bookings, is_active: true,
        })),
      });
    },
    onSuccess: () => {
      setAvailabilityMessage({ type: 'success', text: 'Availability saved.' });
      qc.invalidateQueries({ queryKey: ['owner-saloons'] });
    },
    onError: (error) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAvailabilityMessage({ type: 'error', text: detail || (error instanceof Error ? error.message : 'Could not save.') });
    },
  });

  const saveImages = useMutation({
    mutationFn: async (drafts: ImageDraft[]) => {
      if (!current?.id) return [];
      const urls = drafts.map((d) => d.url.trim()).filter(Boolean);
      return Promise.all(urls.map((url, i) => api.post(`/owner/saloons/${current.id}/images`, { url, order: images.length + i })));
    },
    onSuccess: () => {
      setImageDrafts([createImageDraft()]);
      qc.invalidateQueries({ queryKey: ['owner-saloons'] });
    },
  });

  /* ─── Derived state ─── */
  const canManage = Boolean(current?.id);
  const profileBasicsComplete = useMemo(() => [form.name, form.address, form.city, form.phone].filter(Boolean).length, [form]);
  const profileDone = canManage && profileBasicsComplete === 4 && selectedCategoryIds.length > 0;
  const canSubmitProfile = profileBasicsComplete === 4 && selectedCategoryIds.length > 0;

  const stepStatus: Record<number, 'done' | 'partial' | 'empty'> = {
    1: profileDone ? 'done' : profileBasicsComplete > 0 ? 'partial' : 'empty',
    2: services.length > 0 ? 'done' : 'empty',
    3: staff.length > 0 ? 'done' : 'empty',
    4: hasAvailability ? 'done' : 'empty',
    5: images.length > 0 ? 'done' : 'empty',
  };

  const completedSteps = Object.values(stepStatus).filter((s) => s === 'done').length;
  const progressPercent = Math.round((completedSteps / STEPS.length) * 100);

  /* ─── Map handlers ─── */
  function openGoogleMaps() {
    const q = form.lat && form.lng ? `${form.lat},${form.lng}` : [form.address, form.city].filter(Boolean).join(', ') || 'saloon near me';
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank', 'noopener,noreferrer');
    setMapMessage(form.lat && form.lng ? 'Opened with saved pin.' : 'Opened Maps. Paste link below to extract coordinates.');
  }
  function useCurrentLocation() {
    if (!navigator.geolocation) { setMapMessage('Location not supported.'); return; }
    setMapMessage('Getting location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setForm((p) => ({ ...p, lat, lng }));
        setMapMessage('Location set.');
      },
      () => setMapMessage('Could not access location.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  function applyMapInput() {
    const parsed = parseCoordinates(mapInput);
    if (!parsed) { setMapMessage('Could not find coordinates in that text.'); return; }
    setForm((p) => ({ ...p, lat: parsed.lat, lng: parsed.lng }));
    setMapMessage('Coordinates extracted.');
  }
  async function handleThumbnailUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setThumbnailMessage('Optimizing...');
    try {
      const coverImage = await fileToWebpDataUrlUnderLimit(file, { maxBytes: MAX_THUMBNAIL_BYTES, maxLongEdge: 900 });
      setForm((p) => ({ ...p, cover_image: coverImage }));
      setThumbnailMessage('Ready — click Save to publish.');
    } catch (error) {
      setThumbnailMessage(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      event.target.value = '';
    }
  }

  return (
    <div className='mx-auto max-w-2xl px-4 py-4 sm:py-6 space-y-4 pb-24'>

      {/* ── Profile header card (Instagram-style) ── */}
      <div className='rounded-2xl border border-border bg-white overflow-hidden'>
        {/* Cover */}
        <div className='relative h-20 sm:h-24 bg-gradient-to-br from-brand-peach via-brand-tan/50 to-brand-sage/30'>
          {form.cover_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.cover_image} alt='' className='h-full w-full object-cover' />
          )}
          {/* Approval badge */}
          {current && (
            <div className={cn(
              'absolute top-2 right-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold backdrop-blur-md',
              current.is_approved ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white'
            )}>
              {current.is_approved ? <CheckCircle2 size={10} /> : <Clock size={10} />}
              {current.is_approved ? 'Approved' : 'Pending'}
            </div>
          )}
        </div>

        {/* Info */}
        <div className='px-4 pt-3 pb-4'>
          <div className='flex items-end gap-3 -mt-8'>
            <div className='h-16 w-16 rounded-2xl border-4 border-white bg-muted shadow-md overflow-hidden shrink-0'>
              {form.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.cover_image} alt='' className='h-full w-full object-cover' />
              ) : (
                <div className='h-full w-full flex items-center justify-center bg-brand-peach/40'>
                  <Store size={24} className='text-brand-ink' />
                </div>
              )}
            </div>
            <div className='flex-1 min-w-0 pb-1'>
              <h1 className='text-base font-bold text-foreground truncate'>{form.name || 'Your salon'}</h1>
              <p className='text-xs text-muted-foreground truncate'>
                {form.city ? `${form.city}` : 'Set up your salon below'}
              </p>
            </div>
          </div>

          {/* Stat row (Instagram-style: posts/followers/following → services/staff/photos) */}
          <div className='mt-4 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-2'>
            <StatPill value={services.length} label='Services' />
            <StatPill value={staff.length} label='Staff' />
            <StatPill value={images.length} label='Photos' />
          </div>

          {/* Public link + QR */}
          {current && (
            <div className='mt-3 grid grid-cols-[1fr_auto] gap-2'>
              <a
                href={saloonHref(current)}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 h-10 text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors truncate'
              >
                <ExternalLink size={14} className='text-brand-sage shrink-0' />
                <span className='truncate'>View public shop page</span>
              </a>
              <button
                onClick={() => setQrOpen(true)}
                disabled={!current?.is_approved}
                title={current?.is_approved ? 'Generate a QR code for your shop' : 'Available after your shop is approved'}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-3.5 h-10 text-xs font-bold transition-all',
                  current?.is_approved
                    ? 'bg-gradient-to-br from-brand-ink to-[#2a2724] text-white shadow-sm hover:shadow-card-hover active:scale-95'
                    : 'bg-muted text-muted-foreground cursor-not-allowed',
                )}
              >
                <QrCode size={14} />
                Generate QR
              </button>
            </div>
          )}

          {/* Progress bar */}
          <div className='mt-3'>
            <div className='flex items-center justify-between mb-1.5'>
              <p className='text-xs font-medium text-muted-foreground'>Setup progress</p>
              <p className='text-xs font-semibold text-foreground'>{completedSteps}/{STEPS.length}</p>
            </div>
            <div className='h-1.5 rounded-full bg-muted overflow-hidden'>
              <div
                className='h-full rounded-full bg-gradient-to-r from-brand-sage to-brand-ink transition-all duration-500'
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Story-style step circles ── */}
      <div className='overflow-x-auto -mx-4 px-4'>
        <div className='flex gap-3 pb-2 min-w-max'>
          {STEPS.map((s) => {
            const status = stepStatus[s.id];
            const isActive = step === s.id;
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={() => setStep(s.id)} className='flex flex-col items-center gap-1.5 shrink-0 group'>
                <div className={cn(
                  'relative h-14 w-14 rounded-full flex items-center justify-center transition-all',
                  isActive
                    ? 'bg-gradient-to-br from-brand-ink to-brand-sage p-[3px] shadow-md'
                    : status === 'done'
                      ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 p-[2px]'
                      : 'bg-muted p-[2px]'
                )}>
                  <div className='h-full w-full rounded-full bg-white flex items-center justify-center'>
                    <Icon size={20} className={cn(
                      isActive ? 'text-brand-ink' : status === 'done' ? 'text-emerald-600' : 'text-muted-foreground'
                    )} />
                  </div>
                  {status === 'done' && !isActive && (
                    <div className='absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center'>
                      <Check size={10} className='text-white' strokeWidth={3} />
                    </div>
                  )}
                </div>
                <span className={cn(
                  'text-[11px] font-semibold transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Step content ── */}
      <div className='space-y-3'>

        {/* Step 1 — Profile */}
        {step === 1 && (
          <div className='space-y-3'>
            {/* ── Basics ── */}
            <EditableCard
              title='Basics'
              icon={Store}
              isEditing={editingBasics}
              onEdit={() => setEditingBasics(true)}
              onCancel={() => { setEditingBasics(false); if (current) setForm((p) => ({ ...p, name: current.name ?? '', description: current.description ?? '', phone: current.phone ?? '', email: current.email ?? '' })); }}
            >
              {editingBasics ? (
                <div className='space-y-2.5'>
                  <Field label='Salon name' required>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='Royal Cuts Salon' />
                  </Field>
                  <Field label='Description'>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder='What makes your salon special?'
                      className='w-full min-h-16 rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-sage/40'
                    />
                  </Field>
                  <div className='grid grid-cols-2 gap-2'>
                    <Field label='Phone' required>
                      <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder='+94 77 000 0000' />
                    </Field>
                    <Field label='Email'>
                      <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder='salon@example.com' type='email' />
                    </Field>
                  </div>
                </div>
              ) : (
                <div className='space-y-1.5'>
                  <ReadRow icon={Store} value={form.name || 'Not set'} placeholder={!form.name} />
                  {form.description && <p className='text-xs text-muted-foreground leading-relaxed line-clamp-2 pl-6'>{form.description}</p>}
                  <ReadRow icon={Phone} value={form.phone || 'Not set'} placeholder={!form.phone} />
                  <ReadRow icon={Mail} value={form.email || 'Not set'} placeholder={!form.email} />
                </div>
              )}
            </EditableCard>

            {/* ── Location ── */}
            <EditableCard
              title='Location'
              icon={MapPin}
              isEditing={editingLocation}
              onEdit={() => setEditingLocation(true)}
              onCancel={() => { setEditingLocation(false); if (current) setForm((p) => ({ ...p, address: current.address ?? '', city: current.city ?? '', lat: current.lat ? String(current.lat) : '', lng: current.lng ? String(current.lng) : '' })); }}
            >
              {editingLocation ? (
                <div className='space-y-2.5'>
                  <Field label='Street address' required>
                    <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder='12, Main Street, Nugegoda' />
                  </Field>
                  <Field label='City' required>
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder='Colombo' />
                  </Field>

                  <div className='rounded-xl bg-muted/40 p-2.5 space-y-2'>
                    <div className='flex items-center justify-between'>
                      <p className='text-[11px] font-semibold text-foreground flex items-center gap-1'>
                        <MapPin size={11} className='text-brand-sage' /> Pin your shop on the map
                      </p>
                      {form.lat && form.lng && (
                        <span className='inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700'>
                          <Check size={8} /> Pinned
                        </span>
                      )}
                    </div>

                    <MapLocationPicker
                      value={form.lat && form.lng ? { lat: Number(form.lat), lng: Number(form.lng) } : null}
                      onChange={({ lat, lng }) => setForm({ ...form, lat: String(lat), lng: String(lng) })}
                    />

                    {/* Power-user fallback: paste a Google Maps link */}
                    <details className='text-[11px] text-muted-foreground'>
                      <summary className='cursor-pointer select-none'>Paste a Google Maps link instead</summary>
                      <div className='mt-2 flex gap-1.5'>
                        <Input value={mapInput} onChange={(e) => setMapInput(e.target.value)} placeholder='https://maps.google.com/…' className='bg-white text-xs h-8 flex-1' />
                        <button type='button' onClick={applyMapInput} className='rounded-lg border border-border bg-white px-2.5 text-[11px] font-medium hover:bg-muted/40 transition-colors'>
                          Extract
                        </button>
                        <button type='button' onClick={openGoogleMaps} className='rounded-lg border border-border bg-white px-2 text-[11px] font-medium hover:bg-muted/40 transition-colors inline-flex items-center gap-1'>
                          <ExternalLink size={11} />
                        </button>
                      </div>
                      {mapMessage && <p className='mt-1 text-[10px] text-muted-foreground'>{mapMessage}</p>}
                    </details>
                  </div>
                </div>
              ) : (
                <div className='space-y-1.5'>
                  <ReadRow icon={MapPin} value={[form.address, form.city].filter(Boolean).join(', ') || 'Address not set'} placeholder={!form.address && !form.city} />
                  <ReadRow
                    icon={Navigation}
                    value={form.lat && form.lng ? `${form.lat}, ${form.lng}` : 'Map pin not set'}
                    placeholder={!form.lat || !form.lng}
                    badge={form.lat && form.lng ? 'Pinned' : undefined}
                  />
                </div>
              )}
            </EditableCard>

            <CategoriesEditor
              categories={categories}
              selectedIds={selectedCategoryIds}
              onChange={setSelectedCategoryIds}
            />

            <SectionCard title='Cover photo' icon={ImagePlus}>
              <div className='space-y-3'>
                {form.cover_image ? (
                  <div className='relative group'>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.cover_image} alt='' className='h-32 w-full rounded-xl object-cover border border-border' />
                    <button onClick={() => setForm({ ...form, cover_image: '' })} className='absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity'>
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <label className='flex flex-col items-center justify-center gap-2 h-32 rounded-xl border-2 border-dashed border-border bg-muted/20 cursor-pointer hover:bg-muted/40 hover:border-brand-sage/40 transition-all'>
                    <UploadCloud size={20} className='text-muted-foreground' />
                    <div className='text-center'>
                      <p className='text-xs font-medium text-foreground'>Upload cover photo</p>
                      <p className='text-[10px] text-muted-foreground'>JPG, PNG · auto WebP &lt;40KB</p>
                    </div>
                    <input type='file' accept='image/*' onChange={handleThumbnailUpload} className='sr-only' />
                  </label>
                )}
                {thumbnailMessage && <p className='text-xs text-muted-foreground'>{thumbnailMessage}</p>}
              </div>
            </SectionCard>

            {saveProfile.isSuccess && (
              <Banner type='success' message='Profile saved successfully.' />
            )}
            {saveProfile.isError && <Banner type='error' message='Could not save. Check required fields.' />}
          </div>
        )}

        {/* Step 2 — Services */}
        {step === 2 && (
          <div className='space-y-3'>
            {services.length === 0 ? (
              <EmptyState
                icon={Scissors}
                title='No services yet'
                description='Add haircuts, beard trims, and other services with prices.'
                actionLabel='Add first service'
                onAction={() => { setServiceDrafts([createServiceDraft()]); setShowServiceModal(true); }}
                disabled={!canManage}
              />
            ) : (
              <div className='space-y-2'>
                {services.map((service) => {
                  const tags = parseServiceTags(service.description);
                  return (
                    <div key={service.id} className='rounded-2xl border border-border bg-white p-3.5 flex items-center gap-3 hover:border-brand-sage/40 hover:shadow-sm transition-all'>
                      <div className='h-10 w-10 rounded-xl bg-brand-peach/50 flex items-center justify-center shrink-0'>
                        <Scissors size={16} className='text-brand-ink' />
                      </div>
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center justify-between gap-2'>
                          <p className='text-sm font-semibold text-foreground truncate'>{service.name}</p>
                          <span className='text-sm font-bold text-brand-ink shrink-0'>{formatLkr(service.price)}</span>
                        </div>
                        <div className='flex items-center gap-2 mt-0.5'>
                          <span className='text-xs text-muted-foreground inline-flex items-center gap-1'>
                            <Clock size={10} />
                            {service.duration_minutes}m
                          </span>
                          {tags.slice(0, 2).map((tag) => (
                            <span key={tag} className='text-[10px] text-brand-ink bg-brand-peach/40 px-1.5 py-0.5 rounded-full'>{tag}</span>
                          ))}
                          {tags.length > 2 && <span className='text-[10px] text-muted-foreground'>+{tags.length - 2}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {staffMessage && (
              <Banner type={staffMessage.type} message={staffMessage.text} />
            )}
            {!canManage && <Banner type='warning' message='Save your shop profile first.' />}
          </div>
        )}

        {/* Step 3 — Staff */}
        {step === 3 && (
          <div className='space-y-3'>
            {staff.length === 0 ? (
              <EmptyState
                icon={UsersRound}
                title='No team members yet'
                description='Add barbers and stylists who take bookings.'
                actionLabel='Add staff member'
                onAction={() => { setStaffDrafts([createStaffDraft()]); setShowStaffModal(true); }}
                disabled={!canManage}
              />
            ) : (
              <div className='rounded-2xl border border-border bg-white overflow-hidden'>
                <div className='flex items-center justify-between px-4 py-3 border-b border-border'>
                  <div className='flex items-center gap-2'>
                    <UsersRound size={14} className='text-brand-sage' />
                    <h3 className='text-sm font-bold text-foreground'>Team</h3>
                    <span className='text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full'>
                      {staff.length}
                    </span>
                  </div>
                  <button
                    onClick={() => { setStaffDrafts([createStaffDraft()]); setShowStaffModal(true); }}
                    disabled={!canManage}
                    className='inline-flex items-center gap-1 rounded-full bg-brand-ink px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity'
                  >
                    <Plus size={11} strokeWidth={3} /> Add
                  </button>
                </div>
                <div className='divide-y divide-border'>
                  {staff.map((person) => {
                    const isDeleting = deleteStaff.isPending && deleteStaff.variables === person.id;
                    return (
                      <div
                        key={person.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors',
                          isDeleting && 'opacity-50',
                        )}
                      >
                        <div className='h-11 w-11 rounded-full bg-gradient-to-br from-brand-peach to-brand-tan/60 border border-brand-tan/30 flex items-center justify-center shrink-0 overflow-hidden'>
                          {person.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={person.avatar_url} alt={person.name} className='h-full w-full object-cover' />
                          ) : (
                            <span className='text-sm font-bold text-brand-ink'>{person.name[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <div className='flex-1 min-w-0'>
                          <p className='text-sm font-semibold text-foreground truncate'>{person.name}</p>
                          <p className='text-xs text-muted-foreground truncate'>
                            {person.bio || `Assigned to ${services.length} service${services.length !== 1 ? 's' : ''}`}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${person.name} from your team?`)) deleteStaff.mutate(person.id);
                          }}
                          disabled={isDeleting}
                          className='h-8 w-8 rounded-lg border border-border bg-white flex items-center justify-center text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0'
                          aria-label={`Remove ${person.name}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {!canManage && <Banner type='warning' message='Save your shop profile first.' />}
          </div>
        )}

        {/* Step 4 — Availability */}
        {step === 4 && (
          <AvailabilityStep
            canManage={canManage}
            isSaving={saveAvailability.isPending}
            message={availabilityMessage}
            onSave={(payload) => saveAvailability.mutate(payload)}
          />
        )}

        {/* Step 5 — Gallery */}
        {step === 5 && (
          <div className='space-y-3'>
            {/* Gallery grid (Instagram-style) */}
            {images.length > 0 && (
              <div className='grid grid-cols-3 gap-1 rounded-2xl overflow-hidden border border-border bg-white p-1'>
                {images.map((image) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={image.id} src={image.url} alt='' className='aspect-square w-full object-cover rounded-lg' />
                ))}
              </div>
            )}

            <GalleryUploadPanel
              disabled={!canManage}
              drafts={imageDrafts}
              isSaving={saveImages.isPending}
              setDrafts={setImageDrafts}
              onSubmit={() => saveImages.mutate(imageDrafts)}
              hasExisting={images.length > 0}
            />

            {!canManage && <Banner type='warning' message='Save your shop profile first.' />}
          </div>
        )}
      </div>

      {/* ── Sticky bottom action bar ── */}
      <div className='fixed bottom-16 sm:bottom-4 inset-x-0 z-30 px-4 pointer-events-none'>
        <div className='mx-auto max-w-2xl flex items-center justify-between gap-2 pointer-events-auto'>
          {step > 1 ? (
            <button onClick={() => setStep(step - 1)} className='h-11 w-11 rounded-full bg-white shadow-lg border border-border flex items-center justify-center text-foreground hover:bg-muted/50 transition-colors'>
              <ChevronLeft size={18} />
            </button>
          ) : <div className='h-11 w-11' />}

          {/* Primary action based on step */}
          {step === 1 && (
            <button
              onClick={() => saveProfile.mutate()}
              disabled={saveProfile.isPending || !canSubmitProfile}
              className='h-12 px-5 rounded-full bg-brand-ink text-white text-sm font-semibold shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2'
            >
              <Sparkles size={15} />
              {saveProfile.isPending ? 'Saving…' : 'Save profile'}
            </button>
          )}
          {step === 2 && (
            <button
              onClick={() => { setServiceDrafts([createServiceDraft()]); setShowServiceModal(true); }}
              disabled={!canManage}
              className='h-12 px-5 rounded-full bg-brand-ink text-white text-sm font-semibold shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2'
            >
              <Plus size={16} />
              Add service
            </button>
          )}
          {step === 3 && (
            <button
              onClick={() => { setStaffDrafts([createStaffDraft()]); setShowStaffModal(true); }}
              disabled={!canManage}
              className='h-12 px-5 rounded-full bg-brand-ink text-white text-sm font-semibold shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2'
            >
              <Plus size={16} />
              Add staff
            </button>
          )}
          {step === 4 && <div className='h-12' />}
          {step === 5 && <div className='h-12' />}

          {step < STEPS.length ? (
            <button onClick={() => setStep(step + 1)} className='h-11 w-11 rounded-full bg-white shadow-lg border border-border flex items-center justify-center text-foreground hover:bg-muted/50 transition-colors'>
              <ChevronRight size={18} />
            </button>
          ) : <div className='h-11 w-11' />}
        </div>
      </div>

      {/* Service modal */}
      {showServiceModal && (
        <ServiceModal
          drafts={serviceDrafts}
          isSaving={saveServices.isPending}
          setDrafts={setServiceDrafts}
          onClose={() => setShowServiceModal(false)}
          onSave={() => saveServices.mutate(serviceDrafts, { onSuccess: () => setShowServiceModal(false) })}
        />
      )}

      {/* Staff modal */}
      {showStaffModal && (
        <StaffModal
          drafts={staffDrafts}
          setDrafts={setStaffDrafts}
          serviceCount={services.length}
          isSaving={saveStaff.isPending}
          onClose={() => setShowStaffModal(false)}
          onSave={() => saveStaff.mutate(staffDrafts, {
            onSuccess: ({ failed }) => {
              if (!failed) setShowStaffModal(false);
            },
          })}
        />
      )}

      <ShopQrModal open={qrOpen} onOpenChange={setQrOpen} shop={current ?? null} />
    </div>
  );
}

/* ─── Components ─── */

function SectionCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className='rounded-2xl border border-border bg-white p-4'>
      <div className='flex items-center gap-2 mb-3'>
        <Icon size={14} className='text-brand-sage' />
        <h3 className='text-sm font-bold text-foreground'>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function EditableCard({ title, icon: Icon, isEditing, onEdit, onCancel, children }: {
  title: string;
  icon: LucideIcon;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className='rounded-2xl border border-border bg-white p-3.5'>
      <div className='flex items-center justify-between mb-2.5'>
        <div className='flex items-center gap-2'>
          <Icon size={13} className='text-brand-sage' />
          <h3 className='text-sm font-bold text-foreground'>{title}</h3>
        </div>
        <button
          onClick={isEditing ? onCancel : onEdit}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
            isEditing
              ? 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
              : 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          {isEditing ? (<><X size={11} /> Cancel</>) : (<><Pencil size={10} /> Edit</>)}
        </button>
      </div>
      {children}
    </div>
  );
}

function ReadRow({ icon: Icon, value, placeholder, badge }: { icon: LucideIcon; value: string; placeholder?: boolean; badge?: string }) {
  return (
    <div className='flex items-center gap-2'>
      <Icon size={13} className={cn('shrink-0', placeholder ? 'text-muted-foreground/50' : 'text-brand-sage')} />
      <p className={cn('text-xs flex-1 min-w-0 truncate', placeholder ? 'text-muted-foreground/70 italic' : 'text-foreground')}>{value}</p>
      {badge && (
        <span className='inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 shrink-0'>
          <Check size={8} /> {badge}
        </span>
      )}
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

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <div className='flex flex-col items-center justify-center py-1'>
      <span className='text-lg font-bold text-foreground leading-none'>{value}</span>
      <span className='text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide'>{label}</span>
    </div>
  );
}

function Banner({ type, message }: { type: 'success' | 'error' | 'warning'; message: string }) {
  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
  };
  return (
    <div className={cn('rounded-xl border px-3 py-2 text-xs font-medium', styles[type])}>
      {message}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, actionLabel, onAction, disabled }: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  return (
    <div className='rounded-2xl border border-dashed border-border bg-white px-4 py-10 flex flex-col items-center text-center'>
      <div className='h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-peach to-brand-tan/40 flex items-center justify-center mb-3'>
        <Icon size={22} className='text-brand-ink' />
      </div>
      <p className='text-sm font-semibold text-foreground'>{title}</p>
      <p className='text-xs text-muted-foreground mt-1 max-w-xs'>{description}</p>
      <button onClick={onAction} disabled={disabled} className='mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-ink px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed'>
        <Plus size={13} />
        {actionLabel}
      </button>
    </div>
  );
}

function ServiceModal({ drafts, isSaving, setDrafts, onClose, onSave }: {
  drafts: ServiceDraft[]; isSaving: boolean; setDrafts: (d: ServiceDraft[]) => void; onClose: () => void; onSave: () => void;
}) {
  function update(id: string, field: keyof Omit<ServiceDraft, 'id'>, value: string) {
    setDrafts(drafts.map((d) => d.id === id ? { ...d, [field]: value } : d));
  }
  return (
    <BottomSheet title='Add service' subtitle={`${drafts.length} to add`} icon={Scissors} onClose={onClose}>
      <div className='space-y-4'>
        {drafts.map((draft, i) => (
          <div key={draft.id} className='rounded-2xl border border-border bg-muted/20 p-3.5 space-y-2.5'>
            <div className='flex items-center justify-between'>
              <p className='text-xs font-semibold text-foreground'>Service {i + 1}</p>
              <button onClick={() => setDrafts(drafts.length === 1 ? [createServiceDraft()] : drafts.filter((d) => d.id !== draft.id))} className='h-7 w-7 rounded-lg bg-white border border-border flex items-center justify-center text-red-500 hover:bg-red-50'>
                <Trash2 size={12} />
              </button>
            </div>
            <Field label='Service name' required>
              <Input value={draft.name} onChange={(e) => update(draft.id, 'name', e.target.value)} placeholder='Haircut' />
            </Field>
            <div className='grid grid-cols-2 gap-2'>
              <Field label='Price (LKR)' required>
                <Input type='number' min='0' value={draft.price} onChange={(e) => update(draft.id, 'price', e.target.value)} placeholder='500' />
              </Field>
              <Field label='Duration (min)' required>
                <Input type='number' min='5' value={draft.duration_minutes} onChange={(e) => update(draft.id, 'duration_minutes', e.target.value)} placeholder='30' />
              </Field>
            </div>
            <Field label='Tags (comma separated)'>
              <Input value={draft.tags} onChange={(e) => update(draft.id, 'tags', e.target.value)} placeholder='hair, beard' />
            </Field>
            <Field label='Description'>
              <textarea value={draft.description} onChange={(e) => update(draft.id, 'description', e.target.value)} className='w-full min-h-14 rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-sage/40' placeholder='Optional…' />
            </Field>
          </div>
        ))}
        <button onClick={() => setDrafts([...drafts, createServiceDraft()])} className='w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-brand-sage/40 hover:bg-muted/30 transition-all'>
          <Plus size={13} />
          Add another
        </button>
      </div>
      <SheetFooter onCancel={onClose}>
        <Button variant='gradient' disabled={isSaving || drafts.every((d) => !d.name.trim())} onClick={onSave} className='rounded-xl flex-1'>
          {isSaving ? 'Saving…' : `Save ${drafts.length} service${drafts.length !== 1 ? 's' : ''}`}
        </Button>
      </SheetFooter>
    </BottomSheet>
  );
}

function StaffModal({ drafts, setDrafts, serviceCount, isSaving, onClose, onSave }: {
  drafts: StaffDraft[];
  setDrafts: (d: StaffDraft[]) => void;
  serviceCount: number;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const [uploadMsg, setUploadMsg] = useState('');

  function update(id: string, field: keyof Omit<StaffDraft, 'id'>, value: string) {
    setDrafts(drafts.map((d) => d.id === id ? { ...d, [field]: value } : d));
  }

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>, draftId: string) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadMsg('Optimizing…');
    try {
      const dataUrl = await fileToWebpDataUrlUnderLimit(file, { maxBytes: 40 * 1024, maxLongEdge: 400 });
      update(draftId, 'avatar_url', dataUrl);
      setUploadMsg('');
    } catch (err) {
      setUploadMsg(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      event.target.value = '';
    }
  }

  const validCount = drafts.filter((d) => d.name.trim()).length;

  return (
    <BottomSheet title='Add staff' subtitle={`${drafts.length} to add`} icon={UsersRound} onClose={onClose}>
      <div className='space-y-4'>
        {drafts.map((draft, i) => (
          <div key={draft.id} className='rounded-2xl border border-border bg-muted/20 p-3.5 space-y-3'>
            <div className='flex items-center justify-between'>
              <p className='text-xs font-semibold text-foreground'>Member {i + 1}</p>
              <button
                type='button'
                onClick={() => setDrafts(drafts.length === 1 ? [createStaffDraft()] : drafts.filter((d) => d.id !== draft.id))}
                className='h-7 w-7 rounded-lg bg-white border border-border flex items-center justify-center text-red-500 hover:bg-red-50'
                aria-label='Remove'
              >
                <Trash2 size={12} />
              </button>
            </div>

            <div className='flex items-center gap-3'>
              <label className='relative h-16 w-16 shrink-0 cursor-pointer group'>
                <div className='h-full w-full rounded-full bg-gradient-to-br from-brand-peach to-brand-tan/60 border border-brand-tan/30 flex items-center justify-center overflow-hidden'>
                  {draft.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.avatar_url} alt='' className='h-full w-full object-cover' />
                  ) : (
                    <span className='text-xl font-bold text-brand-ink'>{draft.name[0]?.toUpperCase() || '?'}</span>
                  )}
                </div>
                <span className='absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full bg-brand-ink border-2 border-white shadow-md flex items-center justify-center group-active:scale-95 transition-transform'>
                  <Camera size={11} className='text-white' />
                </span>
                <input type='file' accept='image/*' onChange={(e) => handleAvatarUpload(e, draft.id)} className='sr-only' />
              </label>
              <div className='flex-1 space-y-1.5 min-w-0'>
                <Field label='Name' required>
                  <Input
                    autoFocus={i === 0}
                    value={draft.name}
                    onChange={(e) => update(draft.id, 'name', e.target.value)}
                    placeholder='Kasun Perera'
                  />
                </Field>
                <p className='text-[11px] text-muted-foreground'>Tap the camera to upload a photo</p>
              </div>
            </div>

            <Field label='Bio'>
              <textarea
                value={draft.bio}
                onChange={(e) => update(draft.id, 'bio', e.target.value)}
                className='w-full min-h-14 rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-sage/40'
                placeholder='Short intro…'
              />
            </Field>
          </div>
        ))}

        {uploadMsg && <p className='text-xs text-muted-foreground'>{uploadMsg}</p>}

        <Button
          variant='gradient'
          disabled={isSaving || validCount === 0}
          onClick={onSave}
          className='h-11 w-full rounded-xl'
        >
          {isSaving ? 'Adding...' : validCount === 1 ? 'Add member' : `Add ${validCount} members`}
        </Button>

        <button
          type='button'
          onClick={() => setDrafts([...drafts, createStaffDraft()])}
          className='w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-brand-sage/40 hover:bg-muted/30 transition-all'
        >
          <Plus size={13} />
          Add another
        </button>

        <p className={cn(
          'text-xs rounded-lg px-3 py-2',
          serviceCount > 0 ? 'text-muted-foreground bg-muted/40' : 'text-amber-700 bg-amber-50 border border-amber-200',
        )}>
          {serviceCount > 0
            ? `${serviceCount} service${serviceCount !== 1 ? 's' : ''} will be assigned to each member automatically.`
            : 'No services yet. Add services in Step 2 so customers can book this team member.'}
        </p>
      </div>
    </BottomSheet>
  );
}

function BottomSheet({ title, subtitle, icon: Icon, onClose, children }: {
  title: string; subtitle: string; icon: LucideIcon; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className='fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4'>
      <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' onClick={onClose} />
      <div className='relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col'>
        <div className='sm:hidden flex justify-center pt-2.5 pb-1'>
          <div className='h-1 w-10 rounded-full bg-muted-foreground/30' />
        </div>
        <div className='flex items-center justify-between px-5 py-3 border-b border-border'>
          <div className='flex items-center gap-2.5'>
            <div className='h-9 w-9 rounded-xl bg-brand-peach/60 flex items-center justify-center'>
              <Icon size={16} className='text-brand-ink' />
            </div>
            <div>
              <h2 className='text-sm font-bold text-foreground'>{title}</h2>
              <p className='text-[11px] text-muted-foreground'>{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className='h-8 w-8 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors'>
            <X size={14} />
          </button>
        </div>
        <div className='overflow-y-auto flex-1 px-5 py-4'>{children}</div>
      </div>
    </div>
  );
}

function SheetFooter({ onCancel, children }: { onCancel: () => void; children: React.ReactNode }) {
  return (
    <div className='-mx-5 -mb-4 mt-4 px-5 py-3 border-t border-border bg-muted/20 flex gap-2'>
      <Button variant='outline' onClick={onCancel} className='rounded-xl'>Cancel</Button>
      {children}
    </div>
  );
}

function GalleryUploadPanel({ disabled, drafts, isSaving, setDrafts, onSubmit, hasExisting }: {
  disabled: boolean; drafts: ImageDraft[]; isSaving: boolean; setDrafts: (d: ImageDraft[]) => void; onSubmit: () => void; hasExisting: boolean;
}) {
  const [uploadMessage, setUploadMessage] = useState('');
  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploadMessage(`Optimizing ${files.length} image${files.length === 1 ? '' : 's'}...`);
    try {
      const converted = await Promise.all(files.map((f) => fileToWebpDataUrlUnderLimit(f, { maxBytes: MAX_GALLERY_IMAGE_BYTES, maxLongEdge: 1400 })));
      setDrafts([...drafts.filter((d) => d.url.trim()), ...converted.map((url) => ({ id: createDraftId(), url }))]);
      setUploadMessage(`${converted.length} image${converted.length === 1 ? '' : 's'} ready.`);
      event.target.value = '';
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Optimization failed.');
    }
  }
  const hasDrafts = drafts.some((d) => d.url);
  return (
    <div className='rounded-2xl border border-border bg-white p-4 space-y-3'>
      <div className='flex items-center gap-2'>
        <ImagePlus size={14} className='text-brand-sage' />
        <h3 className='text-sm font-bold text-foreground'>{hasExisting ? 'Add more photos' : 'Upload photos'}</h3>
      </div>

      <label className='flex flex-col items-center justify-center gap-2 h-32 rounded-2xl border-2 border-dashed border-border bg-muted/20 cursor-pointer hover:bg-muted/40 hover:border-brand-sage/40 transition-all'>
        <UploadCloud size={22} className='text-muted-foreground' />
        <div className='text-center'>
          <p className='text-xs font-semibold text-foreground'>Tap to upload</p>
          <p className='text-[10px] text-muted-foreground'>Multiple · auto WebP &lt;100KB</p>
        </div>
        <input disabled={disabled} type='file' accept='image/*' multiple onChange={handleFileUpload} className='sr-only' />
      </label>

      {uploadMessage && <p className='text-xs text-muted-foreground text-center'>{uploadMessage}</p>}

      {hasDrafts && (
        <div className='grid grid-cols-3 gap-1.5'>
          {drafts.filter((d) => d.url).map((draft) => (
            <div key={draft.id} className='relative group aspect-square'>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={draft.url} alt='' className='h-full w-full rounded-lg object-cover border border-border' />
              <button onClick={() => setDrafts(drafts.length === 1 ? [createImageDraft()] : drafts.filter((d) => d.id !== draft.id))} className='absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity'>
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {hasDrafts && (
        <Button disabled={disabled || isSaving} onClick={onSubmit} variant='gradient' className='rounded-xl w-full'>
          {isSaving ? 'Saving…' : `Save ${drafts.filter((d) => d.url).length} photo${drafts.filter((d) => d.url).length !== 1 ? 's' : ''}`}
        </Button>
      )}
    </div>
  );
}

/* ─── Availability step ─── */

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const HOUR_PRESETS: { label: string; start: string; end: string }[] = [
  { label: '9–6',  start: '09:00', end: '18:00' },
  { label: '10–7', start: '10:00', end: '19:00' },
  { label: '8–8',  start: '08:00', end: '20:00' },
  { label: '11–9', start: '11:00', end: '21:00' },
];
const DAY_PRESETS: { label: string; days: number[] }[] = [
  { label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Weekdays',  days: [0, 1, 2, 3, 4] },
  { label: 'Weekends',  days: [5, 6] },
];

function formatTime12h(value: string) {
  const [hStr, mStr] = value.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function summariseDays(days: number[]) {
  if (!days.length) return 'No days selected';
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Every day';
  if (sorted.length === 5 && sorted.every((d, i) => d === i)) return 'Mon – Fri';
  if (sorted.length === 2 && sorted[0] === 5 && sorted[1] === 6) return 'Sat & Sun';
  // Detect contiguous run
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (contiguous && sorted.length > 2) return `${DAY_NAMES[sorted[0]]} – ${DAY_NAMES[sorted[sorted.length - 1]]}`;
  return sorted.map((d) => DAY_NAMES[d]).join(', ');
}

function AvailabilityStep({ canManage, isSaving, message, onSave }: {
  canManage: boolean;
  isSaving: boolean;
  message: { type: 'success' | 'error'; text: string } | null;
  onSave: (payload: AvailabilityPayload) => void;
}) {
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [maxBookings, setMaxBookings] = useState(1);

  function toggleDay(day: number) {
    setWeekdays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b));
  }
  function applyDayPreset(days: number[]) { setWeekdays(days); }
  function applyHourPreset(start: string, end: string) { setStartTime(start); setEndTime(end); }

  const activeDayPreset = DAY_PRESETS.find((p) =>
    p.days.length === weekdays.length && p.days.every((d) => weekdays.includes(d))
  );
  const activeHourPreset = HOUR_PRESETS.find((p) => p.start === startTime && p.end === endTime);
  const isValid = weekdays.length > 0 && startTime && endTime && endTime > startTime && maxBookings >= 1;

  return (
    <div className='space-y-3'>
      {/* Live preview banner */}
      <div className='rounded-2xl border border-border bg-gradient-to-br from-brand-peach/30 via-white to-brand-sage/10 p-4'>
        <div className='flex items-start gap-3'>
          <div className='h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0'>
            <Sun size={18} className='text-brand-ink' />
          </div>
          <div className='flex-1 min-w-0'>
            <p className='text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>Schedule preview</p>
            <p className='text-sm font-bold text-foreground mt-0.5'>{summariseDays(weekdays)}</p>
            <p className='text-xs text-muted-foreground mt-0.5'>
              {endTime > startTime
                ? `${formatTime12h(startTime)} – ${formatTime12h(endTime)} · ${maxBookings} booking${maxBookings !== 1 ? 's' : ''}/slot`
                : 'Set valid hours below'}
            </p>
          </div>
        </div>
      </div>

      {/* Working days */}
      <SectionCard title='Working days' icon={CalendarClock}>
        <div className='space-y-3'>
          {/* Day presets */}
          <div className='flex gap-1.5 flex-wrap'>
            {DAY_PRESETS.map((preset) => {
              const active = activeDayPreset?.label === preset.label;
              return (
                <button
                  key={preset.label}
                  type='button'
                  disabled={!canManage}
                  onClick={() => applyDayPreset(preset.days)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[11px] font-semibold border transition-colors',
                    active
                      ? 'bg-brand-ink text-white border-brand-ink'
                      : 'bg-white text-foreground border-border hover:bg-muted/40',
                    !canManage && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Individual day pills */}
          <div className='grid grid-cols-7 gap-1.5'>
            {DAY_LETTERS.map((letter, i) => {
              const selected = weekdays.includes(i);
              return (
                <button
                  key={i}
                  type='button'
                  disabled={!canManage}
                  onClick={() => toggleDay(i)}
                  aria-label={DAY_NAMES[i]}
                  aria-pressed={selected}
                  className={cn(
                    'flex flex-col items-center justify-center h-14 rounded-2xl border transition-all',
                    selected
                      ? 'border-brand-ink bg-brand-ink text-white shadow-sm'
                      : 'border-border bg-white text-foreground hover:bg-muted/30',
                    !canManage && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <span className='text-[10px] font-medium opacity-70'>{DAY_NAMES[i]}</span>
                  <span className='text-base font-bold leading-tight'>{letter}</span>
                </button>
              );
            })}
          </div>
          <p className='text-[11px] text-muted-foreground'>
            Tap a day to toggle · {weekdays.length} day{weekdays.length !== 1 ? 's' : ''} selected
          </p>
        </div>
      </SectionCard>

      {/* Opening hours */}
      <SectionCard title='Opening hours' icon={Clock}>
        <div className='space-y-3'>
          {/* Hour presets */}
          <div className='flex gap-1.5 flex-wrap'>
            {HOUR_PRESETS.map((preset) => {
              const active = activeHourPreset?.label === preset.label;
              return (
                <button
                  key={preset.label}
                  type='button'
                  disabled={!canManage}
                  onClick={() => applyHourPreset(preset.start, preset.end)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[11px] font-semibold border transition-colors',
                    active
                      ? 'bg-brand-ink text-white border-brand-ink'
                      : 'bg-white text-foreground border-border hover:bg-muted/40',
                    !canManage && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Custom time pickers */}
          <div className='grid grid-cols-2 gap-2'>
            <Field label='Opens at'>
              <Input
                disabled={!canManage}
                type='time'
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </Field>
            <Field label='Closes at'>
              <Input
                disabled={!canManage}
                type='time'
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </Field>
          </div>
          {endTime <= startTime && (
            <p className='text-[11px] text-red-600'>Closing time must be after opening time.</p>
          )}
        </div>
      </SectionCard>

      {/* Capacity */}
      <SectionCard title='Bookings per time slot' icon={UsersRound}>
        <div className='flex items-center justify-between gap-3'>
          <div className='flex-1 min-w-0'>
            <p className='text-xs text-muted-foreground leading-relaxed'>
              How many customers can book the same time slot. Use 1 for a solo barber, more if you have multiple chairs.
            </p>
          </div>
          <div className='flex items-center gap-2 shrink-0'>
            <button
              type='button'
              disabled={!canManage || maxBookings <= 1}
              onClick={() => setMaxBookings((n) => Math.max(1, n - 1))}
              className='h-10 w-10 rounded-xl border border-border bg-white flex items-center justify-center text-foreground hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
              aria-label='Decrease'
            >
              <Minus size={14} />
            </button>
            <span className='w-8 text-center text-lg font-bold text-foreground tabular-nums'>{maxBookings}</span>
            <button
              type='button'
              disabled={!canManage || maxBookings >= 20}
              onClick={() => setMaxBookings((n) => Math.min(20, n + 1))}
              className='h-10 w-10 rounded-xl border border-border bg-white flex items-center justify-center text-foreground hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
              aria-label='Increase'
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </SectionCard>

      {message && <Banner type={message.type === 'success' ? 'success' : 'error'} message={message.text} />}

      <Button
        disabled={!canManage || isSaving || !isValid}
        onClick={() => onSave({ weekdays, start_time: startTime, end_time: endTime, max_bookings: maxBookings })}
        variant='gradient'
        className='rounded-xl w-full'
      >
        {isSaving ? 'Saving…' : 'Save availability'}
      </Button>

      {!canManage && <Banner type='warning' message='Save your shop profile first.' />}
    </div>
  );
}

/* ─── Categories editor ─── */

function CategoriesEditor({ categories, selectedIds, onChange }: {
  categories: Category[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (popRef.current && !popRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = useMemo(
    () => categories.filter((c) => selectedIds.includes(c.id)),
    [categories, selectedIds],
  );
  const remaining = useMemo(
    () => categories.filter((c) => !selectedIds.includes(c.id)),
    [categories, selectedIds],
  );
  const q = search.trim().toLowerCase();
  const filtered = q
    ? remaining.filter((c) => c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q))
    : remaining;

  function add(id: number) {
    onChange([...selectedIds, id]);
    setSearch('');
  }
  function removeId(id: number) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  return (
    <EditableCard
      title='Categories'
      icon={Tag}
      isEditing={editing}
      onEdit={() => setEditing(true)}
      onCancel={() => { setEditing(false); setOpen(false); setSearch(''); }}
    >
      {!editing && selected.length === 0 ? (
        <p className='text-xs text-muted-foreground italic'>No categories selected — tap Edit to add.</p>
      ) : (
        <div className='flex flex-wrap gap-1.5'>
          {selected.map((cat) => (
            <span
              key={cat.id}
              className='inline-flex items-center gap-1 rounded-full bg-brand-peach/40 border border-brand-tan/30 px-2.5 py-1 text-[11px] font-semibold text-brand-ink'
              title={cat.description || undefined}
            >
              {cat.name}
              {editing && (
                <button
                  type='button'
                  onClick={() => removeId(cat.id)}
                  className='-mr-1 ml-0.5 h-4 w-4 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-brand-ink'
                  aria-label={`Remove ${cat.name}`}
                >
                  <X size={9} strokeWidth={3} />
                </button>
              )}
            </span>
          ))}

          {editing && (
            <div className='relative' ref={popRef}>
              <button
                type='button'
                onClick={() => setOpen((v) => !v)}
                disabled={remaining.length === 0}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  open
                    ? 'border-brand-ink bg-brand-ink/5 text-brand-ink'
                    : 'border-border bg-white text-foreground hover:bg-muted/30 hover:border-brand-sage/40',
                  remaining.length === 0 && 'opacity-40 cursor-not-allowed',
                )}
              >
                <Plus size={11} strokeWidth={3} />
                Add
              </button>

              {open && (
                <div className='absolute z-30 mt-1.5 left-0 w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-white shadow-lg overflow-hidden'>
                  <div className='p-2 border-b border-border'>
                    <div className='relative'>
                      <Search size={12} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none' />
                      <input
                        autoFocus
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder='Search categories…'
                        className='w-full h-8 rounded-lg border border-border pl-7 pr-2 text-xs focus:outline-none focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20'
                      />
                    </div>
                  </div>
                  <div className='max-h-56 overflow-y-auto'>
                    {filtered.length === 0 ? (
                      <p className='px-3 py-4 text-xs text-muted-foreground text-center'>
                        {remaining.length === 0 ? 'All categories selected' : 'No matches'}
                      </p>
                    ) : filtered.map((cat) => (
                      <button
                        key={cat.id}
                        type='button'
                        onClick={() => add(cat.id)}
                        className='w-full text-left px-3 py-2 hover:bg-muted/40 transition-colors border-b border-border/40 last:border-b-0'
                      >
                        <p className='text-xs font-semibold text-foreground'>{cat.name}</p>
                        {cat.description && <p className='text-[10px] text-muted-foreground truncate'>{cat.description}</p>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {editing && (
        <p className='mt-2 text-[10px] text-muted-foreground'>
          {selected.length} selected · at least 1 required
        </p>
      )}
    </EditableCard>
  );
}

/* ─── Helpers ─── */
function createServiceDraft(): ServiceDraft {
  return { id: createDraftId(), name: '', price: '', duration_minutes: '30', tags: '', description: '' };
}
function createStaffDraft(): StaffDraft {
  return { id: createDraftId(), name: '', bio: '', avatar_url: '' };
}
function createImageDraft(): ImageDraft {
  return { id: createDraftId(), url: '' };
}
function createDraftId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function composeServiceDescription(description: string, tags: string) {
  const d = description.trim();
  const t = tags.split(',').map((x) => x.trim()).filter(Boolean);
  if (!t.length) return d || null;
  return [d, `Tags: ${t.join(', ')}`].filter(Boolean).join('\n\n');
}
function parseServiceTags(description?: string | null) {
  const match = description?.match(/Tags:\s*(.+)$/im);
  return match ? match[1].split(',').map((t) => t.trim()).filter(Boolean) : [];
}
function parseCoordinates(value: string): { lat: string; lng: string } | null {
  const patterns = [/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/, /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/, /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, /(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/];
  for (const p of patterns) {
    const m = value.trim().match(p);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat: lat.toFixed(6), lng: lng.toFixed(6) };
  }
  return null;
}
