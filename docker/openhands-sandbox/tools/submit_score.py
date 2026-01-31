"""
Submit Score Tool for OpenHands Critic Agent.

Allows the critic agent to submit a structured evaluation score.
The score is captured and returned to the caller.
"""

import json
from collections.abc import Sequence
from typing import Optional

from pydantic import Field

from openhands.sdk import (
    Action,
    ImageContent,
    Observation,
    TextContent,
    ToolDefinition,
)
from openhands.sdk.tool import ToolExecutor


# Global variable to store the last submitted score
_last_score = None


def get_last_score() -> Optional[dict]:
    """Get the last submitted score."""
    global _last_score
    return _last_score


def clear_last_score():
    """Clear the stored score for a new evaluation."""
    global _last_score
    _last_score = None


def set_last_score(score: dict):
    """Set the last score (primarily for testing)."""
    global _last_score
    _last_score = score


class SubmitScoreAction(Action):
    """Action to submit an evaluation score."""

    score: int = Field(
        description="Overall score from 0-100 (should roughly equal sum of breakdown scores)"
    )
    correctness: int = Field(
        default=0,
        description="Score for code correctness - TypeScript compiles, no errors (0-10, 10% weight)"
    )
    completeness: int = Field(
        default=0,
        description="Score for implementation completeness - all files present (0-10, 10% weight)"
    )
    visual_quality: int = Field(
        default=0,
        description="Score for visual quality - animations, visual appeal (0-50, 50% weight)"
    )
    transcript_alignment: int = Field(
        default=0,
        description="Score for transcript alignment - specific content visualized correctly (0-20, 20% weight)"
    )
    code_quality: int = Field(
        default=0,
        description="Score for code quality - clean code, best practices (0-10, 10% weight)"
    )
    issues: list[str] = Field(
        default_factory=list,
        description="List of issues found (especially unmet transcript criteria)"
    )
    suggestion: str = Field(
        default="",
        description="Actionable suggestion for improvement"
    )


class SubmitScoreObservation(Observation):
    """Observation confirming score submission."""

    success: bool = Field(default=True, description="Whether score was recorded")
    message: str = Field(default="", description="Confirmation message")

    @property
    def to_llm_content(self) -> Sequence[TextContent | ImageContent]:
        return [TextContent(text=self.message)]


class SubmitScoreExecutor(ToolExecutor[SubmitScoreAction, SubmitScoreObservation]):
    """Executor that records the submitted score."""

    def __call__(
        self,
        action: SubmitScoreAction,
        conversation=None
    ) -> SubmitScoreObservation:
        global _last_score

        # Store the score
        _last_score = {
            "score": action.score,
            "breakdown": {
                "correctness": action.correctness,
                "completeness": action.completeness,
                "visualQuality": action.visual_quality,
                "transcriptAlignment": action.transcript_alignment,
                "codeQuality": action.code_quality,
            },
            "issues": action.issues,
            "suggestion": action.suggestion,
        }

        return SubmitScoreObservation(
            success=True,
            message=f"Score of {action.score}/100 recorded. "
                    f"visual={action.visual_quality}/50, "
                    f"transcript={action.transcript_alignment}/20, "
                    f"correct={action.correctness}/10, "
                    f"complete={action.completeness}/10, "
                    f"quality={action.code_quality}/10"
        )


_SUBMIT_SCORE_DESCRIPTION = """Submit your evaluation score for the generated code.

IMPORTANT: You MUST call this tool to complete your evaluation.

SCORING WEIGHTS (total = 100):
- visual_quality: 0-50 (50%) - Animations, visual appeal, motion graphics
- transcript_alignment: 0-20 (20%) - Specific transcript content visualized correctly
- correctness: 0-10 (10%) - TypeScript compiles, no errors
- completeness: 0-10 (10%) - All files present
- code_quality: 0-10 (10%) - Clean code, best practices

Parameters:
- score: Overall score 0-100 (sum of breakdown scores)
- visual_quality: 0-50 - Animation quality, motion graphics, visual appeal
- transcript_alignment: 0-20 - How many transcript-specific criteria are met?
- correctness: 0-10 - Does code compile?
- completeness: 0-10 - All required files present?
- code_quality: 0-10 - Clean code?
- issues: Unmet transcript criteria and visual problems
- suggestion: Most impactful fix
"""


class SubmitScoreTool(ToolDefinition[SubmitScoreAction, SubmitScoreObservation]):
    """Tool for submitting evaluation scores."""

    name = "SubmitScoreTool"

    @classmethod
    def create(cls, conv_state) -> Sequence[ToolDefinition]:
        """Create SubmitScoreTool instance."""
        return [
            cls(
                description=_SUBMIT_SCORE_DESCRIPTION,
                action_type=SubmitScoreAction,
                observation_type=SubmitScoreObservation,
                executor=SubmitScoreExecutor(),
            )
        ]
