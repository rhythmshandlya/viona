# NPM Package Search & 3D Animation Support

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable the visual generator agent to discover and use npm packages dynamically, with pre-installed Three.js support for complex 3D animations.

**Architecture:** Pre-install core 3D packages, provide npm search tool with validation, bundle additional packages inline via esbuild.

**Tech Stack:** Python 3.10+, aiohttp, Three.js, React Three Fiber, Remotion

---

## Overview

The agent currently generates 2D Remotion compositions. This design adds:
1. Pre-installed Three.js ecosystem for 3D animations (rolling dice, 3D text, etc.)
2. NPM search tool so the agent can discover specialized packages
3. Automatic bundling of discovered packages for frontend compatibility

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Pre-installed Packages (remotion-template)                   │
│    - @remotion/three, @react-three/fiber, @react-three/drei     │
│    - three (core Three.js)                                      │
│    - Available immediately, no search needed                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. NPM Search Tool (npm_search.py)                              │
│    - Query: search_npm_packages("physics dice")                 │
│    - Validates: downloads, freshness, blocklist                 │
│    - Returns: validated package list with install commands      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Agent Installs Package                                       │
│    - npm install @react-three/cannon                            │
│    - Package added to workspace node_modules                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. esbuild Bundles Inline                                       │
│    - Non-external packages bundled into composition.cjs.js      │
│    - Frontend loads self-contained bundle                       │
│    - No frontend changes needed for new packages                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Task 1: Add Three.js to remotion-template

**File:** `packages/worker/remotion-template/package.json`

**Add dependencies:**

```json
{
  "dependencies": {
    "@remotion/three": "4.0.414",
    "@react-three/fiber": "^9.0.0",
    "@react-three/drei": "^10.0.0",
    "three": "^0.170.0"
  }
}
```

**Note:** React 19 requires fiber v9 and drei v10 (see [R3F v9 Migration Guide](https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide)).

**Run in remotion-template:**
```bash
npm install
```

---

## Task 2: Add @remotion/three to Frontend

**File:** `apps/web/package.json`

**Add dependency:**

```json
{
  "dependencies": {
    "@remotion/three": "4.0.414"
  }
}
```

---

## Task 3: Update DynamicVisualLoader

**File:** `apps/web/src/features/editor-v2/player/DynamicVisualLoader.tsx`

**Add import:**

```typescript
import * as RemotionThree from '@remotion/three';
```

**Update customRequire function (around line 68):**

```typescript
const customRequire = (moduleName: string) => {
  if (moduleName === 'react') return React;
  if (moduleName === 'react/jsx-runtime') {
    const jsx = (type: any, props: any, key?: string) => {
      if (key !== undefined) {
        return React.createElement(type, { ...props, key });
      }
      return React.createElement(type, props);
    };
    return {
      jsx,
      jsxs: jsx,
      Fragment: React.Fragment,
    };
  }
  if (moduleName === 'react/jsx-dev-runtime') {
    const jsxDEV = (type: any, props: any, key?: string) => {
      if (key !== undefined) {
        return React.createElement(type, { ...props, key });
      }
      return React.createElement(type, props);
    };
    return {
      jsxDEV,
      Fragment: React.Fragment,
    };
  }
  if (moduleName === 'remotion') return Remotion;
  if (moduleName === '@remotion/noise') return RemotionNoise;
  if (moduleName === '@remotion/shapes') return RemotionShapes;
  if (moduleName === '@remotion/paths') return RemotionPaths;
  if (moduleName === '@remotion/three') return RemotionThree;  // ADD THIS
  throw new Error(`Unknown module: ${moduleName}`);
};
```

---

## Task 4: Update esbuild Externals

**File:** `packages/worker/src/agents/claude_visual_generator.py`

**Find the esbuild command in `_compile_cjs` method and add:**

```python
"--external:@remotion/three",
```

**Full externals list should be:**

```python
"--external:react",
"--external:react/jsx-runtime",
"--external:react/jsx-dev-runtime",
"--external:remotion",
"--external:@remotion/noise",
"--external:@remotion/shapes",
"--external:@remotion/paths",
"--external:@remotion/three",  # ADD THIS
```

---

## Task 5: Create NPM Search Tool

**File:** `packages/worker/src/agents/npm_search.py`

