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
2. Remove first "that," at 16000-16200ms → 100ms gap
3. Remove "basically" at 15500-15750ms → 150ms gap
4. Remove "um" at 15100-15300ms → 150ms gap
5. Remove "you know" at 13200-13550ms → 150ms gap
6. Remove "um" at 12800-13000ms → 150ms gap

**Result:**
"So, the thing is, when you actually look at the data, it's showing us that growth has been really significant."
Removed: 1350ms of filler. Natural rhythm preserved with 150ms gaps.

**Post-trim:** Apply 5% zoom punch-in at each edit point to cover jump cuts.
</example>
