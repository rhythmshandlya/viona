"""Transcript genre classifier for strategy selection."""

from prompts.loader import list_strategies


def classify_transcript(transcript: str) -> str:
    """Classify transcript into a genre strategy.

    Uses keyword heuristics to select the appropriate strategy.
    Falls back to 'explainer-videos' as the safe default.

    Args:
        transcript: The formatted transcript text.

    Returns:
        Genre name matching a strategy directory.
    """
    available = list_strategies()
    if not available:
        return "explainer-videos"

    text = transcript.lower()

    # Informative media signals
    informative_signals = [
        "country", "countries", "government", "president", "minister",
        "war", "conflict", "military", "geopolit", "election",
        "economy", "gdp", "inflation", "market", "stock",
        "news", "report", "according to", "study shows",
        "percent", "billion", "million", "population",
        "climate", "policy", "regulation", "law",
    ]

    informative_score = sum(1 for signal in informative_signals if signal in text)

    if informative_score >= 3 and "informative-media" in available:
        return "informative-media"

    return "explainer-videos"
