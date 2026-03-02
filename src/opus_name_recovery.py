#!/usr/bin/env python3
"""Resolve NULL homeowner names via Vision re-read of article page images.

Sends page images to Claude Vision with a focused name-finding prompt.
Two outcomes per feature:
  - Name found → written to JSONL for manual review
  - No name found → marked anonymous, auto-applied with --apply

Usage (NULL name resolution):
    python3 src/opus_name_recovery.py --dry-run          # Candidate count + cost estimate
    python3 src/opus_name_recovery.py --limit 10         # Test on 10 features
    python3 src/opus_name_recovery.py                    # Process all NULL features
    python3 src/opus_name_recovery.py --stats            # Summarise latest results
    python3 src/opus_name_recovery.py --apply            # Apply anonymous to DB
    python3 src/opus_name_recovery.py --apply --names    # Also apply found names (after review)
    python3 src/opus_name_recovery.py --model claude-opus-4-6  # Use Opus instead of Sonnet

Usage (xref-anonymous verification — 66 features with junk cross-references):
    python3 src/opus_name_recovery.py --verify-xref-anonymous --dry-run
    python3 src/opus_name_recovery.py --verify-xref-anonymous
    python3 src/opus_name_recovery.py --verify-xref-anonymous --stats
    python3 src/opus_name_recovery.py --verify-xref-anonymous --apply --names
"""

import argparse
import base64
import glob
import json
import os
import random
import re
import sys
import time
from datetime import datetime, timezone

import requests
from anthropic import Anthropic
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

# ═══════════════════════════════════════════════════════════
# Config
# ═══════════════════════════════════════════════════════════

DEFAULT_MODEL = "claude-opus-4-6"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "null_name_resolution")
VERIFY_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "anon_verification")
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
AD_ARCHIVE_BLOB = "https://architecturaldigest.blob.core.windows.net/architecturaldigest{date}thumbnails/Pages/0x600/{page}.jpg"
MAX_IMAGES = 20

MODEL_PRICING = {
    "claude-opus-4-6": {"input": 15.0, "output": 75.0},
    "claude-sonnet-4-6": {"input": 3.0, "output": 15.0},
    "claude-sonnet-4-5-20250929": {"input": 3.0, "output": 15.0},
    "claude-haiku-4-5-20251001": {"input": 1.0, "output": 5.0},
}

PROMPT = """You are reading pages from an Architectural Digest article about a featured home.

TASK 1: Identify the HOMEOWNER — the person or people who LIVE in this home.

CRITICAL DISTINCTION:
- The HOMEOWNER is who LIVES in the house. They are the client. The article is about THEIR home.
- The DESIGNER/ARCHITECT is who DESIGNED or DECORATED the house. They are hired professionals.
- These are usually DIFFERENT people. Do NOT return the designer's name as the homeowner.
- ONLY return the designer as the homeowner if the article EXPLICITLY states it is the designer's OWN home
  (e.g., "architect John Smith's personal residence" or "at home with designer Jane Doe").

Where to look:
- Headlines: "At Home with [Name]" or "The [Name] Residence"
- Subheadlines: "Designer X creates a haven for [homeowner name]"
- Opening paragraphs: usually name the homeowner in the first few sentences
- Photo captions: "the home of [Name]" or "[Name]'s living room"
- Pull quotes: attributed to the homeowner discussing their home
- Credit blocks: sometimes list "Home of [Name]"

Common patterns in anonymous articles:
- "a tech executive" / "a young family" / "a philanthropic couple" = genuinely anonymous, return null
- "the clients" with no name ever given = genuinely anonymous, return null
- The designer is named but the homeowner is only described generically = genuinely anonymous

TASK 2: Classify the homeowner's subject_category based on what the article says about them.
Even if the homeowner is anonymous, classify them by what the article reveals about their profession/identity.

Categories (pick exactly one):
- "Business" — CEO, entrepreneur, financier, real estate developer, investor, banker, executive
- "Celebrity" — actor, musician, TV personality, sports figure, famous entertainer
- "Design" — architect, interior designer, fashion designer (ONLY if it's their own home)
- "Art" — artist, photographer, filmmaker, sculptor, gallery owner
- "Media" — writer, journalist, editor, publisher
- "Socialite" — philanthropist, society figure, prominent hostess
- "Royalty" — titled nobility, royal family members
- "Politician" — elected official, diplomat, government figure
- "Private" — no profession mentioned, described only as a couple/family with no professional context
- "Other" — doesn't fit any category above

Respond with ONLY valid JSON:
{
  "homeowner_name": "Full Name" or null,
  "designer_name": "Designer/Architect Name if mentioned" or null,
  "is_designers_own_home": true or false,
  "subject_category": "Business" or "Celebrity" or "Design" or "Art" or "Media" or "Socialite" or "Royalty" or "Politician" or "Private" or "Other",
  "confidence": "high" or "medium" or "low",
  "evidence": "Quote or describe exactly where you found the homeowner name",
  "why_anonymous": "If null, explain why — e.g., 'Article only refers to owners as a young couple'"
}"""

