"""
Cross-reference AD homeowner names against Epstein data sources.

Searches:
1. Epstein's Little Black Book (local text file — fast)
2. DOJ Epstein Library (justice.gov — requires Playwright, queued for manual/agent review)

Designed to run in parallel with the pipeline agent. Queries Supabase for
features that haven't been cross-referenced yet.

Usage:
    python3 src/cross_reference.py                # Check all unchecked names
    python3 src/cross_reference.py --name "John"  # Search a specific name
    python3 src/cross_reference.py --status        # Show cross-reference progress
"""

import json
import os
import re
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
BLACK_BOOK_PATH = os.path.join(DATA_DIR, "black_book.txt")
XREF_DIR = os.path.join(DATA_DIR, "cross_references")

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_ANON_KEY")
supabase = create_client(url, key)

# Names to skip (not real people, generic words, or known false positives)
SKIP_NAMES = {"anonymous", "unknown", "none", "n/a", "", "others", "and others",
              "the", "brothers", "hotel", "studio", "associates", "group",
              "house", "estate", "residence", "apartment", "villa", "palace",
              "design", "modern", "classic", "gallery"}

# Words that indicate a name is a business, hotel, or landmark — not a person
NON_PERSON_INDICATORS = {"hotel", "palace", "resort", "inn", "lodge", "manor",
                         "club", "foundation", "museum", "gallery", "studio",
                         "associates", "group", "corporation", "corp", "inc",
                         "llc", "ltd", "company", "partners", "estate",
                         "chateau", "castle", "tower", "plaza", "center",
                         "institute", "academy", "church", "temple",
                         "ranch", "farm", "vineyard", "winery"}

# DOJ context keywords that suggest a person is staff/contractor, not a principal
DOJ_UNRELATED_ROLES = {"contractor", "construction", "electrician", "plumber",
                       "maintenance", "security", "guard", "driver", "chef",
                       "housekeeper", "gardener", "landscaper", "painter",
                       "carpenter", "mechanic", "worker", "employee", "staff"}

# Minimum name length to search (avoids matching single first names like "Kevin")
MIN_NAME_LENGTH = 2  # Must have at least first + last name


def load_black_book():
    """Load the Black Book text file into memory."""
    if not os.path.exists(BLACK_BOOK_PATH):
        print("Warning: Black Book text file not found at", BLACK_BOOK_PATH)
        return ""
    with open(BLACK_BOOK_PATH) as f:
        return f.read()


def search_black_book(name, book_text):
    """Search the Black Book for a name. Returns match details or None."""
    if not book_text or not name:
        return None

    # Clean the name
    name = name.strip()
    if name.lower() in SKIP_NAMES:
        return None

    # Split into individual names if multiple people listed
    # e.g., "Jane & Max Gottschalk" → ["Jane Gottschalk", "Max Gottschalk"]
    individual_names = split_names(name)

    results = []
    for individual in individual_names:
        matches = _search_single_name(individual, book_text)
        if matches:
            results.extend(matches)

    return results if results else None


def split_names(name):
    """Split compound names into individuals, filtering out non-name words.

    Handles patterns like:
    - "Jane & Max Gottschalk" → ["Jane Gottschalk", "Max Gottschalk"]
    - "Kevin and Nicole" → [] (no last name, filtered out)
    - "Tom Kundig, Jamie Bush" → ["Tom Kundig", "Jamie Bush"]
    """
    # Strip leading articles
    name = re.sub(r"^(The|the)\s+", "", name)

    # Strip trailing qualifiers like "and others", "et al"
    name = re.sub(r",?\s*(and others|et al\.?)$", "", name, flags=re.IGNORECASE)

    # Handle "First & First Last" pattern
    name = name.replace(" and ", " & ")
    if " & " in name:
        parts = name.split(" & ")
        if len(parts) == 2:
            # Get the last name from the second part
            second_parts = parts[1].strip().split()
            if len(second_parts) >= 2:
                last_name = second_parts[-1]
                first_names = [parts[0].strip(), parts[1].strip()]
                # Check if first part already has a last name
                first_parts = parts[0].strip().split()
                if len(first_parts) == 1:
                    first_names[0] = f"{first_parts[0]} {last_name}"
                return _filter_names(first_names)
            # Both parts are single words (e.g., "Kevin & Nicole") — no last name
            return _filter_names([parts[0].strip(), parts[1].strip()])

    # Handle comma-separated names
    if ", " in name and not re.match(r"^[A-Z][a-z]+, [A-Z][a-z]+$", name):
        # Multiple names separated by commas (but not "Last, First" format)
        return _filter_names([n.strip() for n in name.split(",") if n.strip()])

    return _filter_names([name])


