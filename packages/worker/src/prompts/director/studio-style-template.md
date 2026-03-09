Polished card-based animations floating on dot-grid backgrounds. {variant_label} with glassmorphic cards.
This style has a PRE-BUILT TEMPLATE LIBRARY of 60+ components the Animator can copy and customize.

**COLOR PALETTE:** {variant_label} — background {background}, text {text}, textMuted {textMuted}.
Cards: glassmorphic ({cardBg} bg, blur(20px), 1px {cardBorder} border, 32px radius).
Grid: dot-grid ({gridColor}, 32px spacing, r=1 dots).
Default accents: primary #6366F1 (indigo), secondary #EC4899 (pink).

**FONT PAIRS (pick ONE per project):**
| Key | Headline | Body | Vibe |
|-----|----------|------|------|
| boldImpact | Bebas Neue | Roboto | Bold dramatic |
| cleanMinimal | Inter | Inter | Clean restrained |
| modernTech | Montserrat | Inter | Professional |
| elegantEditorial | Playfair Display | Lato | Sophisticated |
| friendlyTech | Poppins | Inter | Approachable |

**CARD LAYOUT:** Centered flex containers on dot-grid background.
Cards: s(56)-s(64) padding, maxWidth s(900) (or 85% canvas). Glass style default, also solid/gradient/outline.

**TEMPLATE LIBRARY:**
Check src/.templates/ for pre-built template source code. If a template matches the scene purpose,
plan the scene around that template's structure. Categories: data-viz (stat-counter, stat-donut,
bar-chart-race), lower-thirds (speaker-id, guest-intro-card), social (poll-battle, emoji-slider-poll),
comparisons (versus-screen, pros-cons), intros/outros (channel-intro, end-screen, logo-stinger),
marketing (product-card, coupon-badge, qr-code-reveal), education (definition-tooltip, formula-display).

If a STUDIO_TEMPLATES.md file exists in the workspace src/ directory, READ IT FIRST for the full
template catalog. Plan scenes that can leverage existing templates when possible.

**TEMPLATE SUGGESTIONS:**
For each scene, add a "suggestedTemplates" array to scenes.json with 1-2 template slugs that match
the scene's purpose. If no template fits, omit the field.
Examples: revenue growth → ["stat-counter"], comparison → ["versus-screen", "pros-cons"],
timeline → ["timeline-cascade"], process → ["process-flow"].

**ANIMATION FEEL:** SPRINGS.SMOOTH (damping: 26, stiffness: 120) for premium settle, SPRINGS.SNAPPY (damping: 18, stiffness: 180) for hero reveals.
Stagger 6-8 frames. Use spring entrances for cards, interpolate for continuous motion.
