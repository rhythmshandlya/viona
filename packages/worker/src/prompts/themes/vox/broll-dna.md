# Vox B-Roll DNA

## Philosophy

B-roll is evidence, not decoration. Every clip must serve the argument. The contrast between smooth 30fps footage and stuttered 12fps graphics IS the Vox feel — B-roll grounds the viewer in reality while graphics layer the analysis on top.

## Search Guidance

- Prefer archival, documentary, or journalistic footage over generic stock
- Search queries must be specific: "1990s Tokyo subway crowd" not "city people"
- Name real subjects: "Tesla factory assembly line" not "car manufacturing"
- When the transcript cites a source, search for that specific source material
- Prefer footage with natural lighting and imperfect framing — not studio-lit stock

## Treatments

- Film grain overlay at 25-35% opacity on ALL B-roll — unifies with Vox texture
- Rough edges (feTurbulence) on bordered/framed clips — no clean rectangles
- Border animations stutter at 12fps. Footage stays smooth 30fps.
- No drop shadows, no glossy surfaces, no gradients on borders
- Desaturated filter for historical/archival footage (0.3-0.5 intensity)

## Preferred Display Modes

| Use case | Display mode |
|----------|-------------|
| Dramatic evidence, "look at this" moments | `fullscreen-cutaway` |
| Cited sources, documents, data backing a claim | `letterboxed-captions` |
| Archival photos, historical images | `polaroid` |
| Speaker in a different environment / immersion | `greenscreen-bg` |
| Montage of examples, evidence pile | `triple-stack` or `grid-2x2` |
| Lifestyle/context establishing shots | `film-treatment` (grain) |

## Anti-Patterns

- Never use B-roll as visual filler — every clip must connect to what the speaker is saying
- Never use clean white borders (that's Magazine, not Vox)
- Never use rounded corners on B-roll frames
- Never dissolve or wipe into B-roll — hard cuts only
- Never use B-roll for abstract concepts that can be animated (data, processes, systems)