VALID_CATEGORIES = {
    "Business", "Celebrity", "Design", "Art", "Media",
    "Socialite", "Royalty", "Politician", "Private", "Other",
}


# ═══════════════════════════════════════════════════════════
# Supabase queries
# ═══════════════════════════════════════════════════════════

def fetch_null_candidates():
    """Get features with NULL/empty/string-'null' homeowner_name (NOT Anonymous)."""
    all_feats = []

    # NULL values
    offset = 0
    while True:
        batch = sb.from_("features").select(
            "id, homeowner_name, article_title, designer_name, issue_id, page_number"
        ).is_("homeowner_name", "null").range(offset, offset + 999).execute()
        all_feats.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Empty string values
    offset = 0
    while True:
        batch = sb.from_("features").select(
            "id, homeowner_name, article_title, designer_name, issue_id, page_number"
        ).eq("homeowner_name", "").range(offset, offset + 999).execute()
        all_feats.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Literal string "null" / "None"
    offset = 0
    while True:
        batch = sb.from_("features").select(
            "id, homeowner_name, article_title, designer_name, issue_id, page_number"
        ).eq("homeowner_name", "null").range(offset, offset + 999).execute()
        all_feats.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    offset = 0
    while True:
        batch = sb.from_("features").select(
            "id, homeowner_name, article_title, designer_name, issue_id, page_number"
        ).eq("homeowner_name", "None").range(offset, offset + 999).execute()
        all_feats.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Deduplicate by feature ID
    seen = set()
    deduped = []
    for f in all_feats:
        if f["id"] not in seen:
            seen.add(f["id"])
            deduped.append(f)

    # Get issue metadata for context + Azure fallback
    issue_ids = list(set(f["issue_id"] for f in deduped))
    issues = {}
    for chunk_start in range(0, len(issue_ids), 50):
        chunk = issue_ids[chunk_start:chunk_start + 50]
        for iid in chunk:
            result = sb.from_("issues").select("id, year, month, source_url").eq("id", iid).execute()
            if result.data:
                issues[iid] = result.data[0]

    for f in deduped:
        iss = issues.get(f["issue_id"], {})
        f["_year"] = iss.get("year")
        f["_month"] = iss.get("month")
        f["_source_url"] = iss.get("source_url")

    return deduped


