import { BaseRenderer } from './BaseRenderer';
import { ItemRect, RenderItemState } from './types';
import { TimelineItem, AudioItemData } from '../../../store/types';
import { getWaveformCache } from '../WaveformCache';
import { drawPill } from './canvasUtils';

export class AudioRenderer extends BaseRenderer {
  private requestRedraw: () => void;

  constructor(requestRedraw: () => void) {
    super();
    this.requestRedraw = requestRedraw;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    item: TimelineItem,
    rect: ItemRect,
    state: RenderItemState
  ): void {
    super.draw(ctx, item, rect, state);

    const data = item.data as AudioItemData;
    const { x, y, width, height } = rect;
    const cache = getWaveformCache();

    // Draw waveform
    const waveform = data.waveformData
      ? new Float32Array(data.waveformData)
      : cache.getWaveform(data.src);

    const isLoading = !waveform && !!data.src;

    if (waveform && waveform.length > 0) {
      this.drawWaveform(ctx, waveform, x, y, width, height);
    } else {
      this.drawFakeWaveform(ctx, x, y, width, height, isLoading);
      if (data.src) {
        cache.requestWaveform(data.src, this.requestRedraw);
      }
    }

    // Loading pill or enhancement badge
    if (isLoading && width >= 80) {
      this.drawLoadingPill(ctx, x, y, width);
    } else {
      this.drawEnhancementBadge(ctx, data, x, y, width, height);
    }
  }

  private drawWaveform(
    ctx: CanvasRenderingContext2D,
    peaks: Float32Array,
    x: number, y: number, width: number, height: number
  ): void {
    const centerY = y + height / 2;
    const maxAmplitude = (height - 16) / 2; // Leave padding
    const barWidth = Math.max(1, width / peaks.length);

    ctx.fillStyle = '#4ade80'; // green-400

    for (let i = 0; i < peaks.length; i++) {
      const barX = x + (i / peaks.length) * width;
      if (barX < x || barX > x + width) continue;

      const peakHeight = peaks[i] * maxAmplitude;
      // Draw mirrored bar
      ctx.fillRect(barX, centerY - peakHeight, Math.max(1, barWidth - 0.5), peakHeight * 2);
    }
  }

  private drawFakeWaveform(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number, height: number,
    isLoading?: boolean
  ): void {
    const centerY = y + height / 2;
    const waveHeight = height * 0.6;
    const steps = Math.min(width / 3, 50);

    // Pulsing opacity when loading
    const alpha = isLoading
      ? 0.25 + 0.2 * Math.sin(Date.now() / 400)
      : 0.5;

    ctx.strokeStyle = `rgba(74, 222, 128, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let i = 0; i < steps; i++) {
      const xPos = x + (i / steps) * width;
      const amplitude = Math.sin(i * 0.5) * (waveHeight / 2) * 0.7;
      if (i === 0) {
        ctx.moveTo(xPos, centerY + amplitude);
      } else {
        ctx.lineTo(xPos, centerY + amplitude);
      }
    }
    ctx.stroke();

    // Schedule redraw for animation
    if (isLoading) {
      requestAnimationFrame(() => this.requestRedraw());
    }
  }

  private drawLoadingPill(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number
  ): void {
    const alpha = 0.5 + 0.3 * Math.sin(Date.now() / 500);
    drawPill(ctx, x + width - 100, y + 4, 'Loading audio...', {
      bg: `rgba(74, 222, 128, ${alpha * 0.3})`,
      textColor: `rgba(74, 222, 128, ${alpha})`,
      fontSize: 10,
    });
  }

  private drawEnhancementBadge(
    ctx: CanvasRenderingContext2D,
    data: AudioItemData,
    x: number, y: number, width: number, _height: number
  ): void {
    if (width < 80) return;

    if (data.enhancementStatus === 'processing') {
      drawPill(ctx, x + width - 78, y + 4, 'Enhancing...', {
        bg: 'rgba(34, 197, 94, 0.3)',
        textColor: '#22c55e',
        fontSize: 10,
      });
    } else if (data.isEnhanced && data.enhancementStatus === 'complete') {
      drawPill(ctx, x + width - 72, y + 4, 'Enhanced', {
        bg: 'rgba(34, 197, 94, 0.2)',
        textColor: '#22c55e',
        fontSize: 10,
      });
    }
  }
}
