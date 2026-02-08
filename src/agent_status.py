"""
AD-Epstein Pipeline → Agent Office Status Adapter

Reads the pipeline state (manifest, downloads, extractions, cross-references)
and outputs a status.json matching the generic Agent Office schema.

Usage:
    python3 src/agent_status.py              # Generate status.json
    python3 src/agent_status.py --pretty     # Pretty-print output
    python3 src/agent_status.py --stdout     # Print to stdout instead of file
"""

import json
import os
import sys
from datetime import datetime

# Paths
BASE_DIR = os.path.join(os.path.dirname(__file__), "..")
DATA_DIR = os.path.join(BASE_DIR, "data")
MANIFEST_PATH = os.path.join(DATA_DIR, "archive_manifest.json")
ISSUES_DIR = os.path.join(DATA_DIR, "issues")
EXTRACTIONS_DIR = os.path.join(DATA_DIR, "extractions")
XREF_DIR = os.path.join(DATA_DIR, "cross_references")
OUTPUT_PATH = os.path.join(BASE_DIR, "tools", "agent-office", "status.json")


def count_downloads():
    """Count downloaded PDFs in issues directory."""
    if not os.path.exists(ISSUES_DIR):
        return 0
    return len([f for f in os.listdir(ISSUES_DIR) if f.endswith(".pdf")])


def read_manifest():
    """Read the archive manifest and return summary stats."""
    if not os.path.exists(MANIFEST_PATH):
        return {"total": 0, "downloaded": 0, "skipped": 0, "errors": 0, "no_pdf": 0}

    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)

    issues = manifest.get("issues", [])
    return {
        "total": len(issues),
        "downloaded": sum(1 for i in issues if i.get("status") == "downloaded"),
        "skipped": sum(1 for i in issues if i.get("status") == "skipped_pre1988"),
        "errors": sum(1 for i in issues if i.get("status") == "error"),
        "no_pdf": sum(1 for i in issues if i.get("status") == "no_pdf"),
    }


def read_extractions():
    """Read extraction results and return summary."""
    if not os.path.exists(EXTRACTIONS_DIR):
        return {"extracted": 0, "skipped": 0, "features": 0, "nulls": 0}

    extracted = 0
    skipped = 0
    features = 0
    nulls = 0

    for fname in os.listdir(EXTRACTIONS_DIR):
        if not fname.endswith(".json"):
            continue
        with open(os.path.join(EXTRACTIONS_DIR, fname)) as f:
            data = json.load(f)
        if data.get("skipped"):
            skipped += 1
        else:
            extracted += 1
            for feat in data.get("features", []):
                features += 1
                if not feat.get("homeowner_name"):
                    nulls += 1

    return {"extracted": extracted, "skipped": skipped, "features": features, "nulls": nulls}


def read_xref():
    """Read cross-reference results and return summary."""
    if not os.path.exists(XREF_DIR):
        return {"checked": 0, "matches": 0}

    matches = 0
    checked = 0
    for fname in os.listdir(XREF_DIR):
        if not fname.endswith(".json"):
            continue
        checked += 1
        with open(os.path.join(XREF_DIR, fname)) as f:
            data = json.load(f)
        if data.get("black_book_match") or data.get("doj_match"):
            matches += 1

    return {"checked": checked, "matches": matches}


def determine_agent_status(current, total, has_data):
    """Determine agent status based on progress."""
    if not has_data:
        return "idle"
    if current >= total and total > 0:
        return "done"
    if current > 0:
        return "working"
    return "idle"


def build_log(manifest_stats, extraction_stats, xref_stats):
    """Build a recent activity log from available data."""
    log = []
    now = datetime.now().strftime("%H:%M")

    if manifest_stats["total"] > 0:
        log.append({
            "time": now,
            "agent": "Scout",
            "event": f"Tracking {manifest_stats['total']} issues from archive.org"
        })

    if manifest_stats["downloaded"] > 0:
        log.append({
            "time": now,
            "agent": "Courier",
            "event": f"{manifest_stats['downloaded']} PDFs downloaded"
        })

    if manifest_stats["skipped"] > 0:
        log.append({
            "time": now,
            "agent": "Courier",
            "event": f"{manifest_stats['skipped']} issues skipped (pre-1988)"
        })

    if extraction_stats["extracted"] > 0:
        log.append({
            "time": now,
            "agent": "Reader",
            "event": f"Extracted {extraction_stats['features']} features from {extraction_stats['extracted']} issues"
        })

    if extraction_stats["nulls"] > 0:
        log.append({
            "time": now,
            "agent": "Reader",
            "event": f"{extraction_stats['nulls']} features still missing homeowner names"
        })

    if xref_stats["checked"] > 0:
        log.append({
            "time": now,
            "agent": "Detective",
            "event": f"Checked {xref_stats['checked']} names, found {xref_stats['matches']} matches"
        })

    return log


