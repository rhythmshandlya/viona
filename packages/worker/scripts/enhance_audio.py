#!/usr/bin/env python3
"""
Audio enhancement pipeline for Reelify.
Uses DeepFilterNet3 for noise removal, FFmpeg for EQ/compression,
and pyloudnorm for loudness normalization to Instagram standards.

Usage:
  python enhance_audio.py --input raw.wav --output enhanced.wav [--lufs -14]
"""

import sys
import argparse
import subprocess
import tempfile
import os

import numpy as np
import soundfile as sf
import pyloudnorm as pyln


def emit_progress(percent: int, message: str):
    """Emit progress in format the Node worker can parse."""
    print(f"PROGRESS:{percent}%:{message}", file=sys.stderr, flush=True)


def dc_offset_and_normalize(audio: np.ndarray) -> np.ndarray:
    """Remove DC offset and peak-normalize to -1 dBFS."""
    audio = audio - np.mean(audio)
    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = audio / peak * 0.891  # -1 dBFS
    return audio


def run_deepfilternet(input_path: str, output_path: str, atten_lim_db: float = 12.0):
    """Run DeepFilterNet3 noise removal with limited attenuation to preserve voice character."""
    from df.enhance import enhance, init_df, load_audio, save_audio

    model, df_state, _ = init_df()
    audio, _ = load_audio(input_path, sr=df_state.sr())
    enhanced = enhance(model, df_state, audio, atten_lim_db=atten_lim_db)
    save_audio(output_path, enhanced, sr=df_state.sr())


def run_eq_chain(input_path: str, output_path: str):
    """Run FFmpeg gentle cleanup: highpass/lowpass only, light compression, safe limiter."""
    cmd = [
        "ffmpeg", "-y", "-i", input_path, "-af",
        ",".join([
            # Cleanup: rumble and hiss removal only — no presence boosts
            "highpass=f=80",
            "lowpass=f=14000",
            # Gentle de-esser: tame 4-8kHz sibilance that DeepFilterNet can expose
            "equalizer=f=6000:t=q:w=2:g=-1.5",
            # Light compression: preserve dynamics, just even out quiet/loud passages
            "acompressor=threshold=0.25:ratio=2:attack=20:release=100:makeup=1:knee=6",
            # Safe limiter with headroom
            "alimiter=limit=0.79",
        ]),
        "-ar", "48000", output_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def loudness_normalize(input_path: str, output_path: str, target_lufs: float = -14.0):
    """Normalize loudness to target LUFS and clamp true peak to -2 dBTP."""
    data, rate = sf.read(input_path)
    meter = pyln.Meter(rate)
    loudness = meter.integrated_loudness(data)

    # Normalize to target LUFS
    normalized = pyln.normalize.loudness(data, loudness, target_lufs)

    # Clamp true peak to -2 dBTP (0.794 linear) — extra headroom avoids
    # inter-sample clipping on lossy codecs (AAC, etc.)
    peak = np.max(np.abs(normalized))
    if peak > 0.794:
        normalized = normalized / peak * 0.794

    sf.write(output_path, normalized, rate)


def main():
    parser = argparse.ArgumentParser(description="Enhance speech audio for Instagram")
    parser.add_argument("--input", required=True, help="Input WAV file (48kHz)")
    parser.add_argument("--output", required=True, help="Output WAV file (enhanced)")
    parser.add_argument("--lufs", type=float, default=-14.0, help="Target loudness in LUFS (default: -14)")
    args = parser.parse_args()

    tmp_dir = tempfile.mkdtemp(prefix="reelify-enhance-")

    try:
        # Step 1: DC offset removal + peak normalize
        emit_progress(5, "Preprocessing audio")
        audio, sr = sf.read(args.input)
        audio = dc_offset_and_normalize(audio)
        prepped_path = os.path.join(tmp_dir, "prepped.wav")
        sf.write(prepped_path, audio, sr)
        emit_progress(10, "Preprocessing complete")

        # Step 2: DeepFilterNet3 noise removal
        emit_progress(15, "Running DeepFilterNet3")
        denoised_path = os.path.join(tmp_dir, "denoised.wav")
        run_deepfilternet(prepped_path, denoised_path)
        emit_progress(60, "Noise removal complete")

        # Step 3: EQ + compression + limiting
        emit_progress(65, "Applying EQ and compression")
        eq_path = os.path.join(tmp_dir, "eq.wav")
        run_eq_chain(denoised_path, eq_path)
        emit_progress(75, "EQ complete")

        # Step 4: Loudness normalization
        emit_progress(80, "Normalizing loudness")
        loudness_normalize(eq_path, args.output, target_lufs=args.lufs)
        emit_progress(95, "Loudness normalization complete")

        emit_progress(100, "Enhancement complete")

    except Exception as e:
        print(f"ERROR:{str(e)}", file=sys.stderr, flush=True)
        sys.exit(1)
    finally:
        # Cleanup temp files
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
