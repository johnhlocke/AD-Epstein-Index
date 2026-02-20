#!/usr/bin/env python3
"""Update feature notes with authoritative page ranges from spread data.

Step 1 of the image fix: establish ground truth for every feature's page range
by reading the AD Archive's spread data (which covers ALL articles, unlike the
JWT 'featured' array which only has ~7 curated articles per issue).

Usage:
    python3 src/update_spread_pages.py --audit          # Report only, no DB writes
    python3 src/update_spread_pages.py --write           # Write clean matches to DB
    python3 src/update_spread_pages.py --audit --limit 5 # Test on 5 issues
"""

import argparse
import json
import os
import re
import sys
import time

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}


def parse_spread_articles(html):
    """Parse ALL articles from the archive page's spread data.

    Returns dict of {title_upper: {title, pages, key}} — keyed by uppercase title
    for matching. If duplicate titles exist, aggregates pages.
    """
    article_pages = {}  # key -> set of page strings
    article_info = {}   # key -> {Title, Genre, Section, Slug}

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
                "Slug": (art.get("Slug") or "").strip(),
            }

        for p in pages:
            article_pages[key].add(p)

    # Build result: list of articles with sorted numeric pages
    articles = []
    for key, info in article_info.items():
        title = info["Title"]
        if not title:
            continue

        raw_pages = article_pages.get(key, set())
        numeric_pages = sorted(
            int(p) for p in raw_pages if p.isdigit()
        )

        if not numeric_pages:
            continue

        articles.append({
            "title": title,
            "title_upper": title.upper().strip(),
            "genre": info["Genre"],
            "section": info["Section"],
            "slug": info["Slug"],
            "pages": numeric_pages,
            "page_count": len(numeric_pages),
            "key": key,
        })

    return articles


def normalize_title(title):
    """Normalize title for comparison: uppercase, strip punctuation, collapse whitespace."""
    if not title:
        return ""
    t = title.upper().strip()
    # Remove common punctuation that might differ
    t = re.sub(r"[\u2018\u2019`]", "'", t)  # normalize quotes
    t = re.sub(r'[\u201c\u201d]', '"', t)  # normalize double quotes
    t = re.sub(r"\s+", " ", t)  # collapse whitespace
    return t


def match_feature_to_spread(feature, spread_articles):
    """Try to match a feature to a spread article. Returns (match, confidence).

    Only returns clean matches. Ambiguous/fuzzy matches return None.
    """
    feat_title = normalize_title(feature.get("article_title"))
    if not feat_title:
        return None, "no_title"

    # Pass 1: Exact match (case-insensitive, whitespace-normalized)
    exact_matches = []
    for art in spread_articles:
        spread_title = normalize_title(art["title"])
        if feat_title == spread_title:
            exact_matches.append(art)

    if len(exact_matches) == 1:
        return exact_matches[0], "exact"
    if len(exact_matches) > 1:
        return None, "duplicate_exact"

    # Pass 2: Feature title contained in spread title or vice versa
    # (handles cases like "Sand Castle" vs "SAND CASTLE: A BEACH HOUSE")
    # Only if one of them is a substantial substring (>= 80% of the shorter)
    contain_matches = []
    for art in spread_articles:
        spread_title = normalize_title(art["title"])
        shorter = min(len(feat_title), len(spread_title))
        if shorter < 4:
            continue
        if feat_title in spread_title or spread_title in feat_title:
            overlap_ratio = shorter / max(len(feat_title), len(spread_title))
            if overlap_ratio >= 0.8:
                contain_matches.append(art)

    if len(contain_matches) == 1:
        return contain_matches[0], "contained"

    return None, "no_match"


def parse_notes(notes_raw):
    """Safely parse the notes field which can be JSON string, dict, or None."""
    if not notes_raw:
        return {}
    if isinstance(notes_raw, dict):
        return notes_raw
    try:
        parsed = json.loads(notes_raw)
        if isinstance(parsed, dict):
            return parsed
        return {"_original": notes_raw}
    except (json.JSONDecodeError, TypeError):
        return {"_original": notes_raw}


def fetch_all_issues():
    """Fetch all issues with their source URLs."""
    issues = []
    offset = 0
    while True:
        batch = sb.from_("issues").select(
            "id, year, month, source_url"
        ).order("year").order("month").range(offset, offset + 999).execute()
        issues.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000
    return issues


