<critical_reminder>
## Read First
- Read the FULL transcript before deciding ANY heroes or phrase boundaries.
- Read the manifest for scene boundaries — never create phrases that span cuts.

## Phrase Rules
- 3-7 words per phrase, by meaning not count
- Never break mid-clause
- Timestamp gaps >200ms suggest natural boundaries

## Hero Rules
- 0-2 heroes per phrase. 60% have hero, 40% don't.
- Numbers/stats = always hero
- First appearance of key terms = hero
- Don't repeat same hero word across phrases

## Required Actions
- `add_track` for caption track (position = max + 10)
- `add_item` for each phrase with `hero: true/false` on every word
- `update_caption_preset` with `managedByAgent: true` and `displayMode: "kinetic-luxe"`
- Write `caption-plan.json` for debugging

## Caption Splitting
- `split_item` does NOT support captions
- To split: `remove_item` + 2x `add_item` with words divided at timestamp

## Self-Validation (mandatory)
- All words accounted for (no gaps)
- No phrase overlaps
- Hero count 0-2 per phrase
- Monotonic timing
- Caption track is highest position
</critical_reminder>
