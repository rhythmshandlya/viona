# Sound Design Skill

## Purpose
Guide audio design decisions for video content — music selection, sound effects, volume management, and audio transitions. Sound design is 50% of the viewer's experience but often gets 5% of the editing attention.

---

## 1. Sound Hierarchy

### The Three Audio Layers

Every video has up to three audio layers that must coexist without competing:

```
Layer 1 (Primary):   VOICE — Speaker dialogue, narration
Layer 2 (Secondary): MUSIC — Background score, theme
Layer 3 (Accent):    SFX   — Sound effects, transitions, emphasis
```

**Priority is absolute:** Voice > Music > SFX. If any layer conflicts with voice clarity, it must be reduced or removed.

### Volume Relationships

| Layer | Baseline Volume | During Speech | During Silence |
|---|---|---|---|
| Voice | 0 dB (reference) | 0 dB | N/A |
| Music | -18 to -24 dB | -24 to -30 dB (ducked) | -12 to -18 dB (lifted) |
| SFX | -12 to -18 dB | -18 to -24 dB (ducked) | -6 to -12 dB |

**Key principle:** Music should be felt, not heard, when someone is speaking. If you can identify the melody while the speaker talks, the music is too loud.

### Frequency Management

Different layers occupy different frequency ranges. When they overlap, conflicts arise:

**Voice occupies:** 100 Hz - 4 kHz (fundamentals), 2 - 8 kHz (clarity/sibilance)
**Music should avoid:** 200 Hz - 4 kHz when playing under voice (choose tracks with energy above or below this range)
**SFX sweet spots:** Below 200 Hz (impacts, whooshes) and above 4 kHz (clicks, chimes, swooshes)

**Practical rule:** Choose background music that is:
- Primarily instrumental (no vocals competing with speaker)
- Either bass-heavy (electronic, ambient) or treble-heavy (light acoustic, piano)
- Not midrange-heavy (guitars, horns, and strings compete with voice)

---

## 2. Music Selection Guidance

### Music Functions

Music serves different purposes depending on the section:

| Function | Characteristics | When to Use |
|---|---|---|
| **Establish tone** | Full arrangement, moderate volume, sets mood | Opening 5-10s before speaker starts |
| **Sustain energy** | Subtle, repetitive, rhythmic | Under explanations, demonstrations |
| **Build tension** | Rising intensity, increasing elements | Leading to reveals, climaxes |
| **Release tension** | Resolved melody, major key, breath | After reveals, transitions to new topics |
| **Create emotion** | Emotive melody, dynamic | Personal stories, emotional moments |
| **Drive pace** | Fast tempo, strong beat | Montage, listicle, rapid-fire content |

### Genre Matching by Content Type

| Content Type | Music Style | Tempo | Energy |
|---|---|---|---|
| Tech tutorial | Lo-fi electronic, ambient | 80-100 BPM | Low-medium |
| Startup/business | Upbeat indie, light electronic | 100-120 BPM | Medium |
| Science/education | Ambient, minimal piano | 70-90 BPM | Low |
| Lifestyle/vlog | Acoustic, indie pop | 100-130 BPM | Medium-high |
| News/analysis | Corporate ambient, subtle strings | 80-100 BPM | Low-medium |
| Comedy/entertainment | Upbeat, quirky, playful | 110-140 BPM | Medium-high |
| Documentary | Orchestral, atmospheric | 60-90 BPM | Variable |
| Keynote/motivational | Epic, cinematic, building | 80-120 BPM | Building to high |

### Music Structure Alignment

Align music changes with content structure:

```
Video Section          Music Action
─────────────          ────────────
Hook (0-10s)           Music full, sets tone
Speaker intro (10-20s) Music ducks under voice
Body section 1         Music sustains at low volume
Topic transition       Music lifts briefly (fill the gap)
Body section 2         Music continues (may change track/mood)
Climax                 Music builds, intensity rises
Resolution             Music resolves, key change or simplifies
Close                  Music lifts to near-full, fades out over last 5s
```

### Music Selection Checklist

