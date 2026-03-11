import type { SubtitleItem } from '@viona/renderer';

export function convertToSubtitles(items: any[]): SubtitleItem[] {
  // Frontend uses 'caption' type, not 'subtitle'
  return items
    .filter(item => item.type === 'caption' || item.type === 'subtitle')
    .map(item => {
      const data = item.data as any;
      return {
        id: item.id,
        startMs: item.startMs,
        endMs: item.endMs,
        text: data.text || '',
        words: data.words || [{ text: data.text || '', startMs: item.startMs, endMs: item.endMs }],
        style: data.style,
      };
    });
}
