"""
Shared database module — single source of truth for all pipeline agents.

All agents import from here instead of creating their own Supabase clients.
Replaces the local archive_manifest.json with Supabase issues table queries.

Usage:
    from db import get_supabase, list_issues, update_issue, get_or_create_issue
"""

import json
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# Singleton client
_supabase = None


def get_supabase():
    """Return a singleton Supabase client."""
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
        _supabase = create_client(url, key)
    return _supabase


# ── Issue Operations ─────────────────────────────────────────


def get_issue_by_identifier(identifier):
    """Fetch a single issue by its archive.org identifier. Returns dict or None."""
    sb = get_supabase()
    result = sb.table("issues").select("*").eq("identifier", identifier).execute()
    return result.data[0] if result.data else None


def get_issue_by_id(issue_id):
    """Fetch a single issue by its numeric ID. Returns dict or None."""
    sb = get_supabase()
    result = sb.table("issues").select("*").eq("id", issue_id).execute()
    return result.data[0] if result.data else None


def get_or_create_issue(month, year, **extra):
    """Get existing issue by (month, year) or create a new one. Returns the issue ID.

    Extra kwargs are set on the issue if creating (e.g., identifier, title, status).
    """
    sb = get_supabase()

    # Check if issue already exists by (month, year)
    query = sb.table("issues").select("id").eq("year", year)
    if month is not None:
        query = query.eq("month", month)
    else:
        query = query.is_("month", "null")
    existing = query.execute()

    if existing.data:
        return existing.data[0]["id"]

    # Create new issue
    issue_data = {"year": year}
    if month is not None:
        issue_data["month"] = month
    issue_data.update(extra)

    result = sb.table("issues").insert(issue_data).execute()
    return result.data[0]["id"]


def upsert_issue(identifier, data):
    """Upsert an issue by identifier. Used by Scout for discovery.

    If the identifier exists, updates the row. Otherwise inserts a new row.
    Returns the upserted row dict.
    """
    sb = get_supabase()

    existing = sb.table("issues").select("id").eq("identifier", identifier).execute()

    if existing.data:
        # Update existing row
        issue_id = existing.data[0]["id"]
        result = sb.table("issues").update(data).eq("id", issue_id).execute()
        return result.data[0] if result.data else None
    else:
        # Insert new row
        data["identifier"] = identifier
        result = sb.table("issues").insert(data).execute()
        return result.data[0] if result.data else None


def update_issue(identifier, updates):
    """Update an issue's fields by identifier. Used for status transitions.

    Args:
        identifier: The archive.org identifier string
        updates: Dict of fields to update (e.g., {"status": "downloaded", "pdf_path": "/..."})
    """
    sb = get_supabase()
    result = sb.table("issues").update(updates).eq("identifier", identifier).execute()
    return result.data[0] if result.data else None


def update_issue_by_id(issue_id, updates):
    """Update an issue's fields by numeric ID.

    Args:
        issue_id: The issue's numeric primary key
        updates: Dict of fields to update
    """
    sb = get_supabase()
    result = sb.table("issues").update(updates).eq("id", issue_id).execute()
    return result.data[0] if result.data else None


def list_issues(status=None, min_year=None, source=None):
    """List issues from Supabase, optionally filtered.

    Args:
        status: Filter by status string (e.g., "downloaded", "discovered")
        min_year: Only return issues with year >= min_year
        source: Filter by source (e.g., "archive.org", "ad_archive")

    Returns:
        List of issue dicts.
    """
    sb = get_supabase()
    query = sb.table("issues").select("*")

    if status is not None:
        query = query.eq("status", status)
    if min_year is not None:
        query = query.gte("year", min_year)
    if source is not None:
        query = query.eq("source", source)

    result = query.order("year", desc=True).order("month", desc=True).execute()
    return result.data


def count_issues_by_status():
    """Count issues grouped by status. Returns dict like {"discovered": N, "downloaded": M, ...}.

    Also includes total count and other useful aggregates.
    """
    sb = get_supabase()
    result = sb.table("issues").select("id,status,year,month").execute()

    counts = {}
    total = 0
    downloaded_or_extracted = 0

    for row in result.data:
        total += 1
        s = row.get("status") or "discovered"
        counts[s] = counts.get(s, 0) + 1
        if s in ("downloaded", "extracted"):
            downloaded_or_extracted += 1

    counts["total"] = total
    counts["downloaded_plus_extracted"] = downloaded_or_extracted
    # Convenience: "downloaded" count includes extracted (both have PDFs)
    counts.setdefault("discovered", 0)
    counts.setdefault("downloaded", 0)
    counts.setdefault("extracted", 0)
    counts.setdefault("skipped_pre1988", 0)
    counts.setdefault("error", 0)
    counts.setdefault("no_pdf", 0)
    counts.setdefault("extraction_error", 0)

    return counts


# ── Feature Operations ───────────────────────────────────────


