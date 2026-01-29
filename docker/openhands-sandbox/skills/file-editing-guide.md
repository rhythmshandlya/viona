# File Editing Guide

## Tool Selection

You have multiple tools for editing files. Choose the right tool for the situation:

### 1. FileEditorTool (str_replace) - Default Choice
Use for small, targeted edits where the text is **unique** in the file.

```
Good: Changing a function name that appears once
Bad: Editing import statements (often duplicated)
```

### 2. WriteFileTool - When str_replace Fails
Use when:
- str_replace fails with "multiple occurrences" error
- You need to rewrite most of the file anyway
- Creating a new file

**IMPORTANT**: If str_replace fails once, switch to WriteFileTool immediately.
Do NOT retry str_replace with different strings - it wastes time and tokens.

```python
# Action format:
WriteFileAction(
    path="src/MyComponent.tsx",
    content="... complete file content ..."
)
```

### 3. DiffPatchTool - Middle Ground
Use when:
- You have multiple related changes
- str_replace fails but you don't want to rewrite everything
- You want to be token-efficient

```python
# Action format:
DiffPatchAction(
    path="src/MyComponent.tsx",
    diff="""--- a/src/MyComponent.tsx
+++ b/src/MyComponent.tsx
@@ -10,7 +10,7 @@
 import React from 'react';

 export const MyComponent = () => {
-  return <div>Old</div>;
+  return <div>New</div>;
 };
"""
)
```

## Decision Flowchart

```
Need to edit a file?
    │
    ├─ Is the text unique in the file?
    │   ├─ YES → Use FileEditorTool (str_replace)
    │   └─ NO → Use WriteFileTool
    │
    └─ Did str_replace fail?
        ├─ YES → Use WriteFileTool immediately
        └─ NO → Continue
```

## Root.tsx - Special Case

**DO NOT manually edit Root.tsx to register compositions.**

Root.tsx is auto-generated after each generation cycle. Instead:
1. Create your component files (e.g., `src/MyProject/index.tsx`)
2. Export your main component
3. Include a metadata.json with video config
4. Root.tsx will be generated automatically

## Common Mistakes to Avoid

1. **Retrying str_replace**: If it fails once, switch tools immediately
2. **Partial file writes**: Always provide complete file content to WriteFileTool
3. **Editing Root.tsx**: Let the auto-generator handle it
4. **Missing imports**: When using WriteFileTool, include ALL imports

## File Structure for Compositions

```
src/
├── MyProject/
│   ├── index.tsx          # Main composition component
│   ├── metadata.json      # Video config (duration, fps, dimensions)
│   ├── Scene1.tsx         # Sub-components
│   └── Scene2.tsx
└── Root.tsx               # AUTO-GENERATED - don't edit manually
```
