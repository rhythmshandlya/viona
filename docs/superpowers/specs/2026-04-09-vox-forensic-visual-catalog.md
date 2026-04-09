# Vox Forensic Visual Catalog

> Complete taxonomy of every visual pattern, scene type, animation technique, and design move across all major Vox YouTube series. Purpose: build a template system that can reproduce any Vox visual move programmatically.

---

## Table of Contents

1. [Universal Vox Visual DNA](#1-universal-vox-visual-dna)
2. [Series-by-Series Forensic Breakdown](#2-series-by-series-forensic-breakdown)
3. [Complete Scene Type Taxonomy](#3-complete-scene-type-taxonomy)
4. [Animation Micro-Pattern Catalog](#4-animation-micro-pattern-catalog)
5. [Data Visualization Types](#5-data-visualization-types)
6. [Source Material Treatment Catalog](#6-source-material-treatment-catalog)
7. [Interview & Talking Head Patterns](#7-interview--talking-head-patterns)
8. [Comparison Pattern Catalog](#8-comparison-pattern-catalog)
9. [Map & Geographic Visualization](#9-map--geographic-visualization)
10. [Audio Visualization Patterns](#10-audio-visualization-patterns)
11. [Annotation System Catalog](#11-annotation-system-catalog)
12. [Transition Catalog](#12-transition-catalog)
13. [Effect & Treatment Catalog](#13-effect--treatment-catalog)
14. [Expanded Template System](#14-expanded-template-system)

---

## 1. Universal Vox Visual DNA

These are the cross-series signature moves that make a video instantly identifiable as "Vox."

### 1.1 The 12fps Stutter

The single most recognizable Vox trait. Graphics compositions run at 12fps within a 24fps (or 30fps) timeline, creating a deliberate choppiness that signals "handcrafted editorial" rather than "corporate smooth." Applied selectively to graphic overlays, NOT to interview footage or archival video.

**Implementation**: Posterize Time effect at 10-12fps on adjustment layers above graphics. In Remotion at 30fps: `Math.floor(frame / 2.5) * 2.5`.

### 1.2 The Yellow Highlighter

A yellow marker (`#FFEB00`) sweeps across key text with intentional imperfection. Not a straight geometric bar -- it has slight rotation (1-2 degrees), wobble, and uneven edges. Often accompanied by a marker squeak sound effect.

**Variants**:
- **Text underline sweep**: Yellow bar animates width 0% to 100% behind a line of text
- **Document highlight**: Yellow rectangle sweeps across a phrase in a photographed document
- **Word-level highlight**: Individual words get sequential highlights synced to narration
- **Block highlight**: Entire paragraph area gets yellow wash for emphasis

### 1.3 Progressive Information Disclosure

Nothing appears all at once. Elements build sequentially, synced to narration. The viewer never sees a complete infographic appear -- they watch it construct itself piece by piece. This is the fundamental Vox animation philosophy: "animation should ease the viewer into conceptually dense infographics by allowing them to unfold, step by step, over time."

### 1.4 Visual Evidence Over Decoration

Joey Sendaydiego (Vox art director): "You don't want it to look perfect because that might make it look more like an ad than an editorial piece." Estelle Caswell: "My job wasn't to decorate a video. My job was to tell a story." Every visual element serves an informational purpose. Decorative elements are minimal and textural, never prominent.

### 1.5 Subject-Matter-Driven Design Language

Each video (and especially each series) develops its own visual vocabulary derived from the subject matter. A video about 1980s design uses fluorescent gradients and squiggly lines. A video about jazz uses handmade textures evoking vinyl records. A video about forensic science uses scanner-light and lightbox effects. The Vox "brand" is the approach, not a rigid visual template.

### 1.6 Film Grain & Texture Layer

16mm film grain overlay at approximately 35% opacity, set to overlay blend mode. Creates a tactile, documentary quality. Sometimes supplemented by construction paper textures, newsprint halftone dots, or cycling noise patterns (2-3 textures per second to prevent "dead" frames).

### 1.7 Chromatic Aberration on Photos

Slight RGB channel splitting (1-2px offset) at element edges, simulating lens imperfection. Applied via adjustment layer with Quick Chromatic Aberration plugin, with slight rotation adjustment. A Gaussian blur (3.5px) with a circular mask (subtracted, feathered to 50px radius) ensures the effect only hits edges, preserving center clarity.

### 1.8 Source Citation on Screen

Vox cites sources at the top of the screen when they appear, displayed as small sans-serif text with the publication/organization name. This is both a credibility signal and a functional element -- viewers can fact-check. The citation fades in when the source appears and fades out when it leaves.

---

## 2. Series-by-Series Forensic Breakdown

### 2.1 Vox Borders (Johnny Harris)

**Subject**: Geopolitics, borders, territories, immigration, contested regions.

**Signature Visual Moves**:

| Move | Description |
|------|-------------|
| **Macro-to-Micro Map Dive** | Opens on a continental/global map view, then zooms progressively into the specific border region. The zoom is not smooth -- it happens in 2-3 distinct jumps with brief holds at each level. |
| **Animated Border Shift** | Historical borders animate frame-by-frame to show how territories changed. Old borders fade in/out as new ones appear. Color-coded by era or controlling power. |
| **Split: Map vs Ground** | Frame alternates between bird's-eye map animation and on-the-ground documentary footage. Map provides spatial context, footage provides human context. |
| **Visual Anchor Shots** | Harris identifies a single powerful ground-level image that crystallizes the story (cage homes in Hong Kong, border crowds in Colombia) and returns to it repeatedly as a narrative anchor. |
| **Territory Coloring** | Countries/regions are flat-filled with semi-transparent colors. When a territory changes hands, the color morphs with an animated wipe or fade. |
| **Dotted Line Borders** | Contested or disputed borders shown as animated dashed lines (dots moving along the line) rather than solid lines. |
| **Population Flow Arrows** | Animated arrows showing migration patterns -- arrow width proportional to population volume, animated along a curved path with particle-like dots moving along the arrow. |
| **Demographic Data Overlay** | Statistics (population numbers, economic data) appear as floating labels on the map, entering with a fade-rise and a count-up animation. |
| **On-Screen Interview + Map Inset** | Harris appears on camera in the actual location while a small map inset in the corner shows where he is geographically. |

**Scene Types**:
1. Cold open with dramatic ground-level footage
2. Global map establishing shot with slow orbit
3. Animated historical border timeline
4. On-location interview with locals
5. Data overlay on map (population, economics)
6. Document/treaty close-up with highlight
7. News clip montage of the border situation
8. Conclusion at the location with map pull-back

---

### 2.2 Vox Atlas (Sam Ellis)

**Subject**: Geography, maps, how physical geography shapes human stories.

**Signature Visual Moves**:

| Move | Description |
|------|-------------|
| **Google Earth Studio Orbit** | Slow orbital camera movement around a geographic feature (city, mountain, facility). Uses Earth Studio's orbit/spiral functions for production value. Exported as JPEG sequence into After Effects. |
| **Zoom-to-Ground** | Continental view zooms down to street level in a single continuous movement. At ground level, annotations and labels attach to specific buildings or features via 3D track points. |
| **Master World Map Link** | All zoomed-in map sequences are linked to a master world map composition, allowing consistent zoom-in/zoom-out with maintained spatial relationships. |
| **Drone Footage + Annotation Overlay** | Real drone footage with animated graphics overlaid on top -- lines, labels, highlighted areas drawn directly over aerial video. |
| **Manual Cartography Tracing** | For historical maps that don't exist digitally, Ellis manually traces borders and features from historical references, then animates the traced elements progressively. |
| **Route Animation** | A line/path animates along a road, river, or trade route on the map, with a dot or arrowhead leading the path. Speed varies to emphasize distance or duration. |
| **Satellite Timelapse** | Time-series satellite imagery showing urban sprawl, deforestation, or infrastructure growth over years. Images crossfade or wipe to show change. |
| **Desaturated Map + Color Grade** | Map footage is desaturated, then color-graded with Lumetri Color (vignette, warm/cool toning) to create a distinctive non-Google-Maps look. |
| **Posterize Time at 10fps** | Map animation sequences specifically use 10fps posterize time for period authenticity and visual distinction from live footage. |
| **3D Building Extrusion** | Earth Studio's 3D building data used to show specific structures, with animated annotations pointing to individual buildings. |
| **Label Tracking** | Text labels parent to 3D track-point null layers from Earth Studio export, so labels stay attached to geographic locations as the camera moves. |
| **Explosion/Event Markers** | Animated explosion or event marker compositions triggered at specific map positions as the camera pans across. |

**Scene Types**:
1. Satellite zoom-in establishing the region
2. Annotated aerial view with labels
3. Historical map comparison (then vs now)
4. Route/path animation along trade routes or borders
5. 3D orbit around a specific location
6. Data overlay on geography (climate data, population density)
7. Ground-level footage intercut with map context
8. Timeline showing geographic change over decades

---

### 2.3 Vox Almanac (Phil Edwards)

**Subject**: History, cultural history, origin stories of everyday things, archival deep-dives.

**Signature Visual Moves**:

| Move | Description |
|------|-------------|
| **Archival Material First** | Edwards starts with powerful visual assets (archival photos, old advertisements, patent drawings, newspaper clippings) and builds the story around them. The archival material IS the visual, not decoration for narration. |
| **Document Close-Up + Slow Pan** | Camera slowly pans across a historical document, patent, or newspaper. Key phrases get the yellow highlighter treatment. Sometimes a gentle Ken Burns zoom into specific details. |
| **Bookend / Mirror Technique** | The film opens and closes on the same visual, but the closing return carries new meaning after the story. Example: a rock in the desert opens and closes a computer animation history video. |
| **Archive Credit Citation** | "AP Archive" or "Library of Congress" cited in top corner when archival footage appears. Edwards worked with AP Archive credits to source many of his visuals. |
| **Newspaper Headline Stack** | Multiple newspaper headlines from different publications appear stacked/overlapping, each sliding in from different edges, showing how a story was covered across media. |
| **Vintage Filter Treatment** | Archival materials get CC Vintage effect, warm color grading, and additional film grain to unify materials from different eras into a cohesive visual style. |
| **Product/Object Isolation** | A specific object (a food product, a gadget, a piece of infrastructure) is isolated on a clean background, then animated with a slow rotation or float while its history is explained. |
| **Timeline Slider** | A horizontal timeline with date markers. A playhead or highlight moves along the timeline as the narration progresses chronologically. Key dates get larger markers or branching labels. |
| **Side-by-Side Era Comparison** | Two versions of the same thing (old vs modern) placed side by side. Sometimes with an animated wipe or slider between them. |
| **One-Man Production Aesthetic** | Edwards pitches, writes, voices, animates, edits, and shoots himself. This creates a distinctive lo-fi-but-rigorous feel -- fewer flashy transitions, more emphasis on the archival materials themselves. |

**Scene Types**:
1. Teaser visual (the object or place that sparked the story)
2. Archival photograph with slow pan + highlight
3. Newspaper headline montage
4. Historical document close-up with annotation
5. Timeline progression with date markers
6. Old advertisement or patent drawing examination
7. Modern-day footage of the same subject
8. Bookend return to opening visual with new context

---

### 2.4 Vox Earworm (Estelle Caswell)

**Subject**: Music theory, music history, deconstruction of songs/genres/sounds.

**Signature Visual Moves**:

| Move | Description |
|------|-------------|
| **Beat-Synced Animation** | EVERYTHING is synced to music beats. If a single word is off-beat, the whole visualization collapses. Caswell manually animates to audio -- After Effects is "not meant to edit to audio" but she forces it. |
| **Rhyme Scheme Grid** | A grid visualization where words/syllables are mapped to cells. Internal rhymes highlighted in yellow, multi-syllabic rhymes in pink. The grid builds progressively as the rap plays. |
| **Circle of Fifths Visualization** | Interactive-looking diagram of the circle of fifths for music theory episodes (notably the Giant Steps episode). Starts simple, builds complexity as theory concepts layer. Used as a central visual metaphor "like a color wheel for designers." |
| **Waveform Display** | Audio waveforms rendered as visual elements. Not just decoration -- specific sections are highlighted, zoomed, and annotated to point out specific sounds or patterns. |
| **Beat Map** | Rhythmic patterns visualized as dot grids or bar sequences. Each beat gets a marker, emphasis beats get larger/colored markers. The map builds in real-time as music plays. |
| **Tape Deck / Physical Player** | Illustrations of tape decks, record players, mixing consoles, and calculators used as visual anchors. These represent the "mechanics" of music creation. |
| **Repetition Diagram** | Boxy visualization showing how musical phrases repeat and vary. Includes instructions/legend for how to read the diagram. Color-coded by musical phrase. |
| **Mixed Media Collage** | Public domain archive images (old music magazines, instrument manuals, performance photos) repurposed and animated with Vox's collage aesthetic. |
| **Custom Visual Language Per Episode** | Each episode develops its own visualization system. Caswell reverse-engineers "the most clear visual motifs that helped me understand it" and then teaches that system to the audience. |
| **Long Static Holds on Archival** | 5-6 second holds on archival performance footage or photographs. Deliberate pacing -- no "crazy transitions" because "in storytelling, transitions mean nothing. They give you no information." |
| **Progressive Theory Building** | Starts at "freshman music theory" and builds to "PhD-level" concepts. The visual complexity mirrors the conceptual complexity -- simple diagrams grow into dense, multi-layered visualizations. |
| **Lyric Highlight Cascade** | Song lyrics displayed as text with individual words or syllables highlighting in sequence as they're sung/rapped. Color-coded by rhyme pattern, accent, or melodic function. |

**Scene Types**:
1. Musical hook (song excerpt with visual anchoring)
2. Music theory diagram build (circle of fifths, chord progressions)
3. Rhyme scheme / beat map grid
4. Archival performance footage with annotation
5. Waveform analysis with highlighted sections
6. Instrument/equipment illustration with mechanical animation
7. Historical context collage (magazine covers, photos)
8. Expert interview clip (brief, intercut with visualizations)
9. Comparative playback (same passage, different treatments)
10. Repetition diagram with reading instructions

---

### 2.5 Darkroom (Coleman Lowndes)

**Subject**: Stories behind iconic photographs, photo history, visual analysis.

**Signature Visual Moves**:

| Move | Description |
|------|-------------|
| **Photograph as Primary Canvas** | The photograph IS the scene. The entire episode revolves around examining a single (or small set of) photographs. The image fills the frame and the camera explores it. |
| **Ken Burns Deep Dive** | Slow, controlled pan-and-zoom across a photograph. Not a generic Ken Burns -- it's directed pan-and-zoom that mirrors the narration: "look at this person" (zoom to that person), "notice the background" (pan to background). |
| **Annotation Circles on Photos** | Hand-drawn-style circles appear around specific elements in photographs. Yellow or red. Animated to draw on screen (stroke animation). |
| **Spotlight Isolation** | Everything in the photograph except the area of interest is darkened or blurred. A spotlight or vignette effect isolates the specific detail being discussed. |
| **Photo Layer Separation** | A photograph is separated into foreground/background layers in Photoshop, then animated with slight parallax to create depth from a 2D image. |
| **Contextual Comparison** | The iconic photo is placed alongside other photographs from the same event/era for comparison. Sometimes overlaid, sometimes side-by-side. |
| **Film Strip / Contact Sheet** | Multiple photographs displayed in a film-strip or contact-sheet layout, with one photograph highlighted/enlarged as the narration focuses on it. |
| **Technical Photo Analysis** | Visual overlays showing photographic technique -- exposure settings, focal length, crop marks. Sometimes showing dodging/burning areas that were manipulated in the original darkroom. |
| **Historical Timeline Anchor** | The photograph is placed on a timeline showing when it was taken relative to other historical events. The timeline animates to show the photograph's context. |
| **Fade Between Versions** | Different versions, crops, or prints of the same photograph crossfade to show how the image was manipulated, cropped, or recontextualized over time. |

**Scene Types**:
1. The photograph revealed (full frame, dramatic entrance)
2. Guided pan across the image with narration
3. Annotation overlay (circles, arrows, labels on the photo)
4. Spotlight isolation of specific details
5. Historical context (map, timeline, other photos from the era)
6. Technical photography analysis
7. Photographer profile (portrait, equipment, context)
8. Photo comparison (different versions, crops, related images)
9. Cultural impact montage (how the photo was used/reproduced)
10. Closing: full photo again, now seen with new understanding

---

### 2.6 Missing Chapter (Ranjani Chakraborty)

**Subject**: Overlooked historical events, marginalized community histories, historical trauma.

**Signature Visual Moves**:

| Move | Description |
|------|-------------|
| **Archival Image Collage** | Rarely-seen archival photographs, government records, and primary source documents assembled in layered collage compositions. Multiple images overlap with rough edges, creating a scrapbook-of-history aesthetic. |
| **Protest Poster Aesthetic** | For episodes covering activism/resistance (e.g., Fred Hampton), the animation style researches and mimics the visual language of protest posters from that era. Typography, color palette, and graphic style are period-authentic. |
| **Voiceover + Archival Montage** | Ranjani's narration plays over sequences of archival photographs that build progressively. Images enter from edges, overlap, and layer. The visual rhythm matches the narration cadence. |
| **Expert Interview Integration** | Interviews with historians, descendants, and community members. Treated as primary sources -- intercut with archival material, not just talking heads. Interview clips used like academic citations, woven into narration sentences. |
| **Document Examination** | Government records, legal documents, and primary sources zoomed into with the yellow highlight treatment. Often shown in sequence to build a case/argument. |
| **Map + Demographic Overlay** | Maps showing specific neighborhoods, districts, or regions with demographic data overlaid. Used to show geographic displacement, redlining, or population changes. |
| **Then/Now Split** | Photographs of a location in the historical period paired with contemporary footage of the same location. Sometimes animated with a slider wipe between eras. |
| **Handcrafted Title Cards** | Episode titles and section headers with rough-edged, handcrafted aesthetic that varies per episode to match the era/culture being discussed. |
| **Scrapbook Assembly** | Visual elements (photos, documents, maps, quotes) assemble on screen as if being placed into a scrapbook -- items slide in, overlap, slightly rotate, get "pinned" in place. |

**Scene Types**:
1. Present-day opening (establishing the location today)
2. Archival photo montage with narration
3. Primary source document examination
4. Expert/descendant interview
5. Map with demographic/geographic data
6. Protest poster / period-specific graphic style
7. Then vs now comparison
8. Scrapbook assembly of evidence
9. Emotional testimony close-up
10. Return to present with new understanding

---

### 2.7 By Design (Christophe Haubursin / Dion Lee)

**Subject**: Design of everyday objects, architecture, urban planning, industrial design.

**Signature Visual Moves**:

| Move | Description |
|------|-------------|
| **Stylized Motion Graphics** | Abstract concepts explained through deliberately flat, stylized motion graphics. Repetitive motifs in composition and movement orient the viewer through complex design concepts. |
| **Blueprint/Schematic Overlay** | Architectural plans, blueprints, or technical drawings animated with progressive reveal. Lines draw on screen, measurements appear, labels track to specific elements. |
| **Object Isolation + Rotation** | A designed object isolated on a clean background, slowly rotating or orbiting. Annotation labels point to specific design features that enter as the narration mentions them. |
| **Exploded View Animation** | A designed object breaks apart into its component pieces, each piece floating away to show internal structure. Then reassembles. |
| **Design Evolution Timeline** | Showing how a design changed over decades. Multiple versions of the same object arranged chronologically, with morphing or crossfade between iterations. |
| **Fluorescent Gradients (80s Topics)** | For design topics from specific eras, the color palette matches. 1980s design topics get fluorescent gradients and squiggly lines. |
| **Real-World Context Footage** | B-roll of the designed object/space in real-world use. Mixed with the analytical motion graphics. |
| **Dimension/Scale Annotations** | Measurement lines, scale indicators, and proportion overlays appear on images of designed objects. Animated to draw on screen with clean geometric precision. |
| **International Design Awards aesthetic** | Clean, controlled compositions reminiscent of design award presentations. High contrast, generous whitespace, precise typography. |

**Scene Types**:
1. Object/space reveal in real-world context
2. Blueprint/schematic progressive reveal
3. Exploded view of design components
4. Design evolution timeline
5. Comparison with competing designs
6. Expert interview on design decisions
7. Stylized motion graphic explaining a design principle
8. Scale/dimension annotation
9. User experience demonstration (how people interact with the design)
10. Design impact/legacy summary

---

### 2.8 Future Perfect

**Subject**: Science, technology, effective altruism, world improvement, emerging tech.

**Signature Visual Moves**:

| Move | Description |
|------|-------------|
| **Dot Population Visualization** | 100 dots representing 100% of a population. Dots move, split, change color to visualize statistical distributions. A 3D environment houses the dots moving through "history." |
| **Construction Paper Craft** | For education-related topics, all visuals handcrafted from construction paper. Child's-arts-and-crafts aesthetic chosen deliberately to match the subject matter and draw viewers in. |
| **Abstract Concept Visualization** | Philosophical or scientific concepts (AI risk, population ethics) visualized through abstract motion graphics -- geometric shapes, flowing lines, particle systems representing data or probability. |
| **Data-Dense Infographics** | More data visualization per frame than other Vox series. Multiple chart types in sequence. Emphasis on making data feel accessible, not intimidating. |
| **Interactive-Style Scrollytelling** | Vox.com articles in this section use Chorus CMS for complex visual effects triggered by scrolling -- photos that change, charts that build, parallax layers. (Web-native, not video.) |
| **Technology Demonstration** | Screen recordings, product demos, and technology simulations. Often treated with slight desaturation and Vox branding overlays. |

**Scene Types**:
1. Hook with surprising statistic (big number reveal)
2. Population/data dot visualization
3. Animated chart sequence (multiple chart types)
4. Technology demonstration or simulation
5. Abstract concept visualization
6. Expert interview
7. Real-world impact footage
8. Solution/improvement proposal with supporting data
9. Comparison of approaches with data
10. Takeaway summary with key statistics

---

### 2.9 Vox Main Channel Explainers (Explained, Standalone)

**Subject**: Everything -- politics, science, culture, economics, health. The "core" Vox format.

**Signature Visual Moves**:

| Move | Description |
|------|-------------|
| **News Supercut Opening** | Opens with a rapid montage of real news clips grounding the viewer in the topic's real-world stakes. 1-2 second clips from multiple news sources, rapid-fire editing. |
| **Flying Text as Visual Anchor** | (Per Sendaydiego) A repeating visual element (often animated text) serves as the anchor around which additional graphics build. The text moves, scales, and repositions throughout the scene. |
| **Expert Interview as Citation** | Zoom/video-call footage from experts intercut with narration. Used like academic quotes -- partial sentences from experts woven into the narrator's argument, not standalone talking-head segments. |
| **Claim-Then-Debunk Card** | A claim is displayed prominently (often as a quote or headline), then the highlighter effect or red annotation marks it as false, and the corrected information appears alongside or replaces it. |
| **Number Counter Reveal** | A large statistic displayed center-screen with a count-up animation from 0 to the target number. Often accompanied by a subtle scale-up and a brief hold at the final number. |
| **Layered Parallax Photo** | A photograph separated into Photoshop layers, imported as a composition into After Effects. Each layer positioned in 3D space with different depths. A slow camera zoom creates parallax depth from a 2D photo. |
| **Collage Character Cutout** | A person cut from a photograph with rough (not clean) edges. Converted to black-and-white with added textures and gradient effects. Separated into body parts on different layers. Simple rotations + puppet pin tool for subtle "breathing" movements. |
| **Match Cut Text Montage** | Multiple screenshots/images sharing the same headline text, each shown for 2 frames in rapid sequence. The repeated text stays in the same position (aligned with guides) while the surrounding content changes. Creates a flickering montage effect. |
| **Word Swap/Change Effect** | A key word in a sentence is highlighted and then replaced by a different word, animating the change. Used to illustrate a conceptual shift or correction. |
| **Per-Episode Visual World** | Each episode of the Netflix Explained series had "a unique feel and its own visual language" while maintaining Vox brand consistency. Emmy-nominated for Outstanding Graphic Design and Art Direction. |
| **Tactile Material Exploration** | The Mind Explained used paint, milk, and oil to create abstract textures. The "Memory" episode used hazy, grainy illustration to represent how slippery recollection is. The human body was turned into a pinball machine for an anxiety episode. |
| **Source Material as Evidence** | Every visual serves as evidence for the argument. Screen recordings of websites, screenshots of social media posts, scanned documents -- all treated as exhibits in a visual essay. |

**Scene Types (comprehensive list for the core format)**:
1. **News Supercut** -- Rapid montage of real news clips establishing the topic
2. **Title Card** -- Full-screen bold text (serif display) with topic title and yellow accent
3. **Statistic Reveal** -- Big number with count-up, supporting context text below
4. **Annotated Document** -- Close-up of a document/webpage with highlights and annotations
5. **Expert Interview Clip** -- Zoom call or on-camera expert, intercut with narration
6. **Animated Diagram** -- Concepts explained through node-and-connector motion graphics
7. **Comparison Split** -- Two concepts side-by-side with animated divider
8. **Timeline March** -- Chronological progression with date markers and events
9. **Map Zoom** -- Geographic context provided through animated map
10. **Collage Assembly** -- Layered photographs/documents building a visual argument
11. **Data Chart Build** -- Bar/line/area chart building progressively
12. **Process Flow** -- Step-by-step walkthrough with numbered stages
13. **Quote Card** -- Large serif text of a key quote with attribution
14. **Fact-Check Card** -- Claim displayed then annotated as true/false/misleading
15. **Definition Card** -- Key term spotlight with typewriter reveal
16. **Cause-Effect Chain** -- A leads to B leads to C with animated connectors
17. **Photo Ken Burns** -- Photograph with slow pan-and-zoom
18. **Cutout Character** -- Collage-style person with parallax/breathing
19. **Screen Recording** -- Website or app being navigated with cursor movement
20. **Social Media Post** -- Tweet/post screenshot with slight tilt, shadow, and annotations
21. **Ranking List** -- Items stacking with staggered reveal, #1 highlighted
22. **Before/After** -- Slider or crossfade between two states
23. **Key Takeaway** -- Summary card with numbered points
24. **Closing Card** -- Vox logo, subscribe prompt, related video links

---

## 3. Complete Scene Type Taxonomy

Every distinct scene type observed across all Vox series, categorized.

### 3.1 Text-Dominant Scenes

| ID | Scene Type | Description | Series Where Used |
|----|-----------|-------------|-------------------|
| T1 | **Full-Screen Headline** | 1-2 lines of bold serif text on dark or neutral background. Yellow accent bar above or below. Film grain overlay. | All |
| T2 | **Highlighter Emphasis** | Text on screen with animated yellow highlighter sweeping across key phrases. 1-2 degree rotation, wobble. | All |
| T3 | **Definition Spotlight** | Term appears in serif italic, followed by colon and definition in sans-serif. Typewriter character reveal. Yellow underline under the term. | Main, Earworm |
| T4 | **Quote Card** | Large serif italic text centered. Quotation marks in yellow/accent color. Attribution below in small sans-serif. | All |
| T5 | **Claim-Then-Debunk** | Statement displayed prominently, then red/yellow annotation marks appear (circles, strikethroughs), corrected text appears below or replaces. | Main, Borders |
| T6 | **Key Takeaway Card** | Numbered points (1-3) with bold lead text and supporting detail. Each point staggers in. Yellow number badges. | Main, Future Perfect |
| T7 | **Word Swap** | A sentence with one word highlighted. The word animates out (slide up + fade) and replacement word animates in (slide down + fade). | Main |
| T8 | **Flying Text Anchor** | Large text phrase that moves, scales, and repositions across the scene. Other graphics build around it as a visual anchor point. | Main |
| T9 | **Lyric Display** | Song lyrics with individual words/syllables highlighting in color sequence as audio plays. Color-coded by rhyme/rhythm pattern. | Earworm |
| T10 | **Source Citation** | Small sans-serif text at top of frame with publication name. Fades in/out with source material. | All |

### 3.2 Data & Chart Scenes

| ID | Scene Type | Description | Series Where Used |
|----|-----------|-------------|-------------------|
| D1 | **Big Number Reveal** | Single statistic in large bold text, animating with count-up from 0. Supporting context in smaller text below. Optional unit label. | Main, Future Perfect |
| D2 | **Bar Chart Build** | Bars grow from baseline with staggered timing. Axis labels and values animate in sequence. Annotation labels appear at key bars. | Main, Atlas |
| D3 | **Line Graph Draw** | Line draws progressively left-to-right. Key data points get pulse/glow. Optional counter shows current value as line progresses. | Main, Future Perfect |
| D4 | **Stacked Area Chart** | Colored areas fill from bottom, each layer animating in sequence. Labels track to each area. | Main |
| D5 | **Dot Population** | 100 dots representing 100% of a population. Dots recolor, move, split to show proportions. 3D environment. | Future Perfect |
| D6 | **Pie/Donut Build** | Segments animate clockwise from 12 o'clock. Each segment gets a label on completion. | Main |
| D7 | **Timeline March** | Horizontal line with date markers. Playhead/highlight moves chronologically. Key dates get larger markers and branching detail labels. | Almanac, Missing Chapter, Main |
| D8 | **Ranking Stack** | Items enter from bottom or side, stacking in order. #1 item is larger or gets a yellow highlight. Staggered reveal (3rd, 2nd, 1st). | Main |
| D9 | **Comparison Bars** | Two bar sets side-by-side (e.g., Country A vs Country B) with animated growth. Difference highlighted with annotation. | Main, Borders |
| D10 | **Counter Dashboard** | Multiple numbers displayed simultaneously, each counting up at different rates. Used for multi-metric comparisons. | Future Perfect |

### 3.3 Map & Geographic Scenes

| ID | Scene Type | Description | Series Where Used |
|----|-----------|-------------|-------------------|
| G1 | **Satellite Zoom-In** | Continental or global view zooming to regional/street level. Earth Studio orbit + spiral. Desaturated + color graded. | Atlas, Borders |
| G2 | **Animated Border Change** | Historical borders animate between eras. Color-coded by controlling power. Smooth morph between border shapes. | Borders, Atlas |
| G3 | **Route/Path Animation** | Line draws along a road, river, or trade route. Leading dot/arrowhead. Variable speed for emphasis. | Atlas, Borders |
| G4 | **Territory Color Fill** | Country/region flat-filled with semi-transparent color. Fill animates as a wipe when territory changes. | Borders, Atlas |
| G5 | **Demographic Data Map** | Map with floating data labels (population, GDP, etc.) that fade-rise in and count-up. | Borders, Main |
| G6 | **Population Flow Arrows** | Curved arrows showing migration. Width proportional to volume. Animated dots moving along arrow paths. | Borders |
| G7 | **Drone + Annotation Overlay** | Real drone footage with animated lines, labels, and highlighted areas drawn directly over video. | Atlas |
| G8 | **3D Building Orbit** | Earth Studio 3D building view with slow orbit. Annotation labels attached via track points. | Atlas |
| G9 | **Historical Map Trace** | Hand-traced historical map animated with progressive line drawing. | Atlas, Almanac |
| G10 | **Location Pin + Detail** | A pin/marker on a map that, when "reached" by camera movement, expands to show detail (photo, label, data). | Atlas, Borders |

### 3.4 Source Material Scenes

| ID | Scene Type | Description | Series Where Used |
|----|-----------|-------------|-------------------|
| S1 | **Document Close-Up + Pan** | Slow pan across historical document, contract, or legal text. Key phrases highlighted in yellow. | Almanac, Missing Chapter |
| S2 | **Newspaper Headline Stack** | Multiple headlines from different publications overlap and stack, sliding in from different edges. | Almanac, Main |
| S3 | **Photograph Deep Dive** | Full-frame photograph with directed Ken Burns (pan to what narration describes). Annotation circles and arrows. | Darkroom |
| S4 | **Patent/Blueprint Examination** | Technical drawing filling the frame with progressive reveal of components and labels. | Almanac, By Design |
| S5 | **Social Media Post Display** | Tweet or post screenshot with slight tilt (2-3 degrees), drop shadow, and annotation marks. | Main |
| S6 | **Screen Recording** | Website or application being navigated. Cursor movement with smooth pans and zooms to guide focus. | Main, Future Perfect |
| S7 | **Advertisement/Poster Analysis** | Vintage advertisement or poster filling the frame with annotations pointing to specific design choices. | Almanac, By Design |
| S8 | **Film Strip / Contact Sheet** | Multiple photographs in strip or grid layout. One photo enlarges when discussed. | Darkroom |
| S9 | **Book/Magazine Page** | Open book or magazine with slow zoom to specific passage. Highlighter on key text. | Almanac, Earworm |
| S10 | **Government Record** | Official documents (census, legislation, court records) with formal layout preserved, key sections highlighted. | Missing Chapter |

### 3.5 Interview & Talking Head Scenes

| ID | Scene Type | Description | Series Where Used |
|----|-----------|-------------|-------------------|
| I1 | **Expert Video-Call Clip** | Zoom/video call footage of expert. Used as citation -- partial sentences woven into narrator's argument. | Main |
| I2 | **On-Location Interview** | Subject filmed in relevant location. Map inset sometimes shows geographic context. | Borders, Missing Chapter |
| I3 | **Step-Reveal Lower Third** | Name/title card with rough-textured background that reveals frame-by-frame in a jagged mask animation. Text delayed 2-3 frames after background. | All |
| I4 | **Descendant/Witness Testimony** | Close-up of person sharing personal connection to history. More intimate framing than standard expert shot. | Missing Chapter |
| I5 | **Narrator Direct-to-Camera** | Series host addressing camera directly. Clean background. Used for transitions and personal analysis. | Borders, Missing Chapter |

### 3.6 Narrative & Composite Scenes

| ID | Scene Type | Description | Series Where Used |
|----|-----------|-------------|-------------------|
| N1 | **News Supercut** | Rapid montage of 1-2 second news clips. Different networks, different angles. Establishes real-world stakes. | Main |
| N2 | **Scrapbook Assembly** | Photos, documents, and graphics slide in, overlap, and get "pinned" in place. Scrapbook-of-evidence aesthetic. | Missing Chapter, Main |
| N3 | **Collage Character** | Person cut from photo with rough edges, B&W + texture, body parts on separate layers, puppet-pin breathing. | Main |
| N4 | **Parallax Photo** | 2D photograph separated into depth layers, animated with 3D camera for parallax movement. | Main, Missing Chapter |
| N5 | **Protest Poster Mimicry** | Animation style mimics protest posters from the era being discussed. Period-authentic typography and colors. | Missing Chapter |
| N6 | **Tactile Material Experimentation** | Paint, milk, oil, construction paper as animation medium. Material choice matches subject (paper for education, paint for emotion). | Explained (Netflix) |
| N7 | **Conceptual Metaphor Visualization** | Abstract concept visualized through concrete metaphor (body as pinball machine, memory as haze). | Explained (Netflix) |
| N8 | **Music Theory Diagram** | Circle of fifths, chord progression charts, rhythm grids that build from simple to complex. | Earworm |

---

## 4. Animation Micro-Pattern Catalog

Every distinct animation move observed, with precise specifications.

### 4.1 Text Entry Animations

| Pattern | Specification | Usage |
|---------|--------------|-------|
| **Slide-in reveal** | translateX(-100% to 0) or translateY(100% to 0), easeOut, 12-18 frames | Headlines, labels |
| **Typewriter** | Characters reveal left-to-right, 2-3 frames per character, blinking cursor at leading edge | Definitions, code, precise quotes |
| **Word cascade** | Each word fades in + slides up 15-20px, staggered 4-6 frames apart | Body text, explanations |
| **Character stagger** | Each character scales from 0 to 1 with spring physics, staggered 1-2 frames | Titles, emphasis words |
| **Scale-up reveal** | Scale 0.85 to 1.0 + opacity 0 to 1, easeOut, 15 frames | Key statistics, hero text |
| **Highlighter sweep** | Yellow div width 0% to 100% behind text, 1-2 degree rotation, 12-20 frames | Key phrases, corrections |
| **Word swap** | Old word slides up + fades out while new word slides up + fades in from below, 8-12 frames | Conceptual shifts, corrections |
| **Number roll/count-up** | Numeric value increments from 0 to target over 30-45 frames with easeInOut | Statistics, metrics |

### 4.2 Element Entry Animations

| Pattern | Specification | Usage |
|---------|--------------|-------|
| **Spring-in** | Scale 0 to 1 with spring overshoot (damping 12-18, stiffness 120-180) | Icons, cards, focal elements |
| **Fade-rise** | Opacity 0 to 1 + translateY 20-30px to 0, easeOut, 15-20 frames | Secondary content, labels |
| **Stagger cascade** | Multiple elements enter sequentially, 6-8 frames apart, same animation but offset timing | Lists, grid items, steps |
| **Clip-path reveal** | clipPath circle or inset expanding from center/edge to reveal content, 15-25 frames | Dramatic reveals, before/after |
| **Mask wipe** | Irregular jagged mask expanding frame-by-frame (not smooth), 15-25 frames | Lower thirds, Vox signature |
| **Slide-from-edge** | Element slides in from off-screen left/right/top/bottom, easeOut, 12-18 frames | New visual elements |
| **Rotation with overshoot** | Rotate 0 to target with spring overshoot, damping 15-20 | Charts, indicators |
| **Assembly from parts** | Components fly in from different edges, converge to form complete image, 25-40 frames | Diagrams, exploded views |

### 4.3 Chart/Data Animations

| Pattern | Specification | Usage |
|---------|--------------|-------|
| **Bar grow** | Height 0 to target with easeOut, staggered per bar, 15-25 frames each | Bar charts |
| **Line draw** | strokeDasharray animation OR path point-by-point progression, 45-90 frames total | Line graphs |
| **Area fill** | Vertical height grows from baseline, each area layer staggered, 20-30 frames | Area charts |
| **Pie segment** | Arc animates clockwise from 12 o'clock, each segment staggered, 10-15 frames each | Pie/donut charts |
| **Dot recolor** | Individual dots in a population change color in wave pattern, 30-60 frames | Population statistics |
| **Counter tick** | Number increments with easeInOut, optional comma formatting appears dynamically | Stat reveals |
| **Axis label appear** | Labels fade-rise in, synced with chart drawing completion | All chart types |
| **Annotation arrow draw** | Arrow draws from data point to label, 8-12 frames, with label fade-in at completion | Chart annotations |

### 4.4 Map Animations

| Pattern | Specification | Usage |
|---------|--------------|-------|
| **Zoom-in (stepped)** | 2-3 distinct zoom levels with 15-30 frame holds at each level, easeInOut between levels | Map establishing |
| **Orbit** | Slow circular camera movement around point of interest, 90-150 frames per revolution | Location context |
| **Border morph** | Path morphs between two border shapes over 20-40 frames with easeInOut | Historical change |
| **Territory wipe** | Color fill wipes across a country/region shape, 15-25 frames | Territorial control |
| **Route trace** | Line draws along a path with leading dot, variable speed, 60-120 frames | Trade routes, migration |
| **Label track** | Labels parented to 3D null objects that maintain geographic position during camera movement | Map annotations |
| **Event marker pop** | Icon springs in at a specific map location when camera reaches it, with pulse effect | Events, battles |

### 4.5 Photo/Image Animations

| Pattern | Specification | Usage |
|---------|--------------|-------|
| **Ken Burns pan** | Slow translateX/Y movement, 2-5% of image dimension, over scene duration | Photographs |
| **Ken Burns zoom** | Slow scale 1.0 to 1.1-1.15 over scene duration, centered on point of interest | Photographs |
| **Parallax layers** | Foreground at 1x speed, midground at 0.7x, background at 0.4x, camera moves 30-50px | Photo depth |
| **Cutout entrance** | Photo cutout slides in from edge with slight rotation (2-5 degrees), easeOut | Collage elements |
| **Puppet breathing** | Puppet pin on chest area oscillates Y position with sine wave, amplitude 2-4px, period 60-90 frames | Collage characters |
| **Rough edge mask** | SVG feTurbulence + feDisplacementMap on clip-path for intentionally imperfect edges | Photo cutouts |
| **Photo stack** | Multiple photos overlapping at slight angles (2-5 degrees each), staggered entrance, 8-12 frames apart | Evidence assembly |
| **Spotlight vignette** | Background darkens to 20-30% brightness, circular mask illuminates area of interest | Photo detail isolation |

### 4.6 Persistent/Ambient Motions

| Pattern | Specification | Usage |
|---------|--------------|-------|
| **Texture cycle** | 2-3 texture frames cycling at 2-3fps over scene duration | Backgrounds |
| **Grain drift** | Noise pattern offset shifts randomly each frame | Film grain overlay |
| **Float/breathe** | Slow sinusoidal Y oscillation, amplitude 3-8px, period 90-150 frames | Elements visible 30+ frames |
| **Subtle rotation** | Slow continuous rotation, 0.5-2 degrees per second | Background elements |
| **Pulse** | Scale oscillates 1.0 to 1.02-1.05, period 60-90 frames | Active/highlighted elements |

---

## 5. Data Visualization Types

Every chart/data visualization type observed across Vox series.

| Type | Description | Animation Method | Series |
|------|-------------|-----------------|--------|
| **Horizontal bar chart** | Bars grow from left. Labels on left, values on right. Staggered entry. | Bar grow + label fade-rise | Main, Borders |
| **Vertical bar chart** | Bars grow from bottom. Category labels below, values above. | Bar grow + label fade-rise | Main |
| **Grouped bar chart** | Multiple bars per category, different colors. Each group staggers. | Staggered bar grow | Main |
| **Stacked bar chart** | Bars composed of colored segments. Segments fill from bottom within each bar. | Sequential segment fill | Main |
| **Line graph (single)** | Single line drawing progressively. Data point markers pop in. | Line draw + dot spring-in | Main, Future Perfect |
| **Line graph (multi)** | Multiple lines drawing, each in a different color. Key intersection points annotated. | Staggered line draw | Main |
| **Annotated line graph** | Line graph with specific points called out with arrows and labels. | Line draw + annotation arrow | Main |
| **Area chart** | Filled area below a line. Color fill grows from baseline. | Area fill | Main |
| **Stacked area chart** | Multiple colored areas stacking. Each layer animates in sequence. | Sequential area fill | Main |
| **Pie chart** | Circle segments animate clockwise. Labels track to each segment. | Pie segment + label | Main |
| **Donut chart** | Pie chart with center cutout. Center often holds a key statistic. | Pie segment + count-up center | Main |
| **Scatter plot** | Dots appear in wave pattern across the plot area. Trend line draws after dots settle. | Staggered dot appear + line draw | Future Perfect |
| **Dot population diagram** | 100 dots representing percentages. Dots recolor in groups to show proportions. | Dot recolor wave | Future Perfect |
| **Treemap** | Nested rectangles representing hierarchical proportions. Rectangles grow from corners. | Rectangle grow with label | Main |
| **Simple infographic** | Icons + numbers in a grid or row. Each icon-number pair enters with spring. | Stagger cascade of icon+number pairs | All |
| **Comparison bar** | Two bars growing from center in opposite directions (or from same baseline). | Simultaneous bar grow | Main, Borders |
| **Gauge/meter** | Arc or progress bar filling to a percentage. Number counts up in center. | Arc fill + count-up | Main |
| **Ranking list** | Numbered items entering from bottom/side, stacking in order. #1 highlighted. | Stagger cascade from #N to #1 | Main |

---

## 6. Source Material Treatment Catalog

How Vox handles different types of source material visually.

### 6.1 Documents & Official Records

| Treatment | Description |
|-----------|-------------|
| **Close-up with pan** | Document fills 80-100% of frame. Camera slowly pans across. |
| **Yellow highlight** | Key phrases get animated yellow highlighter sweep. |
| **Crop zoom** | After establishing the full document, camera zooms to specific section. |
| **Desaturation + vintage** | Document footage desaturated, CC Vintage effect applied for aged look. |
| **Multiple document stack** | Several documents shown overlapping at slight angles, then one comes to foreground. |
| **Source citation** | Publication/archive name in small text at top of frame. |

### 6.2 Photographs

| Treatment | Description |
|-----------|-------------|
| **Ken Burns directed** | Pan and zoom that follows narration (zoom to what's being discussed). |
| **Layer separation** | Foreground/background separated in Photoshop for parallax movement. |
| **Cutout with rough edges** | Subject cut from photo with feTurbulence rough-edge mask. Background removed or replaced. |
| **Black-and-white conversion** | Color photo converted to B&W with added textures and gradient effects. |
| **Annotation overlay** | Circles, arrows, labels drawn on top of photo at points of interest. |
| **Spotlight isolation** | Surrounding area darkened, point of interest illuminated. |
| **Contact sheet display** | Multiple photos in grid layout, one enlarges when discussed. |
| **Film strip layout** | Photos arranged horizontally as film strip, scrolling to focus on specific image. |

### 6.3 Social Media Posts

| Treatment | Description |
|-----------|-------------|
| **Screenshot with tilt** | Post screenshot at 2-3 degree tilt with drop shadow on dark background. |
| **Highlight annotation** | Key parts of the post circled or underlined in yellow/red. |
| **Username blur/crop** | Non-relevant user info sometimes blurred for privacy or cropped out. |
| **Sequential display** | Multiple posts entering one after another to show a pattern or trend. |

### 6.4 Screen Recordings / Websites

| Treatment | Description |
|-----------|-------------|
| **Guided cursor movement** | Smooth cursor pans and hovers over elements being discussed. |
| **Zoom to detail** | Full page view then smooth zoom to specific section or element. |
| **Highlight box overlay** | Semi-transparent colored rectangle overlaying the section being discussed. |
| **Slight desaturation** | Screen recording slightly desaturated with Vox branding overlays. |

### 6.5 Archival Video/Film

| Treatment | Description |
|-----------|-------------|
| **CC Vintage effect** | Retro color grading unifying archival footage from different eras. |
| **Film grain addition** | 16mm grain overlay at 35% opacity, overlay blend mode. |
| **Crop + reframe** | Archival footage cropped and repositioned for 16:9 with Ken Burns movement. |
| **Speed adjustment** | Slight speed ramp (0.8-1.2x) to match narration pacing. |
| **Annotation overlay on video** | Circles, arrows, and labels drawn over moving footage to highlight specific elements. |

---

## 7. Interview & Talking Head Patterns

### 7.1 Framing Styles

| Style | Description | When Used |
|-------|-------------|-----------|
| **Tight medium shot** | Head and shoulders, slight off-center (rule of thirds). Clean background. | Studio interviews |
| **Video-call frame** | Zoom/video-call quality with visible interface elements sometimes preserved. | Remote expert interviews |
| **Environmental medium** | Subject in relevant location with meaningful background. | On-location (Borders, Missing Chapter) |
| **Close-up testimony** | Tighter crop for emotional moments. Used for personal stories. | Missing Chapter, Darkroom |
| **Walking/moving** | Host walking through location while speaking. Handheld feel. | Borders |

### 7.2 Lower Third System

| Component | Specification |
|-----------|--------------|
| **Background shape** | Rough-textured rectangular shape, NOT smooth rectangle. Edges created via frame-by-frame mask animation or feTurbulence filter. |
| **Reveal animation** | Mask path increases frame-by-frame in a jagged pattern. Frames skip randomly -- not every frame gets a mask change. Creates "rough character." |
| **Text delay** | Name and title text appears 2-3 frames AFTER background shape is fully revealed. |
| **Text style** | Name in bold sans-serif (all caps or title case). Title in regular weight below, smaller. |
| **Duration** | On screen for 3-5 seconds after full reveal, then reverse animation to exit. |
| **Color** | Background uses series accent color (often muted teal or charcoal). Text in white. |

### 7.3 Interview Edit Patterns

| Pattern | Description |
|---------|-------------|
| **Citation intercut** | Expert's words woven into narrator's sentences. Narrator says half a sentence, expert completes it, narrator continues. |
| **Visual B-roll over audio** | Expert's audio continues but video cuts to relevant graphics, charts, or archival footage. |
| **Zoom-call multi-take** | Brief clips (3-8 seconds) from experts used as punctuation between graphic sequences. |
| **Source credit on entry** | Expert's credentials and institution displayed as lower third on first appearance. |

---

## 8. Comparison Pattern Catalog

Every comparison technique observed.

| Pattern | Description | When Used |
|---------|-------------|-----------|
| **Side-by-side split** | Frame divided vertically. Each side shows one option with its own label and data. Animated divider line. | A vs B comparisons |
| **Before/after slider** | Two images overlaid with an animated vertical slider wipe revealing the "after" version. | Then vs now, before/after |
| **Before/after crossfade** | Two states crossfade over 15-30 frames to show change. | Gradual transformations |
| **Toggle overlay** | Two states of the same image. One overlays the other with variable opacity or a switch animation. | Different interpretations, versions |
| **Stacked timeline** | Two timelines stacked vertically, same time scale, comparing progression of two subjects. | Parallel history |
| **Comparison bars** | Two sets of bars side-by-side (or growing from center outward) with labeled difference. | Metric comparisons |
| **Matrix grid** | Multiple attributes as rows, two subjects as columns. Cells fill with checks/scores. | Multi-attribute comparison |
| **Claim-then-debunk** | Statement displayed, then red/yellow annotations mark corrections. Corrected version appears. | Fact-checking |
| **Old vs new version** | Two versions of same object/design arranged chronologically with morphing or crossfade. | Design evolution |
| **Map comparison** | Same map shown in two states (different eras, policies) with animated transition between states. | Geographic/political comparison |
| **Dot population split** | Population of dots that splits and recolors to show proportional differences. | Statistical comparison |
| **Number counter race** | Two numbers counting up simultaneously, reaching different values. | Scale comparison |

---

## 9. Map & Geographic Visualization

### 9.1 Map Animation Workflow (Vox Production)

1. **Google Earth Studio**: Create base animation (zooms, orbits, spirals) as JPEG sequence with tracking data
2. **Export**: Advanced render settings with After Effects tracking information
3. **After Effects Import**: File > Script > Run Script File to import Earth Studio camera and track data
4. **Compositing**: Turn on 3D switches, parent precomps to track-point null layers, zero out position/orientation
5. **Color Grade**: Desaturate map, add adjustment layer with Lumetri Color (vignette, warm/cool toning)
6. **Texture**: 16mm film grain overlay at 35% opacity, overlay blend mode
7. **Temporal**: Posterize Time at 10fps for period authenticity
8. **Annotation**: Draw borders, labels, arrows, and highlighted regions on top

### 9.2 Map Visual Treatments

| Treatment | Description |
|-----------|-------------|
| **Desaturated + graded** | Base satellite imagery desaturated, then color-graded with warm tones. Creates a non-Google-Maps aesthetic. |
| **Period-authentic styling** | Historical map sequences get additional vintage treatment (CC Vintage, warmer tones). |
| **Flat vector overlay** | Simplified vector shapes (country outlines, regions) overlaid on satellite imagery for clarity. |
| **Dark mode map** | Map with dark base (ocean/land both dark), bright accent colors for borders and labels. |
| **Schematic map** | Simplified to just outlines and key features. No satellite texture. Clean geometric feel. |

### 9.3 Map Annotation Specifics

| Element | Specification |
|---------|--------------|
| **Country/region labels** | Sans-serif, uppercase, with a subtle shadow or background pill. Track to 3D null objects. |
| **Border lines** | Animated stroke (pen tool drawn, stroke effect with animated "End" parameter). Solid or dashed depending on border status. |
| **Disputed border** | Animated dashed line -- dots actually move along the line to signal uncertainty. |
| **Region highlight** | Semi-transparent color fill that wipes across the region shape. |
| **Data labels** | Floating numbers/text near the relevant geographic area. Fade-rise entrance, count-up for numbers. |
| **Route/path** | Animated line with leading dot. Width varies for emphasis. Color matches series palette. |
| **Event markers** | Spring-in icon/symbol at specific coordinates. Optional pulse/ripple effect. |
| **Scale indicator** | Clean measurement line with distance label. Appears when scale context matters. |

---

## 10. Audio Visualization Patterns

Primarily from Earworm, but occasionally in other series.

| Pattern | Description | Implementation |
|---------|-------------|----------------|
| **Waveform display** | Audio waveform rendered as a visual element. Specific sections highlighted, zoomed, annotated. | Real waveform data mapped to visual bars/lines |
| **Beat map grid** | Rhythmic pattern as a grid of cells. Each beat mapped to a cell. Emphasis beats larger/colored. Builds in real-time with music. | Grid of rectangular cells, fill-progress per beat |
| **Rhyme scheme visualization** | Lyrics as text with color-coded syllable highlighting. Internal rhymes in yellow, multi-syllabic in pink. Grid layout shows patterns. | Text with per-syllable color animations |
| **Circle of fifths** | Music theory circle diagram that starts simple and adds layers of complexity. Key relationships shown as connecting lines within the circle. | SVG circle with animated connectors |
| **Repetition diagram** | Boxy visualization showing repeated phrases in a song. Includes legend/instructions. Color-coded by phrase identity. | Grid with labeled legend, progressive reveal |
| **Spectrogram** | Frequency-time visualization showing how audio energy changes. Specific frequency bands highlighted. | Canvas or SVG rendered from audio data |
| **Tape deck illustration** | Illustrated tape deck, record player, or mixing console. Animated (reels spinning, faders moving, buttons pressing). | Vector illustration with transform animations |
| **Musical notation** | Staff notation shown for specific passages. Notes highlighted as they play. | Pre-rendered notation with per-note highlights |
| **Chord progression display** | Chord names in boxes arranged horizontally. Each chord highlights as it plays. Connecting arrows show harmonic movement. | Text boxes with sequential highlight |
| **Lyric cascade** | Lyrics flow across the screen synced to audio. Words that share rhymes or rhythmic position are visually connected. | Animated text with line connectors |

---

## 11. Annotation System Catalog

Every annotation type observed, with precise specifications.

### 11.1 Mark Types

| Mark | Specification | Usage |
|------|--------------|-------|
| **Circle** | Irregular/rough circle (not perfect geometric). 2-4px stroke width. Yellow (#FFEB00) or red (#E53E3E). Draws on screen via stroke animation (dash-offset). | Highlighting a specific element in a photo/document |
| **Arrow** | Straight or slightly curved arrow. 2-3px stroke. Same colors as circle. Head is solid triangle. Draws from tail to head. | Pointing to something off the highlighted area |
| **Underline** | Slightly wavy or straight underline below text. Yellow typically. Draws left-to-right. Slight rotation (0.5-1 degree) for hand-drawn feel. | Emphasizing text in documents |
| **Strikethrough** | Red line through incorrect text. Draws left-to-right. Often paired with replacement text below. | Fact-checking, corrections |
| **Bracket** | Curly bracket or square bracket beside a section. Draws top-to-bottom. Used to group related items. | Grouping concepts, sections |
| **Label connector** | Thin line from annotation circle/area to a floating text label. Line draws first, then label fades in. | Identifying elements in complex images |
| **Highlight block** | Semi-transparent yellow rectangle behind text. Animates width 0% to 100%. | Document text emphasis |
| **X mark** | Red X drawn over incorrect items. Two strokes drawn sequentially. | Incorrect/rejected items |
| **Check mark** | Green check drawn in single stroke. | Correct/accepted items |
| **Question mark** | Floating "?" near uncertain or questioned elements. Spring-in entrance. | Questioning a claim |

### 11.2 Annotation Placement Rules

| Rule | Description |
|------|-------------|
| **Entry timing** | Annotations appear 2-5 frames after the element they annotate is on screen. |
| **Draw duration** | Circles: 8-12 frames. Arrows: 6-10 frames. Underlines: 8-15 frames (proportional to text length). |
| **Color priority** | Yellow for emphasis/highlight. Red for correction/error. Green for confirmation. White for neutral labels on dark backgrounds. |
| **Stroke width** | 2-4px for standard annotations. Scale-relative to canvas (not hardcoded pixel values). |
| **Imperfection** | Annotations are never geometrically perfect. Slight wobble, rotation, or uneven stroke thickness. Achieved via feTurbulence filter, not hand-drawn SVG paths. |
| **Label distance** | Labels positioned 15-30px from the element they describe. Connector lines bridge the gap. |
| **Stacking** | When multiple annotations appear, they enter sequentially (4-8 frames apart), not simultaneously. |
| **Exit** | Annotations exit faster than they enter (75% of entry duration). Reverse order of entry. |

---

## 12. Transition Catalog

Every transition type observed across Vox series.

| Transition | Description | When Used |
|-----------|-------------|-----------|
| **Jump cut** | Direct cut, no transition effect. Vox's most common transition. "Transitions mean nothing. They give you no information." | Between most scenes |
| **3D camera track-back + blur** | Camera tracks backward in 3D space while Gaussian blur peaks at cut point. EasyEase keyframes curve peaks at edit point. Blur on adjustment layer, shorter duration than camera movement. | Between major sections |
| **Crossfade** | Opacity blend over 10-15 frames. | Mood changes, gentle shifts |
| **Match cut** | Two shots cut together where the framing or subject matches perfectly (same position on screen). | Text montages, visual parallels |
| **Zoom transition** | Camera zooms into an element which becomes the background/starting point of the next scene. | Drilling deeper into a topic |
| **Wipe (irregular)** | Non-geometric wipe with jagged/organic edge. | Before/after reveals |
| **News clip intercut** | Brief (1-2 second) news clips inserted between graphic sequences. | Grounding in reality |
| **Map zoom transition** | Map zooms out from one location and zooms into another. | Geographic context shifts |
| **Blackout** | Brief (5-10 frame) fade to black between sections. | Major topic transitions |
| **Color-block wipe** | A solid color block (often yellow) sweeps across the frame, revealing the new scene behind it. | Section changes |

---

## 13. Effect & Treatment Catalog

Every visual effect/treatment observed.

### 13.1 Core Effects

| Effect | Specification | Implementation |
|--------|--------------|----------------|
| **12fps stutter** | Graphics at 12fps within 24/30fps timeline | Posterize Time effect or frame quantization: `Math.floor(frame / 2.5) * 2.5` |
| **Film grain** | 16mm grain at 35% opacity, overlay blend | Cycling CSS noise pattern (2-3 textures/sec) or canvas noise with random offset |
| **Chromatic aberration** | RGB channel splitting 1-2px at edges | Duplicate element with red/blue tint offset via CSS transforms + mix-blend-mode |
| **Lens blur (edge)** | Gaussian blur 3.5px with inverted circular mask, feather 50px | CSS filter blur with radial-gradient mask |
| **CC Vintage** | Warm retro color grading on archival materials | Sepia/warm toning with slight desaturation |
| **Construction paper texture** | Tactile paper-art background | CSS background texture or SVG noise pattern |
| **Newsprint halftone** | Dot pattern at low opacity | CSS radial-gradient repeating pattern |
| **Vignette** | Edge darkening, circular, subtle | CSS radial-gradient or box-shadow inset |
| **Scanner-light effect** | Moving light bar across documents (forensic/investigation feel) | Animated linear-gradient overlay |
| **Lightbox glow** | Warm backlit glow behind transparent/translucent materials | Background glow with filter + transparency |

### 13.2 Color Treatments

| Treatment | Description |
|-----------|-------------|
| **Desaturation** | Reduce saturation 40-70% on map/archival footage. Never fully B&W on maps. |
| **Warm vintage grade** | Shift shadows toward warm brown, highlights toward warm yellow. For historical content. |
| **Cool documentary grade** | Slight blue shift in shadows, neutral highlights. For contemporary content. |
| **High contrast B&W** | Full desaturation + contrast boost. For photo cutouts and collage characters. |
| **Per-topic color theming** | Each video picks a limited palette (typically 2-3 colors) derived from the subject matter. |

### 13.3 Background Treatments

| Treatment | Description |
|-----------|-------------|
| **Textured dark** | Dark charcoal (#35313F or #4C4E4D) background with subtle cycling texture. |
| **Off-white clean** | Off-white (#F1F3F2) background for cleaner documentary segments. |
| **Motion texture** | 2-3 textures cycling at 2-3fps (duplicate, flip, rotate single texture for variety). |
| **Gradient** | Subtle radial gradient (dark edges, slightly lighter center) behind primary content. |
| **Wes Anderson desktop** | Flat-lay arrangement of objects on a desk/surface, shot top-down. Used for tangible subjects. |

---

## 14. Expanded Template System

Based on this forensic analysis, here is the expanded template catalog (52 templates, up from the original 18).

### 14.1 Text & Typography Templates

| # | Slug | Scene Type | Description |
|---|------|-----------|-------------|
| 1 | `vox-headline` | T1 | Full-screen bold serif headline with yellow accent bar, film grain, stutter |
| 2 | `vox-highlight` | T2 | Text with animated yellow highlighter sweep across key phrases |
| 3 | `vox-definition` | T3 | Key term spotlight with typewriter reveal, yellow underline |
| 4 | `vox-quote` | T4 | Large serif italic pull quote with accent quotation marks, attribution below |
| 5 | `vox-claim-debunk` | T5 | Statement displayed then annotated as false, correction appears |
| 6 | `vox-takeaway` | T6 | Numbered key points (1-3) with bold lead text, staggered entry |
| 7 | `vox-word-swap` | T7 | Sentence with highlighted word that animates to replacement |
| 8 | `vox-flying-text` | T8 | Large text as moving visual anchor with graphics building around it |
| 9 | `vox-lyric-cascade` | T9 | Lyrics with per-word color-coded highlighting synced to audio |
| 10 | `vox-source-cite` | T10 | Source citation bar at top of frame with publication name |

### 14.2 Data & Chart Templates

| # | Slug | Scene Type | Description |
|---|------|-----------|-------------|
| 11 | `vox-big-number` | D1 | Single statistic with count-up animation, supporting context |
| 12 | `vox-bar-chart` | D2 | Animated bar chart with staggered bar entry and annotations |
| 13 | `vox-line-graph` | D3 | Progressive line draw with data point pulses and counter |
| 14 | `vox-area-chart` | D4 | Stacked area chart with sequential layer fill |
| 15 | `vox-dot-population` | D5 | 100 dots that recolor to show proportional data |
| 16 | `vox-pie-donut` | D6 | Pie/donut chart with clockwise segment animation |
| 17 | `vox-timeline` | D7 | Historical timeline with progressive date reveals and branching labels |
| 18 | `vox-ranking` | D8 | Ranked list with staggered entry, #1 highlighted |
| 19 | `vox-comparison-bars` | D9 | Two bar sets side-by-side with animated growth and difference annotation |
| 20 | `vox-counter-dashboard` | D10 | Multiple counters ticking up simultaneously |

### 14.3 Map & Geographic Templates

| # | Slug | Scene Type | Description |
|---|------|-----------|-------------|
| 21 | `vox-map-zoom` | G1 | Satellite zoom from continental to street level, desaturated + graded |
| 22 | `vox-border-shift` | G2 | Animated historical border changes, color-coded by era |
| 23 | `vox-route-trace` | G3 | Path animating along road/river with leading dot |
| 24 | `vox-territory-fill` | G4 | Country shape filling with semi-transparent color wipe |
| 25 | `vox-demographic-map` | G5 | Map with floating data labels and count-up statistics |
| 26 | `vox-migration-flow` | G6 | Curved arrows showing population movement, width = volume |
| 27 | `vox-location-orbit` | G8 | Slow 3D orbit around a specific location with annotations |

### 14.4 Source Material Templates

| # | Slug | Scene Type | Description |
|---|------|-----------|-------------|
| 28 | `vox-document-zoom` | S1 | Document close-up with slow pan and yellow highlight on key phrases |
| 29 | `vox-headline-stack` | S2 | Multiple newspaper headlines overlapping, sliding in from different edges |
| 30 | `vox-photo-deep-dive` | S3 | Photograph with directed Ken Burns + annotation circles/arrows |
| 31 | `vox-blueprint` | S4 | Technical drawing with progressive component reveal and labels |
| 32 | `vox-social-post` | S5 | Social media screenshot with tilt, shadow, and annotation marks |
| 33 | `vox-screen-capture` | S6 | Website/app recording with guided cursor and zoom-to-detail |
| 34 | `vox-contact-sheet` | S8 | Film strip/grid of photos, one enlarging on focus |

### 14.5 Interview Templates

| # | Slug | Scene Type | Description |
|---|------|-----------|-------------|
| 35 | `vox-lower-third` | I3 | Step-reveal rough-textured name/title card with delayed text |
| 36 | `vox-expert-cite` | I1 | Expert video clip framed as citation with source credit |

### 14.6 Comparison Templates

| # | Slug | Scene Type | Description |
|---|------|-----------|-------------|
| 37 | `vox-side-by-side` | - | A vs B split with animated divider, staggered reveals |
| 38 | `vox-before-after` | - | Slider wipe between two states of the same subject |
| 39 | `vox-crossfade-compare` | - | Two states crossfading over 15-30 frames |
| 40 | `vox-claim-check` | T5 | Statement with annotation marks showing true/false/misleading |
| 41 | `vox-number-race` | - | Two counters racing to different values for scale comparison |

### 14.7 Narrative & Composite Templates

| # | Slug | Scene Type | Description |
|---|------|-----------|-------------|
| 42 | `vox-news-supercut` | N1 | Rapid montage of news clip placeholders with brisk editing |
| 43 | `vox-scrapbook` | N2 | Photos and documents assembling on screen, overlapping at angles |
| 44 | `vox-collage-character` | N3 | B&W cutout person with rough edges, puppet breathing, parallax |
| 45 | `vox-parallax-photo` | N4 | 2D photo with separated depth layers and 3D camera parallax |
| 46 | `vox-process-flow` | - | Step-by-step with numbered nodes, connecting lines, stagger cascade |
| 47 | `vox-cause-effect` | - | A leads to B chain with animated connector arrows |

### 14.8 Music & Audio Templates (Earworm-specific)

| # | Slug | Scene Type | Description |
|---|------|-----------|-------------|
| 48 | `vox-beat-map` | - | Grid visualization mapping rhythmic patterns, builds with audio |
| 49 | `vox-waveform` | - | Audio waveform with highlighted sections and annotations |
| 50 | `vox-rhyme-grid` | - | Lyric grid with color-coded syllable highlighting by rhyme pattern |
| 51 | `vox-chord-progression` | - | Chord name boxes with sequential highlight and connecting arrows |
| 52 | `vox-circle-diagram` | - | Circle of fifths or similar music theory diagram, progressive complexity |

---

## 15. Key Creative Personnel & Their Signatures

Understanding who made what helps identify per-series visual DNA.

| Person | Role | Series | Signature |
|--------|------|--------|-----------|
| **Joey Sendaydiego** | Art Director | Main channel | "Visual evidence over decoration." Flying text anchors. Subject-matter-driven visual worlds. |
| **Estelle Caswell** | Producer/Animator | Earworm | Self-taught motion designer. Beat-synced animation. Custom visual languages per episode. "Transitions mean nothing." |
| **Sam Ellis** | Producer | Atlas | Google Earth Studio master. Manual cartography. Master world map linking. Drone + annotation overlays. |
| **Phil Edwards** | Producer/Animator/Host | Almanac | One-man production. Archive-first visual sourcing. Bookend mirror technique. Document close-ups. |
| **Coleman Lowndes** | Producer | Darkroom | Photograph-as-canvas. Directed Ken Burns. Photo layer separation. Contact sheet displays. |
| **Ranjani Chakraborty** | Producer/Host | Missing Chapter | Archival collage. Protest poster aesthetics. Scrapbook assembly. Community voice centering. |
| **Christophe Haubursin** | Producer | By Design | Flat stylized motion graphics. Repetitive motifs for orientation. Blueprint overlays. |
| **Dion Lee** | Art Director | Explained, By Design, False Positive | Tactile material experimentation (paint, milk, oil). Scanner-light motifs. Paper texture collage for forensic content. |
| **Jackie Lay** | Motion Designer | Explained (Netflix) | Vector to pencil cel to watercolor to stop-motion. Wide visual range per episode. |
| **John McColgan** | Motion Designer | Explained (Netflix) S1 | "Unique visual world" per episode (Cryptocurrency, Astrology, Political Correctness). Cel animation experiments. |
| **Yuval Haker** | Animator | Mind, Explained | Hazy grainy illustration for memory. Emmy-nominated graphic design. Pinball machine body metaphor. |

---

## 16. Anti-Patterns (What Vox Does NOT Do)

Equally important for the template system -- things to avoid.

| Anti-Pattern | Why Vox Avoids It |
|-------------|-------------------|
| **Smooth corporate motion graphics** | Looks like an ad, not editorial. "You don't want it to look perfect." |
| **Full-speed animations at 24/30fps** | Loses the handcrafted editorial feel. The 12fps stutter is signature. |
| **Decorative transitions** | "Transitions mean nothing. They give you no information." Jump cuts preferred. |
| **Complex hand-drawn SVG paths** | Too polished, too difficult to maintain. Use filters for rough edges. |
| **Simultaneous element reveals** | Everything must build progressively. Never show a complete infographic all at once. |
| **Geometric perfection in annotations** | Circles, arrows, underlines should have intentional imperfection. |
| **Static backgrounds** | Every frame must have some life -- texture cycling, grain drift, micro-motion. |
| **Sound-bite talking heads** | Experts are woven into narration as citations, not given extended monologue sections. |
| **Stock footage domination** | Visuals should be constructed (animated, annotated, composited), not reliant on stock B-roll. |
| **Single visual technique throughout** | Each video uses multiple techniques. Repetitive composition kills retention. |
| **Clean, sharp photo edges** | Cutouts have rough edges (feTurbulence). Clean edges signal "corporate" not "editorial." |
| **Uniform animation timing** | Stagger delays must vary. Different elements get different spring configs. Uniformity = mechanical. |
| **Random floating particles** | No arbitrary decoration. Every moving element serves a purpose. |

---

## Sources

- [5 Breakdowns on Replicating the VOX Motion Graphic Look -- PremiumBeat](https://www.premiumbeat.com/blog/replicating-vox-motion-graphic/)
- [How Vox uses animation to make complicated topics digestible -- Storybench](https://www.storybench.org/how-vox-uses-animation-to-make-complicated-topics-digestible-for-everyone/)
- [How to Make Informational Videos Like Vox -- Kapwing](https://www.kapwing.com/resources/how-to-make-informational-videos-like-vox/)
- [Vox Atlas: Producer Sam Ellis on his map animations -- Storybench](https://www.storybench.org/vox-atlas-producer-sam-ellis-on-his-map-animations/)
- [How Vox Video uses Earth Studio -- Google Earth / Medium](https://medium.com/google-earth/how-vox-video-uses-earth-studio-for-dynamic-visual-storytelling-703fc871766e)
- [Vox Earworm: Estelle Caswell Interview -- School of Motion](https://www.schoolofmotion.com/blog/estelle-caswell-vox-podcast)
- [Estelle Caswell Interview -- Film Independent](https://www.filmindependent.org/blog/explainer-an-interview-with-vox-pop-video-essayist-estelle-caswell/)
- [How Earworm succeeds at 'dancing about architecture' -- The Next Web](https://thenextweb.com/news/earworm-youtube-music-dancing-about-architecture)
- [Vox Darkroom -- Yatesweb](https://www.yatesweb.com/vox-darkroom/)
- [Coleman Lowndes Portfolio](https://coleman-lowndes.com/vox)
- [Vox Missing Chapter -- Online Journalism Awards](https://awards.journalists.org/entries/vox-missing-chapter/)
- [Vox Borders behind the scenes -- Storybench](https://www.storybench.org/behind-the-scenes-of-the-vox-web-series-borders/)
- [Vox Borders -- Nieman Journalism Lab](https://www.niemanlab.org/2018/08/explanatory-video-engagement-how-voxs-borders-series-is-humanizing-the-map-and-building-local-source-networks/)
- [Dion Lee -- By Design Portfolio](https://dion.studio/By-Design)
- [Dion Lee -- False Positive Portfolio](https://dion.studio/False-Positive)
- [Dion Lee -- Explained Portfolio](https://dion.studio/Explained)
- [Film School: The Motion Infographics of Vox -- Viewinder](https://viewinder.com/vox-motion-infographics/)
- [Film School: The Motion Design of Vox -- Viewinder](https://viewinder.com/film-school-the-motion-design-of-vox/)
- [How to Create Vox Style Maps -- No Film School](https://nofilmschool.com/how-create-vox-style-map-animations-after-effects)
- [Mastering Vox Style Animation (YouTube summary)](https://galaxy.ai/youtube-summarizer/mastering-vox-style-animation-in-after-effects-a-step-by-step-guide-jBC1jIzrxx8)
- [Create Better Motion Graphics Like Vox -- Motion Street](https://motionstreet.thinkingtales.com/article/create-better-motion-graphics-like-vox)
- [Vox Explained Season 1 -- John McColgan Portfolio](https://www.mcmotion.art/vox-explained)
- [The Mind, Explained -- Yuval Haker / Behance](https://www.behance.net/gallery/94528081/Vox-The-Mind-Explained-on-Netflix)
- [The Mind Behind "The Mind, Explained" -- Art Publika](https://www.artpublikamag.com/post/the-mind-behind-the-mind-explained-on-the-making-of-the-limited-series-a-talk-with-adam-cole)
- [Vox Color Palette -- color-hex.com](https://www.color-hex.com/color-palette/7200)
- [Vox Media Brand Identity -- Adrian Koenigs](https://www.adriankoenigs.com/vox-media-branding)
- [Highlighter Effect Overlay Pack -- adamxwebb](https://www.adamxwebb.com/highlighters)
- [Phil Edwards Vox Producer -- APM Music](https://www.apmmusic.com/blog/meet-your-storyteller/meet-your-storyteller-phil-edwards-of-vox-media)
- [Phil Edwards of Vox talks explainers -- Brendan Miller](https://brendanmiller.co.uk/phil-edwards-of-vox-talks-explainers/)
- [Flatpack FX -- Vox Animation Techniques](https://www.flatpackfx.com/blog/create-amazing-vox-animations-in-after-effects)
- [Flatpack FX -- Vox Style Collage Animation](https://www.flatpackfx.com/blog/create-vox-style-collage-animation-adobe-after-effects)
- [Flatpack FX -- Vox Style Map Animation](https://www.flatpackfx.com/blog/create-awesome-vox-style-map-google-earth-studio-after-effects-2022)
- [Flatpack FX -- Vox Highlighter Effect](https://www.flatpackfx.com/blog/how-to-create-vox-highlighter-effect-after-effects-2019)
- [Jackie Lay Portfolio](http://jackielay.com/motion_voxseason3.php)
- [Why the best journalists on YouTube are former Vox employees](https://thelongstory.substack.com/p/why-the-best-journalists-on-youtube)
- [Neon Moire Show 33 -- Dion Lee](https://www.neonmoire.com/podcast/33/dion-lee)
- [Vox website fonts -- Fonts In Use](https://fontsinuse.com/uses/6828/vox-website)
