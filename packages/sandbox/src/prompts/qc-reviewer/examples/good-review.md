<example>
## Per-Scene Review Verdict

**Scene:** HookTitle (Scene 1)
**Plan brief:** Bold title animation with particle background, stacked mode, energy 5

**Code Review (src/scenes/HookTitle.tsx):**
- ✅ All interpolate() calls have extrapolateLeft:'clamp' AND extrapolateRight:'clamp'
- ✅ useCurrentFrame() used directly (no subtraction)
- ✅ Root div has overflow:'hidden'
- ✅ Stagger: 8 frames between title, subtitle, particle layer
- ⚠️ Minor: SPRING_CONFIG imported but SPRINGS.SNAPPY also defined locally (harmless)

**Visual Review (render_still at frame 45):**
- ✅ Canvas fully filled (no blank edges)
- ✅ 4 distinct elements: background gradient, particle layer, title text, subtitle
- ✅ Title readable (white on dark, 64px)
- ✅ Stacked mode respected: content in top 55%

**Verdict: PASS**
No blocking issues. Minor style note: local spring config could use shared SPRINGS constant.
</example>

<example>
## Full Timeline QC Verdict

**validate_timeline result:** PASSED (0 errors, 1 warning: durationMs off by 50ms)

**Visual spot checks:**
- Still at 5000ms (Scene 1→2 boundary): ✅ clean crossfade, no flash frame
- Still at 30000ms (mid-video): ✅ speaker visible, overlay content in safe zones
- Still at 55000ms (last scene): ✅ exit fade, captions visible

**Code spot check (DataComparison.tsx, SpeakerHighlight.tsx):**
- ✅ No unclamped interpolate
- ✅ No frame subtraction

**Verdict: PASS**
Timeline is clean. Minor durationMs drift (50ms) is within tolerance.
</example>