def fetch_features_for_issue(issue_id):
    """Fetch all features for an issue."""
    features = []
    offset = 0
    while True:
        batch = sb.from_("features").select(
            "id, article_title, homeowner_name, page_number, notes"
        ).eq("issue_id", issue_id).range(offset, offset + 999).execute()
        features.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000
    return features


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit", action="store_true", help="Report only, no DB writes")
    parser.add_argument("--write", action="store_true", help="Write clean matches to DB")
    parser.add_argument("--limit", type=int, help="Limit number of issues to process")
    args = parser.parse_args()

    if not args.audit and not args.write:
        print("Must specify --audit or --write")
        sys.exit(1)

    print("=" * 60)
    print("SPREAD DATA → FEATURE NOTES UPDATE")
    print(f"Mode: {'AUDIT (no writes)' if args.audit else 'WRITE'}")
    print("=" * 60)

    issues = fetch_all_issues()
    print(f"Total issues: {len(issues)}")

    if args.limit:
        issues = issues[:args.limit]
        print(f"Limited to {len(issues)} issues")

    # Counters
    total_features = 0
    matched_exact = 0
    matched_contained = 0
    unmatched_no_title = 0
    unmatched_no_match = 0
    unmatched_duplicate = 0
    issues_no_spread = 0
    issues_processed = 0
    features_updated = 0
    features_already_correct = 0

    # Collect unmatched for report
    unmatched_log = []
    match_log = []

    for i, issue in enumerate(issues):
        issue_id = issue["id"]
        year = issue.get("year", "?")
        month = issue.get("month", "?")
        source_url = issue.get("source_url")

        if not source_url:
            issues_no_spread += 1
            continue

        # Fetch spread data
        try:
            resp = requests.get(source_url, headers=HEADERS, timeout=30)
            if resp.status_code != 200:
                issues_no_spread += 1
                if (i + 1) % 50 == 0:
                    print(f"  [{i+1}/{len(issues)}] {year}-{month:02d}: HTTP {resp.status_code}")
                continue
        except requests.RequestException as e:
            issues_no_spread += 1
            continue

        spread_articles = parse_spread_articles(resp.text)
        if not spread_articles:
            issues_no_spread += 1
            continue

        issues_processed += 1

        # Fetch features for this issue
        features = fetch_features_for_issue(issue_id)
        total_features += len(features)

        for feat in features:
            fid = feat["id"]
            match, confidence = match_feature_to_spread(feat, spread_articles)

            if match:
                if confidence == "exact":
                    matched_exact += 1
                else:
                    matched_contained += 1

                match_log.append({
                    "feature_id": fid,
                    "issue": f"{year}-{month:02d}",
                    "feature_title": feat.get("article_title"),
                    "spread_title": match["title"],
                    "confidence": confidence,
                    "spread_pages": match["pages"],
                    "spread_page_count": match["page_count"],
                })

                # Check if notes already have correct spread data
                notes = parse_notes(feat.get("notes"))
                existing_spread = notes.get("spread_pages")
                if existing_spread == match["pages"]:
                    features_already_correct += 1
                    continue

                if args.write:
                    notes["spread_pages"] = match["pages"]
                    notes["spread_page_count"] = match["page_count"]
                    try:
                        sb.from_("features").update(
                            {"notes": json.dumps(notes)}
                        ).eq("id", fid).execute()
                        features_updated += 1
                    except Exception as e:
                        print(f"  ERROR writing #{fid}: {e}")
            else:
                if confidence == "no_title":
                    unmatched_no_title += 1
                elif confidence == "duplicate_exact":
                    unmatched_duplicate += 1
                else:
                    unmatched_no_match += 1

                unmatched_log.append({
                    "feature_id": fid,
                    "issue": f"{year}-{month:02d}",
                    "feature_title": feat.get("article_title"),
                    "page_number": feat.get("page_number"),
                    "reason": confidence,
                    "spread_titles": [a["title"] for a in spread_articles],
                })

        if (i + 1) % 50 == 0:
            elapsed_matches = matched_exact + matched_contained
            print(f"  [{i+1}/{len(issues)}] {year}-{month:02d}: "
                  f"{elapsed_matches} matched, "
                  f"{unmatched_no_match + unmatched_no_title + unmatched_duplicate} unmatched")

        # Rate limit: ~2 requests/sec
        time.sleep(0.5)

    # Final report
    total_matched = matched_exact + matched_contained
    total_unmatched = unmatched_no_title + unmatched_no_match + unmatched_duplicate

    print(f"\n{'=' * 60}")
    print("RESULTS")
    print(f"{'=' * 60}")
    print(f"Issues processed: {issues_processed}")
    print(f"Issues with no spread data: {issues_no_spread}")
    print(f"Total features checked: {total_features}")
    print()
    print(f"MATCHED: {total_matched}")
    print(f"  Exact match: {matched_exact}")
    print(f"  Contained match: {matched_contained}")
    if args.write:
        print(f"  Updated in DB: {features_updated}")
        print(f"  Already correct: {features_already_correct}")
    print()
    print(f"UNMATCHED: {total_unmatched}")
    print(f"  No article_title: {unmatched_no_title}")
    print(f"  No spread match: {unmatched_no_match}")
    print(f"  Duplicate title match: {unmatched_duplicate}")

    # Save reports
    report_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    os.makedirs(report_dir, exist_ok=True)

    unmatched_path = os.path.join(report_dir, "spread_unmatched.json")
    with open(unmatched_path, "w") as f:
        json.dump(unmatched_log, f, indent=2)
    print(f"\nUnmatched features saved to: {unmatched_path}")

    matched_path = os.path.join(report_dir, "spread_matched.json")
    with open(matched_path, "w") as f:
        json.dump(match_log, f, indent=2)
    print(f"Matched features saved to: {matched_path}")

    # Print sample unmatched
    if unmatched_log:
        print(f"\nSample unmatched (first 20):")
        for u in unmatched_log[:20]:
            print(f"  #{u['feature_id']} ({u['issue']}) \"{u['feature_title']}\" — {u['reason']}")
            if u['reason'] == 'no_match' and u.get('spread_titles'):
                # Show closest spread titles for debugging
                titles = u['spread_titles'][:5]
                print(f"    Spread titles: {titles}")


if __name__ == "__main__":
    main()
