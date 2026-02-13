"""
6-Dimension Aesthetic Taxonomy for AD features.

Provides shared taxonomy definitions, prompt builders for both Vision (full-page)
and text-only (batch tagging) extraction, and response parsing/validation.

Dimensions:
  A. Architectural Envelope — the building
  B. Interior Atmosphere — the vibe
  C. Materiality — dominant texture
  D. Power & Status Signal — the research question
  E. Cultural Orientation — cultural frame
  F. Art & Collection — multi-select + named artists
"""

import json
import re
from datetime import datetime, timezone

# ═══════════════════════════════════════════════════════════
# Taxonomy definitions
# ═══════════════════════════════════════════════════════════

TAXONOMY = {
    "envelope": [
        "Classical/Neoclassical",
        "Modernist/International",
        "Vernacular/Regional",
        "Historic Revival",
        "Contemporary/Postmodern",
        "Urban/Industrial Adaptive",
    ],
    "atmosphere": [
        "Minimalist/Reductive",
        "Maximalist/Eclectic",
        "Formal/Antiquarian",
        "Rustic/Organic",
        "Glamour/Theatrical",
        "Corporate/Sterile",
    ],
    "materiality": [
        "Stone & Marble",
        "Wood & Warmth",
        "Glass & Steel",
        "Textile & Layered",
        "White/Monochrome",
    ],
    "power_status": [
        "Institutional/Monumental",
        "Resort/Hospitality",
        "Gallery/Curatorial",
        "Domestic/Intimate",
        "Whimsical/Fantasy",
    ],
    "cultural_orientation": [
        "Euro-Centric/Old World",
        "Americana/New World",
        "Global/Exoticism",
        "Placeless/Globalist",
    ],
    "art_collection": [
        "Old Masters",
        "Impressionist/Post-Impressionist",
        "Modern",
        "Contemporary",
        "Photography",
        "Sculpture",
        "Decorative/Antique Objects",
        "Tribal/Ethnographic",
        "Portraits/Ancestral",
        "None Mentioned",
    ],
}

DIMENSION_DEFINITIONS = {
    "envelope": {
        "Classical/Neoclassical": "Columns, pediments, symmetry, Palladian or Beaux-Arts references. Grand estates, plantation houses, Georgian manors.",
        "Modernist/International": "Flat roofs, open plans, curtain walls, Bauhaus or Corbusian influence. Glass boxes, Case Study houses.",
        "Vernacular/Regional": "Adobe, shingle-style, Mediterranean villa, Caribbean plantation, Swiss chalet — architecture tied to a specific place.",
        "Historic Revival": "Tudor, Gothic Revival, Italianate, Second Empire — deliberate historical pastiche built in a later era.",
        "Contemporary/Postmodern": "Built or renovated post-1980 with no single historical reference. Deconstructivist, blob, starchitect signature.",
        "Urban/Industrial Adaptive": "Converted lofts, warehouses, factories, churches. Industrial bones with residential overlay.",
    },
    "atmosphere": {
        "Minimalist/Reductive": "Spare, white or neutral, few objects, gallery-like emptiness. Less is more.",
        "Maximalist/Eclectic": "Pattern-on-pattern, collected objects, global mix, horror vacui. More is more.",
        "Formal/Antiquarian": "Period furniture, silk curtains, ancestral portraits, old-money restraint. Museum-quality rooms.",
        "Rustic/Organic": "Rough wood, stone fireplaces, natural textiles, wabi-sabi. Comfort over polish.",
        "Glamour/Theatrical": "Mirrored surfaces, lacquer, gold leaf, dramatic lighting. Hollywood Regency, Art Deco opulence.",
        "Corporate/Sterile": "Hotel-like, anonymous luxury. Could be a Four Seasons suite. No personal warmth.",
    },
    "materiality": {
        "Stone & Marble": "Dominant use of marble floors, limestone walls, travertine, granite. Cold luxury.",
        "Wood & Warmth": "Paneled rooms, parquet, exposed beams, teak, walnut. Tactile warmth.",
        "Glass & Steel": "Floor-to-ceiling glazing, steel frames, industrial transparency.",
        "Textile & Layered": "Rugs, tapestries, upholstery, curtains dominate the visual field. Soft and layered.",
        "White/Monochrome": "All-white or single-tone palette dominates regardless of actual materials.",
    },
    "power_status": {
        "Institutional/Monumental": "Scale and permanence signal power. Ballroom-sized rooms, ceremonial staircases, embassy-like grandeur.",
        "Resort/Hospitality": "Pool, tennis court, guest houses, spa. The home as private resort compound.",
        "Gallery/Curatorial": "Art collection is the centerpiece. Rooms designed around the collection, museum lighting.",
        "Domestic/Intimate": "Scaled for daily life. Family photos, dog beds, reading nooks. Wealth present but not performing.",
        "Whimsical/Fantasy": "Themed rooms, follies, treehouses, eccentric collections. Wealth as personal fantasy.",
    },
    "cultural_orientation": {
        "Euro-Centric/Old World": "French furniture, English gardens, Italian marble, Grand Tour references. The Atlantic axis.",
        "Americana/New World": "Ranch, Cape Cod, Craftsman, Palm Beach. American vernacular or American Dream.",
        "Global/Exoticism": "Moroccan tiles, Japanese screens, Balinese carvings, African textiles. Non-Western objects as decor.",
        "Placeless/Globalist": "Could be anywhere wealthy. International contemporary with no cultural specificity.",
    },
}

