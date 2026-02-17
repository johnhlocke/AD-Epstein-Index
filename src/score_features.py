#!/usr/bin/env python3
"""Score ALL AD features using the v2 aesthetic scoring instrument.

Sends article page images to Claude Opus Vision with the 9-axis rubric
(Space / Story / Stage), extracts numeric 1-5 scores, and also enriches
structural data (designer, location, etc.) in the same API call.

Usage:
    python3 src/score_features.py                    # All unscored features
    python3 src/score_features.py --limit 10         # First 10 only
    python3 src/score_features.py --id 42            # Single feature
    python3 src/score_features.py --rescore          # Re-score already-scored features
    python3 src/score_features.py --dry-run          # Preview only (with cost estimate)
    python3 src/score_features.py --model claude-sonnet-4-5-20250929  # Use Sonnet

Cost estimate (Opus): ~$0.08-0.12 per feature, ~$130-190 for all 1,600.
Cost estimate (Sonnet): ~$0.015-0.025 per feature, ~$25-40 for all 1,600.
"""

import argparse
import base64
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

import anthropic
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
AD_ARCHIVE_BLOB = "https://architecturaldigest.blob.core.windows.net/architecturaldigest{date}thumbnails/Pages/0x600/{page}.jpg"
DEFAULT_MODEL = "claude-opus-4-6"
MAX_IMAGES = 20  # No practical cap — longest AD articles are ~12 pages
SCORING_VERSION = "v2.2"  # Added per-axis rationale (1-sentence explanation per score)

# Score columns in the features table
SCORE_COLUMNS = [
    "score_grandeur", "score_material_warmth", "score_maximalism",
    "score_historicism", "score_provenance", "score_hospitality",
    "score_formality", "score_curation", "score_theatricality",
]

# Maps JSON response keys to DB columns
SCORE_KEY_MAP = {
    "grandeur": "score_grandeur",
    "material_warmth": "score_material_warmth",
    "maximalism": "score_maximalism",
    "historicism": "score_historicism",
    "provenance": "score_provenance",
    "hospitality": "score_hospitality",
    "formality": "score_formality",
    "curation": "score_curation",
    "theatricality": "score_theatricality",
}

# Model pricing per million tokens
MODEL_PRICING = {
    "claude-opus-4-6": {"input": 15.0, "output": 75.0},
    "claude-sonnet-4-5-20250929": {"input": 3.0, "output": 15.0},
    "claude-haiku-4-5-20251001": {"input": 1.0, "output": 5.0},
}


def get_supabase():
    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
    return create_client(url, key)


# ═══════════════════════════════════════════════════════════
# Data loading
# ═══════════════════════════════════════════════════════════

def fetch_features(sb, feature_id=None, rescore=False):
    """Fetch features needing scoring, joined with issue data."""
    query = sb.table("features").select(
        "id, issue_id, homeowner_name, article_title, designer_name, "
        "location_city, location_state, location_country, design_style, "
        "page_number, score_grandeur"
    )

    if feature_id:
        query = query.eq("id", feature_id)
    elif not rescore:
        # Only unscored features
        query = query.is_("score_grandeur", "null")

    all_features = []
    offset = 0
    while True:
        batch = query.range(offset, offset + 999).execute()
        all_features.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Fetch issue data
    issue_ids = list(set(f["issue_id"] for f in all_features))
    issues = {}
    for iid in issue_ids:
        result = sb.table("issues").select("id, year, month, source_url").eq("id", iid).execute()
        if result.data:
            issues[iid] = result.data[0]

    results = []
    for f in all_features:
        iss = issues.get(f["issue_id"])
        if iss:
            results.append({
                "feature_id": f["id"],
                "homeowner_name": f.get("homeowner_name") or "Unknown",
                "article_title": f.get("article_title") or "",
                "designer_name": f.get("designer_name") or "",
                "location_city": f.get("location_city") or "",
                "location_state": f.get("location_state") or "",
                "location_country": f.get("location_country") or "",
                "design_style": f.get("design_style") or "",
                "page_number": f.get("page_number"),
                "already_scored": f.get("score_grandeur") is not None,
                "year": iss.get("year"),
                "month": iss.get("month"),
                "source_url": iss.get("source_url"),
            })
    return results


