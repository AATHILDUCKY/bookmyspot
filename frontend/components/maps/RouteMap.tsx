'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Navigation, Route as RouteIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Inner = dynamic(() => import('./RouteMap.inner'), {
  ssr: false,
  loading: () => (
    <div className='h-full w-full flex items-center justify-center bg-muted/30'>
      <p className='text-xs text-muted-foreground'>Loading map…</p>
    </div>
  ),
});

interface Point { lat: number; lng: number }
interface OsrmRoute {
  route: [number, number][];
  distance_km: number;
  duration_min: number;
}

/**
 * Fetch a driving route from OSRM's free public demo server.
 *
 * Endpoint:
 *   https://router.project-osrm.org/route/v1/{profile}/{lon,lat;lon,lat}?overview=full&geometries=geojson
 *
 * The "full" overview returns one polyline of all road segments. We cache the
 * result per (from, to) tuple via React Query so re-opens are instant and we
 * stay polite to the public server. For production traffic, self-host OSRM
 * (Docker image: `osrm/osrm-backend`) — it's GPL'd open source.
 */
async function fetchRoute(from: Point, to: Point): Promise<OsrmRoute | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=false&steps=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Routing service is unavailable');
  const json = await res.json();
  const r = json?.routes?.[0];
  if (!r) return null;
  const coords: [number, number][] = (r.geometry?.coordinates ?? []).map(
    ([lng, lat]: [number, number]) => [lat, lng],
  );
  return {
    route: coords,
    distance_km: Math.round((r.distance / 1000) * 10) / 10,
    duration_min: Math.round(r.duration / 60),
  };
}

interface Props {
  from: Point;
  to: Point;
  destinationName?: string;
  onClose: () => void;
}

export function RouteMapModal({ from, to, destinationName, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { data, isLoading, isError } = useQuery<OsrmRoute | null>({
    queryKey: ['osrm-route', from.lat, from.lng, to.lat, to.lng],
    queryFn: () => fetchRoute(from, to),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  function openExternal() {
    // Fallback: open the customer's preferred maps app for turn-by-turn voice.
    window.open(
      `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${from.lat}%2C${from.lng}%3B${to.lat}%2C${to.lng}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  return (
    <div className='fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in'>
      <div className='absolute inset-0 bg-black/55 backdrop-blur-sm' onClick={onClose} />
      <div className='relative w-full sm:max-w-2xl bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]'>

        {/* Header */}
        <div className='flex items-center justify-between px-5 py-3 border-b border-border bg-gradient-to-r from-brand-peach/30 to-white'>
          <div className='flex items-center gap-2.5'>
            <div className='h-9 w-9 rounded-2xl bg-brand-ink flex items-center justify-center'>
              <RouteIcon size={15} className='text-brand-peach' />
            </div>
            <div>
              <p className='text-[10px] font-semibold uppercase tracking-widest text-brand-sage'>Get directions</p>
              <p className='text-sm font-bold text-foreground truncate max-w-[180px] sm:max-w-xs'>
                {destinationName || 'Destination'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className='h-8 w-8 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors'>
            <X size={14} />
          </button>
        </div>

        {/* Stats strip */}
        <div className='px-5 py-3 border-b border-border bg-white flex items-center gap-3 text-xs'>
          {isLoading ? (
            <span className='text-muted-foreground'>Calculating best route…</span>
          ) : isError || !data ? (
            <span className='text-red-600'>Could not compute a road route. Showing straight-line preview.</span>
          ) : (
            <>
              <span className='inline-flex items-center gap-1 font-semibold text-foreground'>
                <RouteIcon size={12} className='text-brand-sage' />
                {data.distance_km.toFixed(1)} km
              </span>
              <span className='inline-flex items-center gap-1 font-semibold text-foreground'>
                <Clock size={12} className='text-brand-sage' />
                {data.duration_min < 60
                  ? `${data.duration_min} min`
                  : `${Math.floor(data.duration_min / 60)}h ${data.duration_min % 60}m`}
              </span>
              <span className='ml-auto text-[10px] text-muted-foreground'>
                via OSRM · OpenStreetMap
              </span>
            </>
          )}
        </div>

        {/* Map — explicit height so Leaflet measures correctly even before
            the parent flex layout settles. */}
        <div className='relative w-full h-[55vh] min-h-[360px] max-h-[640px]'>
          <Inner from={from} to={to} route={data?.route ?? null} />
        </div>

        {/* Footer */}
        <div className='px-5 py-3 border-t border-border bg-white flex gap-2'>
          <button
            onClick={openExternal}
            className='flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-xl border border-border bg-white text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors'
          >
            <Navigation size={14} />
            Open in OSM
          </button>
          <button
            onClick={onClose}
            className={cn(
              'flex-1 inline-flex items-center justify-center h-11 rounded-xl text-sm font-semibold text-white',
              'bg-gradient-to-r from-brand-ink to-[#2a2724] hover:opacity-90 transition-opacity',
            )}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
