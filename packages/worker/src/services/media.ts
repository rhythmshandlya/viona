import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const exec = promisify(execFile);

export interface FfprobeResult {
  durationMs: number | null;
  width: number | null;
  height: number | null;
  audioChannels: number | null;
}

interface FfprobeJson {
  format?: { duration?: string };
  streams?: { codec_type?: string; width?: number; height?: number; channels?: number }[];
}

/**
 * Runs `ffprobe` against a local file and returns duration/width/height/audioChannels.
 * Non-media fields come back as null when the stream type is absent (e.g. pure audio → no video stream).
 */
export async function runFfprobe(filepath: string): Promise<FfprobeResult> {
  const { stdout } = await exec('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filepath,
  ]);
  const info = JSON.parse(stdout) as FfprobeJson;
  const durationSec = info.format?.duration ? parseFloat(info.format.duration) : null;
  const videoStream = info.streams?.find((s) => s.codec_type === 'video');
  const audioStream = info.streams?.find((s) => s.codec_type === 'audio');
  return {
    durationMs: durationSec != null && Number.isFinite(durationSec) ? Math.round(durationSec * 1000) : null,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
    audioChannels: audioStream?.channels ?? null,
  };
}

async function safeUnlink(path: string): Promise<void> {
  try { await unlink(path); } catch { /* ignore — tmp file already gone */ }
}

/**
 * Generates a 320px-wide thumbnail JPEG for a video or image.
 * For video: seeks 1s in to skip black frames on intro.
 * For image: just scales. Returns the thumbnail bytes as a Buffer.
 */
export async function runFfmpegThumbnail(filepath: string, isVideo: boolean): Promise<Buffer> {
  const outfile = join(tmpdir(), `thumb-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
  const args = isVideo
    ? ['-ss', '1', '-i', filepath, '-frames:v', '1', '-vf', 'scale=320:-1', '-y', outfile]
    : ['-i', filepath, '-vf', 'scale=320:-1', '-y', outfile];
  try {
    await exec('ffmpeg', args);
    return await readFile(outfile);
  } finally {
    await safeUnlink(outfile);
  }
}

/**
 * Generates a waveform PNG (640x120, white on transparent) from the first audio stream
 * of a video or audio file. Returns the PNG bytes as a Buffer.
 */
export async function runFfmpegWaveform(filepath: string): Promise<Buffer> {
  const outfile = join(tmpdir(), `wave-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
  try {
    await exec('ffmpeg', [
      '-i', filepath,
      '-filter_complex', '[0:a]aformat=channel_layouts=mono,showwavespic=s=640x120:colors=white',
      '-frames:v', '1',
      '-y', outfile,
    ]);
    return await readFile(outfile);
  } finally {
    await safeUnlink(outfile);
  }
}