def fetch_xref_anonymous_candidates():
    """Get Anonymous features that have cross-reference records (need verification).

    These 66 features were never run through the original name recovery pipeline.
    They have xrefs because the pipeline searched "Anonymous" as a name — junk data.
    Some xrefs contain real-looking names that may or may not be correct.
    """
    # Get all feature_ids from cross_references
    xref_fids = set()
    offset = 0
    while True:
        batch = sb.from_("cross_references").select("feature_id").range(offset, offset + 999).execute()
        for x in batch.data:
            xref_fids.add(x["feature_id"])
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Get Anonymous features
    anon_feats = []
    offset = 0
    while True:
        batch = sb.from_("features").select(
            "id, homeowner_name, article_title, designer_name, issue_id, page_number"
        ).eq("homeowner_name", "Anonymous").range(offset, offset + 999).execute()
        anon_feats.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Intersect: Anonymous features that have xrefs
    candidates = [f for f in anon_feats if f["id"] in xref_fids]

    # Enrich with issue metadata + xref name/verdict
    for f in candidates:
        iss = sb.from_("issues").select("id, year, month, source_url").eq("id", f["issue_id"]).execute()
        if iss.data:
            f["_year"] = iss.data[0].get("year")
            f["_month"] = iss.data[0].get("month")
            f["_source_url"] = iss.data[0].get("source_url")

        xref = sb.from_("cross_references").select(
            "homeowner_name, combined_verdict, binary_verdict"
        ).eq("feature_id", f["id"]).execute()
        if xref.data:
            f["_xref_name"] = xref.data[0].get("homeowner_name", "")
            f["_xref_verdict"] = xref.data[0].get("combined_verdict", "")
            f["_xref_binary"] = xref.data[0].get("binary_verdict", "")

    return candidates


# ═══════════════════════════════════════════════════════════
# Image fetching (with Azure Blob fallback)
# ═══════════════════════════════════════════════════════════

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


def fetch_article_page_range(source_url, article_title=None, page_number=None):
    """Find article's page range using title or page number matching."""
    featured = _decode_jwt_featured(source_url)
    if not featured:
        return None

    # Strategy 1: Match by article title
    if article_title and len(article_title) >= 4:
        title_upper = article_title.upper().strip()
        for art in featured:
            jwt_title = (art.get("Title") or "").upper().strip()
            if title_upper in jwt_title or jwt_title in title_upper:
                return _extract_pages(art)
            title_words = [w for w in re.split(r'\W+', title_upper) if len(w) >= 4]
            if title_words and all(w in jwt_title for w in title_words):
                return _extract_pages(art)

    # Strategy 2: Match by page number
    if page_number:
        for art in featured:
            pages = _extract_pages(art)
            if pages and page_number in pages:
                return pages
            if pages and min(pages) <= page_number <= max(pages):
                return pages

    return None


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


def get_images_for_feature(feat):
    """Get page images for a feature — Supabase first, Azure Blob fallback.

    Returns (list_of_image_bytes, source_str).
    """
    fid = feat["id"]

    # Try feature_images table first
    stored = sb.from_("feature_images").select(
        "page_number, public_url"
    ).eq("feature_id", fid).order("page_number").execute()

    if stored.data:
        images = []
        for row in stored.data[:MAX_IMAGES]:
            try:
                resp = requests.get(row["public_url"], timeout=15)
                if resp.status_code == 200 and len(resp.content) > 1000:
                    images.append(resp.content)
            except requests.RequestException:
                pass
        if images:
            return images, "supabase"

    # Fallback: Azure Blob via JWT TOC
    source_url = feat.get("_source_url")
    year = feat.get("_year")
    month = feat.get("_month")
    if not source_url or not year or not month:
        return [], "none"
    if "architecturaldigest.com" not in source_url:
        return [], "none"

    try:
        pages = fetch_article_page_range(
            source_url,
            article_title=feat.get("article_title"),
            page_number=feat.get("page_number"),
        )
    except Exception:
        return [], "none"

    if not pages:
        return [], "none"

    fetched = download_page_images(pages, year, month)
    return [img_bytes for _, img_bytes in fetched], "azure"


# ═══════════════════════════════════════════════════════════
# JSONL output
# ═══════════════════════════════════════════════════════════

def get_output_path(output_dir=None, prefix="resolved"):
    """Return path to JSONL output file (resume-aware)."""
    d = output_dir or OUTPUT_DIR
    os.makedirs(d, exist_ok=True)
    existing = sorted(glob.glob(os.path.join(d, f"{prefix}_*.jsonl")))
    if existing:
        return existing[-1]
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return os.path.join(d, f"{prefix}_{ts}.jsonl")


