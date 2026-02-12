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
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from db import get_supabase

# Total expected AD issues: 12/year from 1988 to 2026 = 39 years × 12 = 468
TOTAL_EXPECTED_ISSUES = 468

# Paths
BASE_DIR = os.path.join(os.path.dirname(__file__), "..")
DATA_DIR = os.path.join(BASE_DIR, "data")
ISSUES_DIR = os.path.join(DATA_DIR, "issues")
EXTRACTIONS_DIR = os.path.join(DATA_DIR, "extractions")
XREF_DIR = os.path.join(DATA_DIR, "cross_references")
ACTIVITY_LOG_PATH = os.path.join(DATA_DIR, "agent_activity.log")
BRIEFING_PATH = os.path.join(DATA_DIR, "editor_briefing.md")
COST_PATH = os.path.join(DATA_DIR, "editor_cost.json")
DOSSIERS_DIR = os.path.join(DATA_DIR, "dossiers")
DESIGNER_TRAINING_LOG_PATH = os.path.join(DATA_DIR, "designer_training", "training_log.json")
DESIGNER_MODE_PATH = os.path.join(DATA_DIR, "designer_mode.json")
OUTPUT_PATH = os.path.join(BASE_DIR, "tools", "agent-office", "status.json")
SKILLS_PATH = os.path.join(BASE_DIR, "tools", "agent-office", "skills.json")
SKILLS_DIR = os.path.join(BASE_DIR, "src", "agents", "skills")

# ── TTL Cache ──────────────────────────────────────────────────────────────
# Module-level cache: { key: (expire_time, value) }
_cache = {}


def _cached(key, ttl, fn):
    """Return cached value if fresh, otherwise call fn() and cache the result."""
    now = time.monotonic()
    entry = _cache.get(key)
    if entry and now < entry[0]:
        return entry[1]
    value = fn()
    _cache[key] = (now + ttl, value)
    return value


# ── Issue Rows (shared between pipeline stats and coverage map) ────────────
def _fetch_issue_rows():
    """Fetch all issue rows from Supabase once. Used by pipeline stats + coverage map."""
    try:
        sb = get_supabase()
        result = sb.table("issues").select("id,status,year,month").execute()
        return result.data or []
    except Exception:
        return []


def read_pipeline_stats():
    """Read pipeline stats from Supabase (single source of truth).

    Returns a dict compatible with the old manifest_stats format, plus feature counts.
    Also caches issue rows for reuse by build_coverage_map_from_rows().
    """
    def _compute():
        try:
            issue_rows = _cached("issue_rows", 10, _fetch_issue_rows)

            # Count issues by status (replaces count_issues_by_status call)
            counts = {}
            total = 0
            for row in issue_rows:
                total += 1
                s = row.get("status") or "discovered"
                counts[s] = counts.get(s, 0) + 1
            counts.setdefault("downloaded", 0)
            counts.setdefault("extracted", 0)
            counts.setdefault("skipped_pre1988", 0)
            counts.setdefault("error", 0)
            counts.setdefault("no_pdf", 0)

            sb = get_supabase()
            # Paginate — Supabase default limit is 1000 rows
            feat_rows = []
            offset = 0
            while True:
                batch = sb.table("features").select("id,homeowner_name,issue_id").range(offset, offset + 999).execute()
                feat_rows.extend(batch.data or [])
                if len(batch.data or []) < 1000:
                    break
                offset += 1000
            total_features = len(feat_rows)
            with_name = sum(1 for r in feat_rows if r.get("homeowner_name"))
            distinct_issues = len(set(r["issue_id"] for r in feat_rows if r.get("issue_id")))

            return {
                "total": total,
                "downloaded": counts["downloaded"] + counts["extracted"],
                "extracted": counts["extracted"],
                "skipped": counts.get("skipped_pre1988", 0),
                "errors": counts.get("error", 0),
                "no_pdf": counts.get("no_pdf", 0),
                "total_features": total_features,
                "with_homeowner": with_name,
                "null_homeowners": total_features - with_name,
                "distinct_issues": distinct_issues,
            }
        except Exception:
            return {
                "total": 0, "downloaded": 0, "extracted": 0,
                "skipped": 0, "errors": 0, "no_pdf": 0,
                "total_features": 0, "with_homeowner": 0,
                "null_homeowners": 0, "distinct_issues": 0,
            }

    return _cached("pipeline_stats", 10, _compute)


# ── Extractions: DB-first, disk fallback ───────────────────────────────────
def _read_extractions_from_db():
    """Read feature list from Supabase features table instead of scanning disk."""
    try:
        sb = get_supabase()
        cols = "homeowner_name,designer_name,location_city,location_state,location_country,design_style,year_built,square_footage,issue_id"
        # Paginate — Supabase default limit is 1000 rows
        rows = []
        offset = 0
        while True:
            batch = sb.table("features").select(cols).range(offset, offset + 999).execute()
            rows.extend(batch.data or [])
            if len(batch.data or []) < 1000:
                break
            offset += 1000

        features = len(rows)
        nulls = sum(1 for r in rows if not r.get("homeowner_name"))
        distinct_issues = len(set(r["issue_id"] for r in rows if r.get("issue_id")))
        feature_list = []
        for r in rows:
            feature_list.append({
                "homeowner_name": r.get("homeowner_name"),
                "designer_name": r.get("designer_name"),
                "location_city": r.get("location_city"),
                "location_state": r.get("location_state"),
                "location_country": r.get("location_country"),
                "design_style": r.get("design_style"),
                "year_built": r.get("year_built"),
                "square_footage": r.get("square_footage"),
                "issue": r.get("issue_id", ""),
            })

        return {
            "extracted": distinct_issues, "skipped": 0,
            "features": features, "nulls": nulls,
            "feature_list": feature_list,
        }
    except Exception:
        return None


def _read_extractions_disk():
    """Fallback: read extraction results from disk files."""
    if not os.path.exists(EXTRACTIONS_DIR):
        return {"extracted": 0, "skipped": 0, "features": 0, "nulls": 0, "feature_list": []}

    extracted = 0
    skipped = 0
    features = 0
    nulls = 0
    feature_list = []

    for fname in os.listdir(EXTRACTIONS_DIR):
        if not fname.endswith(".json"):
            continue
        with open(os.path.join(EXTRACTIONS_DIR, fname)) as f:
            data = json.load(f)
        if data.get("skipped"):
            skipped += 1
        else:
            extracted += 1
            issue_label = data.get("title", fname.replace(".json", ""))
            month = data.get("verified_month") or data.get("month")
            year = data.get("verified_year") or data.get("year")
            for feat in data.get("features", []):
                features += 1
                if not feat.get("homeowner_name"):
                    nulls += 1
                feature_list.append({
                    "homeowner_name": feat.get("homeowner_name"),
                    "designer_name": feat.get("designer_name"),
                    "location_city": feat.get("location_city"),
                    "location_state": feat.get("location_state"),
                    "location_country": feat.get("location_country"),
                    "design_style": feat.get("design_style"),
                    "year_built": feat.get("year_built"),
                    "square_footage": feat.get("square_footage"),
                    "issue": issue_label,
                    "month": month,
                    "year": year,
                })

    return {
        "extracted": extracted, "skipped": skipped,
        "features": features, "nulls": nulls,
        "feature_list": feature_list,
    }


