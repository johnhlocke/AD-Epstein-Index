# Part 3: Aesthetic Methodology

All body text from the Aesthetic Methodology section (AestheticMethodologySection.tsx). Edit freely — text will be swapped back into the codebase.

---

## MAIN HEADER

### Tag
Aesthetic Scoring Instrument v2

### Title
HOW TASTE WAS MEASURED

### Subtitle
A 9-axis numeric scoring instrument for classifying interior design aesthetics.

### Intro Paragraph 1
The previous 6-dimension categorical taxonomy could classify homes but not measure intensity. A home was either "Classical/Neoclassical" or it wasn't -- there was no way to capture how classical, or to distinguish a tasteful Georgian from a gilded McMansion. The v2 instrument replaces categories with calibrated 1-5 scales, each anchored by concrete visual descriptions validated against professional architectural judgment.

### Intro Paragraph 2
The instrument is organized into three groups -- Space, Story, and Stage -- reflecting how a room operates on three levels simultaneously: its physical presence, the narrative it constructs about its inhabitants, and the audience it performs for. Each axis is scored independently by Claude Opus Vision reading the original magazine pages.

### Intro Paragraph 3
The theoretical frame draws on Bourdieu's cultural capital (taste as class marker), Veblen's conspicuous consumption (decoration as status display), and contemporary computational aesthetics research. The scoring anchors were calibrated through collaborative Q&A with a licensed architect and interior designer.

---

## SECTION 1: THE INSTRUMENT

### Title
THE INSTRUMENT

### Subtitle
Nine axes. Three groups. Each scored 1-5.

### GROUP 1: SPACE -- The Physical Experience

**Axis 01: Grandeur**
Description: Scale and material weight of the architecture. Ceiling height, room volume, stone vs. drywall. How much space does the architecture demand?
Anchor 1: 8-foot ceilings, human-scale rooms, drywall
Anchor 5: Triple-height spaces, gilded surfaces, glossy materials. The architecture dominates its occupants
AD Baseline: 2.8 / Epstein: 4.0

**Axis 02: Material Warmth**
Description: The dominant tactile temperature of the space. Cold (marble, chrome, lacquer) to warm (wood, linen, leather). What do your hands expect to feel?
Anchor 1: White marble, lacquered surfaces, chrome, glass. Hard and cold
Anchor 5: Wide-plank oak, linen, leather, terracotta, stone fireplace. Everything is tactile
AD Baseline: 3.2 / Epstein: 2.3

**Axis 03: Maximalism**
Description: Density of objects with internal coherence. Not just quantity -- quantity with dialogue between color, texture, pattern, and provenance.
Anchor 1: Spare, minimal, few objects, open space
Anchor 5: Maximum density with maximum coherence. Pattern-on-pattern, every surface activated
AD Baseline: 2.8 / Epstein: 3.5

### GROUP 2: STORY -- The Narrative It Tells

**Axis 04: Historicism**
Description: How consistently the space commits to a historical period. Measures temporal range from no period reference to full era consistency. Penalizes anachronisms.
Anchor 1: No historical reference. Contemporary everything
Anchor 5: Full era consistency. Integrated infrastructure, no anachronisms
AD Baseline: 2.5 / Epstein: 3.3

**Axis 05: Provenance**
Description: How convincingly the space communicates accumulated life. Patina, wear, inherited objects. Not the age of the antiques -- the relationship between the objects and the building.
Anchor 1: Everything arrived at once. New construction, pristine furnishings
Anchor 5: Genuine accumulation across generations. Fading, chips, water rings
AD Baseline: 2.5 / Epstein: 2.8

**Axis 06: Hospitality**
Description: Whether the home is designed primarily for its residents or for their guests. Private retreat vs. social venue.
Anchor 1: Designed for the resident. Spaces feel right with one or two people
Anchor 5: Social venue. Guest wings, ballrooms, terraces scaled for events. The architecture is waiting for the party
AD Baseline: 2.5 / Epstein: 4.0

### GROUP 3: STAGE -- Who It's Performing For

**Axis 07: Formality**
Description: The behavioral rules the room enforces on its occupants. Does the room invite you in or put you in your place?
Anchor 1: Warm, personal, curl-up furniture. The room says "you belong here"
Anchor 5: Overscaled, expensive, uncomfortable. The room makes you feel small
AD Baseline: 2.5 / Epstein: 4.0