- [ ] Instrumental only (no lyrics competing with speaker)
- [ ] Appropriate energy for content mood
- [ ] Not recognizable (avoid well-known tracks — they distract)
- [ ] Loopable or long enough for the video duration
- [ ] Clean frequency separation from voice range
- [ ] Appropriate license (royalty-free, Creative Commons, or licensed)
- [ ] Consistent tone (don't switch genres mid-video unless justified)

---

## 3. Sound Effects (SFX)

### SFX Categories for Video Editing

| Category | Examples | Purpose |
|---|---|---|
| **UI/Interface** | Click, pop, ding, swoosh | Accompany text overlays, button presses, transitions |
| **Transition** | Whoosh, sweep, riser, impact | Mark section changes, visual transitions |
| **Emphasis** | Hit, slam, bass drop, record scratch | Punctuate key moments, reveals, surprises |
| **Ambient** | Room tone, crowd, nature | Fill silence, establish atmosphere |
| **Notification** | Bell, chime, alert | Draw attention to on-screen elements |
| **Comedic** | Boing, slide whistle, rimshot | Punctuate humor (use very sparingly) |

### SFX Timing Rules

**Sync precision:** SFX must be frame-accurate with their visual trigger.

```
Visual event frame → SFX starts 0-2 frames BEFORE the visual

Why before? The ear processes faster than the eye. If the sound
comes at the same frame as the visual, it feels slightly late.
Leading by 1-2 frames creates perceived synchronization.
```

**Duration matching:**
- Quick visual (text pop-in): Short SFX (0.1-0.3s) — click, pop, tap
- Medium visual (slide transition): Medium SFX (0.3-0.8s) — swoosh, sweep
- Dramatic visual (full-screen animation): Long SFX (0.8-2.0s) — impact + decay, riser
- Continuous visual (animated diagram building): Sustained SFX or no SFX (let music carry it)

### SFX Selection by Visual Treatment

| Treatment | Recommended SFX |
|---|---|
| Text-overlay (pop in) | Subtle pop or click (0.1s) |
| Text-overlay (slide in) | Soft whoosh (0.2s) |
| Stat counter | Ticking sound (during count) + ding (on final number) |
| Screenshot (slide in) | Paper/slide sound (0.3s) |
| Screenshot (zoom) | Subtle zoom whoosh (0.4s) |
| Animation (entrance) | Whoosh or sweep matching direction (0.3s) |
| Animation (impact) | Impact hit + bass (0.5s) |
| Animation (particles) | Shimmer or sparkle (continuous, very quiet) |
| Transition (hard cut) | None (the cut is the punctuation) |
| Transition (dissolve) | None or very subtle pad (0.5s) |
| Transition (wipe/slide) | Directional whoosh (0.3s) |

### SFX Volume Rules

- SFX should never be louder than the speaker's voice
- UI sounds (clicks, pops): -18 to -24 dB relative to voice
- Transition sounds (whooshes): -12 to -18 dB relative to voice
- Impact sounds (hits, slams): -6 to -12 dB relative to voice (brief spikes are okay)
- If music is playing, SFX that overlap music should be 6 dB above the music level to be audible

### SFX Density

- **Sparse** (1 SFX every 15-30s): Professional, documentary style
- **Moderate** (1 SFX every 8-15s): Standard YouTube, educational
- **Dense** (1 SFX every 3-8s): Energetic, entertaining, short-form
- **Excessive** (> 1 SFX every 3s): Avoid — sounds like a cartoon

Match density to content formality:
- Corporate/professional → Sparse
- Educational/tutorial → Moderate
- Entertainment/vlog → Moderate to Dense
- Short-form (< 60s) → Dense

---

## 4. Volume Ducking

### What Is Ducking

Ducking is the automatic reduction of background audio (music, ambient) when foreground audio (voice) is present. It's the single most important audio technique for video.

### Ducking Parameters

```
Threshold:  -30 dB (when voice exceeds this level, duck the music)
Ratio:      -12 dB (how much to reduce the music)
Attack:     100ms (how fast to duck when voice starts)
Release:    500ms (how fast to bring music back when voice stops)
Hold:       200ms (how long to stay ducked after voice drops below threshold)
```

### Ducking Curves

**Standard ducking** (most content):
```
Voice:  ─────▆▆▆▆▆▆▆▆▆▆▆▆─────▆▆▆▆▆▆▆▆─────
Music:  ▆▆▆▆▆▂▂▂▂▂▂▂▂▂▂▂▂▆▆▆▆▆▂▂▂▂▂▂▂▂▆▆▆▆▆
              ↑ duck          ↑ lift     ↑ duck
```

**Smooth ducking** (podcast, interview — more natural):
- Longer attack (300ms) and release (1000ms)
- Less aggressive ratio (-8 dB)
- Music stays present but subdued

**Hard ducking** (tutorial, emphasis — maximum clarity):
- Short attack (50ms) and release (300ms)
- Aggressive ratio (-18 dB)
- Music nearly disappears when voice is present

### Ducking Exceptions

**Don't duck during:**
- Intentional music moments (intro, outro, scene transitions where music is featured)
- Emotional peaks where music and voice both contribute to impact
- Brief pauses in speech (< 1s) — keep ducked to avoid pumping effect

**Always duck during:**
- Any speech that conveys important information
- Quiet or nuanced delivery (the music will overpower it)
- Technical explanations (clarity is paramount)

---

## 5. Fade Patterns

### Fade In

Music or SFX gradually increases from silence to target volume.

```
Type        Duration    Use Case
──────────  ──────────  ─────────────────────
Quick       0.5-1.0s    Returning from silence, SFX
Standard    1.0-2.0s    Video opening, section start
Slow        2.0-4.0s    Cinematic, emotional build
Very slow   4.0-8.0s    Documentary, ambient establish
```

**Fade in shape:**
- Linear: Steady increase (mechanical feel)
- Logarithmic: Fast start, slow approach to target (natural feel)
- S-curve: Slow start, fast middle, slow end (smooth, cinematic)
- Default: Logarithmic for most content

### Fade Out

Music or SFX gradually decreases to silence.

```
Type        Duration    Use Case
──────────  ──────────  ─────────────────────
Quick       0.5-1.0s    Transition to new section
Standard    1.5-3.0s    End of section, topic change
Slow        3.0-5.0s    Video ending, emotional close
Very slow   5.0-10.0s   Documentary ending, credits
```

**Fade out shape:**
- Linear: Steady decrease (noticeable, intentional feel)
- Exponential: Slow start, rapid final drop (natural, musical)
- Default: Exponential for most content (the sound "melts away")

### Cross-Fade (Music Track Change)

When transitioning between two music tracks:

```
Track A:  ▆▆▆▆▆▆▆▆▆▆▅▄▃▂▁░░░░░░░░░
Track B:  ░░░░░░░░░░▁▂▃▄▅▆▆▆▆▆▆▆▆▆
                     ↑ cross-fade zone
```

**Cross-fade duration:**
- Same genre/energy: 2-3s (quick, seamless)
- Different genre/energy: 3-5s (gradual, allows adjustment)
- Dramatic mood change: Use a 1-2s silence gap instead (clean break)

**Cross-fade rules:**
- Both tracks should be at similar energy levels during the cross-fade
- Align the cross-fade with a visual transition (the eye distracts from the ear)
- The incoming track should start on a downbeat or at a phrase start
- Never cross-fade in the middle of a musical phrase

---

## 6. Audio Transitions

### Between Sections

| Transition Type | Audio Approach |
|---|---|
| Hard cut (same topic) | Audio continues unbroken; music stays at same level |
| Hard cut (new topic) | Brief music lift (0.5s) to mark the change, then duck again |
| Cross dissolve | Music cross-fades or stays constant; voice may overlap briefly (L/J cut) |
| Fade to black | Music fades out during black; new music fades in after |
| Wipe/Slide | Optional transition SFX (whoosh); music continues |

### Audio Continuity Rules

1. **Never leave silence unintentionally.** Every moment should have at least one audio layer active (voice, music, or ambient).

2. **Bridge audio across visual cuts.** The speaker's voice should continue smoothly even when the visual treatment changes. This is the L-cut principle applied globally.

3. **Match audio energy to visual energy.** If the visuals get more intense (faster cuts, bolder animations), the music should build. If the visuals calm down, the music should settle.

4. **Respect the breath.** When the speaker pauses to breathe, let the music fill the space briefly. Don't let the music swell too much (it's a breath, not a musical interlude).

