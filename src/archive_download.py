"""
Step 2: Download AD magazine PDFs from the Internet Archive.

Reads the manifest from Step 1, fetches metadata for each item to find
the PDF file, and downloads it locally with rate limiting and resume support.

Usage:
    python3 src/archive_download.py              # Download all
    python3 src/archive_download.py --limit 3    # Download first 3 only
"""

import json
import os
import sys
import time
import requests

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
MANIFEST_PATH = os.path.join(DATA_DIR, "archive_manifest.json")
ISSUES_DIR = os.path.join(DATA_DIR, "issues")
METADATA_URL = "https://archive.org/metadata/{identifier}/files"
DOWNLOAD_URL = "https://archive.org/download/{identifier}/{filename}"
DELAY_SECONDS = 2

HEADERS = {
    "User-Agent": "AD-Epstein-Index-Research/1.0 (academic research project)"
}


def find_pdf_file(files):
    """Find the best PDF file from an item's file list."""
    # Prefer "Text PDF" format (searchable)
    for f in files:
        if f.get("format") == "Text PDF":
            return f["name"]

    # Fallback: any .pdf file, preferring the largest one
    pdfs = [f for f in files if f.get("name", "").lower().endswith(".pdf")]
    if pdfs:
        pdfs.sort(key=lambda f: int(f.get("size", 0)), reverse=True)
        return pdfs[0]["name"]

    return None


def download_file(url, dest_path):
    """Download a file with progress indication."""
    response = requests.get(url, headers=HEADERS, stream=True)
    response.raise_for_status()

    total = int(response.headers.get("content-length", 0))
    downloaded = 0

    with open(dest_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
            downloaded += len(chunk)
            if total:
                pct = downloaded * 100 // total
                print(f"\r  Downloading: {pct}% ({downloaded // 1024 // 1024}MB)", end="", flush=True)
    print()


def download_issues(limit=None):
    """Download PDFs for all issues in the manifest."""
    if not os.path.exists(MANIFEST_PATH):
        print("No manifest found. Run archive_discovery.py first.")
        return

    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)

    os.makedirs(ISSUES_DIR, exist_ok=True)

    issues = manifest["issues"]
    # Only process issues with month/year parsed, prioritize modern issues
    downloadable = [i for i in issues if i.get("month") and i.get("year")]
    # Sort newest first — modern issues (1990+) are most relevant for Epstein cross-referencing
    downloadable.sort(key=lambda x: (x["year"], x["month"]), reverse=True)

    if limit:
        downloadable = downloadable[:limit]

    print(f"Downloading {len(downloadable)} issues...")
    downloaded_count = 0
    skipped_count = 0
    failed_count = 0

    for idx, issue in enumerate(downloadable):
        identifier = issue["identifier"]
        month = issue["month"]
        year = issue["year"]
        filename_base = f"{year}_{month:02d}_{identifier}"

        # Check if already downloaded
        existing = [f for f in os.listdir(ISSUES_DIR) if f.startswith(filename_base)]
        if existing:
            print(f"[{idx+1}/{len(downloadable)}] Skipping {issue['title']} (already downloaded)")
            issue["status"] = "downloaded"
            issue["pdf_path"] = os.path.join(ISSUES_DIR, existing[0])
            skipped_count += 1
            continue

        print(f"[{idx+1}/{len(downloadable)}] {issue['title']}")

        try:
            # Fetch file metadata
            meta_url = METADATA_URL.format(identifier=identifier)
            meta_resp = requests.get(meta_url, headers=HEADERS)
            meta_resp.raise_for_status()
            files = meta_resp.json().get("result", [])

            # Find PDF
            pdf_name = find_pdf_file(files)
            if not pdf_name:
                print(f"  No PDF found for {identifier}")
                issue["status"] = "no_pdf"
                failed_count += 1
                time.sleep(DELAY_SECONDS)
                continue

            # Download
            dl_url = DOWNLOAD_URL.format(identifier=identifier, filename=pdf_name)
            ext = os.path.splitext(pdf_name)[1] or ".pdf"
            dest = os.path.join(ISSUES_DIR, f"{filename_base}{ext}")

            download_file(dl_url, dest)

            issue["status"] = "downloaded"
            issue["pdf_path"] = dest
            downloaded_count += 1

        except Exception as e:
            print(f"  Error: {e}")
            issue["status"] = "error"
            failed_count += 1

        time.sleep(DELAY_SECONDS)

    # Save updated manifest
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nDone! Downloaded: {downloaded_count}, Skipped: {skipped_count}, Failed: {failed_count}")


if __name__ == "__main__":
    limit = None
    if "--limit" in sys.argv:
        idx = sys.argv.index("--limit")
        limit = int(sys.argv[idx + 1])
    download_issues(limit=limit)
