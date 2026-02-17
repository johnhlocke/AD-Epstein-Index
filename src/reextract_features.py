#!/usr/bin/env python3
"""Re-extract missing features from AD Archive's full article catalog.

The original extraction only read the JWT 'featured' array (~7 curated articles
per issue). The actual archive pages contain metadata for ALL articles (20-30
per issue) in the spread data.

Pipeline:
  1. Parse full spread data from each issue's archive page
  2. Filter by section (skip ads, travel, antiques, etc.)
  3. Classify ambiguous articles with Haiku (home tour vs. not)
  4. Insert new feature stubs into Supabase
  5. Download page images + upload to Supabase Storage
  6. Then run score_features.py to score + extract with Opus Vision

Usage:
    python3 src/reextract_features.py --scan              # Preview: count articles per issue
    python3 src/reextract_features.py --extract            # Full pipeline
    python3 src/reextract_features.py --extract --limit 5  # Test on 5 issues
    python3 src/reextract_features.py --images             # Download images for new stubs
    python3 src/reextract_features.py --images --limit 50  # Images for 50 features
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
BUCKET = "dossier-images"

# Sections that are NEVER home tours
SKIP_SECTIONS = {
    "ad travels", "architecture", "art", "antiques", "antiques notebook",
    "ad-at-large", "ad at large", "letters", "contributors",
    "ad shopping", "historic architecture", "ad electronica",
    "ad estates", "to the trade", "ad directory", "for collectors",
    "ad autos", "table of contents", "cover page", "ad notebook",
    "shopping", "resources", "classified", "promotion",
    "discoveries", "ad 100", "the ad 100", "ad100",
}

# Genres that are never home tours
SKIP_GENRES = {"advertisement", "cover", "tableOfContents", ""}

# Model for classification
CLASSIFY_MODEL = "claude-haiku-4-5-20251001"


def get_supabase():
    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
    return create_client(url, key)


# ═══════════════════════════════════════════════════════════
# Archive page parsing
# ═══════════════════════════════════════════════════════════

def parse_spread_articles(html):
    """Parse ALL articles from the archive page's spread data.

    The archive page embeds a JSON structure with spreads, each containing
    an Articles array. We collect all unique articles with their full page
    ranges by aggregating across spreads.

    Returns list of dicts: {title, genre, section, pages, key}
    """
    article_pages = {}   # key -> set of page strings
    article_info = {}    # key -> {Title, Genre, Section}

    # Match spreads: "Index":N,"PageRange":"X,Y",...,"Articles":[{...}]
    spread_pattern = re.compile(
        r'"Index":(\d+),"PageRange":"([^"]+)".*?"Articles":\[(\{[^\]]+?\})\]',
        re.DOTALL,
    )

    for m in spread_pattern.finditer(html):
        page_range = m.group(2)
        pages = [p.strip() for p in page_range.split(",")]

        try:
            art = json.loads(m.group(3))
        except json.JSONDecodeError:
            continue

        key = art.get("Key")
        if not key:
            continue

        if key not in article_pages:
            article_pages[key] = set()
            article_info[key] = {
                "Title": (art.get("Title") or "").strip(),
                "Genre": (art.get("Genre") or "").strip(),
                "Section": (art.get("Section") or "").strip(),
            }

        for p in pages:
            article_pages[key].add(p)

    # Build result list
    articles = []
    for key, info in article_info.items():
        title = info["Title"]
        if not title:
            continue

        # Sort pages numerically (some pages are roman numerals for front matter)
        raw_pages = article_pages.get(key, set())
        numeric_pages = []
        for p in raw_pages:
            try:
                numeric_pages.append(int(p))
            except ValueError:
                pass  # Skip roman numeral / letter pages (IFC, ii, etc.)

        numeric_pages.sort()

        articles.append({
            "title": title,
            "genre": info["Genre"].lower(),
            "section": info["Section"],
            "section_lower": info["Section"].lower().strip(),
            "pages": numeric_pages,
            "page_range": ",".join(str(p) for p in numeric_pages),
            "start_page": numeric_pages[0] if numeric_pages else None,
            "key": key,
        })

    return articles


def filter_by_section(articles):
    """First-pass filter: remove articles in known non-home sections.

    Returns (candidates, rejected) — candidates need Haiku classification.
    """
    candidates = []
    rejected = []

    for art in articles:
        # Skip non-article genres
        if art["genre"] in SKIP_GENRES:
            rejected.append(art)
            continue

        # Skip known non-home sections
        if art["section_lower"] in SKIP_SECTIONS:
            rejected.append(art)
            continue

        # Skip very short articles (1-2 pages are usually columns/notes)
        if len(art["pages"]) < 3:
            rejected.append(art)
            continue

        candidates.append(art)

    return candidates, rejected


def classify_with_haiku(candidates, year, month):
    """Use Haiku to classify ambiguous articles as home tours or not.

    Sends all candidate titles in one batch call. Returns list of
    articles classified as home tours.
    """
    if not candidates:
        return []

    client = anthropic.Anthropic()

    article_lines = []
    for i, art in enumerate(candidates):
        line = f"{i+1}. \"{art['title']}\""
        if art["section"]:
            line += f" (Section: {art['section']})"
        line += f" ({len(art['pages'])} pages)"
        article_lines.append(line)

    prompt = f"""You are classifying articles from Architectural Digest {year}-{month:02d}.

