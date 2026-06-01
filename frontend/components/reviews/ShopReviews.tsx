'use client';

import { MessageSquareText, Scissors } from 'lucide-react';
import { useSaloonReviews } from '@/lib/hooks/useSaloonReviews';
import { StarRating } from './StarRating';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ReviewPublic } from '@/types';

export function ShopReviews({ saloonId }: { saloonId: number }) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useSaloonReviews(saloonId);

  const summary = data?.pages[0]?.summary;
  const reviews = data?.pages.flatMap((p) => p.reviews) ?? [];
  const total = summary?.count ?? 0;

  if (isLoading) {
    return (
      <div className='space-y-3'>
        <Skeleton className='h-28 rounded-2xl' />
        <Skeleton className='h-20 rounded-2xl' />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className='rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center'>
        <div className='mx-auto h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-3'>
          <MessageSquareText size={22} className='text-brand-sage' />
        </div>
        <p className='font-semibold text-foreground'>No reviews yet</p>
        <p className='mt-1 text-sm text-muted-foreground'>Be the first to share your experience after a visit.</p>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* Summary header */}
      <div className='rounded-2xl border border-border bg-white shadow-card p-5 flex flex-col sm:flex-row sm:items-center gap-5'>
        <div className='flex flex-col items-center justify-center sm:w-40 shrink-0'>
          <span className='text-5xl font-extrabold text-foreground leading-none tabular-nums'>
            {summary!.average.toFixed(1)}
          </span>
          <StarRating value={summary!.average} size={16} className='mt-2' />
          <span className='mt-1.5 text-xs text-muted-foreground'>
            {total.toLocaleString()} review{total !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Distribution bars */}
        <div className='flex-1 space-y-1.5 min-w-0'>
          {[5, 4, 3, 2, 1].map((star) => {
            const n = summary!.distribution[String(star)] ?? 0;
            const pct = total ? (n / total) * 100 : 0;
            return (
              <div key={star} className='flex items-center gap-2.5'>
                <span className='w-3 text-xs font-semibold text-muted-foreground tabular-nums'>{star}</span>
                <div className='flex-1 h-2 rounded-full bg-muted overflow-hidden'>
                  <div className='h-full rounded-full bg-amber-400 transition-all' style={{ width: `${pct}%` }} />
                </div>
                <span className='w-8 text-right text-[11px] text-muted-foreground tabular-nums'>{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review list */}
      <div className='space-y-2.5'>
        <div className='flex items-center justify-between px-1'>
          <p className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
            Recent customer reviews
          </p>
          <span className='text-xs text-muted-foreground'>
            Showing {reviews.length} of {total.toLocaleString()}
          </span>
        </div>
        <div className='space-y-3'>
          {reviews.map((r) => (
            <ReviewItem key={r.id} review={r} />
          ))}
        </div>
      </div>

      {/* Show more */}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className={cn(
            'w-full rounded-xl border border-border bg-white py-3 text-sm font-semibold text-foreground',
            'hover:bg-muted/40 active:scale-[.99] transition disabled:opacity-60',
          )}
        >
          {isFetchingNextPage ? 'Loading…' : 'Show next 5 reviews'}
        </button>
      )}
    </div>
  );
}

function ReviewItem({ review }: { review: ReviewPublic }) {
  const initial = review.customer_name?.trim().charAt(0).toUpperCase() || '?';
  const date = (() => {
    try {
      return new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return ''; }
  })();

  return (
    <div className='rounded-2xl border border-border bg-white p-4 shadow-card'>
      <div className='flex items-start gap-3'>
        <div className='h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-brand-peach to-brand-sage/50 flex items-center justify-center text-sm font-bold text-brand-ink'>
          {initial}
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center justify-between gap-2'>
            <p className='font-semibold text-sm text-foreground truncate'>{review.customer_name}</p>
            <span className='shrink-0 text-[11px] text-muted-foreground'>{date}</span>
          </div>
          <div className='mt-0.5 flex items-center gap-2'>
            <StarRating value={review.rating} size={13} />
            {review.service_name && (
              <span className='inline-flex items-center gap-1 text-[11px] text-muted-foreground truncate'>
                <Scissors size={10} className='text-brand-sage shrink-0' />
                {review.service_name}
              </span>
            )}
          </div>
          {review.comment && (
            <p className='mt-2 text-sm text-foreground/80 leading-relaxed whitespace-pre-line'>{review.comment}</p>
          )}
        </div>
      </div>
    </div>
  );
}
