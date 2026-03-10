# Quality Checklist

<scene_checklist>
## Per-Scene Verification (Animator)
Before marking any scene complete:
- [ ] All entries pair opacity + transform (no opacity-only fades)
- [ ] Stagger delays vary (not uniform gaps)
- [ ] 3+ elements animating with different start times
- [ ] Ambient layer present and continuous (background never static)
- [ ] Exits faster than entries (75% duration), reverse hierarchy order
- [ ] No frozen frames — persistent elements have micro-motion
- [ ] All content in centered flex container (not scattered absolute positions)
- [ ] Only palette colors used (no random hex values)
- [ ] Spring damping >= 18 everywhere
- [ ] Text scale never exceeds 1.15x during entry
- [ ] extrapolateLeft AND extrapolateRight: 'clamp' on EVERY interpolate()
- [ ] keySync visual triggers at exact TIMING.sceneNKeySync frame
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Spring configs vary between adjacent elements (not all SMOOTH)
- [ ] Elements visible 30+ frames have ambient motion (float/breathe/pulse)
- [ ] ≥2 different animation techniques used across scenes (not all spring-in + stagger)
- [ ] Content vertically centered: top = (usableHeight - contentHeight) / 2
- [ ] Related elements (icon + label + card) grouped in shared flex container
- [ ] Last sync animation completes 30+ frames before outro begins
</scene_checklist>

<plan_checklist>
## Plan Verification (Director)
Before finalizing scene plan:
- [ ] MUTE TEST: Concept clear with sound off?
- [ ] CONTINUITY TEST: Same visual element persists and transforms across scenes?
- [ ] SYNC TEST: Key visuals aligned to specific transcript words?
- [ ] HOOK TEST: Scene 1 has motion from frame 0 and striking visual in <3 seconds?
- [ ] PACING TEST: Scene durations varied (not all same length)?
- [ ] DURATION TEST: Every scene under 450 frames (15 seconds)?
- [ ] SYNC GAP TEST: Max 90 frames (3 seconds) between consecutive sync points?
- [ ] ANCHOR TEST: Each scene specifies what carries in/out?
- [ ] LAYER TEST: Each description addresses background + primary element + motion?
- [ ] OVERLAY ZONE TEST: Overlay elements only in 0-15% or 58-85% Y zones?
</plan_checklist>

<coverage_checklist>
## Transcript Coverage (Both Agents)
- [ ] Every 3-5 seconds of narration has corresponding visual content
- [ ] No phrase in the transcript lacks visual representation
- [ ] Visual beats match narration beats (pause at any frame → viewer understands topic)
</coverage_checklist>
