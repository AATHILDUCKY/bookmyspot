'use client';

import dynamic from 'next/dynamic';
import type { NearbyShop } from '@/lib/hooks/useNearbyShops';

const Inner = dynamic(() => import('./NearbyShopsMap.inner'), {
  ssr: false,
  loading: () => (
    <div className='h-[460px] rounded-2xl border border-border bg-muted/30 flex items-center justify-center'>
      <p className='text-sm text-muted-foreground'>Loading map…</p>
    </div>
  ),
});

interface Props {
  center: { lat: number; lng: number };
  radiusKm: number;
  shops: NearbyShop[];
  height?: number;
  onLocate?: () => void;
}

/** Leaflet map of nearby shops within a radius. Client-only (no SSR). */
export function NearbyShopsMap(props: Props) {
  return <Inner {...props} />;
}
