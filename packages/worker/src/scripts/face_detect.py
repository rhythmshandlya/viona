#!/usr/bin/env python3
"""
Face Detection Script using MediaPipe
Usage: python face_detect.py <frames_dir>
Output: JSON array of face bounding boxes to stdout
"""

import argparse
import json
import sys
from pathlib import Path

import cv2
import mediapipe as mp


def main():
    parser = argparse.ArgumentParser(description='Face Detection')
    parser.add_argument('frames_dir', help='Directory containing input frames (PNG)')
    parser.add_argument('--min-confidence', type=float, default=0.5)
    args = parser.parse_args()

    frames_dir = Path(args.frames_dir)
    frames = sorted(frames_dir.glob('*.png'))

    if not frames:
        print(json.dumps({"error": "No PNG frames found"}), file=sys.stderr)
        sys.exit(1)

    mp_face_detection = mp.solutions.face_detection
    results = []

    with mp_face_detection.FaceDetection(
        model_selection=1,
        min_detection_confidence=args.min_confidence
    ) as face_detection:
        for frame_idx, frame_path in enumerate(frames):
            image = cv2.imread(str(frame_path))
            if image is None:
                continue

            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            detection_results = face_detection.process(rgb_image)

            if detection_results.detections:
                detection = detection_results.detections[0]
                bbox = detection.location_data.relative_bounding_box
                results.append({
                    "frame": frame_idx,
                    "x": float(bbox.xmin),
                    "y": float(bbox.ymin),
                    "width": float(bbox.width),
                    "height": float(bbox.height),
                    "confidence": float(detection.score[0])
                })

            if frame_idx % 10 == 0:
                print(json.dumps({"progress": frame_idx / len(frames)}), file=sys.stderr)
                sys.stderr.flush()

    print(json.dumps(results))


if __name__ == '__main__':
    main()
