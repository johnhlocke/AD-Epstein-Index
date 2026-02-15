"""
Shared database module — single source of truth for all pipeline agents.

All agents import from here instead of creating their own Supabase clients.
Replaces the local archive_manifest.json with Supabase issues table queries.

Usage:
    from db import get_supabase, list_issues, update_issue, get_or_create_issue
"""

import functools
import json
import os
import time
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


def with_retry(max_retries=3, base_delay=0.5):
    """Decorator that retries Supabase operations with exponential backoff.

    Retries on network/timeout errors only — not on constraint violations
    or other application-level errors which should fail immediately.
    """
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(max_retries + 1):
                try:
                    return fn(*args, **kwargs)
                except Exception as e:
                    err_str = str(e).lower()
                    # Don't retry constraint violations, auth errors, or bad requests
                    if any(k in err_str for k in (
                        "violates", "constraint", "duplicate",
                        "not found", "permission", "unauthorized",
                        "invalid", "23505", "23514", "42",
                    )):
                        raise
                    last_exc = e
                    if attempt < max_retries:
                        delay = base_delay * (2 ** attempt)
                        time.sleep(delay)
            raise last_exc
        return wrapper
    return decorator


# ── Issue Operations ─────────────────────────────────────────


@with_retry()
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


@with_retry()
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


@with_retry()
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


@with_retry()
def update_issue(identifier, updates):
    """Update an issue's fields by identifier. Used for status transitions.

    Args:
        identifier: The archive.org identifier string
        updates: Dict of fields to update (e.g., {"status": "downloaded", "pdf_path": "/..."})
    """
    sb = get_supabase()
    result = sb.table("issues").update(updates).eq("identifier", identifier).execute()
    return result.data[0] if result.data else None


@with_retry()
def update_issue_by_id(issue_id, updates):
    """Update an issue's fields by numeric ID.

    Args:
        issue_id: The issue's numeric primary key
        updates: Dict of fields to update
    """
    sb = get_supabase()
    result = sb.table("issues").update(updates).eq("id", issue_id).execute()
    return result.data[0] if result.data else None


@with_retry()
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


@with_retry()
def count_issues_by_status():
    """Count issues grouped by status. Returns dict like {"discovered": N, "downloaded": M, ...}.

    Also includes total count and other useful aggregates.
    Returns empty default dict on any error (never None).
    """
    _defaults = {
        "total": 0, "downloaded_plus_extracted": 0, "discovered": 0,
        "downloaded": 0, "extracted": 0, "skipped_pre1988": 0,
        "error": 0, "no_pdf": 0, "extraction_error": 0,
    }
    try:
        sb = get_supabase()
        result = sb.table("issues").select("id,status,year,month").execute()
    except Exception:
        return _defaults

    if not result or not result.data:
        return _defaults

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


@with_retry()
def insert_feature(issue_id, row):
    """Insert a single feature row into Supabase.

    Args:
        issue_id: The issue's numeric primary key
        row: Dict of feature fields (should NOT include issue_id — it's added here)
    """
    sb = get_supabase()
    row["issue_id"] = issue_id
    sb.table("features").insert(row).execute()


@with_retry()
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


@with_retry()
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


@with_retry()
def delete_features_for_issue(issue_id):
    """Delete all features for a given issue. Returns count of deleted rows."""
    sb = get_supabase()
    existing = sb.table("features").select("id").eq("issue_id", issue_id).execute()
    count = len(existing.data)
    if count > 0:
        sb.table("features").delete().eq("issue_id", issue_id).execute()
    return count


# ── Dossier Operations ──────────────────────────────────────


@with_retry()
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


@with_retry()
def list_dossiers(strength=None, editor_verdict=None):
    """List all dossiers, optionally filtered by connection_strength and/or editor_verdict.

    Args:
        strength: Optional filter (e.g., "HIGH", "MEDIUM", "LOW", "COINCIDENCE")
        editor_verdict: Optional filter (e.g., "CONFIRMED", "REJECTED", "PENDING_REVIEW")

    Returns:
        List of dossier dicts.
    """
    sb = get_supabase()
    # Paginate — Supabase default limit is 1000 rows
    all_rows = []
    offset = 0
    while True:
        query = sb.table("dossiers").select("*")
        if strength is not None:
            query = query.eq("connection_strength", strength)
        if editor_verdict is not None:
            query = query.eq("editor_verdict", editor_verdict)
        batch = query.order("created_at", desc=True).range(offset, offset + 999).execute()
        all_rows.extend(batch.data or [])
        if len(batch.data or []) < 1000:
            break
        offset += 1000
    return all_rows


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


# ── Cross-Reference Operations ────────────────────────────


