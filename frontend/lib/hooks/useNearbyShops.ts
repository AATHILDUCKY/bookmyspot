'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Lean marker payload returned by GET /saloons/nearby. */
export interface NearbyShop {
  id: number;
  name: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  cover_image?: string | null;
  is_open: boolean;
  avg_rating: number;
  min_price?: number | string | null;
  distance_km: number;
}

interface Params {
  lat?: number;
  lng?: number;
  radius_km: number;
  category?: string;
  q?: string;
  /** Only fire once we actually have coordinates. */
  enabled?: boolean;
}

export function useNearbyShops({ lat, lng, radius_km, category, q, enabled = true }: Params) {
  return useQuery({
    queryKey: ['saloons-nearby', { lat, lng, radius_km, category, q }],
    enabled: enabled && lat != null && lng != null,
    queryFn: async () =>
      (await api.get<NearbyShop[]>('/saloons/nearby', {
        params: { lat, lng, radius_km, category: category || undefined, q: q || undefined },
      })).data,
  });
}
