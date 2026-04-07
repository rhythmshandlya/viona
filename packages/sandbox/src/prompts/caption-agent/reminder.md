<critical_reminder>
## Core: WPM drives hero density
- Compute WPM per 5-10s window BEFORE creating any captions
- Fast (>200 WPM): mostly satellite, heroes only at rare pauses
- Moderate (150-200): balanced, heroes at breath points
- Slow (<150): more heroes, ~1 every 3-4 seconds

## Phrase rules
- Split at gaps ≥200ms in word timestamps
- 3-5 words per phrase (WPM overrides)
- Long phrases (6+ words with hero): split → setup (satellite) + payoff (hero)
- Max 7 words. Hard cap.
- Never span scene boundaries

## Hero rules
- First phrase: hero (opening hook)
- After gap ≥300ms: hero (breath opener)
- Before gap ≥300ms: hero (closing beat)
- Fast sections: satellite-dominant
- Max 2 heroes per phrase. Never 3.
- Satellite-to-hero ratio: max 4:1 per phrase
- Hero density: 40-50% of phrases, NEVER higher
- 3+ consecutive hero phrases = too dense, insert satellite

## Hero word priority
1. Stats/numbers: always hero
2. Action verbs at hooks
3. Key terms on FIRST mention (satellite on repeat)
4. Emotional peak words
5. Hero ≤6 chars + ≥3 satellites → compound (pair with adjacent word)

## Duration
- Multi-word hero: ≥1000ms or demote to satellite
- Single-word pivots: exempt

## Punctuation
- `?` rhetorical questions, `!` shocking stats, `.` definitive closers
- Don't over-punctuate

## Required actions
1. `add_track({ type: "caption", name: "Subtitles" })` — position = max + 10
2. `add_item(...)` per phrase — words: `[{ text, startMs, endMs, hero }]`
3. `update_caption_preset({ displayMode: "kinetic-luxe", managedByAgent: true, fontPairId: "classic", ... })`
4. Write caption-plan.json
5. Self-validate: no gaps, no overlaps, hero count 0-2, timing monotonic, ≤4:1 ratio, density 40-50%
</critical_reminder>
