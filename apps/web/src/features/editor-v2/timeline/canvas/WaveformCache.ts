/**
 * WaveformCache
 * Caches decoded audio waveform peak data for timeline visualization.
 */

interface WaveformData {
  peaks: Float32Array;
}

class WaveformCache {
  private cache = new Map<string, WaveformData>();
  private pending = new Set<string>();

  getWaveform(src: string): Float32Array | null {
    const entry = this.cache.get(src);
    return entry ? entry.peaks : null;
  }

  requestWaveform(src: string, callback: () => void): void {
    if (this.cache.has(src) || this.pending.has(src) || !src) return;

    this.pending.add(src);
    this.decodeWaveform(src, callback);
  }

  private async decodeWaveform(src: string, callback: () => void): Promise<void> {
    try {
      const response = await fetch(src);
      const arrayBuffer = await response.arrayBuffer();

      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Downsample to ~500 peaks
      const channelData = audioBuffer.getChannelData(0);
      const targetPeaks = 500;
      const chunkSize = Math.max(1, Math.floor(channelData.length / targetPeaks));
      const peaks = new Float32Array(targetPeaks);

      for (let i = 0; i < targetPeaks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, channelData.length);
        let max = 0;
        for (let j = start; j < end; j++) {
          const abs = Math.abs(channelData[j]);
          if (abs > max) max = abs;
        }
        peaks[i] = max;
      }

      this.cache.set(src, { peaks });
      await audioContext.close();
      callback();
    } catch {
      // Silently fail — sine wave placeholder will remain
    } finally {
      this.pending.delete(src);
    }
  }

  clear(): void {
    this.cache.clear();
    this.pending.clear();
  }
}

let instance: WaveformCache | null = null;

export function getWaveformCache(): WaveformCache {
  if (!instance) instance = new WaveformCache();
  return instance;
}