def load_processed_ids(jsonl_path):
    """Load feature IDs already processed from JSONL."""
    ids = set()
    if not os.path.exists(jsonl_path):
        return ids
    with open(jsonl_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
                ids.add(row["feature_id"])
            except (json.JSONDecodeError, KeyError):
                pass
    return ids


def append_result(jsonl_path, result):
    """Append one result to the JSONL file."""
    with open(jsonl_path, "a") as f:
        f.write(json.dumps(result) + "\n")


def load_all_results(jsonl_path):
    """Load all results from JSONL."""
    results = []
    if not os.path.exists(jsonl_path):
        return results
    with open(jsonl_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                results.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return results


# ═══════════════════════════════════════════════════════════
# Processing
# ═══════════════════════════════════════════════════════════

def process_feature(feat, model):
    """Send images to Vision, parse response. Returns result dict."""
    images, source = get_images_for_feature(feat)
    if not images:
        return {
            "feature_id": feat["id"],
            "result": "skipped",
            "reason": "no_images",
            "image_source": "none",
        }

    content = []
    for img_bytes in images:
        b64 = base64.b64encode(img_bytes).decode()
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": b64},
        })
    content.append({"type": "text", "text": PROMPT})

    msg = client.messages.create(
        model=model,
        max_tokens=400,
        messages=[{"role": "user", "content": content}],
    )

    text = msg.content[0].text.strip()
    json_match = re.search(r"\{[\s\S]*\}", text)
    if not json_match:
        return {
            "feature_id": feat["id"],
            "result": "error",
            "reason": "no_json_in_response",
            "raw": text[:500],
            "input_tokens": msg.usage.input_tokens,
            "output_tokens": msg.usage.output_tokens,
        }

    parsed = json.loads(json_match.group())
    name = parsed.get("homeowner_name")
    category = parsed.get("subject_category", "Other")
    if category not in VALID_CATEGORIES:
        category = "Other"

    # Determine result type
    is_name = name and name.lower() not in ("null", "none", "anonymous", "unknown", "")
    result_type = "name_found" if is_name else "anonymous"

    return {
        "feature_id": feat["id"],
        "result": result_type,
        "homeowner_name": name if is_name else None,
        "designer_name": parsed.get("designer_name"),
        "is_designers_own_home": parsed.get("is_designers_own_home", False),
        "subject_category": category,
        "confidence": parsed.get("confidence", "unknown"),
        "evidence": parsed.get("evidence", ""),
        "why_anonymous": parsed.get("why_anonymous", ""),
        "article_title": feat.get("article_title"),
        "year": feat.get("_year"),
        "month": feat.get("_month"),
        "image_count": len(images),
        "image_source": source,
        "input_tokens": msg.usage.input_tokens,
        "output_tokens": msg.usage.output_tokens,
    }


# ═══════════════════════════════════════════════════════════
# Commands
# ═══════════════════════════════════════════════════════════

def cmd_dry_run(candidates, model, verify_mode=False):
    """Preview candidate count and estimated cost."""
    print(f"\nCandidates: {len(candidates)}")
    print(f"Model: {model}")
    if verify_mode:
        print(f"Mode: VERIFY xref-anonymous")

    # Sample image counts from first 50
    total_images = 0
    sampled = 0
    for f in candidates[:50]:
        imgs = sb.from_("feature_images").select(
            "id", count="exact", head=True
        ).eq("feature_id", f["id"]).execute()
        total_images += imgs.count or 0
        sampled += 1

    avg_imgs = total_images / max(sampled, 1)
    pricing = MODEL_PRICING.get(model, MODEL_PRICING[DEFAULT_MODEL])
    est_input = len(candidates) * avg_imgs * 1500
    est_output = len(candidates) * 300
    est_cost = (est_input * pricing["input"] + est_output * pricing["output"]) / 1_000_000

    print(f"Avg images per feature: {avg_imgs:.1f}")
    print(f"Estimated cost: ${est_cost:.2f}")
    print(f"Estimated time: ~{len(candidates) * 2 / 60:.0f} minutes")

    if verify_mode:
        # Show xref names for review
        with_names = [f for f in candidates if f.get("_xref_name") and f["_xref_name"] != "Anonymous"]
        print(f"\nXrefs with real-looking names: {len(with_names)}")
        for f in sorted(with_names, key=lambda x: x.get("_xref_name", "")):
            fid = f["id"]
            xn = f.get("_xref_name", "?")
            xv = f.get("_xref_verdict", "?")
            title = (f.get("article_title") or "")[:40]
            yr = f.get("_year", "?")
            print(f"  #{fid:5d} ({yr}) xref: {xn:35s} [{xv}]  {title}")


