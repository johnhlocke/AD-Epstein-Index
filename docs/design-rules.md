# Design Rules

This file is the "brain" of the design agent. It stores all design decisions, style preferences, and reference examples. The `/design-agent` reads this file before every task.

Update this file as the design evolves. Add examples, refine rules, remove what doesn't work.

---

## Aesthetic Direction

**Primary inspiration:** Clean editorial / investigative journalism (NYT, ProPublica, The Pudding)

**Tone:** Serious, credible, data-driven. Not flashy or sensational — let the data speak.

---

## Color Palette

*(To be refined as we add reference examples)*

- **Background:** White / off-white (`#FAFAFA`)
- **Text:** Near-black (`#1A1A1A`)
- **Accent:** TBD — something authoritative but not aggressive
- **Data viz primary:** TBD
- **Data viz secondary:** TBD
- **Danger/match highlight:** TBD

## Typography

*(To be refined)*

- **Headlines:** Serif font (editorial feel) — consider Georgia, Playfair Display, or similar
- **Body:** Clean sans-serif — Inter, system font stack
- **Data/labels:** Monospace or tabular figures for numbers

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
