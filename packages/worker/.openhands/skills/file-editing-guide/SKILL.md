---
triggers:
  - str_replace
  - file editing
  - WriteFileTool
  - line numbers
  - edit failed
---

# File Editing Guide

## CRITICAL: Line Numbers in str_replace

**NEVER include line numbers in the old_str parameter!**

When you view a file, it shows:
```
     1  import React from 'react';
     2  import { useCurrentFrame } from 'remotion';
```

The numbers (1, 2) are **display formatting only** - NOT part of the file!

**WRONG:**
```
old_str: "     2  import { useCurrentFrame } from 'remotion';"
```

**CORRECT:**
```
old_str: "import { useCurrentFrame } from 'remotion';"
```

## CRITICAL: str_replace Failure Rule

**If str_replace fails ONCE, switch to WriteFileTool IMMEDIATELY.**

Do NOT:
- Retry with different whitespace
- Retry with more/fewer lines of context
- Try to "fix" the old_str

Instead, use WriteFileTool to rewrite the entire file.

## Tool Selection

### 1. file_editor (str_replace) - Default
Use for small, targeted edits where text is **unique** in the file.

### 2. WriteFileTool - When str_replace Fails
Use when:
- str_replace fails with "multiple occurrences"
- You need to rewrite most of the file
- Creating a new file

### 3. DiffPatchTool - Multiple Changes
Use when you have multiple related changes.

## Decision Flowchart

```
Need to edit?
├─ Text unique in file? → Use str_replace
├─ str_replace failed? → Use WriteFileTool IMMEDIATELY
└─ Multiple changes? → Use DiffPatchTool
```

## Root.tsx - Special Case

**DO NOT manually edit Root.tsx!**

Root.tsx is auto-generated. Instead:
1. Create component files (e.g., `src/MyProject/index.tsx`)
2. Export your main component
3. Include metadata.json
4. Root.tsx generates automatically
