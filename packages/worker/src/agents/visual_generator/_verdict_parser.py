"""Verdict parsing mixin — structured + text fallback parsing for verification agents."""

import json
import re


class VerdictParserMixin:
    """Mixin providing verdict parsing methods for ClaudeVisualGenerator."""

    def _parse_verdict_from_response(
        self,
        messages: list,
        label: str = "Verify",
    ) -> tuple[bool, list[str]]:
        """Parse structured verdict from agent response messages.

        Prefers submit_verdict tool results (structured JSON).
        Falls back to regex PASS/FAIL parsing for backwards compatibility.

        Args:
            messages: List of SDK message objects collected during response
            label: Label for logging (e.g. "SceneVerify3", "CompVerify")

        Returns:
            (passed, issues_list)
        """
        # 1. Check for submit_verdict tool use in messages
        for msg in messages:
            if not hasattr(msg, "content"):
                continue
            for block in msg.content:
                block_type = type(block).__name__

                # Check ToolUseBlock for submit_verdict calls
                if block_type == "ToolUseBlock" and hasattr(block, "name"):
                    if "submit_verdict" in getattr(block, "name", "") and hasattr(block, "input"):
                        inp = block.input
                        if isinstance(inp, dict) and "passed" in inp:
                            passed = bool(inp["passed"])
                            issues = list(inp.get("issues", []))
                            criteria = list(inp.get("acceptance_criteria", []))
                            if criteria:
                                issues.append("ACCEPTANCE CRITERIA: " + " | ".join(criteria))
                            print(f"[{label}] Structured verdict: {'PASS' if passed else 'FAIL'} ({len(issues)} issues)")
                            return passed, issues

                # Check ToolResultBlock for JSON verdict in tool output
                if block_type == "ToolResultBlock" and hasattr(block, "content"):
                    try:
                        content_str = ""
                        if isinstance(block.content, str):
                            content_str = block.content
                        elif isinstance(block.content, list):
                            for item in block.content:
                                if isinstance(item, dict) and item.get("type") == "text":
                                    content_str = item["text"]
                                    break
                        if content_str:
                            data = json.loads(content_str)
                            if "passed" in data:
                                passed = bool(data["passed"])
                                issues = list(data.get("issues", []))
                                criteria = list(data.get("acceptance_criteria", []))
                                if criteria:
                                    issues.append("ACCEPTANCE CRITERIA: " + " | ".join(criteria))
                                print(f"[{label}] Structured verdict (tool result): {'PASS' if passed else 'FAIL'} ({len(issues)} issues)")
                                return passed, issues
                    except (json.JSONDecodeError, TypeError, KeyError):
                        pass

        # 2. Fallback: regex parsing of response text
        response_text = ""
        for msg in messages:
            if not hasattr(msg, "content"):
                continue
            for block in msg.content:
                block_type = type(block).__name__
                if block_type == "TextBlock" and hasattr(block, "text"):
                    response_text += block.text

        print(f"[{label}] No structured verdict found, falling back to text parsing")
        return self._parse_verdict_text_fallback(response_text)

    def _parse_verdict_text_fallback(
        self,
        response_text: str,
    ) -> tuple[bool, list[str]]:
        """Legacy fallback: parse PASS/FAIL from free text."""
        lines = response_text.split("\n")
        verdict = None
        verdict_line_idx = -1

        for idx, line in enumerate(lines):
            stripped = line.strip().upper()
            if stripped == "PASS" or stripped.startswith("PASS:") or stripped.startswith("PASS.") or stripped.startswith("PASS -"):
                verdict = "PASS"
            elif stripped in ("FAIL", "ISSUES") or any(
                stripped.startswith(p) for p in ("FAIL:", "FAIL.", "FAIL -", "ISSUES:", "ISSUES.", "ISSUES -")
            ):
                verdict = "FAIL"
                verdict_line_idx = idx

        if verdict == "PASS":
            return True, []

        if verdict == "FAIL" and verdict_line_idx >= 0:
            issues: list[str] = []
            for line in lines[verdict_line_idx + 1:]:
                stripped = line.strip()
                m = re.match(r'^\d+[.)]\s+(.+)', stripped)
                if m:
                    issues.append(m.group(1))
            return False, issues

        # Ambiguous — no clear verdict, treat as pass
        return True, []
