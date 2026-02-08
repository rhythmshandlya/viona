#!/usr/bin/env python3
"""
Audio enhancement pipeline for Reelify.

Optimized for talking-head videos (single speaker, moderate room noise/reverb).

Pipeline:
  1. DC offset removal + peak normalize
  2. Demucs htdemucs — isolate vocals (removes coughs, impacts, transients)
  3. DeepFilterNet3 — remove residual stationary noise (hiss, hum)
  4. FFmpeg EQ + compression + limiting
  5. Loudness normalization to -16 LUFS

Usage:
  python enhance_audio.py --input raw.wav --output enhanced.wav [--lufs -16]
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


def run_demucs(input_path: str, output_dir: str) -> str:
    """Run Demucs htdemucs to isolate the vocals stem.

    Removes coughs, impacts, music, and other non-speech transients.
    Returns the path to the extracted vocals WAV file.
    """
    import gc
    import torch
    import torchaudio
    from demucs.pretrained import get_model
    from demucs.apply import apply_model

    # Force CPU to avoid GPU memory issues, use float32 for stability
    device = torch.device("cpu")

    model = get_model("htdemucs")
    model.to(device)
    model.eval()

    # Load audio as float32 tensor [channels, samples]
    waveform, sr = torchaudio.load(input_path)

    # Demucs expects the model's native sample rate (44100 for htdemucs)
    model_sr = model.samplerate
    if sr != model_sr:
        waveform = torchaudio.functional.resample(waveform, sr, model_sr)

    # Ensure stereo (Demucs expects 2 channels)
    if waveform.shape[0] == 1:
        waveform = waveform.repeat(2, 1)

    # Store original length before padding (for trimming output later)
    original_length = waveform.shape[1]

    # Use smaller segments to reduce memory usage
    # 5 seconds is a good balance between quality and memory
    segment_seconds = 5.0
    segment_samples = int(segment_seconds * model_sr)

    # Pad audio to be a multiple of segment_samples for clean chunk processing
    remainder = waveform.shape[1] % segment_samples
    if remainder != 0:
        pad_amount = segment_samples - remainder
        waveform = torch.nn.functional.pad(waveform, (0, pad_amount))

    # Normalize for stable processing
    ref = waveform.mean(0)
    ref_mean = ref.mean()
    ref_std = ref.std()
    waveform = (waveform - ref_mean) / ref_std

    # Run separation with small chunks and minimal overlap to save memory
    with torch.no_grad():
        sources = apply_model(
            model,
            waveform[None],
            device=device,
            split=True,
            overlap=0.1,  # Reduced overlap to save memory
            segment=segment_seconds,
            shifts=0,
            progress=False,
        )[0]

    # Denormalize
    sources = sources * ref_std + ref_mean

    # htdemucs sources: drums, bass, other, vocals — vocals is index 3
    vocals = sources[model.sources.index("vocals")]

    # Trim back to original length (remove padding)
    vocals = vocals[:, :original_length]

    # Convert back to mono and resample to original rate
    vocals_mono = vocals.mean(dim=0, keepdim=True)
    if sr != model_sr:
        vocals_mono = torchaudio.functional.resample(vocals_mono, model_sr, sr)

    vocals_path = os.path.join(output_dir, "vocals.wav")
    torchaudio.save(vocals_path, vocals_mono.cpu(), sr)

    # Aggressively free memory
    del model, sources, waveform, vocals, vocals_mono, ref
    gc.collect()
    torch.cuda.empty_cache() if torch.cuda.is_available() else None

    # Force MKL memory release
    try:
        import ctypes
        mkl_rt = ctypes.CDLL('mkl_rt.dll' if sys.platform == 'win32' else 'libmkl_rt.so')
        mkl_rt.mkl_free_buffers()
    except:
        pass  # MKL not available or already freed

    return vocals_path


def run_deepfilternet(input_path: str, output_path: str, atten_lim_db: float = 12.0):
    """Run DeepFilterNet3 noise removal with limited attenuation to preserve voice character."""
    from df.enhance import enhance, init_df, load_audio, save_audio

    model, df_state, _ = init_df()
    audio, _ = load_audio(input_path, sr=df_state.sr())
    enhanced = enhance(model, df_state, audio, atten_lim_db=atten_lim_db)
    save_audio(output_path, enhanced, sr=df_state.sr())


def run_eq_chain(input_path: str, output_path: str):
    """FFmpeg voice EQ chain tuned for talking-head videos."""
    cmd = [
        "ffmpeg", "-y", "-i", input_path, "-af",
        ",".join([
            # Highpass — remove rumble
            "highpass=f=80",
            # Lowpass — keep air and sibilance, cut above 18 kHz
            "lowpass=f=18000",
            # Cut room boom — talking heads often have 300 Hz buildup
            "equalizer=f=300:width_type=o:width=1.0:g=-2",
            # Presence — clarity and intelligibility on phone speakers
            "equalizer=f=3500:width_type=o:width=1.5:g=2",
            # Compression — even dynamics, slow attack preserves consonants
            "acompressor=threshold=0.08:ratio=3:attack=10:release=150:makeup=3:knee=8",
            # Limiter — prevent clipping with -1 dBTP headroom
            "alimiter=limit=0.89",
        ]),
        "-ar", "48000", output_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def loudness_normalize(input_path: str, output_path: str, target_lufs: float = -16.0):
    """Normalize loudness to target LUFS and clamp true peak to -1 dBTP."""
    data, rate = sf.read(input_path)
    meter = pyln.Meter(rate)
    loudness = meter.integrated_loudness(data)

    # Normalize to target LUFS
    normalized = pyln.normalize.loudness(data, loudness, target_lufs)

    # Clamp true peak to -1 dBTP (0.891 linear)
    peak = np.max(np.abs(normalized))
    if peak > 0.891:
        normalized = normalized / peak * 0.891

    sf.write(output_path, normalized, rate)


def main():
    parser = argparse.ArgumentParser(description="Enhance speech audio for social media")
    parser.add_argument("--input", required=True, help="Input WAV file (48kHz)")
    parser.add_argument("--output", required=True, help="Output WAV file (enhanced)")
    parser.add_argument("--lufs", type=float, default=-16.0, help="Target loudness in LUFS (default: -16)")
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

        # Step 2: Demucs vocal separation (remove coughs, impacts, transients)
        emit_progress(12, "Separating speech with Demucs")
        vocals_path = run_demucs(prepped_path, tmp_dir)
        emit_progress(40, "Speech separation complete")

        # Step 3: DeepFilterNet3 residual noise removal
        emit_progress(42, "Removing noise")
        denoised_path = os.path.join(tmp_dir, "denoised.wav")
        run_deepfilternet(vocals_path, denoised_path)
        emit_progress(60, "Noise removal complete")

        # Step 4: EQ + compression + limiting
        emit_progress(62, "Applying EQ and compression")
        eq_path = os.path.join(tmp_dir, "eq.wav")
        run_eq_chain(denoised_path, eq_path)
        emit_progress(82, "EQ complete")

        # Step 5: Loudness normalization
        emit_progress(85, "Normalizing loudness")
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