def get_feature_images(sb, feature_id):
    """Get image URLs from feature_images table (if backfill was run)."""
    result = sb.table("feature_images").select(
        "page_number, public_url"
    ).eq("feature_id", feature_id).order("page_number").execute()
    return result.data if result.data else []


def _decode_jwt_featured(source_url):
    """Fetch and decode JWT tocConfig from AD archive. Returns featured list or None."""
    resp = requests.get(source_url, headers=HEADERS, timeout=30)
    match = re.search(r"tocConfig\s*=\s*'([^']+)'", resp.text)
    if not match:
        return None

    jwt_token = match.group(1)
    parts = jwt_token.split(".")
    if len(parts) < 2:
        return None

    payload = parts[1]
    payload += "=" * (4 - len(payload) % 4)
    decoded = base64.urlsafe_b64decode(payload).decode("utf-8")
    data = json.loads(decoded)
    if isinstance(data, str):
        data = json.loads(data)

    return data.get("featured", [])


def _extract_pages(art):
    """Extract page numbers from an article's PageRange field."""
    page_range = art.get("PageRange", "")
    return [int(p.strip()) for p in page_range.split(",") if p.strip().isdigit()]


def fetch_article_page_range(source_url, name, article_title=None, page_number=None):
    """Find article's page range using 3 strategies: name, title, page number.

    Strategy 1: Match homeowner name in Title/Teaser/Creator
    Strategy 2: Match article_title against Title field
    Strategy 3: Match page_number within an article's PageRange
    """
    featured = _decode_jwt_featured(source_url)
    if not featured:
        return None, None

    # Strategy 1: Name matching (original approach)
    clean = name.split(" (")[0].replace("Mrs. ", "")
    search_terms = []
    for part in re.split(r"\s+(?:and|&)\s+", clean):
        last = part.strip().split()[-1]
        if len(last) >= 4:
            search_terms.append(last.upper())

    for art in featured:
        title = (art.get("Title") or "").upper()
        teaser = re.sub(r"<[^>]+>", "", art.get("Teaser") or "").upper()
        creator = (art.get("CreatorString") or "").upper()

        for term in search_terms:
            if term in title or term in teaser or term in creator:
                return _extract_pages(art), art

    # Strategy 2: Match by article title
    if article_title and len(article_title) >= 4:
        title_upper = article_title.upper().strip()
        for art in featured:
            jwt_title = (art.get("Title") or "").upper().strip()
            # Check if either contains the other (handles partial matches)
            if title_upper in jwt_title or jwt_title in title_upper:
                return _extract_pages(art), art
            # Also try significant words (3+ chars) from our title
            title_words = [w for w in re.split(r'\W+', title_upper) if len(w) >= 4]
            if title_words and all(w in jwt_title for w in title_words):
                return _extract_pages(art), art

    # Strategy 3: Match by page number (feature's page falls within article's range)
    if page_number:
        for art in featured:
            pages = _extract_pages(art)
            if pages and page_number in pages:
                return pages, art
            # Also check if page_number is near the article's page range
            if pages and min(pages) <= page_number <= max(pages):
                return pages, art

    return None, None


def download_page_images(pages, year, month):
    """Download page images from Azure Blob Storage. Returns list of (page_num, bytes)."""
    date_str = f"{year}{month:02d}01"
    fetched = []
    for page_num in pages[:MAX_IMAGES]:
        url = AD_ARCHIVE_BLOB.format(date=date_str, page=page_num)
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code == 200 and len(resp.content) > 1000:
                fetched.append((page_num, resp.content))
        except requests.RequestException:
            pass
    return fetched