# Single-select dimensions (pick exactly one)
SINGLE_SELECT_DIMS = ["envelope", "atmosphere", "materiality", "power_status", "cultural_orientation"]


# ═══════════════════════════════════════════════════════════
# Prompt builders
# ═══════════════════════════════════════════════════════════

def _taxonomy_block():
    """Build the full taxonomy reference for LLM prompts."""
    lines = []
    for dim_key in SINGLE_SELECT_DIMS:
        label = {
            "envelope": "A. Architectural Envelope",
            "atmosphere": "B. Interior Atmosphere",
            "materiality": "C. Materiality",
            "power_status": "D. Power & Status Signal",
            "cultural_orientation": "E. Cultural Orientation",
        }[dim_key]
        lines.append(f"\n{label} (pick exactly ONE):")
        for val in TAXONOMY[dim_key]:
            defn = DIMENSION_DEFINITIONS[dim_key][val]
            lines.append(f"  - {val}: {defn}")

    lines.append("\nF. Art & Collection (multi-select — pick ALL that apply, or 'None Mentioned'):")
    for val in TAXONOMY["art_collection"]:
        lines.append(f"  - {val}")

    lines.append("\nG. Named Artists (free-text list of specific artist names mentioned in the article)")
    return "\n".join(lines)


def build_vision_prompt(name, article_meta, year, month):
    """Build prompt for Claude Vision extraction with page images.

    Args:
        name: Homeowner name
        article_meta: Dict with Title, Section, CreatorString, Teaser
        year, month: Issue date
    """
    month_str = f"{month:02d}" if isinstance(month, int) else str(month)
    title = (article_meta or {}).get("Title", "Unknown")
    section = (article_meta or {}).get("Section", "")
    author = (article_meta or {}).get("CreatorString", "")
    teaser = re.sub(r"<[^>]+>", "", (article_meta or {}).get("Teaser", "") or "")

    taxonomy = _taxonomy_block()

    return f"""You are analyzing pages from an Architectural Digest article about {name}'s home.

ISSUE: AD {year}-{month_str}
ARTICLE TITLE: {title}
SECTION: {section}
AUTHOR/PHOTOGRAPHER: {author}
TEASER: {teaser}

Read every page carefully. Extract TWO things:

═══ PART 1: STRUCTURAL DATA ═══
- homeowner_name, designer_name, architecture_firm
- location_city, location_state, location_country
- design_style (free text), year_built, square_footage, cost

═══ PART 2: AESTHETIC TAXONOMY ═══
Classify this home across 6 dimensions using the controlled vocabulary below.
{taxonomy}

═══ PART 3: SOCIAL/NETWORK DATA ═══
- notable_guests: Names of notable people mentioned visiting or socializing at this home
- art_collection_details: Notable artworks or artists displayed (feeds into taxonomy)
- neighborhood_context: Neighborhood, building name, or notable neighbors
- previous_owners: Previous owners if mentioned
- social_circle: Mentions of social connections, parties, fundraisers, events hosted

RULES:
- Extract ONLY what is stated or strongly implied in the text/images
- Use null for any field not found
- For aesthetic dimensions A-E, pick EXACTLY ONE value from the controlled vocabulary
- For F (Art & Collection), pick ALL that apply
- Read captions and small text — they contain designer credits and location details

Respond with ONLY a JSON object:
{{
  "homeowner_name": "Name or null",
  "designer_name": "Name or null",
  "architecture_firm": "Firm or null",
  "location_city": "City or null",
  "location_state": "State or null",
  "location_country": "Country or null",
  "design_style": "Free-text style or null",
  "year_built": null,
  "square_footage": null,
  "cost": "Amount or null",
  "envelope": "one value from dimension A",
  "atmosphere": "one value from dimension B",
  "materiality": "one value from dimension C",
  "power_status": "one value from dimension D",
  "cultural_orientation": "one value from dimension E",
  "art_collection": ["values from dimension F"],
  "named_artists": ["artist names mentioned"],
  "notable_guests": ["names"],
  "art_collection_details": ["artist/artwork"],
  "neighborhood_context": "text or null",
  "previous_owners": ["names"],
  "social_circle": "text or null"
}}"""


