#!/usr/bin/env python3
"""
Test script for the audio enhancement pipeline.
Extracts audio from a video file, runs the enhancement pipeline,
and saves both original and enhanced audio for A/B comparison.

Usage:
  python test_enhance.py --input "C:\path\to\video.mp4"
"""

import argparse
import subprocess
import tempfile
import os
import sys
import time


def extract_audio(video_path: str, audio_path: str):
    """Extract audio from video as 48kHz mono WAV."""
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vn", "-acodec", "pcm_s16le", "-ar", "48000", "-ac", "1",
        audio_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def main():
    parser = argparse.ArgumentParser(description="Test audio enhancement pipeline")
    parser.add_argument("--input", required=True, help="Input video or audio file")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"ERROR: File not found: {args.input}")
        sys.exit(1)

    # Output files next to the input
    input_dir = os.path.dirname(args.input)
    base_name = os.path.splitext(os.path.basename(args.input))[0]
    original_wav = os.path.join(input_dir, f"{base_name}_original.wav")
    enhanced_wav = os.path.join(input_dir, f"{base_name}_enhanced.wav")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    enhance_script = os.path.join(script_dir, "enhance_audio.py")

    # Step 1: Extract audio
    print(f"[1/2] Extracting audio from: {args.input}")
    extract_audio(args.input, original_wav)
    print(f"       Saved original: {original_wav}")

    # Step 2: Run enhancement
    print(f"[2/2] Running enhancement pipeline...")
    start = time.time()

    proc = subprocess.Popen(
        [sys.executable, enhance_script, "--input", original_wav, "--output", enhanced_wav],
        stderr=subprocess.PIPE,
        text=True,
    )

    # Stream progress from stderr
    for line in proc.stderr:
        line = line.strip()
        if line.startswith("PROGRESS:"):
            print(f"       {line}")
        elif line.startswith("ERROR:"):
            print(f"  FAIL {line}")
        elif line:
            # Print other stderr lines (warnings, etc.) dimmed
            print(f"       [debug] {line}")

    proc.wait()
    elapsed = time.time() - start

    if proc.returncode != 0:
        print(f"\nPipeline FAILED (exit code {proc.returncode})")
        sys.exit(1)

    print(f"\nDone in {elapsed:.1f}s")
    print(f"  Original: {original_wav}")
    print(f"  Enhanced: {enhanced_wav}")
    print(f"\nOpen both files in an audio player to A/B compare.")


if __name__ == "__main__":
    main()
