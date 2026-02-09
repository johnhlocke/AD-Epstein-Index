"""
Step 3: Extract featured home data from AD magazine PDFs using Claude Vision.

For each PDF:
1. Convert first ~20 pages to images (covers + table of contents)
2. Send TOC pages to Claude Vision to identify featured home articles
3. Convert article opening pages to images
4. Send each article page to Claude Vision for structured data extraction
5. Save results as JSON

Usage:
    python3 src/extract_features.py                          # Process all downloaded PDFs
    python3 src/extract_features.py --issue <identifier>     # Process one specific issue
    python3 src/extract_features.py --limit 1                # Process first N unprocessed issues
    python3 src/extract_features.py --reextract              # Re-extract issues with problems
"""

import base64
import json
import os
import sys
import subprocess
import tempfile
import time
import anthropic
from dotenv import load_dotenv

load_dotenv()

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
EXTRACTIONS_DIR = os.path.join(DATA_DIR, "extractions")
ISSUES_DIR = os.path.join(DATA_DIR, "issues")

# Configure Claude client
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
MODEL = "claude-sonnet-4-5-20250929"

# Minimum year to process (skip older issues after date verification)
MIN_YEAR = 1988

# Retry settings for rate limits
MAX_RETRIES = 5
INITIAL_RETRY_DELAY = 15  # seconds

DATE_VERIFY_PROMPT = """Look at this magazine cover or first page. What is the publication date of this issue?

Return ONLY a JSON object with these fields:
- "month": the month as an integer (1-12)
- "year": the year as an integer (e.g., 1997)

If you can see a specific month and year (e.g., "October 1997"), return those values.
If you can only determine the year, set month to null.
If you cannot determine the date at all, return {"month": null, "year": null}.

Return ONLY valid JSON, no markdown code blocks, no explanation.
"""

TOC_PROMPT = """You are analyzing the table of contents / first pages of an Architectural Digest magazine issue.

These are images of PDF pages numbered sequentially starting at 1. However, the magazine has its OWN printed page numbers that are different from the PDF page numbers.

IMPORTANT: First, find the printed page number on the table of contents page itself. For example, if the TOC page shows "8" at the bottom and it was the 6th image you received, then the offset is 6 - 8 = -2 (meaning PDF page = magazine page + offset).

Identify ALL articles about homes, residences, apartments, estates, or living spaces. Include:
- Full-length feature articles about someone's home
- "AD Visits" articles (these ARE features about real homes)
- Celebrity home tours
- Designer showcase homes
- Any article where a specific person's home is photographed and described

Do NOT include: ads, product roundups, shopping guides, columns about design trends (without a specific home).

A typical issue of Architectural Digest has 4-8 featured home articles. If you find fewer than 3, look more carefully.

Return a JSON object with these fields:
- "toc_printed_page": the page number printed on the TOC page (integer)
- "toc_pdf_page": which image number (1-indexed) the TOC appeared in
- "articles": an array of objects, each with:
  - "article_title": the title of the article
  - "magazine_page": the page number listed in the table of contents
  - "homeowner_hint": any name or description visible (e.g., "A Designer's Paris Apartment")

Return ONLY valid JSON, no markdown code blocks, no explanation. Example:
{"toc_printed_page": 8, "toc_pdf_page": 6, "articles": [{"article_title": "High Spirits", "magazine_page": 116, "homeowner_hint": "Michele Pitcher's Mexican villa"}]}

If you cannot identify any featured home articles, return: {"toc_printed_page": null, "toc_pdf_page": null, "articles": []}
"""

# Minimum features expected per issue — if fewer are extracted, something went wrong
MIN_FEATURES_PER_ISSUE = 3

EXTRACT_PROMPT = """You are extracting data from an Architectural Digest magazine article about a featured home.

Look at this magazine page and extract the following information. Use null for any field you cannot determine from this page.

Return a JSON object with these fields:
- "article_title": the title of the article
- "homeowner_name": the CURRENT or most recent owner/resident of the home. For historic or retrospective articles about estates (e.g., "Historic Architecture: Wyntoon"), identify who currently owns or occupies the property, NOT the historical figure who originally built it. If the current owner is not stated, use the name most prominently associated with the home in the article, but add a note explaining the historical context. If the homeowner is deliberately unnamed, described generically (e.g., "a young family", "a couple", "the owners"), or the article withholds their identity, use "Anonymous" as the homeowner_name.
- "designer_name": the interior designer
- "architecture_firm": the architect or architecture firm
- "year_built": year the home was built or renovated (integer or null)
- "square_footage": size in square feet (integer or null)
- "cost": cost as a string (e.g., "$2.5 million") or null
- "location_city": city name
- "location_state": state (US) or province
- "location_country": country
- "design_style": architectural/design style (e.g., "Mid-Century Modern", "Mediterranean")
- "article_author": the writer/journalist who authored this article (check the byline)
- "page_number": the page number visible on this page (integer)
- "notes": any other notable details. For historic/retrospective articles, note that this is a historical feature and mention the original builder/commissioner if different from the current owner.

Return ONLY valid JSON, no markdown code blocks, no explanation.
If this page is NOT a featured home article (e.g., it's an ad or editorial), return: {"skip": true}
"""


