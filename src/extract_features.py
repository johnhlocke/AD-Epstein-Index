"""
Step 3: Extract featured home data from AD magazine PDFs using Gemini Vision.

For each PDF:
1. Convert first ~10 pages to images (covers + table of contents)
2. Send TOC pages to Gemini Vision to identify featured home articles
3. Convert article opening pages to images
4. Send each article page to Gemini Vision for structured data extraction
5. Save results as JSON

Usage:
    python3 src/extract_features.py                          # Process all downloaded PDFs
    python3 src/extract_features.py --issue <identifier>     # Process one specific issue
    python3 src/extract_features.py --limit 1                # Process first N unprocessed issues
"""

import json
import os
import sys
import subprocess
import tempfile
import time
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
MANIFEST_PATH = os.path.join(DATA_DIR, "archive_manifest.json")
EXTRACTIONS_DIR = os.path.join(DATA_DIR, "extractions")
ISSUES_DIR = os.path.join(DATA_DIR, "issues")

# Configure Gemini client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL = "gemini-2.0-flash"

# Retry settings for rate limits
MAX_RETRIES = 5
INITIAL_RETRY_DELAY = 15  # seconds

TOC_PROMPT = """You are analyzing the table of contents / first pages of an Architectural Digest magazine issue.

Identify ALL featured home/residence articles in this issue. These are full-length articles about specific homes,
NOT ads, NOT columns, NOT product roundups, NOT "AD visits" short pieces.

Look for articles that feature a specific person's home with interior/architectural coverage.

Return a JSON array of objects with these fields:
- "article_title": the title of the article
- "page_number": the starting page number
- "homeowner_hint": any name or description visible (e.g., "A Designer's Paris Apartment")

Return ONLY valid JSON, no markdown code blocks, no explanation. Example:
[{"article_title": "High Spirits", "page_number": 116, "homeowner_hint": "Michele Pitcher's Mexican villa"}]

If you cannot identify any featured home articles, return an empty array: []
"""

EXTRACT_PROMPT = """You are extracting data from an Architectural Digest magazine article about a featured home.

Look at this magazine page and extract the following information. Use null for any field you cannot determine from this page.

Return a JSON object with these fields:
- "article_title": the title of the article
- "homeowner_name": the name of the person(s) whose home is featured
- "designer_name": the interior designer
- "architecture_firm": the architect or architecture firm
- "year_built": year the home was built or renovated (integer or null)
- "square_footage": size in square feet (integer or null)
- "cost": cost as a string (e.g., "$2.5 million") or null
- "location_city": city name
- "location_state": state (US) or province
- "location_country": country
- "design_style": architectural/design style (e.g., "Mid-Century Modern", "Mediterranean")
- "page_number": the page number visible on this page (integer)
- "notes": any other notable details

Return ONLY valid JSON, no markdown code blocks, no explanation.
If this page is NOT a featured home article (e.g., it's an ad or editorial), return: {"skip": true}
"""


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

    if isinstance(pages, tuple) and len(pages) == 2:
        # Range of pages
        first, last = pages
        prefix = os.path.join(output_dir, "page")
        subprocess.run(
            ["pdftoppm", "-png", "-f", str(first), "-l", str(last), "-r", "150", pdf_path, prefix],
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
                ["pdftoppm", "-png", "-f", str(page_num), "-l", str(page_num), "-r", "150", pdf_path, prefix],
                check=True, capture_output=True,
            )
            for f in sorted(os.listdir(output_dir)):
                fpath = os.path.join(output_dir, f)
                if f.startswith(f"p{page_num:04d}") and f.endswith(".png") and fpath not in image_paths:
                    image_paths.append(fpath)

    return image_paths


def make_image_part(image_path):
    """Read an image file and return a Gemini Part for inline sending."""
    with open(image_path, "rb") as f:
        data = f.read()
    return types.Part.from_bytes(data=data, mime_type="image/png")


def call_gemini_with_retry(contents):
    """Call Gemini API with exponential backoff retry on rate limits."""
    delay = INITIAL_RETRY_DELAY
    for attempt in range(MAX_RETRIES):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=contents,
                config=types.GenerateContentConfig(temperature=0.1),
            )
            return response
        except Exception as e:
            error_str = str(e)
            if "429" in error_str or "ResourceExhausted" in error_str or "quota" in error_str.lower():
                if attempt < MAX_RETRIES - 1:
                    print(f"    Rate limited, waiting {delay}s (attempt {attempt + 1}/{MAX_RETRIES})...")
                    time.sleep(delay)
                    delay *= 2  # Exponential backoff
                else:
                    print(f"    Rate limit exceeded after {MAX_RETRIES} attempts. Skipping.")
                    raise
            else:
                raise


