"""
Transcript Formatter

Converts WhisperX word-level output to a format optimized for the Director agent.
The Director needs to see exact timestamps to sync visuals with narration.
"""

from typing import TypedDict


class WordTiming(TypedDict):
    """Word timing from WhisperX."""
    word: str
    start: float
    end: float


class TranscriptSegment(TypedDict):
    """Transcript segment with timing."""
    text: str
    startMs: int
    endMs: int


def format_transcript_for_director(
    words: list[WordTiming],
    fps: int = 30
) -> str:
    """
    Convert WhisperX word-level output to Director-friendly format.

    Args:
        words: List of word timings from WhisperX
               Each dict has: {"word": str, "start": float, "end": float}
        fps: Frames per second for frame calculation

    Returns:
        Formatted transcript string with timestamp table and full text
    """
    # Debug: Log first few words to understand data format
    if words:
        print(f"[TranscriptFormatter] Received {len(words)} words", flush=True)
        print(f"[TranscriptFormatter] First word sample: {words[0]}", flush=True)
        if len(words) > 1:
            print(f"[TranscriptFormatter] Second word sample: {words[1]}", flush=True)
    else:
        print(f"[TranscriptFormatter] WARNING: No words received!", flush=True)

    if not words:
        return "## TRANSCRIPT\n\nNo transcript provided."

    lines = ["## TRANSCRIPT WITH TIMESTAMPS\n"]
    lines.append("| Time (s) | Frame | Word |")
    lines.append("|----------|-------|------|")

    for w in words:
        # Handle both formats: WhisperX uses text/startMs/endMs, some use word/start/end
        word = w.get("word") or w.get("text", "")

        # Handle timestamps: startMs (milliseconds) or start (seconds)
        if "startMs" in w:
            time_s = w.get("startMs", 0) / 1000.0
        else:
            time_s = w.get("start", 0)

        frame = int(time_s * fps)
        lines.append(f"| {time_s:.2f} | {frame} | {word} |")

    # Add full text for context
    lines.append("\n## FULL TEXT\n")
    full_text = " ".join(w.get("word") or w.get("text", "") for w in words)
    lines.append(full_text)

    # Add duration info
    if words:
        # Handle both formats for end time
        last_word = words[-1]
        if "endMs" in last_word:
            total_duration = last_word.get("endMs", 0) / 1000.0
        else:
            total_duration = last_word.get("end", 0)
        total_frames = int(total_duration * fps)
        lines.append(f"\n## DURATION\n")
        lines.append(f"- Total: {total_duration:.2f}s ({total_frames} frames at {fps}fps)")

    return "\n".join(lines)


def format_segments_for_director(
    segments: list[TranscriptSegment],
    fps: int = 30
) -> str:
    """
    Convert segment-level transcript to Director-friendly format.

    This is a fallback when word-level timing isn't available.
    Less precise than word-level but still useful.

    Args:
        segments: List of transcript segments
                  Each dict has: {"text": str, "startMs": int, "endMs": int}
        fps: Frames per second for frame calculation

    Returns:
        Formatted transcript string
    """
    if not segments:
        return "## TRANSCRIPT\n\nNo transcript provided."

    lines = ["## TRANSCRIPT WITH TIMESTAMPS\n"]
    lines.append("| Start (s) | Frame | End (s) | Text |")
    lines.append("|-----------|-------|---------|------|")

    for seg in segments:
        start_s = seg.get("startMs", 0) / 1000
        end_s = seg.get("endMs", 0) / 1000
        start_frame = int(start_s * fps)
        text = seg.get("text", "")
        # Truncate long text for table
        display_text = text[:50] + "..." if len(text) > 50 else text
        lines.append(f"| {start_s:.2f} | {start_frame} | {end_s:.2f} | {display_text} |")

    # Add full text
    lines.append("\n## FULL TEXT\n")
    full_text = " ".join(seg.get("text", "") for seg in segments)
    lines.append(full_text)

    # Add duration info
    if segments:
        total_duration = segments[-1].get("endMs", 0) / 1000
        total_frames = int(total_duration * fps)
        lines.append(f"\n## DURATION\n")
        lines.append(f"- Total: {total_duration:.2f}s ({total_frames} frames at {fps}fps)")

    return "\n".join(lines)


def extract_key_moments(
    words: list[WordTiming],
    fps: int = 30
) -> list[dict]:
    """
    Identify potential key moments in the transcript for visual sync.

    Looks for:
    - Question words (what, how, why) - potential hooks
    - Negation words (can't, won't, never) - potential problems
    - Transition words (but, however, instead) - potential insights
    - Emphatic words (always, every, all, never) - potential emphasis

    Args:
        words: List of word timings from WhisperX
        fps: Frames per second

    Returns:
        List of key moments with word, timestamp, frame, and type
    """
    key_moments = []

    # Keywords that often signal important moments
    hooks = {"what", "how", "why", "imagine", "ever", "wondered"}
    problems = {"can't", "cant", "won't", "wont", "never", "impossible", "problem", "issue", "challenge"}
    insights = {"but", "however", "instead", "actually", "trick", "secret", "solution", "answer"}
    emphasis = {"always", "every", "all", "never", "only", "just", "exactly", "precisely"}

    for w in words:
        # Handle both formats: word or text
        word_text = w.get("word") or w.get("text", "")
        word_lower = word_text.lower().strip(".,!?\"'")

        # Handle timestamps: startMs (milliseconds) or start (seconds)
        if "startMs" in w:
            timestamp = w.get("startMs", 0) / 1000.0
        else:
            timestamp = w.get("start", 0)
        frame = int(timestamp * fps)

        moment_type = None
        if word_lower in hooks:
            moment_type = "hook"
        elif word_lower in problems:
            moment_type = "problem"
        elif word_lower in insights:
            moment_type = "insight"
        elif word_lower in emphasis:
            moment_type = "emphasis"

        if moment_type:
            key_moments.append({
                "word": word_text,
                "timestamp": timestamp,
                "frame": frame,
                "type": moment_type,
            })

    return key_moments


def format_transcript_with_key_moments(
    words: list[WordTiming],
    fps: int = 30
) -> str:
    """
    Format transcript with both full timing table and highlighted key moments.

    This is the recommended format for the Director agent.

    Args:
        words: List of word timings from WhisperX
        fps: Frames per second

    Returns:
        Comprehensive formatted transcript string
    """
    # Get base formatted transcript
    base = format_transcript_for_director(words, fps)

    # Extract key moments
    key_moments = extract_key_moments(words, fps)

    if not key_moments:
        return base

    # Add key moments section
    lines = [base, "\n## KEY MOMENTS (potential sync points)\n"]
    lines.append("| Frame | Time (s) | Word | Type | Suggestion |")
    lines.append("|-------|----------|------|------|------------|")

    suggestions = {
        "hook": "Start visual intrigue here",
        "problem": "Show tension/challenge",
        "insight": "Reveal solution visual",
        "emphasis": "Emphasize with animation",
    }

    for moment in key_moments:
        suggestion = suggestions.get(moment["type"], "")
        lines.append(
            f"| {moment['frame']} | {moment['timestamp']:.2f} | "
            f"\"{moment['word']}\" | {moment['type']} | {suggestion} |"
        )

    return "\n".join(lines)
