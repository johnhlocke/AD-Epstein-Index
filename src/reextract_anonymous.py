"""
Re-extract Anonymous features from AD Archive using Sonnet instead of Haiku.

Queries Supabase for features where homeowner_name = 'Anonymous' and
notes contain 'ad_archive_deep_scrape', re-fetches the page images from
Azure Blob Storage, and re-runs extraction with Sonnet vision.

Usage:
    python3 src/reextract_anonymous.py                    # Dry run (preview only)
    python3 src/reextract_anonymous.py --apply             # Apply updates to Supabase
    python3 src/reextract_anonymous.py --apply --limit 50  # Process first 50
    python3 src/reextract_anonymous.py --stats             # Show stats only
"""

import argparse
import base64
import json
import os
import sys
import time
from datetime import datetime

from dotenv import load_dotenv

load_dotenv()

# Same blob URL pattern as courier.py
AD_ARCHIVE_BLOB_BASE = "https://architecturaldigest.blob.core.windows.net/architecturaldigest{date}thumbnails/Pages/0x600/{page}.jpg"
MAX_PAGES = 3  # First 3 pages per article

# Model for re-extraction
SONNET_MODEL = "claude-sonnet-4-5-20250929"

# Cost tracking
SONNET_INPUT_PRICE = 3.0 / 1_000_000   # $3 per 1M input tokens
SONNET_OUTPUT_PRICE = 15.0 / 1_000_000  # $15 per 1M output tokens

RESULTS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "reextract_anonymous_results.json")


def get_supabase():
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
    return create_client(url, key)


def fetch_anonymous_features(sb):
    """Get all Anonymous features from ad_archive_deep_scrape."""
    rows = []
    offset = 0
    while True:
        batch = (
            sb.table("features")
            .select("id, issue_id, article_title, article_author, homeowner_name, designer_name, page_number, notes, design_style, location_city, location_state, location_country")
            .eq("homeowner_name", "Anonymous")
            .ilike("notes", "%ad_archive%")
            .range(offset, offset + 999)
            .execute()
        )
        rows.extend(batch.data or [])
        if len(batch.data or []) < 1000:
            break
        offset += 1000
    return rows


def fetch_issue_info(sb, issue_ids):
    """Get year/month for a set of issue IDs."""
    info = {}
    unique_ids = list(set(issue_ids))
    # Batch in chunks of 100
    for i in range(0, len(unique_ids), 100):
        chunk = unique_ids[i:i+100]
        result = sb.table("issues").select("id, year, month, identifier").in_("id", chunk).execute()
        for row in (result.data or []):
            info[row["id"]] = row
    return info


def fetch_page_images(date_str, start_page, max_pages=MAX_PAGES):
    """Download page images from Azure Blob Storage.

    Returns list of (page_num, image_bytes) tuples.
    """
    import requests

    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    pages = []

    for offset in range(max_pages):
        page_num = start_page + offset
        url = AD_ARCHIVE_BLOB_BASE.format(date=date_str, page=page_num)
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            if resp.status_code == 200 and len(resp.content) > 1000:
                pages.append((page_num, resp.content))
            else:
                break  # No more pages available
        except Exception:
            break

    return pages