def pdf_has_text_layer(pdf_path, sample_page=5):
    """Check if a PDF has an extractable text layer on a given page."""
    try:
        result = subprocess.run(
            ["pdftotext", "-f", str(sample_page), "-l", str(sample_page), pdf_path, "-"],
            capture_output=True, text=True, timeout=10,
        )
        return len(result.stdout.strip()) > 50
    except Exception:
        return False


def pdf_extract_text(pdf_path, first_page, last_page):
    """Extract text from a range of PDF pages using pdftotext.

    Returns the extracted text, or empty string on failure.
    """
    try:
        result = subprocess.run(
            ["pdftotext", "-f", str(first_page), "-l", str(last_page), "-layout", pdf_path, "-"],
            capture_output=True, text=True, timeout=30,
        )
        return result.stdout.strip()
    except Exception:
        return ""


def pdf_to_images(pdf_path, pages, output_dir):
    """Convert specific PDF pages to PNG images using pdftoppm.

    Args:
        pdf_path: Path to the PDF file
        pages: List of page numbers (1-indexed) or a range like (1, 10)
        output_dir: Directory to save PNG files

    Returns:
        List of image file paths
    """
    os.makedirs(output_dir, exist_ok=True)
    image_paths = []

    # Reader's recovery strategy can request lower resolution
    dpi = "100" if os.environ.get("READER_LOW_RES") == "1" else "150"

    try:
        if isinstance(pages, tuple) and len(pages) == 2:
            # Range of pages
            first, last = pages
            prefix = os.path.join(output_dir, "page")
            subprocess.run(
                ["pdftoppm", "-png", "-f", str(first), "-l", str(last), "-r", dpi, pdf_path, prefix],
                check=True, capture_output=True,
            )
            # pdftoppm creates files like page-01.png, page-02.png, etc.
            for f in sorted(os.listdir(output_dir)):
                if f.startswith("page") and f.endswith(".png"):
                    image_paths.append(os.path.join(output_dir, f))
        else:
            # Individual pages
            for page_num in pages:
                prefix = os.path.join(output_dir, f"p{page_num:04d}")
                subprocess.run(
                    ["pdftoppm", "-png", "-f", str(page_num), "-l", str(page_num), "-r", dpi, pdf_path, prefix],
                    check=True, capture_output=True,
                )
                for f in sorted(os.listdir(output_dir)):
                    fpath = os.path.join(output_dir, f)
                    if f.startswith(f"p{page_num:04d}") and f.endswith(".png") and fpath not in image_paths:
                        image_paths.append(fpath)
    except subprocess.CalledProcessError as e:
        stderr_msg = e.stderr.decode() if e.stderr else str(e)
        print(f"  pdftoppm error on {pdf_path}: {stderr_msg}")
        return []
    except FileNotFoundError:
        print("  pdftoppm not found — is poppler-utils installed?")
        return []

    return image_paths


MAX_IMAGE_BYTES = 1_500_000  # 1.5 MB — keeps 10-page batches under API limit


def make_image_content(image_path):
    """Read an image file and return a Claude image content block.

    If the PNG exceeds MAX_IMAGE_BYTES, re-encode as JPEG with progressive
    quality reduction to stay within the API request size limit.
    """
    with open(image_path, "rb") as f:
        data = f.read()

    media_type = "image/png"

    if len(data) > MAX_IMAGE_BYTES:
        try:
            from PIL import Image
            img = Image.open(image_path)
            if img.mode == "RGBA":
                img = img.convert("RGB")
            # Try decreasing quality until under limit
            for quality in (70, 50, 35):
                import io
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=quality)
                jpeg_data = buf.getvalue()
                if len(jpeg_data) <= MAX_IMAGE_BYTES:
                    data = jpeg_data
                    media_type = "image/jpeg"
                    break
            else:
                # Even quality 35 is too large — resize to 75%
                img = img.resize((int(img.width * 0.75), int(img.height * 0.75)))
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=50)
                data = buf.getvalue()
                media_type = "image/jpeg"
        except ImportError:
            pass  # No PIL — send the large PNG as-is

    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": media_type,
            "data": base64.standard_b64encode(data).decode("utf-8"),
        },
    }


