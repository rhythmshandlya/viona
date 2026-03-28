# Studio Theme: [Theme Name]

> This file defines the visual DNA for all Remotion scene animations. Every animator agent must follow this theme exactly.

## Color Palette

### Primary Colors
- **Background:** `#` — main scene background
- **Primary:** `#` — headings, key elements, emphasis
- **Secondary:** `#` — supporting elements, borders, accents
- **Accent:** `#` — highlights, active states, call-to-action elements

### Text Colors
- **Heading text:** `#`
- **Body text:** `#`
- **Muted text:** `#`

### Semantic Colors
- **Success/positive:** `#`
- **Warning/caution:** `#`
- **Error/negative:** `#`

## Typography

### Fonts
- **Heading font:** `` (weight: )
- **Body font:** `` (weight: )
- **Mono/code font:** `` (weight: )

### Sizes (relative to 1920x1080 canvas)
- **Title:** px
- **Heading:** px
- **Subheading:** px
- **Body:** px
- **Caption/label:** px

## Animation Style

### Spring Configuration
```typescript
const SPRING_CONFIG = {
  damping: ,    // 10-30 range. Lower = more bouncy
  mass: ,       // 0.5-2 range. Higher = heavier feel
  stiffness: ,  // 50-200 range. Higher = snappier
};
```

### Timing
- **Element entrance stagger:** frames minimum between elements
- **Default entrance duration:** frames
- **Default exit duration:** frames
- **Hold time before exit:** frames minimum

### Easing Preferences
- **Entrances:** spring (use SPRING_CONFIG above)
- **Exits:** ease-out
- **Repositions:** ease-in-out
- **Data/number changes:** linear

### Motion Principles
- Direction of motion: (e.g., "elements enter from bottom-right", "left-to-right flow")
- Scale entrances: start at % and scale to 100%
- Opacity: always fade in from 0, never pop in
- Rotation: use sparingly, max ° on entrances

## Shape & Layout

### Border Radius
- **Cards/containers:** px
- **Buttons/badges:** px
- **Icons/avatars:** (circle / rounded-square / square)

### Spacing
- **Element padding:** px
- **Gap between elements:** px
- **Margin from canvas edge:** px minimum

### Shadows
- **Card shadow:** `rgba(0,0,0,_) _px _px _px`
- **Floating element shadow:** `rgba(0,0,0,_) _px _px _px`

## Visual Elements

### Icon Style
- (outline / filled / duotone)
- Stroke width: px (if outline)
- Color: follows primary/secondary palette

### Decorative Elements
- (e.g., "subtle grid pattern on backgrounds", "rounded corner accent bars", "gradient overlays")

### Background Treatment
- **Scene backgrounds:** (solid color / gradient / subtle pattern)
- **Gradient direction:** (if applicable)
- **Pattern opacity:** % (if applicable)

## Do NOT Use
- (list any banned visual elements, e.g., "no 3D effects", "no gradients", "no drop shadows")

---

*This theme file is loaded by every animator agent before generating scene code. All constants (COLORS, SPRING_CONFIG, FONTS, SPACING) in `constants.ts` must match these values exactly.*
