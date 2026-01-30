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
        description="Score for visual quality - animations smooth, visually appealing, matches style (0-70, 70% weight)"
    )
    code_quality: int = Field(
        default=0,
        description="Score for code quality - clean code, best practices (0-10, 10% weight)"
    )
    issues: list[str] = Field(
        default_factory=list,
        description="List of issues found"
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
                "codeQuality": action.code_quality,
            },
            "issues": action.issues,
            "suggestion": action.suggestion,
        }

        return SubmitScoreObservation(
            success=True,
            message=f"Score of {action.score}/100 recorded successfully. "
                    f"Breakdown: correctness={action.correctness}, "
                    f"completeness={action.completeness}, "
                    f"visualQuality={action.visual_quality}, "
                    f"codeQuality={action.code_quality}"
        )


_SUBMIT_SCORE_DESCRIPTION = """Submit your evaluation score for the generated code.

IMPORTANT: You MUST call this tool at the end of your evaluation to submit your score.

SCORING WEIGHTS (total = 100):
- visual_quality: 0-70 (70% weight) - MOST IMPORTANT! Animations, visual appeal, style match
- correctness: 0-10 (10% weight) - TypeScript compiles, no runtime errors
- completeness: 0-10 (10% weight) - All files present, metadata.json complete
- code_quality: 0-10 (10% weight) - Clean code, Remotion best practices

Parameters:
- score: Overall score from 0-100 (should equal sum of breakdown scores)
- visual_quality: 0-70 - How good do the animations look? Smooth? Appealing? Matches style?
- correctness: 0-10 - Does the code compile and run without errors?
- completeness: 0-10 - Are all required files and components present?
- code_quality: 0-10 - Is the code clean and following best practices?
- issues: List of specific issues found during evaluation
- suggestion: Clear, actionable suggestion for the next iteration

Focus primarily on VISUAL QUALITY when scoring!
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