def extract_with_sonnet(pages, article_title, article_author, year, month, designer_name=None):
    """Run Sonnet vision extraction on page images.

    Returns (parsed_dict, usage_dict) or (None, None) on failure.
    """
    import anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not set")
        return None, None

    client = anthropic.Anthropic(api_key=api_key)

    # Build content blocks
    content = []
    for page_num, img_bytes in pages:
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": b64,
            },
        })

    month_str = f"{month:02d}"
    designer_hint = f"\nKNOWN DESIGNER: {designer_name}" if designer_name else ""

    prompt = f"""You are reading pages from an Architectural Digest magazine article.

ISSUE: AD {year}-{month_str}
ARTICLE TITLE: {article_title or 'Unknown'}
AUTHOR/PHOTOGRAPHER: {article_author or ''}{designer_hint}

Extract the following from these magazine page images:
- homeowner_name: The person(s) whose home is featured (NOT the writer/photographer/designer)
- designer_name: Interior designer or architect who designed/renovated the space
- architecture_firm: Architecture firm (if separate from designer)
- location_city: City where the home is located
- location_state: State or region
- location_country: Country
- design_style: Architectural or interior design style
- year_built: Year the home was built or renovated
- square_footage: Size of the home
- cost: Cost mentioned
- is_private_home: true if this is about a private residence, false if it's a hotel, museum, office, store, or other non-residential space
- article_type: One of "private_home", "hotel", "museum", "designer_profile", "column", "editorial", "other"

RULES:
- Extract ONLY what is stated or strongly implied in the text/images
- Use null for any field not found
- The homeowner is whose HOME it is — look for possessives, "home of", "residence of"
- If the designer/architect IS the homeowner (it's THEIR home), put their name in BOTH homeowner_name AND designer_name
- The designer/architect is who designed the space — look for "designed by", "architect", "interior designer"
- Look carefully at ALL text in the images — captions, headers, credits, body text
- Names often appear in small caption text at bottom or side of pages
- If the article is NOT about a private home/apartment/estate, set is_private_home to false

Respond with ONLY a JSON object:
{{
  "homeowner_name": "Name or null",
  "designer_name": "Name or null",
  "architecture_firm": "Firm or null",
  "location_city": "City or null",
  "location_state": "State or null",
  "location_country": "Country or null",
  "design_style": "Style or null",
  "year_built": null,
  "square_footage": null,
  "cost": null,
  "is_private_home": true,
  "article_type": "private_home"
}}"""

    content.append({"type": "text", "text": prompt})

    try:
        message = client.messages.create(
            model=SONNET_MODEL,
            max_tokens=1024,
            messages=[{"role": "user", "content": content}],
        )
        usage = {
            "input_tokens": message.usage.input_tokens,
            "output_tokens": message.usage.output_tokens,
            "cost": (message.usage.input_tokens * SONNET_INPUT_PRICE +
                     message.usage.output_tokens * SONNET_OUTPUT_PRICE),
        }
        result_text = message.content[0].text
    except Exception as e:
        print(f"  API error: {e}")
        return None, None

    # Parse JSON from response
    try:
        # Strip markdown code fences if present
        text = result_text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
        parsed = json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON in the response
        import re
        match = re.search(r'\{[^{}]*\}', result_text, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group())
            except json.JSONDecodeError:
                print(f"  Failed to parse JSON from response")
                return None, usage
        else:
            print(f"  No JSON found in response")
            return None, usage

    # Clean null-string values
    for key, val in list(parsed.items()):
        if isinstance(val, str) and val.lower() in ("null", "none", "n/a", "unknown"):
            parsed[key] = None

    return parsed, usage


def apply_update(sb, feature_id, parsed):
    """Update a feature row in Supabase with Sonnet extraction results."""
    update = {}

    if parsed.get("homeowner_name"):
        update["homeowner_name"] = parsed["homeowner_name"]
    if parsed.get("designer_name"):
        update["designer_name"] = parsed["designer_name"]
    if parsed.get("architecture_firm"):
        update["architecture_firm"] = parsed["architecture_firm"]
    if parsed.get("location_city"):
        update["location_city"] = parsed["location_city"]
    if parsed.get("location_state"):
        update["location_state"] = parsed["location_state"]
    if parsed.get("location_country"):
        update["location_country"] = parsed["location_country"]
    if parsed.get("design_style"):
        update["design_style"] = parsed["design_style"]
    if parsed.get("year_built"):
        try:
            update["year_built"] = int(str(parsed["year_built"]).strip())
        except (ValueError, TypeError):
            pass
    if parsed.get("square_footage"):
        try:
            # Handle strings like "4,600-square-foot" or "4,600"
            import re as _re
            digits = _re.sub(r'[^\d]', '', str(parsed["square_footage"]))
            if digits:
                update["square_footage"] = int(digits)
        except (ValueError, TypeError):
            pass
    if parsed.get("cost"):
        update["cost"] = str(parsed["cost"])

    # Update notes to record re-extraction
    update["notes"] = "Re-extracted with Sonnet (was Anonymous from Haiku deep scrape)"

    if update.get("homeowner_name"):
        sb.table("features").update(update).eq("id", feature_id).execute()
        return True
    return False


