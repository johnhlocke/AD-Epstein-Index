# Aesthetic Scoring Instrument v2: Space / Story / Stage

## Overview

A 9-axis numeric scoring instrument for classifying interior design aesthetics in Architectural Digest features. Each axis uses a 1–5 scale. Designed for systematic comparison between the general AD population (~1,600 features) and the Epstein-connected subset (~49 confirmed names).

Replaces the previous 6-dimension categorical taxonomy (v1) which used single-select controlled vocabulary. The categorical approach could not capture intensity, mixing, or the specific aesthetic signatures that distinguish the Epstein orbit.

## Academic Grounding

This instrument draws on established research in sociology, computational aesthetics, and AI evaluation methodology:

- **Bourdieu, P. (1984).** *Distinction: A Social Critique of the Judgement of Taste.* Harvard University Press. — Taste as social class marker; cultural capital theory. Directly informs the STAGE group.
- **Veblen, T. (1899).** *The Theory of the Leisure Class.* Macmillan. — Conspicuous consumption; domestic decoration as status display. Directly informs the Theatricality axis.
- **Trigg, A. B. (2001).** "Veblen, Bourdieu, and Conspicuous Consumption." *Journal of Economic Issues*, 35(1), 99–115. — Bridges Veblen's pecuniary emulation with Bourdieu's cultural capital framework.
- **Shabrina, Z., Arcaute, E., & Batty, M. (2019).** "Inside 50,000 Living Rooms: An Assessment of Global Residential Streetscapes." *arXiv preprint arXiv:1911.09635.* — Computational classification of interior design from images at scale. Key methodological precedent.
- **Kim, S., & Lee, S. (2020).** "Stochastic Detection of Interior Design Styles Using a Deep Learning Model." *Applied Sciences*, 10(20), 7299. — Probabilistic multi-label style scoring (not binary classification).
- **Osgood, C. E., Suci, G. J., & Tannenbaum, P. H. (1957).** *The Measurement of Meaning.* University of Illinois Press. — Semantic differential method; our 1–5 axes are a domain-specific adaptation.
- **Adilova, L., & Shamoi, P. (2024).** "Aesthetic Preference Prediction in Interior Design: A Multidimensional Approach Using Fuzzy Logic." *Applied Sciences*, 14(9), 3688. — Fuzzy logic for multi-dimensional aesthetic preference.
- **Yavuz, M. C. (2025).** "Is the LLM-as-a-Judge Reliable? A Study on the Robustness of LLM-based Evaluators." *arXiv preprint arXiv:2502.04915.* — Rubric-based LLM scoring produces ICC 0.94+. Validates our approach.

## Methodology

- **Rater**: Claude Opus Vision (multimodal LLM) — acts as a calibrated semantic rater, not a trained classifier
- **Input**: Article page images (462×600 JPEG from Azure Blob Storage) + article text/captions visible in images
- **Scoring**: All ~1,600 features scored with the same model and prompt for apples-to-apples comparison
- **Validation plan**:
  - Test-retest reliability: 20 features scored twice, measure ICC
  - Human calibration set: 25–30 features manually scored by licensed architect/designer
  - Cohen's kappa for inter-rater agreement

## The 9 Axes

### GROUP 1: SPACE — The Physical Experience

#### 1. Grandeur
Scale and material weight of the architecture itself. Ceiling height, room volume, stone vs. drywall. How much space does the architecture demand?

| Score | Anchor |
|-------|--------|
| 1 | 8-foot ceilings, human-scale rooms, books and clutter, drywall construction |
| 2 | Comfortable rooms, adequate ceiling height, standard residential construction |
| 3 | Clean, organized, generous proportions. Nice furniture, well-maintained. The room is clearly quality but doesn't announce itself |
| 4 | High ceilings, stone or substantial construction, impressive volume. The architecture has weight |
| 5 | Triple-height spaces, gilded surfaces, glossy/reflective materials, gold tones. The architecture dominates its occupants |

**Visual cues**: Ceiling height is the primary read. Then material finish (glossy vs. matte). Then color temperature (gold = aspiration to palace; wood = retreat to cabin).

#### 2. Material Warmth
The dominant tactile temperature of the space. Cold (marble, chrome, lacquer) to warm (wood, linen, leather). What do your hands expect to feel?

| Score | Anchor |
|-------|--------|
| 1 | White marble floors, lacquered surfaces, chrome fixtures, glass. Hard and cold |
| 2 | Mostly cold materials with minor warm accents. Travertine with some mahogany |
| 3 | Balanced tension — worn wood floors with clean white walls, fabric zones within a gallery-like space. Neither clinical nor cozy |
| 4 | Predominantly warm with some cool structure. Paneled rooms, upholstered furniture, rugs |
| 5 | Wide-plank oak, linen upholstery, leather, terracotta, stone fireplace. Everything is tactile and natural |