def read_extractions():
    """Read extraction results — DB-first with disk fallback. Cached 30s."""
    def _compute():
        db_result = _read_extractions_from_db()
        if db_result is not None:
            return db_result
        return _read_extractions_disk()
    return _cached("extractions", 30, _compute)


# ── Cross-References ───────────────────────────────────────────────────────
def read_xref():
    """Read cross-reference results from Supabase (primary) or disk (fallback). Cached 30s."""
    def _compute():
        empty = {"checked": 0, "matches": 0, "leads": 0, "verdicts": {}, "by_name": {}}
        try:
            from db import list_cross_references
            xrefs = list_cross_references()
            if xrefs:
                return _build_xref_summary_from_rows(xrefs)
        except Exception:
            pass
        results_path = os.path.join(XREF_DIR, "results.json")
        if not os.path.exists(results_path):
            return empty
        try:
            with open(results_path) as f:
                results = json.load(f)
            return _build_xref_summary_from_rows(results)
        except Exception:
            return empty
    return _cached("xref", 30, _compute)


def _build_xref_summary_from_rows(rows):
    """Build xref summary dict from a list of xref rows (Supabase or disk)."""
    checked = len(rows)
    matches = sum(1 for r in rows if r.get("black_book_status") == "match")
    verdicts = {}
    by_name = {}

    for r in rows:
        effective_verdict = r.get("editor_override_verdict") or r.get("combined_verdict", "no_match")
        verdicts[effective_verdict] = verdicts.get(effective_verdict, 0) + 1

        name = (r.get("homeowner_name") or "").lower().strip()
        if name:
            by_name[name] = {
                "verdict": effective_verdict,
                "bb_status": r.get("black_book_status", "no_match"),
                "confidence": float(r.get("confidence_score") or 0),
                "original_name": r.get("homeowner_name", ""),
            }

    leads = sum(1 for entry in by_name.values()
                if entry["verdict"] != "no_match"
                or entry["bb_status"] == "match")

    return {"checked": checked, "matches": matches, "leads": leads,
            "verdicts": verdicts, "by_name": by_name}


# ── Dossiers (shared fetch for read_dossiers + _get_all_dossier_details) ──
def _fetch_dossier_rows():
    """Fetch dossier rows once from Supabase. Returns list or None on failure."""
    try:
        from db import list_dossiers
        dossiers = list_dossiers()
        return dossiers if dossiers else None
    except Exception:
        return None


def _build_dossier_summary(dossiers):
    """Build read_dossiers()-style summary from raw dossier rows."""
    strengths = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    by_name = {}
    confirmed_names = []
    for d in dossiers:
        s = (d.get("connection_strength") or "").upper()
        if s in strengths:
            strengths[s] += 1
        name = (d.get("subject_name") or "").strip()
        verdict = (d.get("editor_verdict") or "").upper()
        reasoning = d.get("editor_reasoning") or ""
        if name:
            by_name[name.lower()] = {
                "strength": s.lower(),
                "editor_verdict": verdict,
                "editor_reasoning": reasoning,
            }
        if verdict == "CONFIRMED" and name:
            confirmed_names.append({
                "name": name,
                "strength": s.lower(),
                "rationale": (d.get("strength_rationale") or "")[:120],
                "editor_verdict": verdict,
            })
    return {
        "investigated": len(dossiers),
        "high": strengths["HIGH"],
        "medium": strengths["MEDIUM"],
        "low": strengths["LOW"],
        "by_name": by_name,
        "confirmed_names": confirmed_names,
    }


def read_dossiers():
    """Read dossier stats from Supabase, falling back to local file. Cached 60s."""
    empty = {"investigated": 0, "high": 0, "medium": 0, "low": 0, "by_name": {}, "confirmed_names": []}

    def _compute():
        rows = _cached("dossier_rows", 60, _fetch_dossier_rows)
        if rows:
            return _build_dossier_summary(rows)

        # Fallback: local file
        if not os.path.exists(DOSSIERS_DIR):
            return empty
        master_path = os.path.join(DOSSIERS_DIR, "all_dossiers.json")
        if not os.path.exists(master_path):
            return empty
        try:
            with open(master_path) as f:
                dossiers = json.load(f)
            strengths = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
            by_name = {}
            confirmed_names = []
            for d in dossiers:
                s = (d.get("connection_strength") or "").upper()
                if s in strengths:
                    strengths[s] += 1
                name = (d.get("subject_name") or "").strip()
                if name:
                    by_name[name.lower()] = {"strength": s.lower(), "editor_verdict": "", "editor_reasoning": ""}
                if s in ("HIGH", "MEDIUM") and name:
                    confirmed_names.append({
                        "name": name,
                        "strength": s.lower(),
                        "rationale": (d.get("strength_rationale") or "")[:120],
                    })
            return {
                "investigated": len(dossiers),
                "high": strengths["HIGH"],
                "medium": strengths["MEDIUM"],
                "low": strengths["LOW"],
                "by_name": by_name,
                "confirmed_names": confirmed_names,
            }
        except Exception:
            return empty

    return _cached("dossier_summary", 60, _compute)


# ── Activity Log (shared read for log display + throughput) ────────────────
def _read_log_lines():
    """Read activity log file once. Returns list of lines or []."""
    if not os.path.exists(ACTIVITY_LOG_PATH):
        return []
    try:
        with open(ACTIVITY_LOG_PATH) as f:
            return f.readlines()
    except Exception:
        return []


def read_activity_log_from_lines(lines, max_lines=20):
    """Parse recent log entries from pre-read lines."""
    # Pre-filter to pipe-delimited lines only (skip multiline tracebacks)
    valid_lines = [l for l in lines if l.count("|") >= 3]
    entries = []
    for line in valid_lines[-max_lines:]:
        parts = line.strip().split("|", 3)
        if len(parts) == 4:
            timestamp, agent, level, message = parts
            if level in ("INFO", "WARN", "ERROR"):
                time_part = timestamp.split(" ")[1] if " " in timestamp else timestamp
                entries.append({
                    "time": time_part,
                    "agent": agent.title(),
                    "event": message,
                })
    return entries


