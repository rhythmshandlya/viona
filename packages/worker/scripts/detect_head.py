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
import urllib.request
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

# MediaPipe Tasks API
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# Model URLs for automatic download
FACE_LANDMARKER_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
POSE_LANDMARKER_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"

# Key face landmark indices (from 478 landmarks)
FACE_LANDMARKS = {
    'left_eye': 468,  # Left iris center
    'right_eye': 473,  # Right iris center
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

# Face outline for bounding box
FACE_OUTLINE = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
                397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
                172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]

# Pose landmark indices
POSE_LANDMARKS = {
    'left_shoulder': 11,
    'right_shoulder': 12,
    'left_wrist': 15,
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


def download_model(url: str, dest: Path) -> Path:
    """Download model file if not exists."""
    if dest.exists():
        return dest

    print(f"Downloading model: {dest.name}...")
    dest.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, dest)
    print(f"Model saved: {dest}")
    return dest


def get_models_dir() -> Path:
    """Get or create models directory."""
    models_dir = Path(__file__).parent / "models"
    models_dir.mkdir(exist_ok=True)
    return models_dir


def init_face_landmarker(models_dir: Path):
    """Initialize MediaPipe Face Landmarker."""
    model_path = download_model(
        FACE_LANDMARKER_MODEL_URL,
        models_dir / "face_landmarker.task"
    )

    base_options = python.BaseOptions(model_asset_path=str(model_path))
    options = vision.FaceLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
    )
    return vision.FaceLandmarker.create_from_options(options)


def init_pose_landmarker(models_dir: Path):
    """Initialize MediaPipe Pose Landmarker."""
    model_path = download_model(
        POSE_LANDMARKER_MODEL_URL,
        models_dir / "pose_landmarker_lite.task"
    )

    base_options = python.BaseOptions(model_asset_path=str(model_path))
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    return vision.PoseLandmarker.create_from_options(options)


def extract_face_landmarks(
    face_landmarks_list,
    width: int,
    height: int
) -> Optional[dict]:
    """Extract key face landmarks."""
    if not face_landmarks_list or len(face_landmarks_list) == 0:
        return None

    landmarks_data = face_landmarks_list[0]  # First face
    landmarks = {}

    for name, idx in FACE_LANDMARKS.items():
        if idx < len(landmarks_data):
            lm = landmarks_data[idx]
            landmarks[name] = {
                'x': int(lm.x * width),
                'y': int(lm.y * height),
            }

    return landmarks if landmarks else None


def calculate_bbox(
    face_landmarks_list,
    width: int,
    height: int,
    padding: float = 0.1
) -> Optional[dict]:
    """Calculate bounding box from face outline."""
    if not face_landmarks_list or len(face_landmarks_list) == 0:
        return None

    landmarks_data = face_landmarks_list[0]
    points = []

    for idx in FACE_OUTLINE:
        if idx < len(landmarks_data):
            lm = landmarks_data[idx]
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
    pose_landmarks_list,
    width: int,
    height: int,
    min_visibility: float = 0.5
) -> Optional[dict]:
    """Extract upper body landmarks."""
    if not pose_landmarks_list or len(pose_landmarks_list) == 0:
        return None

    landmarks_data = pose_landmarks_list[0]
    body = {}

    landmark_mapping = {
        'left_shoulder': 'left_shoulder',
        'right_shoulder': 'right_shoulder',
        'left_wrist': 'left_hand',
        'right_wrist': 'right_hand',
    }

    for pose_name, output_name in landmark_mapping.items():
        idx = POSE_LANDMARKS[pose_name]
        if idx < len(landmarks_data):
            lm = landmarks_data[idx]
            visible = lm.visibility >= min_visibility if hasattr(lm, 'visibility') else True

            body[output_name] = {
                'x': int(lm.x * width),
                'y': int(lm.y * height),
                'visible': visible,
            }

    return body if body else None


