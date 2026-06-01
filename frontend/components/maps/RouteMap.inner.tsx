'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Point { lat: number; lng: number }

interface Props {
  from: Point;
  to: Point;
  route: [number, number][] | null;
}

function FitBounds({ from, to, route }: Props) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = route && route.length > 1
      ? route
      : [[from.lat, from.lng], [to.lat, to.lng]];
    const bounds = L.latLngBounds(pts);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [from.lat, from.lng, to.lat, to.lng, route, map]);
  return null;
}

/**
 * Force Leaflet to re-measure its container after the modal animates in.
 * Without this, the map container can have 0 height during init, so tiles
 * never paint and shapes appear in an empty white area (the reported bug).
 */
function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    const fire = () => map.invalidateSize({ animate: false });
    // Cover modal entry animation, font load, and any layout shifts.
    const t1 = setTimeout(fire, 50);
    const t2 = setTimeout(fire, 250);
    const t3 = setTimeout(fire, 600);
    window.addEventListener('resize', fire);
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      window.removeEventListener('resize', fire);
    };
  }, [map]);
  return null;
}

const fromIcon = L.divIcon({
  className: '',
  html: `<div style="background:#10b981;border:3px solid white;border-radius:9999px;width:18px;height:18px;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});
const toIcon = L.divIcon({
  className: '',
  html: `<div style="background:#1f1b18;border:3px solid white;border-radius:9999px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4);color:white;font-weight:700;font-size:11px;line-height:1">★</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export default function RouteMapInner({ from, to, route }: Props) {
  const center: [number, number] = useMemo(() => [
    (from.lat + to.lat) / 2,
    (from.lng + to.lng) / 2,
  ], [from.lat, from.lng, to.lat, to.lng]);

  return (
    <MapContainer center={center} zoom={13} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        attribution='&copy; OpenStreetMap contributors'
      />
      <InvalidateOnMount />
      <FitBounds from={from} to={to} route={route} />
      <Marker position={[from.lat, from.lng]} icon={fromIcon} />
      <Marker position={[to.lat, to.lng]} icon={toIcon} />
      {route && route.length > 1 && (
        <>
          {/* Glow underneath */}
          <Polyline positions={route} pathOptions={{ color: '#1f1b18', weight: 9, opacity: 0.15 }} />
          {/* Main route line */}
          <Polyline positions={route} pathOptions={{ color: '#1f1b18', weight: 5, opacity: 0.95 }} />
        </>
      )}
    </MapContainer>
  );
}