def read_activity_log(max_lines=20):
    """Read recent entries from the agent activity log."""
    lines = _read_log_lines()
    return read_activity_log_from_lines(lines, max_lines)


def read_editor_briefing():
    """Read the latest editor briefing summary."""
    if not os.path.exists(BRIEFING_PATH):
        return None
    try:
        with open(BRIEFING_PATH) as f:
            text = f.read().strip()
        for line in text.split("\n"):
            if "Pipeline Health:" in line:
                return line.split("Pipeline Health:")[-1].strip()
        return "Briefing available"
    except Exception:
        return None


EDITOR_MESSAGES_PATH = os.path.join(DATA_DIR, "editor_messages.json")
HUMAN_MESSAGES_PATH = os.path.join(DATA_DIR, "human_messages.json")


def read_combined_inbox(max_messages=40):
    """Read and combine editor + human messages, most recent first.

    Conversation messages (human + replies) are always included regardless of cap,
    then remaining slots filled with status/alert messages.
    """
    editor_msgs = []
    human_msgs = []

    if os.path.exists(EDITOR_MESSAGES_PATH):
        try:
            with open(EDITOR_MESSAGES_PATH) as f:
                editor_msgs = json.load(f)
            for m in editor_msgs:
                # Preserve sender on human messages that were copied here
                if m.get("sender") != "human":
                    m["sender"] = "editor"
        except Exception:
            pass

    if os.path.exists(HUMAN_MESSAGES_PATH):
        try:
            with open(HUMAN_MESSAGES_PATH) as f:
                human_msgs = json.load(f)
            for m in human_msgs:
                m["sender"] = "human"
        except Exception:
            pass

    combined = editor_msgs + human_msgs

    # Deduplicate human messages (they exist in both files)
    seen_human = set()
    deduped = []
    for m in combined:
        if m.get("sender") == "human":
            key = (m.get("text", ""), m.get("time", ""))
            if key in seen_human:
                continue
            seen_human.add(key)
        deduped.append(m)

    deduped.sort(key=lambda m: str(m.get("timestamp", m.get("time", ""))))

    # Always include conversation messages (human + editor replies)
    conversation = [m for m in deduped if m.get("sender") == "human" or m.get("is_reply")]
    status = [m for m in deduped if m.get("sender") != "human" and not m.get("is_reply")]

    # Take conversation messages + fill remaining slots with status
    remaining = max(0, max_messages - len(conversation))
    result = conversation + status[-remaining:] if remaining else conversation

    # Final sort newest-first
    result.sort(key=lambda m: str(m.get("timestamp", m.get("time", ""))), reverse=True)
    return result


BULLETIN_PATH = os.path.join(DATA_DIR, "bulletin_board.json")

AGENT_DISPLAY_NAMES = {
    "scout": "Arthur", "courier": "Casey", "reader": "Elias",
    "detective": "Silas", "researcher": "Elena", "editor": "Miranda",
    "designer": "Sable",
}


def read_bulletin_notes(max_notes=15):
    """Read recent bulletin board notes for dashboard display."""
    if not os.path.exists(BULLETIN_PATH):
        return []
    try:
        with open(BULLETIN_PATH) as f:
            notes = json.load(f)
        if not isinstance(notes, list):
            return []
        # Return newest first, with display names
        result = []
        for note in notes[-max_notes:][::-1]:
            agent_key = note.get("agent", "unknown")
            result.append({
                "agent": agent_key,
                "name": AGENT_DISPLAY_NAMES.get(agent_key, agent_key.title()),
                "text": note.get("text", ""),
                "tag": note.get("tag", "tip"),
                "timestamp": note.get("timestamp", 0),
            })
        return result
    except Exception:
        return []


WATERCOOLER_PATH = os.path.join(DATA_DIR, "watercooler.json")


def read_watercooler():
    """Read current watercooler conversation if active."""
    if not os.path.exists(WATERCOOLER_PATH):
        return None
    try:
        with open(WATERCOOLER_PATH) as f:
            data = json.load(f)
        current = data.get("current")
        if current and time.time() < current.get("display_until", 0):
            return current
        return None
    except Exception:
        return None


def read_editor_cost():
    """Read the editor's API cost tracking data."""
    if not os.path.exists(COST_PATH):
        return {"api_calls": 0, "total_cost": 0.0, "input_tokens": 0, "output_tokens": 0}
    try:
        with open(COST_PATH) as f:
            return json.load(f)
    except Exception:
        return {"api_calls": 0, "total_cost": 0.0, "input_tokens": 0, "output_tokens": 0}


AGENT_COSTS_DIR = os.path.join(DATA_DIR, "costs")

# Agent display names for cost tracker
AGENT_NAMES = {
    "scout": "Arthur", "courier": "Casey", "reader": "Elias",
    "detective": "Silas", "researcher": "Elena", "editor": "Miranda",
    "designer": "Sable",
}

# Agent colors for cost tracker bars
AGENT_COLORS = {
    "scout": "#e74c3c", "courier": "#3498db", "reader": "#2ecc71",
    "detective": "#9b59b6", "researcher": "#e67e22", "editor": "#f5c842",
    "designer": "#e91e63",
}