def process_video(
    video_path: str,
    interval: int,
    min_confidence: float,
    face_landmarker,
    pose_landmarker,
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

    # Shot detection state
    prev_hsv = None
    prev_face_center = None  # (cx, cy) in pixel coords
    prev_face_area = None    # bbox area in pixels
    prev_confidence = 0.0
    frame_diagonal = np.sqrt(width ** 2 + height ** 2)
    raw_shot_boundaries = []  # collected during loop, merged after

    # Scale HSV threshold by frame gap — higher fps = less change per frame
    # Base: 35 calibrated for ~100ms gap (30fps, interval=3)
    frame_gap_ms = (interval / fps * 1000) if fps > 0 else 100
    hsv_threshold = 35 * min(1.5, max(1.0, 100.0 / frame_gap_ms))  # scale up for shorter gaps, cap at 1.5x

    print(f"Processing video: {width}x{height} @ {fps:.1f}fps, {total_frames} frames")
    print(f"Sampling every {interval} frames...")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % interval == 0:
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            # HSV conversion for shot detection (reuses already-decoded frame)
            hsv_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

            # Create MediaPipe Image
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

            # Calculate timestamp in milliseconds
            timestamp_ms = int((frame_idx / fps) * 1000) if fps > 0 else 0

            # Detect face landmarks
            try:
                face_result = face_landmarker.detect_for_video(mp_image, timestamp_ms)
                face_landmarks_list = face_result.face_landmarks if face_result else None
            except Exception as e:
                face_landmarks_list = None

            # Detect pose landmarks
            try:
                pose_result = pose_landmarker.detect_for_video(mp_image, timestamp_ms)
                pose_landmarks_list = pose_result.pose_landmarks if pose_result else None
            except Exception as e:
                pose_landmarks_list = None

            # Extract landmarks
            face_landmarks = extract_face_landmarks(face_landmarks_list, width, height)
            bbox = calculate_bbox(face_landmarks_list, width, height)
            body_landmarks = extract_body_landmarks(pose_landmarks_list, width, height)

            # Calculate confidence
            has_face = face_landmarks is not None
            has_body = body_landmarks is not None
            confidence = 1.0 if has_face else (0.5 if has_body else 0.0)

            if confidence >= min_confidence:
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
                frame_data = {
                    'frame': frame_idx,
                    'timestamp_ms': timestamp_ms,
                    'face': None,
                    'body': body_landmarks,
                    'confidence': round(confidence, 3),
                    'detection_failed': True,
                }
                frames_skipped += 1

            result['frames'].append(frame_data)

            # --- Shot boundary detection ---
            shot_signals = []
            hsv_score = 0.0
            bbox_score = 0.0
            size_score = 0.0
            confidence_score = 0.0

            # HSV frame diff
            if prev_hsv is not None:
                diff = cv2.absdiff(hsv_frame, prev_hsv).astype(np.float32)
                # Weighted: H=1.0, S=1.0, V=0.5
                weighted = diff[:, :, 0] * 1.0 + diff[:, :, 1] * 1.0 + diff[:, :, 2] * 0.5
                hsv_diff = float(np.mean(weighted))
                hsv_score = min(1.0, hsv_diff / (hsv_threshold * 1.7))
                if hsv_diff > hsv_threshold:
                    shot_signals.append('hsv_diff')

            prev_hsv = hsv_frame

            # Face-based signals (only when both frames have valid face)
            cur_face_center = None
            cur_face_area = None
            if bbox is not None:
                cx = bbox['x'] + bbox['width'] / 2.0
                cy = bbox['y'] + bbox['height'] / 2.0
                cur_face_center = (cx, cy)
                cur_face_area = bbox['width'] * bbox['height']

            if cur_face_center is not None and prev_face_center is not None:
                # Bbox displacement
                dx = cur_face_center[0] - prev_face_center[0]
                dy = cur_face_center[1] - prev_face_center[1]
                displacement = np.sqrt(dx ** 2 + dy ** 2) / frame_diagonal
                bbox_score = min(1.0, displacement / 0.5)
                if displacement > 0.25:
                    shot_signals.append('bbox_jump')

                # Face size ratio
                if prev_face_area and prev_face_area > 0:
                    size_ratio_change = abs(1.0 - cur_face_area / prev_face_area)
                    size_score = min(1.0, size_ratio_change / 0.8)
                    if size_ratio_change > 0.4:
                        shot_signals.append('size_change')

            prev_face_center = cur_face_center
            prev_face_area = cur_face_area

            # Confidence drop
            if prev_confidence >= 0.5 and confidence < 0.5:
                confidence_score = 1.0
                shot_signals.append('confidence_drop')
            elif prev_confidence < 0.5 and confidence >= 0.5:
                confidence_score = 1.0
                shot_signals.append('confidence_rise')
            prev_confidence = confidence

            # Combined score
            face_combined = 0.4 * bbox_score + 0.3 * size_score + 0.3 * confidence_score
            combined_score = max(hsv_score, face_combined)

            if combined_score > 0.75 and shot_signals:
                raw_shot_boundaries.append({
                    'frame': frame_idx,
                    'timestamp_ms': timestamp_ms,
                    'score': round(combined_score, 3),
                    'signals': shot_signals,
                })

            # Progress update
            if len(result['frames']) % 100 == 0:
                print(f"  Processed {len(result['frames'])} samples...")

        frame_idx += 1

    cap.release()

    # Merge adjacent shot boundaries within 1000ms
    merged_shots = []
    for shot in raw_shot_boundaries:
        if merged_shots and (shot['timestamp_ms'] - merged_shots[-1]['timestamp_ms']) < 1000:
            # Keep the one with higher score
            if shot['score'] > merged_shots[-1]['score']:
                merged_shots[-1] = shot
        else:
            merged_shots.append(shot)

    result['shots'] = merged_shots

    # Update metadata
    samples_count = len(result['frames'])
    result['settings']['samples_count'] = samples_count
    result['metadata']['frames_processed'] = samples_count
    result['metadata']['frames_with_face'] = frames_with_face
    result['metadata']['frames_skipped'] = frames_skipped
    result['metadata']['detection_rate'] = round(
        frames_with_face / samples_count if samples_count > 0 else 0, 3
    )
    result['metadata']['shots_detected'] = len(merged_shots)

    print(f"Done! Processed {samples_count} samples, {frames_with_face} with face detected, {len(merged_shots)} shot boundaries")

    return result


def generate_debug_video(
    video_path: str,
    output_path: str,
    tracking_data: dict,
    interval: int,
):
    """Generate debug video with landmarks overlay."""
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

        # Draw tracking data for sampled frames
        if frame_idx % interval == 0 and tracking_idx < len(tracking_data['frames']):
            frame_data = tracking_data['frames'][tracking_idx]

            # Draw bounding box
            if frame_data.get('face') and frame_data['face'].get('bbox'):
                bbox = frame_data['face']['bbox']
                cv2.rectangle(
                    frame,
                    (bbox['x'], bbox['y']),
                    (bbox['x'] + bbox['width'], bbox['y'] + bbox['height']),
                    (0, 255, 0),
                    2
                )

            # Draw face landmarks
            if frame_data.get('face') and frame_data['face'].get('landmarks'):
                for name, point in frame_data['face']['landmarks'].items():
                    color = (0, 255, 255)  # Yellow for face
                    if 'eye' in name:
                        color = (255, 0, 0)  # Blue for eyes
                    elif 'mouth' in name or 'lip' in name:
                        color = (0, 0, 255)  # Red for mouth
                    cv2.circle(frame, (point['x'], point['y']), 3, color, -1)

            # Draw body landmarks
            if frame_data.get('body'):
                for name, point in frame_data['body'].items():
                    if point.get('visible', True):
                        color = (255, 0, 255)  # Magenta for body
                        cv2.circle(frame, (point['x'], point['y']), 5, color, -1)
                        cv2.putText(frame, name, (point['x'] + 5, point['y'] - 5),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

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

    # Get models directory
    models_dir = get_models_dir()

    # Initialize MediaPipe
    print("Initializing MediaPipe...")
    try:
        face_landmarker = init_face_landmarker(models_dir)
        pose_landmarker = init_pose_landmarker(models_dir)
    except Exception as e:
        print(f"Error: Failed to initialize MediaPipe: {e}", file=sys.stderr)
        sys.exit(3)

    # Process video
    tracking_data = process_video(
        str(input_path),
        args.interval,
        args.min_confidence,
        face_landmarker,
        pose_landmarker,
    )

    # Check if any faces were detected
    if tracking_data['metadata']['frames_with_face'] == 0:
        print("Warning: No faces detected in the entire video", file=sys.stderr)
        # Don't exit - still save the data with body landmarks

    # Save JSON output
    with open(output_path, 'w') as f:
        json.dump(tracking_data, f, indent=2)
    print(f"Tracking data saved: {output_path}")

    # Generate debug video if requested
    if args.debug:
        debug_path = input_path.parent / f"{input_path.stem}_tracking_debug.mp4"
        generate_debug_video(
            str(input_path),
            str(debug_path),
            tracking_data,
            args.interval,
        )

    face_landmarker.close()
    pose_landmarker.close()
    print("Done!")
    sys.exit(0)


if __name__ == '__main__':
    main()
