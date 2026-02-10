#!/usr/bin/env python3
"""
Head & Body Tracking Script

Detects face landmarks and upper body positions in talking-head videos.
Outputs JSON with frame-by-frame tracking data for smart placement of
animations and captions.

Usage:
    python detect_head.py /path/to/video.mp4
    python detect_head.py /path/to/video.mp4 --interval 5
    python detect_head.py /path/to/video.mp4 --debug
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

import cv2
import mediapipe as mp
import numpy as np

# MediaPipe face mesh landmark indices for key points
# Reference: https://github.com/google/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png
FACE_LANDMARKS = {
    'left_eye': 468,  # Left eye center (iris)
    'right_eye': 473,  # Right eye center (iris)
    'left_eye_outer': 33,
    'right_eye_outer': 263,
    'left_eye_inner': 133,
    'right_eye_inner': 362,
    'left_eyebrow_outer': 46,
    'right_eyebrow_outer': 276,
    'left_eyebrow_inner': 105,
    'right_eyebrow_inner': 334,
    'nose_tip': 1,
    'nose_bridge': 6,
    'mouth_center': 13,
    'mouth_left': 61,
    'mouth_right': 291,
    'upper_lip': 0,
    'lower_lip': 17,
    'chin': 152,
    'forehead': 10,
    'left_cheek': 234,
    'right_cheek': 454,
}

# Face outline landmarks for bounding box calculation
FACE_OUTLINE = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
                397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
                172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]

# MediaPipe pose landmark indices
POSE_LANDMARKS = {
    'left_shoulder': 11,
    'right_shoulder': 12,
    'left_wrist': 15,  # Proxy for hand position
    'right_wrist': 16,
}


def parse_arguments() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Detect head and body positions in talking-head videos.'
    )
    parser.add_argument(
        'input',
        type=str,
        help='Path to input video file'
    )
    parser.add_argument(
        '--interval',
        type=int,
        default=3,
        help='Sample every N frames (default: 3)'
    )
    parser.add_argument(
        '--output',
        type=str,
        default=None,
        help='Output JSON path (default: {input}_tracking.json)'
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Generate debug video with landmarks overlay'
    )
    parser.add_argument(
        '--min-confidence',
        type=float,
        default=0.5,
        help='Minimum detection confidence (default: 0.5)'
    )
    return parser.parse_args()


def init_mediapipe():
    """Initialize MediaPipe Holistic model."""
    mp_holistic = mp.solutions.holistic
    holistic = mp_holistic.Holistic(
        static_image_mode=False,
        model_complexity=1,
        smooth_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    return holistic, mp_holistic


def extract_face_landmarks(
    face_landmarks,
    width: int,
    height: int
) -> Optional[dict]:
    """Extract 20 key face landmarks from MediaPipe face mesh."""
    if face_landmarks is None:
        return None

    landmarks = {}
    for name, idx in FACE_LANDMARKS.items():
        # Handle iris landmarks (468-477) which may not always be present
        if idx >= len(face_landmarks.landmark):
            # Fallback to eye corner for iris landmarks
            if 'eye' in name and 'outer' not in name and 'inner' not in name:
                continue

        try:
            lm = face_landmarks.landmark[idx]
            landmarks[name] = {
                'x': int(lm.x * width),
                'y': int(lm.y * height),
            }
        except IndexError:
            continue

    return landmarks if landmarks else None


def calculate_bbox(
    face_landmarks,
    width: int,
    height: int,
    padding: float = 0.1
) -> Optional[dict]:
    """Calculate bounding box from face outline landmarks."""
    if face_landmarks is None:
        return None

    points = []
    for idx in FACE_OUTLINE:
        if idx < len(face_landmarks.landmark):
            lm = face_landmarks.landmark[idx]
            points.append((lm.x * width, lm.y * height))

    if not points:
        return None

    points = np.array(points)
    x_min, y_min = points.min(axis=0)
    x_max, y_max = points.max(axis=0)

    # Add padding
    w = x_max - x_min
    h = y_max - y_min
    x_min = max(0, x_min - w * padding)
    y_min = max(0, y_min - h * padding)
    x_max = min(width, x_max + w * padding)
    y_max = min(height, y_max + h * padding)

    return {
        'x': int(x_min),
        'y': int(y_min),
        'width': int(x_max - x_min),
        'height': int(y_max - y_min),
    }


def extract_body_landmarks(
    pose_landmarks,
    width: int,
    height: int,
    min_visibility: float = 0.5
) -> Optional[dict]:
    """Extract upper body landmarks from MediaPipe pose."""
    if pose_landmarks is None:
        return None

    body = {}
    landmark_mapping = {
        'left_shoulder': 'left_shoulder',
        'right_shoulder': 'right_shoulder',
        'left_wrist': 'left_hand',
        'right_wrist': 'right_hand',
    }

    for pose_name, output_name in landmark_mapping.items():
        idx = POSE_LANDMARKS[pose_name]
        lm = pose_landmarks.landmark[idx]
        visible = lm.visibility >= min_visibility

        body[output_name] = {
            'x': int(lm.x * width),
            'y': int(lm.y * height),
            'visible': visible,
        }

    return body


def calculate_confidence(face_landmarks, pose_landmarks) -> float:
    """Calculate overall detection confidence."""
    confidences = []

    if face_landmarks:
        # Use average visibility of key face landmarks
        key_indices = [1, 33, 263, 61, 291]  # nose, eyes, mouth corners
        for idx in key_indices:
            if idx < len(face_landmarks.landmark):
                # Face mesh doesn't have visibility, use presence as proxy
                confidences.append(1.0)

    if pose_landmarks:
        # Use shoulder visibility as body confidence
        for idx in [11, 12]:  # shoulders
            confidences.append(pose_landmarks.landmark[idx].visibility)

    return float(np.mean(confidences)) if confidences else 0.0


def process_video(
    video_path: str,
    interval: int,
    min_confidence: float,
    holistic,
) -> dict:
    """Process video and extract tracking data."""
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        print(f"Error: Could not open video file: {video_path}", file=sys.stderr)
        sys.exit(2)

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_ms = int((total_frames / fps) * 1000) if fps > 0 else 0

    result = {
        'video': {
            'width': width,
            'height': height,
            'fps': fps,
            'duration_ms': duration_ms,
            'total_frames': total_frames,
        },
        'settings': {
            'sample_interval': interval,
            'samples_count': 0,
        },
        'metadata': {
            'detection_rate': 0.0,
            'frames_processed': 0,
            'frames_with_face': 0,
            'frames_skipped': 0,
            'warnings': [],
        },
        'frames': [],
    }

    frame_idx = 0
    frames_with_face = 0
    frames_skipped = 0
    multiple_face_warning_count = 0

    print(f"Processing video: {width}x{height} @ {fps:.1f}fps, {total_frames} frames")
    print(f"Sampling every {interval} frames...")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % interval == 0:
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            # Process with MediaPipe
            results = holistic.process(rgb_frame)

            # Calculate confidence
            confidence = calculate_confidence(
                results.face_landmarks,
                results.pose_landmarks
            )

            timestamp_ms = int((frame_idx / fps) * 1000) if fps > 0 else 0

            if confidence >= min_confidence:
                # Extract landmarks
                face_landmarks = extract_face_landmarks(
                    results.face_landmarks, width, height
                )
                bbox = calculate_bbox(
                    results.face_landmarks, width, height
                )
                body_landmarks = extract_body_landmarks(
                    results.pose_landmarks, width, height
                )

                frame_data = {
                    'frame': frame_idx,
                    'timestamp_ms': timestamp_ms,
                    'face': {
                        'bbox': bbox,
                        'landmarks': face_landmarks,
                    } if face_landmarks else None,
                    'body': body_landmarks,
                    'confidence': round(confidence, 3),
                }

                if face_landmarks:
                    frames_with_face += 1
            else:
                # Low confidence - store null data
                frame_data = {
                    'frame': frame_idx,
                    'timestamp_ms': timestamp_ms,
                    'face': None,
                    'body': None,
                    'confidence': round(confidence, 3),
                    'detection_failed': True,
                }
                frames_skipped += 1

            result['frames'].append(frame_data)

            # Progress update every 100 samples
            if len(result['frames']) % 100 == 0:
                print(f"  Processed {len(result['frames'])} samples...")

        frame_idx += 1

    cap.release()

    # Update metadata
    samples_count = len(result['frames'])
    result['settings']['samples_count'] = samples_count
    result['metadata']['frames_processed'] = samples_count
    result['metadata']['frames_with_face'] = frames_with_face
    result['metadata']['frames_skipped'] = frames_skipped
    result['metadata']['detection_rate'] = round(
        frames_with_face / samples_count if samples_count > 0 else 0, 3
    )

    if multiple_face_warning_count > 0:
        result['metadata']['warnings'].append(
            f"Multiple faces detected in {multiple_face_warning_count} frames"
        )

    print(f"Done! Processed {samples_count} samples, {frames_with_face} with face detected")

    return result


def generate_debug_video(
    video_path: str,
    output_path: str,
    tracking_data: dict,
    interval: int,
    holistic,
    mp_holistic,
):
    """Generate debug video with landmarks overlay."""
    mp_drawing = mp.solutions.drawing_utils
    mp_drawing_styles = mp.solutions.drawing_styles

    cap = cv2.VideoCapture(video_path)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    frame_idx = 0
    tracking_idx = 0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    print(f"Generating debug video: {output_path}")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Process every frame for smooth video, but only draw tracked frames
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = holistic.process(rgb_frame)

        # Draw face mesh
        if results.face_landmarks:
            mp_drawing.draw_landmarks(
                frame,
                results.face_landmarks,
                mp_holistic.FACEMESH_CONTOURS,
                landmark_drawing_spec=None,
                connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_contours_style(),
            )

        # Draw pose
        if results.pose_landmarks:
            mp_drawing.draw_landmarks(
                frame,
                results.pose_landmarks,
                mp_holistic.POSE_CONNECTIONS,
                landmark_drawing_spec=mp_drawing_styles.get_default_pose_landmarks_style(),
            )

        # Draw bounding box from tracking data
        if frame_idx % interval == 0 and tracking_idx < len(tracking_data['frames']):
            frame_data = tracking_data['frames'][tracking_idx]
            if frame_data.get('face') and frame_data['face'].get('bbox'):
                bbox = frame_data['face']['bbox']
                cv2.rectangle(
                    frame,
                    (bbox['x'], bbox['y']),
                    (bbox['x'] + bbox['width'], bbox['y'] + bbox['height']),
                    (0, 255, 0),
                    2
                )
            tracking_idx += 1

        out.write(frame)
        frame_idx += 1

        if frame_idx % 300 == 0:
            print(f"  Debug video: {frame_idx}/{total_frames} frames...")

    cap.release()
    out.release()
    print(f"Debug video saved: {output_path}")


def main():
    args = parse_arguments()

    # Validate input file
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(2)

    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = input_path.parent / f"{input_path.stem}_tracking.json"

    # Initialize MediaPipe
    print("Initializing MediaPipe Holistic...")
    try:
        holistic, mp_holistic = init_mediapipe()
    except Exception as e:
        print(f"Error: Failed to initialize MediaPipe: {e}", file=sys.stderr)
        sys.exit(3)

    # Process video
    tracking_data = process_video(
        str(input_path),
        args.interval,
        args.min_confidence,
        holistic,
    )

    # Check if any faces were detected
    if tracking_data['metadata']['frames_with_face'] == 0:
        print("Warning: No faces detected in the entire video", file=sys.stderr)
        sys.exit(1)

    # Save JSON output
    with open(output_path, 'w') as f:
        json.dump(tracking_data, f, indent=2)
    print(f"Tracking data saved: {output_path}")

    # Generate debug video if requested
    if args.debug:
        debug_path = input_path.parent / f"{input_path.stem}_tracking_debug.mp4"
        # Reinitialize for debug pass
        holistic, mp_holistic = init_mediapipe()
        generate_debug_video(
            str(input_path),
            str(debug_path),
            tracking_data,
            args.interval,
            holistic,
            mp_holistic,
        )

    holistic.close()
    print("Done!")
    sys.exit(0)


if __name__ == '__main__':
    main()