def parse_json_response(text):
    """Parse JSON from Gemini response, stripping markdown code blocks if present."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    return json.loads(text)


def find_articles_from_toc(pdf_path, temp_dir):
    """Extract TOC pages and identify featured home articles."""
    print("  Extracting TOC pages (1-12)...")
    toc_images = pdf_to_images(pdf_path, (1, 12), os.path.join(temp_dir, "toc"))

    if not toc_images:
        print("  Warning: No TOC images extracted")
        return []

    print(f"  Sending {len(toc_images)} TOC pages to Gemini...")

    # Build content with inline images (no file upload needed)
    parts = [TOC_PROMPT] + [make_image_part(img) for img in toc_images]

    response = call_gemini_with_retry(parts)

    try:
        articles = parse_json_response(response.text)
        print(f"  Found {len(articles)} featured home articles in TOC")
        return articles
    except json.JSONDecodeError:
        print(f"  Warning: Could not parse TOC response: {response.text[:200]}")
        return []


def extract_article_data(pdf_path, page_number, temp_dir):
    """Extract featured home data from a specific article page."""
    # Convert the article's opening page (and the next page for more context)
    pages_to_check = [page_number, page_number + 1]
    article_dir = os.path.join(temp_dir, f"article_{page_number}")
    images = pdf_to_images(pdf_path, pages_to_check, article_dir)

    if not images:
        return None

    parts = [EXTRACT_PROMPT] + [make_image_part(img) for img in images]

    response = call_gemini_with_retry(parts)

    try:
        data = parse_json_response(response.text)
        if data.get("skip"):
            return None
        data["page_number"] = page_number
        return data
    except json.JSONDecodeError:
        print(f"    Warning: Could not parse extraction for page {page_number}: {response.text[:200]}")
        return None


def process_issue(issue):
    """Process a single issue: find articles from TOC, then extract each one."""
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
    print(f"\nProcessing: {issue['title']} ({issue.get('year')}-{month_str})")

    with tempfile.TemporaryDirectory() as temp_dir:
        # Step 1: Find articles from TOC
        articles = find_articles_from_toc(pdf_path, temp_dir)

        if not articles:
            print("  No articles found, trying fallback: scanning pages 80-180")
            # Fallback: scan common article page ranges
            articles = [{"page_number": p, "article_title": "Unknown", "homeowner_hint": ""}
                       for p in range(100, 180, 10)]

        # Step 2: Extract data from each article
        features = []
        for article in articles:
            page = article.get("page_number")
            if not page:
                continue

            print(f"  Extracting page {page}: {article.get('article_title', 'Unknown')}")
            time.sleep(2)  # Rate limiting for Gemini API

            try:
                data = extract_article_data(pdf_path, page, temp_dir)
                if data:
                    features.append(data)
                    print(f"    Found: {data.get('homeowner_name', 'Unknown homeowner')}")
            except Exception as e:
                print(f"    Error extracting page {page}: {e}")
                continue

    # Save results
    result = {
        "identifier": identifier,
        "title": issue["title"],
        "month": issue.get("month"),
        "year": issue.get("year"),
        "toc_articles": articles,
        "features": features,
    }

    os.makedirs(EXTRACTIONS_DIR, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"  Saved {len(features)} features to {output_path}")
    return output_path


def extract_all(limit=None, identifier=None):
    """Process all downloaded issues or a specific one."""
    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)

    if identifier:
        issues = [i for i in manifest["issues"] if i["identifier"] == identifier]
        if not issues:
            print(f"Issue {identifier} not found in manifest")
            return
    else:
        issues = [i for i in manifest["issues"] if i.get("status") == "downloaded"]
        # Sort newest first — modern issues are most relevant
        issues.sort(key=lambda x: (x.get("year") or 0, x.get("month") or 0), reverse=True)

    if limit:
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

    if "--limit" in sys.argv:
        idx = sys.argv.index("--limit")
        limit = int(sys.argv[idx + 1])
    if "--issue" in sys.argv:
        idx = sys.argv.index("--issue")
        identifier = sys.argv[idx + 1]

    extract_all(limit=limit, identifier=identifier)
