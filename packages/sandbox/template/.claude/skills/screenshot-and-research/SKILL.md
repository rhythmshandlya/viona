# Screenshot and Research Skill

## Purpose
Guide the process of finding, capturing, and presenting external visual references (websites, articles, social media, images) for use in video content. This skill covers research methodology, search query formulation, screenshot framing, attribution, and fallback strategies.

---

## 1. Web Research Methodology

### When Research Is Triggered

Research is needed when the edit plan calls for a `screenshot` treatment. The speaker has referenced an external visual artifact that must be sourced.

**Research triggers in transcript:**
- "If you go to [website]..."
- "There's this article by..."
- "Look at this tweet from..."
- "[Company] just announced..."
- "The documentation says..."
- "Here's what the interface looks like..."
- "According to [source]..."

### Research Priority

Not all references need equal effort. Prioritize based on editorial importance:

| Priority | Criterion | Action |
|---|---|---|
| **Must find** | Speaker explicitly shows or references specific content | Search until found, use exact source |
| **Should find** | Speaker references a type of content ("articles say...") | Find a representative example |
| **Nice to have** | Speaker mentions something in passing | Use if easily found, skip if not |
| **Skip** | Speaker references something generic ("the internet says") | Don't research, use text-overlay instead |

### Research Workflow

```
1. IDENTIFY: What specific thing did the speaker reference?
   - URL, product name, person, article title, tweet
   - Extract the most specific identifier

2. SEARCH: Find the source
   - Start with the most specific query
   - Broaden if needed (see Query Formulation below)
   - Time limit: 2 minutes per reference

3. VERIFY: Is this the right source?
   - Does it match what the speaker described?
   - Is the content current (not a deprecated/old version)?
   - Is it publicly accessible?

4. CAPTURE: Get the screenshot
   - Full page or specific region
   - Appropriate viewport/device
   - Clean state (no personal data, popups dismissed)

5. FRAME: Prepare for video
   - Apply device mockup (browser chrome, phone frame)
   - Crop to relevant region
   - Add highlights/annotations if needed

6. ATTRIBUTE: Credit the source
   - "Source: domain.com" in overlay
   - Date of capture if time-sensitive
```

---

## 2. Search Query Formulation

### Query Construction Rules

**Start specific, then broaden:**

```
Level 1 (Exact): "Jeff Atwood blog post coding horror best code never written"
Level 2 (Named): Jeff Atwood "best code" quote
Level 3 (Topic): programming quote about not writing code
Level 4 (Generic): inspirational programming quotes
```

Stop at the first level that returns a good result. Don't go to Level 4 if Level 2 works.

**Query patterns by reference type:**

| Reference Type | Query Pattern | Example |
|---|---|---|
| Specific website | `site:domain.com topic` | `site:react.dev hooks tutorial` |
| News article | `"article title" OR author name publication` | `"AI safety" "Yoshua Bengio" 2025` |
| Tweet | `from:@handle keyword site:twitter.com` | `from:@elonmusk tesla stock site:twitter.com` |
| Product page | `product name official site` | `Figma pricing page official` |
| Documentation | `technology name docs specific-feature` | `PostgreSQL docs JSON operators` |
| Research paper | `"paper title" OR authors filetype:pdf` | `"Attention Is All You Need" Vaswani` |
| GitHub repo | `repo-name github.com language` | `remotion github.com react video` |
| Image | `descriptive terms -stock -shutterstock` | `circuit board macro photography -stock` |

### Query Refinement

When initial queries fail:

**Too many results:** Add quotes around specific phrases, add date range, add `site:` filter
**Too few results:** Remove quotes, use fewer keywords, try synonyms
**Wrong results:** Add `-keyword` to exclude irrelevant topics, try different terminology
**Outdated results:** Add current year, add "2025" or "2026", add "latest"

### Source Evaluation

When multiple results match, choose based on:

