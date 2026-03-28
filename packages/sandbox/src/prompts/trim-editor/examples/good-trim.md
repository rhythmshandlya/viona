<example>
## Trim Decision Example

**Raw transcript segment (12400ms - 18200ms):**
"So, um, the thing is, you know, when you actually look at the data, um, it's basically showing us that, that growth has been, uh, really significant."

**Analysis (from analyze_transcript tool):**
- Filler: "um" at 12800-13000ms (Tier 1)
- Filler: "you know" at 13200-13550ms (Tier 2 — filler at phrase boundary, safe to cut)
- Filler: "um" at 15100-15300ms (Tier 1)
- Filler: "basically" at 15500-15750ms (Tier 2 — adds zero meaning, safe to cut)
- False start: "that, that" at 16000-16400ms (keep second "that" only)
- Filler: "uh" at 16900-17050ms (Tier 1)

**Trim plan (reverse chronological):**
1. Remove "uh" at 16900-17050ms → 150ms gap
2. Remove first "that," at 16000-16200ms → 150ms gap
3. Remove "basically" at 15500-15750ms → 150ms gap
4. Remove "um" at 15100-15300ms → 150ms gap
5. Remove "you know" at 13200-13550ms → 150ms gap
6. Remove "um" at 12800-13000ms → 150ms gap

**Execution for trim #1 ("uh" at 16900-17050ms):**
```
// 1. Isolate the filler — split video at filler boundaries
split_item({ itemId: "vid-001", atMs: 16900 })
→ { originalId: "vid-001", newId: "vid-002" }

split_item({ itemId: "vid-002", atMs: 17050 })
→ { originalId: "vid-002", newId: "vid-003" }
// vid-002 is now the 150ms filler (16900-17050)

// 2. Isolate the filler — split audio at same boundaries
split_item({ itemId: "aud-001", atMs: 16900 })
→ { originalId: "aud-001", newId: "aud-002" }

split_item({ itemId: "aud-002", atMs: 17050 })
→ { originalId: "aud-002", newId: "aud-003" }
// aud-002 is the 150ms filler audio

// 3. REMOVE audio filler FIRST (no shifting — just deletes the item)
remove_item({ itemId: "aud-002" })
→ { removed: "aud-002" }

// 4. THEN ripple-delete video filler (shifts ALL media tracks backward, leaves 150ms gap)
ripple_delete({ itemId: "vid-002", gapMs: 150 })
→ { removed: "vid-002", shiftMs: 0, gapMs: 150, itemsShifted: 2 }
// shiftMs = 0 because filler was exactly 150ms and gap is 150ms
// Audio items after the filler are also shifted backward by ripple_delete
```

**Execution for a longer filler — "you know" at 13200-13550ms (350ms):**
```
// Isolate filler video
split_item({ itemId: "vid-001", atMs: 13200 })
split_item({ itemId: "vid-new", atMs: 13550 })

// Isolate filler audio
split_item({ itemId: "aud-001", atMs: 13200 })
split_item({ itemId: "aud-new", atMs: 13550 })

// REMOVE audio filler FIRST (no shifting)
remove_item({ itemId: "aud-filler" })

// THEN ripple-delete video filler — 350ms filler, 150ms gap → shifts ALL media tracks by 200ms
ripple_delete({ itemId: "vid-filler", gapMs: 150 })
→ { removed: "vid-filler", shiftMs: 200, gapMs: 150, itemsShifted: 6 }
```

**Result:**
"So, the thing is, when you actually look at the data, it's showing us that growth has been really significant."
Removed: 1350ms of filler. Timeline compressed. Natural 150ms gaps at each cut point.

## Tier 3 Compression Example

**Silence at 25000-26500ms (1500ms) → compress to 450ms:**
```
// Split to isolate the silence
split_item({ itemId: "vid-005", atMs: 25000 })    // start of silence
split_item({ itemId: "vid-006", atMs: 25450 })    // keep 450ms
split_item({ itemId: "vid-007", atMs: 26500 })    // end of silence
// vid-007 is the excess silence (25450-26500, 1050ms)

// Same for audio
split_item({ itemId: "aud-005", atMs: 25000 })
split_item({ itemId: "aud-006", atMs: 25450 })
split_item({ itemId: "aud-007", atMs: 26500 })

// REMOVE excess audio FIRST (no shifting)
remove_item({ itemId: "aud-007" })

// THEN ripple-delete excess video (gapMs: 0 — the 450ms we kept IS the gap)
// This shifts ALL media tracks (including remaining audio) by 1050ms
ripple_delete({ itemId: "vid-007", gapMs: 0 })
```
Result: 1500ms silence compressed to 450ms. All subsequent items shifted 1050ms earlier.

</example>