def read_all_costs():
    """Read cost data from all agents and aggregate into a single summary.

    Reads per-agent cost files from data/costs/*.json plus the Editor's
    dedicated cost file at data/editor_cost.json.

    Returns:
        Dict with total_cost, total_calls, total_input_tokens, total_output_tokens,
        by_agent (list of per-agent dicts), by_model (aggregated model breakdown).
    """
    def _compute():
        by_agent = []
        by_model = {}  # tier -> {calls, input_tokens, output_tokens, cost}
        total_cost = 0.0
        total_calls = 0
        total_input = 0
        total_output = 0

        # 1. Read Editor's dedicated cost file
        editor_cost = read_editor_cost()
        if editor_cost.get("api_calls", 0) > 0:
            ec = editor_cost
            by_agent.append({
                "agent": "editor",
                "name": AGENT_NAMES.get("editor", "Editor"),
                "color": AGENT_COLORS.get("editor", "#f5c842"),
                "api_calls": ec.get("api_calls", 0),
                "input_tokens": ec.get("input_tokens", 0),
                "output_tokens": ec.get("output_tokens", 0),
                "total_cost": round(ec.get("total_cost", 0.0), 4),
            })
            total_cost += ec.get("total_cost", 0.0)
            total_calls += ec.get("api_calls", 0)
            total_input += ec.get("input_tokens", 0)
            total_output += ec.get("output_tokens", 0)

        # 2. Read per-agent cost files from data/costs/
        if os.path.exists(AGENT_COSTS_DIR):
            for fname in os.listdir(AGENT_COSTS_DIR):
                if not fname.endswith(".json"):
                    continue
                agent_id = fname.replace(".json", "")
                # Skip editor if already counted above (avoid double-counting)
                if agent_id == "editor":
                    # Merge into the existing editor entry's by_model data
                    fpath = os.path.join(AGENT_COSTS_DIR, fname)
                    try:
                        with open(fpath) as f:
                            data = json.load(f)
                        # Add this file's by_model data to aggregated by_model
                        for tier, m in data.get("by_model", {}).items():
                            if tier not in by_model:
                                by_model[tier] = {"calls": 0, "input_tokens": 0, "output_tokens": 0, "cost": 0.0}
                            by_model[tier]["calls"] += m.get("calls", 0)
                            by_model[tier]["input_tokens"] += m.get("input_tokens", 0)
                            by_model[tier]["output_tokens"] += m.get("output_tokens", 0)
                            by_model[tier]["cost"] = round(by_model[tier]["cost"] + m.get("cost", 0.0), 6)
                    except Exception:
                        pass
                    continue

                fpath = os.path.join(AGENT_COSTS_DIR, fname)
                try:
                    with open(fpath) as f:
                        data = json.load(f)
                except Exception:
                    continue

                calls = data.get("api_calls", 0)
                if calls == 0:
                    continue

                agent_cost = round(data.get("total_cost", 0.0), 4)
                by_agent.append({
                    "agent": agent_id,
                    "name": AGENT_NAMES.get(agent_id, agent_id.title()),
                    "color": AGENT_COLORS.get(agent_id, "#888888"),
                    "api_calls": calls,
                    "input_tokens": data.get("input_tokens", 0),
                    "output_tokens": data.get("output_tokens", 0),
                    "total_cost": agent_cost,
                })
                total_cost += data.get("total_cost", 0.0)
                total_calls += calls
                total_input += data.get("input_tokens", 0)
                total_output += data.get("output_tokens", 0)

                # Merge per-model breakdown
                for tier, m in data.get("by_model", {}).items():
                    if tier not in by_model:
                        by_model[tier] = {"calls": 0, "input_tokens": 0, "output_tokens": 0, "cost": 0.0}
                    by_model[tier]["calls"] += m.get("calls", 0)
                    by_model[tier]["input_tokens"] += m.get("input_tokens", 0)
                    by_model[tier]["output_tokens"] += m.get("output_tokens", 0)
                    by_model[tier]["cost"] = round(by_model[tier]["cost"] + m.get("cost", 0.0), 6)

        # Sort by_agent by cost descending
        by_agent.sort(key=lambda a: -a["total_cost"])

        return {
            "total_cost": round(total_cost, 4),
            "total_calls": total_calls,
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "by_agent": by_agent,
            "by_model": by_model,
        }

    return _cached("all_costs", 5, _compute)


def read_designer_training():
    """Read the Designer's training log and mode. Cached 60s."""
    def _compute():
        result = {"sources_studied": 0, "patterns_learned": 0, "mode": "training", "last_updated": None}
        if os.path.exists(DESIGNER_TRAINING_LOG_PATH):
            try:
                with open(DESIGNER_TRAINING_LOG_PATH) as f:
                    data = json.load(f)
                result["sources_studied"] = data.get("sources_studied", 0)
                result["patterns_learned"] = data.get("patterns_learned", 0)
                result["last_updated"] = data.get("last_updated")
            except Exception:
                pass
        if os.path.exists(DESIGNER_MODE_PATH):
            try:
                with open(DESIGNER_MODE_PATH) as f:
                    data = json.load(f)
                result["mode"] = data.get("mode", "training")
            except Exception:
                pass
        return result
    return _cached("designer_training", 60, _compute)


def build_throughput_from_lines(lines, manifest_stats, extraction_stats):
    """Calculate throughput rates from pre-read log lines."""
    rates = {
        "downloads_per_hour": 0,
        "extractions_per_hour": 0,
        "eta_hours": None,
    }

    if not lines:
        return rates

    try:
        download_times = []
        extract_times = []

        for line in lines:
            parts = line.strip().split("|", 3)
            if len(parts) < 4:
                continue
            timestamp_str, agent, level, message = parts
            try:
                ts = datetime.strptime(timestamp_str.strip(), "%Y-%m-%d %H:%M:%S")
            except ValueError:
                continue

            if agent.strip().upper() == "COURIER" and "download" in message.lower():
                download_times.append(ts)
            elif agent.strip().upper() == "READER" and ("extract" in message.lower() or "process" in message.lower()):
                extract_times.append(ts)

        now = datetime.now()
        window_hours = 2
        cutoff = now.timestamp() - (window_hours * 3600)

        recent_downloads = sum(1 for t in download_times if t.timestamp() > cutoff)
        recent_extractions = sum(1 for t in extract_times if t.timestamp() > cutoff)

        rates["downloads_per_hour"] = round(recent_downloads / window_hours, 1)
        rates["extractions_per_hour"] = round(recent_extractions / window_hours, 1)

        awaiting_download = max(0, manifest_stats["total"] - manifest_stats["downloaded"]
                                - manifest_stats["skipped"] - manifest_stats.get("no_pdf", 0))
        awaiting_extraction = max(0, manifest_stats["downloaded"] - extraction_stats["extracted"])

        if rates["downloads_per_hour"] > 0 and awaiting_download > 0:
            download_eta = awaiting_download / rates["downloads_per_hour"]
        else:
            download_eta = 0

        if rates["extractions_per_hour"] > 0 and awaiting_extraction > 0:
            extract_eta = awaiting_extraction / rates["extractions_per_hour"]
        else:
            extract_eta = 0

        total_eta = max(download_eta, extract_eta)
        if total_eta > 0:
            rates["eta_hours"] = round(total_eta, 1)

    except Exception:
        pass

    return rates


def build_throughput(manifest_stats, extraction_stats):
    """Calculate throughput rates and ETA based on activity log timestamps."""
    lines = _read_log_lines()
    return build_throughput_from_lines(lines, manifest_stats, extraction_stats)


def determine_agent_status(current, total, has_data):
    """Determine agent status based on progress."""
    if not has_data:
        return "idle"
    if current >= total and total > 0:
        return "done"
    if current > 0:
        return "working"
    return "idle"


