'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet default marker icons break in webpack bundlers — point to CDN once.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  value: { lat: number; lng: number } | null;
  onChange: (next: { lat: number; lng: number }) => void;
  /** Initial center if no value is set yet. Defaults to Colombo, Sri Lanka. */
  fallbackCenter?: { lat: number; lng: number };
  height?: number;
}

function ClickHandler({ onChange }: { onChange: Props['onChange'] }) {
  useMapEvents({
    click: (e) => onChange({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }),
  });
  return null;
}

function Recenter({ value }: { value: Props['value'] }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.flyTo([value.lat, value.lng], Math.max(map.getZoom(), 15), { duration: 0.5 });
  }, [value, map]);
  return null;
}

function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    const fire = () => map.invalidateSize({ animate: false });
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

export default function MapLocationPickerInner({ value, onChange, fallbackCenter, height = 280 }: Props) {
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(value);

  useEffect(() => { setMarker(value); }, [value?.lat, value?.lng]);

  const center: [number, number] = useMemo(() => {
    if (marker) return [marker.lat, marker.lng];
    if (value) return [value.lat, value.lng];
    if (fallbackCenter) return [fallbackCenter.lat, fallbackCenter.lng];
    return [6.9271, 79.8612]; // Colombo
  }, [marker, value, fallbackCenter]);

  function handle(next: { lat: number; lng: number }) {
    setMarker(next);
    onChange(next);
  }

  return (
    <div className='rounded-xl overflow-hidden border border-border' style={{ height }}>
      <MapContainer
        center={center}
        zoom={marker ? 15 : 11}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          attribution='&copy; OpenStreetMap contributors'
        />
        <InvalidateOnMount />
        <ClickHandler onChange={handle} />
        <Recenter value={marker} />
        {marker && (
          <Marker
            position={[marker.lat, marker.lng]}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                handle({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
