# Design Rules

This file is the "brain" of the design agent. It stores all design decisions, style preferences, and reference examples. The `/design-agent` reads this file before every task.

Update this file as the design evolves. Add examples, refine rules, remove what doesn't work.

---

## Aesthetic Direction

**Primary inspiration:** Clean editorial / investigative journalism (NYT, ProPublica, The Pudding)

**Tone:** Serious, credible, data-driven. Not flashy or sensational — let the data speak.

---

## Color Palette

- **Background:** Off-white (`#FAFAFA`)
- **Text:** Near-black (`#1A1A1A`)
- **Accent:** Warm copper (`#B87333`) — authoritative but not aggressive
- **Accent light:** `#D4A574`
- **Accent muted:** `#E8D5C0`
- **Data viz primary:** Copper `#B87333`
- **Data viz secondary:** Forest green `#2D6A4F`
- **Data viz tertiary:** Slate blue `#4A7C8F`
- **Confirmed match:** Green `#2D6A4F` on `#D8F3DC`
- **Rejected match:** Muted red `#9B2226` on `#FDE8E8`
- **Pending review:** Amber `#B8860B` on `#FFF3CD`
- **Border:** `#E5E5E5`
- **Muted text:** `#737373`

## Typography

- **Headlines:** Playfair Display (serif, editorial weight)
- **Body:** Inter (clean sans-serif, great readability)
- **Data/labels:** JetBrains Mono (monospace, tabular figures)
- All fonts loaded via `next/font/google` (self-hosted, no external requests)

## Layout

- Maximum content width: ~720px for text, ~1200px for data visualizations
- Generous white space — let content breathe
- Clear visual hierarchy: headline → summary → visualization → detail

## Component Patterns

*(Will be populated as we build components)*

## Reference Examples

*(Add URLs, screenshots, or descriptions of designs you like. The design agent will analyze these and extract applicable patterns.)*

### Example 1
- **Source:** *(paste URL or describe)*
- **What I like about it:** *(describe)*
- **Patterns to extract:** *(the agent will fill this in)*

---

## Do's and Don'ts

### Do
- Use data visualizations that are honest and clearly labeled
- Include source citations for all data points
- Make matched names scannable (tables, sorted lists)
- Show confidence levels visually (color coding, icons)

### Don't
- Don't sensationalize — present facts, not conclusions
- Don't use red as primary color (too aggressive for a research tool)
- Don't hide the methodology — show how matches were determined
- Don't auto-play animations or transitions
