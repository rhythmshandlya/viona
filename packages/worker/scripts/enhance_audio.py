#!/usr/bin/env python3
"""
Audio enhancement pipeline for Reelify.

Pipeline:
  1. DC offset removal + peak normalize
  2. Demucs htdemucs — isolate vocals (removes coughs, impacts, music)
  3. DeepFilterNet3 — remove residual stationary noise (hiss, hum)
  4. Resemble Enhance — generative CFM model that regenerates clean speech
     with full spectral content and natural harmonics
  5. FFmpeg EQ + compression + limiting
  6. Loudness normalization to -14 LUFS

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


def run_demucs(input_path: str, output_dir: str) -> str:
    """Run Demucs htdemucs to isolate the vocals stem.

    Returns the path to the extracted vocals WAV file.
    """
    import torch
    import torchaudio
    from demucs.pretrained import get_model
    from demucs.apply import apply_model

    model = get_model("htdemucs")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)

    # Load audio as float32 tensor [channels, samples]
    waveform, sr = torchaudio.load(input_path)

    # Demucs expects the model's native sample rate (44100 for htdemucs)
    model_sr = model.samplerate
    if sr != model_sr:
        waveform = torchaudio.functional.resample(waveform, sr, model_sr)

    # Ensure stereo (Demucs expects 2 channels)
    if waveform.shape[0] == 1:
        waveform = waveform.repeat(2, 1)

    # Run separation: output shape [batch, sources, channels, samples]
    ref = waveform.mean(0)
    waveform = (waveform - ref.mean()) / ref.std()
    sources = apply_model(model, waveform[None], device=device)[0]
    sources = sources * ref.std() + ref.mean()

    # htdemucs sources: drums, bass, other, vocals — vocals is index 3
    vocals = sources[model.sources.index("vocals")]

    # Convert back to mono and resample to original rate
    vocals_mono = vocals.mean(dim=0, keepdim=True)
    if sr != model_sr:
        vocals_mono = torchaudio.functional.resample(vocals_mono, model_sr, sr)

    vocals_path = os.path.join(output_dir, "vocals.wav")
    torchaudio.save(vocals_path, vocals_mono, sr)

    return vocals_path


def run_deepfilternet(input_path: str, output_path: str, atten_lim_db: float = 12.0):
    """Run DeepFilterNet3 noise removal with limited attenuation to preserve voice character."""
    from df.enhance import enhance, init_df, load_audio, save_audio

    model, df_state, _ = init_df()
    audio, _ = load_audio(input_path, sr=df_state.sr())
    enhanced = enhance(model, df_state, audio, atten_lim_db=atten_lim_db)
    save_audio(output_path, enhanced, sr=df_state.sr())


def _download_resemble_model() -> "pathlib.Path":
    """Download Resemble Enhance model weights via huggingface_hub.

    Returns the run_dir (enhancer_stage2) path.
    """
    from pathlib import Path
    from huggingface_hub import snapshot_download

    # Download to a stable cache directory
    cache_dir = Path.home() / ".cache" / "resemble-enhance"
    local_dir = cache_dir / "model_repo"

    if not (local_dir / "enhancer_stage2" / "hparams.yaml").exists():
        print("Downloading Resemble Enhance model...", file=sys.stderr, flush=True)
        snapshot_download(
            repo_id="ResembleAI/resemble-enhance",
            local_dir=str(local_dir),
            local_dir_use_symlinks=False,
        )

    return local_dir / "enhancer_stage2"


def run_resemble_enhance(input_path: str, output_path: str, nfe: int = 32, lambd: float = 0.5, tau: float = 0.5):
    """Run Resemble Enhance CFM-based generative speech enhancer.

    This regenerates clean speech with full spectral content rather than
    just subtracting noise.  The model extends bandwidth and restores
    harmonics that other stages may have removed.

    Args:
        input_path: WAV file to enhance.
        output_path: Where to write the enhanced WAV.
        nfe: Number of function evaluations for the ODE solver (more = better but slower).
        lambd: Denoiser strength [0, 1].  0.5 blends denoised + original mel features.
        tau: Prior temperature [0, 1].  Lower = more conservative, higher = more creative.
    """
    from unittest.mock import MagicMock
    import sys as _sys
    import pathlib

    # Shim deepspeed — only needed for training, never called during inference
    for mod in ('deepspeed', 'deepspeed.accelerator', 'deepspeed.runtime',
                'deepspeed.runtime.engine', 'deepspeed.runtime.utils'):
        if mod not in _sys.modules:
            _sys.modules[mod] = MagicMock()

    # Fix PosixPath in checkpoints saved on Linux — standard Windows workaround
    if os.name == 'nt':
        pathlib.PosixPath = pathlib.WindowsPath

    import torch
    import torchaudio

    # Download model via huggingface_hub (bypasses fragile git clone approach)
    run_dir = _download_resemble_model()

    from resemble_enhance.enhancer.inference import enhance

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    waveform, sr = torchaudio.load(input_path)

    # Resemble Enhance expects mono float32
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    dwav = waveform.squeeze(0)  # (samples,)

    # Run the CFM enhancer, passing run_dir so it skips the built-in git download
    enhanced_wav, new_sr = enhance(dwav, sr, device, nfe=nfe, solver="midpoint", lambd=lambd, tau=tau, run_dir=run_dir)

    # Save — enhanced_wav is a 1-D tensor
    torchaudio.save(output_path, enhanced_wav.unsqueeze(0).cpu(), new_sr)


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

        # Step 2: Demucs speech separation (isolate vocals from coughs, impacts, etc.)
        emit_progress(12, "Separating speech with Demucs")
        vocals_path = run_demucs(prepped_path, tmp_dir)
        emit_progress(40, "Speech separation complete")

        # Step 3: DeepFilterNet3 residual noise removal on isolated speech
        emit_progress(42, "Running DeepFilterNet3")
        denoised_path = os.path.join(tmp_dir, "denoised.wav")
        run_deepfilternet(vocals_path, denoised_path)
        emit_progress(55, "Noise removal complete")

        # Step 4: Resemble Enhance — generative spectral restoration
        emit_progress(57, "Regenerating speech with Resemble Enhance")
        regenerated_path = os.path.join(tmp_dir, "regenerated.wav")
        run_resemble_enhance(denoised_path, regenerated_path)
        emit_progress(80, "Speech regeneration complete")

        # Step 5: EQ + compression + limiting
        emit_progress(82, "Applying EQ and compression")
        eq_path = os.path.join(tmp_dir, "eq.wav")
        run_eq_chain(regenerated_path, eq_path)
        emit_progress(88, "EQ complete")

        # Step 6: Loudness normalization
        emit_progress(90, "Normalizing loudness")
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
