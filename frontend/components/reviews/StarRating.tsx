'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Read-only star row. Supports fractional fill for averages (e.g. 4.6). */
export function StarRating({
  value,
  size = 14,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${value} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i)); // 0..1 for this star
        return (
          <span key={i} className='relative inline-block' style={{ width: size, height: size }}>
            <Star size={size} className='absolute inset-0 text-amber-300' />
            <span className='absolute inset-0 overflow-hidden' style={{ width: `${fill * 100}%` }}>
              <Star size={size} className='text-amber-400 fill-amber-400' />
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** Interactive star picker for submitting a rating. */
export function StarRatingInput({
  value,
  onChange,
  size = 34,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className='inline-flex items-center gap-1.5' role='radiogroup' aria-label='Your rating'>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type='button'
          role='radio'
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
          className='transition-transform hover:scale-110 active:scale-95'
        >
          <Star
            size={size}
            className={cn(
              'transition-colors',
              star <= shown ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/40',
            )}
          />
        </button>
      ))}
    </div>
  );
}
