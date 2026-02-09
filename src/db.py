"""
Shared database module — single source of truth for all pipeline agents.

All agents import from here instead of creating their own Supabase clients.
Replaces the local archive_manifest.json with Supabase issues table queries.

Usage:
    from db import get_supabase, list_issues, update_issue, get_or_create_issue
"""

import os
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


def delete_features_for_issue(issue_id):
    """Delete all features for a given issue. Returns count of deleted rows."""
    sb = get_supabase()
    existing = sb.table("features").select("id").eq("issue_id", issue_id).execute()
    count = len(existing.data)
    if count > 0:
        sb.table("features").delete().eq("issue_id", issue_id).execute()
    return count