def _filter_names(names):
    """Remove non-name entries from a list of names."""
    filtered = []
    for n in names:
        if n.lower() in SKIP_NAMES:
            continue
        words = n.split()
        if len(words) < MIN_NAME_LENGTH:
            continue
        # Skip if any word in the name is a skip word (e.g., "Danaos brothers")
        if any(w.lower() in SKIP_NAMES for w in words):
            continue
        filtered.append(n)
    return filtered


def _word_boundary_search(term, text):
    """Check if term appears as a whole word (not substring) in text."""
    pattern = r'\b' + re.escape(term) + r'\b'
    return re.search(pattern, text, re.IGNORECASE)


def _search_single_name(name, book_text):
    """Search for a single name in the Black Book.

    Uses word-boundary matching to avoid substring false positives
    (e.g., "Bush" matching "Bushnell", "Sultana" matching "Sultanate").
    """
    parts = name.strip().split()
    if len(parts) < MIN_NAME_LENGTH:
        # Skip single-word names (first name only, generic words)
        return None

    matches = []

    # Strategy 1: Full name search (word boundary)
    if _word_boundary_search(name, book_text):
        context = _get_context(name, book_text)
        matches.append({"query": name, "match_type": "full_name", "context": context})

    # Strategy 2: Last, First format (most reliable for Black Book)
    if len(parts) >= 2:
        last_name = parts[-1]
        first_name = parts[0]

        if len(last_name) > 3:
            # Check for "Last, First" format (common in the book) — high confidence
            pattern = f"{last_name}, {first_name}"
            if _word_boundary_search(pattern, book_text):
                context = _get_context(pattern, book_text)
                matches.append({"query": pattern, "match_type": "last_first", "context": context})
            # Only fall back to last-name-only if the last name is uncommon (5+ chars)
            # and we haven't found a better match
            elif not matches and len(last_name) >= 5:
                if _word_boundary_search(last_name, book_text):
                    context = _get_context(last_name, book_text)
                    matches.append({"query": last_name, "match_type": "last_name_only", "context": context})

    return matches if matches else None


def _get_context(search_term, text, context_lines=5):
    """Get surrounding context for a match in the text."""
    lines = text.split("\n")
    search_lower = search_term.lower()

    for i, line in enumerate(lines):
        if search_lower in line.lower():
            start = max(0, i - 1)
            end = min(len(lines), i + context_lines)
            return "\n".join(lines[start:end]).strip()

    return None


def get_unchecked_features():
    """Get features from Supabase that haven't been cross-referenced yet.

    Primary: Uses cross_references table in Supabase (one row per checked feature).
    Fallback: Uses local results.json if cross_references table not available.

    A feature is considered "checked" if it has a row in cross_references OR
    has no homeowner_name / name is in SKIP_NAMES.
    """
    # Get all features from Supabase (source of truth)
    result = supabase.table("features").select("*").execute()
    features = result.data

    # Try Supabase cross_references table first
    has_xref_ids = set()
    try:
        from db import get_features_without_xref
        unchecked_from_db = get_features_without_xref()
        # Build checked set from features NOT in unchecked list
        unchecked_ids = {f["id"] for f in unchecked_from_db}
        # Features that don't need checking (no name or skip-listed)
        skip_ids = set(
            f["id"] for f in features
            if not f.get("homeowner_name") or f["homeowner_name"].strip().lower() in SKIP_NAMES
        )
        checked_ids = {f["id"] for f in features if f["id"] not in unchecked_ids} | skip_ids
        unchecked = [f for f in features if f["id"] not in checked_ids]
        return unchecked, checked_ids
    except Exception:
        pass

    # Fallback: local results.json
    os.makedirs(XREF_DIR, exist_ok=True)
    results_path = os.path.join(XREF_DIR, "results.json")
    has_result_ids = set()
    if os.path.exists(results_path):
        with open(results_path) as f:
            results = json.load(f)
        for r in results:
            has_result_ids.add(r["feature_id"])

    skip_ids = set(
        f["id"] for f in features
        if not f.get("homeowner_name") or f["homeowner_name"].strip().lower() in SKIP_NAMES
    )

    truly_done = has_result_ids | skip_ids
    unchecked = [f for f in features if f["id"] not in truly_done]
    checked_ids = truly_done

    return unchecked, checked_ids