def cmd_stats(verify_mode=False):
    """Print summary of latest results."""
    d = VERIFY_OUTPUT_DIR if verify_mode else OUTPUT_DIR
    prefix = "verify" if verify_mode else "resolved"
    os.makedirs(d, exist_ok=True)
    existing = sorted(glob.glob(os.path.join(d, f"{prefix}_*.jsonl")))
    if not existing:
        print("No results found.")
        return

    path = existing[-1]
    results = load_all_results(path)
    print(f"\nResults file: {path}")
    print(f"Total entries: {len(results)}")

    # Count by result type
    by_type = {}
    for r in results:
        t = r.get("result", "unknown")
        by_type[t] = by_type.get(t, 0) + 1

    print(f"\nBy result type:")
    for t, n in sorted(by_type.items(), key=lambda x: -x[1]):
        print(f"  {t:15s}: {n:4d}")

    # Confidence breakdown for name_found
    found = [r for r in results if r["result"] == "name_found"]
    if found:
        by_conf = {}
        for r in found:
            c = r.get("confidence", "unknown")
            by_conf[c] = by_conf.get(c, 0) + 1
        print(f"\nFound names by confidence:")
        for c, n in sorted(by_conf.items()):
            print(f"  {c:10s}: {n:4d}")

    # Category breakdown
    categorised = [r for r in results if r.get("subject_category")]
    if categorised:
        by_cat = {}
        for r in categorised:
            cat = r.get("subject_category", "?")
            by_cat[cat] = by_cat.get(cat, 0) + 1
        print(f"\nBy category:")
        for c, n in sorted(by_cat.items(), key=lambda x: -x[1]):
            print(f"  {c:15s}: {n:4d}")

    # Image source breakdown
    by_src = {}
    for r in results:
        s = r.get("image_source", "?")
        by_src[s] = by_src.get(s, 0) + 1
    print(f"\nImage source:")
    for s, n in sorted(by_src.items(), key=lambda x: -x[1]):
        print(f"  {s:15s}: {n:4d}")

    # Cost
    total_in = sum(r.get("input_tokens", 0) for r in results)
    total_out = sum(r.get("output_tokens", 0) for r in results)
    # Assume Sonnet pricing for cost estimate
    cost = (total_in * 3.0 + total_out * 15.0) / 1_000_000
    print(f"\nTokens: {total_in:,} in / {total_out:,} out")
    print(f"Estimated cost (Sonnet): ${cost:.2f}")

    # List found names
    if found:
        print(f"\n{'=' * 60}")
        print(f"FOUND NAMES ({len(found)}) — review before --apply --names")
        print(f"{'=' * 60}")
        for r in sorted(found, key=lambda x: x.get("confidence", "z")):
            name = r.get("homeowner_name", "?")
            conf = r.get("confidence", "?")
            cat = r.get("subject_category", "?")
            ev = (r.get("evidence") or "")[:80]
            fid = r.get("feature_id")
            print(f"  #{fid:5d} [{conf:6s}] {name:40s} [{cat}]")
            if verify_mode:
                xn = r.get("xref_name", "?")
                xv = r.get("xref_verdict", "?")
                match = "MATCH" if xn and name and xn.lower() == name.lower() else "DIFFERS"
                print(f"         xref: {xn} [{xv}] — {match}")
            if ev:
                print(f"         {ev}")


