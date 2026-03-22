import { interpolate } from 'remotion';

interface ParsedValue {
  prefix: string;
  number: number;
  suffix: string;
  decimals: number;
  commaFormatted: boolean;
  isNumeric: boolean;
}

export function parseValue(raw: string): ParsedValue {
  const match = raw.match(/^([^0-9]*?)([\d,]+\.?\d*)(.*?)$/);
  if (!match) {
    return { prefix: '', number: 0, suffix: '', decimals: 0, commaFormatted: false, isNumeric: false };
  }
  const prefix = match[1];
  const numStr = match[2];
  const suffix = match[3];
  const commaFormatted = numStr.includes(',');
  const cleaned = numStr.replace(/,/g, '');
  const number = parseFloat(cleaned);
  const decimalPart = cleaned.split('.')[1];
  const decimals = decimalPart ? decimalPart.length : 0;
  return { prefix, number, suffix, decimals, commaFormatted, isNumeric: true };
}

export function formatAnimatedValue(
  frame: number, startFrame: number, duration: number,
  parsed: ParsedValue, rawValue: string,
): string {
  if (!parsed.isNumeric) return rawValue;
  const progress = interpolate(frame, [startFrame, startFrame + duration], [0, parsed.number], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  let formatted: string;
  if (parsed.decimals > 0) {
    formatted = progress.toFixed(parsed.decimals);
  } else if (parsed.commaFormatted) {
    formatted = Math.round(progress).toLocaleString('en-US');
  } else {
    formatted = Math.round(progress).toString();
  }
  return `${parsed.prefix}${formatted}${parsed.suffix}`;
}
