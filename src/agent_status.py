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

sys.path.insert(0, os.path.dirname(__file__))

from db import get_supabase, count_issues_by_status

# Total expected AD issues: 12/year from 1988 to 2025 = 38 years × 12 = 456
TOTAL_EXPECTED_ISSUES = 456

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


def read_pipeline_stats():
    """Read pipeline stats from Supabase (single source of truth).

    Returns a dict compatible with the old manifest_stats format, plus feature counts.
    """
    try:
        counts = count_issues_by_status()
        sb = get_supabase()
        feat_result = sb.table("features").select("id,homeowner_name,issue_id", count="exact").execute()
        total_features = feat_result.count or len(feat_result.data)
        with_name = sum(1 for r in feat_result.data if r.get("homeowner_name"))
        distinct_issues = len(set(r["issue_id"] for r in feat_result.data if r.get("issue_id")))

        return {
            # Issue counts (replaces read_manifest)
            "total": counts["total"],
            "downloaded": counts["downloaded"] + counts["extracted"],  # Both have PDFs
            "extracted": counts["extracted"],
            "skipped": counts.get("skipped_pre1988", 0),
            "errors": counts.get("error", 0),
            "no_pdf": counts.get("no_pdf", 0),
            # Feature counts (replaces read_supabase_stats)
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


def read_extractions():
    """Read extraction results and return summary + feature list."""
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


def read_xref():
    """Read cross-reference results from results.json and return summary."""
    results_path = os.path.join(XREF_DIR, "results.json")
    if not os.path.exists(results_path):
        return {"checked": 0, "matches": 0, "leads": 0, "verdicts": {}, "by_name": {}}
    try:
        with open(results_path) as f:
            results = json.load(f)
        checked = len(results)
        # BB-only matches (legacy)
        matches = sum(1 for r in results if r.get("black_book_status") == "match")
        # All leads = any non-no_match verdict OR BB match
        leads = sum(1 for r in results
                    if r.get("combined_verdict", "no_match") != "no_match"
                    or r.get("black_book_status") == "match")
        # Verdict breakdown
        verdicts = {}
        # Per-name lookup for notable finds
        by_name = {}
        for r in results:
            v = r.get("combined_verdict", "no_match")
            verdicts[v] = verdicts.get(v, 0) + 1
            name = r.get("homeowner_name", "").lower().strip()
            if name:
                by_name[name] = {
                    "verdict": v,
                    "bb_status": r.get("black_book_status", "no_match"),
                    "confidence": r.get("confidence_score", 0.0),
                }
        return {"checked": checked, "matches": matches, "leads": leads,
                "verdicts": verdicts, "by_name": by_name}
    except Exception:
        return {"checked": 0, "matches": 0, "leads": 0, "verdicts": {}, "by_name": {}}


def read_dossiers():
    """Read dossier stats and per-name results."""
    empty = {"investigated": 0, "high": 0, "medium": 0, "low": 0, "by_name": {}}
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
            s = d.get("connection_strength", "").upper()
            if s in strengths:
                strengths[s] += 1
            name = d.get("subject_name", "").strip()
            if name:
                by_name[name.lower()] = s.lower()
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


def read_activity_log(max_lines=20):
    """Read recent entries from the agent activity log."""
    if not os.path.exists(ACTIVITY_LOG_PATH):
        return []

    entries = []
    try:
        with open(ACTIVITY_LOG_PATH) as f:
            lines = f.readlines()
        for line in lines[-max_lines:]:
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
    except Exception:
        pass
    return entries


def read_editor_briefing():
    """Read the latest editor briefing summary."""
    if not os.path.exists(BRIEFING_PATH):
        return None
    try:
        with open(BRIEFING_PATH) as f:
            text = f.read().strip()
        # Extract the health line
        for line in text.split("\n"):
            if "Pipeline Health:" in line:
                return line.split("Pipeline Health:")[-1].strip()
        return "Briefing available"
    except Exception:
        return None


EDITOR_MESSAGES_PATH = os.path.join(DATA_DIR, "editor_messages.json")
HUMAN_MESSAGES_PATH = os.path.join(DATA_DIR, "human_messages.json")


def read_combined_inbox(max_messages=20):
    """Read and combine editor + human messages, most recent first."""
    editor_msgs = []
    human_msgs = []

    if os.path.exists(EDITOR_MESSAGES_PATH):
        try:
            with open(EDITOR_MESSAGES_PATH) as f:
                editor_msgs = json.load(f)
            for m in editor_msgs:
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
    # Sort by timestamp (ISO format), falling back to time string
    combined.sort(key=lambda m: m.get("timestamp", m.get("time", "")))
    # Most recent first, capped
    return combined[-max_messages:][::-1]


def read_editor_cost():
    """Read the editor's API cost tracking data."""
    if not os.path.exists(COST_PATH):
        return {"api_calls": 0, "total_cost": 0.0, "input_tokens": 0, "output_tokens": 0}
    try:
        with open(COST_PATH) as f:
            return json.load(f)
    except Exception:
        return {"api_calls": 0, "total_cost": 0.0, "input_tokens": 0, "output_tokens": 0}


def read_designer_training():
    """Read the Designer's training log and mode for real status reporting."""
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


def build_throughput(manifest_stats, extraction_stats):
    """Calculate throughput rates and ETA based on activity log timestamps."""
    rates = {
        "downloads_per_hour": 0,
        "extractions_per_hour": 0,
        "eta_hours": None,
    }

    # Calculate from activity log timestamps
    if not os.path.exists(ACTIVITY_LOG_PATH):
        return rates

    try:
        with open(ACTIVITY_LOG_PATH) as f:
            lines = f.readlines()

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

        # Calculate rate: events in last 2 hours
        window_hours = 2
        cutoff = now.timestamp() - (window_hours * 3600)

        recent_downloads = sum(1 for t in download_times if t.timestamp() > cutoff)
        recent_extractions = sum(1 for t in extract_times if t.timestamp() > cutoff)

        rates["downloads_per_hour"] = round(recent_downloads / window_hours, 1)
        rates["extractions_per_hour"] = round(recent_extractions / window_hours, 1)

        # ETA: how long until all pipeline work is done
        awaiting_download = max(0, manifest_stats["total"] - manifest_stats["downloaded"]
                                - manifest_stats["skipped"] - manifest_stats.get("no_pdf", 0))
        awaiting_extraction = max(0, manifest_stats["downloaded"] - extraction_stats["extracted"])

        # Use the slowest bottleneck for ETA
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

    # Courier → Reader: when there are downloads that haven't been extracted yet
    unextracted = manifest_stats["downloaded"] - extraction_stats["extracted"]
    if unextracted > 0 and extraction_stats["extracted"] > 0:
        collaborations.append({
            "from": "courier",
            "to": "reader",
            "type": "handoff",
            "label": f"{unextracted} PDFs to extract"
        })

    # Reader → Detective: when there are features that haven't been cross-referenced yet
    unchecked = extraction_stats["features"] - xref_stats["checked"]
    if unchecked > 0 and xref_stats["checked"] > 0:
        collaborations.append({
            "from": "reader",
            "to": "detective",
            "type": "handoff",
            "label": f"{unchecked} names to check"
        })

    # Scout → Courier: when there are discovered issues not yet downloaded
    undownloaded = manifest_stats["total"] - manifest_stats["downloaded"] - manifest_stats["skipped"] - manifest_stats["no_pdf"]
    if undownloaded > 0 and manifest_stats["downloaded"] > 0:
        collaborations.append({
            "from": "scout",
            "to": "courier",
            "type": "handoff",
            "label": f"{undownloaded} issues queued"
        })

    return collaborations


def build_log(manifest_stats, extraction_stats, xref_stats):
    """Build a recent activity log from available data.

    Prioritizes real timestamped events from agent_activity.log.
    Only falls back to pipeline summary if no real log entries exist.
    When the orchestrator is running, it replaces this entirely with live log data.
    """
    # Real activity log entries always take priority
    live_entries = read_activity_log(max_lines=20)
    if live_entries:
        return live_entries

    # Fallback: pipeline summary (only when no activity log exists)
    # These are marked with "--:--" to distinguish from real timestamps
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
            "total": extraction_stats["features"],
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
    awaiting_xref = extraction_stats["features"] - xref_stats["checked"]

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
    awaiting_xref = extraction_stats["features"] - xref_stats["checked"]

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
    """Scan features for notable/celebrity names and Epstein matches.

    Names that have been checked by the Detective and found to be no_match
    are removed. Names with matches are shown with their verdict.
    Research status shows whether the Researcher is investigating each lead.
    """
    finds = []
    seen = set()
    by_name = xref_stats.get("by_name", {})
    dossier_by_name = (dossier_stats or {}).get("by_name", {})

    # Parse Researcher's current task to find who's being investigated right now
    investigating_now = ""
    if researcher_live_task:
        # Format: "Investigating Name (verdict)..." or "Dossier: Name (strength)"
        lt = researcher_live_task.lower()
        if "investigating" in lt:
            investigating_now = researcher_live_task.split("Investigating ")[-1].split(" (")[0].lower().strip()
        elif "dossier:" in lt:
            investigating_now = researcher_live_task.split("Dossier: ")[-1].split(" (")[0].lower().strip()

    for feat in extraction_stats.get("feature_list", []):
        name = feat.get("homeowner_name")
        if not name:
            continue

        # Deduplicate by lowercase name
        key = name.lower().strip()
        if key in seen:
            continue
        seen.add(key)

        # Check xref status — skip names already cleared as no_match
        xref_entry = by_name.get(key)
        if xref_entry and xref_entry["verdict"] == "no_match" and xref_entry["bb_status"] == "no_match":
            continue  # Cleared by Detective — remove from notable finds

        location_parts = [
            feat.get("location_city"),
            feat.get("location_state"),
            feat.get("location_country"),
        ]
        location = ", ".join(p for p in location_parts if p)

        # Determine type: Epstein match > celebrity > notable
        if xref_entry and xref_entry["verdict"] not in ("no_match", None):
            find_type = "epstein_match"
            status = xref_entry["verdict"]
        elif any(celeb in key for celeb in CELEBRITY_NAMES):
            find_type = "celebrity"
            status = "pending" if not xref_entry else "cleared"
        else:
            continue  # Not a celebrity and not an Epstein match — skip

        if status == "cleared":
            continue  # Celebrity checked and cleared

        # Determine research status
        if key in dossier_by_name:
            research = "dossier_complete"
            research_detail = dossier_by_name[key]  # connection strength
        elif investigating_now and key.startswith(investigating_now[:8]):
            research = "investigating"
            research_detail = None
        elif find_type == "epstein_match":
            research = "queued"
            research_detail = None
        else:
            research = None
            research_detail = None

        finds.append({
            "name": name,
            "issue": feat.get("issue", ""),
            "location": location,
            "type": find_type,
            "status": status,
            "research": research,
            "research_detail": research_detail,
        })

    # Sort: epstein matches first, then celebrities
    type_order = {"epstein_match": 0, "celebrity": 1, "notable": 2}
    finds.sort(key=lambda f: type_order.get(f["type"], 3))

    return finds


def build_quality(extraction_stats):
    """Compute field completion rates across all features."""
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


def read_editor_ledger():
    """Read the EditorLedger and build a summary for the dashboard.

    Returns:
        {
            "stuck": [ { "key": "...", "failures": N, "last_error": "...", "agent": "...", "task": "..." } ],
            "exhausted": [ { "key": "...", "failures": N, "last_error": "...", "agent": "...", "task": "..." } ],
            "recent_failures": [ { "key": "...", "agent": "...", "error": "...", "time": "..." } ],
            "total_keys": N,
            "total_failures": N,
            "total_successes": N,
        }
    """
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

    # Sort: most failures first for stuck/exhausted
    stuck.sort(key=lambda x: -x["failures"])
    exhausted.sort(key=lambda x: -x["failures"])

    # Recent failures: sorted by time, most recent first
    all_failures.sort(key=lambda x: x["time"], reverse=True)

    return {
        "stuck": stuck[:10],
        "exhausted": exhausted[:10],
        "recent_failures": all_failures[:8],
        "total_keys": len(data),
        "total_failures": total_failures,
        "total_successes": total_successes,
    }


def build_coverage_map():
    """Build a year×month grid showing pipeline status for each AD issue.

    Returns dict: { "1988": {"1": "extracted", "2": null, ...}, ... }
    Status priority: extracted > downloaded > discovered > null
    """
    coverage = {}
    # Initialize all months as null (1988-2025)
    for year in range(1988, 2026):
        coverage[str(year)] = {str(m): None for m in range(1, 13)}

    try:
        sb = get_supabase()
        result = sb.table("issues").select("year,month,status").execute()
        # Status priority for when multiple issues share a month
        priority = {"extracted": 4, "downloaded": 3, "discovered": 2,
                    "skipped_pre1988": 1, "error": 1, "no_pdf": 1,
                    "extraction_error": 2}
        for row in result.data:
            y = row.get("year")
            m = row.get("month")
            s = row.get("status", "discovered")
            if y is None or m is None:
                continue
            yk = str(y)
            mk = str(m)
            if yk not in coverage or mk not in coverage.get(yk, {}):
                continue
            # Keep the highest-priority status
            existing = coverage[yk][mk]
            if existing is None or priority.get(s, 0) > priority.get(existing, 0):
                coverage[yk][mk] = s
    except Exception:
        pass

    return coverage


def generate_status():
    """Generate the full status JSON."""
    manifest_stats = read_pipeline_stats()
    extraction_stats = read_extractions()
    xref_stats = read_xref()
    dossier_stats = read_dossiers()

    # Count confirmed Epstein associates from dossiers
    confirmed_associates = dossier_stats.get("high", 0) + dossier_stats.get("medium", 0)

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
        xref_stats["checked"], extraction_stats["features"],
        extraction_stats["features"] > 0
    )
    researcher_leads = xref_stats.get("leads", xref_stats.get("matches", 0))
    researcher_status = determine_agent_status(
        dossier_stats["investigated"], researcher_leads,
        researcher_leads > 0
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
    detective_leads = xref_stats.get("leads", xref_stats.get("matches", 0))
    if detective_leads > 0:
        detective_msg = f"{detective_leads} leads found in {xref_stats['checked']} names checked"
    elif xref_stats["checked"] > 0:
        detective_msg = f"No matches yet ({xref_stats['checked']} names checked)"
    else:
        detective_msg = "Waiting for extracted names..."

    # Researcher message
    if dossier_stats["investigated"] > 0:
        researcher_msg = f"{dossier_stats['investigated']} dossiers ({dossier_stats['high']} HIGH, {dossier_stats['medium']} MED)"
    elif researcher_leads > 0:
        researcher_msg = f"{researcher_leads} leads to investigate"
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
        # Consider "working" if training log was updated recently (within 30 min)
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

    cost_data = read_editor_cost()
    throughput = build_throughput(manifest_stats, extraction_stats)

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
                "progress": {"current": manifest_stats["total"], "total": TOTAL_EXPECTED_ISSUES}
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
                "progress": {"current": manifest_stats["distinct_issues"], "total": manifest_stats["downloaded"]}
            },
            {
                "id": "detective",
                "name": "Detective",
                "role": "Cross-refs against Epstein docs",
                "status": detective_status,
                "message": detective_msg,
                "color": "#9b59b6",
                "deskItems": ["detective-hat", "clipboard"],
                "progress": {"current": xref_stats["checked"], "total": manifest_stats["total_features"]}
            },
            {
                "id": "researcher",
                "name": "Researcher",
                "role": "Investigates matches & builds dossiers",
                "status": researcher_status,
                "message": researcher_msg,
                "color": "#e67e22",
                "deskItems": ["notebook", "magnifier"],
                "progress": {"current": dossier_stats["investigated"], "total": researcher_leads}
            },
            {
                "id": "editor",
                "name": "Editor",
                "role": "Supervises pipeline strategy",
                "status": editor_status,
                "message": editor_msg,
                "color": "#f5c842",
                "deskItems": ["briefcase", "memo"],
                "progress": {"current": 0, "total": 0}
            },
            {
                "id": "designer",
                "name": "Designer",
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
            {"label": "Features", "value": manifest_stats["total_features"]},
            {"label": "XRef Leads", "value": xref_stats.get("leads", xref_stats.get("matches", 0))},
            {"label": "Dossiers", "value": dossier_stats["investigated"]},
            {"label": "Confirmed", "value": confirmed_associates, "details": dossier_stats.get("confirmed_names", [])},
        ],
        "collaborations": build_collaborations(manifest_stats, extraction_stats, xref_stats),
        "log": build_log(manifest_stats, extraction_stats, xref_stats),
        "pipeline": build_pipeline(manifest_stats, extraction_stats, xref_stats, dossier_stats),
        "queue_depths": build_queue_depths(manifest_stats, extraction_stats, xref_stats),
        "now_processing": build_now_processing(manifest_stats, extraction_stats, xref_stats, dossier_stats),
        "editor_inbox": read_combined_inbox(),
        "notable_finds": build_notable_finds(extraction_stats, xref_stats, dossier_stats),
        "quality": build_quality(extraction_stats),
        "throughput": throughput,
        "cost": cost_data,
        "coverage_map": build_coverage_map(),
        "editor_ledger": read_editor_ledger(),
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
