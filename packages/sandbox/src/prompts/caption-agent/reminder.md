<critical_reminder>
## Default: ALL SATELLITE. Heroes are exceptions you spend budget on.

## Step 1: Hero budget (from transcript.json pacing data)
- Read `pacing.overallWpm` — DO NOT recompute
- Fast (>200): budget = 30-35% of phrases
- Moderate (150-200): budget = 35-45%
- Slow (<150): budget = 40-50%
- Write caption-plan.json with budget BEFORE creating any items

## Grammar cleanup (transcript is raw ASR)
- Capitalize first word of every phrase
- Capitalize proper nouns, acronyms, place names
- **HARD MAX 6 words per phrase** — 7+ MUST be split, no exceptions
- Hero phrases should be SHORT (2-4 words) — split long phrases into setup (satellite) + payoff (hero)
- Never split mid-clause — "the annual / baccalaureate" is WRONG
- Keep numbers with context: "800,000 students" not "800,000 / students"
- No sentence-ending punctuation mid-phrase — `.` `!` `?` must be last word
- Add punctuation where delivery implies it (?, !, .)

## Step 2: Spend budget in priority order (STOP when exhausted)
1. Opening hook (first phrase)
2. Single-word pivots ("Why?", "No.")
3. Shocking stats on FIRST mention
4. Key terms on FIRST mention (satellite on repeats!)
5. Section climax (before gap ≥500ms)
6. Breath openers in SLOW sections only (wpm <180)
7. Emotional peaks — only if budget remains

## Hard constraints
- Fast windows (>200 WPM): max 1 hero per 5 seconds
- 3+ consecutive hero phrases = BROKEN → insert satellite
- Multi-word hero < 1000ms = demote to satellite (single-word pivots exempt)
- Flow phrases (gap <150ms) = satellite by default
- Repeated terms = NEVER hero after first mention
- Max 2 heroes per phrase. Never 3.
- **Max 6 words per phrase.** 7+ = always split.

## Self-validation: FIX, don't just report
- Over budget? → demote weakest heroes (shortest duration first) via update_item
- **Under 90% of budget? → promote more phrases!** Find contrast pivots, section openers, dramatic reveals. Budget is a TARGET to hit, not just a ceiling.
- 3+ consecutive? → demote middle ones
- Under 1000ms? → demote (except single-word pivots)
- Every word in exactly one phrase, no gaps, no overlaps

## Required outputs
1. `/workspace/docs/caption-plan.json` — FIRST
2. Caption track + items + preset
3. Self-validate and fix violations
</critical_reminder>
