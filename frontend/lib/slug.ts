import { Saloon } from '@/types';

/**
 * Strip diacritics + lowercase + hyphenate. ASCII-only output.
 * "Royal Cuts Salon"  → "royal-cuts-salon"
 * "Café déjà vu #1"    → "cafe-deja-vu-1"
 * "   "                → "salon"  (never empty)
 */
export function slugify(text: string): string {
  if (!text) return 'salon';
  const ascii = text.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'salon';
}

const ID_PAD = 5;

/**
 * Public href for a saloon detail page.
 * Format: `/shops/{name-slug}-{zero-padded-id}` e.g. `/shops/ducky-salon-00042`.
 * The trailing numeric id is the source of truth — everything before it is
 * cosmetic and can be rewritten freely without breaking links.
 */
export function saloonHref(saloon: Pick<Saloon, 'id' | 'name'>): string {
  return `/shops/${slugify(saloon.name)}-${String(saloon.id).padStart(ID_PAD, '0')}`;
}

export function saloonBookHref(saloon: Pick<Saloon, 'id' | 'name'>): string {
  return `${saloonHref(saloon)}/book`;
}

/**
 * Parse `42`, `ducky-saloon-00042`, or any `…-00042` form back to the numeric id.
 * Returns null when no valid trailing id can be extracted.
 */
export function parseSaloonIdFromSlug(slugOrId: string | undefined | null): number | null {
  if (!slugOrId) return null;
  const decoded = decodeURIComponent(slugOrId);
  // Take the LAST run of digits — handles both `42` and `ducky-saloon-00042`.
  const match = decoded.match(/(\d+)$/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}