def get_images_for_feature(sb, feature_id, name, year, month, source_url,
                           article_title=None, page_number=None):
    """Get page images — from Supabase Storage or Azure Blob fallback.

    Returns list of (page_num, image_bytes) tuples.
    """
    # Try feature_images table first (if backfill has run)
    stored = get_feature_images(sb, feature_id)
    if stored:
        images = []
        for row in stored[:MAX_IMAGES]:
            try:
                resp = requests.get(row["public_url"], timeout=15)
                if resp.status_code == 200 and len(resp.content) > 1000:
                    images.append((row["page_number"], resp.content))
            except requests.RequestException:
                pass
        if images:
            return images, "supabase"

    # Fallback: download from Azure Blob
    if not source_url or "architecturaldigest.com" not in source_url:
        return [], "none"

    try:
        pages, _ = fetch_article_page_range(
            source_url, name,
            article_title=article_title,
            page_number=page_number,
        )
    except Exception:
        return [], "none"

    if not pages:
        return [], "none"

    images = download_page_images(pages, year, month)
    return images, "azure"


# ═══════════════════════════════════════════════════════════
# v2 Scoring Prompt
# ═══════════════════════════════════════════════════════════

V2_RUBRIC = """
═══ GROUP 1: SPACE — The Physical Experience ═══

1. GRANDEUR (1-5)
Scale and material weight of the architecture itself.
  1 = 8-foot ceilings, human-scale rooms, books and clutter, drywall construction
  2 = Comfortable rooms, adequate ceiling height, standard residential construction
  3 = Clean, organized, generous proportions. Nice furniture, well-maintained. Quality but doesn't announce itself
  4 = High ceilings, stone or substantial construction, impressive volume. The architecture has weight
  5 = Triple-height spaces, gilded surfaces, glossy/reflective materials, gold tones. The architecture dominates its occupants
Visual cues: Ceiling height is the primary read. Then material finish (glossy vs matte). Then color temperature (gold = palace aspiration; wood = cabin retreat).

2. MATERIAL WARMTH (1-5)
The dominant tactile temperature of the space. Cold to warm.
  1 = White marble floors, lacquered surfaces, chrome fixtures, glass. Hard and cold
  2 = Mostly cold materials with minor warm accents. Travertine with some mahogany
  3 = Balanced tension — worn wood floors with clean white walls, fabric zones within gallery-like space
  4 = Predominantly warm with some cool structure. Paneled rooms, upholstered furniture, rugs
  5 = Wide-plank oak, linen upholstery, leather, terracotta, stone fireplace. Everything tactile and natural

3. MAXIMALISM (1-5)
Density of objects WITH internal coherence. Not just quantity — quantity with dialogue.
  1 = Spare, minimal, few objects, open space. Gallery-like emptiness
  2 = Some objects but restrained. Breathing room between things
  3 = Moderate layering. Objects present but not competing for attention
  4 = Dense and rich. Many objects but harmonious — consistent colors, related textures and patterns
  5 = Maximum density with maximum coherence. Pattern-on-pattern, all objects in dialogue. Every surface activated
Key: A room with 100 related objects = high. A room with 100 random objects = chaotic noise (low score).

═══ GROUP 2: STORY — The Narrative It Tells ═══

4. HISTORICISM (1-5)
How consistently the space commits to a historical period.
  1 = No historical reference. Contemporary everything, or wild cross-era mixing with no logic
  2 = Minor period accents in otherwise contemporary space
  3 = References history through purchased antiques or revival architecture, but anachronisms leak through (window AC in "Georgian" room, flatscreen above Baroque mantel)
  4 = Strong period commitment with minor modern intrusions. A genuine 1920s house with one Saarinen table
  5 = Full era consistency. Integrated infrastructure, period-appropriate furniture. No anachronisms
The tell: Anachronisms betray designed historicism. Louis XIV chair in a TV room = costuming, not history.

5. PROVENANCE (1-5)
How convincingly the space communicates accumulated life. Patina, wear, inherited objects.
  1 = Everything arrived at once. New construction, pristine furnishings. Purchased antiques in a 2010 house
  2 = Mostly new but with enough items to partially fake accumulated life
  3 = A great designer creating a space that feels like it's been there forever. Convincing but fabricated
  4 = Mix of inherited and purchased. The building itself has age. Worn leather, folk art, visible lives
  5 = Genuine accumulation across generations. Fading, chips, water rings. Objects used, not preserved
Key: Perfection is suspicious. Real age leaves evidence. You can buy old things but not provenance.

6. HOSPITALITY (1-5)
Whether the home is designed for its residents or for their guests.
  1 = Designed for the resident. Kitchen is personal. Best room is the private study. Spaces feel right with one or two people
  2 = Primarily private with a decent entertaining space
  3 = Balanced — comfortable for daily life but can host a dinner party
  4 = Public rooms dominate. Guest rooms, large entertaining spaces, circulation designed for flow
  5 = Social venue. Catering kitchen, guest wings, ballrooms, outdoor terraces for events. The home feels empty with just its owners — waiting for the party
CRITICAL: Score the INTENT, not the room size. A large living room in a private person's home is still 2. Read the article text — does it describe dinner parties and guests, or solitude and personal retreat? A recluse in a mansion scores low. A socialite in a cottage scores high.

═══ GROUP 3: STAGE — Who It's Performing For ═══

IMPORTANT: STAGE measures intent and audience, NOT visual intensity. A visually bold, expensive, maximalist space can score LOW on all three STAGE axes if the boldness serves the occupant's genuine personality rather than an outside audience. Ask: "Who is this for?" If the answer is "the person who lives here," STAGE is low — regardless of how much it cost or how dense it looks.

7. FORMALITY (1-5)
The behavioral rules the room enforces on its occupants.
  1 = Warm, personal touches, walked-on floors, curl-up furniture. "You belong here"
  2 = Comfortable but with some structure. You'd keep your shoes on
  3 = Quality and considered but not intimidating. You respect the space without feeling small
  4 = Clearly formal. Careful surfaces, deliberate arrangement. Rules implied
  5 = Overscaled, expensive, uncomfortable-looking furniture. The room makes you feel small. It tells you that you are the visitor, you are beneath it
CRITICAL: An aristocratic family home with grand rooms that have been LIVED IN for generations scores 2-3, not 4-5. Formality requires that the room disciplines its occupants. If the family treats the ballroom like a living room, it's low formality despite its scale.

8. CURATION (1-5)
Who directed this room and for whom.
  1 = Self-curated. The homeowner chose everything for personal reasons. The espresso machine is there because they love espresso, not because it photographs well
  2 = Mostly personal with some professional input
  3 = Professional designer involved but the owner's personality still evident
  4 = Designer-directed with styled vignettes. Symmetrical orientations, composed sight lines
  5 = Fully designer-directed for editorial lifestyle. Designed for how it looks in a photo, not how it's used. Could be a Soho House lobby — publishable, placeless
The tell: Symmetry is a design decision, not an organic outcome. Styled vignettes (lamp + side chair + three perfectly placed objects) are the smoking gun.
CRITICAL: Visual density ≠ high curation. A musician's home full of instruments, records, and art they personally collected is SELF-CURATED (1-2) even if it looks like a gallery. A collector's maximalism is personal, not editorial. High curation means a designer arranged things for visual effect, not that the owner has a lot of stuff.

9. THEATRICALITY (1-5)
How loudly the room performs wealth for an outside audience.
  1 = "If you know you know." Older, expensive items that aren't trendy but timeless. Function-first luxury (spa room, crazy espresso machine). Wealth serves the self
  2 = Quality evident but understated. A few knowing pieces, no brand broadcasting
  3 = Some recognizable designer pieces but restrained. The room has taste but also wants credit
  4 = Brand names prominent. Statement furniture, recognizable art. The room is starting to perform
  5 = Full performance. Brand-name everything, statement art by globally known artists (Koons, Warhol, Hirst) with no consistent theme, pictures of homeowner with celebrities, gilding, overdone classicism. Everything needs you to know its price
CRITICAL: Inherited wealth scores LOW. A centuries-old estate with Old Masters paintings scores 1-2 on theatricality — the wealth wasn't chosen to impress, it was inherited. Theatricality requires INTENTION to perform. Similarly, a personal collection amassed over decades (even if valuable) serves the collector, not the audience — score low.
""".strip()