```python
#!/usr/bin/env python3
"""
NPM Package Search Tool

Searches npm registry and validates packages before allowing installation.
"""

import aiohttp
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

NPM_SEARCH_URL = "https://registry.npmjs.org/-/v1/search"
NPM_DOWNLOADS_URL = "https://api.npmjs.org/downloads/point/last-week"

MIN_WEEKLY_DOWNLOADS = 1000
MAX_STALE_DAYS = 365

BLOCKLIST = {
    "node-ipc",
    "colors",
    "faker",
    "event-stream",
    "flatmap-stream",
    "rc",
}


@dataclass
class NpmPackageInfo:
    """Information about an npm package."""
    name: str
    version: str
    description: str
    weekly_downloads: int
    last_publish: str
    install_command: str
    passed_validation: bool
    rejection_reason: Optional[str] = None


async def search_npm_packages(
    query: str,
    limit: int = 5,
) -> list[NpmPackageInfo]:
    """
    Search npm for packages matching query, with validation.

    Args:
        query: Search terms (e.g., "3d dice physics")
        limit: Maximum validated packages to return

    Returns:
        List of NpmPackageInfo, validated packages first
    """
    async with aiohttp.ClientSession() as session:
        # Search npm registry
        params = {"text": query, "size": limit * 3}
        async with session.get(NPM_SEARCH_URL, params=params) as resp:
            if resp.status != 200:
                return []
            data = await resp.json()

        results = []
        valid_count = 0

        for obj in data.get("objects", []):
            pkg = obj.get("package", {})

            info = await _validate_package(session, pkg)
            results.append(info)

            if info.passed_validation:
                valid_count += 1
                if valid_count >= limit:
                    break

        # Sort: validated first, then by downloads
        return sorted(
            results,
            key=lambda x: (not x.passed_validation, -x.weekly_downloads)
        )


async def _validate_package(
    session: aiohttp.ClientSession,
    pkg: dict,
) -> NpmPackageInfo:
    """Validate a single package against criteria."""

    name = pkg.get("name", "")
    version = pkg.get("version", "")
    description = (pkg.get("description") or "")[:200]
    last_publish = (pkg.get("date") or "")[:10]

    # Fetch download counts
    weekly_downloads = 0
    try:
        url = f"{NPM_DOWNLOADS_URL}/{name}"
        async with session.get(url) as resp:
            if resp.status == 200:
                dl_data = await resp.json()
                weekly_downloads = dl_data.get("downloads", 0)
    except Exception:
        pass

    # Run validation checks
    rejection = None

    if name in BLOCKLIST:
        rejection = "Package is blocklisted (known malicious)"
    elif weekly_downloads < MIN_WEEKLY_DOWNLOADS:
        rejection = f"Too few downloads ({weekly_downloads:,}/week, need {MIN_WEEKLY_DOWNLOADS:,}+)"
    elif last_publish:
        try:
            pub_date = datetime.fromisoformat(last_publish)
            days_old = (datetime.now() - pub_date).days
            if days_old > MAX_STALE_DAYS:
                rejection = f"Stale package (last updated {last_publish})"
        except ValueError:
            pass

    return NpmPackageInfo(
        name=name,
        version=version,
        description=description,
        weekly_downloads=weekly_downloads,
        last_publish=last_publish,
        install_command=f"npm install {name}",
        passed_validation=rejection is None,
        rejection_reason=rejection,
    )


def format_search_results(results: list[NpmPackageInfo]) -> str:
    """Format search results for display to the agent."""
    if not results:
        return "No packages found matching query."

    output = []
    for pkg in results:
        status = "VALID" if pkg.passed_validation else "REJECTED"
        marker = "✓" if pkg.passed_validation else "✗"

        lines = [
            f"{marker} {pkg.name}@{pkg.version} [{status}]",
            f"   {pkg.description}",
            f"   Downloads: {pkg.weekly_downloads:,}/week | Updated: {pkg.last_publish}",
        ]

        if pkg.passed_validation:
            lines.append(f"   Install: {pkg.install_command}")
        else:
            lines.append(f"   Reason: {pkg.rejection_reason}")

        output.append("\n".join(lines))

    return "\n\n".join(output)


# CLI for testing
if __name__ == "__main__":
    import asyncio
    import sys

    async def main():
        query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "react three fiber"
        print(f"Searching for: {query}\n")
        results = await search_npm_packages(query)
        print(format_search_results(results))

    asyncio.run(main())
```