def feature_exists(issue_id, page_number):
    """Check if a feature already exists for this issue + page."""
    sb = get_supabase()
    existing = (
        sb.table("features")
        .select("id")
        .eq("issue_id", issue_id)
        .eq("page_number", page_number)
        .execute()
    )
    return len(existing.data) > 0


def insert_feature(issue_id, row):
    """Insert a single feature row into Supabase.

    Args:
        issue_id: The issue's numeric primary key
        row: Dict of feature fields (should NOT include issue_id — it's added here)
    """
    sb = get_supabase()
    row["issue_id"] = issue_id
    sb.table("features").insert(row).execute()


def update_detective_verdict(feature_id, verdict):
    """Write Detective's binary YES/NO verdict to a feature row.

    Args:
        feature_id: The feature's numeric primary key
        verdict: "YES" or "NO"
    """
    if verdict not in ("YES", "NO"):
        raise ValueError(f"Invalid detective verdict: {verdict!r} — must be YES or NO")
    sb = get_supabase()
    sb.table("features").update({
        "detective_verdict": verdict,
        "detective_checked_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", feature_id).execute()


def get_features_needing_detective(issue_id=None):
    """Get features with detective_verdict IS NULL and non-empty homeowner_name.

    Optionally filter by issue_id. Returns list of {id, homeowner_name, issue_id}.
    """
    sb = get_supabase()
    query = (
        sb.table("features")
        .select("id, homeowner_name, issue_id")
        .is_("detective_verdict", "null")
        .neq("homeowner_name", "")
        .not_.is_("homeowner_name", "null")
        .neq("homeowner_name", "null")   # Filter string "null" from Gemini
        .neq("homeowner_name", "None")   # Filter string "None" from Gemini
    )
    if issue_id is not None:
        query = query.eq("issue_id", issue_id)
    result = query.execute()
    return result.data


def delete_features_for_issue(issue_id):
    """Delete all features for a given issue. Returns count of deleted rows."""
    sb = get_supabase()
    existing = sb.table("features").select("id").eq("issue_id", issue_id).execute()
    count = len(existing.data)
    if count > 0:
        sb.table("features").delete().eq("issue_id", issue_id).execute()
    return count


# ── Dossier Operations ──────────────────────────────────────


def upsert_dossier(feature_id, data):
    """Upsert a dossier by feature_id (one dossier per feature).

    Args:
        feature_id: The feature's numeric primary key
        data: Dict of dossier fields (should NOT include feature_id — it's added here)

    Returns:
        The upserted row dict, or None on failure.
    """
    sb = get_supabase()

    # Check if dossier exists for this feature
    existing = sb.table("dossiers").select("id").eq("feature_id", feature_id).execute()

    # Ensure feature_id is in the data
    data["feature_id"] = feature_id
    data["updated_at"] = "now()"

    if existing.data:
        # Update existing
        dossier_id = existing.data[0]["id"]
        result = sb.table("dossiers").update(data).eq("id", dossier_id).execute()
        return result.data[0] if result.data else None
    else:
        # Insert new
        result = sb.table("dossiers").insert(data).execute()
        return result.data[0] if result.data else None


def get_dossier(feature_id):
    """Fetch a single dossier by feature_id. Returns dict or None."""
    sb = get_supabase()
    result = sb.table("dossiers").select("*").eq("feature_id", feature_id).execute()
    return result.data[0] if result.data else None


def list_dossiers(strength=None, editor_verdict=None):
    """List all dossiers, optionally filtered by connection_strength and/or editor_verdict.

    Args:
        strength: Optional filter (e.g., "HIGH", "MEDIUM", "LOW", "COINCIDENCE")
        editor_verdict: Optional filter (e.g., "CONFIRMED", "REJECTED", "PENDING_REVIEW")

    Returns:
        List of dossier dicts.
    """
    sb = get_supabase()
    query = sb.table("dossiers").select("*")
    if strength is not None:
        query = query.eq("connection_strength", strength)
    if editor_verdict is not None:
        query = query.eq("editor_verdict", editor_verdict)
    result = query.order("created_at", desc=True).execute()
    return result.data


def update_editor_verdict(feature_id, verdict, reasoning):
    """Update a dossier's editor verdict. Only the Editor calls this.

    Args:
        feature_id: The feature's numeric primary key (dossier is keyed by feature_id)
        verdict: "CONFIRMED", "REJECTED", or "PENDING_REVIEW"
        reasoning: Editor's reasoning for the verdict

    Returns:
        The updated row dict, or None if no dossier found.
    """
    sb = get_supabase()
    result = (
        sb.table("dossiers")
        .update({
            "editor_verdict": verdict,
            "editor_reasoning": reasoning,
            "editor_reviewed_at": "now()",
            "updated_at": "now()",
        })
        .eq("feature_id", feature_id)
        .execute()
    )
    return result.data[0] if result.data else None


def insert_dossier_image(dossier_id, feature_id, page_number, storage_path, public_url):
    """Insert a dossier image record.

    Args:
        dossier_id: FK to dossiers table
        feature_id: FK to features table
        page_number: The PDF page number this image corresponds to
        storage_path: Path in Supabase Storage (e.g., "dossier-images/123/page_42.png")
        public_url: Public URL for the image

    Returns:
        The inserted row dict.
    """
    sb = get_supabase()
    row = {
        "dossier_id": dossier_id,
        "feature_id": feature_id,
        "page_number": page_number,
        "storage_path": storage_path,
        "public_url": public_url,
        "image_type": "article_page",
    }
    result = sb.table("dossier_images").insert(row).execute()
    return result.data[0] if result.data else None


def get_dossier_images(dossier_id):
    """Fetch all images for a dossier. Returns list of dicts."""
    sb = get_supabase()
    result = (
        sb.table("dossier_images")
        .select("*")
        .eq("dossier_id", dossier_id)
        .order("page_number")
        .execute()
    )
    return result.data


def upload_to_storage(bucket, path, file_data, content_type="image/png"):
    """Upload a file to Supabase Storage. Returns the public URL.

    Args:
        bucket: Storage bucket name (e.g., "dossier-images")
        path: Path within the bucket (e.g., "123/page_42.png")
        file_data: Raw bytes to upload
        content_type: MIME type (default "image/png")

    Returns:
        Public URL string for the uploaded file.
    """
    sb = get_supabase()
    sb.storage.from_(bucket).upload(
        path,
        file_data,
        {"content-type": content_type},
    )
    # Build public URL
    url = os.getenv("SUPABASE_URL", "")
    return f"{url}/storage/v1/object/public/{bucket}/{path}"


# ── Migration ───────────────────────────────────────────────


def migrate_disk_dossiers():
    """Migrate existing disk dossiers (data/dossiers/*.json) into Supabase.

    Reads each individual dossier JSON, looks up the feature_id from
    cross_references/results.json, and upserts into the dossiers table.

    Run once: python3 -c "from db import migrate_disk_dossiers; migrate_disk_dossiers()"
    """
    base_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    dossiers_dir = os.path.join(base_dir, "dossiers")
    results_path = os.path.join(base_dir, "cross_references", "results.json")

    if not os.path.exists(dossiers_dir):
        print("No dossiers directory found.")
        return

    # Build name → feature_id lookup from cross-reference results
    name_to_fid = {}
    if os.path.exists(results_path):
        with open(results_path) as f:
            results = json.load(f)
        for r in results:
            name = (r.get("homeowner_name") or "").strip().lower()
            fid = r.get("feature_id")
            if name and fid:
                name_to_fid[name] = fid

    migrated = 0
    skipped = 0

    for fname in os.listdir(dossiers_dir):
        if not fname.endswith(".json"):
            continue
        if fname in ("all_dossiers.json", "investigated_ids.json"):
            continue

        fpath = os.path.join(dossiers_dir, fname)
        try:
            with open(fpath) as f:
                dossier = json.load(f)
        except Exception as e:
            print(f"  SKIP {fname}: could not parse JSON — {e}")
            skipped += 1
            continue

        subject = (dossier.get("subject_name") or "").strip()
        if not subject:
            print(f"  SKIP {fname}: no subject_name")
            skipped += 1
            continue

        # Look up feature_id by subject name (case-insensitive)
        feature_id = name_to_fid.get(subject.lower())
        if not feature_id:
            print(f"  SKIP {fname}: no feature_id found for '{subject}'")
            skipped += 1
            continue

        # Build Supabase row from dossier fields
        row = {
            "subject_name": subject,
            "combined_verdict": dossier.get("combined_verdict"),
            "confidence_score": dossier.get("confidence_score"),
            "connection_strength": dossier.get("connection_strength"),
            "strength_rationale": dossier.get("strength_rationale"),
            "triage_result": "investigate",  # Pre-existing dossiers were all investigated
            "triage_reasoning": "Migrated from disk — pre-triage era",
            "ad_appearance": dossier.get("ad_appearance"),
            "home_analysis": dossier.get("home_analysis"),
            "visual_analysis": None,  # Not available for legacy dossiers
            "epstein_connections": dossier.get("epstein_connections"),
            "pattern_analysis": dossier.get("pattern_analysis"),
            "key_findings": dossier.get("key_findings"),
            "investigation_depth": dossier.get("investigation_depth", "standard"),
            "needs_manual_review": dossier.get("needs_manual_review", False),
            "review_reason": dossier.get("review_reason"),
            "investigated_at": dossier.get("investigated_at"),
        }

        try:
            result = upsert_dossier(feature_id, row)
            if result:
                print(f"  OK {subject} → feature_id={feature_id}")
                migrated += 1
            else:
                print(f"  FAIL {subject}: upsert returned None")
                skipped += 1
        except Exception as e:
            print(f"  FAIL {subject}: {e}")
            skipped += 1

    print(f"\nMigration complete: {migrated} migrated, {skipped} skipped")
