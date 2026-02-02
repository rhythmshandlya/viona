#!/usr/bin/env python3
"""
WhisperX transcription pipeline for Reelify.
Uses WhisperX for accurate word-level timestamps via wav2vec2 alignment.

Output: JSON with word-level timestamps to stdout.
Progress: PROGRESS:<percent>%:<message> to stderr.

Usage:
  python whisperx_transcribe.py --input audio.wav \
    [--model large-v2] [--language en] \
    [--device auto] [--compute-type float16] [--batch-size 16]
"""

import os
import sys
import json
import logging
import argparse
import warnings

# Force ALL logging and warnings to stderr so stdout stays clean for JSON output.
logging.basicConfig(stream=sys.stderr, level=logging.WARNING)
warnings.showwarning = lambda msg, cat, *a, **kw: print(f"{cat.__name__}: {msg}", file=sys.stderr)

# PyTorch 2.6+ defaults weights_only=True which breaks pyannote/whisperx model loading.
# Set env var before importing torch — this is the most reliable fix.
os.environ["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = "1"

import torch

# Belt-and-suspenders: also monkey-patch torch.load for code paths that
# call the function directly without respecting the env var.
_real_torch_load = torch.load.__wrapped__ if hasattr(torch.load, "__wrapped__") else torch.load
def _safe_load(*args, **kwargs):
    kwargs.setdefault("weights_only", False)
    return _real_torch_load(*args, **kwargs)
torch.load = _safe_load

import lightning_fabric.utilities.cloud_io as _cio
def _patched_cio_load(path_or_url, map_location=None, **kwargs):
    return torch.load(str(path_or_url), map_location=map_location)
_cio._load = _patched_cio_load

import whisperx


def emit_progress(percent: int, message: str):
    """Emit progress in format the Node worker can parse."""
    print(f"PROGRESS:{percent}%:{message}", file=sys.stderr, flush=True)


def detect_device(requested: str) -> str:
    """Resolve 'auto' device to cuda, mps, or cpu."""
    if requested == "auto":
        if torch.cuda.is_available():
            return "cuda"
        elif torch.backends.mps.is_available():
            # macOS Apple Silicon - use MPS for GPU acceleration
            # Note: WhisperX may have limited MPS support, fallback to CPU if issues
            return "cpu"  # MPS support in whisperx is experimental, safer to use CPU
        else:
            return "cpu"
    elif requested == "mps":
        if torch.backends.mps.is_available():
            return "cpu"  # WhisperX doesn't fully support MPS yet, use CPU
        else:
            print("WARNING: MPS requested but not available, falling back to CPU", file=sys.stderr)
            return "cpu"
    return requested


def main():
    parser = argparse.ArgumentParser(description="WhisperX transcription for Reelify")
    parser.add_argument("--input", required=True, help="Input audio file (WAV)")
    parser.add_argument("--model", default="large-v2", help="Whisper model size (default: large-v2)")
    parser.add_argument("--language", default="en", help="Language code (default: en)")
    parser.add_argument("--device", default="auto", help="Device: auto, cuda, cpu (default: auto)")
    parser.add_argument("--compute-type", default="float16", help="Compute type: float16, int8, float32 (default: float16)")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size for transcription (default: 16)")
    args = parser.parse_args()

    device = detect_device(args.device)
    compute_type = args.compute_type

    # CPU doesn't support float16
    if device == "cpu" and compute_type == "float16":
        compute_type = "float32"

    try:
        # Step 1: Load model
        emit_progress(5, "Loading WhisperX model")
        model = whisperx.load_model(
            args.model,
            device,
            compute_type=compute_type,
            language=args.language,
        )
        emit_progress(20, "Model loaded")

        # Step 2: Load audio
        emit_progress(22, "Loading audio")
        audio = whisperx.load_audio(args.input)
        emit_progress(25, "Audio loaded")

        # Step 3: Transcribe
        emit_progress(30, "Transcribing")
        result = model.transcribe(audio, batch_size=args.batch_size, language=args.language)
        emit_progress(60, "Transcription complete")

        # Step 4: Align with wav2vec2 for accurate word timestamps
        emit_progress(65, "Aligning word timestamps")
        align_model, align_metadata = whisperx.load_align_model(
            language_code=args.language,
            device=device,
        )
        result = whisperx.align(
            result["segments"],
            align_model,
            align_metadata,
            audio,
            device,
            return_char_alignments=False,
        )
        emit_progress(90, "Alignment complete")

        # Step 5: Format output
        emit_progress(92, "Formatting results")

        words = []
        for segment in result["segments"]:
            for word_info in segment.get("words", []):
                word = word_info.get("word", "").strip()
                if not word:
                    continue
                words.append({
                    "text": word,
                    "startMs": int(word_info.get("start", 0) * 1000),
                    "endMs": int(word_info.get("end", 0) * 1000),
                    "confidence": round(word_info.get("score", 1.0), 3),
                })

        output = {
            "words": words,
            "segments": [
                {
                    "text": seg.get("text", "").strip(),
                    "startMs": int(seg.get("start", 0) * 1000),
                    "endMs": int(seg.get("end", 0) * 1000),
                }
                for seg in result["segments"]
            ],
            "language": args.language,
        }

        emit_progress(100, "Done")

        # Output JSON to stdout
        print(json.dumps(output))

    except Exception as e:
        print(f"ERROR:{str(e)}", file=sys.stderr, flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
