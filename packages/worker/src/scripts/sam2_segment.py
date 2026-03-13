#!/usr/bin/env python3
"""
SAM2 Video Segmentation Script
Segments a person from video frames using SAM2.

Usage: python sam2_segment.py <frames_dir> <output_dir> [--device cuda|cpu]

Output: WebP alpha masks in output_dir, named 0001.webp, 0002.webp, etc.
Progress is reported to stdout as JSON: {"progress": 0.5, "frame": 100}
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

try:
    from sam2.build_sam import build_sam2_video_predictor
except ImportError:
    print(json.dumps({"error": "SAM2 not installed. Run: pip install sam2"}), file=sys.stderr)
    sys.exit(1)


def find_person_prompt(image: np.ndarray) -> tuple:
    h, w = image.shape[:2]
    point_coords = [[w // 2, int(h * 0.6)]]
    point_labels = [1]
    return point_coords, point_labels


def main():
    parser = argparse.ArgumentParser(description='SAM2 Video Segmentation')
    parser.add_argument('frames_dir', help='Directory containing input frames (PNG)')
    parser.add_argument('output_dir', help='Directory for output masks (WebP)')
    parser.add_argument('--device', default='cuda', choices=['cuda', 'cpu'])
    parser.add_argument('--model', default='sam2_hiera_large')
    args = parser.parse_args()

    frames_dir = Path(args.frames_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    frames = sorted(frames_dir.glob('*.png'))
    if not frames:
        print(json.dumps({"error": "No PNG frames found"}), file=sys.stderr)
        sys.exit(1)

    total_frames = len(frames)
    print(json.dumps({"status": "loading_model", "total_frames": total_frames}))

    predictor = build_sam2_video_predictor(args.model, device=args.device)

    first_frame = np.array(Image.open(frames[0]))
    point_coords, point_labels = find_person_prompt(first_frame)

    inference_state = predictor.init_state(video_path=str(frames_dir))

    predictor.add_new_points(
        inference_state=inference_state,
        frame_idx=0,
        obj_id=1,
        points=np.array(point_coords),
        labels=np.array(point_labels),
    )

    print(json.dumps({"status": "propagating", "total_frames": total_frames}))

    for frame_idx, (out_frame_idx, out_obj_ids, out_mask_logits) in enumerate(
        predictor.propagate_in_video(inference_state)
    ):
        mask = (out_mask_logits[0] > 0).cpu().numpy().astype(np.uint8) * 255
        mask_image = Image.fromarray(mask, mode='L')
        output_path = output_dir / f"{out_frame_idx + 1:04d}.webp"
        mask_image.save(output_path, 'WEBP', quality=90)

        progress = (frame_idx + 1) / total_frames
        print(json.dumps({"progress": progress, "frame": out_frame_idx}))
        sys.stdout.flush()

    print(json.dumps({"status": "complete", "total_frames": total_frames}))


if __name__ == '__main__':
    main()