def cmd_apply(apply_names=False, verify_mode=False):
    """Apply results to Supabase."""
    d = VERIFY_OUTPUT_DIR if verify_mode else OUTPUT_DIR
    prefix = "verify" if verify_mode else "resolved"
    os.makedirs(d, exist_ok=True)
    existing = sorted(glob.glob(os.path.join(d, f"{prefix}_*.jsonl")))
    if not existing:
        print("No results found.")
        return

    path = existing[-1]
    results = load_all_results(path)

    anon_count = 0
    name_count = 0
    cat_count = 0
    skip_count = 0
    xref_deleted = 0

    for r in results:
        fid = r.get("feature_id")
        result_type = r.get("result")

        if result_type == "anonymous":
            # Feature stays Anonymous — update category if found
            updates = {}
            cat = r.get("subject_category")
            if cat and cat in VALID_CATEGORIES:
                updates["subject_category"] = cat
                cat_count += 1
            if updates:
                sb.from_("features").update(updates).eq("id", fid).execute()
            anon_count += 1

            # In verify mode, delete the junk xref (searched "Anonymous" as a name)
            if verify_mode:
                sb.from_("cross_references").delete().eq("feature_id", fid).execute()
                xref_deleted += 1

        elif result_type == "name_found":
            if apply_names:
                updates = {"homeowner_name": r["homeowner_name"]}
                cat = r.get("subject_category")
                if cat and cat in VALID_CATEGORIES:
                    updates["subject_category"] = cat
                    cat_count += 1
                sb.from_("features").update(updates).eq("id", fid).execute()
                name_count += 1

                # In verify mode: if Opus found a DIFFERENT name than the xref,
                # the xref is stale — delete it so it gets re-crossreferenced
                if verify_mode:
                    xref_name = r.get("xref_name", "")
                    opus_name = r.get("homeowner_name", "")
                    if xref_name and opus_name and xref_name.lower() != opus_name.lower():
                        sb.from_("cross_references").delete().eq("feature_id", fid).execute()
                        xref_deleted += 1
            else:
                skip_count += 1

    print(f"\nApplied to Supabase:")
    print(f"  Confirmed anonymous: {anon_count}")
    if apply_names:
        print(f"  Names written:      {name_count}")
    else:
        print(f"  Names skipped:      {skip_count} (use --apply --names after review)")
    print(f"  Categories set:     {cat_count}")
    if verify_mode:
        print(f"  Junk xrefs deleted: {xref_deleted}")


