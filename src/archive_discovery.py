"""
Step 1: Discover Architectural Digest issues on the Internet Archive.

Queries the archive.org search API, parses month/year from titles,
and saves a manifest JSON file for downstream steps.

Usage:
    python3 src/archive_discovery.py
"""

import json
import re
import os
import requests

SEARCH_URL = "https://archive.org/advancedsearch.php"
MANIFEST_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "archive_manifest.json")

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# Words that indicate this is NOT a single magazine issue
SKIP_KEYWORDS = ["celebrity homes", "book", "best of", "collection", "index"]


def parse_month_year(title, identifier="", date_field=None):
    """Try to extract month and year from title, identifier, or date field."""
    title_lower = title.lower()

    # Strategy 1: Parse from title like "Architectural Digest October 2015"
    for month_name, month_num in MONTHS.items():
        pattern = rf"\b{month_name}\b\s*(\d{{4}})"
        match = re.search(pattern, title_lower)
        if match:
            return month_num, int(match.group(1))

    # Strategy 2: Parse from identifier like "architecturaldig42octlosa"
    # Volume numbers: AD started in 1920, so vol 1 = ~1920
    # But volumes don't map cleanly to years (multiple issues per year)
    # Better to extract month from identifier and year from the date field
    ident_match = re.match(
        r"architecturaldig(\d+)(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)l?osa",
        identifier.lower(),
    )
    if ident_match:
        vol = int(ident_match.group(1))
        mon_str = ident_match.group(2)
        month_num = MONTHS.get(mon_str)

        # AD Volume 1 started around 1920. Volumes are roughly year-based
        # but 4 issues per year in early decades, 12 later. Use a rough mapping:
        # Before vol 25 (pre-1945): year ~= 1919 + vol
        # After vol 25: year ~= 1919 + vol (still roughly works)
        estimated_year = 1919 + vol

        # If we have a date field, prefer it for the year
        if date_field:
            date_year_match = re.search(r"(19\d{2}|20\d{2})", str(date_field))
            if date_year_match:
                estimated_year = int(date_year_match.group(1))

        return month_num, estimated_year

    # Strategy 3: Parse from identifier like "architectural-digest-1502" (YYMM)
    yymm_match = re.search(r"digest[_-](\d{2})(\d{2})", identifier.lower())
    if yymm_match:
        yy = int(yymm_match.group(1))
        mm = int(yymm_match.group(2))
        if 1 <= mm <= 12:
            year = 2000 + yy if yy < 50 else 1900 + yy
            return mm, year

    # Strategy 4: Just a year from the title
    year_match = re.search(r"\b(19\d{2}|20\d{2})\b", title)
    if year_match:
        return None, int(year_match.group(1))

    return None, None


def is_magazine_issue(title):
    """Filter out books, compilations, and non-issue items."""
    title_lower = title.lower()
    for keyword in SKIP_KEYWORDS:
        if keyword in title_lower:
            return False
    return True


def discover():
    """Query archive.org for all Architectural Digest text items."""
    print("Searching archive.org for Architectural Digest issues...")

    params = {
        "q": 'mediatype:texts AND title:"architectural digest"',
        "fl[]": ["identifier", "title", "date", "publicdate"],
        "rows": 500,
        "output": "json",
    }

    response = requests.get(SEARCH_URL, params=params)
    response.raise_for_status()

    data = response.json()
    docs = data["response"]["docs"]
    total = data["response"]["numFound"]
    print(f"Found {total} items on archive.org")

    issues = []
    skipped = []

    for doc in docs:
        title = doc.get("title", "")
        identifier = doc.get("identifier", "")

        if not is_magazine_issue(title):
            skipped.append({"identifier": identifier, "title": title, "reason": "not a magazine issue"})
            continue

        month, year = parse_month_year(title, identifier, doc.get("date"))

        issues.append({
            "identifier": identifier,
            "title": title,
            "month": month,
            "year": year,
            "date": doc.get("date"),
            "status": "discovered",
            "pdf_path": None,
            "needs_review": month is None,
        })

    # Sort by year then month
    issues.sort(key=lambda x: (x["year"] or 9999, x["month"] or 99))

    manifest = {
        "total_found": total,
        "issues": issues,
        "skipped": skipped,
    }

    os.makedirs(os.path.dirname(MANIFEST_PATH), exist_ok=True)
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, indent=2)

    # Summary
    with_month = sum(1 for i in issues if i["month"] is not None)
    needs_review = sum(1 for i in issues if i["needs_review"])

    print(f"\nManifest saved to {MANIFEST_PATH}")
    print(f"  {len(issues)} magazine issues found")
    print(f"  {with_month} with month/year parsed")
    print(f"  {needs_review} need manual review (no month detected)")
    print(f"  {len(skipped)} items skipped (books, compilations, etc.)")

    return manifest


if __name__ == "__main__":
    discover()