@with_retry()
def upsert_cross_reference(feature_id, data):
    """Upsert a cross-reference result by feature_id (one row per feature).

    Args:
        feature_id: The feature's numeric primary key
        data: Dict of xref fields (feature_id added automatically)

    Returns:
        The upserted row dict, or None on failure.
    """
    sb = get_supabase()

    existing = sb.table("cross_references").select("id").eq("feature_id", feature_id).execute()

    data["feature_id"] = feature_id
    data["updated_at"] = datetime.now(timezone.utc).isoformat()

    if existing.data:
        xref_id = existing.data[0]["id"]
        result = sb.table("cross_references").update(data).eq("id", xref_id).execute()
        return result.data[0] if result.data else None
    else:
        result = sb.table("cross_references").insert(data).execute()
        return result.data[0] if result.data else None


def get_cross_reference(feature_id):
    """Fetch a single cross-reference by feature_id. Returns dict or None."""
    sb = get_supabase()
    result = sb.table("cross_references").select("*").eq("feature_id", feature_id).execute()
    return result.data[0] if result.data else None


@with_retry()
def list_cross_references(combined_verdict=None):
    """List all cross-references, optionally filtered by combined_verdict.

    Args:
        combined_verdict: Optional filter (e.g., "confirmed_match", "no_match")

    Returns:
        List of xref dicts.
    """
    sb = get_supabase()
    # Paginate — Supabase default limit is 1000 rows
    all_rows = []
    offset = 0
    while True:
        query = sb.table("cross_references").select("*")
        if combined_verdict is not None:
            query = query.eq("combined_verdict", combined_verdict)
        batch = query.order("checked_at", desc=True).range(offset, offset + 999).execute()
        all_rows.extend(batch.data or [])
        if len(batch.data or []) < 1000:
            break
        offset += 1000
    return all_rows


def get_xrefs_needing_doj_retry():
    """Get cross-references with doj_status='pending' that need DOJ retry.

    Returns list of {feature_id, homeowner_name} for names whose DOJ search
    was skipped (browser unavailable) but should be retried.
    """
    sb = get_supabase()
    result = (
        sb.table("cross_references")
        .select("feature_id, homeowner_name")
        .eq("doj_status", "pending")
        .neq("homeowner_name", "Anonymous")
        .execute()
    )
    return result.data


def get_xref_leads():
    """Build the by_name leads dict from Supabase cross-references.

    Returns a dict keyed by lowercase homeowner name, with overrides applied:
    {
        "miranda brooks": {
            "name": "Miranda Brooks",
            "feature_ids": [123, 456],
            "bb_verdict": "match",
            "bb_matches": [...],
            "doj_verdict": "searched",
            "doj_results": {...},
            "combined": "likely_match",
            "confidence_score": 0.75,
            "binary": "YES",
            "editor_override": "confirmed_match",  # if present
        }
    }
    """
    xrefs = list_cross_references()
    by_name = {}

    for xr in xrefs:
        name = (xr.get("homeowner_name") or "").strip()
        if not name:
            continue
        key = name.lower()

        # Apply editor override if present
        effective_verdict = xr.get("editor_override_verdict") or xr.get("combined_verdict", "pending")

        if key not in by_name:
            by_name[key] = {
                "name": name,
                "feature_ids": [],
                "bb_verdict": xr.get("black_book_status", "pending"),
                "bb_matches": xr.get("black_book_matches"),
                "doj_verdict": xr.get("doj_status", "pending"),
                "doj_results": xr.get("doj_results"),
                "combined": effective_verdict,
                "confidence_score": float(xr.get("confidence_score") or 0),
                "binary": xr.get("binary_verdict", "NO"),
                "rationale": xr.get("verdict_rationale"),
                "false_positive_indicators": xr.get("false_positive_indicators"),
            }
            if xr.get("editor_override_verdict"):
                by_name[key]["editor_override"] = xr["editor_override_verdict"]
                by_name[key]["editor_override_reason"] = xr.get("editor_override_reason")

        by_name[key]["feature_ids"].append(xr.get("feature_id"))

    return by_name