def build_collaborations(manifest_stats, extraction_stats, xref_stats):
    """Detect handoff events between agents based on pipeline state."""
    collaborations = []

    unextracted = manifest_stats["downloaded"] - extraction_stats["extracted"]
    if unextracted > 0 and extraction_stats["extracted"] > 0:
        collaborations.append({
            "from": "courier",
            "to": "reader",
            "type": "handoff",
            "label": f"{unextracted} PDFs to extract"
        })

    unchecked = manifest_stats["with_homeowner"] - xref_stats["checked"]
    if unchecked > 0 and xref_stats["checked"] > 0:
        collaborations.append({
            "from": "reader",
            "to": "detective",
            "type": "handoff",
            "label": f"{unchecked} names to check"
        })

    undownloaded = manifest_stats["total"] - manifest_stats["downloaded"] - manifest_stats["skipped"] - manifest_stats["no_pdf"]
    if undownloaded > 0 and manifest_stats["downloaded"] > 0:
        collaborations.append({
            "from": "scout",
            "to": "courier",
            "type": "handoff",
            "label": f"{undownloaded} issues queued"
        })

    return collaborations


def build_log(manifest_stats, extraction_stats, xref_stats, log_lines=None):
    """Build a recent activity log from available data.

    When log_lines are provided, uses them instead of re-reading the file.
    """
    if log_lines is not None:
        live_entries = read_activity_log_from_lines(log_lines, max_lines=20)
    else:
        live_entries = read_activity_log(max_lines=20)

    if live_entries:
        return live_entries

    log = []
    if manifest_stats["total"] > 0:
        log.append({"time": "--:--", "agent": "Scout",
                     "event": f"Tracking {manifest_stats['total']} issues"})
    if manifest_stats["downloaded"] > 0:
        log.append({"time": "--:--", "agent": "Courier",
                     "event": f"{manifest_stats['downloaded']} PDFs downloaded"})
    if extraction_stats["extracted"] > 0:
        log.append({"time": "--:--", "agent": "Reader",
                     "event": f"{extraction_stats['features']} features from {extraction_stats['extracted']} issues"})
    if xref_stats["checked"] > 0:
        leads = xref_stats.get("leads", xref_stats.get("matches", 0))
        log.append({"time": "--:--", "agent": "Detective",
                     "event": f"Checked {xref_stats['checked']} names, {leads} leads"})

    return log


def build_pipeline(manifest_stats, extraction_stats, xref_stats, dossier_stats):
    """Build pipeline funnel: stages with counts for visualization."""
    return [
        {
            "stage": "Discovered",
            "agent": "scout",
            "count": manifest_stats["total"],
            "total": TOTAL_EXPECTED_ISSUES,
            "color": "#e74c3c",
        },
        {
            "stage": "Downloaded",
            "agent": "courier",
            "count": manifest_stats["downloaded"],
            "total": manifest_stats["total"],
            "color": "#3498db",
        },
        {
            "stage": "Extracted",
            "agent": "reader",
            "count": extraction_stats["extracted"],
            "total": manifest_stats["downloaded"],
            "color": "#2ecc71",
        },
        {
            "stage": "Cross-Ref'd",
            "agent": "detective",
            "count": xref_stats["checked"],
            "total": manifest_stats["with_homeowner"],
            "color": "#9b59b6",
        },
        {
            "stage": "Investigated",
            "agent": "researcher",
            "count": dossier_stats["investigated"],
            "total": xref_stats.get("leads", xref_stats.get("matches", 0)),
            "color": "#e67e22",
        },
    ]


def build_queue_depths(manifest_stats, extraction_stats, xref_stats):
    """Build queue depth between pipeline stages."""
    awaiting_download = (manifest_stats["total"]
                         - manifest_stats["downloaded"]
                         - manifest_stats["skipped"]
                         - manifest_stats["no_pdf"])
    awaiting_extraction = manifest_stats["downloaded"] - extraction_stats["extracted"]
    awaiting_xref = manifest_stats["with_homeowner"] - xref_stats["checked"]

    return [
        {"label": "awaiting download", "count": max(0, awaiting_download), "color": "#3498db"},
        {"label": "awaiting extraction", "count": max(0, awaiting_extraction), "color": "#2ecc71"},
        {"label": "awaiting xref", "count": max(0, awaiting_xref), "color": "#9b59b6"},
    ]


def build_now_processing(manifest_stats, extraction_stats, xref_stats, dossier_stats):
    """Infer what each agent is currently doing."""
    now = {}
    awaiting_download = (manifest_stats["total"]
                         - manifest_stats["downloaded"]
                         - manifest_stats["skipped"]
                         - manifest_stats["no_pdf"])
    awaiting_extraction = manifest_stats["downloaded"] - extraction_stats["extracted"]
    awaiting_xref = manifest_stats["with_homeowner"] - xref_stats["checked"]

    remaining_to_discover = TOTAL_EXPECTED_ISSUES - manifest_stats["total"]
    if manifest_stats["total"] == 0:
        now["scout"] = {"task": "Ready to discover", "active": False}
    elif remaining_to_discover > 0:
        now["scout"] = {"task": f"Found {manifest_stats['total']}/{TOTAL_EXPECTED_ISSUES} ({remaining_to_discover} remaining)", "active": True}
    else:
        now["scout"] = {"task": f"All {TOTAL_EXPECTED_ISSUES} issues indexed", "active": False}

    if awaiting_download > 0:
        now["courier"] = {"task": f"Downloading ({awaiting_download} remaining)", "active": True}
    elif manifest_stats["downloaded"] > 0:
        now["courier"] = {"task": f"All {manifest_stats['downloaded']} downloaded", "active": False}
    else:
        now["courier"] = {"task": "Waiting for Scout", "active": False}

    if awaiting_extraction > 0:
        now["reader"] = {"task": f"Extracting ({awaiting_extraction} remaining)", "active": True}
    elif extraction_stats["extracted"] > 0:
        now["reader"] = {"task": f"All {extraction_stats['extracted']} extracted", "active": False}
    else:
        now["reader"] = {"task": "Waiting for Courier", "active": False}

    if awaiting_xref > 0:
        now["detective"] = {"task": f"Checking ({awaiting_xref} remaining)", "active": True}
    elif xref_stats["checked"] > 0:
        now["detective"] = {"task": f"All {xref_stats['checked']} checked", "active": False}
    else:
        now["detective"] = {"task": "Waiting for Reader", "active": False}

    # Researcher
    researcher_leads = xref_stats.get("leads", xref_stats.get("matches", 0))
    if dossier_stats["investigated"] > 0:
        now["researcher"] = {"task": f"{dossier_stats['investigated']} dossiers built", "active": dossier_stats["investigated"] < researcher_leads}
    elif researcher_leads > 0:
        now["researcher"] = {"task": f"{researcher_leads} leads to investigate", "active": True}
    else:
        now["researcher"] = {"task": "Waiting for Detective leads", "active": False}

    # Editor
    editor_briefing = read_editor_briefing()
    if editor_briefing:
        now["editor"] = {"task": f"Pipeline: {editor_briefing}", "active": True}
    else:
        now["editor"] = {"task": "Supervising pipeline", "active": False}

    # Designer
    dt = read_designer_training()
    if dt["patterns_learned"] > 0:
        mode_label = "Training" if dt["mode"] == "training" else "Creating"
        now["designer"] = {
            "task": f"{mode_label}: {dt['patterns_learned']} patterns from {dt['sources_studied']} sources",
            "active": dt["mode"] == "creating" or dt["sources_studied"] > 0,
        }
    else:
        now["designer"] = {"task": "Training mode \u2014 studying design", "active": False}

    return now


