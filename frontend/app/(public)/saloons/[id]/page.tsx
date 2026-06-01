'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarCheck,
  ChevronDown,
  Flag,
  Heart,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  Scissors,
  Star,
  UsersRound,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatLkr } from '@/lib/currency';
import { formatCompact, formatGrouped } from '@/lib/number';
import type { Coordinates } from '@/lib/distance';
import { distanceKmBetween, formatPointDistance, parseMapCoordinates } from '@/lib/distance';
import { useAuth } from '@/lib/auth';
import { LOW_ACCURACY_M, useLocation } from '@/lib/location';
import { cn } from '@/lib/utils';
import { Saloon } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { RouteMapModal } from '@/components/maps/RouteMap';
import { ShopReviews } from '@/components/reviews/ShopReviews';
import { ReportSaloonDialog } from '@/components/saloon/ReportSaloonDialog';
import { SignInPromptSheet } from '@/components/shared/SignInPromptSheet';
import { parseSaloonIdFromSlug, saloonBookHref, saloonHref } from '@/lib/slug';
import { usePathname, useRouter } from 'next/navigation';

export default function SaloonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: routeParam } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const id = parseSaloonIdFromSlug(routeParam);
  const qc = useQueryClient();
  const { user } = useAuth();
  // Location comes from the shared, persisted store — reused across shops
  // instead of re-reading GPS every time a shop page opens.
  const { coords: customerCoords, accuracy: geoAccuracy, status: geoStatus, request, setManual } = useLocation();
  const [mapLocationInput, setMapLocationInput] = useState('');
  const [mapLocationMessage, setMapLocationMessage] = useState('');
  const [routeOpen, setRouteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [signInPrompt, setSignInPrompt] = useState<null | 'book' | 'save' | 'report'>(null);

  const { data, isLoading, isError } = useQuery<Saloon>({
    queryKey: ['saloon', id],
    enabled: id !== null,
    queryFn: async () => (await api.get(`/saloons/${id}`)).data,
  });

  // Canonicalize the URL: if the user landed on `/shops/42`, swap the URL
  // for the pretty `/shops/{slug}-00042` form once we know the name.
  useEffect(() => {
    if (!data) return;
    const canonical = saloonHref(data);
    if (pathname !== canonical) {
      router.replace(canonical);
    }
  }, [data, pathname, router]);

  const { data: favourites } = useQuery<{ items: Saloon[] }>({
    queryKey: ['favourites'],
    enabled: Boolean(user),
    queryFn: async () => (await api.get('/favourites')).data,
    retry: false,
  });
  const isSaved = Boolean(id != null && favourites?.items?.some((s) => s.id === id));

  const favourite = useMutation({
    mutationFn: async () => {
      if (isSaved) return api.delete(`/favourites/${id}`);
      return api.post(`/favourites/${id}`);
    },
    onMutate: async () => {
      // Optimistically bump the follower count on the cached saloon detail.
      await qc.cancelQueries({ queryKey: ['saloon', id] });
      const prev = qc.getQueryData<Saloon>(['saloon', id]);
      if (prev) {
        const delta = isSaved ? -1 : 1;
        qc.setQueryData<Saloon>(['saloon', id], {
          ...prev,
          followers_count: Math.max(0, (prev.followers_count ?? 0) + delta),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['saloon', id], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['favourites'] });
      qc.invalidateQueries({ queryKey: ['saloon', id] });
    },
  });
  function openReport() {
    if (!user) {
      setSignInPrompt('report');
      return;
    }
    setReportOpen(true);
  }

  function handleSaveClick() {
    if (!user) {
      setSignInPrompt('save');
      return;
    }
    favourite.mutate();
  }

  const shopCoords = useMemo<Coordinates | null>(() => {
    if (data?.lat == null || data?.lng == null) return null;
    return { lat: Number(data.lat), lng: Number(data.lng) };
  }, [data?.lat, data?.lng]);

  // Distance state for the UI: a shop without a pin can't show distance,
  // otherwise mirror the shared geolocation status.
  const locationState = !shopCoords ? 'unavailable' : geoStatus;

  // Explicit user action (button / refresh) — force a fresh GPS read.
  function requestCustomerLocation() {
    if (!shopCoords) return;
    request({ force: true });
  }

  function useMapLocation() {
    const parsed = parseMapCoordinates(mapLocationInput);
    if (!parsed) { setMapLocationMessage('Paste a map link or coordinates like 6.927079,79.861244.'); return; }
    setManual(parsed);
    setMapLocationMessage('Distance updated from your map location.');
  }

  // First visit only: if we have a pin but no position yet, grab one once.
  // Cached coords are reused, so opening more shops never re-reads GPS.
  useEffect(() => {
    if (shopCoords && !customerCoords && geoStatus === 'idle') request();
  }, [shopCoords, customerCoords, geoStatus, request]);

  if (isLoading) {
    return (
      <div className='section-shell max-w-5xl space-y-4'>
        <Skeleton className='h-64 rounded-2xl' />
        <div className='grid gap-4 md:grid-cols-2'>
          <Skeleton className='h-40 rounded-2xl' />
          <Skeleton className='h-40 rounded-2xl' />
        </div>
      </div>
    );
  }

  if (id === null || isError || !data) {
    return (
      <div className='section-shell max-w-5xl'>
        <div className='flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-border'>
          <p className='font-semibold text-foreground'>Saloon not found</p>
          <Link href='/shops' className='mt-3'>
            <Button variant='outline' size='sm' className='rounded-xl'>Back to shops</Button>
          </Link>
        </div>
      </div>
    );
  }

  const mapQuery = data.lat && data.lng ? `${data.lat},${data.lng}` : `${data.address}, ${data.city}`;
  const distanceKm = customerCoords && shopCoords ? distanceKmBetween(customerCoords, shopCoords) : null;
  const shopMapEmbedUrl = shopCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${shopCoords.lng - 0.01}%2C${shopCoords.lat - 0.01}%2C${shopCoords.lng + 0.01}%2C${shopCoords.lat + 0.01}&layer=mapnik&marker=${shopCoords.lat}%2C${shopCoords.lng}`
    : null;
  const osmDirectionsUrl = customerCoords && shopCoords
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${customerCoords.lat}%2C${customerCoords.lng}%3B${shopCoords.lat}%2C${shopCoords.lng}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(mapQuery)}`;
  const galleryImages = [...(data.images ?? [])].sort((a, b) => a.order - b.order).map((i) => i.url).filter(Boolean);
  const displayGallery = galleryImages.length ? galleryImages : (data.cover_image ? [data.cover_image] : []);

  // A large accuracy radius means the fix came from WiFi/IP, not real GPS —
  // warn the user and point them at manual entry instead of trusting it.
  const lowAccuracy = geoAccuracy != null && geoAccuracy > LOW_ACCURACY_M;
  const readyMsg = lowAccuracy
    ? `Approximate (±${formatPointDistance(geoAccuracy! / 1000)}) — enable GPS or set your location below.`
    : 'Based on your live GPS position.';

  const locationMsg: Record<string, string> = {
    loading: 'Finding your location…',
    ready: readyMsg,
    blocked: 'Location blocked — enable it in your browser settings.',
    unsupported: 'Your browser doesn’t support GPS.',
    unavailable: 'Could not calculate distance for this shop.',
    idle: 'Tap below to see how close this shop is.',
  };

  return (
    <div className='section-shell max-w-5xl pb-24 md:pb-8 space-y-6'>
      {/* Hero image */}
      {displayGallery[0] && (
        <div className='relative overflow-hidden rounded-2xl border border-border'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displayGallery[0]} alt={`${data.name} cover`} className='h-56 w-full object-cover sm:h-80' />
          <div className='absolute inset-0 bg-gradient-to-t from-black/40 to-transparent' />
          {data.avg_rating != null && (
            <div className='absolute top-3 right-3 flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-1.5 text-sm font-bold text-amber-600 shadow'>
              <Star size={14} fill='currentColor' />
              {data.avg_rating}
            </div>
          )}
        </div>
      )}

      {/* Info + actions grid */}
      <div className='grid gap-4 md:grid-cols-[1.1fr_0.9fr]'>
        {/* Info card */}
        <div className='rounded-2xl border border-border bg-white shadow-card p-5 space-y-3'>
          <h1 className='text-2xl font-bold text-foreground sm:text-3xl'>{data.name}</h1>
          <p className='flex items-center gap-2 text-sm text-muted-foreground'>
            <MapPin size={15} className='text-brand-sage shrink-0' />
            {data.address}, {data.city}
          </p>

          {/* Instagram-style social stats */}
          <div className='flex items-center gap-5 pt-1'>
            <div className='flex flex-col'>
              <span
                className='text-lg font-bold text-foreground leading-none'
                title={formatGrouped(data.followers_count ?? 0)}
              >
                {formatCompact(data.followers_count ?? 0)}
              </span>
              <span className='text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5'>
                {(data.followers_count ?? 0) === 1 ? 'follower' : 'followers'}
              </span>
            </div>
            <div className='h-8 w-px bg-border' />
            <div className='flex flex-col'>
              <span className='text-lg font-bold text-foreground leading-none'>
                {data.reviews_count ?? 0}
              </span>
              <span className='text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5'>
                {(data.reviews_count ?? 0) === 1 ? 'review' : 'reviews'}
              </span>
            </div>
            <div className='h-8 w-px bg-border' />
            <div className='flex flex-col'>
              <span className='text-lg font-bold text-foreground leading-none'>
                {data.services?.length ?? 0}
              </span>
              <span className='text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5'>
                services
              </span>
            </div>
          </div>

          <div className='flex flex-wrap gap-2'>
            {data.avg_rating != null && (
              <Badge variant='warning' className='gap-1'>
                <Star size={12} fill='currentColor' /> {data.avg_rating}
              </Badge>
            )}
            <Badge variant='info' className='gap-1'>
              <Scissors size={12} /> {data.services?.length ?? 0} services
            </Badge>
            <Badge variant='success' className='gap-1'>
              <UsersRound size={12} /> {data.staff?.length ?? 0} staff
            </Badge>
            {distanceKm != null && (
              <Badge variant='info' className='gap-1'>
                <LocateFixed size={12} /> {formatPointDistance(distanceKm)} away
              </Badge>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className='flex flex-col gap-2'>
          <div className='grid grid-cols-2 gap-2'>
            <Button
              onClick={handleSaveClick}
              disabled={favourite.isPending}
              variant='outline'
              className={cn(
                'rounded-xl gap-1.5',
                isSaved && 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100',
              )}
            >
              <Heart size={17} fill={isSaved ? 'currentColor' : 'none'} />
              {isSaved ? 'Saved' : 'Save'}
            </Button>
            <Button variant='outline' onClick={openReport} className='rounded-xl gap-1.5'>
              <Flag size={17} /> Report
            </Button>
          </div>
          {user ? (
            <Link href={data ? saloonBookHref(data) : '#'} className='mt-auto'>
              <Button variant='gradient' className='w-full rounded-xl h-12 text-base'>
                <CalendarCheck size={18} /> Book appointment
              </Button>
            </Link>
          ) : (
            <Button
              variant='gradient'
              onClick={() => setSignInPrompt('book')}
              className='w-full rounded-xl h-12 text-base mt-auto'
            >
              <CalendarCheck size={18} /> Book appointment
            </Button>
          )}
        </div>
      </div>

      {/* Distance card */}
      <div className='rounded-2xl border border-border bg-white shadow-card overflow-hidden'>
        {/* Distance hero */}
        <div className='relative px-5 py-4 bg-gradient-to-br from-brand-peach/30 via-white to-brand-sage/10'>
          <div className='flex items-start justify-between gap-3'>
            <div className='flex items-start gap-3 min-w-0 flex-1'>
              <div className={cn(
                'h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-colors',
                distanceKm != null ? 'bg-brand-ink text-white' : 'bg-muted text-muted-foreground',
              )}>
                <Navigation size={18} />
              </div>
              <div className='min-w-0 flex-1'>
                {distanceKm != null ? (
                  <p className='text-2xl font-bold text-foreground leading-tight tabular-nums'>
                    {formatPointDistance(distanceKm)}
                    <span className='ml-1.5 text-sm font-medium text-muted-foreground'>away</span>
                  </p>
                ) : (
                  <p className='text-base font-bold text-foreground'>
                    {locationState === 'idle' ? 'See how close you are' : 'Distance from you'}
                  </p>
                )}
                <p className='text-[11px] text-muted-foreground mt-0.5 leading-snug'>
                  {locationMsg[locationState]}
                </p>
              </div>
            </div>

            {/* Status pill */}
            {locationState === 'ready' && !lowAccuracy && (
              <span className='inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shrink-0 whitespace-nowrap'>
                <span className='h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse' />
                Live GPS
              </span>
            )}
            {locationState === 'ready' && lowAccuracy && (
              <span className='inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700 shrink-0 whitespace-nowrap'>
                <AlertCircle size={9} />
                Approximate
              </span>
            )}
            {locationState === 'loading' && (
              <span className='inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0 whitespace-nowrap'>
                <span className='h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin' />
                Locating
              </span>
            )}
            {(locationState === 'blocked' || locationState === 'unsupported' || locationState === 'unavailable') && (
              <span className='inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700 shrink-0 whitespace-nowrap'>
                <AlertCircle size={9} />
                GPS off
              </span>
            )}
          </div>
        </div>

        {/* Primary actions */}
        <div className='px-5 py-3 flex gap-2'>
          {customerCoords && shopCoords ? (
            <>
              <Button
                size='sm'
                onClick={() => setRouteOpen(true)}
                className='flex-1 rounded-xl gap-1.5 bg-foreground text-background hover:bg-foreground/90 h-11 text-sm font-semibold'
              >
                <Navigation size={15} />
                Get directions
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={requestCustomerLocation}
                disabled={locationState === 'loading'}
                className='rounded-xl h-11 px-3 shrink-0'
                title='Refresh GPS'
                aria-label='Refresh GPS'
              >
                <RefreshCw size={14} className={locationState === 'loading' ? 'animate-spin' : ''} />
              </Button>
            </>
          ) : (
            <Button
              size='sm'
              onClick={requestCustomerLocation}
              disabled={locationState === 'loading'}
              className='flex-1 rounded-xl gap-1.5 bg-foreground text-background hover:bg-foreground/90 h-11 text-sm font-semibold'
            >
              <LocateFixed size={15} />
              {locationState === 'loading' ? 'Locating…' : 'Use my location'}
            </Button>
          )}
        </div>

        {/* Manual entry — collapsed by default to keep the card clean */}
        <details className='group border-t border-border'>
          <summary className='px-5 py-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer list-none flex items-center justify-between gap-1.5 select-none'>
            <span>Enter location manually</span>
            <ChevronDown size={12} className='transition-transform group-open:rotate-180' />
          </summary>
          <div className='px-5 pb-4 pt-1 space-y-2 bg-muted/20'>
            <p className='text-[11px] text-muted-foreground leading-relaxed'>
              Paste a Maps link or coordinates like <span className='font-mono bg-white border border-border px-1 py-0.5 rounded text-[10px]'>6.927, 79.861</span>.
            </p>
            <div className='flex gap-2'>
              <Input
                value={mapLocationInput}
                onChange={(e) => setMapLocationInput(e.target.value)}
                placeholder='e.g. 6.927, 79.861'
                className='rounded-xl flex-1 text-xs h-10'
              />
              <Button variant='outline' onClick={useMapLocation} className='rounded-xl shrink-0 h-10' size='sm'>
                Use
              </Button>
            </div>
            {mapLocationMessage && (
              <p className={cn(
                'text-[11px]',
                mapLocationMessage.toLowerCase().includes('updated') ? 'text-emerald-700' : 'text-amber-700',
              )}>
                {mapLocationMessage}
              </p>
            )}
          </div>
        </details>
      </div>

      {/* Gallery */}
      <section className='space-y-3'>
        <h2 className='text-lg font-bold text-foreground'>Gallery</h2>
        {displayGallery.length > 0 ? (
          <div className='flex snap-x gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible'>
            {displayGallery.map((url, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${url}-${index}`}
                src={url}
                alt={`${data.name} gallery ${index + 1}`}
                className='h-48 w-[80vw] snap-start rounded-xl border object-cover sm:w-72 lg:w-full'
                loading='lazy'
                decoding='async'
                referrerPolicy='no-referrer'
              />
            ))}
          </div>
        ) : (
          <div className='rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground'>
            No gallery images yet.
          </div>
        )}
      </section>

      {/* Services */}
      <section className='space-y-3'>
        <h2 className='text-lg font-bold text-foreground'>Services</h2>
        {data.services?.length ? (
          <div className='grid md:grid-cols-2 gap-3'>
            {data.services.map((s) => (
              <div key={s.id} className='rounded-xl border border-border bg-white p-4 flex items-center justify-between gap-3'>
                <div className='flex items-center gap-2'>
                  <div className='h-8 w-8 rounded-lg bg-brand-peach flex items-center justify-center shrink-0'>
                    <Scissors size={15} className='text-brand-ink' />
                  </div>
                  <div>
                    <p className='font-semibold text-sm text-foreground'>{s.name}</p>
                    <p className='text-xs text-muted-foreground'>{s.duration_minutes} min</p>
                  </div>
                </div>
                <span className='text-sm font-bold text-foreground'>{formatLkr(s.price)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className='rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground'>No services listed.</div>
        )}
      </section>

      {/* Staff */}
      {data.staff?.length ? (
        <section className='space-y-3'>
          <h2 className='text-lg font-bold text-foreground'>Staff</h2>
          <div className='grid sm:grid-cols-2 md:grid-cols-3 gap-3'>
            {data.staff.map((person) => (
              <div key={person.id} className='rounded-xl border border-border bg-white p-4 flex items-center gap-3'>
                <div className='h-10 w-10 rounded-xl bg-brand-blue/30 flex items-center justify-center shrink-0'>
                  <UsersRound size={18} className='text-brand-ink' />
                </div>
                <div className='min-w-0'>
                  <p className='font-semibold text-sm text-foreground truncate'>{person.name}</p>
                  <p className='text-xs text-muted-foreground truncate'>{person.bio || 'Available for appointments'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Reviews */}
      <section className='space-y-3'>
        <h2 className='text-lg font-bold text-foreground'>Reviews</h2>
        <ShopReviews saloonId={data.id} />
      </section>

      {/* Map */}
      <section className='space-y-3'>
        <h2 className='text-lg font-bold text-foreground'>Shop location</h2>
        <p className='text-sm text-muted-foreground'>{data.address}, {data.city}</p>
        <div className='rounded-xl border border-border overflow-hidden'>
          {shopMapEmbedUrl ? (
            <iframe
              title={`${data.name} location`}
              className='w-full h-72'
              loading='lazy'
              referrerPolicy='no-referrer-when-downgrade'
              src={shopMapEmbedUrl}
            />
          ) : (
            <div className='flex h-56 items-center justify-center bg-muted/30 text-center p-4 text-sm text-muted-foreground'>
              Map pin not set yet. Showing address only.
            </div>
          )}
        </div>
      </section>

      {/* Mobile sticky CTA */}
      <div className='fixed inset-x-0 bottom-14 z-40 border-t bg-white/95 p-3 backdrop-blur md:hidden'>
        <Link href={data ? saloonBookHref(data) : '#'}>
          <Button variant='gradient' className='w-full rounded-xl h-12 text-base gap-2'>
            <CalendarCheck size={18} /> Book now
          </Button>
        </Link>
      </div>

      {/* In-app driving directions */}
      {routeOpen && customerCoords && shopCoords && (
        <RouteMapModal
          from={customerCoords}
          to={shopCoords}
          destinationName={data.name}
          onClose={() => setRouteOpen(false)}
        />
      )}

      {id != null && (
        <ReportSaloonDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          saloonId={id}
          saloonName={data?.name}
        />
      )}

      <SignInPromptSheet
        open={signInPrompt !== null}
        onOpenChange={(next) => setSignInPrompt(next ? signInPrompt : null)}
        intent={signInPrompt ?? 'generic'}
        returnTo={data ? (signInPrompt === 'book' ? saloonBookHref(data) : saloonHref(data)) : undefined}
        context={data?.name}
      />
    </div>
  );
}