1. **Authoritativeness**: Official source > third-party coverage > aggregator
2. **Recency**: Current version > archived version (unless historical reference)
3. **Visual quality**: Clean design > cluttered page (it's going in a video)
4. **Accessibility**: Publicly available > paywalled (viewer should be able to verify)

---

## 3. Screenshot Framing

### Device Mockups

Never use a raw screenshot. Always frame within a device:

**Browser Mockup (for websites):**
```
┌─────────────────────────────────────────────┐
│ ● ● ●  ┌─────────────────────────────┐  ─  │
│         │ https://example.com/page    │     │
│         └─────────────────────────────┘     │
│                                             │
│                                             │
│         [Website Content Here]              │
│                                             │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

**Components:**
- Traffic light buttons (red, yellow, green circles) — top left
- URL bar with actual URL — provides credibility
- Content area — the screenshot
- Optional tab bar for multi-tab screenshots
- Drop shadow: `boxShadow: '0 8px 32px rgba(0,0,0,0.3)'`
- Corner radius: 12px (macOS style) or 0px (Windows style)

**Phone Mockup (for mobile apps/sites):**
```
    ┌───────────────────┐
    │  9:41    ●  ▐▐▐▐  │
    │                   │
    │                   │
    │  [App Content]    │
    │                   │
    │                   │
    │  ──────────────   │
    └───────────────────┘
```

**Components:**
- Status bar (time, signal, battery)
- Content area
- Home indicator bar
- Device frame color matching video palette
- Aspect ratio: approximately 19.5:9

**Code Editor Mockup (for code screenshots):**
```
┌─────────────────────────────────────────────┐
│  main.ts    utils.ts    config.ts      ✕    │
├─────────────────────────────────────────────┤
│  1 │ import { useState } from 'react';     │
│  2 │                                        │
│  3 │ function Counter() {                   │
│  4 │   const [count, setCount] = useState(0)│
│  5 │   return (                             │
│  6 │     <button onClick={() =>             │
│  7 │       setCount(c => c + 1)}>           │
│  8 │       Count: {count}                   │
│  9 │     </button>                          │
│ 10 │   );                                   │
│ 11 │ }                                      │
└─────────────────────────────────────────────┘
```

**Components:**
- Tab bar with filename
- Line numbers
- Syntax highlighting (use a dark theme: One Dark, Dracula, or VS Code Dark+)
- Optional highlighted lines (yellow background on key lines)

### Zoom and Highlight

When the relevant content is a small part of a larger page:

**Two-Phase Approach:**
1. Show the full page in device mockup for 1-2 seconds (establish context)
2. Animate zoom to the relevant region over 15-20 frames
3. Add a highlight rectangle around the key content:
   - Border: 2-3px solid accent color
   - Background: accent color at 10% opacity
   - Corner radius: 4-8px
   - Optional pulse animation (scale 1.0 → 1.02 → 1.0, 30 frame cycle)

**Single-Region Approach (when context isn't needed):**
1. Show only the relevant region, already zoomed
2. Device mockup still present but cropped to the region
3. Add subtle highlight or annotation

### Screenshot Composition Rules

- **Resolution**: Capture at 2x resolution minimum (retina). Scale down for display.
- **Viewport**: Use 1440x900 for desktop, 390x844 for mobile (iPhone 14 Pro)
- **State**: Dismiss popups, cookie banners, notifications before capture
- **Personal data**: Never include personal accounts, emails, or identifiable information
- **Dark mode**: Match the video's overall color scheme (dark video = dark mode screenshots)
- **Text size**: Ensure the most important text is at least 16px at final display size
- **White space**: Don't show unnecessary footer, sidebar, or navigation — crop to content

---

## 4. Image Source Attribution

### When Attribution Is Required

- Academic/research content: Always attribute
- News articles: Attribute the publication
- Tweets/social posts: Show the handle and date
- Product screenshots: Name the product/company
- Code examples: Credit if from a named source (docs, tutorial)
- Stock images: Check license requirements

### Attribution Format

```
Source: domain.com
```

**Styling:**
- Position: Bottom-right of screenshot, outside the device mockup
- Font: Same family as other overlays, 16-18px, Regular weight
- Color: White at 60% opacity (subtle but legible)
- No background panel (attribution should not compete for attention)
- Duration: Visible for entire duration of the screenshot section

**For tweets/social:**
The attribution is built into the card design (handle, date). No additional attribution needed.

**For data/research:**
Include more detail: "Source: WHO Global Report, 2025"

---

## 5. Screenshot Types and Patterns

### Website/Product Page

**When:** Speaker discusses a product, service, or website
**Approach:** Browser mockup, full page or hero section, zoom to relevant feature
**Animation:** Slide up from bottom + slight scale (0.95 → 1.0), 12 frames

### Tweet/Social Media Post

**When:** Speaker references a viral tweet, post, or thread
**Approach:** Styled card (not a raw screenshot) with platform styling
**Components:** Avatar, name, handle, verified badge, content, timestamp, engagement metrics
**Animation:** Slide from right + fade, 10 frames. Optionally animate engagement numbers.

### Article/News

**When:** Speaker cites a news article or blog post
**Approach:** Clean card with headline, publication logo, date, author
**Content:** Headline text (verbatim) + blurred body text (privacy/readability)
**Animation:** Fade in with slight scale, 12 frames

### Code Block

**When:** Speaker discusses code, APIs, or terminal output
**Approach:** Code editor mockup with syntax highlighting
**Content:** Only the relevant lines (5-20 lines max). Add line highlights.
**Animation:** Line-by-line reveal (2-3 frames per line) or fade in
**Special:** Use monospace font (JetBrains Mono, Fira Code, or SF Mono)

### Data/Chart

**When:** Speaker references data from a study, report, or dashboard
**Approach:** Recreate the data as an animated chart (preferred over static screenshot)
**Alternative:** If recreating is impractical, screenshot with zoom to key data point
**Animation:** Chart bars grow, lines draw, numbers count up

### Comparison (Side-by-Side)

**When:** Speaker compares two products, approaches, or versions
**Approach:** Split screen with both screenshots, labels above each
**Components:** Left panel, divider line, right panel, labels
**Animation:** Both panels slide in from their respective sides, 15 frames

---

## 6. Fallback Strategies

When you can't find the exact referenced content:

### Fallback Hierarchy

```
1. EXACT MATCH: Found the specific source → Use it
2. SIMILAR SOURCE: Found a similar/related source → Use with slight context adjustment
3. RECREATION: Can recreate the visual (data, chart, code) → Build it as animation
4. REPRESENTATIVE: Found a representative example of the category → Use with generic framing
5. TEXT-OVERLAY: Can't find any visual → Convert to text-overlay treatment
6. SPEAKER-ONLY: Content doesn't need visual support → Keep as speaker-only
```

### Specific Fallback Patterns

**Can't find the website:**
- Use the Wayback Machine (web.archive.org) for older references
- Search for screenshots of the site on image search
- Recreate the key content as a styled card/text-overlay
- Show the URL in a browser mockup with a simplified recreation

**Can't find the tweet:**
- Search by quoted text, not just username
- Check if the tweet was deleted — use cached versions
- Recreate the tweet as a styled card with the quoted text
- Fall back to text-overlay with the quote and attribution

**Can't find the article:**
- Search by headline text in quotes
- Check Google Scholar for academic papers
- Use the publication's own search
- Fall back to a styled card with headline text and publication name

**Can't find the data:**
- Recreate the data point as an animated stat display
- Use a related data source that supports the same point
- Show the statistic as a text-overlay without visual chart
- Note in the edit plan: "Data source unverified — confirm with speaker"

**Image is low quality:**
- Try to find a higher-resolution version (reverse image search)
- Use AI upscaling if the content is critical
- Crop to the sharpest/most relevant region
- Fall back to text description of what the image showed

### When to Abandon Research

Stop researching and switch to a fallback when:
- You've spent > 2 minutes on a single reference
- The reference is too vague to search effectively
- The content is behind a paywall or login wall
- The referenced content no longer exists and no cache is available
- The visual would add minimal value to the section

---

## 7. Research Quality Checklist

Before including a screenshot in the edit plan:

- [ ] **Correct source**: Is this the actual thing the speaker referenced?
- [ ] **Current**: Is this the current version (not outdated/redesigned)?
- [ ] **Clean**: No popups, cookie banners, personal data, or ads?
- [ ] **Readable**: Is the key text legible at video output resolution?
- [ ] **Framed**: Is it in an appropriate device mockup?
- [ ] **Highlighted**: Is the relevant region clearly indicated?
- [ ] **Attributed**: Is the source credited?
- [ ] **Legal**: Does usage comply with fair use/fair dealing? (Editorial commentary, criticism, and education are generally fair use)
- [ ] **Relevant**: Does this screenshot actually add value over a text-overlay?
- [ ] **Timed**: Is the section long enough for the viewer to process the screenshot (minimum 3s)?

---

## 8. Research Notes Format

When documenting research findings for the edit plan:

```markdown
### Research: [Reference Description]
- **Spoken reference:** "If you look at the React docs on hooks..."
- **Search query:** `site:react.dev hooks introduction`
- **Source found:** https://react.dev/reference/react/hooks
- **Capture type:** Browser mockup, full page → zoom to "Rules of Hooks" section
- **Highlight:** Yellow border around the 3 rules
- **Attribution:** "Source: react.dev"
- **Notes:** Content matches speaker's description. Using dark mode to match video palette.
```

For failed research:

```markdown
### Research: [Reference Description]
- **Spoken reference:** "There was this viral tweet about..."
- **Search queries tried:** `@handle keyword`, `"quoted text" twitter`
- **Result:** Not found (likely deleted)
- **Fallback:** Recreate as styled tweet card with quoted text from transcript
- **Notes:** Quote text extracted from transcript at 2:34-2:38
```