# Notable names to tag as celebrity (case-insensitive partial match on last name)
CELEBRITY_NAMES = [
    "clooney", "crawford", "redford", "lauren", "berkus", "stewart",
    "broad", "systrom", "spielberg", "oprah", "pitt", "jolie",
    "kardashian", "jenner", "streisand", "cher", "madonna",
    "degeneres", "hanks", "bono", "bloomberg", "bezos", "musk",
    "zuckerberg", "gates", "buffett", "walton", "koch", "trump",
    "clinton", "obama", "bush", "kennedy", "rockefeller", "vanderbilt",
    "hilton", "winfrey", "gerber", "hirtenstein", "lebedev",
]


def build_notable_finds(extraction_stats, xref_stats, dossier_stats=None, researcher_live_task=""):
    """Build notable finds directly from xref leads — guarantees 1:1 match with XRef Leads stat."""
    finds = []
    by_name = xref_stats.get("by_name", {})
    dossier_by_name = (dossier_stats or {}).get("by_name", {})

    investigating_now = ""
    if researcher_live_task:
        lt = researcher_live_task.lower()
        if "investigating" in lt:
            investigating_now = researcher_live_task.split("Investigating ")[-1].split(" (")[0].lower().strip()
        elif "dossier:" in lt:
            investigating_now = researcher_live_task.split("Dossier: ")[-1].split(" (")[0].lower().strip()

    feature_by_name = {}
    for feat in extraction_stats.get("feature_list", []):
        n = feat.get("homeowner_name")
        if n:
            feature_by_name[n.lower().strip()] = feat

    for name_key, xref_entry in by_name.items():
        verdict = xref_entry["verdict"]
        bb_status = xref_entry.get("bb_status", "no_match")

        if verdict == "no_match" and bb_status != "match":
            continue

        display_name = xref_entry.get("original_name") or name_key.title()

        feat = feature_by_name.get(name_key, {})
        location_parts = [
            feat.get("location_city"),
            feat.get("location_state"),
            feat.get("location_country"),
        ]
        location = ", ".join(p for p in location_parts if p)

        if verdict not in ("no_match", None):
            status = verdict
        else:
            status = "bb_match"

        dossier_info = dossier_by_name.get(name_key)
        editor_verdict = None
        editor_reasoning = None
        if isinstance(dossier_info, dict):
            research = "dossier_complete"
            research_detail = dossier_info.get("strength")
            editor_verdict = dossier_info.get("editor_verdict") or None
            editor_reasoning = dossier_info.get("editor_reasoning") or None
        elif isinstance(dossier_info, str):
            research = "dossier_complete"
            research_detail = dossier_info
        elif investigating_now and name_key.startswith(investigating_now[:8]):
            research = "investigating"
            research_detail = None
        else:
            research = "queued"
            research_detail = None

        finds.append({
            "name": display_name,
            "issue": feat.get("issue", ""),
            "location": location,
            "type": "epstein_match",
            "status": status,
            "research": research,
            "research_detail": research_detail,
            "editor_verdict": editor_verdict,
            "editor_reasoning": editor_reasoning,
        })

    # Filter out rejected leads — they should not appear in Current Leads
    finds = [f for f in finds if (f.get("editor_verdict") or "").upper() != "REJECTED"]

    def sort_key(f):
        verdict_order = {"confirmed_match": 0, "likely_match": 1, "possible_match": 2, "needs_review": 3, "bb_match": 4, "pending": 5}
        return (verdict_order.get(f["status"], 6),)
    finds.sort(key=sort_key)

    return finds


def build_quality(extraction_stats):
    """Compute field completion rates across all features. Cached 30s."""
    def _compute():
        feature_list = extraction_stats.get("feature_list", [])
        total = len(feature_list)
        if total == 0:
            return {"total_features": 0, "fields": []}

        fields = [
            ("Names", "homeowner_name"),
            ("Location", "location_city"),
            ("Designer", "designer_name"),
            ("Year Built", "year_built"),
            ("Style", "design_style"),
            ("Sq Footage", "square_footage"),
        ]
        result = []
        for label, key in fields:
            filled = sum(1 for f in feature_list if f.get(key))
            pct = round(100 * filled / total)
            result.append({"label": label, "filled": filled, "total": total, "pct": pct})

        return {"total_features": total, "fields": result}
    return _cached("quality", 30, _compute)


def read_editor_ledger():
    """Read the EditorLedger and build a summary for the dashboard. Cached 15s."""
    def _compute():
        ledger_path = os.path.join(DATA_DIR, "editor_ledger.json")
        empty = {"stuck": [], "exhausted": [], "recent_failures": [],
                 "total_keys": 0, "total_failures": 0, "total_successes": 0}

        if not os.path.exists(ledger_path):
            return empty

        try:
            with open(ledger_path) as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            return empty

        max_failures = 3
        stuck = []
        exhausted = []
        all_failures = []
        total_failures = 0
        total_successes = 0

        for key, entries in data.items():
            failures = [e for e in entries if not e.get("success")]
            successes = [e for e in entries if e.get("success")]
            total_failures += len(failures)
            total_successes += len(successes)

            if not failures:
                continue

            last_fail = failures[-1]
            item = {
                "key": key,
                "failures": len(failures),
                "last_error": (last_fail.get("error") or last_fail.get("note", ""))[:80],
                "agent": last_fail.get("agent", ""),
                "task": last_fail.get("task", ""),
            }

            if len(failures) >= max_failures:
                exhausted.append(item)
            else:
                stuck.append(item)

            for f in failures:
                all_failures.append({
                    "key": key,
                    "agent": f.get("agent", ""),
                    "error": (f.get("error") or f.get("note", ""))[:60],
                    "time": f.get("time", ""),
                })

        stuck.sort(key=lambda x: -x["failures"])
        exhausted.sort(key=lambda x: -x["failures"])
        all_failures.sort(key=lambda x: x["time"], reverse=True)

        return {
            "stuck": stuck[:10],
            "exhausted": exhausted[:10],
            "recent_failures": all_failures[:8],
            "total_keys": len(data),
            "total_failures": total_failures,
            "total_successes": total_successes,
        }
    return _cached("editor_ledger", 15, _compute)