def build_scoring_prompt(name, article_title, year, month):
    """Build the v2 scoring prompt for Opus Vision."""
    month_str = f"{month:02d}" if isinstance(month, int) else str(month)

    return f"""You are a calibrated aesthetic rater analyzing an Architectural Digest article about a featured home.

FEATURE: {name}
ARTICLE: {article_title}
ISSUE: AD {year}-{month_str}

Examine every page image carefully. Score this home on each of the 9 axes below using a 1-5 integer scale. Also extract structural data from the article text and captions.

{V2_RUBRIC}

═══ STRUCTURAL DATA (extract from text/captions) ═══
Extract these fields from what you can read in the article pages:
- homeowner_name, designer_name, architecture_firm
- location_city, location_state, location_country
- design_style (free text), year_built, square_footage, cost
- article_author (the writer's name, usually in a byline)

═══ SOCIAL/NETWORK DATA ═══
- notable_guests: Names of notable people mentioned visiting or socializing at this home
- social_circle: Mentions of social connections, parties, fundraisers, events hosted
- previous_owners: Previous owners if mentioned

RULES:
- Score EVERY axis 1-5. No nulls for scores. If uncertain, use your best judgment.
- For EACH score, write a 1-sentence rationale explaining WHY you chose that number for THIS specific home. Reference what you see in the images or read in the text. Be specific — name materials, rooms, objects, or article quotes that informed your score.
- Extract structural data ONLY from what is stated or visible in the images. Use null for missing fields.
- Read captions and small text — they contain designer credits, locations, and photographer names.

Respond with ONLY a JSON object:
{{
  "grandeur": <1-5>,
  "grandeur_rationale": "1 sentence why",
  "material_warmth": <1-5>,
  "material_warmth_rationale": "1 sentence why",
  "maximalism": <1-5>,
  "maximalism_rationale": "1 sentence why",
  "historicism": <1-5>,
  "historicism_rationale": "1 sentence why",
  "provenance": <1-5>,
  "provenance_rationale": "1 sentence why",
  "hospitality": <1-5>,
  "hospitality_rationale": "1 sentence why",
  "formality": <1-5>,
  "formality_rationale": "1 sentence why",
  "curation": <1-5>,
  "curation_rationale": "1 sentence why",
  "theatricality": <1-5>,
  "theatricality_rationale": "1 sentence why",
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
  "article_author": "Author name or null",
  "notable_guests": [],
  "social_circle": "text or null",
  "previous_owners": []
}}"""