def generate_status():
    """Generate the full status JSON."""
    manifest_stats = read_manifest()
    extraction_stats = read_extractions()
    xref_stats = read_xref()
    download_count = count_downloads()

    # Determine statuses
    scout_status = "done" if manifest_stats["total"] > 0 else "idle"
    courier_status = determine_agent_status(
        manifest_stats["downloaded"], manifest_stats["total"],
        manifest_stats["total"] > 0
    )
    reader_status = determine_agent_status(
        extraction_stats["extracted"], manifest_stats["downloaded"],
        manifest_stats["downloaded"] > 0
    )
    detective_status = determine_agent_status(
        xref_stats["checked"], extraction_stats["features"],
        extraction_stats["features"] > 0
    )

    # Scout message
    if manifest_stats["total"] > 0:
        scout_msg = f"Found {manifest_stats['total']} issues on archive.org"
    else:
        scout_msg = "Ready to search archive.org"

    # Courier message
    if manifest_stats["downloaded"] > 0:
        courier_msg = f"Downloaded {manifest_stats['downloaded']} of {manifest_stats['total']} PDFs"
    else:
        courier_msg = "Waiting for discovery..."

    # Reader message
    if extraction_stats["extracted"] > 0:
        courier_done = manifest_stats["downloaded"]
        reader_msg = f"Extracted {extraction_stats['features']} features from {extraction_stats['extracted']}/{courier_done} issues"
    else:
        reader_msg = "Waiting for downloads..."

    # Detective message
    if xref_stats["matches"] > 0:
        detective_msg = f"{xref_stats['matches']} match(es) found in {xref_stats['checked']} names checked"
    elif xref_stats["checked"] > 0:
        detective_msg = f"No matches yet ({xref_stats['checked']} names checked)"
    else:
        detective_msg = "Waiting for extracted names..."

    status = {
        "title": "AD-EPSTEIN INDEX \u2014 AGENT OFFICE",
        "subtitle": "Architectural Digest research pipeline",
        "timestamp": datetime.now().isoformat(),
        "agents": [
            {
                "id": "scout",
                "name": "Scout",
                "role": "Discovers AD issues on archive.org",
                "status": scout_status,
                "message": scout_msg,
                "color": "#e74c3c",
                "deskItems": ["magnifier", "globe"],
                "progress": {"current": manifest_stats["total"], "total": manifest_stats["total"]}
            },
            {
                "id": "courier",
                "name": "Courier",
                "role": "Downloads & delivers PDFs",
                "status": courier_status,
                "message": courier_msg,
                "color": "#3498db",
                "deskItems": ["folder", "document"],
                "progress": {"current": manifest_stats["downloaded"], "total": manifest_stats["total"]}
            },
            {
                "id": "reader",
                "name": "Reader",
                "role": "Extracts homeowners & data",
                "status": reader_status,
                "message": reader_msg,
                "color": "#2ecc71",
                "deskItems": ["book", "pencil"],
                "progress": {"current": extraction_stats["extracted"], "total": manifest_stats["downloaded"]}
            },
            {
                "id": "detective",
                "name": "Detective",
                "role": "Cross-refs against Epstein docs",
                "status": detective_status,
                "message": detective_msg,
                "color": "#9b59b6",
                "deskItems": ["detective-hat", "clipboard"],
                "progress": {"current": xref_stats["checked"], "total": extraction_stats["features"]}
            }
        ],
        "stats": [
            {"label": "Discovered", "value": manifest_stats["total"]},
            {"label": "Downloaded", "value": manifest_stats["downloaded"]},
            {"label": "Extracted", "value": extraction_stats["extracted"]},
            {"label": "Features", "value": extraction_stats["features"]},
            {"label": "XRef Matches", "value": xref_stats["matches"]}
        ],
        "log": build_log(manifest_stats, extraction_stats, xref_stats)
    }

    return status


def main():
    pretty = "--pretty" in sys.argv
    to_stdout = "--stdout" in sys.argv

    status = generate_status()
    output = json.dumps(status, indent=2 if pretty else None)

    if to_stdout:
        print(output)
    else:
        os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
        with open(OUTPUT_PATH, "w") as f:
            f.write(output)
        print(f"Status written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