def _get_memory_count():
    """Get total episodic memory episode count. Cached 60s."""
    def _compute():
        try:
            from agents.memory import get_memory
            mem = get_memory()
            return mem.count() if mem else 0
        except Exception:
            return 0
    return _cached("memory_count", 60, _compute)


def build_coverage_map():
    """Build a year*month grid showing pipeline status. Uses cached issue rows. Cached 30s."""
    def _compute():
        coverage = {}
        for year in range(1988, 2026):
            coverage[str(year)] = {str(m): None for m in range(1, 13)}

        issue_rows = _cached("issue_rows", 10, _fetch_issue_rows)
        priority = {"extracted": 4, "downloaded": 3, "discovered": 2,
                    "skipped_pre1988": 1, "error": 1, "no_pdf": 1,
                    "extraction_error": 2}
        for row in issue_rows:
            y = row.get("year")
            m = row.get("month")
            s = row.get("status", "discovered")
            if y is None or m is None:
                continue
            yk = str(y)
            mk = str(m)
            if yk not in coverage or mk not in coverage.get(yk, {}):
                continue
            existing = coverage[yk][mk]
            if existing is None or priority.get(s, 0) > priority.get(existing, 0):
                coverage[yk][mk] = s

        return coverage
    return _cached("coverage_map", 30, _compute)


def _get_recent_memories(limit=20):
    """Get recent episodic memory episodes. Cached 60s."""
    def _compute():
        path = os.path.join(DATA_DIR, "agent_memory", "episodes.json")
        if not os.path.exists(path):
            return []
        try:
            with open(path) as f:
                episodes = json.load(f)
            recent = episodes[-limit:]
            result = []
            for ep in reversed(recent):
                ts = ep.get("timestamp", 0)
                time_str = datetime.fromtimestamp(ts).strftime("%I:%M %p") if ts else "?"
                result.append({
                    "agent": ep.get("agent", "?"),
                    "text": (ep.get("text", "")[:100] + "...") if len(ep.get("text", "")) > 100 else ep.get("text", ""),
                    "outcome": ep.get("outcome", "?"),
                    "time": time_str,
                })
            return result
        except Exception:
            return []
    return _cached("recent_memories", 60, _compute)


def _get_all_dossier_details():
    """Get all dossiers for popup. Reuses cached dossier rows. Cached 60s."""
    def _compute():
        rows = _cached("dossier_rows", 60, _fetch_dossier_rows)
        if rows:
            details = []
            for d in rows:
                name = (d.get("subject_name") or "").strip()
                if not name:
                    continue
                strength = (d.get("connection_strength") or "").upper()
                details.append({
                    "name": name,
                    "strength": strength.lower() if strength else "unknown",
                    "strength_rationale": (d.get("strength_rationale") or "")[:150],
                    "editor_verdict": (d.get("editor_verdict") or "").upper() or None,
                    "editor_reasoning": (d.get("editor_reasoning") or "")[:150] or None,
                })
            strength_order = {"high": 0, "medium": 1, "low": 2, "coincidence": 3, "unknown": 4}
            details.sort(key=lambda d: (
                0 if d.get("editor_verdict") == "CONFIRMED" else 1,
                strength_order.get(d["strength"], 5),
            ))
            return details

        # Fallback: local file
        master_path = os.path.join(DOSSIERS_DIR, "all_dossiers.json")
        if os.path.exists(master_path):
            try:
                with open(master_path) as f:
                    dossiers = json.load(f)
                details = []
                for d in dossiers:
                    name = (d.get("subject_name") or "").strip()
                    if not name:
                        continue
                    strength = (d.get("connection_strength") or "").upper()
                    details.append({
                        "name": name,
                        "strength": strength.lower() if strength else "unknown",
                        "strength_rationale": (d.get("strength_rationale") or "")[:150],
                        "editor_verdict": None,
                        "editor_reasoning": None,
                    })
                return details
            except Exception:
                pass

        return []
    return _cached("dossier_details", 60, _compute)


