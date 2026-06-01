'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Flag, ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const REASONS = [
  'Fake or non-existent business',
  'Scam or fraudulent activity',
  'Inappropriate content or images',
  'Misleading prices or services',
  'Rude or unsafe behavior',
  'Other',
];

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 500 * 1024;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saloonId: number;
  saloonName?: string;
};

export function ReportSaloonDialog({ open, onOpenChange, saloonId, saloonName }: Props) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [details, setDetails] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [working, setWorking] = useState(false);

  function reset() {
    setReason('');
    setCustomReason('');
    setDetails('');
    setImages([]);
  }

  const submit = useMutation({
    mutationFn: async () => {
      const finalReason = reason === 'Other' ? customReason.trim() : reason;
      return api.post('/reports', {
        saloon_id: saloonId,
        reason: finalReason,
        details: details.trim() || null,
        images,
      });
    },
    onSuccess: () => {
      toast.success('Report submitted. Our team will review it shortly.');
      reset();
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Could not submit report. Please try again.';
      toast.error(typeof msg === 'string' ? msg : 'Could not submit report.');
    },
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const slots = MAX_IMAGES - images.length;
    if (slots <= 0) {
      toast.error(`You can attach up to ${MAX_IMAGES} images.`);
      return;
    }
    setWorking(true);
    try {
      const picked = Array.from(files).slice(0, slots);
      const converted: string[] = [];
      for (const file of picked) {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image.`);
          continue;
        }
        const dataUrl = await fileToWebpDataUrl(file);
        converted.push(dataUrl);
      }
      if (converted.length) setImages((prev) => [...prev, ...converted]);
    } catch (e: any) {
      toast.error(e?.message || 'Could not process image.');
    } finally {
      setWorking(false);
    }
  }

  const finalReason = reason === 'Other' ? customReason.trim() : reason;
  const canSubmit = Boolean(finalReason) && !submit.isPending && !working;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !submit.isPending) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent
        side='bottom'
        className='max-h-[92vh] overflow-y-auto rounded-t-3xl p-0'
      >
        <div className='px-5 pt-5 pb-3 sticky top-0 bg-background z-10 border-b'>
          <SheetHeader className='text-left space-y-1'>
            <SheetTitle className='flex items-center gap-2 text-base'>
              <Flag size={18} className='text-rose-600' />
              Report {saloonName || 'this shop'}
            </SheetTitle>
            <SheetDescription className='text-xs'>
              Help us keep BookMySpot safe. Reports are confidential.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className='px-5 py-4 space-y-5'>
          <div className='space-y-2'>
            <Label className='text-sm font-medium'>Reason</Label>
            <div className='grid gap-2'>
              {REASONS.map((r) => (
                <button
                  key={r}
                  type='button'
                  onClick={() => setReason(r)}
                  className={cn(
                    'text-left text-sm rounded-xl border px-3 py-2.5 transition-colors',
                    reason === r
                      ? 'border-rose-400 bg-rose-50 text-rose-700'
                      : 'border-border hover:bg-muted',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            {reason === 'Other' && (
              <Input
                placeholder='Briefly describe the reason'
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                maxLength={120}
                className='mt-2'
              />
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='report-details' className='text-sm font-medium'>
              Additional details <span className='text-muted-foreground font-normal'>(optional)</span>
            </Label>
            <textarea
              id='report-details'
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder='Share anything that will help us understand the issue...'
              className='w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200'
            />
            <p className='text-[11px] text-muted-foreground text-right'>{details.length}/1000</p>
          </div>

          <div className='space-y-2'>
            <Label className='text-sm font-medium'>
              Attach images <span className='text-muted-foreground font-normal'>(optional, up to {MAX_IMAGES})</span>
            </Label>
            <div className='grid grid-cols-3 gap-2'>
              {images.map((src, idx) => (
                <div key={idx} className='relative aspect-square rounded-xl overflow-hidden border'>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Attachment ${idx + 1}`} className='h-full w-full object-cover' />
                  <button
                    type='button'
                    onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                    className='absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center'
                    aria-label='Remove image'
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <label
                  className={cn(
                    'aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-muted',
                    working && 'opacity-60 pointer-events-none',
                  )}
                >
                  {working ? <Loader2 size={18} className='animate-spin' /> : <ImagePlus size={20} />}
                  <span className='mt-1'>{working ? 'Processing' : 'Add'}</span>
                  <input
                    type='file'
                    accept='image/*'
                    multiple
                    className='hidden'
                    onChange={(e) => {
                      handleFiles(e.target.files);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <div className='sticky bottom-0 bg-background border-t px-5 py-3 flex gap-2'>
          <Button
            variant='outline'
            className='flex-1 rounded-xl'
            onClick={() => onOpenChange(false)}
            disabled={submit.isPending}
          >
            Cancel
          </Button>
          <Button
            variant='gradient'
            className='flex-1 rounded-xl'
            onClick={() => submit.mutate()}
            disabled={!canSubmit}
          >
            {submit.isPending ? (
              <><Loader2 size={16} className='animate-spin' /> Submitting</>
            ) : (
              'Submit report'
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

async function fileToWebpDataUrl(file: File): Promise<string> {
  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing not available in this browser.');

  const maxSide = Math.max(image.width, image.height);
  for (const targetSide of [1280, 1024, 800, 640, 512]) {
    const scale = Math.min(1, targetSide / maxSide);
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const q of [0.82, 0.7, 0.6, 0.5, 0.4]) {
      const blob = await canvasToWebpBlob(canvas, q);
      if (blob.size <= MAX_IMAGE_BYTES) return blobToDataUrl(blob);
    }
  }
  throw new Error('Could not compress image under 500KB.');
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image.')); };
    img.src = url;
  });
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('WebP conversion failed.'));
      else resolve(blob);
    }, 'image/webp', quality);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not encode image.'));
    reader.readAsDataURL(blob);
  });
}