def call_claude_with_retry(prompt, image_paths):
    """Call Claude API with images and exponential backoff retry on rate limits.

    Args:
        prompt: Text prompt string
        image_paths: List of image file paths to include

    Returns:
        Response text string
    """
    # Build content blocks: images first, then text prompt
    content = [make_image_content(img) for img in image_paths]
    content.append({"type": "text", "text": prompt})

    delay = INITIAL_RETRY_DELAY
    for attempt in range(MAX_RETRIES):
        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=2048,
                messages=[{"role": "user", "content": content}],
            )
            return response.content[0].text
        except anthropic.RateLimitError:
            if attempt < MAX_RETRIES - 1:
                print(f"    Rate limited, waiting {delay}s (attempt {attempt + 1}/{MAX_RETRIES})...")
                time.sleep(delay)
                delay *= 2
            else:
                print(f"    Rate limit exceeded after {MAX_RETRIES} attempts. Skipping.")
                raise
        except anthropic.APIError as e:
            if "overloaded" in str(e).lower() and attempt < MAX_RETRIES - 1:
                print(f"    API overloaded, waiting {delay}s...")
                time.sleep(delay)
                delay *= 2
            else:
                raise


def parse_json_response(text):
    """Parse JSON from Claude response, stripping markdown code blocks if present."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    return json.loads(text)


def verify_date(pdf_path, temp_dir):
    """Read the cover page to confirm actual publication month/year.
    Falls back to reading the table of contents if the cover is unreadable.

    Returns (month, year) tuple. Either value may be None if unreadable.
    """
    print("  Verifying publication date from cover...")
    cover_images = pdf_to_images(pdf_path, (1, 2), os.path.join(temp_dir, "cover"))

    if not cover_images:
        print("  Warning: Could not extract cover page")
        return None, None

    response_text = call_claude_with_retry(DATE_VERIFY_PROMPT, cover_images)

    try:
        data = parse_json_response(response_text)
        month = data.get("month")
        year = data.get("year")
        if year:
            print(f"  Confirmed date from cover: {year}-{month:02d}" if month else f"  Confirmed year from cover: {year}")
            return month, year
    except (json.JSONDecodeError, TypeError):
        pass

    # Fallback: read the table of contents pages for the date
    print("  Cover date unreadable, checking table of contents...")
    toc_images = pdf_to_images(pdf_path, (3, 8), os.path.join(temp_dir, "date_toc"))

    if not toc_images:
        print("  Warning: Could not extract TOC pages")
        return None, None

    response_text = call_claude_with_retry(DATE_VERIFY_PROMPT, toc_images)

    try:
        data = parse_json_response(response_text)
        month = data.get("month")
        year = data.get("year")
        if year:
            print(f"  Confirmed date from TOC: {year}-{month:02d}" if month else f"  Confirmed year from TOC: {year}")
            return month, year
    except (json.JSONDecodeError, TypeError):
        pass

    print("  Warning: Could not determine date from cover or TOC")
    return None, None


def detect_page_offset(pdf_path, temp_dir):
    """Auto-detect page offset by reading printed page numbers from interior pages.

    Sends a few interior PDF pages to Claude and asks for the printed page number
    visible on each, then calculates the average offset.
    """
    OFFSET_PROMPT = """Look at these magazine pages. For each page, tell me the printed page number
visible at the bottom or top of the page.

Return a JSON array of objects, one per image:
[{"pdf_page": 1, "printed_page": 42}, {"pdf_page": 2, "printed_page": 43}]