# ═══════════════════════════════════════════════════════════
# Vision API call
# ═══════════════════════════════════════════════════════════

def score_with_vision(page_images, name, article_title, year, month, model):
    """Send page images to Claude Vision with v2 rubric. Returns parsed dict or None."""
    client = anthropic.Anthropic()

    content = []
    for page_num, img_bytes in page_images:
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": b64},
        })

    prompt = build_scoring_prompt(name, article_title, year, month)
    content.append({"type": "text", "text": prompt})

    try:
        message = client.messages.create(
            model=model,
            max_tokens=2048,
            messages=[{"role": "user", "content": content}],
        )

        result_text = message.content[0].text
        inp = message.usage.input_tokens
        out = message.usage.output_tokens

        pricing = MODEL_PRICING.get(model, MODEL_PRICING[DEFAULT_MODEL])
        cost = (inp / 1_000_000) * pricing["input"] + (out / 1_000_000) * pricing["output"]

        # Parse JSON
        json_match = re.search(r"\{[\s\S]*\}", result_text)
        if not json_match:
            return None, inp, out, cost

        parsed = json.loads(json_match.group())
        return parsed, inp, out, cost

    except Exception as e:
        print(f"    Vision API error: {e}")
        return None, 0, 0, 0.0


# ═══════════════════════════════════════════════════════════
# Score parsing and DB update
# ═══════════════════════════════════════════════════════════

