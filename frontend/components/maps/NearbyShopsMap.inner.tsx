'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { MapContainer, Circle, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin, Scissors, Star } from 'lucide-react';
import type { NearbyShop } from '@/lib/hooks/useNearbyShops';
import { saloonHref } from '@/lib/slug';

// Leaflet default marker icons break under bundlers — point them at the CDN.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const INK = '#1f1f1f';
const SAGE = '#8f917c';

interface Props {
  center: { lat: number; lng: number };
  radiusKm: number;
  shops: NearbyShop[];
  height?: number;
  /** Re-request the device location (e.g. when the locate button is tapped). */
  onLocate?: () => void;
}

function formatPrice(p: NearbyShop['min_price']): string | null {
  if (p == null) return null;
  const n = typeof p === 'string' ? parseFloat(p) : p;
  if (!isFinite(n)) return null;
  return `Rs ${Math.round(n).toLocaleString()}`;
}

// White scissors glyph (lucide) sitting inside the pin head.
const SCISSORS_PATH = '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>';

// Modern teardrop location pin with the brand scissors glyph. Tip anchors on
// the true coordinate; closed shops render muted.
function shopIcon(shop: NearbyShop): L.DivIcon {
  const bg = shop.is_open ? INK : '#9ca3af';
  const w = 40;
  const h = 50;
  return L.divIcon({
    className: '',
    html: `<div style="width:${w}px;height:${h}px;filter:drop-shadow(0 5px 7px rgba(28,25,23,.4))">
      <svg width="${w}" height="${h}" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 49C20 49 37 30 37 17A17 17 0 1 0 3 17C3 30 20 49 20 49Z" fill="${bg}" stroke="#fff" stroke-width="2.5"/>
        <circle cx="20" cy="17" r="11.5" fill="rgba(255,255,255,.16)"/>
        <g transform="translate(11 8) scale(0.75)" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none">${SCISSORS_PATH}</g>
      </svg>
    </div>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h - 1],
    popupAnchor: [0, -h + 6],
  });
}

const meIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:22px;height:22px">
    <div style="position:absolute;inset:0;border-radius:9999px;background:rgba(37,99,235,.25);animation:bms-pulse 2s ease-out infinite"></div>
    <div style="position:absolute;inset:5px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>
  </div>
  <style>@keyframes bms-pulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.2);opacity:0}}</style>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

/** Re-measure after the container animates in (otherwise tiles never paint). */
function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    const fire = () => map.invalidateSize({ animate: false });
    const timers = [setTimeout(fire, 50), setTimeout(fire, 250), setTimeout(fire, 600)];
    window.addEventListener('resize', fire);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', fire);
    };
  }, [map]);
  return null;
}

/** Keep the whole radius circle framed when centre or radius changes. */
function FitToRadius({ center, radiusKm }: { center: Props['center']; radiusKm: number }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLng(center.lat, center.lng).toBounds(radiusKm * 2000);
    map.fitBounds(bounds, { padding: [28, 28] });
  }, [center.lat, center.lng, radiusKm, map]);
  return null;
}

export default function NearbyShopsMapInner({ center, radiusKm, shops, height = 460, onLocate }: Props) {
  const c: [number, number] = useMemo(() => [center.lat, center.lng], [center.lat, center.lng]);
  const mapRef = useRef<L.Map | null>(null);

  const recenter = () => {
    const map = mapRef.current;
    if (map) map.flyTo(c, Math.max(map.getZoom(), 14), { duration: 0.6 });
    onLocate?.();
  };

  return (
    <div className='relative rounded-2xl overflow-hidden border border-border' style={{ height }}>
      <MapContainer ref={mapRef} center={c} zoom={13} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          attribution='&copy; OpenStreetMap contributors'
        />
        <InvalidateOnMount />
        <FitToRadius center={center} radiusKm={radiusKm} />

        <Circle
          center={c}
          radius={radiusKm * 1000}
          pathOptions={{ color: SAGE, weight: 1.5, fillColor: SAGE, fillOpacity: 0.08 }}
        />
        <Marker position={c} icon={meIcon} />

        {shops.map((shop) => (
          <Marker key={shop.id} position={[shop.lat, shop.lng]} icon={shopIcon(shop)}>
            <Popup className='bms-popup' minWidth={232} maxWidth={232} autoPan>
              {/* Image header with open/closed status badge */}
              <div style={{ position: 'relative', height: 96, background: 'linear-gradient(135deg,#ebdbd3,#bac8e0)' }}>
                {shop.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shop.cover_image} alt={shop.name} style={{ height: '100%', width: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Scissors size={26} color='rgba(31,31,31,.45)' />
                  </div>
                )}
                <span style={{
                  position: 'absolute', top: 8, left: 8, display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: '#fff',
                  background: shop.is_open ? '#16a34a' : '#6b7280', boxShadow: '0 2px 6px rgba(0,0,0,.25)',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: '#fff' }} />
                  {shop.is_open ? 'Open now' : 'Closed'}
                </span>
              </div>

              {/* Body */}
              <div style={{ padding: '11px 13px 13px' }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 15, lineHeight: 1.25, color: INK }}>{shop.name}</p>
                <p style={{ margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b6660' }}>
                  <MapPin size={12} color={SAGE} /> {shop.city}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '9px 0 10px', flexWrap: 'wrap' }}>
                  {shop.avg_rating > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: INK, background: '#fff7e6', border: '1px solid #fde9b8', padding: '3px 8px', borderRadius: 999 }}>
                      <Star size={11} fill='#f5b301' stroke='#f5b301' /> {shop.avg_rating.toFixed(1)}
                    </span>
                  )}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: SAGE, background: 'rgba(143,145,124,.12)', padding: '3px 8px', borderRadius: 999 }}>
                    <MapPin size={11} /> {shop.distance_km} km
                  </span>
                  {formatPrice(shop.min_price) && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: INK, background: '#f1efe9', padding: '3px 8px', borderRadius: 999 }}>
                      From {formatPrice(shop.min_price)}
                    </span>
                  )}
                </div>

                <Link
                  href={saloonHref(shop)}
                  style={{
                    display: 'block', textAlign: 'center', background: 'linear-gradient(135deg,#1f1f1f,#2a2724)',
                    color: '#fff', textDecoration: 'none', fontSize: 12.5, fontWeight: 700,
                    padding: '9px 14px', borderRadius: 12, boxShadow: '0 4px 12px rgba(31,31,31,.25)',
                  }}
                >
                  View shop →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Locate / recenter control — flies back to the user's location. */}
      <button
        type='button'
        onClick={recenter}
        aria-label='Center on my location'
        title='Center on my location'
        className='absolute right-3 top-3 z-[1000] h-11 w-11 rounded-xl bg-white border border-border shadow-md flex items-center justify-center text-brand-ink hover:bg-muted/50 active:scale-95 transition-all'
      >
        <LocateFixed size={20} strokeWidth={2.2} />
      </button>
    </div>
  );
}