---

## Task 6: Create NPM Search Tests

**File:** `packages/worker/src/agents/test_npm_search.py`

```python
#!/usr/bin/env python3
"""Tests for npm_search module."""

import pytest
from npm_search import (
    search_npm_packages,
    format_search_results,
    NpmPackageInfo,
    MIN_WEEKLY_DOWNLOADS,
    BLOCKLIST,
)


@pytest.mark.asyncio
async def test_search_popular_package():
    """Search for a known popular package returns results."""
    results = await search_npm_packages("three.js 3d", limit=3)

    assert len(results) > 0
    assert any(r.passed_validation for r in results)


@pytest.mark.asyncio
async def test_search_react_three():
    """Search for React Three Fiber ecosystem packages."""
    results = await search_npm_packages("react three fiber drei", limit=5)

    valid = [r for r in results if r.passed_validation]
    assert len(valid) > 0

    # Should find drei or fiber
    names = [r.name for r in valid]
    assert any("drei" in n or "fiber" in n for n in names)


@pytest.mark.asyncio
async def test_blocklist_rejection():
    """Blocklisted packages should be rejected."""
    # Pick a blocklisted package
    blocklisted = list(BLOCKLIST)[0]
    results = await search_npm_packages(blocklisted, limit=5)

    for r in results:
        if r.name == blocklisted:
            assert not r.passed_validation
            assert "blocklist" in r.rejection_reason.lower()


@pytest.mark.asyncio
async def test_download_threshold():
    """Packages below download threshold should be rejected."""
    # Search for something very specific/obscure
    results = await search_npm_packages("xyzzy-test-pkg-unlikely", limit=3)

    for r in results:
        if r.weekly_downloads < MIN_WEEKLY_DOWNLOADS:
            assert not r.passed_validation
            assert "download" in r.rejection_reason.lower()


def test_format_results_empty():
    """Empty results should return appropriate message."""
    output = format_search_results([])
    assert "No packages found" in output


def test_format_results_valid():
    """Valid packages should show install command."""
    pkg = NpmPackageInfo(
        name="test-pkg",
        version="1.0.0",
        description="A test package",
        weekly_downloads=5000,
        last_publish="2026-01-01",
        install_command="npm install test-pkg",
        passed_validation=True,
    )

    output = format_search_results([pkg])

    assert "✓" in output
    assert "test-pkg" in output
    assert "npm install" in output
    assert "VALID" in output


def test_format_results_rejected():
    """Rejected packages should show reason."""
    pkg = NpmPackageInfo(
        name="bad-pkg",
        version="0.0.1",
        description="A bad package",
        weekly_downloads=50,
        last_publish="2020-01-01",
        install_command="npm install bad-pkg",
        passed_validation=False,
        rejection_reason="Too few downloads",
    )

    output = format_search_results([pkg])

    assert "✗" in output
    assert "REJECTED" in output
    assert "Too few downloads" in output
```

---

## Task 7: Update Agent System Prompt

**File:** `packages/worker/src/agents/claude_visual_generator.py`

**Add to the system prompt (in `_build_system_prompt` method):**

```python
"""
## 3D Animation with Three.js

You have full Three.js support via @remotion/three. Use <ThreeCanvas> instead of R3F <Canvas>.

PRE-INSTALLED PACKAGES (do not search for these):
- @remotion/three: Remotion integration, provides <ThreeCanvas>
- @react-three/fiber: React renderer for Three.js
- @react-three/drei: Helpers (useGLTF, Text3D, OrbitControls, etc.)
- three: Core Three.js library

IMPORTANT: Use useCurrentFrame() for animations, NOT useFrame().
Remotion requires declarative, frame-based animation for video rendering.

Example 3D composition:
```tsx
import { ThreeCanvas } from '@remotion/three';
import { useCurrentFrame } from 'remotion';
import { Box, Text3D } from '@react-three/drei';