def save_checked_ids(checked_ids):
    """Save the set of checked feature IDs."""
    checked_path = os.path.join(XREF_DIR, "checked_features.json")
    with open(checked_path, "w") as f:
        json.dump(sorted(checked_ids), f)


def cross_reference_all():
    """Run cross-reference on all unchecked features."""
    unchecked, checked_ids = get_unchecked_features()

    if not unchecked:
        print("All features have been cross-referenced.")
        return

    print(f"Cross-referencing {len(unchecked)} unchecked features...\n")

    book_text = load_black_book()
    results_path = os.path.join(XREF_DIR, "results.json")

    # Load existing results
    if os.path.exists(results_path):
        with open(results_path) as f:
            all_results = json.load(f)
    else:
        all_results = []

    black_book_hits = 0
    doj_queue = []

    for feature in unchecked:
        name = feature.get("homeowner_name")
        feature_id = feature["id"]

        if not name or name.strip().lower() in SKIP_NAMES:
            checked_ids.add(feature_id)
            continue

        print(f"  Checking: {name}")

        # Black Book search
        bb_matches = search_black_book(name, book_text)
        bb_status = "match" if bb_matches else "no_match"
        if bb_matches:
            black_book_hits += 1
            print(f"    BLACK BOOK MATCH: {bb_matches[0]['query']} ({bb_matches[0]['match_type']})")

        result = {
            "feature_id": feature_id,
            "homeowner_name": name,
            "black_book_status": bb_status,
            "black_book_matches": bb_matches,
            "doj_status": "pending",  # Needs Playwright agent
            "doj_results": None,
        }

        all_results.append(result)
        checked_ids.add(feature_id)

        # Queue for DOJ search (to be done by epstein-search agent)
        doj_queue.append(name)

    # Save results
    os.makedirs(XREF_DIR, exist_ok=True)
    with open(results_path, "w") as f:
        json.dump(all_results, f, indent=2)
    save_checked_ids(checked_ids)

    # Save DOJ queue for the epstein-search agent
    queue_path = os.path.join(XREF_DIR, "doj_search_queue.json")
    with open(queue_path, "w") as f:
        json.dump(doj_queue, f, indent=2)

    print(f"\nCross-reference complete!")
    print(f"  Black Book matches: {black_book_hits}")
    print(f"  DOJ searches queued: {len(doj_queue)} (run /epstein-search for each)")
    print(f"  Results saved to: {results_path}")


def search_single_name(name):
    """Search a specific name against all sources."""
    book_text = load_black_book()

    print(f"Searching for: {name}\n")

    # Black Book
    bb_matches = search_black_book(name, book_text)
    if bb_matches:
        print("BLACK BOOK:")
        for m in bb_matches:
            print(f"  Match type: {m['match_type']}")
            print(f"  Query: {m['query']}")
            if m.get("context"):
                print(f"  Context:\n    {m['context'][:300]}")
            print()
    else:
        print("BLACK BOOK: No match\n")

    print("DOJ EPSTEIN LIBRARY: Use /epstein-search to check interactively")


def show_status():
    """Show cross-reference progress."""
    unchecked, checked_ids = get_unchecked_features()
    total = len(unchecked) + len(checked_ids)

    print("=" * 50)
    print("Cross-Reference Status")
    print("=" * 50)
    print(f"  Total features: {total}")
    print(f"  Checked: {len(checked_ids)}")
    print(f"  Unchecked: {len(unchecked)}")

    results_path = os.path.join(XREF_DIR, "results.json")
    if os.path.exists(results_path):
        with open(results_path) as f:
            results = json.load(f)
        bb_matches = sum(1 for r in results if r["black_book_status"] == "match")
        doj_pending = sum(1 for r in results if r["doj_status"] == "pending")
        print(f"\n  Black Book matches: {bb_matches}")
        print(f"  DOJ searches pending: {doj_pending}")
    print("=" * 50)


# ── Verdict Assessment (used by Detective agent) ───────────────────