For each article below, respond with ONLY "home" or "other":
- "home" = A residential home tour or house feature (someone's personal residence — house, apartment, estate, villa, penthouse, loft)
- "other" = NOT a home tour (architect profiles, designer profiles, historical essays, museum features, hotel features, restaurant features, private club features, garden-only features, art collection profiles, travel destinations, column pieces)

CRITICAL RULES:
- A home tour shows a specific person's residence. The title usually references a place or person.
- Architect profiles (e.g., "Antoine Predock") are "other" — they profile the architect, not a home.
- Historical essays (e.g., "Edith Wharton's French Landscapes") are "other" — they discuss history, not tour a living person's home.
- Private clubs, hotels, museums, restaurants are "other" — not residential.
- If unsure, classify as "home" (we can always filter later).

Articles:
{chr(10).join(article_lines)}

Respond with ONLY a JSON array of classifications, one per article:
[{{"index": 1, "classification": "home"}}, {{"index": 2, "classification": "other"}}, ...]"""

    try:
        message = client.messages.create(
            model=CLASSIFY_MODEL,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        result_text = message.content[0].text
        inp = message.usage.input_tokens
        out = message.usage.output_tokens
        cost = (inp / 1_000_000) * 1.0 + (out / 1_000_000) * 5.0  # Haiku pricing

        # Parse response
        json_match = re.search(r"\[[\s\S]*\]", result_text)
        if not json_match:
            # Fallback: accept all candidates
            print(f"    WARNING: Could not parse Haiku response, accepting all {len(candidates)} candidates")
            return candidates, cost

        classifications = json.loads(json_match.group())

        home_articles = []
        for cls in classifications:
            idx = cls.get("index", 0) - 1
            if 0 <= idx < len(candidates) and cls.get("classification") == "home":
                home_articles.append(candidates[idx])

        return home_articles, cost

    except Exception as e:
        print(f"    Haiku classification error: {e}")
        # Fallback: accept all
        return candidates, 0.0


# ═══════════════════════════════════════════════════════════
# Deduplication
# ═══════════════════════════════════════════════════════════

def get_existing_features(sb, issue_id):
    """Get existing features for an issue. Returns set of article_titles and set of page_numbers."""
    result = sb.table("features").select(
        "id, article_title, page_number"
    ).eq("issue_id", issue_id).execute()

    titles = set()
    pages = set()
    for f in (result.data or []):
        if f.get("article_title"):
            titles.add(f["article_title"].strip().upper())
        if f.get("page_number"):
            pages.add(f["page_number"])

    return titles, pages


def find_new_articles(articles, existing_titles, existing_pages):
    """Filter out articles that already exist as features.

    Matches on:
    1. Exact title match (case-insensitive)
    2. Start page match (same article, different title format)
    """
    new = []
    for art in articles:
        title_upper = art["title"].strip().upper()

        # Check title match
        if title_upper in existing_titles:
            continue

        # Check page overlap — if our start page matches an existing feature's page
        if art["start_page"] and art["start_page"] in existing_pages:
            continue

        new.append(art)

    return new


# ═══════════════════════════════════════════════════════════
# Feature insertion
# ═══════════════════════════════════════════════════════════

def insert_stub_feature(sb, issue_id, article):
    """Insert a stub feature row. Returns feature_id or None."""
    row = {
        "issue_id": issue_id,
        "article_title": article["title"],
        "page_number": article["start_page"],
        "notes": json.dumps({
            "source": "reextract_v2",
            "page_range": article["page_range"],
            "section": article["section"],
            "genre": article["genre"],
        }),
    }

    try:
        result = sb.table("features").insert(row).execute()
        if result.data:
            return result.data[0]["id"]
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return None
        print(f"    Insert error: {e}")
    return None


# ═══════════════════════════════════════════════════════════
# Image download
# ═══════════════════════════════════════════════════════════

def download_and_upload_images(sb, feature_id, pages, year, month, max_images=6):
    """Download page images from Azure blob and upload to Supabase Storage.

    Downloads first `max_images` pages (article opening has the most info).
    Returns count of uploaded images.
    """
    date_str = f"{year}{month:02d}01"
    uploaded = 0

    for page_num in pages[:max_images]:
        url = AD_ARCHIVE_BLOB.format(date=date_str, page=page_num)

        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code != 200 or len(resp.content) < 1000:
                continue

            # Upload to Supabase Storage
            storage_path = f"{feature_id}/page_{page_num:03d}.jpg"
            try:
                sb.storage.from_(BUCKET).upload(
                    storage_path,
                    resp.content,
                    {"content-type": "image/jpeg"},
                )
            except Exception as e:
                if "Duplicate" in str(e) or "already exists" in str(e):
                    pass
                else:
                    continue

            # Build public URL
            base_url = os.environ["SUPABASE_URL"]
            public_url = f"{base_url}/storage/v1/object/public/{BUCKET}/{storage_path}"

            # Insert feature_images record
            try:
                sb.table("feature_images").insert({
                    "feature_id": feature_id,
                    "page_number": page_num,
                    "storage_path": storage_path,
                    "public_url": public_url,
                }).execute()
                uploaded += 1
            except Exception as e:
                if "duplicate" in str(e).lower() or "unique" in str(e).lower():
                    uploaded += 1  # Already there
                else:
                    print(f"      DB insert error page {page_num}: {e}")

        except requests.RequestException:
            pass

    return uploaded


# ═══════════════════════════════════════════════════════════
# Main pipeline
# ═══════════════════════════════════════════════════════════

def fetch_all_issues(sb):
    """Fetch all issues with source_url from Supabase."""
    all_issues = []
    offset = 0
    while True:
        batch = sb.table("issues").select(
            "id, year, month, source_url, identifier"
        ).not_.is_("source_url", "null").order("year").range(offset, offset + 999).execute()
        all_issues.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000
    return all_issues


def scan_issue(issue):
    """Scan a single issue and return article counts. No DB writes."""
    url = issue["source_url"]
    year = issue["year"]
    month = issue.get("month") or 1

    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        if resp.status_code != 200:
            return None
    except requests.RequestException:
        return None

    all_articles = parse_spread_articles(resp.text)
    candidates, rejected = filter_by_section(all_articles)

    return {
        "issue_id": issue["id"],
        "year": year,
        "month": month,
        "total_articles": len(all_articles),
        "candidates": len(candidates),
        "rejected": len(rejected),
        "candidate_titles": [a["title"] for a in candidates],
    }


def extract_issue(sb, issue, dry_run=False):
    """Full extraction pipeline for a single issue.

    Returns dict with counts.
    """
    url = issue["source_url"]
    year = issue["year"]
    month = issue.get("month") or 1
    issue_id = issue["id"]

    # Fetch archive page
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        if resp.status_code != 200:
            return {"status": "fetch_error", "new": 0, "cost": 0.0}
    except requests.RequestException as e:
        return {"status": f"fetch_error: {e}", "new": 0, "cost": 0.0}

    # Parse all articles from spread data
    all_articles = parse_spread_articles(resp.text)
    candidates, _ = filter_by_section(all_articles)

    if not candidates:
        return {"status": "no_candidates", "new": 0, "cost": 0.0}

    # Classify with Haiku
    home_articles, cost = classify_with_haiku(candidates, year, month)

    if not home_articles:
        return {"status": "no_homes", "new": 0, "cost": cost}

    # Deduplicate against existing features
    existing_titles, existing_pages = get_existing_features(sb, issue_id)
    new_articles = find_new_articles(home_articles, existing_titles, existing_pages)

    if not new_articles:
        return {"status": "all_exist", "new": 0, "classified": len(home_articles), "cost": cost}

    if dry_run:
        return {
            "status": "dry_run",
            "new": len(new_articles),
            "classified": len(home_articles),
            "cost": cost,
            "new_titles": [a["title"] for a in new_articles],
        }

    # Insert stub features
    inserted = 0
    for art in new_articles:
        fid = insert_stub_feature(sb, issue_id, art)
        if fid:
            inserted += 1
            # Download page images immediately
            pages = [int(p) for p in art["page_range"].split(",") if p.isdigit()]
            if pages:
                img_count = download_and_upload_images(sb, fid, pages, year, month)
                if img_count:
                    print(f"      {art['title'][:40]:40s} → feature {fid} ({img_count} images)")
                else:
                    print(f"      {art['title'][:40]:40s} → feature {fid} (no images)")

    return {
        "status": "ok",
        "new": inserted,
        "classified": len(home_articles),
        "cost": cost,
    }


def download_images_for_stubs(sb, limit=None):
    """Download page images for features that have none (from reextract stubs).

    Reads page_range from notes JSON field.
    """
    # Find features with reextract source but no images
    query = sb.table("features").select(
        "id, issue_id, page_number, notes"
    ).like("notes", "%reextract%")

    all_features = []
    offset = 0
    while True:
        batch = query.range(offset, offset + 999).execute()
        all_features.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Get features that already have images
    existing_images = set()
    offset = 0
    while True:
        batch = sb.table("feature_images").select("feature_id").range(offset, offset + 999).execute()
        for row in batch.data:
            existing_images.add(row["feature_id"])
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Filter to features without images
    need_images = [f for f in all_features if f["id"] not in existing_images]

    if limit:
        need_images = need_images[:limit]

    print(f"Found {len(need_images)} features needing images (of {len(all_features)} reextract features)")

    # Get issue data for year/month
    issue_cache = {}
    uploaded_total = 0

    for i, feat in enumerate(need_images):
        fid = feat["id"]
        issue_id = feat["issue_id"]

        # Get issue year/month
        if issue_id not in issue_cache:
            result = sb.table("issues").select("year, month").eq("id", issue_id).single().execute()
            issue_cache[issue_id] = result.data if result.data else {}

        iss = issue_cache.get(issue_id, {})
        year = iss.get("year")
        month = iss.get("month") or 1

        if not year:
            continue

        # Get page range from notes
        notes = feat.get("notes") or "{}"
        try:
            notes_data = json.loads(notes)
            page_range = notes_data.get("page_range", "")
        except json.JSONDecodeError:
            page_range = ""

        pages = [int(p) for p in page_range.split(",") if p.strip().isdigit()]
        if not pages and feat.get("page_number"):
            # Fallback: use page_number + next 4 pages
            start = feat["page_number"]
            pages = list(range(start, start + 5))

        if not pages:
            continue

        count = download_and_upload_images(sb, fid, pages, year, month)
        uploaded_total += count

        if (i + 1) % 10 == 0:
            print(f"  [{i+1}/{len(need_images)}] {uploaded_total} images uploaded so far")

    print(f"\nDone: {uploaded_total} images uploaded for {len(need_images)} features")


def main():
    parser = argparse.ArgumentParser(description="Re-extract features from AD Archive full catalog")
    parser.add_argument("--scan", action="store_true", help="Preview: count articles per issue")
    parser.add_argument("--extract", action="store_true", help="Full extraction pipeline")
    parser.add_argument("--images", action="store_true", help="Download images for existing stubs")
    parser.add_argument("--limit", type=int, help="Max issues (scan/extract) or features (images)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without DB writes")
    parser.add_argument("--start-year", type=int, default=1988, help="Start from year (default: 1988)")
    args = parser.parse_args()

    if not any([args.scan, args.extract, args.images]):
        parser.print_help()
        sys.exit(1)

    print("=" * 70)
    print("AD ARCHIVE RE-EXTRACTION — Full Spread Data Pipeline")
    print("=" * 70)

    sb = get_supabase()

    if args.images:
        download_images_for_stubs(sb, limit=args.limit)
        return

    # Fetch all issues
    issues = fetch_all_issues(sb)
    issues = [i for i in issues if i["year"] >= args.start_year]
    issues.sort(key=lambda x: (x["year"], x.get("month") or 1))

    if args.limit:
        issues = issues[:args.limit]

    print(f"\nProcessing {len(issues)} issues (from {args.start_year})")

    if args.scan:
        # ─── SCAN MODE ───
        total_candidates = 0
        total_articles = 0

        for i, issue in enumerate(issues):
            year = issue["year"]
            month = issue.get("month") or 1
            result = scan_issue(issue)

            if result:
                total_articles += result["total_articles"]
                total_candidates += result["candidates"]
                print(f"  [{i+1}/{len(issues)}] AD {year}-{month:02d}: "
                      f"{result['total_articles']} articles, {result['candidates']} candidates")
            else:
                print(f"  [{i+1}/{len(issues)}] AD {year}-{month:02d}: FETCH ERROR")

            time.sleep(0.3)  # Rate limit

        print(f"\n{'=' * 70}")
        print(f"TOTAL: {total_articles} articles, {total_candidates} home candidates")
        print(f"Average: {total_candidates / len(issues):.1f} candidates/issue")

    elif args.extract:
        # ─── EXTRACT MODE ───
        total_new = 0
        total_classified = 0
        total_cost = 0.0

        for i, issue in enumerate(issues):
            year = issue["year"]
            month = issue.get("month") or 1

            print(f"\n[{i+1}/{len(issues)}] AD {year}-{month:02d}")

            result = extract_issue(sb, issue, dry_run=args.dry_run)
            total_cost += result.get("cost", 0.0)
            total_new += result.get("new", 0)
            total_classified += result.get("classified", 0)

            status = result["status"]
            new = result.get("new", 0)
            classified = result.get("classified", 0)

            if status == "ok":
                print(f"    {classified} classified, {new} NEW features inserted")
            elif status == "dry_run":
                print(f"    {classified} classified, {new} would be new:")
                for t in result.get("new_titles", []):
                    print(f"      + {t}")
            elif status == "all_exist":
                print(f"    {classified} classified, all already exist")
            elif status == "no_candidates":
                print(f"    No article candidates")
            elif status == "no_homes":
                print(f"    No home features found")
            else:
                print(f"    {status}")

            time.sleep(0.5)  # Rate limit archive + API

        print(f"\n{'=' * 70}")
        print(f"DONE: {total_new} new features from {len(issues)} issues")
        print(f"Classified: {total_classified} home features total")
        print(f"Haiku cost: ${total_cost:.2f}")
        if args.dry_run:
            print("(DRY RUN — no features were inserted)")
            est_opus = total_new * 0.09
            print(f"Estimated Opus scoring cost: ~${est_opus:.0f}")


if __name__ == "__main__":
    main()
