// Instagram-style compact follower/like counts.
// 0-999 → raw, 1.2K, 12K, 123K, 1.2M, 12M, 1.2B
export function formatCompact(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 1) return '0';
  if (n < 1000) return String(Math.floor(n));
  const units: Array<{ v: number; s: string }> = [
    { v: 1_000_000_000, s: 'B' },
    { v: 1_000_000, s: 'M' },
    { v: 1_000, s: 'K' },
  ];
  for (const { v, s } of units) {
    if (n >= v) {
      const scaled = n / v;
      // 1 decimal under 10, none above (matches IG/YouTube convention)
      const formatted = scaled < 10 ? scaled.toFixed(1).replace(/\.0$/, '') : String(Math.floor(scaled));
      return `${formatted}${s}`;
    }
  }
  return String(n);
}

// Full grouped number (1,234) for tooltips/long-form contexts.
export function formatGrouped(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-US');
}
