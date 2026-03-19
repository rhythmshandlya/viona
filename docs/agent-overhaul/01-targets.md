# Video Quality Targets

> What we want finished Viona videos to look like. Starting point: what Jupitrr does well, then where we go beyond.

## What Jupitrr Does (Baseline)

1. **Sound effects (SFX)** — contextual sound effects placed at key moments (whooshes, pops, impacts) that add punch and professionalism to transitions and emphasis points

2. **Punch-in on speaker** — hard cut to a cropped/zoomed version of the same shot at moments of vocal emphasis (punchlines, key stats, emotional peaks). Breaks up static talking-head shots and signals "this matters." NOT an animated zoom — it's a jump cut to a tighter frame

3. **B-roll stock footage** — relevant stock video clips (Pexels free / Getty paid) inserted as fullscreen replacements over the speaker at contextually matched transcript moments

4. **Photo and video overlays** — images and video clips overlaid on top of the speaker footage (not just fullscreen replacement), adding visual context while the speaker remains partially visible

5. **Captions/subtitles** — well-styled animated captions synced to speech, multiple display modes, clean typography

6. **Zoom-in animations on B-roll** — Ken Burns-style slow zoom/pan applied to stock footage and images to give static assets a cinematic motion feel

7. **Heading overlays** — text headings/titles overlaid at the top of the frame above the speaker, summarizing the current topic or acting as section markers. Clean typography, well-positioned

That's it. That's all Jupitrr does.

## Techniques Viona Will Use

### Camera/Framing Effects

1. **Punch-in** — hard cut to cropped/zoomed speaker frame at emphasis moments. AI detects vocal emphasis (volume spikes, pitch changes, pauses) and auto-applies. Jump cut, not animated zoom.
2. **Multi-angle cuts** — switching between wide and close-up framing of the speaker. Simulated from a single 4K source by cropping to different regions. Breaks monotony every ~30 seconds.
3. **Ken Burns pan/zoom** — slow zoom-in or pan across static images and B-roll footage. Gives still assets a cinematic motion feel.
4. **Screen shake** — quick camera shake effect on impact moments for emphasis. Short duration, subtle intensity.
5. **Whip pan** — fast horizontal motion blur transition between scenes or segments. High-energy feel.

### Overlay Effects

6. **B-roll stock footage** — relevant stock video clips inserted as fullscreen or partial overlays at transcript-matched moments.
7. **Photo/image overlays** — images overlaid on top of speaker footage (speaker still partially visible), adding visual context.
8. **Lower thirds** — name, title, or topic bar in the lower portion of the frame. Animated entrance/exit.
9. **Heading/topic text** — text at top of frame summarizing the current section or topic. Clean typography, well-positioned.
10. **On-screen bullet points** — key points appearing as text alongside the speaker, building up as points are made.
11. **Meme/pop culture clips** — brief reference clips inserted for humor or cultural emphasis. Used sparingly.

### Transition Effects

14. **Jump cuts** — removing dead air, filler words, pauses, retakes for tighter pacing. The foundation of all talking-head editing.
15. **Crossfade** — smooth blend between speaker and B-roll or between scenes.
16. **Glitch/RGB split** — digital distortion effect for edgy, high-energy transitions.
17. **Flash/white frame** — brief flash between cuts for energy and punctuation.
18. **Freeze frame** — pausing on a moment for emphasis, reveal, or comedic timing.

### Audio Effects

19. **SFX (whoosh, pop, impact)** — contextual sound effects on transitions, emphasis points, and visual changes. Adds punch and professionalism.
20. **Background music** — energy-setting music underneath speech. Matches the mood and pacing of each section.
21. **Audio ducking** — lowering music volume during speech, raising during B-roll or transitions.

### Caption/Text Effects

22. **Animated captions** — word-by-word or phrase-based subtitles synced to speech with entrance/exit animations.
23. **Highlight/active word** — current spoken word changes color, scale, or background to indicate progress.

### Custom Motion Graphics (Viona's Key Differentiator)

24. **Explanatory scene animations** — when the speaker explains a concept, Viona generates a custom animated Remotion scene (.tsx) that visually illustrates it. Not stock footage, not a static image — a purpose-built motion graphic tailored to exactly what's being said. Examples: animated diagrams, flowcharts, data visualizations, process breakdowns, comparison charts, concept maps, step-by-step illustrations.

This is what separates Viona from every stock-footage-overlay tool. The animator agent writes bespoke React components with real motion design — the kind of thing that would take a human motion designer hours in After Effects.

**Three display modes for custom animations:**

- **a) Fullscreen B-roll** — animation takes over the entire screen, replacing the speaker completely. Speaker audio continues underneath. Best for complex visuals that need maximum space (diagrams, flowcharts, data visualizations).

- **b) Split-screen** — speaker video animates down/shrinks to occupy the bottom 40-70% of the screen, animation fills the top 30-60%. A smooth transition moves the speaker into the smaller area. Best for when you want the viewer to see both the speaker's expression and the visual explanation simultaneously.

- **c) Transparent overlay** — Remotion animation rendered without a background, patched directly on top of the speaker video. Best for lightweight annotations, floating labels, arrows, small diagrams, accent graphics. **CRITICAL RULE: overlays must NEVER cover or be placed near the speaker's face.** Place overlays in dead space — sides, top corners, bottom area, or areas where the speaker isn't present.

## The Complete System

Everything above combines into a single automated editing pipeline. No single technique is the product — the product is all of them orchestrated together:

1. **Custom Remotion animations** — bespoke motion graphics scenes for explanations, concepts, data
2. **Stock B-roll footage & photos** — relevant video clips and images from Pexels/Getty/Unsplash for context and variety
3. **Music & SFX** — background music matched to energy, sound effects on every transition and emphasis point
4. **Icons & graphic assets** — Freepik, icon libraries, custom shapes used inside scenes and as overlays
5. **Punch-ins, zoom effects, multi-angle cuts** — keeping the speaker footage itself dynamic
6. **Animated captions with active word highlighting** — professional subtitle treatment
7. **Kinetic typography, headings, lower thirds, bullet points** — text that moves and communicates
8. **Transitions (crossfade, glitch, flash, whip pan)** — varied transitions matched to energy and content
9. **Three animation display modes** — fullscreen, split-screen, transparent overlay — chosen per-scene based on content

The agent decides which techniques to use, where, and when — driven by the transcript, the energy arc, and the creative brief. The result is a video that looks like it was edited by a professional motion designer + video editor team, not an AI stock footage tool.

## Known Issues with Current Output

<!-- TODO: Problems observed in agent-generated videos -->
