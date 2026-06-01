'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { StarRatingInput } from './StarRating';
import { api } from '@/lib/api';

const RATING_LABELS = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: number;
  saloonId: number;
  saloonName?: string | null;
  serviceName?: string | null;
  onSubmitted?: () => void;
}

export function ReviewModal({ open, onOpenChange, bookingId, saloonId, saloonName, serviceName, onSubmitted }: Props) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  // Reset whenever the sheet opens for a fresh booking.
  useEffect(() => {
    if (open) { setRating(0); setComment(''); }
  }, [open, bookingId]);

  const mutation = useMutation({
    mutationFn: async () =>
      (await api.post(`/bookings/${bookingId}/review`, { rating, comment: comment.trim() || null })).data,
    onSuccess: () => {
      toast.success('Thanks for your review!');
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['booking', String(bookingId)] });
      qc.invalidateQueries({ queryKey: ['saloon-reviews', saloonId] });
      qc.invalidateQueries({ queryKey: ['saloon', String(saloonId)] });
      onSubmitted?.();
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.detail || 'Could not submit review.');
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='bottom' className='rounded-t-3xl p-0 sm:max-w-md sm:mx-auto'>
        <div className='px-5 pt-6 pb-7'>
          <SheetTitle className='text-center text-lg font-bold text-foreground'>
            Rate your visit
          </SheetTitle>
          {(saloonName || serviceName) && (
            <p className='mt-1 text-center text-sm text-muted-foreground'>
              {saloonName}{serviceName ? ` · ${serviceName}` : ''}
            </p>
          )}

          {/* Star picker */}
          <div className='mt-6 flex flex-col items-center gap-2'>
            <StarRatingInput value={rating} onChange={setRating} />
            <span className='h-5 text-sm font-semibold text-brand-ink'>
              {rating > 0 ? RATING_LABELS[rating] : 'Tap a star to rate'}
            </span>
          </div>

          {/* Comment */}
          <div className='mt-5'>
            <label className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
              Add a comment <span className='font-normal normal-case'>(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder='How was the service, staff, and ambience?'
              className='mt-1.5 w-full rounded-xl border border-border bg-white p-3 text-sm resize-none focus:outline-none focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/15 transition-all'
            />
            <p className='mt-1 text-right text-[11px] text-muted-foreground'>{comment.length}/500</p>
          </div>

          <Button
            onClick={() => mutation.mutate()}
            disabled={rating === 0 || mutation.isPending}
            variant='gradient'
            className='mt-3 w-full rounded-xl h-12 gap-2'
          >
            <Star size={16} className={rating > 0 ? 'fill-white' : ''} />
            {mutation.isPending ? 'Submitting…' : 'Submit review'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