def parse_scores(parsed):
    """Extract and validate 9 integer scores from parsed response."""
    scores = {}
    for json_key, db_col in SCORE_KEY_MAP.items():
        val = parsed.get(json_key)
        if val is not None:
            try:
                ival = int(val)
                if 1 <= ival <= 5:
                    scores[db_col] = ival
                else:
                    scores[db_col] = max(1, min(5, ival))  # Clamp
            except (ValueError, TypeError):
                pass
    return scores


def parse_structural(parsed, current_feature):
    """Extract structural enrichment fields. Only update if new value is better."""
    update = {}

    def maybe_set(db_col, value):
        if value and str(value).lower() not in ("null", "none", "n/a", "unknown", ""):
            # Only update if currently empty or if this is a richer value
            current = current_feature.get(db_col)
            if not current or str(current).lower() in ("null", "none", "unknown", ""):
                update[db_col] = value

    maybe_set("designer_name", parsed.get("designer_name"))
    maybe_set("architecture_firm", parsed.get("architecture_firm"))
    maybe_set("location_city", parsed.get("location_city"))
    maybe_set("location_state", parsed.get("location_state"))
    maybe_set("location_country", parsed.get("location_country"))
    maybe_set("design_style", parsed.get("design_style"))
    maybe_set("article_author", parsed.get("article_author"))

    # Homeowner name — only if currently Anonymous/Unknown
    hw = parsed.get("homeowner_name")
    if hw and str(hw).lower() not in ("null", "none", "unknown", "anonymous", ""):
        cur_name = current_feature.get("homeowner_name") or ""
        if cur_name.lower() in ("unknown", "anonymous", ""):
            update["homeowner_name"] = hw

    # Year built — integer
    yb = parsed.get("year_built")
    if yb:
        try:
            update["year_built"] = int(yb)
        except (ValueError, TypeError):
            pass

    # Square footage — integer
    sqft = parsed.get("square_footage")
    if sqft:
        if isinstance(sqft, (int, float)):
            update["square_footage"] = int(sqft)
        else:
            nums = re.findall(r"[\d,]+", str(sqft))
            if nums:
                update["square_footage"] = int(nums[0].replace(",", ""))

    # Cost — string
    cost = parsed.get("cost")
    if cost and str(cost).lower() not in ("null", "none", "n/a", ""):
        update["cost"] = str(cost)

    return update


def parse_rationale(parsed):
    """Extract per-axis rationale strings from parsed response."""
    rationale = {}
    for json_key in SCORE_KEY_MAP:
        rat = parsed.get(f"{json_key}_rationale")
        if rat and str(rat).lower() not in ("null", "none", ""):
            rationale[json_key] = str(rat)
    return rationale


def update_feature_scores(sb, feature_id, scores, structural, social_data, rationale=None):
    """Write scores + structural enrichment + rationale to Supabase."""
    update = {}
    update.update(scores)
    update.update(structural)
    update["scoring_version"] = SCORING_VERSION
    update["scored_at"] = datetime.now(timezone.utc).isoformat()

    # Store per-axis rationale as JSONB
    if rationale:
        update["scoring_rationale"] = rationale

    # Store social data in notes if present
    if social_data:
        update["notes"] = json.dumps(social_data)

    try:
        sb.table("features").update(update).eq("id", feature_id).execute()
        return True
    except Exception as e:
        print(f"    DB update error: {e}")
        return False