5. **End with intention.** The last 5 seconds should have a clear audio resolution — music fading out, a final note, or deliberate silence. Never end mid-phrase.

---

## 7. Audio Design by Content Type

### Tutorial
- Music: Lo-fi or ambient, very quiet (-24 to -30 dB)
- SFX: Subtle UI clicks for step transitions
- Ducking: Aggressive (voice clarity is paramount)
- Transitions: Minimal SFX, clean cuts

### Podcast/Interview
- Music: Intro/outro only, or very quiet ambient under conversation
- SFX: None or very sparse (occasional topic-change chime)
- Ducking: Smooth, natural
- Transitions: Clean cross-fades between segments

### Presentation
- Music: Corporate ambient, moderate volume during visual sections
- SFX: Subtle for slide transitions, moderate for data reveals
- Ducking: Standard
- Transitions: Slide-style SFX for visual transitions

### Vlog
- Music: Full track, genre-appropriate, louder during B-roll
- SFX: Moderate density, playful sounds welcome
- Ducking: Standard, with full lifts during B-roll (no voice)
- Transitions: Whooshes, impacts for energetic transitions

### Short-form (< 60s)
- Music: Trending/recognizable track (platform-specific)
- SFX: Dense, punchy, every visual gets a sound
- Ducking: Hard (every word counts in short-form)
- Transitions: Impact sounds, bass hits

---

## 8. Audio Checklist

Before finalizing the audio design:

- [ ] Voice is always clearly audible over music and SFX
- [ ] Music ducking is applied during all speech
- [ ] No unintentional silence (> 2s without any audio layer)
- [ ] SFX are synced within 2 frames of their visual triggers
- [ ] Music fades in/out smoothly (no abrupt starts/stops)
- [ ] No frequency conflicts (music midrange doesn't fight voice)
- [ ] Volume levels are consistent (no sudden jumps)
- [ ] Music changes align with visual transitions
- [ ] SFX density matches content formality
- [ ] End of video has a clean audio resolution