# Common last names — matches on these are more likely false positives
COMMON_LAST_NAMES = {
    "smith", "johnson", "williams", "brown", "jones", "davis", "miller",
    "wilson", "moore", "taylor", "anderson", "thomas", "jackson", "white",
    "harris", "martin", "thompson", "garcia", "martinez", "robinson",
    "clark", "rodriguez", "lewis", "lee", "walker", "hall", "allen",
    "young", "king", "wright", "scott", "green", "baker", "adams",
    "nelson", "hill", "campbell", "mitchell", "roberts", "carter",
    "phillips", "evans", "turner", "torres", "parker", "collins",
    "edwards", "stewart", "flores", "morris", "murphy", "cook", "rogers",
    "morgan", "peterson", "cooper", "reed", "bailey", "bell", "gomez",
    "kelly", "howard", "ward", "cox", "diaz", "richardson", "wood",
    "watson", "brooks", "bennett", "gray", "james", "reyes", "cruz",
    "hughes", "price", "myers", "long", "foster", "sanders", "ross",
    "morales", "powell", "sullivan", "russell", "ortiz", "jenkins",
    "gutierrez", "perry", "butler", "barnes", "fisher",
}

HONORIFICS_SET = {"jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "esq", "esq.", "phd"}


def generate_name_variations(name: str) -> list:
    """Generate search variations for a name.

    Returns:
        List of name strings to try, ordered from most specific to least:
        [full name, "Last, First", without honorifics, first+last only]
    """
    if not name or not name.strip():
        return []

    name = name.strip()
    variations = [name]
    parts = name.split()

    if len(parts) < 2:
        return variations

    # "Last, First" format
    first_name = parts[0]
    last_name = parts[-1]

    # Strip honorifics from last position
    clean_parts = [p for p in parts if p.lower().rstrip(".") not in HONORIFICS_SET]
    if len(clean_parts) >= 2:
        last_name = clean_parts[-1]
        first_name = clean_parts[0]

    last_first = f"{last_name}, {first_name}"
    if last_first not in variations:
        variations.append(last_first)

    # Without honorifics (if different from original)
    without_honorifics = " ".join(clean_parts)
    if without_honorifics != name and without_honorifics not in variations:
        variations.append(without_honorifics)

    # First + last only (skip middle names/initials)
    if len(clean_parts) > 2:
        first_last = f"{clean_parts[0]} {clean_parts[-1]}"
        if first_last not in variations:
            variations.append(first_last)

    # Last name only (fallback — only if 5+ chars)
    if len(last_name) >= 5 and last_name not in variations:
        variations.append(last_name)

    return variations


def assess_combined_verdict(name: str, bb_matches, doj_result) -> dict:
    """Combine Black Book and DOJ results into a single verdict.

    Args:
        name: The homeowner name
        bb_matches: List of Black Book match dicts, or None
        doj_result: DOJ search result dict, or None

    Returns:
        Dict with verdict, confidence_score, rationale, false_positive_indicators, evidence_summary
    """
    bb_has_match = bool(bb_matches)
    bb_match_types = [m.get("match_type", "") for m in (bb_matches or [])]
    bb_best = _best_bb_match_type(bb_match_types)

    doj_confidence = "none"
    doj_total = 0
    if doj_result and doj_result.get("search_successful"):
        doj_confidence = doj_result.get("confidence", "none")
        doj_total = doj_result.get("total_results", 0)

    # Detect false positive indicators
    fp_indicators = detect_false_positive_indicators(name, bb_matches, doj_result)

    # Build evidence summary
    evidence = {
        "black_book": {
            "has_match": bb_has_match,
            "best_match_type": bb_best,
            "match_count": len(bb_matches) if bb_matches else 0,
        },
        "doj": {
            "searched": doj_result is not None and doj_result.get("search_successful", False),
            "confidence": doj_confidence,
            "total_results": doj_total,
        },
    }

    # Verdict logic
    verdict, score, rationale = _determine_verdict(
        bb_has_match, bb_best, doj_confidence, doj_total, fp_indicators
    )

    return {
        "verdict": verdict,
        "confidence_score": score,
        "rationale": rationale,
        "false_positive_indicators": fp_indicators,
        "evidence_summary": evidence,
    }


def _best_bb_match_type(match_types: list) -> str:
    """Return the highest-confidence match type from a list."""
    rank = {"last_first": 4, "full_name": 3, "last_name_only": 2}
    best = ""
    best_rank = 0
    for mt in match_types:
        r = rank.get(mt, 0)
        if r > best_rank:
            best_rank = r
            best = mt
    return best


def _determine_verdict(bb_has_match, bb_best, doj_confidence, doj_total, fp_indicators):
    """Core verdict logic. Returns (verdict, confidence_score, rationale)."""
    has_fp_risk = len(fp_indicators) > 0

    # Non-person entity (hotel, palace, resort, etc.) — downgrade to needs_review
    # Always route through Researcher for final confirmation/dismissal
    is_non_person = any("non-person entity" in ind for ind in fp_indicators)
    if is_non_person:
        return ("needs_review", 0.10,
                "Name appears to be a business/hotel/landmark, not a person — routing to Researcher for confirmation")

    # Both strong: confirmed
    if bb_best in ("last_first",) and doj_confidence == "high":
        return ("confirmed_match", 0.95,
                "Strong match in both Black Book (last_first) and DOJ (high confidence)")

    # One very strong source
    if bb_best == "last_first" and doj_confidence in ("medium", "low", "none"):
        if doj_confidence == "none" and not has_fp_risk:
            return ("likely_match", 0.75,
                    "Strong Black Book match (last_first), DOJ returned no results")
        if doj_confidence == "medium":
            return ("likely_match", 0.80,
                    "Strong Black Book match (last_first) + DOJ medium confidence")
        return ("likely_match", 0.70,
                "Strong Black Book match (last_first), weak/no DOJ evidence")

    if doj_confidence == "high" and not bb_has_match:
        return ("likely_match", 0.75,
                "DOJ high confidence but no Black Book match")

    # Moderate evidence
    if bb_best == "full_name" and doj_confidence in ("medium", "high"):
        return ("likely_match", 0.70,
                f"Black Book full_name match + DOJ {doj_confidence} confidence")

    if bb_best == "full_name" and doj_confidence in ("low", "none"):
        if has_fp_risk:
            return ("needs_review", 0.40,
                    "Black Book full_name match but false positive indicators present")
        return ("possible_match", 0.50,
                "Black Book full_name match, weak/no DOJ evidence")

    # Weak evidence
    if bb_best == "last_name_only":
        if doj_confidence in ("high", "medium"):
            return ("possible_match", 0.45,
                    f"Black Book last_name_only + DOJ {doj_confidence}")
        if has_fp_risk:
            return ("needs_review", 0.25,
                    "Last name only match with false positive indicators")
        return ("possible_match", 0.30,
                "Black Book last_name_only match, weak/no DOJ evidence")

    if doj_confidence in ("medium", "low") and not bb_has_match:
        if has_fp_risk:
            return ("needs_review", 0.20,
                    f"DOJ {doj_confidence} confidence, no BB match, false positive risk")
        return ("possible_match", 0.30,
                f"DOJ {doj_confidence} confidence, no Black Book match")

    # No match
    if not bb_has_match and doj_confidence == "none":
        return ("no_match", 0.0,
                "No evidence in Black Book or DOJ records")

    # Catch-all for ambiguous combinations
    return ("needs_review", 0.35,
            "Ambiguous evidence combination — needs human review")


def detect_false_positive_indicators(name: str, bb_matches, doj_result) -> list:
    """Detect indicators that a match might be a false positive.

    Returns a list of human-readable indicator strings.
    """
    indicators = []
    if not name:
        return indicators

    parts = name.strip().split()
    last_name = parts[-1].lower() if parts else ""
    name_words = {w.lower() for w in parts}

    # Non-person entity check (hotel, palace, resort, etc.)
    entity_words = name_words & NON_PERSON_INDICATORS
    if entity_words:
        indicators.append(f"Name contains non-person entity words: {', '.join(entity_words)} — likely a business/hotel/landmark, not a person")

    # Common last name
    if last_name in COMMON_LAST_NAMES:
        indicators.append(f"Very common last name: '{last_name}'")

    # Last-name-only match on a common name
    if bb_matches:
        for m in bb_matches:
            if m.get("match_type") == "last_name_only" and last_name in COMMON_LAST_NAMES:
                indicators.append("Last_name_only match on common name — high false positive risk")
                break

    # Short last name (more collision-prone)
    if len(last_name) < 5 and bb_matches:
        for m in bb_matches:
            if m.get("match_type") == "last_name_only":
                indicators.append(f"Short last name '{last_name}' in last_name_only match")
                break

    # DOJ results with low relevance
    if doj_result and doj_result.get("search_successful"):
        confidence = doj_result.get("confidence", "none")
        total = doj_result.get("total_results", 0)
        if total > 50:
            indicators.append(f"DOJ returned {total} results — likely matching common terms")
        if confidence == "low" and total > 0:
            indicators.append("DOJ results present but no high-signal keyword context")

        # Check DOJ result snippets for unrelated-role context
        snippets = doj_result.get("snippets", [])
        snippet_text = " ".join(s.lower() for s in snippets if isinstance(s, str))
        role_matches = DOJ_UNRELATED_ROLES & set(snippet_text.split())
        if role_matches and confidence in ("low", "medium"):
            indicators.append(f"DOJ results reference roles ({', '.join(role_matches)}) — name may be staff/contractor, not a principal")

    return indicators


# ── Binary Verdict Mapping (used by Editor) ────────────────────


def verdict_to_binary(combined_verdict, confidence_score, glance_override=None):
    """Map the 5-tier verdict to binary YES/NO for the features table.

    Args:
        combined_verdict: One of confirmed_match, likely_match, possible_match, needs_review, no_match
        confidence_score: Float 0-1
        glance_override: Optional "YES"/"NO" from contextual_glance (takes precedence)

    Returns:
        "YES" or "NO"
    """
    if glance_override in ("YES", "NO"):
        return glance_override

    if combined_verdict in ("confirmed_match", "likely_match"):
        return "YES"
    if combined_verdict == "possible_match" and confidence_score >= 0.40:
        return "YES"
    if combined_verdict == "needs_review":
        return "YES"  # Err toward investigation
    return "NO"


def contextual_glance(name, bb_matches, doj_result):
    """LLM glance for ambiguous cases — returns YES/NO or None (skip LLM).

    Clear NO (0 BB + DOJ none): return None → caller uses heuristic (NO)
    Clear YES (BB last_first + DOJ high): return None → caller uses heuristic (YES)
    Ambiguous: call Haiku with DOJ snippets for ~$0.001

    Returns:
        "YES", "NO", or None (caller should fall back to heuristic)
    """
    bb_has_match = bool(bb_matches)
    bb_best = ""
    if bb_matches:
        rank = {"last_first": 4, "full_name": 3, "last_name_only": 2}
        bb_best = max(
            (m.get("match_type", "") for m in bb_matches),
            key=lambda mt: rank.get(mt, 0),
            default=""
        )

    doj_confidence = "none"
    if doj_result and doj_result.get("search_successful"):
        doj_confidence = doj_result.get("confidence", "none")

    # Clear NO: no BB match AND no DOJ results
    if not bb_has_match and doj_confidence == "none":
        return None

    # Clear YES: BB last_first AND DOJ high
    if bb_best == "last_first" and doj_confidence == "high":
        return None

    # Ambiguous — call Haiku for a glance
    try:
        import anthropic
        client = anthropic.Anthropic()

        # Build snippet context from DOJ results
        snippets = []
        if doj_result:
            raw_snippets = doj_result.get("snippets", [])
            for s in raw_snippets[:5]:
                if isinstance(s, str):
                    snippets.append(s[:200])

        snippet_text = "\n".join(snippets) if snippets else "(no DOJ snippets available)"
        bb_context = ""
        if bb_matches:
            bb_context = f"Black Book match type: {bb_best}"
            for m in bb_matches[:2]:
                if m.get("context"):
                    bb_context += f"\nBB context: {m['context'][:150]}"

        prompt = f"""Is the person "{name}" from Architectural Digest magazine the same person referenced in these Epstein-related records?

{bb_context}

DOJ search snippets:
{snippet_text}

Answer YES if this is likely the same person, NO if this is clearly a different person or coincidence.
Respond with only YES or NO."""

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=10,
            messages=[{"role": "user", "content": prompt}],
        )

        answer = response.content[0].text.strip().upper()
        if answer.startswith("YES"):
            return "YES"
        if answer.startswith("NO"):
            return "NO"
        return None  # Unparseable — fall back to heuristic

    except Exception:
        return None  # On error, fall back to heuristic


if __name__ == "__main__":
    if "--status" in sys.argv:
        show_status()
    elif "--name" in sys.argv:
        idx = sys.argv.index("--name")
        name = sys.argv[idx + 1]
        search_single_name(name)
    else:
        cross_reference_all()
