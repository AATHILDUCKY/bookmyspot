import Link from 'next/link';
import { Heart, MapPin, Scissors, Star } from 'lucide-react';
import { formatLkr } from '@/lib/currency';
import { formatPointDistance } from '@/lib/distance';
import { formatCompact } from '@/lib/number';
import { Saloon } from '@/types';
import { saloonHref } from '@/lib/slug';
import { cn } from '@/lib/utils';

export function SaloonCard({ saloon, className }: { saloon: Saloon; className?: string }) {
  const rating = saloon.avg_rating ?? 0;
  const minPrice = saloon.min_price;
  const followers = saloon.followers_count ?? 0;

  return (
    <Link
      href={saloonHref(saloon)}
      className={cn(
        'group relative flex flex-col rounded-2xl bg-white border border-border/60 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        className,
      )}
    >
      {/* Image */}
      <div className='relative aspect-[5/3] bg-gradient-to-br from-brand-peach/60 via-brand-tan/40 to-brand-sage/20 overflow-hidden'>
        {saloon.cover_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={saloon.cover_image}
            alt={saloon.name}
            className='h-full w-full object-cover group-hover:scale-[1.04] transition-transform duration-500'
          />
        ) : (
          <div className='h-full w-full flex items-center justify-center'>
            <div className='h-14 w-14 rounded-2xl bg-white/70 backdrop-blur-sm flex items-center justify-center shadow-sm'>
              <Scissors size={22} className='text-brand-ink/70' strokeWidth={1.75} />
            </div>
          </div>
        )}

        {/* Rating pill (glass) */}
        <div className='absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-sm px-2 py-0.5 text-[11px] font-semibold shadow-sm'>
          <Star size={10} fill='#f59e0b' className='text-amber-500' />
          <span className='text-foreground'>{rating > 0 ? rating.toFixed(1) : 'New'}</span>
        </div>

        {/* Open/Closed badge */}
        {saloon.is_open === false ? (
          <div className='absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-red-500/95 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-white shadow-sm'>
            <span className='h-1.5 w-1.5 rounded-full bg-white' />
            Closed
          </div>
        ) : (
          <div className='absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/95 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-white shadow-sm'>
            <span className='h-1.5 w-1.5 rounded-full bg-white animate-pulse' />
            Open
          </div>
        )}

        {/* Distance chip (bottom-left) */}
        {saloon.distance_km != null && (
          <div className='absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm'>
            <MapPin size={9} className='text-brand-sage' />
            {formatPointDistance(Number(saloon.distance_km))}
          </div>
        )}

        {/* Bottom fade */}
        <div className='absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/12 via-black/4 to-transparent' />
      </div>

      {/* Content */}
      <div className='flex flex-col flex-1 p-3.5'>
        <h3 className='font-semibold text-sm leading-snug text-foreground line-clamp-1'>{saloon.name}</h3>

        <div className='mt-1 flex items-center justify-between gap-2'>
          <p className='flex items-center gap-1 text-xs text-muted-foreground min-w-0'>
            <MapPin size={11} className='shrink-0 text-brand-sage' />
            <span className='truncate'>{saloon.city}</span>
          </p>
          {minPrice != null && (
            <p className='text-xs font-semibold text-brand-ink shrink-0'>
              from <span className='text-brand-sage'>{formatLkr(minPrice, 0)}</span>
            </p>
          )}
        </div>

        {followers > 0 && (
          <p className='mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground'>
            <Heart size={10} className='text-rose-500' fill='currentColor' />
            <span className='font-medium text-foreground'>{formatCompact(followers)}</span>
            <span>{followers === 1 ? 'follower' : 'followers'}</span>
          </p>
        )}

        {/* Service tags */}
        {(saloon.top_services?.length || saloon.services?.length) ? (
          <div className='mt-2.5 flex flex-wrap gap-1'>
            {(saloon.top_services ?? saloon.services?.slice(0, 2).map((s) => s.name) ?? []).slice(0, 3).map((s) => (
              <span key={s} className='inline-block rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground'>
                {s}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