**Visual cues**: Broad material categories are visible in page images. Specific materials (marble types, wood species) come from reading the article text. Both channels work together.

#### 3. Maximalism
Density of objects with internal coherence. Not just quantity — quantity with dialogue between color, texture, pattern, and provenance.

| Score | Anchor |
|-------|--------|
| 1 | Spare, minimal, few objects, open space. Gallery-like emptiness |
| 2 | Some objects but restrained. Breathing room between things |
| 3 | Moderate layering. Objects present but not competing for attention |
| 4 | Dense and rich. Many objects but harmonious — consistent colors in rug and wallpaper, related textures and patterns |
| 5 | Maximum density with maximum coherence. Pattern-on-pattern, collected objects all in dialogue. Every surface activated |

**Key distinction**: Maximalism measures density WITH coherence. A room with 100 objects that share a color story = high. A room with 100 unrelated objects = chaotic noise (low score — the objects aren't in dialogue).

---

### GROUP 2: STORY — The Narrative It Tells

#### 4. Historicism
How consistently the space commits to a historical period. Measures temporal range from no period reference to full era consistency. Penalizes anachronisms.

| Score | Anchor |
|-------|--------|
| 1 | No historical reference. Contemporary everything, or wild cross-era mixing with no governing logic |
| 2 | Minor period accents in an otherwise contemporary space |
| 3 | References history through purchased antiques or revival architecture, but inconsistencies leak through (window AC in a "Georgian" room, flatscreen above a Baroque mantel) |
| 4 | Strong period commitment with minor modern intrusions. A genuine 1920s house with one Saarinen table |
| 5 | Full era consistency. Integrated infrastructure (heating/cooling invisible), period-appropriate furniture for the room's function. No anachronisms |

**The professional tell**: Anachronisms betray designed historicism. A Louis XIV chair in a TV room = costuming, not history. Genuinely historic rooms have consistent infrastructure — modern systems either predate or are carefully hidden.

**Note**: This axis also captures what was previously measured by "Eclecticism" — a low Historicism score implies temporal mixing, a high score implies era commitment.

#### 5. Provenance
How convincingly the space communicates accumulated life. Patina, wear, inherited objects. Not the age of the antiques — the relationship between the objects and the building.

| Score | Anchor |
|-------|--------|
| 1 | Everything arrived at once. New construction, pristine furnishings, no patina. Purchased antiques in a 2010 house |
| 2 | Mostly new but with enough items to partially fake accumulated life |
| 3 | A great designer (e.g., Roman and Williams) creating a space that feels like it's been there forever. Convincing but fabricated |
| 4 | Mix of inherited and purchased. The building itself has age. Worn leather, folk art, objects with visible lives |
| 5 | Genuine accumulation across generations. Fading, chips, water rings. Objects that have been used, not preserved. Nothing is perfect and old — unless it's a museum |

**Key insight**: Perfection is suspicious. Real age leaves evidence. A collector knows the patina IS the value. You can buy old things but you can't buy provenance — the relationship between objects and their home is what matters.

#### 6. Hospitality
Whether the home is designed primarily for its residents or for their guests. Private retreat vs. social venue.

| Score | Anchor |
|-------|--------|
| 1 | Designed for the resident. Kitchen is personal. Best room is the private study or master bedroom. Spaces feel right with one or two people |
| 2 | Primarily private with a decent entertaining space |
| 3 | Balanced — comfortable for daily life but can host a dinner party |
| 4 | Public rooms dominate. Guest rooms, large entertaining spaces, circulation designed for flow |
| 5 | Social venue. Catering kitchen, guest wings, ballrooms, outdoor terraces scaled for events. The home feels slightly empty with just its owners — the architecture is waiting for the party to arrive |

**Research significance**: Particularly diagnostic for the Epstein investigation. These homes weren't just residences — they were venues. The architecture of hosting, of drawing people in, is inscribed in the floor plan itself.

---

### GROUP 3: STAGE — Who It's Performing For

#### 7. Formality
The behavioral rules the room enforces on its occupants. Does the room invite you in or put you in your place?

| Score | Anchor |
|-------|--------|
| 1 | Warm, personal touches, walked-on floors, curl-up furniture. The room says "you belong here" |
| 2 | Comfortable but with some structure. You'd keep your shoes on |
| 3 | Quality and considered but not intimidating. You respect the space without feeling small |
| 4 | Clearly formal. Careful surfaces, deliberate arrangement. Rules are implied |
| 5 | Overscaled, expensive, uncomfortable-looking furniture. The room makes you feel small. It tells you that you are the visitor, you are beneath it and the homeowner |

**Key insight**: Formality is a power relationship between the room and its occupant. Independent from Grandeur — a tiny formal parlor with silk rope chairs can be more intimidating than a big casual barn.

#### 8. Curation
Who directed this room and for whom. The spectrum from self-curated private living to designer-directed publishable lifestyle.

| Score | Anchor |
|-------|--------|
| 1 | Self-curated. The homeowner chose everything for personal reasons. The La Marzocca is there because they love espresso, not because it photographs well |
| 2 | Mostly personal with some professional input |
| 3 | Professional designer involved but the owner's personality is still evident |
| 4 | Designer-directed with styled vignettes. Symmetrical orientations, composed sight lines |
| 5 | Fully designer-directed for editorial lifestyle. The room is designed for how it looks in a photo, not how it would actually be used by humans. Could be a Soho House lobby — publishable, placeless |

**The tell**: Symmetry is a design decision, not an organic outcome. Nobody naturally places matching lamps on matching tables flanking a centered sofa. Styled vignettes (lamp + side chair + three perfectly placed objects) are the smoking gun.

#### 9. Theatricality
How loudly the room performs wealth for an outside audience. The gap between "if you know you know" and "everyone must know."

| Score | Anchor |
|-------|--------|
| 1 | "If you know you know." Older, expensive items that aren't trendy but timeless. Function-first luxury (spa room, crazy espresso machine). Wealth serves the self, not the audience |
| 2 | Quality evident but understated. A few knowing pieces, no brand broadcasting |
| 3 | Some recognizable designer pieces but restrained. The room has taste but also wants credit for it |
| 4 | Brand names becoming prominent. Statement furniture, recognizable art. The room is starting to perform |
| 5 | Full performance. Brand-name everything, statement art by globally known artists (Koons, Warhol, Hirst) with no consistent theme, pictures of homeowner with celebrities, gilding, overdone classicism. Everything arrived at once and needs you to know its price |

**Theoretical frame**: This axis operationalizes Veblen's conspicuous consumption and Bourdieu's distinction. At score 5, every object is chosen for its recognizability to outsiders, not its relationship to other objects in the room. The art isn't a collection — it's a shopping list of auction headlines.

---

## Predicted Epstein Signature

Based on investigation data (49 confirmed connections) and professional calibration:

| Axis | AD Baseline (predicted) | Epstein Orbit (predicted) | Gap |
|------|------------------------|--------------------------|-----|
| Grandeur | ~2.8 | ~4.0 | +1.2 |
| Material Warmth | ~3.2 | ~2.3 | -0.9 |
| Maximalism | ~2.8 | ~3.5 | +0.7 |
| Historicism | ~2.5 | ~3.3 | +0.8 |
| Provenance | ~2.5 | ~2.8 | +0.3 (bimodal) |
| Hospitality | ~2.5 | ~4.0 | +1.5 |
| Formality | ~2.5 | ~4.0 | +1.5 |
| Curation | ~3.0 | ~4.2 | +1.2 |
| Theatricality | ~2.0 | ~3.8 | +1.8 |

**The STAGE group (Formality + Curation + Theatricality) is predicted to show the largest divergence** — rooms that perform wealth for an audience rather than serve their residents.

**Diagnostic composite**: `(Theatricality + Curation + Formality) - (Provenance + Material Warmth)` — High STAGE, low Provenance, low Warmth = the Epstein aesthetic signature. Cold, curated, performing.

**Provenance is the trap**: The Epstein orbit likely scores *medium* — not low (they buy genuine antiques) and not high (the houses are often new or recently renovated). They purchase the *signals* of accumulated life without actually having it.

## Derivation Process

This instrument was developed through collaborative Q&A between Claude (AI researcher) and the project owner (licensed architect and designer). The scoring anchors are calibrated against professional design judgment, validated through two edge case exercises:

1. **Palm Beach mansion** (2010 build, Mediterranean Revival, French antiques, Basquiat, celebrity photos): G5, MW2, Max4, H3, P1, Hosp[TBD], F5, C5, T5
2. **Connecticut farmhouse** (1920s stone, worn Chesterfield, Saarinen table, folk art, La Marzocca): G3-4, MW5, Max2-3, H4, P4, Hosp[TBD], F3, C1, T2

Key calibration insights from the architect:
- Grandeur reads as material weight, not just ceiling height (stone construction scores higher than expected)
- Provenance measures the building's life, not the objects' age (2010 house + 18th-century antiques = low provenance)
- Maximalism requires coherence, not just density (related objects in dialogue vs. random accumulation)
- Curation measures who directed the room and for whom (self-curated connoisseur = 1, designer-directed editorial = 5)
- Historicism penalizes anachronisms (Louis XIV chair in a TV room = costuming)
- Theatricality's opposite is "if you know you know" — timeless, function-first, self-serving wealth