def cmd_run(candidates, model, limit=None, verify_mode=False):
    """Main processing loop with JSONL output and resume support."""
    if verify_mode:
        jsonl_path = get_output_path(output_dir=VERIFY_OUTPUT_DIR, prefix="verify")
    else:
        jsonl_path = get_output_path()
    already_done = load_processed_ids(jsonl_path)

    # Filter out already-processed
    remaining = [f for f in candidates if f["id"] not in already_done]
    if limit:
        rng = random.Random(42)
        remaining = rng.sample(remaining, min(limit, len(remaining)))

    pricing = MODEL_PRICING.get(model, MODEL_PRICING[DEFAULT_MODEL])

    print(f"\nOutput: {jsonl_path}")
    print(f"Model: {model}")
    print(f"Already processed: {len(already_done)}")
    print(f"Remaining: {len(remaining)}")
    if not remaining:
        print("Nothing to do.")
        return

    found = 0
    anon = 0
    skipped = 0
    errors = 0
    total_in = 0
    total_out = 0

    for i, feat in enumerate(remaining):
        fid = feat["id"]
        year = feat.get("_year", "?")
        month = feat.get("_month", "?")
        title = (feat.get("article_title") or "")[:50]

        try:
            result = process_feature(feat, model)

            # In verify mode, attach xref metadata for review comparison
            if verify_mode:
                result["xref_name"] = feat.get("_xref_name", "")
                result["xref_verdict"] = feat.get("_xref_verdict", "")
                result["xref_binary"] = feat.get("_xref_binary", "")

            append_result(jsonl_path, result)

            total_in += result.get("input_tokens", 0)
            total_out += result.get("output_tokens", 0)

            rt = result["result"]
            xref_info = ""
            if verify_mode:
                xn = feat.get("_xref_name", "")
                if xn and xn != "Anonymous":
                    xref_info = f"  (xref: {xn})"

            if rt == "name_found":
                found += 1
                name = result.get("homeowner_name", "?")
                conf = result.get("confidence", "?")
                own = " [OWN HOME]" if result.get("is_designers_own_home") else ""
                print(f"  [{i+1:4d}/{len(remaining)}] #{fid} ({year}) → {name} [{conf}]{own}{xref_info}")
                print(f"    Evidence: {(result.get('evidence') or '')[:120]}")
            elif rt == "anonymous":
                anon += 1
                cat = result.get("subject_category", "?")
                why = (result.get("why_anonymous") or "?")[:100]
                print(f"  [{i+1:4d}/{len(remaining)}] #{fid} ({year}) ANON [{cat}]: {why}{xref_info}")
            elif rt == "skipped":
                skipped += 1
                print(f"  [{i+1:4d}/{len(remaining)}] #{fid} ({year}) SKIP: no images")
            else:
                errors += 1
                print(f"  [{i+1:4d}/{len(remaining)}] #{fid} ({year}) ERROR: {result.get('reason', '?')}")

        except Exception as e:
            errors += 1
            # Write error to JSONL so we don't re-attempt
            append_result(jsonl_path, {
                "feature_id": fid,
                "result": "error",
                "reason": str(e)[:500],
            })
            if errors <= 10:
                print(f"  [{i+1:4d}/{len(remaining)}] #{fid} ERROR: {e}")
            if errors > 20:
                print(f"\n  Too many errors ({errors}), stopping.")
                break

        # Progress summary every 25
        if (i + 1) % 25 == 0:
            cost = (total_in * pricing["input"] + total_out * pricing["output"]) / 1_000_000
            print(f"  --- {i+1}/{len(remaining)}: {found} found, {anon} anon, {skipped} skip, {errors} err, ${cost:.2f} ---")

        time.sleep(1.5)

    cost = (total_in * pricing["input"] + total_out * pricing["output"]) / 1_000_000
    print(f"\n{'=' * 60}")
    print(f"DONE: {len(remaining)} features processed")
    print(f"  Names found:   {found}")
    print(f"  Anonymous:     {anon}")
    print(f"  Skipped:       {skipped}")
    print(f"  Errors:        {errors}")
    print(f"  Cost:          ${cost:.2f} ({total_in:,} in / {total_out:,} out)")
    print(f"  Output:        {jsonl_path}")
    flag = " --verify-xref-anonymous" if verify_mode else ""
    print(f"\nNext steps:")
    print(f"  python3 src/opus_name_recovery.py{flag} --stats           # Review results")
    print(f"  python3 src/opus_name_recovery.py{flag} --apply           # Apply anonymous + delete junk xrefs")
    print(f"  python3 src/opus_name_recovery.py{flag} --apply --names   # Also write found names")


# ═══════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Resolve NULL homeowner names via Vision")
    parser.add_argument("--dry-run", action="store_true", help="Preview candidates + cost estimate")
    parser.add_argument("--limit", type=int, help="Process N random features only")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Model to use (default: {DEFAULT_MODEL})")
    parser.add_argument("--stats", action="store_true", help="Print summary of latest results")
    parser.add_argument("--apply", action="store_true", help="Apply results to Supabase")
    parser.add_argument("--names", action="store_true", help="With --apply, also write found names")
    parser.add_argument("--verify-xref-anonymous", action="store_true",
                        help="Verify 66 Anonymous features that have cross-references")
    args = parser.parse_args()

    verify = args.verify_xref_anonymous

    print("=" * 60)
    if verify:
        print("ANONYMOUS XREF VERIFICATION — Vision re-read pipeline")
    else:
        print("NULL NAME RESOLUTION — Vision re-read pipeline")
    print("=" * 60)

    if args.stats:
        cmd_stats(verify_mode=verify)
        return

    if args.apply:
        cmd_apply(apply_names=args.names, verify_mode=verify)
        return

    if verify:
        candidates = fetch_xref_anonymous_candidates()
        print(f"Anonymous features with xrefs: {len(candidates)}")
    else:
        candidates = fetch_null_candidates()
        print(f"Total NULL candidates: {len(candidates)}")

    if args.dry_run:
        cmd_dry_run(candidates, args.model, verify_mode=verify)
        return

    cmd_run(candidates, args.model, limit=args.limit, verify_mode=verify)


if __name__ == "__main__":
    main()
