export function formatCompact(value: number, prefix: string = '', suffix: string = ''): string {
  if (value >= 1_000_000) {
    const v = value / 1_000_000;
    return `${prefix}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M${suffix}`;
  }
  if (value >= 1_000) {
    const v = value / 1_000;
    return `${prefix}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K${suffix}`;
  }
  return `${prefix}${value.toLocaleString('en-US')}${suffix}`;
}