Use null for printed_page if you cannot read it. Return ONLY valid JSON."""

    # Sample a few pages from the middle of the magazine
    sample_pages = [20, 30, 50]
    sample_dir = os.path.join(temp_dir, "offset_detect")
    images = pdf_to_images(pdf_path, sample_pages, sample_dir)
    if not images:
        return 0

    try:
        response_text = call_claude_with_retry(OFFSET_PROMPT, images)
        data = parse_json_response(response_text)
        offsets = []
        for i, entry in enumerate(data):
            printed = entry.get("printed_page")
            if printed and isinstance(printed, int):
                offset = sample_pages[i] - printed
                offsets.append(offset)
        if offsets:
            avg_offset = round(sum(offsets) / len(offsets))
            print(f"  Auto-detected page offset: {avg_offset:+d} (from {len(offsets)} sample pages)")
            return avg_offset
    except (json.JSONDecodeError, IndexError, TypeError):
        pass
    return 0


def find_articles_from_toc(pdf_path, temp_dir):
    """Extract TOC pages, identify featured home articles, and calculate page offset.

    Sends pages in two batches (1-10, 11-20) to stay within Claude's request
    size limit, then merges the results.

    Returns (articles, page_offset) where:
    - articles: list of dicts with article_title, magazine_page, homeowner_hint
    - page_offset: integer to add to magazine_page to get PDF page number
      (e.g., if magazine page 8 = PDF page 6, offset is -2)
    """
    all_articles = []
    page_offset = None

    # Send TOC pages in batches — smaller batches when Reader's recovery strategy requests it
    if os.environ.get("READER_SMALL_BATCHES") == "1":
        batches = [(1, 5), (6, 10), (11, 15), (16, 20)]
    else:
        batches = [(1, 10), (11, 20)]
    for first, last in batches:
        print(f"  Extracting TOC pages ({first}-{last})...")
        toc_images = pdf_to_images(pdf_path, (first, last), os.path.join(temp_dir, f"toc_{first}"))

        if not toc_images:
            continue

        print(f"  Sending {len(toc_images)} TOC pages to Claude...")
        response_text = call_claude_with_retry(TOC_PROMPT, toc_images)

        try:
            data = parse_json_response(response_text)
            articles = data.get("articles", [])
            all_articles.extend(articles)

            # Calculate page offset from the first batch that provides it
            if page_offset is None:
                toc_printed = data.get("toc_printed_page")
                toc_pdf = data.get("toc_pdf_page")
                if toc_printed and toc_pdf:
                    page_offset = toc_pdf - toc_printed
                    print(f"  Page offset: {page_offset:+d} (TOC printed page {toc_printed} = PDF page {toc_pdf})")
        except json.JSONDecodeError:
            print(f"  Warning: Could not parse TOC response: {response_text[:200]}")

    # Fallback: auto-detect offset if TOC didn't provide it
    if page_offset is None:
        page_offset = detect_page_offset(pdf_path, temp_dir)

    # Deduplicate articles by magazine_page
    seen_pages = set()
    unique_articles = []
    for a in all_articles:
        mp = a.get("magazine_page")
        if mp and mp not in seen_pages:
            seen_pages.add(mp)
            unique_articles.append(a)

    if unique_articles:
        print(f"  Found {len(unique_articles)} featured home articles in TOC")
        return unique_articles, page_offset
    else:
        print("  TOC read returned no articles, will use fallback")
        return [], page_offset


def _build_extraction_prompt(toc_hint=None):
    """Build the extraction prompt, optionally with TOC context."""
    prompt = EXTRACT_PROMPT
    if toc_hint:
        hint_text = f"\n\nContext from the table of contents: This article is titled \"{toc_hint.get('article_title', 'Unknown')}\"."
        if toc_hint.get("homeowner_hint"):
            hint_text += f" Description: {toc_hint['homeowner_hint']}"
        prompt = prompt + hint_text
    return prompt


def _call_extraction(pdf_path, pages, temp_dir, label, toc_hint=None):
    """Send specific pages to Claude for extraction. Returns parsed data or None."""
    article_dir = os.path.join(temp_dir, f"article_{label}")
    images = pdf_to_images(pdf_path, pages, article_dir)
    if not images:
        return None

    prompt = _build_extraction_prompt(toc_hint)
    response_text = call_claude_with_retry(prompt, images)

    try:
        data = parse_json_response(response_text)
        if data.get("skip"):
            return None
        # Clean up string "null" → actual None
        for key in data:
            if data[key] == "null" or data[key] == "None":
                data[key] = None
        return data
    except json.JSONDecodeError:
        return None


def extract_article_data(pdf_path, page_number, temp_dir, toc_hint=None):
    """Extract featured home data from a specific article page.

    Sends 3 pages (target + next 2) for context. If homeowner_name comes back
    NULL, retries with expanded page range (±3 pages around target).

    Args:
        toc_hint: dict with article_title and homeowner_hint from TOC step
    """
    # Primary attempt: target page + next 2 pages for article opening context
    primary_pages = [p for p in [page_number, page_number + 1, page_number + 2] if p > 0]
    data = _call_extraction(pdf_path, primary_pages, temp_dir, f"{page_number}", toc_hint)

    if not data:
        return None

    data["page_number"] = page_number

    # Fill in article_title from TOC if Claude didn't find it on the page
    if not data.get("article_title") and toc_hint:
        data["article_title"] = toc_hint.get("article_title")

    # If homeowner_name is still NULL, retry with expanded page range
    if not data.get("homeowner_name"):
        print(f"    Homeowner NULL, retrying with expanded page range...")
        time.sleep(2)

        # Try pages before the target (article opening may be 1-3 pages earlier)
        expanded_pages = [p for p in range(max(1, page_number - 3), page_number + 4) if p > 0]
        retry_data = _call_extraction(pdf_path, expanded_pages, temp_dir, f"{page_number}_retry", toc_hint)

        if retry_data and retry_data.get("homeowner_name"):
            print(f"    Retry found: {retry_data['homeowner_name']}")
            # Merge: use retry data but keep any non-null fields from original
            for key, val in data.items():
                if val is not None and retry_data.get(key) is None:
                    retry_data[key] = val
            retry_data["page_number"] = page_number
            if not retry_data.get("article_title") and toc_hint:
                retry_data["article_title"] = toc_hint.get("article_title")
            return retry_data

    return data


def process_issue(issue):
    """Process a single issue: verify date, find articles from TOC, then extract each one."""
    identifier = issue["identifier"]
    pdf_path = issue.get("pdf_path")

    if not pdf_path or not os.path.exists(pdf_path):
        print(f"  PDF not found for {identifier}")
        return None

    output_path = os.path.join(EXTRACTIONS_DIR, f"{identifier}.json")
    if os.path.exists(output_path):
        print(f"  Already extracted: {identifier}")
        return output_path

    month = issue.get("month", "?")
    month_str = f"{month:02d}" if isinstance(month, int) else str(month)
    print(f"\nProcessing: {issue['title']} (estimated {issue.get('year')}-{month_str})")

    with tempfile.TemporaryDirectory() as temp_dir:
        # Step 0: Verify actual publication date from cover
        verified_month, verified_year = verify_date(pdf_path, temp_dir)

        # Update issue with confirmed date (in Supabase)
        if verified_year or verified_month:
            try:
                from db import update_issue
                updates = {}
                if verified_year:
                    updates["verified_year"] = verified_year
                    updates["year"] = verified_year
                if verified_month:
                    updates["verified_month"] = verified_month
                    updates["month"] = verified_month
                update_issue(identifier, updates)
            except Exception:
                pass
            if verified_year:
                issue["verified_year"] = verified_year
            if verified_month:
                issue["verified_month"] = verified_month

        actual_year = verified_year or issue.get("year")
        actual_month = verified_month or issue.get("month")

        # Skip pre-1988 issues
        if actual_year and actual_year < MIN_YEAR:
            print(f"  Skipping: confirmed year {actual_year} is before {MIN_YEAR}")
            issue["status"] = "skipped_pre1988"
            try:
                from db import update_issue as _update_issue
                _update_issue(identifier, {"status": "skipped_pre1988"})
            except Exception:
                pass
            # Save a minimal extraction file so we don't re-process
            os.makedirs(EXTRACTIONS_DIR, exist_ok=True)
            with open(output_path, "w") as f:
                json.dump({
                    "identifier": identifier,
                    "title": issue["title"],
                    "month": actual_month,
                    "year": actual_year,
                    "verified_month": verified_month,
                    "verified_year": verified_year,
                    "skipped": True,
                    "skip_reason": f"pre-{MIN_YEAR}",
                    "toc_articles": [],
                    "features": [],
                }, f, indent=2)
            return output_path

        # Step 1: Find articles from TOC and determine page offset
        articles, page_offset = find_articles_from_toc(pdf_path, temp_dir)
        fallback_articles = None

        if not articles:
            # Get total page count for smarter scanning
            try:
                result = subprocess.run(
                    ["pdfinfo", pdf_path], capture_output=True, text=True
                )
                total_pages = 100  # default
                for line in result.stdout.split("\n"):
                    if line.startswith("Pages:"):
                        total_pages = int(line.split(":")[1].strip())
                        break
            except Exception:
                total_pages = 100

            # Scan every 5 pages through the main article section
            # Start at page 30 (past ads/front matter), go to near the end
            scan_start = 30
            scan_end = min(total_pages - 5, 200)
            print(f"  No articles found from TOC, scanning every 5 pages ({scan_start}-{scan_end})")
            articles = [{"magazine_page": p, "article_title": "Unknown", "homeowner_hint": ""}
                       for p in range(scan_start, scan_end, 5)]
            fallback_articles = articles  # Mark these as fallback (no supplemental scanning needed)
            # page_offset already set from detect_page_offset or 0

        # Step 2: Extract data from each article
        features = []
        for article in articles:
            mag_page = article.get("magazine_page") or article.get("page_number")
            if not mag_page:
                continue

            # Convert magazine page to PDF page using offset
            pdf_page = mag_page + page_offset
            if pdf_page < 1:
                print(f"  Skipping magazine page {mag_page}: PDF page {pdf_page} is invalid")
                continue

            print(f"  Extracting magazine page {mag_page} (PDF page {pdf_page}): {article.get('article_title', 'Unknown')}")
            time.sleep(2)  # Rate limiting for Claude API

            try:
                data = extract_article_data(pdf_path, pdf_page, temp_dir, toc_hint=article)
                if data:
                    data["magazine_page"] = mag_page
                    features.append(data)
                    print(f"    Found: {data.get('homeowner_name', 'Unknown homeowner')}")
            except Exception as e:
                print(f"    Error extracting page {mag_page}: {e}")
                continue

    # If too few features found from TOC, supplement with page scanning
    if len(features) < MIN_FEATURES_PER_ISSUE and articles != fallback_articles:
        print(f"  Only {len(features)} features found (minimum {MIN_FEATURES_PER_ISSUE}), supplementing with page scanning...")
        existing_pages = {f.get("page_number") for f in features}

        try:
            result_info = subprocess.run(["pdfinfo", pdf_path], capture_output=True, text=True)
            total_pages = 100
            for line in result_info.stdout.split("\n"):
                if line.startswith("Pages:"):
                    total_pages = int(line.split(":")[1].strip())
                    break
        except Exception:
            total_pages = 100

        scan_start = 30
        scan_end = min(total_pages - 5, 200)
        for p in range(scan_start, scan_end, 8):
            pdf_page = p + page_offset
            if pdf_page < 1 or pdf_page in existing_pages:
                continue
            # Skip if within 3 pages of an existing feature
            if any(abs(pdf_page - ep) < 4 for ep in existing_pages):
                continue

            print(f"  Scanning PDF page {pdf_page} for additional features...")
            time.sleep(2)
            try:
                data = extract_article_data(pdf_path, pdf_page, temp_dir)
                if data and data.get("homeowner_name"):
                    data["magazine_page"] = p
                    features.append(data)
                    existing_pages.add(pdf_page)
                    print(f"    Found: {data.get('homeowner_name')}")
                    if len(features) >= MIN_FEATURES_PER_ISSUE:
                        break
            except Exception as e:
                print(f"    Error scanning page {pdf_page}: {e}")
                continue

    # Save results with verified date
    result = {
        "identifier": identifier,
        "title": issue["title"],
        "month": actual_month,
        "year": actual_year,
        "verified_month": verified_month,
        "verified_year": verified_year,
        "toc_articles": articles,
        "features": features,
    }

    os.makedirs(EXTRACTIONS_DIR, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"  Saved {len(features)} features to {output_path}")
    return output_path


# ── Re-Extraction Strategies ────────────────────────────────────────

REEXTRACT_STRATEGIES = {
    "default":      {"toc_pages": (1, 20), "scan_start": 30, "scan_interval": 5, "skip_toc": False, "toc_end": 20},
    "wider_scan":   {"toc_pages": (1, 20), "scan_start": 20, "scan_interval": 3, "skip_toc": False, "toc_end": 20},
    "extended_toc": {"toc_pages": (1, 30), "scan_start": 20, "scan_interval": 3, "skip_toc": False, "toc_end": 30},
    "full_scan":    {"toc_pages": None,    "scan_start": 20, "scan_interval": 3, "skip_toc": True,  "toc_end": 0},
}


def process_issue_reextract(issue, strategy="wider_scan"):
    """Re-extract an issue using a specified strategy.

    Reuses existing helpers (verify_date, find_articles_from_toc, extract_article_data,
    detect_page_offset) but with strategy-specific parameters for broader coverage.

    Strategies:
        default      — Same as process_issue() (TOC 1-20, scan every 5 from 30)
        wider_scan   — Normal TOC first, then scan every 3 pages from page 20
        extended_toc — Read TOC from pages 1-30, scan every 3 from page 20
        full_scan    — Skip TOC entirely, scan every 3 pages from page 20

    Returns output_path on success, None on failure.
    """
    params = REEXTRACT_STRATEGIES.get(strategy)
    if not params:
        print(f"  Unknown re-extraction strategy: {strategy}")
        return None

    identifier = issue["identifier"]
    pdf_path = issue.get("pdf_path")

    if not pdf_path or not os.path.exists(pdf_path):
        print(f"  PDF not found for {identifier}")
        return None

    output_path = os.path.join(EXTRACTIONS_DIR, f"{identifier}.json")

    month = issue.get("month", "?")
    month_str = f"{month:02d}" if isinstance(month, int) else str(month)
    print(f"\nRe-extracting ({strategy}): {issue.get('title', identifier)} (estimated {issue.get('year')}-{month_str})")

    with tempfile.TemporaryDirectory() as temp_dir:
        # Step 0: Verify actual publication date from cover
        verified_month, verified_year = verify_date(pdf_path, temp_dir)

        if verified_year:
            issue["verified_year"] = verified_year
        if verified_month:
            issue["verified_month"] = verified_month

        actual_year = verified_year or issue.get("year")
        actual_month = verified_month or issue.get("month")

        # Skip pre-1988 issues
        if actual_year and actual_year < MIN_YEAR:
            print(f"  Skipping: confirmed year {actual_year} is before {MIN_YEAR}")
            issue["status"] = "skipped_pre1988"
            try:
                from db import update_issue as _update_issue
                _update_issue(identifier, {"status": "skipped_pre1988"})
            except Exception:
                pass
            os.makedirs(EXTRACTIONS_DIR, exist_ok=True)
            with open(output_path, "w") as f:
                json.dump({
                    "identifier": identifier,
                    "title": issue.get("title", identifier),
                    "month": actual_month, "year": actual_year,
                    "verified_month": verified_month, "verified_year": verified_year,
                    "skipped": True, "skip_reason": f"pre-{MIN_YEAR}",
                    "toc_articles": [], "features": [],
                    "reextraction_strategy": strategy,
                }, f, indent=2)
            return output_path

        # Step 1: Find articles (strategy-dependent)
        articles = []
        page_offset = 0

        if not params["skip_toc"]:
            # Use TOC with strategy-specific page range, sent in batches of 10
            toc_first, toc_last = params["toc_pages"]
            batch_size = 10
            for b_start in range(toc_first, toc_last + 1, batch_size):
                b_end = min(b_start + batch_size - 1, toc_last)
                print(f"  Extracting TOC pages ({b_start}-{b_end})...")
                toc_images = pdf_to_images(pdf_path, (b_start, b_end), os.path.join(temp_dir, f"toc_{b_start}"))

                if not toc_images:
                    continue

                print(f"  Sending {len(toc_images)} TOC pages to Claude...")
                response_text = call_claude_with_retry(TOC_PROMPT, toc_images)
                try:
                    data = parse_json_response(response_text)
                    batch_articles = data.get("articles", [])
                    articles.extend(batch_articles)
                    if page_offset == 0:
                        toc_printed = data.get("toc_printed_page")
                        toc_pdf = data.get("toc_pdf_page")
                        if toc_printed and toc_pdf:
                            page_offset = toc_pdf - toc_printed
                            print(f"  Page offset: {page_offset:+d}")
                except json.JSONDecodeError:
                    print(f"  Warning: Could not parse TOC response")

            if page_offset == 0:
                page_offset = detect_page_offset(pdf_path, temp_dir)
            if articles:
                # Deduplicate by magazine_page
                seen = set()
                unique = []
                for a in articles:
                    mp = a.get("magazine_page")
                    if mp and mp not in seen:
                        seen.add(mp)
                        unique.append(a)
                articles = unique
                print(f"  Found {len(articles)} featured home articles in TOC")
        else:
            # Full scan — skip TOC, auto-detect offset
            page_offset = detect_page_offset(pdf_path, temp_dir)
            print(f"  Full scan mode — skipping TOC, offset: {page_offset:+d}")

        # Step 1b: If no articles from TOC (or skip_toc), use fallback scanning
        if not articles:
            try:
                result = subprocess.run(["pdfinfo", pdf_path], capture_output=True, text=True)
                total_pages = 100
                for line in result.stdout.split("\n"):
                    if line.startswith("Pages:"):
                        total_pages = int(line.split(":")[1].strip())
                        break
            except Exception:
                total_pages = 100

            scan_start = params["scan_start"]
            scan_end = min(total_pages - 5, 200)
            scan_interval = params["scan_interval"]
            print(f"  Scanning every {scan_interval} pages ({scan_start}-{scan_end})")
            articles = [{"magazine_page": p, "article_title": "Unknown", "homeowner_hint": ""}
                       for p in range(scan_start, scan_end, scan_interval)]

        # Step 2: Extract data from each article
        features = []
        for article in articles:
            mag_page = article.get("magazine_page") or article.get("page_number")
            if not mag_page:
                continue

            pdf_page = mag_page + page_offset
            if pdf_page < 1:
                continue

            print(f"  Extracting magazine page {mag_page} (PDF page {pdf_page}): {article.get('article_title', 'Unknown')}")
            time.sleep(2)

            try:
                data = extract_article_data(pdf_path, pdf_page, temp_dir, toc_hint=article)
                if data:
                    data["magazine_page"] = mag_page
                    features.append(data)
                    print(f"    Found: {data.get('homeowner_name', 'Unknown homeowner')}")
            except Exception as e:
                print(f"    Error extracting page {mag_page}: {e}")
                continue

    # Save results with strategy tag
    result = {
        "identifier": identifier,
        "title": issue.get("title", identifier),
        "month": actual_month,
        "year": actual_year,
        "verified_month": verified_month,
        "verified_year": verified_year,
        "toc_articles": articles,
        "features": features,
        "reextraction_strategy": strategy,
    }

    os.makedirs(EXTRACTIONS_DIR, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"  Re-extraction ({strategy}) saved {len(features)} features to {output_path}")
    return output_path


def find_issues_needing_reextraction():
    """Find extraction files that have NULL homeowner_names or too few features."""
    problem_issues = []
    if not os.path.exists(EXTRACTIONS_DIR):
        return problem_issues
    for f in os.listdir(EXTRACTIONS_DIR):
        if not f.endswith(".json"):
            continue
        with open(os.path.join(EXTRACTIONS_DIR, f)) as fh:
            data = json.load(fh)
        if data.get("skipped"):
            continue

        features = data.get("features", [])
        identifier = f.replace(".json", "")

        # Check for NULL homeowner_names
        has_nulls = any(
            not feat.get("homeowner_name") or feat.get("homeowner_name") in ("null", "None")
            for feat in features
        )

        # Check for too few features
        too_few = len(features) < MIN_FEATURES_PER_ISSUE

        if has_nulls or too_few:
            reason = []
            if has_nulls:
                reason.append("NULL homeowners")
            if too_few:
                reason.append(f"only {len(features)} features")
            problem_issues.append((identifier, ", ".join(reason)))

    return problem_issues


def extract_all(limit=None, identifier=None, reextract=False):
    """Process all downloaded issues or a specific one.

    Args:
        reextract: If True, re-process issues that have NULL homeowner_name values.
    """
    from db import list_issues, get_issue_by_identifier

    if reextract:
        # Find and re-extract issues with NULL results or too few features
        problem_issues = find_issues_needing_reextraction()
        if not problem_issues:
            print("No issues need re-extraction!")
            return
        print(f"Found {len(problem_issues)} issues needing re-extraction:")
        for pid, reason in problem_issues:
            print(f"  {pid}: {reason}")
        problem_ids = [pid for pid, _ in problem_issues]
        issues = [get_issue_by_identifier(pid) for pid in problem_ids]
        issues = [i for i in issues if i]  # Filter None
        # Delete old extraction files so they get re-processed
        for pid in problem_ids:
            old_path = os.path.join(EXTRACTIONS_DIR, f"{pid}.json")
            if os.path.exists(old_path):
                os.remove(old_path)
                print(f"  Removed old extraction: {pid}.json")
    elif identifier:
        issue = get_issue_by_identifier(identifier)
        if not issue:
            print(f"Issue {identifier} not found in Supabase")
            return
        issues = [issue]
    else:
        issues = list_issues(status="downloaded")
        # Sort newest first — modern issues are most relevant
        issues.sort(key=lambda x: (x.get("year") or 0, x.get("month") or 0), reverse=True)

    if limit and not reextract:
        # Skip already extracted
        issues = [i for i in issues
                  if not os.path.exists(os.path.join(EXTRACTIONS_DIR, f"{i['identifier']}.json"))]
        issues = issues[:limit]

    print(f"Processing {len(issues)} issues...")

    for issue in issues:
        process_issue(issue)

    print("\nExtraction complete!")


if __name__ == "__main__":
    limit = None
    identifier = None
    reextract = "--reextract" in sys.argv

    if "--limit" in sys.argv:
        idx = sys.argv.index("--limit")
        limit = int(sys.argv[idx + 1])
    if "--issue" in sys.argv:
        idx = sys.argv.index("--issue")
        identifier = sys.argv[idx + 1]

    extract_all(limit=limit, identifier=identifier, reextract=reextract)
