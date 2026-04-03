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
MATTE_FPS = 0  # 0 = use source native frame rate (recommended for alignment)
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
        help=f"Output matte FPS. 0 = use source native rate for perfect alignment (default: {MATTE_FPS})",
    )
    parser.add_argument(
        "--downsample-ratio",
        type=float,
        default=DOWNSAMPLE_RATIO,
        help=f"RVM internal downsample ratio (default: {DOWNSAMPLE_RATIO})",
    )
    parser.add_argument("--start-ms", type=int, default=0, help="(Deprecated) Scene start time in ms — use --bg-ranges instead")
    parser.add_argument("--end-ms", type=int, default=0, help="(Deprecated) Scene end time in ms — use --bg-ranges instead")
    parser.add_argument("--bg-output", type=str, default="", help="(Deprecated) Single bg output path — use --bg-ranges instead")
    parser.add_argument("--bg-ranges", type=str, default="", help="JSON array of {sceneId, startMs, endMs, output} for multiple background images")
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
    fps_frac = parts[2].strip()  # e.g., "30000/1001"
    fps_num, fps_den = map(int, fps_frac.split("/"))
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

    return {"width": src_w, "height": src_h, "fps": fps, "fps_frac": fps_frac, "duration_s": duration_s}


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


def make_ffmpeg_encoder(output_path: str, w: int, h: int, fps_str: str):
    """Create FFmpeg encoder subprocess for RGB matte output (NVENC with libx264 fallback)."""
    use_nvenc = w <= 4096 and h <= 4096
    if use_nvenc:
        codec_args = ["-c:v", "h264_nvenc", "-preset", "p1", "-rc", "constqp", "-qp", "18"]
    else:
        codec_args = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "18"]

    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{w}x{h}", "-r", fps_str,
        "-i", "pipe:0",
        *codec_args,
        "-pix_fmt", "yuv420p",
        output_path,
    ]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE, bufsize=w * h * 3 * SEQ_CHUNK)


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
    src_fps_frac = info["fps_frac"]  # e.g., "30000/1001"
    duration_s = info["duration_s"]

    # fps=0 means use source native rate (recommended for perfect frame alignment)
    if fps == 0:
        effective_fps = src_fps
        effective_fps_str = src_fps_frac  # pass fraction to FFmpeg for exact rate
    else:
        effective_fps = float(fps)
        effective_fps_str = str(fps)

    out_w = int(src_w * scale) // 2 * 2
    out_h = int(src_h * scale) // 2 * 2
    max_frames = int(duration_s * effective_fps)

    print(f"Processing video: {src_w}x{src_h} @ {src_fps:.2f}fps ({src_fps_frac}), {max_frames} frames")
    print(f"Output: {out_w}x{out_h} @ {effective_fps:.2f}fps, scale={scale}")

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
    ]
    if device.type == "cuda":
        decode_cmd.extend(["-hwaccel", "cuda"])
    # When using native fps (fps=0), don't apply fps filter — preserves exact frame correspondence.
    # When resampling (fps>0), apply fps filter to convert frame rate.
    vf = f"scale={out_w}:{out_h}" if fps == 0 else f"scale={out_w}:{out_h},fps={fps}"
    decode_cmd.extend([
        "-i", input_path,
        "-vf", vf,
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "pipe:1",
    ])
    decoder = subprocess.Popen(
        decode_cmd, stdout=subprocess.PIPE,
        bufsize=out_w * out_h * 3 * SEQ_CHUNK,
    )

    encoder = make_ffmpeg_encoder(output_path, out_w, out_h, effective_fps_str)
    fgr_output_path = str(Path(output_path).with_suffix('')) + '-fgr.mp4'
    fgr_encoder = make_ffmpeg_encoder(fgr_output_path, out_w, out_h, effective_fps_str)

    frame_size = out_w * out_h * 3
    rec = [None] * 4
    frame_idx = 0
    start_time = time.time()
    bbox_frames = []

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

            # Extract bbox inline (avoids storing all frames in memory)
            rows = np.any(matte_u8 > 32, axis=1)
            cols = np.any(matte_u8 > 32, axis=0)
            if np.any(rows) and np.any(cols):
                rmin, rmax = np.where(rows)[0][[0, -1]]
                cmin, cmax = np.where(cols)[0][[0, -1]]
                bbox_frames.append({
                    "frame": frame_idx,
                    "x": float(cmin / out_w),
                    "y": float(rmin / out_h),
                    "w": float((cmax - cmin + 1) / out_w),
                    "h": float((rmax - rmin + 1) / out_h),
                })

            matte_rgb = np.stack([matte_u8, matte_u8, matte_u8], axis=-1)
            encoder.stdin.write(matte_rgb.tobytes())

            # Extract foreground frame: fgr is [1, T, 3, H, W], need [H, W, 3] uint8
            fgr_frame = fgr[0, t].permute(1, 2, 0).float().mul(255).clamp(0, 255).cpu().numpy()
            # Premultiply by alpha (clean edges, transparent where no speaker)
            alpha_f = pha[0, t, 0].float().cpu().numpy()  # [H, W] in 0-1 range
            fgr_premul = (fgr_frame * alpha_f[:, :, np.newaxis]).clip(0, 255).astype(np.uint8)
            fgr_encoder.stdin.write(fgr_premul.tobytes())

            frame_idx += 1

        if frame_idx >= 100 and (frame_idx - T) // 100 < frame_idx // 100:
            elapsed_so_far = time.time() - start_time
            fps_so_far = frame_idx / max(0.1, elapsed_so_far)
            print(f"Processed {frame_idx} frames ({fps_so_far:.1f} fps)")

    decoder.stdout.close()
    decoder.wait()
    encoder.stdin.close()
    encoder.wait()
    fgr_encoder.stdin.close()
    fgr_encoder.wait()

    elapsed = time.time() - start_time
    print(f"Done! Processed {frame_idx} frames in {elapsed:.1f}s ({frame_idx / max(1, elapsed):.1f} fps)")
    print(f"Foreground video saved: {fgr_output_path}")

    bbox_data = {"fps": effective_fps, "frames": bbox_frames}
    bbox_path = str(Path(output_path).parent / "matte-bbox.json")
    with open(bbox_path, "w") as f:
        json.dump(bbox_data, f)
    print(f"Bounding boxes saved: {bbox_path} ({len(bbox_frames)} frames)")

    return {
        "framesProcessed": frame_idx,
        "framesWritten": frame_idx,
        "outputWidth": out_w,
        "outputHeight": out_h,
        "outputFps": effective_fps,
        "bboxPath": bbox_path,
        "fgrPath": fgr_output_path,
    }


