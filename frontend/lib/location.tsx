'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Coordinates } from '@/lib/distance';

export type LocationStatus =
  | 'idle'        // never requested, no cached position
  | 'loading'     // a GPS read is in flight
  | 'ready'       // we have coordinates (live, cached, or manual)
  | 'blocked'     // permission denied
  | 'unsupported' // navigator.geolocation missing
  | 'unavailable';// position could not be determined

const STORAGE_KEY = 'bms.geo';
/** App-level reuse: coords newer than this are returned without a new read. */
const FRESH_MS = 2 * 60 * 1000;
/** Persisted coords older than this are ignored on load (shown only as a hint). */
const STALE_MS = 30 * 60 * 1000;
/** Stop refining early once a reading is at least this accurate (metres). */
const ACCURACY_TARGET_M = 50;
/** How long to let GPS refine before taking the best sample so far (ms). */
const REFINE_BUDGET_MS = 8_000;
/** Above this, a fix is almost certainly WiFi/IP-based, not real GPS (metres). */
export const LOW_ACCURACY_M = 5_000;

interface StoredCoords extends Coordinates {
  ts: number;
  accuracy: number | null;
}

interface LocationContextValue {
  coords: Coordinates | null;
  /** Radius of the fix in metres (lower = better); null when unknown/manual. */
  accuracy: number | null;
  status: LocationStatus;
  /** When the current coords were captured (ms epoch), or null. */
  updatedAt: number | null;
  /**
   * Ensure we have a position. Resolves immediately with coords still fresh;
   * otherwise takes a current GPS reading (never the browser's stale cache) and
   * refines it briefly for accuracy. Concurrent calls share one read.
   */
  request: (opts?: { force?: boolean }) => Promise<Coordinates | null>;
  /** Set coords manually (e.g. user pasted a map link); accuracy is exact. */
  setManual: (c: Coordinates) => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

interface Reading {
  coords: Coordinates;
  accuracy: number;
}

/**
 * Take a current position, refining via watchPosition: keep the most accurate
 * sample seen within the budget, stopping early once it's good enough. Always
 * uses maximumAge:0 so the browser can't replay a stale cross-network fix.
 */
function readFreshPosition(): Promise<{ reading: Reading | null; errorCode: number | null }> {
  return new Promise((resolve) => {
    let best: Reading | null = null;
    let settled = false;

    const finish = (errorCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      navigator.geolocation.clearWatch(watchId);
      resolve({ reading: best, errorCode });
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const accuracy = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : Infinity;
        if (!best || accuracy < best.accuracy) {
          best = { coords: { lat: pos.coords.latitude, lng: pos.coords.longitude }, accuracy };
        }
        if (accuracy <= ACCURACY_TARGET_M) finish(null);
      },
      (err) => {
        // Keep any sample we already gathered; only report the error if we have none.
        finish(best ? null : err.code);
      },
      { enableHighAccuracy: true, timeout: REFINE_BUDGET_MS, maximumAge: 0 },
    );

    const timer = setTimeout(() => finish(null), REFINE_BUDGET_MS);
  });
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const inflight = useRef<Promise<Coordinates | null> | null>(null);

  const persist = useCallback((c: Coordinates, acc: number | null) => {
    const ts = Date.now();
    setCoords(c);
    setAccuracy(acc);
    setUpdatedAt(ts);
    setStatus('ready');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...c, accuracy: acc, ts } satisfies StoredCoords));
    } catch {
      /* storage full / unavailable — keep in-memory copy */
    }
  }, []);

  const request = useCallback<LocationContextValue['request']>(
    (opts) => {
      const force = opts?.force ?? false;

      // App-level reuse: skip a new read when our own fix is still fresh.
      if (!force && coords && updatedAt && Date.now() - updatedAt < FRESH_MS) {
        return Promise.resolve(coords);
      }
      // Collapse concurrent requests into one read.
      if (inflight.current) return inflight.current;

      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setStatus('unsupported');
        return Promise.resolve(null);
      }

      setStatus('loading');
      const p = readFreshPosition()
        .then(({ reading, errorCode }) => {
          if (reading) {
            persist(reading.coords, Number.isFinite(reading.accuracy) ? reading.accuracy : null);
            return reading.coords;
          }
          setStatus(
            errorCode === 1 /* PERMISSION_DENIED */ ? 'blocked' : 'unavailable',
          );
          return null;
        })
        .finally(() => {
          inflight.current = null;
        });

      inflight.current = p;
      return p;
    },
    [coords, updatedAt, persist],
  );

  // Keep the latest `request` reachable from the mount-only effect below
  // without retriggering it (force reads don't depend on the closure's state).
  const requestRef = useRef(request);
  requestRef.current = request;

  // Runs exactly once per page load: hydrate the last-known position for an
  // instant paint, then — only if permission is already granted — silently
  // re-read to correct a stale fix. So a refresh self-corrects without a prompt.
  useEffect(() => {
    // Refresh unless the cached fix is both recent and high-accuracy.
    let needsRefresh = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as StoredCoords;
        const age = Date.now() - saved.ts;
        if (Number.isFinite(saved.lat) && Number.isFinite(saved.lng) && age < STALE_MS) {
          setCoords({ lat: saved.lat, lng: saved.lng });
          setAccuracy(saved.accuracy ?? null);
          setUpdatedAt(saved.ts);
          setStatus('ready');
          const accurate = saved.accuracy != null && saved.accuracy <= LOW_ACCURACY_M;
          if (age < FRESH_MS && accurate) needsRefresh = false;
        }
      }
    } catch {
      /* corrupt storage — ignore */
    }

    if (!needsRefresh) return;
    navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((perm) => {
        if (perm.state === 'granted') requestRef.current({ force: true });
      })
      .catch(() => {
        /* Permissions API unavailable — wait for an explicit user gesture. */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setManual = useCallback((c: Coordinates) => persist(c, null), [persist]);

  return (
    <LocationContext.Provider value={{ coords, accuracy, status, updatedAt, request, setManual }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within a LocationProvider');
  return ctx;
}