def build_text_prompt(title, homeowner, designer, location, existing_style):
    """Build prompt for text-only Haiku batch tagging (no images).

    Uses existing feature metadata to infer aesthetic classification.
    """
    taxonomy = _taxonomy_block()

    # Build context from available fields
    context_parts = []
    if title:
        context_parts.append(f"Article Title: {title}")
    if homeowner and homeowner.lower() not in ("anonymous", "null", "none"):
        context_parts.append(f"Homeowner: {homeowner}")
    if designer:
        context_parts.append(f"Designer/Architect: {designer}")
    if location:
        context_parts.append(f"Location: {location}")
    if existing_style:
        context_parts.append(f"Design Style (from prior extraction): {existing_style}")

    context = "\n".join(context_parts) if context_parts else "No metadata available"

    return f"""Classify this Architectural Digest featured home across 6 aesthetic dimensions.

FEATURE METADATA:
{context}

TAXONOMY — use ONLY these values:
{taxonomy}

Based on the metadata above, classify this home. Use the design style, designer name,
location, and era as signals. If the metadata is insufficient for a confident classification,
use the most likely value based on the designer's known style or the location's typical architecture.

Respond with ONLY a JSON object:
{{
  "envelope": "one value from dimension A",
  "atmosphere": "one value from dimension B",
  "materiality": "one value from dimension C",
  "power_status": "one value from dimension D",
  "cultural_orientation": "one value from dimension E",
  "art_collection": ["values from dimension F"],
  "named_artists": []
}}"""


# ═══════════════════════════════════════════════════════════
# Response parsing and validation
# ═══════════════════════════════════════════════════════════

def validate_profile(profile):
    """Check all dimensions have valid values. Returns (is_valid, errors)."""
    if not profile or not isinstance(profile, dict):
        return False, ["Profile is None or not a dict"]

    errors = []

    # Single-select dimensions
    for dim in SINGLE_SELECT_DIMS:
        val = profile.get(dim)
        if not val:
            errors.append(f"Missing dimension: {dim}")
        elif val not in TAXONOMY[dim]:
            errors.append(f"Invalid {dim} value: {val}")

    # Art collection — must be a list with valid values
    art = profile.get("art_collection")
    if not isinstance(art, list):
        errors.append("art_collection must be a list")
    elif art:
        for item in art:
            if item not in TAXONOMY["art_collection"]:
                errors.append(f"Invalid art_collection value: {item}")

    return len(errors) == 0, errors


