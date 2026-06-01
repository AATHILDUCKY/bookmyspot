'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Crosshair, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

const Inner = dynamic(() => import('./MapLocationPicker.inner'), {
  ssr: false,
  loading: () => (
    <div className='h-[280px] rounded-xl border border-border bg-muted/30 flex items-center justify-center'>
      <p className='text-xs text-muted-foreground'>Loading map…</p>
    </div>
  ),
});

interface Props {
  value: { lat: number; lng: number } | null;
  onChange: (next: { lat: number; lng: number }) => void;
  height?: number;
  /** Initial map center when no value. Defaults to Colombo. */
  fallbackCenter?: { lat: number; lng: number };
}

export function MapLocationPicker({ value, onChange, height, fallbackCenter }: Props) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function useCurrent() {
    if (!navigator.geolocation) {
      setMessage('Geolocation is not supported on this device.');
      return;
    }
    setBusy(true);
    setMessage('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          lat: +pos.coords.latitude.toFixed(6),
          lng: +pos.coords.longitude.toFixed(6),
        });
        setMessage('Pin moved to your current location.');
        setBusy(false);
      },
      (err) => {
        setMessage(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied — pin manually on the map.'
            : 'Could not access location — pin manually on the map.',
        );
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <div className='space-y-2'>
      <Inner value={value} onChange={onChange} height={height} fallbackCenter={fallbackCenter} />

      <div className='flex flex-wrap items-center gap-2'>
        <button
          type='button'
          onClick={useCurrent}
          disabled={busy}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 h-9 text-[11px] font-semibold transition-colors',
            'hover:bg-muted/40 disabled:opacity-60',
          )}
        >
          <Crosshair size={12} className='text-brand-sage' />
          Use my location
        </button>

        {value ? (
          <span className='inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 h-9 text-[11px] font-semibold text-emerald-700'>
            <MapPin size={11} />
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
        ) : (
          <span className='text-[11px] text-muted-foreground'>
            Tap the map to drop a pin · drag the pin to fine-tune
          </span>
        )}
      </div>

      {message && <p className='text-[11px] text-muted-foreground'>{message}</p>}
    </div>
  );
}