export const My3DScene: React.FC = () => {
  const frame = useCurrentFrame();
  const rotation = (frame / 30) * Math.PI;

  return (
    <ThreeCanvas>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Box rotation={[rotation, rotation, 0]}>
        <meshStandardMaterial color="orange" />
      </Box>
    </ThreeCanvas>
  );
};
```

## NPM Package Discovery

When you need specialized functionality not covered by pre-installed packages:

1. Use the search tool: search_npm_packages("your query")
2. Review results - only install packages marked ✓ VALID
3. Install: npm install <package-name>
4. Import and use in your composition

GOOD SEARCH QUERIES:
- "three.js physics cannon rapier" → finds physics engines
- "3d text troika" → finds text rendering
- "three particles" → finds particle systems
- "simplex noise procedural" → finds noise generators

DO NOT SEARCH FOR (already installed):
- "react three fiber"
- "drei helpers"
- "remotion three"
- "three.js" (core)
"""
```

---

## Task 8: Integrate Search Tool with Agent

**File:** `packages/worker/src/agents/claude_visual_generator.py`

**Add import at top:**

```python
from npm_search import search_npm_packages, format_search_results
```

**Add tool handler method to ClaudeVisualGenerator class:**

```python
async def _handle_npm_search(self, query: str) -> str:
    """Handle npm package search requests from the agent."""
    print(f"[ClaudeGenerator] NPM search: {query}")
    results = await search_npm_packages(query, limit=5)
    return format_search_results(results)
```

**Note:** The actual integration with Claude Agent SDK tool calling depends on how tools are registered. The handler above provides the implementation - wire it according to the SDK's tool registration pattern.

---

## Task 9: Update CLAUDE.md Skills

**File:** `packages/worker/remotion-template/.claude/CLAUDE.md`

**Add section:**

```markdown
## 3D Animation with Three.js

Pre-installed packages for 3D:
- `@remotion/three` - Use `<ThreeCanvas>` (NOT R3F `<Canvas>`)
- `@react-three/fiber` - React Three Fiber
- `@react-three/drei` - Helpers: useGLTF, Text3D, Box, Sphere, etc.
- `three` - Core Three.js

### Critical Rules for 3D in Remotion
1. ALWAYS use `useCurrentFrame()` for animation timing
2. NEVER use R3F's `useFrame()` hook - it breaks video rendering
3. Wrap 3D content in `<ThreeCanvas>` from @remotion/three
4. Set rotation/position based on frame number for deterministic output

### Example: Rotating Cube
```tsx
import { ThreeCanvas } from '@remotion/three';
import { useCurrentFrame } from 'remotion';

export const RotatingCube: React.FC = () => {
  const frame = useCurrentFrame();
  const rotation = frame * 0.05;

  return (
    <ThreeCanvas>
      <ambientLight />
      <mesh rotation={[rotation, rotation, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#ff6600" />
      </mesh>
    </ThreeCanvas>
  );
};
```

### Example: Rolling Dice
```tsx
import { ThreeCanvas } from '@remotion/three';
import { useCurrentFrame, spring } from 'remotion';
import { RoundedBox } from '@react-three/drei';

export const RollingDice: React.FC = () => {
  const frame = useCurrentFrame();

  const rotationX = spring({ frame, fps: 30, from: 0, to: Math.PI * 4 });
  const rotationZ = spring({ frame, fps: 30, from: 0, to: Math.PI * 2.5 });

  return (
    <ThreeCanvas>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} />
      <RoundedBox args={[1, 1, 1]} radius={0.1} rotation={[rotationX, 0, rotationZ]}>
        <meshStandardMaterial color="white" />
      </RoundedBox>
    </ThreeCanvas>
  );
};
```

## NPM Package Search

If you need a package not pre-installed, use search_npm_packages("query").
Only install packages marked ✓ VALID.
```

---

## Verification Checklist

- [ ] Three.js packages installed in remotion-template
- [ ] @remotion/three added to frontend dependencies
- [ ] DynamicVisualLoader customRequire updated
- [ ] esbuild externals include @remotion/three
- [ ] npm_search.py created and working
- [ ] npm_search tests passing
- [ ] Agent system prompt includes 3D docs
- [ ] CLAUDE.md includes 3D examples
- [ ] Test: Generate a 3D dice composition
- [ ] Test: NPM search finds @react-three/cannon
- [ ] Test: Frontend renders 3D bundle correctly

---

## Future Enhancements

1. **Physics support**: Pre-install @react-three/cannon or @react-three/rapier
2. **GLTF models**: Add asset loading for 3D models
3. **Package caching**: Cache npm search results to reduce API calls
4. **Bundle size tracking**: Warn if bundle exceeds size threshold