def main():
    parser = argparse.ArgumentParser(description="Re-extract Anonymous features with Sonnet")
    parser.add_argument("--apply", action="store_true", help="Apply updates to Supabase (default: dry run)")
    parser.add_argument("--limit", type=int, default=0, help="Max features to process (0 = all)")
    parser.add_argument("--stats", action="store_true", help="Show stats only, don't process")
    parser.add_argument("--skip-non-homes", action="store_true", help="Also mark non-home content in Supabase")
    args = parser.parse_args()

    sb = get_supabase()

    print("Fetching Anonymous features from Supabase...")
    features = fetch_anonymous_features(sb)
    print(f"Found {len(features)} Anonymous features from AD Archive deep scrape\n")

    if not features:
        return

    # Get issue info
    issue_ids = [f["issue_id"] for f in features]
    issue_info = fetch_issue_info(sb, issue_ids)

    # Stats breakdown
    if args.stats:
        by_decade = {}
        with_designer = 0
        for f in features:
            info = issue_info.get(f["issue_id"], {})
            year = info.get("year", 0)
            decade = f"{(year // 10) * 10}s" if year else "unknown"
            by_decade[decade] = by_decade.get(decade, 0) + 1
            if f.get("designer_name"):
                with_designer += 1

        print("Anonymous features by decade:")
        for decade in sorted(by_decade):
            print(f"  {decade}: {by_decade[decade]}")
        print(f"\n  With designer extracted: {with_designer}/{len(features)} ({100*with_designer//len(features)}%)")
        return

    # Load previous results for resume support
    prev_results = {}
    if os.path.exists(RESULTS_PATH):
        with open(RESULTS_PATH) as f:
            prev_data = json.load(f)
            prev_results = {r["feature_id"]: r for r in prev_data.get("results", [])}
        print(f"Loaded {len(prev_results)} previous results (will skip)")

    # Process features
    results = list(prev_results.values())  # Start with previous results
    total_cost = sum(r.get("cost", 0) for r in results)
    recovered = sum(1 for r in results if r.get("recovered"))
    non_homes = sum(1 for r in results if r.get("not_private_home"))
    still_anon = sum(1 for r in results if not r.get("recovered") and not r.get("not_private_home") and not r.get("error"))
    skipped = 0
    processed = 0
    errors = 0

    to_process = [f for f in features if f["id"] not in prev_results]
    if args.limit:
        to_process = to_process[:args.limit]

    print(f"Processing {len(to_process)} features ({len(prev_results)} already done)")
    print(f"Mode: {'APPLY' if args.apply else 'DRY RUN'}\n")

    for i, feat in enumerate(to_process):
        info = issue_info.get(feat["issue_id"], {})
        year = info.get("year")
        month = info.get("month")
        if not year or not month:
            print(f"[{i+1}/{len(to_process)}] Feature {feat['id']}: No issue info, skipping")
            skipped += 1
            continue

        page_num = feat.get("page_number")
        if not page_num:
            print(f"[{i+1}/{len(to_process)}] Feature {feat['id']}: No page number, skipping")
            skipped += 1
            continue

        date_str = f"{year}{month:02d}01"
        title = feat.get("article_title", "Unknown")
        print(f"[{i+1}/{len(to_process)}] {year}-{month:02d} \"{title}\" (p.{page_num})...", end=" ", flush=True)

        # Fetch page images
        pages = fetch_page_images(date_str, page_num)
        if not pages:
            print("NO IMAGES")
            errors += 1
            results.append({"feature_id": feat["id"], "error": "no_images"})
            continue

        # Extract with Sonnet
        parsed, usage = extract_with_sonnet(
            pages, title, feat.get("article_author"), year, month,
            designer_name=feat.get("designer_name"),
        )
        processed += 1

        if not parsed:
            print(f"PARSE ERROR (${usage['cost']:.4f})" if usage else "API ERROR")
            errors += 1
            cost = usage["cost"] if usage else 0
            total_cost += cost
            results.append({"feature_id": feat["id"], "error": "parse_error", "cost": cost})
            continue

        cost = usage["cost"]
        total_cost += cost

        homeowner = parsed.get("homeowner_name")
        is_home = parsed.get("is_private_home", True)
        article_type = parsed.get("article_type", "private_home")

        result_entry = {
            "feature_id": feat["id"],
            "issue": f"{year}-{month:02d}",
            "title": title,
            "page": page_num,
            "old_homeowner": "Anonymous",
            "new_homeowner": homeowner,
            "is_private_home": is_home,
            "article_type": article_type,
            "designer": parsed.get("designer_name"),
            "location": f"{parsed.get('location_city', '')}, {parsed.get('location_state', '')}".strip(", "),
            "cost": cost,
            "pages_sent": len(pages),
        }

        if not is_home:
            print(f"NOT A HOME ({article_type}) ${cost:.4f}")
            non_homes += 1
            result_entry["not_private_home"] = True
            if args.apply and args.skip_non_homes:
                sb.table("features").update({
                    "notes": f"Non-home content ({article_type}) — re-classified by Sonnet"
                }).eq("id", feat["id"]).execute()
        elif homeowner and homeowner.lower() not in ("anonymous", "null", "none"):
            print(f"RECOVERED: {homeowner} ${cost:.4f}")
            recovered += 1
            result_entry["recovered"] = True
            if args.apply:
                apply_update(sb, feat["id"], parsed)
        else:
            print(f"STILL ANONYMOUS ${cost:.4f}")
            still_anon += 1

        results.append(result_entry)

        # Save progress every 10 features
        if (i + 1) % 10 == 0:
            _save_results(results, total_cost, recovered, non_homes, still_anon, errors)

        # Rate limit: ~1 req/sec to avoid API throttling
        time.sleep(0.5)

    # Final save
    _save_results(results, total_cost, recovered, non_homes, still_anon, errors)

    # Summary
    print(f"\n{'='*60}")
    print(f"RESULTS SUMMARY")
    print(f"{'='*60}")
    print(f"Total processed:    {processed}")
    print(f"Names recovered:    {recovered}")
    print(f"Non-home content:   {non_homes}")
    print(f"Genuinely anonymous:{still_anon}")
    print(f"Errors:             {errors}")
    print(f"Skipped:            {skipped}")
    print(f"Total cost:         ${total_cost:.4f}")
    print(f"Mode:               {'APPLIED' if args.apply else 'DRY RUN'}")
    if not args.apply and recovered > 0:
        print(f"\nRun with --apply to update Supabase")


def _save_results(results, total_cost, recovered, non_homes, still_anon, errors):
    """Save results to disk for resume support and audit trail."""
    os.makedirs(os.path.dirname(RESULTS_PATH), exist_ok=True)
    data = {
        "last_updated": datetime.now().isoformat(),
        "summary": {
            "total": len(results),
            "recovered": recovered,
            "non_homes": non_homes,
            "still_anonymous": still_anon,
            "errors": errors,
            "total_cost": round(total_cost, 6),
        },
        "results": results,
    }
    with open(RESULTS_PATH, "w") as f:
        json.dump(data, f, indent=2)


if __name__ == "__main__":
    main()