def update_xref_editor_override(feature_id, verdict, reason):
    """Write an editor override to a cross-reference row.

    Args:
        feature_id: The feature's numeric primary key
        verdict: Override verdict (e.g., "confirmed_match", "no_match")
        reason: Editor's reason for the override
    """
    sb = get_supabase()
    sb.table("cross_references").update({
        "editor_override_verdict": verdict,
        "editor_override_reason": reason,
        "editor_override_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("feature_id", feature_id).execute()


@with_retry()
def get_features_without_xref():
    """Get features that have no cross-reference row yet.

    Replaces the old checked_features.json approach.
    Returns list of feature dicts needing xref.
    """
    sb = get_supabase()

    # Get all features with valid homeowner names
    all_features = (
        sb.table("features")
        .select("id, homeowner_name, issue_id")
        .neq("homeowner_name", "")
        .not_.is_("homeowner_name", "null")
        .neq("homeowner_name", "null")
        .neq("homeowner_name", "None")
        .execute()
    )

    if not all_features.data:
        return []

    # Get all feature_ids that already have xref rows
    xref_rows = sb.table("cross_references").select("feature_id").execute()
    has_xref = {r["feature_id"] for r in xref_rows.data}

    return [f for f in all_features.data if f["id"] not in has_xref]


def delete_cross_references(feature_ids):
    """Delete cross-reference rows for the given feature IDs.

    Args:
        feature_ids: Set or list of feature IDs to delete xref rows for
    """
    if not feature_ids:
        return
    sb = get_supabase()
    for fid in feature_ids:
        sb.table("cross_references").delete().eq("feature_id", fid).execute()


def reset_xref_doj(feature_id):
    """Reset DOJ search status for a cross-reference (for retry).

    Args:
        feature_id: The feature's numeric primary key
    """
    sb = get_supabase()
    sb.table("cross_references").update({
        "doj_status": "pending",
        "doj_results": None,
        "combined_verdict": "pending",
        "confidence_score": 0.0,
        "verdict_rationale": None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("feature_id", feature_id).execute()


def migrate_disk_xrefs():
    """One-time migration from disk JSON files to Supabase cross_references table.

    Reads data/cross_references/results.json (19 entries) and
    data/detective_verdicts.json (17 overrides), then upserts into cross_references.

    Run once: python3 -c "from db import migrate_disk_xrefs; migrate_disk_xrefs()"
    """
    base_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    results_path = os.path.join(base_dir, "cross_references", "results.json")
    verdicts_path = os.path.join(base_dir, "detective_verdicts.json")

    # Load results
    results = []
    if os.path.exists(results_path):
        with open(results_path) as f:
            results = json.load(f)
        print(f"Loaded {len(results)} entries from results.json")
    else:
        print("No results.json found — nothing to migrate")
        return

    # Load editor verdicts (keyed by lowercase name)
    editor_overrides = {}
    if os.path.exists(verdicts_path):
        with open(verdicts_path) as f:
            verdicts = json.load(f)
        for v in verdicts:
            name_key = (v.get("name") or "").strip().lower()
            if name_key and v.get("verdict"):
                editor_overrides[name_key] = v
        print(f"Loaded {len(editor_overrides)} editor overrides from detective_verdicts.json")

    # Import verdict_to_binary for computing binary verdict
    try:
        from cross_reference import verdict_to_binary
    except ImportError:
        def verdict_to_binary(v, s, o=None):
            if v in ("confirmed_match", "likely_match"):
                return "YES"
            if v == "possible_match" and s >= 0.40:
                return "YES"
            if v == "needs_review":
                return "YES"
            return "NO"

    migrated = 0
    skipped = 0

    for r in results:
        feature_id = r.get("feature_id")
        name = r.get("homeowner_name", "")
        if not feature_id or not name:
            print(f"  SKIP: missing feature_id or name in entry")
            skipped += 1
            continue

        combined = r.get("combined_verdict", "pending")
        score = float(r.get("confidence_score") or 0)
        binary = verdict_to_binary(combined, score)

        data = {
            "homeowner_name": name,
            "black_book_status": r.get("black_book_status", "pending"),
            "black_book_matches": r.get("black_book_matches"),
            "doj_status": r.get("doj_status", "pending"),
            "doj_results": r.get("doj_results"),
            "combined_verdict": combined,
            "confidence_score": score,
            "verdict_rationale": r.get("verdict_rationale"),
            "false_positive_indicators": r.get("false_positive_indicators"),
            "binary_verdict": binary,
        }

        # Apply editor override if one exists for this name
        name_lower = name.strip().lower()
        if name_lower in editor_overrides:
            ov = editor_overrides[name_lower]
            data["editor_override_verdict"] = ov["verdict"]
            data["editor_override_reason"] = ov.get("reason", "Editor override")
            data["editor_override_at"] = ov.get("queued_time")

        try:
            result = upsert_cross_reference(feature_id, data)
            if result:
                override_note = f" [override: {data.get('editor_override_verdict')}]" if data.get("editor_override_verdict") else ""
                print(f"  OK {name} → feature_id={feature_id} ({combined}){override_note}")
                migrated += 1
            else:
                print(f"  FAIL {name}: upsert returned None")
                skipped += 1
        except Exception as e:
            print(f"  FAIL {name}: {e}")
            skipped += 1

    print(f"\nXRef migration complete: {migrated} migrated, {skipped} skipped")


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