def generate_background(input_path: str, matte_path: str, output_path: str, start_ms: int, end_ms: int) -> str:
    """Generate clean background by inpainting speaker out of a mid-scene frame using OpenAI."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Warning: OPENAI_API_KEY not set, skipping background generation", file=sys.stderr)
        return ""

    try:
        import base64
        import tempfile
        from io import BytesIO
        from PIL import Image
        from openai import OpenAI
    except ImportError as e:
        print(f"Warning: Missing dependency for background generation ({e}), skipping", file=sys.stderr)
        return ""

    try:
        client = OpenAI(api_key=api_key)

        # Probe source dimensions
        info = probe_video(input_path)
        src_w, src_h = info["width"], info["height"]

        # Extract midpoint frame from source video
        mid_sec = ((start_ms + end_ms) / 2) / 1000 if end_ms > start_ms else 1.0
        frame_tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        frame_tmp.close()
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-ss", f"{mid_sec:.3f}", "-i", input_path,
            "-frames:v", "1", "-q:v", "2", frame_tmp.name,
        ], check=True, timeout=30)

        # Extract matte frame at relative midpoint (matte is full-length)
        matte_frame_tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        matte_frame_tmp.close()
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-ss", f"{mid_sec:.3f}", "-i", matte_path,
            "-frames:v", "1", "-q:v", "2", matte_frame_tmp.name,
        ], check=True, timeout=30)

        # Load images
        import cv2
        source = cv2.imread(frame_tmp.name)
        matte_gray = cv2.imread(matte_frame_tmp.name, cv2.IMREAD_GRAYSCALE)

        if source is None or matte_gray is None:
            print("Warning: Failed to read frame/matte for background generation", file=sys.stderr)
            return ""

        h, w = source.shape[:2]

        # API-supported portrait size
        api_w, api_h = 1024, 1536

        # Resize source to API dimensions
        source_rgb = cv2.cvtColor(source, cv2.COLOR_BGR2RGB)
        source_pil = Image.fromarray(source_rgb).resize((api_w, api_h), Image.LANCZOS)

        # Create mask: dilate matte, then make RGBA where speaker = transparent (to inpaint)
        _, mask_bin = cv2.threshold(matte_gray, 100, 255, cv2.THRESH_BINARY)
        kernel = np.ones((25, 25), np.uint8)
        mask_dilated = cv2.dilate(mask_bin, kernel, iterations=2)
        mask_resized = cv2.resize(mask_dilated, (api_w, api_h))

        mask_rgba = np.zeros((api_h, api_w, 4), dtype=np.uint8)
        mask_rgba[:, :, 3] = 255 - mask_resized  # transparent where speaker is
        mask_pil = Image.fromarray(mask_rgba)

        # Save temp files for API upload
        src_api_tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        source_pil.convert("RGBA").save(src_api_tmp.name, format="PNG")
        src_api_tmp.close()

        mask_api_tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        mask_pil.save(mask_api_tmp.name, format="PNG")
        mask_api_tmp.close()

        # Call OpenAI
        print("Generating clean background via OpenAI...")
        t0 = time.time()
        with open(src_api_tmp.name, "rb") as img_f, open(mask_api_tmp.name, "rb") as mask_f:
            result = client.images.edit(
                model="gpt-image-1",
                image=img_f,
                mask=mask_f,
                prompt="Remove the person completely. Fill the area with a natural continuation of the background environment. Match the exact lighting, colors, textures, and camera perspective. Empty scene, no person.",
                size=f"{api_w}x{api_h}",
            )
        elapsed = time.time() - t0

        image_bytes = base64.b64decode(result.data[0].b64_json)
        result_img = Image.open(BytesIO(image_bytes))
        result_img = result_img.resize((w, h), Image.LANCZOS)
        result_img.save(output_path)

        # Cleanup temp files
        for f in [frame_tmp.name, matte_frame_tmp.name, src_api_tmp.name, mask_api_tmp.name]:
            try:
                os.unlink(f)
            except OSError:
                pass

        print(f"Background generated in {elapsed:.1f}s: {output_path}")
        return output_path

    except Exception as e:
        print(f"Warning: Background generation failed: {e}", file=sys.stderr)
        return ""


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

    # Generate clean backgrounds
    if args.bg_ranges:
        # New: multiple bg images from JSON array
        ranges = json.loads(args.bg_ranges)
        for r in ranges:
            bg_out = r.get("output", "")
            if not bg_out:
                continue
            bg_path = generate_background(
                str(input_path),
                args.output,
                bg_out,
                r.get("startMs", 0),
                r.get("endMs", 0),
            )
            if bg_path:
                print(f"Background saved: {bg_path}")
    elif args.bg_output:
        # Legacy: single bg image
        bg_path = generate_background(
            str(input_path),
            args.output,
            args.bg_output,
            args.start_ms,
            args.end_ms,
        )
        if bg_path:
            print(f"Background saved: {bg_path}")

    sys.exit(0)


if __name__ == "__main__":
    main()