**Axis 08: Curation**
Description: Who directed this room and for whom. The spectrum from self-curated private living to designer-directed publishable lifestyle.
Anchor 1: Self-curated. The homeowner chose everything for personal reasons
Anchor 5: Fully designer-directed for editorial lifestyle. Publishable, placeless
AD Baseline: 3.0 / Epstein: 4.2

**Axis 09: Theatricality**
Description: How loudly the room performs wealth for an outside audience. The gap between "if you know you know" and "everyone must know."
Anchor 1: "If you know you know." Function-first luxury. Wealth serves the self
Anchor 5: Full performance. Brand-name everything, celebrity photos, gilding. Everything needs you to know its price
AD Baseline: 2.0 / Epstein: 3.8

---

## RADAR CHART: PREDICTED DIVERGENCE

### Card Title
PREDICTED DIVERGENCE

### Card Subtitle
9 axes · predicted values · results pending

### Legend Labels
- AD BASELINE
- EPSTEIN ORBIT

### Group Legend (below chart)
- GROUP 1: SPACE -- The Physical Experience
- GROUP 2: STORY -- The Narrative It Tells
- GROUP 3: STAGE -- Who It's Performing For

---

## SECTION 2: THE EPSTEIN SIGNATURE

### Title
THE EPSTEIN SIGNATURE

### Subtitle
A single composite score that captures the aesthetic of performed wealth.

### Left Card: DIAGNOSTIC FORMULA

**Formula:**
SIGNATURE = ( Theatricality + Curation + Formality ) − ( Provenance + Material Warmth )

**Description:**
High STAGE scores (performing for an audience) combined with low Provenance (purchased rather than inherited) and low Material Warmth (cold, hard surfaces) produces the Epstein aesthetic signature. Cold, curated, performing.

### Right Card: PREDICTED DIVERGENCE

**Description:**
The STAGE group -- Formality, Curation, and Theatricality -- is predicted to show the largest divergence between the Epstein orbit and the AD baseline. These are rooms that perform wealth for an audience rather than serve their residents.

**Gap Stats:**
- Theatricality: +1.8 -- Largest predicted gap
- Hospitality: +1.5 -- Venues, not homes
- Formality: +1.5 -- Rooms that intimidate
- Curation: +1.2 -- Designer-directed
- Grandeur: +1.2 -- Scale and weight
- Material Warmth: −0.9 -- Colder than baseline

---

## SECTION 3: SCORING METHODOLOGY

### Title
SCORING METHODOLOGY

### Subtitle
How every home was scored. Rater, inputs, validation plan.

### Card: RATER
Claude Opus Vision (multimodal LLM) acts as a calibrated semantic rater, not a trained classifier. All ~1,600 features are scored with the same model and prompt for apples-to-apples comparison.

### Card: INPUT
Article page images (462×600 JPEG from Azure Blob Storage) plus article text and captions visible in the images. Both visual and textual channels work together to produce each score.

### Card: VALIDATION
Test-retest reliability (20 features scored twice, measuring ICC). Human calibration set (25–30 features manually scored by a licensed architect). Cohen's kappa for inter-rater agreement. Results pending.

### REFERENCES

- Bourdieu, P. (1984). *Distinction: A Social Critique of the Judgement of Taste.* Harvard University Press.
- Veblen, T. (1899). *The Theory of the Leisure Class.* Macmillan.
- Trigg, A. B. (2001). "Veblen, Bourdieu, and Conspicuous Consumption." *Journal of Economic Issues,* 35(1), 99–115.
- Osgood, C. E., Suci, G. J., & Tannenbaum, P. H. (1957). *The Measurement of Meaning.* University of Illinois Press.
- Shabrina, Z., Arcaute, E., & Batty, M. (2019). "Inside 50,000 Living Rooms." *arXiv:1911.09635.*
- Kim, S., & Lee, S. (2020). "Stochastic Detection of Interior Design Styles." *Applied Sciences,* 10(20), 7299.
- Adilova, L., & Shamoi, P. (2024). "Aesthetic Preference Prediction in Interior Design." *Applied Sciences,* 14(9), 3688.
- Yavuz, M. C. (2025). "Is the LLM-as-a-Judge Reliable?" *arXiv:2502.04915.*
