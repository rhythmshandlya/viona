/**
 * Smart-format large numbers: 1200000 → "1.2M", 45000 → "45K"
 */
export function formatCompact(value: number, prefix: string = ''): string {
  if (value >= 1_000_000) {
    const v = value / 1_000_000;
    return `${prefix}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const v = value / 1_000;
    return `${prefix}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K`;
  }
  return `${prefix}${value.toLocaleString('en-US')}`;
}
