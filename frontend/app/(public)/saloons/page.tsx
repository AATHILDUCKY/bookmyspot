'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, Map as MapIcon, MapPin, Navigation, Search, SlidersHorizontal, X } from 'lucide-react';
import { useSaloons } from '@/lib/hooks/useSaloons';
import { useNearbyShops, type NearbyShop } from '@/lib/hooks/useNearbyShops';
import { useLocation } from '@/lib/location';
import type { CategorySuggestion, ShopSuggestion } from '@/lib/hooks/useSearchSuggest';
import { SaloonCard } from '@/components/shared/SaloonCard';
import { SearchAutocomplete } from '@/components/search/SearchAutocomplete';
import { NearbyShopsMap } from '@/components/maps/NearbyShopsMap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { saloonHref } from '@/lib/slug';
import { Category } from '@/types';
import { cn } from '@/lib/utils';

const RADIUS_PRESETS = [5, 10, 15, 20];

const SORT_OPTIONS = [
  { value: 'rating', label: 'Top rated' },
  { value: 'distance', label: 'Nearest' },
  { value: 'newest', label: 'Newest' },
];

export default function SaloonsPage() {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [service, setService] = useState('');
  const [sort, setSort] = useState('rating');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCategorySlugs, setSelectedCategorySlugs] = useState<string[]>([]);
  const [radiusKm, setRadiusKm] = useState<number | null>(null); // null = any distance
  const [view, setView] = useState<'list' | 'map'>('list');
  const [mapRadiusKm, setMapRadiusKm] = useState(5); // map defaults to a 5 km radius

  // Shared, persisted location store — reused across the app, no per-mount GPS spin.
  const { coords: storeCoords, status: locStatus, request } = useLocation();
  const coords: { lat?: number; lng?: number } = storeCoords ?? {};
  const locating = locStatus === 'loading';

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/categories')).data,
  });

  const { data, isLoading } = useSaloons({
    q,
    city,
    service,
    sort,
    lat: coords.lat,
    lng: coords.lng,
    category: selectedCategorySlugs.join(',') || undefined,
    max_distance_km: radiusKm && coords.lat ? radiusKm : undefined,
    page: 1,
    limit: 20,
  });

  // Map view pulls every shop inside the radius (unpaginated) from /saloons/nearby.
  const { data: nearbyShops = [], isLoading: nearbyLoading } = useNearbyShops({
    lat: coords.lat,
    lng: coords.lng,
    radius_km: mapRadiusKm,
    category: selectedCategorySlugs.join(',') || undefined,
    q: q || undefined,
    enabled: view === 'map',
  });

  const router = useRouter();

  function toggleCategory(slug: string) {
    setSelectedCategorySlugs((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]);
  }

  // ── Search-suggestion selection handlers ─────────────────────────────
  const selectShop = (s: ShopSuggestion) => router.push(saloonHref({ id: s.id, name: s.name }));
  const selectService = (name: string) => { setService(name); setQ(''); };
  const selectCategory = (c: CategorySuggestion) => {
    setSelectedCategorySlugs((prev) => (prev.includes(c.slug) ? prev : [...prev, c.slug]));
    setQ('');
  };
  const selectCity = (c: string) => { setCity(c); setQ(''); };

  // Shared props so the mobile and desktop search boxes behave identically.
  const suggestProps = {
    value: q,
    onChange: setQ,
    onSelectShop: selectShop,
    onSelectService: selectService,
    onSelectCategory: selectCategory,
    onSelectCity: selectCity,
    onSubmit: setQ,
  };

  // Resolve a shared location, then let the caller react once coords land.
  const requestLocation = (onDone?: (c: { lat: number; lng: number }) => void) => {
    request().then((c) => { if (c) onDone?.(c); });
  };

  const useMyLocation = () => {
    requestLocation(() => {
      setSort('distance');
      if (radiusKm == null) setRadiusKm(10);
    });
  };

  // Switch to the map; reuse a known position or fetch one only if we have none.
  const enterMapView = () => {
    setView('map');
    if (!coords.lat) requestLocation();
  };

  const hasFilters = Boolean(q || city || service || selectedCategorySlugs.length || radiusKm);
  const clearFilters = () => { setQ(''); setCity(''); setService(''); setSort('rating'); setSelectedCategorySlugs([]); setRadiusKm(null); };

  return (
    <div className='min-h-screen bg-gradient-to-b from-brand-peach/20 to-background'>
      {/* ─────────────────────────────────────────────────────────── */}
      {/* MOBILE / TABLET LAYOUT (unchanged) — hidden on lg+         */}
      {/* ─────────────────────────────────────────────────────────── */}
      <div className='lg:hidden'>
      {/* Sticky header */}
      <div className='bg-white border-b border-border sticky top-16 z-30'>
        <div className='mx-auto max-w-7xl px-4 py-4'>
          {/* Search bar */}
          <SearchAutocomplete {...suggestProps} placeholder='Search shops, services, categories…' />

          {/* Category chips */}
          {categories.length > 0 && (
            <div className='mt-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4'>
              {categories.map((cat) => {
                const active = selectedCategorySlugs.includes(cat.slug);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.slug)}
                    className={cn(
                      'shrink-0 h-8 rounded-full border px-3 text-xs font-semibold transition-colors',
                      active
                        ? 'border-brand-ink bg-brand-ink text-white'
                        : 'border-border bg-white text-foreground hover:border-brand-sage/40',
                    )}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Filter row */}
          <div className='mt-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none'>
            <ViewToggle view={view} onList={() => setView('list')} onMap={enterMapView} />

            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(
                'shrink-0 inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                filtersOpen
                  ? 'border-brand-sage bg-brand-peach/40 text-brand-ink'
                  : 'border-border bg-white text-foreground hover:border-brand-sage/40',
              )}
            >
              <SlidersHorizontal size={13} />
              Filters {hasFilters && '·'}
            </button>

            {/* Sort pills */}
            {SORT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSort(value)}
                className={cn(
                  'shrink-0 h-9 rounded-full border px-3.5 text-xs font-medium transition-colors',
                  sort === value
                    ? 'border-brand-ink bg-brand-ink text-white'
                    : 'border-border bg-white text-foreground hover:border-brand-sage/40',
                )}
              >
                {label}
              </button>
            ))}

            <button
              onClick={useMyLocation}
              className={cn(
                'shrink-0 inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ml-auto',
                coords.lat
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-border bg-white hover:border-brand-sage/40',
              )}
            >
              <MapPin size={13} />
              {coords.lat ? 'Located' : 'Near me'}
            </button>
          </div>

          {/* Radius presets — only appear once GPS is captured (list view; map has its own) */}
          {coords.lat && view === 'list' && (
            <div className='mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none'>
              <span className='text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0 mr-1'>
                Within
              </span>
              {RADIUS_PRESETS.map((km) => {
                const active = radiusKm === km;
                return (
                  <button
                    key={km}
                    onClick={() => setRadiusKm(km)}
                    className={cn(
                      'shrink-0 h-8 rounded-full border px-3 text-[11px] font-semibold transition-colors',
                      active
                        ? 'border-brand-ink bg-brand-ink text-white'
                        : 'border-border bg-white text-foreground hover:border-brand-sage/40',
                    )}
                  >
                    {km} km
                  </button>
                );
              })}
              <button
                onClick={() => setRadiusKm(null)}
                className={cn(
                  'shrink-0 h-8 rounded-full border px-3 text-[11px] font-semibold transition-colors',
                  radiusKm == null
                    ? 'border-brand-ink bg-brand-ink text-white'
                    : 'border-border bg-white text-foreground hover:border-brand-sage/40',
                )}
              >
                Any
              </button>
            </div>
          )}

          {/* Expanded filters */}
          {filtersOpen && (
            <div className='mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 animate-fade-in'>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder='City' className='h-10 text-sm rounded-xl' />
              <Input value={service} onChange={(e) => setService(e.target.value)} placeholder='Service' className='h-10 text-sm rounded-xl' />
              {hasFilters && (
                <button onClick={clearFilters} className='h-10 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors'>
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className='mx-auto max-w-7xl px-4 py-6'>
        {view === 'map' ? (
          <MapPanel
            coords={coords}
            radiusKm={mapRadiusKm}
            onRadius={setMapRadiusKm}
            shops={nearbyShops}
            loading={nearbyLoading}
            locating={locating}
            onEnableLocation={() => requestLocation()}
          />
        ) : (
        <>
        {!isLoading && data && (
          <p className='mb-4 text-sm text-muted-foreground'>
            {data.length} shop{data.length !== 1 ? 's' : ''} found
          </p>
        )}

        {isLoading ? (
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {[1, 2, 3, 4, 6, 7, 8].map((i) => (
              <div key={i} className='rounded-2xl border overflow-hidden bg-white'>
                <Skeleton className='h-44 rounded-none' />
                <div className='p-4 space-y-2'>
                  <Skeleton className='h-4 w-3/4' />
                  <Skeleton className='h-3 w-1/2' />
                  <div className='flex gap-2 mt-3'>
                    <Skeleton className='h-5 w-16 rounded-full' />
                    <Skeleton className='h-5 w-20 rounded-full' />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : data?.length ? (
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {data.map((s) => <SaloonCard key={s.id} saloon={s} />)}
          </div>
        ) : (
          <div className='flex flex-col items-center justify-center py-20 text-center'>
            <div className='h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4'>
              <Search size={28} className='text-muted-foreground' />
            </div>
            <p className='font-semibold text-foreground'>No shops found</p>
            <p className='mt-1 text-sm text-muted-foreground'>Try a different city or clear your filters.</p>
            {hasFilters && (
              <Button variant='outline' className='mt-4 rounded-xl' onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        )}
        </>
        )}
      </div>
      </div>
      {/* ──── END mobile layout ──── */}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* DESKTOP LAYOUT (lg+)                                       */}
      {/* ─────────────────────────────────────────────────────────── */}
      <div className='hidden lg:block'>
        {/* Page header strip */}
        <div className='bg-white border-b border-border'>
          <div className='mx-auto max-w-[1500px] px-8 py-6 flex items-end justify-between gap-6'>
            <div>
              <p className='text-xs font-bold uppercase tracking-widest text-brand-sage mb-1'>Browse</p>
              <h1 className='text-3xl xl:text-4xl font-bold text-foreground leading-tight'>
                Find your perfect <span className='gradient-text'>spot</span>
              </h1>
              <p className='mt-1.5 text-sm text-muted-foreground'>
                Discover top-rated salons, mehendi artists, nail studios and more near you.
              </p>
            </div>
            {/* Big search bar */}
            <SearchAutocomplete
              {...suggestProps}
              placeholder='Search shops, services, categories…'
              wrapperClassName='w-full max-w-md'
              inputClassName='h-12'
            />
          </div>
        </div>

        {/* Body: sidebar + results */}
        <div className='mx-auto max-w-[1500px] px-8 py-8 grid grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)] gap-8'>
          {/* ── Left filter rail (sticky) ── */}
          <aside className='sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto pr-1 space-y-5'>
            {/* Sort */}
            <FilterBlock title='Sort by'>
              <div className='flex flex-col gap-1.5'>
                {SORT_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setSort(value)}
                    className={cn(
                      'flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors text-left',
                      sort === value
                        ? 'border-brand-ink bg-brand-ink text-white'
                        : 'border-border bg-white text-foreground hover:border-brand-sage/40 hover:bg-muted/30',
                    )}
                  >
                    {label}
                    {sort === value && <span className='h-1.5 w-1.5 rounded-full bg-brand-sage' />}
                  </button>
                ))}
              </div>
            </FilterBlock>

            {/* Location */}
            <FilterBlock title='Location'>
              <button
                onClick={useMyLocation}
                className={cn(
                  'w-full inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors',
                  coords.lat
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-border bg-white hover:border-brand-sage/40 hover:bg-muted/30',
                )}
              >
                <MapPin size={14} />
                {coords.lat ? 'Using my location' : 'Use my location'}
              </button>

              {coords.lat && view === 'list' && (
                <div className='mt-3'>
                  <p className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2'>Within</p>
                  <div className='flex flex-wrap gap-1.5'>
                    {RADIUS_PRESETS.map((km) => {
                      const active = radiusKm === km;
                      return (
                        <button
                          key={km}
                          onClick={() => setRadiusKm(km)}
                          className={cn(
                            'h-8 rounded-full border px-3 text-[11px] font-semibold transition-colors',
                            active
                              ? 'border-brand-ink bg-brand-ink text-white'
                              : 'border-border bg-white text-foreground hover:border-brand-sage/40',
                          )}
                        >
                          {km} km
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setRadiusKm(null)}
                      className={cn(
                        'h-8 rounded-full border px-3 text-[11px] font-semibold transition-colors',
                        radiusKm == null
                          ? 'border-brand-ink bg-brand-ink text-white'
                          : 'border-border bg-white text-foreground hover:border-brand-sage/40',
                      )}
                    >
                      Any
                    </button>
                  </div>
                </div>
              )}

              <div className='mt-3 space-y-2'>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder='City'
                  className='h-10 text-sm rounded-xl'
                />
              </div>
            </FilterBlock>

            {/* Categories */}
            {categories.length > 0 && (
              <FilterBlock
                title='Categories'
                count={selectedCategorySlugs.length || undefined}
              >
                <div className='flex flex-wrap gap-1.5'>
                  {categories.map((cat) => {
                    const active = selectedCategorySlugs.includes(cat.slug);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => toggleCategory(cat.slug)}
                        className={cn(
                          'h-8 rounded-full border px-3 text-xs font-semibold transition-colors',
                          active
                            ? 'border-brand-ink bg-brand-ink text-white'
                            : 'border-border bg-white text-foreground hover:border-brand-sage/40',
                        )}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </FilterBlock>
            )}

            {/* Service */}
            <FilterBlock title='Service'>
              <Input
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder='e.g. Mehendi, Nails'
                className='h-10 text-sm rounded-xl'
              />
            </FilterBlock>

            {/* Clear all */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className='w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors inline-flex items-center justify-center gap-2'
              >
                <X size={14} /> Clear all filters
              </button>
            )}
          </aside>

          {/* ── Right: results ── */}
          <main>
            {/* Toolbar */}
            <div className='flex items-center justify-between mb-5'>
              <div className='flex items-center gap-3'>
                {isLoading ? (
                  <Skeleton className='h-5 w-32' />
                ) : (
                  <p className='text-sm text-foreground'>
                    <span className='font-bold tabular-nums'>{data?.length ?? 0}</span>
                    <span className='text-muted-foreground'> shop{(data?.length ?? 0) !== 1 ? 's' : ''} found</span>
                  </p>
                )}
                {hasFilters && (
                  <span className='inline-flex items-center gap-1.5 rounded-full bg-brand-peach/40 border border-brand-tan/30 text-brand-ink px-2.5 py-1 text-[11px] font-semibold'>
                    Filters active
                  </span>
                )}
              </div>
              <div className='flex items-center gap-3'>
                <ViewToggle view={view} onList={() => setView('list')} onMap={enterMapView} />
                <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                  <span>Sort:</span>
                  <span className='font-semibold text-foreground'>
                    {SORT_OPTIONS.find((o) => o.value === sort)?.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Grid / Map */}
            {view === 'map' ? (
              <MapPanel
                coords={coords}
                radiusKm={mapRadiusKm}
                onRadius={setMapRadiusKm}
                shops={nearbyShops}
                loading={nearbyLoading}
                locating={locating}
                onEnableLocation={() => requestLocation()}
              />
            ) : isLoading ? (
              <div className='grid gap-5 grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className='rounded-2xl border overflow-hidden bg-white'>
                    <Skeleton className='h-52 rounded-none' />
                    <div className='p-4 space-y-2'>
                      <Skeleton className='h-4 w-3/4' />
                      <Skeleton className='h-3 w-1/2' />
                      <div className='flex gap-2 mt-3'>
                        <Skeleton className='h-5 w-16 rounded-full' />
                        <Skeleton className='h-5 w-20 rounded-full' />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : data?.length ? (
              <div className='grid gap-5 grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'>
                {data.map((s) => <SaloonCard key={s.id} saloon={s} />)}
              </div>
            ) : (
              <div className='flex flex-col items-center justify-center py-24 text-center rounded-3xl border border-dashed border-border bg-white/60'>
                <div className='h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4'>
                  <Search size={28} className='text-muted-foreground' />
                </div>
                <p className='font-semibold text-foreground text-lg'>No shops found</p>
                <p className='mt-1 text-sm text-muted-foreground max-w-sm'>
                  Try a different city, broaden your distance, or clear some filters to see more results.
                </p>
                {hasFilters && (
                  <Button variant='outline' className='mt-5 rounded-xl' onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
      {/* ──── END desktop layout ──── */}
    </div>
  );
}

function FilterBlock({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className='rounded-2xl border border-border bg-white p-4 shadow-card'>
      <div className='flex items-center justify-between mb-3'>
        <h3 className='text-xs font-bold uppercase tracking-wider text-foreground'>{title}</h3>
        {count !== undefined && (
          <span className='inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-brand-ink text-white text-[10px] font-bold px-1.5'>
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/** Segmented List / Map switch. */
function ViewToggle({ view, onList, onMap }: { view: 'list' | 'map'; onList: () => void; onMap: () => void }) {
  return (
    <div className='shrink-0 inline-flex items-center rounded-full border border-border bg-white p-0.5'>
      <button
        onClick={onList}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-semibold transition-colors',
          view === 'list' ? 'bg-brand-ink text-white' : 'text-foreground hover:bg-muted/50',
        )}
      >
        <LayoutGrid size={13} /> List
      </button>
      <button
        onClick={onMap}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-semibold transition-colors',
          view === 'map' ? 'bg-brand-ink text-white' : 'text-foreground hover:bg-muted/50',
        )}
      >
        <MapIcon size={13} /> Map
      </button>
    </div>
  );
}

/** Map view: radius selector + Leaflet map, or a prompt to enable location. */
function MapPanel({
  coords, radiusKm, onRadius, shops, loading, locating, onEnableLocation,
}: {
  coords: { lat?: number; lng?: number };
  radiusKm: number;
  onRadius: (km: number) => void;
  shops: NearbyShop[];
  loading: boolean;
  locating: boolean;
  onEnableLocation: () => void;
}) {
  if (coords.lat == null || coords.lng == null) {
    return (
      <div className='flex flex-col items-center justify-center py-20 text-center rounded-3xl border border-dashed border-border bg-white/60'>
        <div className='h-16 w-16 rounded-2xl bg-brand-peach/40 flex items-center justify-center mb-4'>
          <Navigation size={26} className='text-brand-ink' />
        </div>
        <p className='font-semibold text-foreground text-lg'>See shops near you on a map</p>
        <p className='mt-1 text-sm text-muted-foreground max-w-sm'>
          Share your location and we&apos;ll plot every shop within your chosen radius.
        </p>
        <Button onClick={onEnableLocation} variant='gradient' className='mt-5 rounded-xl gap-2' disabled={locating}>
          <Navigation size={15} /> {locating ? 'Locating…' : 'Use my location'}
        </Button>
      </div>
    );
  }

  return (
    <div className='space-y-3'>
      {/* Radius selector + live count */}
      <div className='flex items-center gap-1.5 flex-wrap'>
        <span className='text-[11px] font-bold uppercase tracking-wide text-muted-foreground mr-1'>Within</span>
        {RADIUS_PRESETS.map((km) => (
          <button
            key={km}
            onClick={() => onRadius(km)}
            className={cn(
              'h-8 rounded-full border px-3.5 text-[11px] font-semibold transition-colors',
              radiusKm === km
                ? 'border-brand-ink bg-brand-ink text-white'
                : 'border-border bg-white text-foreground hover:border-brand-sage/40',
            )}
          >
            {km} km
          </button>
        ))}
        <span className='ml-auto text-sm text-muted-foreground'>
          {loading
            ? 'Searching…'
            : <><span className='font-bold tabular-nums text-foreground'>{shops.length}</span> shop{shops.length !== 1 ? 's' : ''} within {radiusKm} km</>}
        </span>
      </div>

      <NearbyShopsMap
        center={{ lat: coords.lat, lng: coords.lng }}
        radiusKm={radiusKm}
        shops={shops}
        onLocate={onEnableLocation}
      />

      {!loading && shops.length === 0 && (
        <p className='text-center text-sm text-muted-foreground py-2'>
          No shops within {radiusKm} km — try a larger radius.
        </p>
      )}
    </div>
  );
}