def generate_status():
    """Generate the full status JSON."""
    manifest_stats = read_pipeline_stats()
    extraction_stats = read_extractions()
    xref_stats = read_xref()
    dossier_stats = read_dossiers()

    # Read log lines once — used by both log display and throughput
    log_lines = _read_log_lines()

    confirmed_names_list = dossier_stats.get("confirmed_names", [])
    confirmed_associates = len(confirmed_names_list)

    # Single source of truth for active leads — used by stats, agents, and Current Leads panel
    notable_finds = build_notable_finds(extraction_stats, xref_stats, dossier_stats)
    active_leads = len(notable_finds)

    # Determine statuses
    scout_status = "working" if 0 < manifest_stats["total"] < TOTAL_EXPECTED_ISSUES else (
        "done" if manifest_stats["total"] >= TOTAL_EXPECTED_ISSUES else "idle"
    )
    courier_status = determine_agent_status(
        manifest_stats["downloaded"], manifest_stats["total"],
        manifest_stats["total"] > 0
    )
    reader_status = determine_agent_status(
        extraction_stats["extracted"], manifest_stats["downloaded"],
        manifest_stats["downloaded"] > 0
    )
    detective_status = determine_agent_status(
        xref_stats["checked"], manifest_stats["with_homeowner"],
        manifest_stats["with_homeowner"] > 0
    )
    researcher_status = determine_agent_status(
        dossier_stats["investigated"], active_leads,
        active_leads > 0
    )

    # Scout message
    if manifest_stats["total"] > 0:
        scout_msg = f"Found {manifest_stats['total']} of {TOTAL_EXPECTED_ISSUES} issues"
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
    if active_leads > 0:
        detective_msg = f"{active_leads} leads found in {xref_stats['checked']} names checked"
    elif xref_stats["checked"] > 0:
        detective_msg = f"No matches yet ({xref_stats['checked']} names checked)"
    else:
        detective_msg = "Waiting for extracted names..."

    # Researcher message
    if dossier_stats["investigated"] > 0:
        researcher_msg = f"{dossier_stats['investigated']} dossiers ({dossier_stats['high']} HIGH, {dossier_stats['medium']} MED)"
    elif active_leads > 0:
        researcher_msg = f"{active_leads} leads to investigate"
    else:
        researcher_msg = "Waiting for leads..."

    # Editor message
    editor_briefing = read_editor_briefing()
    if editor_briefing:
        editor_status = "working"
        editor_msg = f"Pipeline: {editor_briefing}"
    else:
        editor_status = "idle"
        editor_msg = "Supervising pipeline"

    # Designer message
    designer_training = read_designer_training()
    if designer_training["patterns_learned"] > 0:
        mode_label = "Training" if designer_training["mode"] == "training" else "Creating"
        designer_msg = f"{mode_label}: {designer_training['patterns_learned']} patterns from {designer_training['sources_studied']} sources"
        designer_status = "idle"
        if designer_training["last_updated"]:
            try:
                last_dt = datetime.fromisoformat(designer_training["last_updated"])
                if (datetime.now() - last_dt).total_seconds() < 1800:
                    designer_status = "working"
            except Exception:
                pass
    else:
        designer_status = "idle"
        designer_msg = "Training mode \u2014 studying design patterns"

    cost_data = read_all_costs()
    throughput = build_throughput_from_lines(log_lines, manifest_stats, extraction_stats)

    status = {
        "title": "AD-EPSTEIN INDEX \u2014 AGENT OFFICE",
        "subtitle": "Architectural Digest research pipeline",
        "timestamp": datetime.now().isoformat(),
        "agents": [
            {
                "id": "scout",
                "name": "Arthur",
                "role": "Discovers AD issues on archive.org",
                "status": scout_status,
                "message": scout_msg,
                "color": "#e74c3c",
                "deskItems": ["magnifier", "globe"],
                "progress": {"current": manifest_stats["total"], "total": TOTAL_EXPECTED_ISSUES}
            },
            {
                "id": "courier",
                "name": "Casey",
                "role": "Downloads & delivers PDFs",
                "status": courier_status,
                "message": courier_msg,
                "color": "#3498db",
                "deskItems": ["folder", "document"],
                "progress": {"current": manifest_stats["downloaded"], "total": manifest_stats["total"]}
            },
            {
                "id": "reader",
                "name": "Elias",
                "role": "Extracts homeowners & data",
                "status": reader_status,
                "message": reader_msg,
                "color": "#2ecc71",
                "deskItems": ["book", "pencil"],
                "progress": {"current": manifest_stats["distinct_issues"], "total": manifest_stats["downloaded"]}
            },
            {
                "id": "detective",
                "name": "Silas",
                "role": "Cross-refs against Epstein docs",
                "status": detective_status,
                "message": detective_msg,
                "color": "#9b59b6",
                "deskItems": ["detective-hat", "clipboard"],
                "progress": {"current": xref_stats["checked"], "total": manifest_stats["with_homeowner"]}
            },
            {
                "id": "researcher",
                "name": "Elena",
                "role": "Investigates matches & builds dossiers",
                "status": researcher_status,
                "message": researcher_msg,
                "color": "#e67e22",
                "deskItems": ["notebook", "magnifier"],
                "progress": {"current": dossier_stats["investigated"], "total": active_leads}
            },
            {
                "id": "editor",
                "name": "Miranda",
                "role": "Supervises pipeline strategy",
                "status": editor_status,
                "message": editor_msg,
                "color": "#f5c842",
                "deskItems": ["briefcase", "memo"],
                "progress": {"current": 0, "total": 0}
            },
            {
                "id": "designer",
                "name": "Sable",
                "role": "Designs Phase 3 website",
                "status": designer_status,
                "message": designer_msg,
                "color": "#e91e63",
                "deskItems": ["palette", "ruler"],
                "progress": {"current": designer_training["sources_studied"], "total": designer_training["patterns_learned"]}
            }
        ],
        "stats": [
            {"label": "Discovered", "value": manifest_stats["total"], "total": TOTAL_EXPECTED_ISSUES},
            {"label": "Downloaded Issues", "value": manifest_stats["downloaded"]},
            {"label": "Extracted Issues", "value": manifest_stats["distinct_issues"]},
            {"label": "Names", "value": xref_stats["checked"], "total": manifest_stats["with_homeowner"]},
            {"label": "XRef Leads", "value": active_leads},
            {"label": "Dossiers", "value": dossier_stats["investigated"],
             "popup_type": "dossiers", "details": _get_all_dossier_details()},
            {"label": "Confirmed", "value": confirmed_associates,
             "popup_type": "confirmed", "details": dossier_stats.get("confirmed_names", [])},
            {"label": "Memories", "value": _get_memory_count(),
             "popup_type": "memories", "details": _get_recent_memories()},
        ],
        "collaborations": build_collaborations(manifest_stats, extraction_stats, xref_stats),
        "log": build_log(manifest_stats, extraction_stats, xref_stats, log_lines=log_lines),
        "now_processing": build_now_processing(manifest_stats, extraction_stats, xref_stats, dossier_stats),
        "editor_inbox": read_combined_inbox(),
        "bulletin": read_bulletin_notes(),
        "watercooler": read_watercooler(),
        "notable_finds": notable_finds,
        "quality": build_quality(extraction_stats),
        "cost": cost_data,
        "coverage_map": build_coverage_map(),
        "editor_ledger": read_editor_ledger(),
    }

    return status


def write_skills_json():
    """Write skills.json alongside status.json for static dashboard access.

    Reads all agent skill .md files and writes them as a JSON bundle.
    Only rewrites if any skill file is newer than the existing skills.json.
    """
    if not os.path.exists(SKILLS_DIR):
        return

    # Check if any skill file is newer than skills.json (skip if not)
    if os.path.exists(SKILLS_PATH):
        skills_mtime = os.path.getmtime(SKILLS_PATH)
        any_newer = False
        for fname in os.listdir(SKILLS_DIR):
            if fname.endswith(".md"):
                if os.path.getmtime(os.path.join(SKILLS_DIR, fname)) > skills_mtime:
                    any_newer = True
                    break
        if not any_newer:
            return

    skills_list = []
    content_map = {}
    for fname in sorted(os.listdir(SKILLS_DIR)):
        if not fname.endswith(".md"):
            continue
        agent_name = fname[:-3]
        skills_list.append({"agent": agent_name, "file": fname})
        try:
            with open(os.path.join(SKILLS_DIR, fname)) as f:
                content_map[agent_name] = f.read()
        except IOError:
            content_map[agent_name] = "(failed to read)"

    data = {"skills": skills_list, "content": content_map}
    os.makedirs(os.path.dirname(SKILLS_PATH), exist_ok=True)
    with open(SKILLS_PATH, "w") as f:
        json.dump(data, f)


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
