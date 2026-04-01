#!/usr/bin/env python3
"""
Person Segmentation Script (RVM — Robust Video Matting)

Extracts a person alpha matte from a video clip using RVM.
Outputs an RGB (white-on-black) H.264 MP4 at 0.5x source resolution, 30fps,
encoded via FFmpeg subprocess pipe (NVENC with libx264 fallback).

Also outputs matte-bbox.json with per-frame speaker bounding boxes
(normalized 0-1 coordinates) for agent spatial positioning.

Progress protocol (stdout, parsed by TypeScript processor):
  - "Processing video: {W}x{H} @ {fps}fps, {total} frames"
  - "Processed {n} frames..."
  - "Done! Processed {n} frames"

Usage:
    python segment_person.py /path/to/clip.mp4 --output /path/to/matte.mp4
    python segment_person.py /path/to/clip.mp4 --output /path/to/matte.mp4 --backbone mobilenetv3
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import torch

# ---------------------------------------------------------------------------
# Configuration (tested on RTX 4050)
# ---------------------------------------------------------------------------
BACKBONE = "resnet50"
SCALE_FACTOR = 0.5
MATTE_FPS = 30
DOWNSAMPLE_RATIO = 0.8
SEQ_CHUNK = 4

# Model download URLs (official RVM GitHub releases)
MODEL_URLS = {
    "resnet50": "https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_resnet50.pth",
    "mobilenetv3": "https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3.pth",
}


def parse_arguments() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Extract person alpha matte from video using RVM."
    )
    parser.add_argument("input", type=str, help="Path to input video file")
    parser.add_argument(
        "--output",
        type=str,
        required=True,
        help="Output matte MP4 path",
    )
    parser.add_argument(
        "--backbone",
        type=str,
        default=BACKBONE,
        choices=["resnet50", "mobilenetv3"],
        help=f"RVM backbone (default: {BACKBONE})",
    )
    parser.add_argument(
        "--scale",
        type=float,
        default=SCALE_FACTOR,
        help=f"Output scale factor relative to source (default: {SCALE_FACTOR})",
    )
    parser.add_argument(
        "--fps",
        type=int,
        default=MATTE_FPS,
        help=f"Output matte FPS (default: {MATTE_FPS})",
    )
    parser.add_argument(
        "--downsample-ratio",
        type=float,
        default=DOWNSAMPLE_RATIO,
        help=f"RVM internal downsample ratio (default: {DOWNSAMPLE_RATIO})",
    )
    return parser.parse_args()


def probe_video(input_path: str) -> dict:
    """Probe video dimensions, fps, and duration using ffprobe."""
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,r_frame_rate,duration",
         "-show_entries", "format=duration",
         "-of", "csv=p=0", input_path],
        capture_output=True, text=True
    )
    lines = probe.stdout.strip().split("\n")
    parts = lines[0].split(",")
    src_w, src_h = int(parts[0]), int(parts[1])
    fps_num, fps_den = map(int, parts[2].split("/"))
    fps = fps_num / fps_den

    duration_s = 0
    for p in parts[3:]:
        try:
            duration_s = float(p)
            break
        except (ValueError, IndexError):
            pass
    if duration_s == 0 and len(lines) > 1:
        try:
            duration_s = float(lines[1].strip())
        except (ValueError, IndexError):
            pass

    return {"width": src_w, "height": src_h, "fps": fps, "duration_s": duration_s}


def load_rvm_model(backbone: str, device: torch.device, dtype: torch.dtype):
    """Load RVM from local torch hub cache, apply JIT script+freeze."""
    RVM_DIR = os.path.expanduser("~/.cache/torch/hub/PeterL1n_RobustVideoMatting_master")
    sys.path.insert(0, RVM_DIR)
    from model import MattingNetwork

    weights_file = f"rvm_{backbone}.pth"
    weights_path = os.path.expanduser(f"~/.cache/torch/hub/checkpoints/{weights_file}")
    if not os.path.exists(weights_path):
        url = MODEL_URLS[backbone]
        print(f"Downloading {backbone} weights: {url}")
        torch.hub.download_url_to_file(url, weights_path)

    model = MattingNetwork(backbone).eval().to(device, dtype)
    model.load_state_dict(torch.load(weights_path, map_location=device, weights_only=True))
    model = torch.jit.script(model)
    model = torch.jit.freeze(model)
    print(f"Model loaded: {backbone} | {device} | {dtype} | JIT frozen")
    return model


def make_ffmpeg_encoder(output_path: str, w: int, h: int, fps: int):
    """Create FFmpeg encoder subprocess for RGB matte output (NVENC with libx264 fallback)."""
    use_nvenc = w <= 4096 and h <= 4096
    if use_nvenc:
        codec_args = ["-c:v", "h264_nvenc", "-preset", "p1", "-rc", "constqp", "-qp", "18"]
    else:
        codec_args = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "18"]

    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{w}x{h}", "-r", str(fps),
        "-i", "pipe:0",
        *codec_args,
        "-pix_fmt", "yuv420p",
        output_path,
    ]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE, bufsize=w * h * 3 * SEQ_CHUNK)


def extract_matte_bboxes(matte_frames_u8: list, out_w: int, out_h: int, fps: int) -> dict:
    """Scan matte frames and extract per-frame speaker bounding boxes.

    Returns normalized 0-1 coordinates for each frame where a person is detected.
    """
    bbox_frames = []
    for idx, matte in enumerate(matte_frames_u8):
        # matte is [H, W] uint8 (0-255), find white pixel extent
        rows = np.any(matte > 32, axis=1)
        cols = np.any(matte > 32, axis=0)

        if not np.any(rows) or not np.any(cols):
            continue

        y_min = np.argmax(rows)
        y_max = out_h - np.argmax(rows[::-1])
        x_min = np.argmax(cols)
        x_max = out_w - np.argmax(cols[::-1])

        bbox_frames.append({
            "frame": idx,
            "x": round(float(x_min) / out_w, 4),
            "y": round(float(y_min) / out_h, 4),
            "w": round(float(x_max - x_min) / out_w, 4),
            "h": round(float(y_max - y_min) / out_h, 4),
        })

    return {
        "fps": fps,
        "frames": bbox_frames,
    }


def process_video(
    input_path: str,
    output_path: str,
    backbone: str,
    scale: float,
    fps: int,
    downsample_ratio: float,
) -> dict:
    """Run RVM segmentation on a video file, output RGB matte MP4 via FFmpeg pipe."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    use_fp16 = device.type == "cuda"
    dtype = torch.float16 if use_fp16 else torch.float32
    print(f"Using device: {device} | {dtype}")

    print(f"Loading RVM model ({backbone})...")
    model = load_rvm_model(backbone, device, dtype)

    info = probe_video(input_path)
    src_w, src_h = info["width"], info["height"]
    src_fps = info["fps"]
    duration_s = info["duration_s"]

    out_w = int(src_w * scale) // 2 * 2
    out_h = int(src_h * scale) // 2 * 2
    max_frames = int(duration_s * fps)

    print(f"Processing video: {src_w}x{src_h} @ {src_fps:.0f}fps, {max_frames} frames")
    print(f"Output: {out_w}x{out_h} @ {fps}fps, scale={scale}")

    if device.type == "cuda":
        rec = [None] * 4
        dummy = torch.randn(1, 1, 3, out_h, out_w, device=device, dtype=dtype)
        for _ in range(3):
            _, _, *rec = model(dummy, *rec, downsample_ratio)
        del dummy
        torch.cuda.synchronize()
        torch.cuda.empty_cache()

    decode_cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-hwaccel", "cuda",
        "-i", input_path,
        "-vf", f"scale={out_w}:{out_h},fps={fps}",
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "pipe:1",
    ]
    decoder = subprocess.Popen(
        decode_cmd, stdout=subprocess.PIPE,
        bufsize=out_w * out_h * 3 * SEQ_CHUNK,
    )

    encoder = make_ffmpeg_encoder(output_path, out_w, out_h, fps)

    frame_size = out_w * out_h * 3
    rec = [None] * 4
    frame_idx = 0
    start_time = time.time()
    all_matte_frames = []

    while True:
        frames_rgb = []
        for _ in range(SEQ_CHUNK):
            raw = decoder.stdout.read(frame_size)
            if len(raw) < frame_size:
                break
            frames_rgb.append(np.frombuffer(raw, dtype=np.uint8).reshape(out_h, out_w, 3))

        if not frames_rgb:
            break

        T = len(frames_rgb)
        batch = np.stack(frames_rgb)

        src = torch.from_numpy(batch).permute(0, 3, 1, 2).unsqueeze(0)
        src = src.to(device, dtype=dtype, non_blocking=True).div(255.0)

        with torch.no_grad():
            fgr, pha, *rec = model(src, *rec, downsample_ratio)

        mattes = pha[0, :, 0].float().mul(255).clamp(0, 255).byte().cpu().numpy()

        for t in range(T):
            matte_u8 = mattes[t]
            all_matte_frames.append(matte_u8)

            matte_rgb = np.stack([matte_u8, matte_u8, matte_u8], axis=-1)
            encoder.stdin.write(matte_rgb.tobytes())
            frame_idx += 1

        if frame_idx % 100 < SEQ_CHUNK:
            print(f"Processed {frame_idx} frames...")

    decoder.stdout.close()
    decoder.wait()
    encoder.stdin.close()
    encoder.wait()

    elapsed = time.time() - start_time
    print(f"Done! Processed {frame_idx} frames in {elapsed:.1f}s ({frame_idx / max(1, elapsed):.1f} fps)")

    print("Extracting speaker bounding boxes...")
    bbox_data = extract_matte_bboxes(all_matte_frames, out_w, out_h, fps)
    bbox_path = str(Path(output_path).parent / "matte-bbox.json")
    with open(bbox_path, "w") as f:
        json.dump(bbox_data, f)
    print(f"Bounding boxes saved: {bbox_path} ({len(bbox_data['frames'])} frames)")

    return {
        "framesProcessed": frame_idx,
        "framesWritten": frame_idx,
        "outputWidth": out_w,
        "outputHeight": out_h,
        "outputFps": fps,
        "bboxPath": bbox_path,
    }


def main():
    args = parse_arguments()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(2)

    result = process_video(
        str(input_path),
        args.output,
        args.backbone,
        args.scale,
        args.fps,
        args.downsample_ratio,
    )

    print(f"Matte saved: {args.output}")
    print(f"Bbox saved: {result['bboxPath']}")
    sys.exit(0)


if __name__ == "__main__":
    main()
