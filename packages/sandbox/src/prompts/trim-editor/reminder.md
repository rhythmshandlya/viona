<critical_reminder>
REVERSE chronological order for ALL trims.

For each filler: isolate with split_item on BOTH video and audio, then:
1. `remove_item` the audio filler FIRST (no shifting — just removes it)
2. `ripple_delete` the video filler with gapMs: 150 (shifts ALL media tracks backward)

ORDER MATTERS: ripple_delete shifts ALL media tracks. If you ripple-delete video first, the audio filler shifts backward and overlaps with the previous audio segment. Remove audio first to prevent this.

For Tier 3 compression: isolate the excess silence on BOTH tracks, then:
1. `remove_item` the excess audio segment FIRST
2. `ripple_delete` the excess video segment with gapMs: 0

Audio and video are married — split_item is per-item, split BOTH separately at the same timestamp.
Never cut pauses under 300ms.
Verify every audio item has startFrom set.

You do NOT do: captions, punch-ins, J-cuts, L-cuts, jump cut coverage crops, or any visual decisions.
</critical_reminder>