# ═══════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Score AD features with v2 aesthetic instrument")
    parser.add_argument("--dry-run", action="store_true", help="Preview without scoring")
    parser.add_argument("--limit", type=int, help="Max features to process")
    parser.add_argument("--id", type=int, help="Process single feature ID")
    parser.add_argument("--rescore", action="store_true", help="Re-score already-scored features")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Model to use (default: {DEFAULT_MODEL})")
    args = parser.parse_args()

    model = args.model
    pricing = MODEL_PRICING.get(model, MODEL_PRICING[DEFAULT_MODEL])

    print("=" * 60)
    print("AESTHETIC SCORING v2 — Space / Story / Stage")
    print(f"Model: {model} (${pricing['input']}/{pricing['output']} per M tokens)")
    print("=" * 60)

    sb = get_supabase()

    features = fetch_features(sb, feature_id=args.id, rescore=args.rescore)
    print(f"\nFound {len(features)} features to score")

    if args.limit:
        features = features[:args.limit]
        print(f"Limited to {len(features)} features")

    total_cost = 0.0
    total_tokens_in = 0
    total_tokens_out = 0
    scored = 0
    skipped = 0
    errors = 0

    for i, feat in enumerate(features):
        fid = feat["feature_id"]
        name = feat["homeowner_name"]
        title = feat["article_title"]
        year = feat["year"]
        month = feat["month"]
        source_url = feat["source_url"]

        print(f"\n[{i+1}/{len(features)}] Feature {fid}: {name} (AD {year}-{month:02d})")

        # Get images
        images, source = get_images_for_feature(
            sb, fid, name, year, month, source_url,
            article_title=feat.get("article_title"),
            page_number=feat.get("page_number"),
        )

        if not images:
            print("  SKIP: No images available")
            skipped += 1
            continue

        print(f"  {len(images)} pages from {source}")

        if args.dry_run:
            # Estimate cost: ~550 tokens per image + 2000 prompt + 700 output
            # v2.2: output ~doubled from v2.1 due to per-axis rationale sentences
            est_in = len(images) * 550 + 2000
            est_out = 700
            est_cost = (est_in / 1_000_000) * pricing["input"] + (est_out / 1_000_000) * pricing["output"]
            total_cost += est_cost
            scored += 1
            continue

        # Score with Vision
        parsed, inp, out, cost = score_with_vision(images, name, title, year, month, model)

        total_tokens_in += inp
        total_tokens_out += out
        total_cost += cost

        if not parsed:
            print("  ERROR: Vision returned no parseable response")
            errors += 1
            continue

        # Parse scores
        scores = parse_scores(parsed)
        if len(scores) < 9:
            print(f"  WARNING: Only {len(scores)}/9 scores parsed")
            if len(scores) < 5:
                print("  SKIP: Too few scores")
                errors += 1
                continue

        score_str = " ".join(f"{k.replace('score_','')}={v}" for k, v in sorted(scores.items()))
        print(f"  SCORES: {score_str}")
        print(f"  TOKENS: {inp} in / {out} out / ${cost:.4f}")

        # Parse structural enrichment
        structural = parse_structural(parsed, feat)
        if structural:
            print(f"  ENRICHED: {', '.join(f'{k}={v}' for k, v in structural.items())}")

        # Parse per-axis rationale
        rationale = parse_rationale(parsed)
        if rationale:
            print(f"  RATIONALE: {len(rationale)}/9 axes explained")
            if len(rationale) < 9:
                missing = [k for k in SCORE_KEY_MAP if k not in rationale]
                print(f"  WARNING: Missing rationale for: {', '.join(missing)}")

        # Parse social data
        social = {}
        for key in ["notable_guests", "social_circle", "previous_owners"]:
            val = parsed.get(key)
            if val and val != [] and str(val).lower() not in ("null", "none", "[]"):
                social[key] = val

        # Update DB
        if update_feature_scores(sb, fid, scores, structural, social, rationale=rationale):
            scored += 1
        else:
            errors += 1

        # Rate limit
        time.sleep(0.5)

    # Summary
    print(f"\n{'=' * 60}")
    print(f"DONE: {scored} scored, {skipped} skipped, {errors} errors")
    print(f"COST: ${total_cost:.2f} ({total_tokens_in:,} in / {total_tokens_out:,} out)")
    if args.dry_run:
        print(f"(DRY RUN — estimated cost for {scored} features)")
        per_feat = total_cost / scored if scored else 0
        all_est = per_feat * 1600
        print(f"Per feature: ~${per_feat:.4f} | All 1,600: ~${all_est:.0f}")


if __name__ == "__main__":
    main()
