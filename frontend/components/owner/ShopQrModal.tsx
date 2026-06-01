'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Image as ImageIcon, Printer, QrCode, Scissors, Share2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import type { Saloon } from '@/types';
import { saloonHref } from '@/lib/slug';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shop: Pick<Saloon, 'id' | 'name' | 'city' | 'address'> | null;
};

// "H" (~30% damage tolerance) is ideal for printed stickers that may scuff,
// smudge, or carry a centred brand logo overlay.
const ERROR_CORRECTION: 'L' | 'M' | 'Q' | 'H' = 'H';
// 1024px export size — sharp on phone screens and on printed A5 wall posters.
const EXPORT_PX = 1024;

// Brand palette (mirrors tailwind.config.ts `brand`).
const INK = '#1f1f1f';
const INK_2 = '#2a2724';
const SAGE = '#8f917c';
const MUTED = '#6b6660';

export function ShopQrModal({ open, onOpenChange, shop }: Props) {
  const [pngDataUrl, setPngDataUrl] = useState<string>('');
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  // Absolute public URL the QR encodes. Must be absolute since the QR is
  // scanned from outside the app (a customer's camera, often via Google Lens).
  const url = useMemo(() => {
    if (!shop) return '';
    const origin = typeof window !== 'undefined'
      ? window.location.origin
      : 'https://bookmyspot.lk';
    return `${origin}${saloonHref(shop)}`;
  }, [shop]);

  // Generate the PNG + SVG once the sheet is open and we know the URL.
  useEffect(() => {
    if (!open || !url) return;
    let cancelled = false;
    setBusy(true);
    (async () => {
      try {
        const [png, svg] = await Promise.all([
          QRCode.toDataURL(url, {
            errorCorrectionLevel: ERROR_CORRECTION,
            margin: 2,
            width: EXPORT_PX,
            color: { dark: INK, light: '#ffffff' },
          }),
          QRCode.toString(url, {
            type: 'svg',
            errorCorrectionLevel: ERROR_CORRECTION,
            margin: 2,
            color: { dark: INK, light: '#ffffff' },
          }),
        ]);
        // Preview canvas (smaller, in-DOM).
        if (previewRef.current) {
          await QRCode.toCanvas(previewRef.current, url, {
            errorCorrectionLevel: ERROR_CORRECTION,
            margin: 1,
            width: 260,
            color: { dark: INK, light: '#ffffff' },
          });
        }
        if (!cancelled) {
          setPngDataUrl(png);
          setSvgMarkup(svg);
        }
      } catch (e: any) {
        toast.error(e?.message || 'Could not generate QR code.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, url]);

  // The hero action: a fully branded advertising poster as a single PNG —
  // shop name, BookMySpot logo, centred QR badge, CTA and link baked in.
  async function downloadPoster() {
    if (!pngDataUrl || !shop) return;
    try {
      const dataUrl = await buildPosterPng({
        shopName: shop.name,
        shopCity: shop.city || '',
        shopAddress: shop.address || '',
        qrPng: pngDataUrl,
        url,
      });
      triggerDownload(dataUrl, `${slugifyForFile(shop.name)}-bookmyspot-poster.png`);
      toast.success('Poster image downloaded');
    } catch {
      toast.error('Could not build the poster image.');
    }
  }

  function downloadPng() {
    if (!pngDataUrl || !shop) return;
    triggerDownload(pngDataUrl, `${slugifyForFile(shop.name)}-qr.png`);
    toast.success('Plain QR (PNG) downloaded');
  }

  function downloadSvg() {
    if (!svgMarkup || !shop) return;
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
    const objUrl = URL.createObjectURL(blob);
    triggerDownload(objUrl, `${slugifyForFile(shop.name)}-qr.svg`);
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    toast.success('Plain QR (SVG) downloaded');
  }

  function copyUrl() {
    if (!url) return;
    navigator.clipboard?.writeText(url).then(
      () => toast.success('Shop link copied'),
      () => toast.error('Could not copy'),
    );
  }

  function shareUrl() {
    if (!url || !shop) return;
    if (navigator.share) {
      navigator.share({
        title: shop.name,
        text: `Book at ${shop.name} on bookmyspot`,
        url,
      }).catch(() => { /* user dismissed */ });
    } else {
      copyUrl();
    }
  }

  function printPoster() {
    if (!pngDataUrl || !shop) return;
    const html = buildPosterHtml({
      shopName: shop.name,
      shopCity: shop.city || '',
      shopAddress: shop.address || '',
      qrPng: pngDataUrl,
      url,
    });
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) {
      toast.error('Pop-up blocked. Allow pop-ups for bookmyspot to print.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    // Wait for the image to load before invoking print.
    w.addEventListener('load', () => {
      w.focus();
      w.print();
    });
  }

  const metaLine = [shop?.address, shop?.city].filter(Boolean).join(' · ');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='bottom' className='rounded-t-3xl p-0 max-h-[92vh] overflow-y-auto sm:max-w-2xl sm:mx-auto'>
        <VisuallyHidden>
          <SheetTitle>Shop QR code</SheetTitle>
        </VisuallyHidden>
        {/* Header */}
        <div className='sticky top-0 bg-background z-10 px-5 pt-5 pb-3 border-b'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2.5'>
              <div className='h-10 w-10 rounded-2xl bg-gradient-to-br from-brand-ink to-[#2a2724] text-white flex items-center justify-center'>
                <QrCode size={18} strokeWidth={2.2} />
              </div>
              <div>
                <h2 className='text-base font-bold text-foreground leading-tight'>Shop QR code</h2>
                <p className='text-xs text-muted-foreground'>Print it · stick it · let customers scan</p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className='h-9 w-9 rounded-xl text-muted-foreground hover:bg-muted flex items-center justify-center'
              aria-label='Close'
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className='px-5 py-5 space-y-5'>
          {/* Poster preview — mirrors the downloadable image */}
          <div className='relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-brand-peach/30 via-white to-brand-sage/10 px-6 pt-6 pb-7 flex flex-col items-center text-center shadow-card'>
            {/* Brand lockup */}
            <div className='flex items-center gap-2'>
              <div className='h-7 w-7 rounded-xl bg-gradient-to-br from-brand-ink to-[#2a2724] text-white flex items-center justify-center shadow-sm'>
                <Scissors size={13} strokeWidth={2.5} />
              </div>
              <span className='text-sm font-bold tracking-tight text-foreground'>
                <span className='text-brand-sage'>book</span>myspot
              </span>
            </div>

            <p className='mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-sage'>Scan to book</p>
            <p className='mt-1 text-xl font-extrabold text-foreground leading-tight line-clamp-2 max-w-full'>
              {shop?.name || 'Your shop'}
            </p>
            {metaLine && (
              <p className='mt-0.5 text-xs text-muted-foreground truncate max-w-full'>{metaLine}</p>
            )}

            {/* QR card with centred brand badge */}
            <div className='relative mt-4 rounded-2xl bg-white border border-border p-3 shadow-card'>
              <canvas ref={previewRef} className='block rounded-lg' />
              <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
                <div className='h-11 w-11 rounded-xl bg-white border-2 border-brand-ink flex items-center justify-center shadow-sm'>
                  <Scissors size={18} strokeWidth={2.5} className='text-brand-ink' />
                </div>
              </div>
              {busy && (
                <div className='mt-2 text-[10px] text-muted-foreground'>Generating…</div>
              )}
            </div>

            <div className='mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-ink px-3.5 py-1.5 text-white'>
              <span className='text-[10px] font-bold uppercase tracking-wider'>Open camera · point · book</span>
            </div>

            <div className='mt-3 inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-sm border border-border px-3 py-1.5 max-w-full'>
              <span className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0'>URL</span>
              <span className='text-[11px] font-mono text-foreground truncate'>{url}</span>
            </div>
          </div>

          {/* Hero download — branded poster image */}
          <Button onClick={downloadPoster} disabled={!pngDataUrl} variant='gradient' className='w-full rounded-xl h-14 justify-start gap-3'>
            <Download size={18} />
            <div className='text-left leading-tight'>
              <div className='text-sm font-semibold'>Download poster image</div>
              <div className='text-[11px] text-white/80'>Branded PNG · 1080×1350 · ready to share &amp; advertise</div>
            </div>
          </Button>

          {/* Secondary: plain QR exports */}
          <div className='grid grid-cols-2 gap-2.5'>
            <Button onClick={downloadPng} disabled={!pngDataUrl} variant='outline' className='rounded-xl h-12 justify-start gap-2'>
              <ImageIcon size={16} />
              <div className='text-left leading-tight'>
                <div className='text-sm font-semibold'>Plain QR · PNG</div>
                <div className='text-[10px] text-muted-foreground'>1024×1024 px</div>
              </div>
            </Button>
            <Button onClick={downloadSvg} disabled={!svgMarkup} variant='outline' className='rounded-xl h-12 justify-start gap-2'>
              <ImageIcon size={16} />
              <div className='text-left leading-tight'>
                <div className='text-sm font-semibold'>Plain QR · SVG</div>
                <div className='text-[10px] text-muted-foreground'>Scales without loss</div>
              </div>
            </Button>
            <Button onClick={printPoster} disabled={!pngDataUrl} variant='outline' className='rounded-xl h-12 justify-start gap-2 col-span-2'>
              <Printer size={16} />
              <div className='text-left leading-tight'>
                <div className='text-sm font-semibold'>Print or save as PDF</div>
                <div className='text-[10px] text-muted-foreground'>Opens an A5 poster ready for the wall</div>
              </div>
            </Button>
          </div>

          {/* Share / copy row */}
          <div className='flex gap-2'>
            <Button onClick={copyUrl} variant='outline' size='sm' className='flex-1 rounded-xl'>
              <Copy size={14} /> Copy link
            </Button>
            <Button onClick={shareUrl} variant='outline' size='sm' className='flex-1 rounded-xl'>
              <Share2 size={14} /> Share
            </Button>
          </div>

          {/* Tips */}
          <div className='rounded-2xl bg-muted/40 px-4 py-3'>
            <p className='text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5'>Printing tips</p>
            <ul className='space-y-1 text-xs text-foreground/80'>
              <li>· Print at A5 or larger for easy phone-camera scanning from across the room.</li>
              <li>· Keep at least a finger-width white border around the QR (the &quot;quiet zone&quot;).</li>
              <li>· Avoid laminating with glossy plastic — reflections can defeat the camera.</li>
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ───────────────────── helpers ──────────────────────────────────── */

function triggerDownload(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function slugifyForFile(s: string): string {
  return (s || 'shop')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'shop';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/* ── Canvas poster composer ───────────────────────────────────────── */

// Lucide "scissors", inlined so it can be rasterised onto the canvas.
function scissorsSvgDataUrl(stroke: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  if (typeof (ctx as any).roundRect === 'function') {
    ctx.beginPath();
    (ctx as any).roundRect(x, y, w, h, rr);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Wrap to at most `maxLines`, ellipsising the final line if it overflows.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && cur) {
      lines.push(cur);
      cur = word;
      if (lines.length === maxLines) break;
    } else {
      cur = candidate;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  // If text remained beyond maxLines, ellipsise the last visible line.
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    const consumed = lines.join(' ');
    if (consumed.length < text.trim().length) {
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines.slice(0, maxLines);
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

async function buildPosterPng(opts: {
  shopName: string; shopCity: string; shopAddress: string; qrPng: string; url: string;
}): Promise<string> {
  const { shopName, shopCity, shopAddress, qrPng, url } = opts;
  const W = 1080, H = 1350;
  const cx = W / 2;
  const SANS = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  try { await (document as any).fonts?.ready; } catch { /* fonts optional */ }

  const [qrImg, scissorsWhite, scissorsInk] = await Promise.all([
    loadImage(qrPng),
    loadImage(scissorsSvgDataUrl('#ffffff')),
    loadImage(scissorsSvgDataUrl(INK)),
  ]);

  // ── Background: soft diagonal brand wash.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#fbf2ea');
  bg.addColorStop(0.5, '#ffffff');
  bg.addColorStop(1, '#eef1ea');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // ── Brand lockup (scissors chip + "bookmyspot"), centred as a group.
  const chip = 64;
  const gap = 18;
  ctx.font = `800 40px ${SANS}`;
  const bookW = ctx.measureText('book').width;
  const myspotW = ctx.measureText('myspot').width;
  const wordW = bookW + myspotW;
  const groupW = chip + gap + wordW;
  const groupX = cx - groupW / 2;
  const chipTop = 70;

  const chipGrad = ctx.createLinearGradient(groupX, chipTop, groupX + chip, chipTop + chip);
  chipGrad.addColorStop(0, INK);
  chipGrad.addColorStop(1, INK_2);
  roundRectPath(ctx, groupX, chipTop, chip, chip, 18);
  ctx.fillStyle = chipGrad;
  ctx.fill();
  const icon = 34;
  ctx.drawImage(scissorsWhite, groupX + (chip - icon) / 2, chipTop + (chip - icon) / 2, icon, icon);

  const wordX = groupX + chip + gap;
  const wordBaseline = chipTop + chip / 2 + 14;
  ctx.textAlign = 'left';
  ctx.fillStyle = SAGE;
  ctx.fillText('book', wordX, wordBaseline);
  ctx.fillStyle = INK;
  ctx.fillText('myspot', wordX + bookW, wordBaseline);
  ctx.textAlign = 'center';

  // ── Kicker.
  const hadSpacing = 'letterSpacing' in ctx;
  if (hadSpacing) (ctx as any).letterSpacing = '6px';
  ctx.font = `700 22px ${SANS}`;
  ctx.fillStyle = SAGE;
  ctx.fillText('SCAN TO BOOK', cx, 226);
  if (hadSpacing) (ctx as any).letterSpacing = '0px';

  // ── Shop name (1–2 lines, auto-fit).
  const nameSize = shopName.length > 22 ? 54 : 62;
  ctx.font = `800 ${nameSize}px ${SANS}`;
  ctx.fillStyle = INK;
  const nameLines = wrapText(ctx, shopName || 'Your shop', W - 160, 2);
  const lineH = Math.round(nameSize * 1.08);
  let y = 296;
  for (const line of nameLines) {
    ctx.fillText(line, cx, y);
    y += lineH;
  }

  // ── Meta (address · city).
  const meta = [shopAddress, shopCity].filter(Boolean).join('  ·  ');
  if (meta) {
    ctx.font = `400 26px ${SANS}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(truncateToWidth(ctx, meta, W - 200), cx, y + 14);
  }

  // ── QR card (white, soft shadow) with centred brand badge.
  const cardSize = 600;
  const cardX = cx - cardSize / 2;
  const cardY = 470;
  ctx.save();
  ctx.shadowColor = 'rgba(31,31,31,0.18)';
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 22;
  roundRectPath(ctx, cardX, cardY, cardSize, cardSize, 44);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  roundRectPath(ctx, cardX, cardY, cardSize, cardSize, 44);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#e7e2db';
  ctx.stroke();

  const pad = 46;
  const qrInner = cardSize - pad * 2;
  ctx.imageSmoothingEnabled = false; // crisp QR modules
  ctx.drawImage(qrImg, cardX + pad, cardY + pad, qrInner, qrInner);
  ctx.imageSmoothingEnabled = true;

  // Centred brand badge — small enough (<4% area) to stay within the
  // ~30% error-correction budget, so scanning is unaffected.
  const qrCx = cardX + cardSize / 2;
  const qrCy = cardY + cardSize / 2;
  const bz = Math.round(qrInner * 0.17);
  roundRectPath(ctx, qrCx - bz / 2, qrCy - bz / 2, bz, bz, bz * 0.28);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  const bIcon = bz * 0.56;
  ctx.drawImage(scissorsInk, qrCx - bIcon / 2, qrCy - bIcon / 2, bIcon, bIcon);

  // ── CTA pill.
  ctx.font = `700 25px ${SANS}`;
  const ctaText = 'Open your camera  ·  point  ·  book instantly';
  const pillW = ctx.measureText(ctaText).width + 76;
  const pillH = 66;
  const pillX = cx - pillW / 2;
  const pillY = cardY + cardSize + 44;
  roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(ctaText, cx, pillY + pillH / 2 + 1);
  ctx.textBaseline = 'alphabetic';

  // ── URL + footer.
  ctx.font = `500 23px ${MONO}`;
  ctx.fillStyle = '#8a857e';
  ctx.fillText(truncateToWidth(ctx, url, W - 160), cx, H - 116);

  ctx.font = `600 21px ${SANS}`;
  ctx.fillStyle = '#a7a29b';
  ctx.fillText('Powered by bookmyspot', cx, H - 70);

  return canvas.toDataURL('image/png');
}

/* ── Printable A5 poster (HTML) ───────────────────────────────────── */

function buildPosterHtml(opts: { shopName: string; shopCity: string; shopAddress: string; qrPng: string; url: string }) {
  const { shopName, shopCity, shopAddress, qrPng, url } = opts;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(shopName)} — Scan to book</title>
  <style>
    @page { size: A5; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #faf7f3; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif; color: #1c1917; }
    .poster {
      width: 148mm; height: 210mm;
      padding: 16mm 14mm;
      display: flex; flex-direction: column; align-items: center; text-align: center;
      background: linear-gradient(160deg, #fef4ea 0%, #ffffff 45%, #ecf2e9 100%);
      page-break-after: always;
    }
    .brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; letter-spacing: -0.2px; }
    .brand .logo { width: 22px; height: 22px; border-radius: 6px; background: #1c1917; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; }
    .brand .accent { color: #8f917c; }
    .kicker { margin-top: 22mm; font-size: 11px; font-weight: 700; letter-spacing: 3px; color: #8f917c; text-transform: uppercase; }
    .title { margin-top: 4px; font-size: 30px; font-weight: 800; line-height: 1.1; max-width: 110mm; }
    .meta { margin-top: 4px; font-size: 11px; color: #6b6660; max-width: 110mm; }
    .qr-card { margin-top: 12mm; padding: 10mm; background: #fff; border-radius: 18px; border: 1px solid #e5e1da; box-shadow: 0 12px 30px rgba(28,25,23,0.12); }
    .qr-card img { width: 70mm; height: 70mm; display: block; }
    .cta { margin-top: 10mm; font-size: 13px; font-weight: 600; color: #1c1917; }
    .cta .pill { display: inline-block; margin-top: 4px; padding: 6px 12px; border-radius: 999px; background: #1c1917; color: #fff; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
    .url { margin-top: auto; padding-top: 8mm; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; color: #6b6660; word-break: break-all; max-width: 120mm; }
    .footer { margin-top: 4mm; font-size: 10px; color: #6b6660; }
    @media print { body { background: transparent; } }
  </style>
</head>
<body>
  <div class="poster">
    <div class="brand">
      <span class="logo">✂</span>
      <span><span class="accent">book</span>myspot</span>
    </div>
    <div class="kicker">Scan to book</div>
    <h1 class="title">${escapeHtml(shopName)}</h1>
    <div class="meta">${escapeHtml([shopAddress, shopCity].filter(Boolean).join(' · '))}</div>
    <div class="qr-card">
      <img src="${qrPng}" alt="QR code" />
    </div>
    <div class="cta">
      Open camera · point at the code
      <div class="pill">Instant booking</div>
    </div>
    <div class="url">${escapeHtml(url)}</div>
    <div class="footer">Powered by bookmyspot</div>
  </div>
  <script>
    // No auto-print here — the parent calls window.print() once load fires,
    // which fires AFTER the image is decoded. Safer than racing onload.
  </script>
</body>
</html>`;
}