def _fuzzy_match_value(value, valid_values):
    """Try to fuzzy-match a value to the controlled vocabulary.

    Handles common LLM variations like missing slashes, different casing, etc.
    """
    if not value:
        return None

    # Exact match
    if value in valid_values:
        return value

    # Case-insensitive match
    val_lower = value.lower().strip()
    for valid in valid_values:
        if valid.lower() == val_lower:
            return valid

    # Partial match (value contains or is contained in a valid value)
    for valid in valid_values:
        if val_lower in valid.lower() or valid.lower() in val_lower:
            return valid

    # First-word match (e.g., "Classical" → "Classical/Neoclassical")
    first_word = val_lower.split("/")[0].split(" ")[0]
    for valid in valid_values:
        if valid.lower().startswith(first_word):
            return valid

    return None


def parse_aesthetic_response(text, source="deep_extract"):
    """Parse LLM JSON response, validate against taxonomy, return profile dict or None.

    Args:
        text: Raw LLM response text
        source: "deep_extract" or "batch_tag" — stored in profile for provenance

    Returns:
        dict with aesthetic_profile structure, or None if unparseable
    """
    if not text:
        return None

    # Extract JSON from response
    clean = text.strip()
    if clean.startswith("```"):
        clean = clean.split("\n", 1)[1]
        if clean.endswith("```"):
            clean = clean[:-3]

    json_match = re.search(r"\{[\s\S]*\}", clean)
    if not json_match:
        return None

    try:
        parsed = json.loads(json_match.group())
    except json.JSONDecodeError:
        return None

    # Build aesthetic profile with fuzzy matching
    profile = {}

    for dim in SINGLE_SELECT_DIMS:
        raw = parsed.get(dim)
        if raw and isinstance(raw, str):
            matched = _fuzzy_match_value(raw, TAXONOMY[dim])
            profile[dim] = matched  # None if no match
        else:
            profile[dim] = None

    # Art collection — list of values
    art_raw = parsed.get("art_collection", [])
    if isinstance(art_raw, str):
        art_raw = [art_raw]
    if isinstance(art_raw, list):
        matched_art = []
        for item in art_raw:
            if isinstance(item, str):
                m = _fuzzy_match_value(item, TAXONOMY["art_collection"])
                if m:
                    matched_art.append(m)
        profile["art_collection"] = matched_art if matched_art else ["None Mentioned"]
    else:
        profile["art_collection"] = ["None Mentioned"]

    # Named artists — free text list
    artists = parsed.get("named_artists", [])
    if isinstance(artists, str):
        artists = [a.strip() for a in artists.split(",") if a.strip()]
    if isinstance(artists, list):
        profile["named_artists"] = [a for a in artists if isinstance(a, str) and a.lower() not in ("null", "none", "n/a")]
    else:
        profile["named_artists"] = []

    # Validate single-select dimensions
    valid, errors = validate_profile(profile)
    if not valid:
        # Try to salvage — if only 1-2 dimensions are missing, still return
        missing = [e for e in errors if "Missing" in e]
        invalid = [e for e in errors if "Invalid" in e]
        if len(missing) + len(invalid) > 2:
            return None  # Too many issues
        # Fill missing dims with None (will be tagged as incomplete)
        for dim in SINGLE_SELECT_DIMS:
            if dim not in profile:
                profile[dim] = None

    # Add metadata
    profile["source"] = source
    profile["extracted_at"] = datetime.now(timezone.utc).isoformat()

    return profile


def extract_structural_and_social(parsed):
    """Extract structural fields and social data from a parsed LLM response.

    Returns (enriched_fields, social_data) tuple.
    """
    enriched = {}
    for key in ["homeowner_name", "designer_name", "architecture_firm",
                "location_city", "location_state", "location_country",
                "design_style", "year_built", "square_footage", "cost"]:
        val = parsed.get(key)
        if val and str(val).lower() not in ("null", "none", "n/a", "unknown"):
            enriched[key] = val

    social = {}
    for key in ["notable_guests", "art_collection_details", "neighborhood_context",
                "previous_owners", "social_circle"]:
        val = parsed.get(key)
        if val and val != [] and str(val).lower() not in ("null", "none", "[]"):
            social[key] = val

    return enriched, social
