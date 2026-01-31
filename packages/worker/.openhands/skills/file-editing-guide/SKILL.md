---
name: file-editing-guide
description: Correct file editing patterns for OpenHands. Covers str_replace failures, line number handling, and tool selection.
triggers:
  - str_replace
  - file editing
  - WriteFileTool
  - line numbers
  - edit failed
---

# File Editing

## Line Numbers Are Display-Only

File viewer shows:
```
     1  import React from 'react';
     2  import { useCurrentFrame } from 'remotion';
```

The numbers are NOT part of the file content.

```
❌ old_str: "     2  import { useCurrentFrame } from 'remotion';"
✅ old_str: "import { useCurrentFrame } from 'remotion';"
```

## str_replace Failure Rule

**If str_replace fails ONCE, switch to WriteFileTool immediately.**

Do NOT retry with different whitespace or context. Rewrite the entire file.

## Tool Selection

| Situation | Tool |
|-----------|------|
| Small, unique text edit | str_replace |
| str_replace failed | WriteFileTool |
| Rewriting most of file | WriteFileTool |
| Creating new file | WriteFileTool |
| Multiple related changes | DiffPatchTool |

## Root.tsx

Do NOT manually edit Root.tsx - it auto-generates from component exports.
