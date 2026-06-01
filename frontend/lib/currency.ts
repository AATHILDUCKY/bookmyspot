type FractionDigits = 0 | 2;

const formatters: Record<FractionDigits, Intl.NumberFormat> = {
  0: new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }),
  2: new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

export function formatLkr(value: number | string | null | undefined, fractionDigits: FractionDigits = 2) {
  const amount = Number(value ?? 0);
  return formatters[fractionDigits].format(Number.isFinite(amount) ? amount : 0);
}
