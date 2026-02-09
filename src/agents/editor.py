"""
Editor Agent — LLM-powered pipeline supervisor.

Calls Claude Opus for strategic reasoning about pipeline health.
Reads situation reports from all agents, writes briefings for the human,
and reads directives from the human inbox.

Interval: 45s.
"""

import asyncio
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agents.base import Agent, DATA_DIR, LOG_PATH, update_json_locked, read_json_locked

BRIEFING_PATH = os.path.join(DATA_DIR, "editor_briefing.md")
INBOX_PATH = os.path.join(DATA_DIR, "editor_inbox.md")
MESSAGES_PATH = os.path.join(DATA_DIR, "editor_messages.json")
HUMAN_MESSAGES_PATH = os.path.join(DATA_DIR, "human_messages.json")
COST_PATH = os.path.join(DATA_DIR, "editor_cost.json")
MEMORY_PATH = os.path.join(DATA_DIR, "editor_memory.json")
REEXTRACT_QUEUE_PATH = os.path.join(DATA_DIR, "reader_reextract_queue.json")
MAX_MESSAGES = 50
MAX_MEMORY_ENTRIES = 100

# Opus pricing per 1M tokens (as of 2025)
HAIKU_INPUT_COST_PER_1M = 15.00   # $15/1M input tokens
HAIKU_OUTPUT_COST_PER_1M = 75.00  # $75/1M output tokens


class EditorAgent(Agent):
    def __init__(self, workers=None):
        """
        Args:
            workers: Dict of agent_name -> Agent instance (the agents to supervise)
        """
        super().__init__("editor", interval=5)  # Fast poll — checks for human messages
        self.workers = workers or {}
        self._last_assessment = None
        self._last_haiku_time = 0
        self._health_check_interval = 300  # Safety net health check every 5 minutes
        self._last_escalation_snapshot = {}  # Track seen escalation counts per agent
        self._last_log_line_count = 0  # Track activity log length for milestone detection
        self._client = None
        self._editor_state = "idle"  # idle, monitoring, listening, assessing, happy
        self._happy_until = 0  # Timestamp until which "happy" state persists
        self._api_calls = 0
        self._total_input_tokens = 0
        self._total_output_tokens = 0
        self._total_cost = 0.0
        self._load_cost_state()
        # Track restart in memory
        memory = self._load_memory()
        memory["restart_count"] = memory.get("restart_count", 0) + 1
        self._last_health = memory.get("last_assessment_health")
        self._save_memory(memory)

    def _get_client(self):
        """Lazy-init the Anthropic client."""
        if self._client is None:
            import anthropic
            self._client = anthropic.Anthropic()
        return self._client

    def _load_cost_state(self):
        """Load persisted cost tracking from disk."""
        if os.path.exists(COST_PATH):
            try:
                with open(COST_PATH) as f:
                    data = json.load(f)
                self._api_calls = data.get("api_calls", 0)
                self._total_input_tokens = data.get("input_tokens", 0)
                self._total_output_tokens = data.get("output_tokens", 0)
                self._total_cost = data.get("total_cost", 0.0)
            except Exception:
                pass

    def _save_cost_state(self):
        """Persist cost tracking to disk."""
        data = {
            "api_calls": self._api_calls,
            "input_tokens": self._total_input_tokens,
            "output_tokens": self._total_output_tokens,
            "total_cost": self._total_cost,
            "last_updated": datetime.now().isoformat(),
        }
        os.makedirs(os.path.dirname(COST_PATH), exist_ok=True)
        with open(COST_PATH, "w") as f:
            json.dump(data, f)

    def _track_usage(self, response):
        """Track token usage and cost from an API response."""
        usage = response.usage
        input_tokens = usage.input_tokens
        output_tokens = usage.output_tokens
        cost = (input_tokens / 1_000_000 * HAIKU_INPUT_COST_PER_1M +
                output_tokens / 1_000_000 * HAIKU_OUTPUT_COST_PER_1M)
        self._api_calls += 1
        self._total_input_tokens += input_tokens
        self._total_output_tokens += output_tokens
        self._total_cost += cost
        self._save_cost_state()

    # ── Memory ──────────────────────────────────────────────

    def _load_memory(self):
        """Load the Editor's persistent memory (observations, decisions, learnings)."""
        if os.path.exists(MEMORY_PATH):
            try:
                with open(MEMORY_PATH) as f:
                    return json.load(f)
            except Exception:
                pass
        return {"entries": [], "last_assessment_health": None, "restart_count": 0}

    def _save_memory(self, memory):
        """Persist the Editor's memory to disk."""
        # Cap entries to prevent unbounded growth
        if len(memory.get("entries", [])) > MAX_MEMORY_ENTRIES:
            memory["entries"] = memory["entries"][-MAX_MEMORY_ENTRIES:]
        os.makedirs(os.path.dirname(MEMORY_PATH), exist_ok=True)
        with open(MEMORY_PATH, "w") as f:
            json.dump(memory, f, indent=2)

    def _remember(self, category, text):
        """Add an entry to persistent memory."""
        memory = self._load_memory()
        memory["entries"].append({
            "time": datetime.now().isoformat(),
            "category": category,
            "text": text,
        })
        self._save_memory(memory)

    def _get_memory_summary(self):
        """Build a concise summary of recent memory for the situation report."""
        memory = self._load_memory()
        entries = memory.get("entries", [])
        if not entries:
            return "No prior observations recorded."

        # Last 15 entries, grouped by category
        recent = entries[-15:]
        lines = []
        for e in recent:
            lines.append(f"[{e['category']}] {e['text']}")
        return "\n".join(lines)

    # ── Quality Control ────────────────────────────────────

    def _build_quality_report(self):
        """Audit Supabase (source of truth) for data quality issues.

        Checks for:
        - NULL homeowner_name entries (should be deleted or re-extracted)
        - Exact duplicates (same name + same issue_id)
        - Near-duplicates (similar names in the same issue)
        - Issues with high null rates that need re-extraction
        """
        report = {
            "total_features": 0,
            "supabase_nulls": [],
            "duplicates": [],
            "near_duplicates": [],
            "issues_needing_reextraction": [],
            "issue_identifier_map": {},  # issue_id → archive.org identifier
        }

        try:
            from dotenv import load_dotenv
            load_dotenv()
            from supabase import create_client
            sb = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))

            # Get all features from Supabase
            all_features = sb.table("features").select("id,homeowner_name,article_title,issue_id,page_number").execute()
            features = all_features.data
            report["total_features"] = len(features)

            # Get issues for identifier mapping
            all_issues = sb.table("issues").select("id,month,year").execute()
            issue_map = {row["id"]: row for row in all_issues.data}

            # Build identifier map (issue_id → archive.org identifier)
            manifest_path = os.path.join(DATA_DIR, "archive_manifest.json")
            if os.path.exists(manifest_path):
                with open(manifest_path) as f:
                    manifest = json.load(f)
                for item in manifest.get("issues", []):
                    m, y = item.get("month"), item.get("year")
                    if m and y:
                        for iid, iss in issue_map.items():
                            if iss.get("month") == m and iss.get("year") == y:
                                report["issue_identifier_map"][str(iid)] = item["identifier"]

            # 1. NULL homeowner_name
            for f in features:
                name = f.get("homeowner_name")
                if not name or str(name).lower() in ("null", "none", "unknown"):
                    iss = issue_map.get(f["issue_id"], {})
                    identifier = report["issue_identifier_map"].get(str(f["issue_id"]), "?")
                    report["supabase_nulls"].append({
                        "id": f["id"],
                        "issue_id": f["issue_id"],
                        "issue": f"{iss.get('year','?')}-{iss.get('month','?'):02d}" if isinstance(iss.get('month'), int) else "?",
                        "identifier": identifier,
                        "article": f.get("article_title", "?"),
                    })

            # 2. Exact duplicates (same homeowner_name + same issue_id)
            from collections import defaultdict
            by_key = defaultdict(list)
            for f in features:
                name = f.get("homeowner_name")
                if name and str(name).lower() not in ("null", "none"):
                    by_key[(name, f["issue_id"])].append(f)
            for (name, issue_id), group in by_key.items():
                if len(group) > 1:
                    iss = issue_map.get(issue_id, {})
                    ids = [g["id"] for g in group]
                    report["duplicates"].append({
                        "name": name,
                        "issue_id": issue_id,
                        "issue": f"{iss.get('year','?')}-{iss.get('month','?'):02d}" if isinstance(iss.get('month'), int) else "?",
                        "feature_ids": ids,
                        "keep_id": ids[0],
                        "delete_ids": ids[1:],
                    })

            # 3. Near-duplicates (similar names in the same issue)
            by_issue = defaultdict(list)
            for f in features:
                name = f.get("homeowner_name")
                if name and str(name).lower() not in ("null", "none"):
                    by_issue[f["issue_id"]].append(f)
            for issue_id, group in by_issue.items():
                names = [(g["id"], g["homeowner_name"]) for g in group]
                for i in range(len(names)):
                    for j in range(i + 1, len(names)):
                        id_a, name_a = names[i]
                        id_b, name_b = names[j]
                        # Skip if already an exact duplicate (handled above)
                        if name_a == name_b:
                            continue
                        # Check if one name contains the other (e.g., "Botero" in "Fernando Botero")
                        la, lb = name_a.lower().strip(), name_b.lower().strip()
                        if la in lb or lb in la:
                            iss = issue_map.get(issue_id, {})
                            report["near_duplicates"].append({
                                "name_a": name_a, "id_a": id_a,
                                "name_b": name_b, "id_b": id_b,
                                "issue_id": issue_id,
                                "issue": f"{iss.get('year','?')}-{iss.get('month','?'):02d}" if isinstance(iss.get('month'), int) else "?",
                                "suggestion": f"Keep '{name_a if len(name_a) > len(name_b) else name_b}' (longer/fuller name), delete the other",
                            })

            # 4. Issues needing re-extraction (high null count)
            null_by_issue = defaultdict(lambda: {"nulls": 0, "total": 0})
            for f in features:
                iid = f["issue_id"]
                null_by_issue[iid]["total"] += 1
                name = f.get("homeowner_name")
                if not name or str(name).lower() in ("null", "none", "unknown"):
                    null_by_issue[iid]["nulls"] += 1
            for iid, counts in null_by_issue.items():
                if counts["nulls"] > 0:
                    iss = issue_map.get(iid, {})
                    identifier = report["issue_identifier_map"].get(str(iid), "?")
                    report["issues_needing_reextraction"].append({
                        "issue_id": iid,
                        "issue": f"{iss.get('year','?')}-{iss.get('month','?'):02d}" if isinstance(iss.get('month'), int) else "?",
                        "identifier": identifier,
                        "null_count": counts["nulls"],
                        "total_features": counts["total"],
                        "null_pct": round(100 * counts["nulls"] / counts["total"]),
                    })

        except Exception as e:
            self.log(f"Quality audit failed: {e}", level="ERROR")

        return report

    def _build_xref_summary(self):
        """Read cross-reference results and build a summary for the situation report."""
        xref_dir = os.path.join(DATA_DIR, "cross_references")
        summary = {"total_checked": 0, "total_matches": 0, "recent_matches": []}

        checked_path = os.path.join(xref_dir, "checked_features.json")
        results_path = os.path.join(xref_dir, "results.json")

        try:
            if os.path.exists(checked_path):
                with open(checked_path) as f:
                    summary["total_checked"] = len(json.load(f))
        except Exception:
            pass

        try:
            if os.path.exists(results_path):
                with open(results_path) as f:
                    results = json.load(f)
                matches = [r for r in results if r.get("black_book_status") == "match"]
                summary["total_matches"] = len(matches)
                # Last 5 matches for visibility
                for m in matches[-5:]:
                    summary["recent_matches"].append({
                        "name": m.get("homeowner_name", "?"),
                        "match_type": m.get("match_type", "?"),
                        "issue": f"{m.get('year', '?')}-{m.get('month', '?')}",
                    })
        except Exception:
            pass

        return summary

    def _read_human_messages(self):
        """Read unread human messages."""
        if not os.path.exists(HUMAN_MESSAGES_PATH):
            return []
        try:
            with open(HUMAN_MESSAGES_PATH) as f:
                messages = json.load(f)
            return [m for m in messages if not m.get("read")]
        except Exception:
            return []

    def _mark_messages_read(self):
        """Mark all human messages as read."""
        if not os.path.exists(HUMAN_MESSAGES_PATH):
            return
        try:
            with open(HUMAN_MESSAGES_PATH) as f:
                messages = json.load(f)
            for m in messages:
                m["read"] = True
            with open(HUMAN_MESSAGES_PATH, "w") as f:
                json.dump(messages, f)
        except Exception:
            pass

    def _build_situation_report(self):
        """Gather status from all agents + recent activity log + memory + QC."""
        report = {
            "timestamp": datetime.now().isoformat(),
            "agents": {},
            "recent_log": [],
            "inbox": "",
        }

        # Agent statuses
        for name, agent in self.workers.items():
            report["agents"][name] = agent.get_dashboard_status()

        # Recent activity log (last 30 lines)
        if os.path.exists(LOG_PATH):
            with open(LOG_PATH) as f:
                lines = f.readlines()
            report["recent_log"] = [line.strip() for line in lines[-30:]]

        # Human inbox (legacy markdown)
        if os.path.exists(INBOX_PATH):
            with open(INBOX_PATH) as f:
                report["inbox"] = f.read().strip()

        # Human messages from dashboard
        report["human_messages"] = self._read_human_messages()

        # Persistent memory — past observations and decisions
        report["editor_memory"] = self._get_memory_summary()

        # Quality control audit
        report["quality_audit"] = self._build_quality_report()

        # Agent escalations — unresolved requests for help from any agent
        report["agent_escalations"] = {}
        for agent_name in list(self.workers.keys()) + ["scout", "courier", "reader", "detective", "researcher", "designer"]:
            escs = self._read_escalations(agent_name)
            if escs:
                report["agent_escalations"][agent_name] = escs

        # Cross-reference results summary
        report["xref_summary"] = self._build_xref_summary()

        return report

    def _escalation_path(self, agent_name):
        """Return the escalation file path for a given agent."""
        return os.path.join(DATA_DIR, f"{agent_name}_escalations.json")

    def _read_escalations(self, agent_name):
        """Read unresolved escalations for a given agent."""
        path = self._escalation_path(agent_name)
        if not os.path.exists(path):
            return []
        try:
            with open(path) as f:
                escalations = json.load(f)
            return [e for e in escalations if not e.get("resolved")]
        except Exception:
            return []

    def _resolve_escalation(self, agent_name, index):
        """Mark an agent's escalation as resolved by index."""
        path = self._escalation_path(agent_name)
        if not os.path.exists(path):
            return
        try:
            with open(path) as f:
                escalations = json.load(f)
            # Find the Nth unresolved escalation
            unresolved_idx = 0
            for i, esc in enumerate(escalations):
                if not esc.get("resolved"):
                    if unresolved_idx == index:
                        escalations[i]["resolved"] = True
                        escalations[i]["resolved_time"] = datetime.now().isoformat()
                        escalations[i]["resolved_by"] = "editor"
                        self.log(f"Resolved {agent_name} escalation #{index}: {esc.get('message', '')[:60]}")
                        break
                    unresolved_idx += 1
            with open(path, "w") as f:
                json.dump(escalations, f, indent=2)
        except Exception as e:
            self.log(f"Failed to resolve {agent_name} escalation: {e}", level="ERROR")

    def _detect_events(self):
        """Cheap file reads to detect if anything meaningful happened.

        Returns (trigger_reason, details) or (None, None) if no events.
        """
        # 1. New escalations from any agent
        agents_to_check = list(self.workers.keys()) + ["researcher"]
        for agent_name in agents_to_check:
            unresolved = self._read_escalations(agent_name)
            prev_count = self._last_escalation_snapshot.get(agent_name, 0)
            current_count = len(unresolved)
            if current_count > prev_count:
                self._last_escalation_snapshot[agent_name] = current_count
                return ("escalation", f"New escalation from {agent_name}")

        # 2. Milestones in activity log (new INFO-level entries since last check)
        if os.path.exists(LOG_PATH):
            try:
                with open(LOG_PATH) as f:
                    lines = f.readlines()
                new_count = len(lines)
                if new_count > self._last_log_line_count:
                    # Check new lines for milestone keywords
                    new_lines = lines[self._last_log_line_count:]
                    self._last_log_line_count = new_count
                    for line in new_lines:
                        low = line.lower()
                        if any(kw in low for kw in (
                            "loaded", "dossier complete", "match",
                            "extraction complete", "downloaded",
                            "scout complete", "features extracted",
                        )):
                            return ("milestone", line.strip().split("|")[-1][:80] if "|" in line else line.strip()[:80])
                else:
                    self._last_log_line_count = new_count
            except Exception:
                pass

        return (None, None)

    async def work(self):
        import time as _time

        # Check for events (cheap file reads every 5s)
        has_human_messages = bool(self._read_human_messages())
        now = _time.time()
        elapsed = now - self._last_haiku_time

        # Determine if we should call the LLM this cycle
        # Minimum cooldowns: human messages are instant, escalations need 30s, milestones 90s
        trigger = None
        if has_human_messages:
            trigger = "human_message"
        else:
            event_type, event_detail = self._detect_events()
            if event_type == "escalation" and elapsed >= 30:
                trigger = event_type
            elif event_type == "milestone" and elapsed >= 90:
                trigger = event_type
            elif elapsed >= self._health_check_interval:
                trigger = "health_check"

        # No trigger — stay idle
        if not trigger:
            if _time.time() < self._happy_until:
                self._editor_state = "happy"
                self._current_task = "Instructions acknowledged!"
            else:
                self._editor_state = "idle"
                self._current_task = "Waiting for events..."
            return False

        # Set state based on trigger
        if trigger == "human_message":
            self._editor_state = "listening"
            self._current_task = "Reading human message..."
        elif trigger == "escalation":
            self._editor_state = "assessing"
            self._current_task = "Reviewing escalation..."
        elif trigger == "milestone":
            self._editor_state = "assessing"
            self._current_task = "Agent reported progress..."
        else:
            self._editor_state = "assessing"
            self._current_task = "Routine health check..."

        skills = self.load_skills()
        report = self._build_situation_report()

        # Call Claude Haiku for strategic analysis
        self._last_haiku_time = now
        try:
            assessment = await asyncio.to_thread(
                self._call_haiku, skills, report
            )
        except Exception as e:
            self._editor_state = "idle"
            self.log(f"Haiku assessment failed: {e}", level="ERROR")
            self._current_task = "Assessment failed — will retry"
            return False

        self._last_assessment = assessment

        # Execute any actions from the assessment
        self._execute_actions(assessment)

        # Write briefing
        self._write_briefing(assessment)

        # Write inbox message
        self._write_inbox_message(assessment, is_reply=has_human_messages)

        # Mark human messages as read
        self._mark_messages_read()

        # Set state after successful processing
        if has_human_messages:
            self._editor_state = "happy"
            self._happy_until = _time.time() + 20  # Stay happy for 20 seconds
            self._current_task = "Instructions acknowledged!"
        else:
            self._editor_state = "idle"

        # Persist health to memory for cross-restart continuity
        health = assessment.get("health", "UNKNOWN")
        memory = self._load_memory()
        memory["last_assessment_health"] = health
        memory["last_assessment_time"] = datetime.now().isoformat()
        self._save_memory(memory)
        self._last_health = health

        # Log summary
        summary = assessment.get("summary", "No summary")
        self._current_task = f"Pipeline: {health} — {summary}"
        self.log(f"Assessment: {health} — {summary}")

        return True

    def _call_haiku(self, skills, report):
        """Call Claude Haiku with the situation report. Returns parsed JSON."""
        client = self._get_client()

        system_prompt = f"""You are the Editor agent for the AD-Epstein Index pipeline.

{skills}

Respond with JSON only. Schema:
{{
  "health": "GOOD" | "CAUTION" | "ATTENTION",
  "summary": "One-line summary of pipeline state",
  "observations": ["observation 1", "observation 2", ...],
  "actions": [
    {{"type": "pause"|"resume"|"log"|"remember"|"update_skills"|"queue_reextraction"|"set_designer_mode"|"clear_load_failures", "agent": "agent_name", "reason": "why"}},
    {{"type": "queue_reextraction", "identifier": "...", "strategy": "wider_scan"|"extended_toc"|"full_scan", "reason": "why"}},
    {{"type": "delete_features", "feature_ids": [1, 2, 3], "reason": "why"}},
    {{"type": "reset_issue_pipeline", "issue_id": 12, "identifier": "ArchitecturalDigestNovember2013", "reason": "why"}},
    {{"type": "set_designer_mode", "mode": "training"|"creating", "reason": "why"}},
    {{"type": "clear_load_failures", "identifier": "ArchitecturalDigest..." or null for all, "reason": "why"}}
  ],
  "briefing": "Full markdown briefing text for the human researcher",
  "inbox_message": "A concise 1-2 sentence update for the human's inbox dashboard. Focus on high-level progress, milestones, or issues that need attention. Write conversationally. If the human sent you a message, address it directly here.",
  "inbox_type": "status" or "alert" (use alert only for matches, errors, or urgent issues),
  "asks": ["Question for human, if any"]
}}

## Memory
The situation report includes "editor_memory" — your past observations. Use this to:
- Avoid repeating the same observations cycle after cycle
- Track decisions you've made and why
- Notice trends over time (improving/worsening metrics)
To save a new memory, add an action: {{"type": "remember", "category": "decision|observation|milestone|issue", "reason": "What to remember"}}
Use sparingly — only record things worth remembering across restarts.

## Quality Control (CRITICAL — proactive Supabase cleanup)
The situation report includes "quality_audit" with Supabase data quality issues:
- supabase_nulls: rows with NULL homeowner_name (includes issue_id and identifier)
- duplicates: exact duplicate entries (same name + same issue_id) — includes keep_id and delete_ids
- near_duplicates: similar names in same issue (e.g., "Botero" and "Fernando Botero") — review and delete the shorter/partial name
- issues_needing_reextraction: issues with high null counts
- issue_identifier_map: maps issue_id → archive.org identifier (for re-extraction)

**Proactive cleanup actions (take these EVERY cycle when issues exist):**

1. **Delete exact duplicates immediately:** Use {{"type": "delete_features", "feature_ids": [id1, id2], "reason": "Duplicate of feature #N"}}
   The quality_audit provides `delete_ids` for each duplicate group — delete those IDs, keeping the `keep_id`.

2. **Review and delete near-duplicates:** If one name is a subset of another (e.g., "Botero" vs "Fernando Botero"), delete the shorter/partial one.
   Use {{"type": "delete_features", "feature_ids": [shorter_id], "reason": "Near-duplicate of #N (fuller name)"}}

3. **Handle NULL homeowner entries:**
   - If an issue has mostly NULLs (>50%), do a FULL PIPELINE RESET — this wipes Supabase features, resets the manifest so Courier re-downloads, and deletes the extraction so Reader starts fresh:
     {{"type": "reset_issue_pipeline", "issue_id": N, "identifier": "ArchitecturalDigest...", "reason": "N of M features are NULL — full reset"}}
   - If an issue has only 1-2 NULLs among mostly good features, just delete the NULL rows: {{"type": "delete_features", "feature_ids": [null_id], "reason": "NULL homeowner — no useful data"}}
   - Use the identifier from issue_identifier_map for the identifier field

4. **You are the central coordinator.** When data quality is bad, you feed orders down the pipeline:
   - reset_issue_pipeline: Wipes Supabase + resets manifest → Courier re-downloads → Reader re-extracts → Loader re-loads → Detective re-checks
   - delete_features: Surgical removal of specific junk/duplicate rows
   - queue_reextraction: Re-extract without re-downloading (when the PDF is fine but extraction was bad)

5. **Track cleanup progress in memory** — remember which issues you've already cleaned up to avoid repeating work. Only take 2-3 cleanup actions per cycle to avoid overwhelming the pipeline.

## Cross-Reference Results
The situation report includes "xref_summary" with:
- total_checked: how many features the Detective has cross-referenced
- total_matches: how many names matched the Epstein records
- recent_matches: last 5 matches with name, match_type, and issue
When new matches appear, flag them in your inbox_message with inbox_type "alert" — these are the project's most important output.
Track match counts in memory to notice trends.

## Human Communication
If the situation report includes "human_messages", the human is talking to you via the dashboard inbox.
**THIS IS YOUR HIGHEST PRIORITY.** Always respond conversationally in your inbox_message — address the human directly, not with a status update.

You can:
- Answer questions about pipeline state
- Update agent skills by adding an action: {{"type": "update_skills", "agent": "agent_name", "content": "New section or instructions to append to the agent's skills file", "reason": "what changed"}}
- Pause/resume agents as requested
- Acknowledge feedback and adjust strategy

**Translating human instructions into actions (CRITICAL):**
When the human tells you to dismiss, ignore, or override something, you MUST emit the corresponding action:
- "ignore X" / "dismiss X" / "X is a false positive" / "X is not a match" → {{"type": "override_verdict", "name": "X", "verdict": "no_match", "reason": "Human instructed to dismiss"}}
- "retry X" / "search X again" → {{"type": "retry_doj_search", "name": "X", "reason": "Human requested retry"}}
- "re-extract [issue]" → {{"type": "queue_reextraction", "identifier": "...", "strategy": "wider_scan", "reason": "Human requested"}}
- "pause [agent]" / "stop [agent]" → {{"type": "pause", "agent": "agent_name", "reason": "Human requested"}}
- "resume [agent]" / "start [agent]" → {{"type": "resume", "agent": "agent_name", "reason": "Human requested"}}

**Conversational reply examples:**
- Human: "ignore Gritti Palace" → inbox_message: "Got it — I've dismissed Gritti Palace as a false positive." + override_verdict action
- Human: "how's the pipeline?" → inbox_message: "All systems running smoothly! We've extracted 85 features from 12 issues so far."
- Human: "pause the detective" → inbox_message: "Done — Detective is paused. Say 'resume detective' when you're ready." + pause action
Do NOT just repeat status numbers when the human sends a message. Talk to them like a person.

## Agent Escalations
If the situation report includes "agent_escalations" with entries, one or more agents are stuck and need your help.
The dict is keyed by agent name — each value is a list of unresolved escalations.

When you see escalations:
1. Analyze what's stuck and why (check the "type" and "context" fields)
2. Think about solutions specific to the agent and failure type
3. Update the agent's skills file if needed: {{"type": "update_skills", "agent": "agent_name", "content": "New instructions", "reason": "responding to escalation"}}
4. Alert the human via inbox_message — they may be able to help
5. Mark escalations as resolved: {{"type": "resolve_escalation", "agent": "agent_name", "index": 0}}
Use inbox_type "alert" for escalations so the human notices.

**Scout escalations** (finding issues): new search terms, alternative archives, credential-gated sources (ProQuest, EBSCO, Gale).
**Courier escalations** (downloading PDFs): retry strategies, alternative download sources, credential setup (AD_ARCHIVE_EMAIL/PASSWORD in .env), install poppler-utils for pdfunite, manual PDF uploads for stubborn issues.
**Reader escalations** (extracting features): The Reader has quality gates — it holds extractions that fail QC instead of loading bad data into Supabase. Escalation types:
- `zero_features`: Extraction found no features at all. Try `wider_scan` or `extended_toc` strategy.
- `insufficient_features`: Only 0-1 features found (major red flag). Try `wider_scan` first, then `full_scan`.
- `high_null_rate`: >50% of features have NULL homeowner_name. Try `wider_scan` strategy.
- `extraction_failed`: process_issue() returned None (PDF may be corrupt). Alert the human.
- `extraction_stuck`: Multiple consecutive failures across different issues. The extraction pipeline itself may be broken. Alert the human urgently.
- `reextraction_*`: A re-extraction attempt also failed QC. Consider escalating to `full_scan` or alerting the human.
- `supabase_load_failed`: **SELF-HEALABLE — do NOT pause the Reader or alert the human.** The `_sanitize_integer()` function in load_features.py now handles comma-formatted numbers (e.g., "35,000" → 35000). To fix: (1) clear_load_failures, (2) resolve_escalation, (3) resume reader if paused. The retry will succeed.

To queue a re-extraction, use: {{"type": "queue_reextraction", "identifier": "ArchitecturalDigestMarch2020", "strategy": "wider_scan", "reason": "High null rate"}}
To clear load failures, use: {{"type": "clear_load_failures", "identifier": "ArchitecturalDigest...", "reason": "Integer sanitization handles this"}}
Available strategies (prefer in this order): `wider_scan` → `extended_toc` → `full_scan`
- `wider_scan`: Normal TOC + scan every 3 pages from page 20 (good first retry)
- `extended_toc`: Read TOC from pages 1-30, scan every 3 from page 20
- `full_scan`: Skip TOC entirely, scan every 3 pages (most expensive, last resort)

**Detective escalations** (cross-referencing names): The Detective searches both the Black Book and DOJ Epstein Library, then produces combined verdicts. Escalation types:
- `high_value_match`: A name matched with confirmed_match or likely_match verdict. This is the project's core output — alert the human immediately.
- `false_positive_review`: A possible_match has false positive indicators (common name, last_name_only, etc.). Review the evidence carefully before confirming or dismissing.
- `needs_review`: Ambiguous evidence that the Detective can't resolve automatically. Look at the evidence_summary in the context.
- `doj_search_failed`: A specific name's DOJ search failed repeatedly. Consider retrying: {{"type": "retry_doj_search", "name": "...", "reason": "..."}}
- `search_stuck`: Multiple consecutive DOJ search failures — the browser or DOJ site may be having issues. Alert the human.

**Detective action formats:**
- Override a verdict: {{"type": "override_verdict", "name": "Robert Smith", "verdict": "no_match", "reason": "Human instructed to dismiss"}}
- Retry a DOJ search: {{"type": "retry_doj_search", "name": "Miranda Brooks", "reason": "Previous search timed out, worth retrying"}}

Verdict options: confirmed_match, likely_match, possible_match, no_match

**CRITICAL: Do NOT override verdicts on your own initiative.**
The Researcher agent is responsible for investigating leads and building dossiers. Only use override_verdict when:
1. The HUMAN explicitly tells you to dismiss a name (e.g., "ignore X", "dismiss X")
2. The RESEARCHER rates a lead as COINCIDENCE (the Researcher auto-dismisses these)
Never pre-emptively dismiss leads — even obvious false positives should go through the Researcher first. Your job is to SUPERVISE, not to INVESTIGATE.

**Researcher escalations** (investigating leads & building dossiers): The Researcher investigates all Detective leads and builds dossiers with pattern analysis. Escalation types:
- `high_value_lead`: A HIGH connection strength dossier was built. **Alert the human immediately** — this is the project's most important output. Include the subject name, strength rationale, and key findings with inbox_type "alert".
- `pattern_detected`: Correlations found across multiple Epstein-associated names (shared designer, location cluster, style trend). Note in briefing and track in memory. If the same pattern keeps appearing, escalate to the human as a trend.
- `investigation_failed`: The Haiku call failed or returned invalid JSON. If systemic (multiple failures), alert the human. If isolated, the Researcher will retry next cycle.
- `needs_manual_review`: Ambiguous evidence the Researcher couldn't resolve. Forward to the human with context.
Note: Researcher escalations are informational — you read them and brief the human, but don't write actions back.

**Designer escalations** (training & design): The Designer studies design patterns from websites, Notion, local images, and Figma. Escalation types:
- `training_failed`: Claude CLI call failed (timeout, network issue). Single failures are normal. If repeated, alert the human.
- `source_unavailable`: Source temporarily down (Notion offline, local folder empty). Don't escalate immediately — Designer cycles to next source.
- `training_stuck`: Multiple consecutive failures — systemic issue (CLI not installed, API key expired). Alert the human urgently.
- `mode_transition_ready`: Designer has studied all sources and has 50+ patterns — may be ready for Phase 3. Review the stats and ask the human if ready to switch.
To switch Designer to creation mode: {{"type": "set_designer_mode", "mode": "creating", "reason": "Designer has sufficient training data"}}"""

        user_message = f"""Here is the current pipeline situation report:

```json
{json.dumps(report, indent=2)}
```

Analyze the pipeline state and provide your assessment."""

        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )

        # Track API usage and cost
        self._track_usage(response)

        # Parse JSON from response — handle markdown blocks and trailing text
        text = response.content[0].text.strip()
        # Strip markdown code blocks
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            # Find the closing ``` and discard everything after it
            if "```" in text:
                text = text[:text.rindex("```")]
            text = text.strip()
        # If still not valid JSON, try extracting the first JSON object
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Find first { and its matching } using a simple brace counter
            start = text.find("{")
            if start == -1:
                raise
            depth = 0
            in_string = False
            escape = False
            for i in range(start, len(text)):
                c = text[i]
                if escape:
                    escape = False
                    continue
                if c == "\\":
                    escape = True
                    continue
                if c == '"' and not escape:
                    in_string = not in_string
                    continue
                if in_string:
                    continue
                if c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        return json.loads(text[start:i+1])
            raise

    def _execute_actions(self, assessment):
        """Execute actions recommended by Haiku."""
        for action in assessment.get("actions", []):
            action_type = action.get("type")
            agent_name = action.get("agent", "")
            reason = action.get("reason", "")

            # Memory: persist an observation or decision
            if action_type == "remember":
                category = action.get("category", "observation")
                self._remember(category, reason)
                self.log(f"Remembered [{category}]: {reason}", level="DEBUG")
                continue

            # update_skills works on any agent (just modifies a file)
            if action_type == "update_skills":
                self._update_agent_skills(agent_name, action.get("content", ""), reason)
                continue

            # resolve_escalation marks an agent's escalation as handled
            if action_type == "resolve_escalation":
                esc_agent = action.get("agent", "scout")  # Default to scout for backwards compat
                esc_index = action.get("index", 0)
                self._resolve_escalation(esc_agent, esc_index)
                continue

            # queue_reextraction tells the Reader to re-extract an issue
            if action_type == "queue_reextraction":
                self._queue_reextraction(action)
                continue

            # override_verdict tells the Detective to override a name's verdict
            if action_type == "override_verdict":
                self._override_detective_verdict(action)
                continue

            # retry_doj_search resets a name for DOJ re-search
            if action_type == "retry_doj_search":
                self._retry_doj_search(action)
                continue

            # clear_load_failures resets the Reader's failure counter so it retries loading
            if action_type == "clear_load_failures":
                self._clear_load_failures(action)
                continue

            # delete_features removes specific feature rows from Supabase
            if action_type == "delete_features":
                self._delete_features(action)
                continue

            # reset_issue_pipeline: full reset — wipe Supabase, reset manifest, delete extraction
            if action_type == "reset_issue_pipeline":
                self._reset_issue_pipeline(action)
                continue

            # set_designer_mode switches the Designer between training/creating
            if action_type == "set_designer_mode":
                self._set_designer_mode(action)
                continue

            if agent_name not in self.workers:
                continue

            agent = self.workers[agent_name]

            if action_type == "pause" and not agent.is_paused:
                agent.pause()
                self.log(f"Paused {agent_name}: {reason}")
            elif action_type == "resume" and agent.is_paused:
                agent.resume()
                self.log(f"Resumed {agent_name}: {reason}")
            elif action_type == "log":
                self.log(f"[{agent_name}] {reason}")

    def _update_agent_skills(self, agent_name, content, reason):
        """Append new instructions to an agent's skills file."""
        if not content or not agent_name:
            return
        skills_dir = os.path.join(os.path.dirname(__file__), "skills")
        skills_path = os.path.join(skills_dir, f"{agent_name}.md")
        if not os.path.exists(skills_path):
            self.log(f"Skills file not found for {agent_name}", level="WARN")
            return
        try:
            with open(skills_path, "a") as f:
                f.write(f"\n\n## Update — {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
                f.write(content + "\n")
            self.log(f"Updated {agent_name} skills: {reason}")
        except Exception as e:
            self.log(f"Failed to update {agent_name} skills: {e}", level="ERROR")

    def _queue_reextraction(self, action):
        """Queue a re-extraction for the Reader agent."""
        identifier = action.get("identifier")
        strategy = action.get("strategy", "wider_scan")
        reason = action.get("reason", "Editor requested re-extraction")

        if not identifier:
            self.log("queue_reextraction: missing identifier", level="WARN")
            return

        # Atomically append to queue (Reader also reads/writes this file)
        new_item = {
            "identifier": identifier,
            "reason": reason,
            "strategy": strategy,
            "queued_by": "editor",
            "queued_time": datetime.now().isoformat(),
            "status": "pending",
        }

        def append_to_queue(queue):
            # Don't duplicate pending requests for the same identifier
            for item in queue:
                if item.get("identifier") == identifier and item.get("status") == "pending":
                    return
            queue.append(new_item)

        update_json_locked(REEXTRACT_QUEUE_PATH, append_to_queue, default=[])

        self.log(f"Queued re-extraction: {identifier} ({strategy}) — {reason}")

    def _clear_load_failures(self, action):
        """Clear the Reader's load failure counter so it retries loading issues into Supabase.

        Supports clearing a specific identifier or all failures.
        """
        identifier = action.get("identifier")  # None means clear all
        reason = action.get("reason", "Editor cleared load failures")

        reader_log_path = os.path.join(DATA_DIR, "reader_log.json")
        if not os.path.exists(reader_log_path):
            self.log("clear_load_failures: reader_log.json not found", level="WARN")
            return

        try:
            with open(reader_log_path) as f:
                reader_log = json.load(f)

            load_failures = reader_log.get("load_failures", {})

            if identifier:
                if identifier in load_failures:
                    del load_failures[identifier]
                    self.log(f"Cleared load failures for {identifier}: {reason}")
                else:
                    self.log(f"clear_load_failures: {identifier} not in failure list")
                    return
            else:
                count = len(load_failures)
                load_failures.clear()
                self.log(f"Cleared all load failures ({count} entries): {reason}")

            reader_log["load_failures"] = load_failures
            with open(reader_log_path, "w") as f:
                json.dump(reader_log, f, indent=2)

        except Exception as e:
            self.log(f"clear_load_failures failed: {e}", level="ERROR")

    def _delete_features(self, action):
        """Delete specific feature rows from Supabase (for duplicates, junk entries)."""
        feature_ids = action.get("feature_ids", [])
        reason = action.get("reason", "Editor cleanup")

        if not feature_ids:
            self.log("delete_features: no feature_ids provided", level="WARN")
            return

        try:
            from dotenv import load_dotenv
            load_dotenv()
            from supabase import create_client
            sb = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))

            for fid in feature_ids:
                sb.table("features").delete().eq("id", fid).execute()
            self.log(f"Deleted {len(feature_ids)} features from Supabase: {feature_ids} — {reason}")
        except Exception as e:
            self.log(f"delete_features failed: {e}", level="ERROR")

    def _reset_issue_pipeline(self, action):
        """Full pipeline reset for an issue: wipe Supabase → reset manifest → delete extraction.

        This sends the issue back through the full pipeline:
        Courier re-downloads → Reader re-extracts → Loader re-loads → Detective re-checks.
        """
        issue_id = action.get("issue_id")
        identifier = action.get("identifier")
        reason = action.get("reason", "Editor reset issue for full reprocessing")

        if not identifier or identifier == "?":
            self.log("reset_issue_pipeline: no identifier provided", level="WARN")
            return

        steps_done = []

        # Step 1: Delete all features for this issue from Supabase
        if issue_id:
            try:
                from dotenv import load_dotenv
                load_dotenv()
                from supabase import create_client
                sb = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))
                existing = sb.table("features").select("id").eq("issue_id", issue_id).execute()
                count = len(existing.data)
                if count > 0:
                    sb.table("features").delete().eq("issue_id", issue_id).execute()
                    steps_done.append(f"Deleted {count} features from Supabase")

                    # Also remove from cross-reference results and checked_features
                    deleted_ids = {row["id"] for row in existing.data}
                    self._remove_from_xref(deleted_ids)
                    steps_done.append(f"Removed {len(deleted_ids)} IDs from cross-reference tracking")
            except Exception as e:
                self.log(f"reset_issue_pipeline: Supabase cleanup failed: {e}", level="ERROR")

        # Step 2: Delete local extraction JSON (so Reader starts fresh)
        extraction_path = os.path.join(DATA_DIR, "extractions", f"{identifier}.json")
        if os.path.exists(extraction_path):
            os.remove(extraction_path)
            steps_done.append("Deleted local extraction file")
        backup_path = extraction_path + ".backup"
        if os.path.exists(backup_path):
            os.remove(backup_path)
            steps_done.append("Deleted extraction backup")

        # Step 3: Delete the PDF so Courier re-downloads a fresh copy
        issues_dir = os.path.join(DATA_DIR, "issues")
        if os.path.exists(issues_dir):
            for fname in os.listdir(issues_dir):
                # PDF filenames are like "2013_11_ArchitecturalDigest.pdf"
                if identifier.lower() in fname.lower() or fname.startswith(identifier):
                    pdf_path = os.path.join(issues_dir, fname)
                    os.remove(pdf_path)
                    steps_done.append(f"Deleted PDF: {fname}")
                    break
            else:
                # Try matching by month/year from manifest
                manifest_path = os.path.join(DATA_DIR, "archive_manifest.json")
                if os.path.exists(manifest_path):
                    try:
                        with open(manifest_path) as f:
                            manifest = json.load(f)
                        for item in manifest.get("issues", []):
                            if item.get("identifier") == identifier and item.get("pdf_path"):
                                old_pdf = item["pdf_path"]
                                if os.path.exists(old_pdf):
                                    os.remove(old_pdf)
                                    steps_done.append(f"Deleted PDF: {os.path.basename(old_pdf)}")
                                break
                    except Exception:
                        pass

        # Step 4: Reset manifest status to "discovered" so Courier re-downloads
        manifest_path = os.path.join(DATA_DIR, "archive_manifest.json")
        if os.path.exists(manifest_path):
            try:
                with open(manifest_path) as f:
                    manifest = json.load(f)
                for item in manifest.get("issues", []):
                    if item.get("identifier") == identifier:
                        old_status = item.get("status")
                        item["status"] = "discovered"
                        item.pop("pdf_path", None)  # Clear stale PDF path
                        steps_done.append(f"Reset manifest: {old_status} → discovered")
                        break
                with open(manifest_path, "w") as f:
                    json.dump(manifest, f, indent=2)
            except Exception as e:
                self.log(f"reset_issue_pipeline: manifest reset failed: {e}", level="ERROR")

        self.log(f"Reset issue {identifier}: {' | '.join(steps_done)} — {reason}")

    def _remove_from_xref(self, feature_ids):
        """Remove feature IDs from cross-reference tracking so Detective re-checks them."""
        xref_dir = os.path.join(DATA_DIR, "cross_references")

        # Remove from results.json
        results_path = os.path.join(xref_dir, "results.json")
        if os.path.exists(results_path):
            try:
                with open(results_path) as f:
                    results = json.load(f)
                results = [r for r in results if r.get("feature_id") not in feature_ids]
                with open(results_path, "w") as f:
                    json.dump(results, f, indent=2)
            except Exception:
                pass

        # Remove from checked_features.json
        checked_path = os.path.join(xref_dir, "checked_features.json")
        if os.path.exists(checked_path):
            try:
                with open(checked_path) as f:
                    checked = set(json.load(f))
                checked -= feature_ids
                with open(checked_path, "w") as f:
                    json.dump(sorted(checked), f)
            except Exception:
                pass

    def _override_detective_verdict(self, action):
        """Queue a verdict override for the Detective to apply."""
        name = action.get("name")
        verdict = action.get("verdict")
        reason = action.get("reason", "Editor override")

        if not name or not verdict:
            self.log("override_verdict: missing name or verdict", level="WARN")
            return

        valid_verdicts = {"confirmed_match", "likely_match", "possible_match", "no_match"}
        if verdict not in valid_verdicts:
            self.log(f"override_verdict: invalid verdict '{verdict}'", level="WARN")
            return

        verdicts_path = os.path.join(DATA_DIR, "detective_verdicts.json")
        new_verdict = {
            "name": name,
            "verdict": verdict,
            "reason": reason,
            "queued_by": "editor",
            "queued_time": datetime.now().isoformat(),
            "applied": False,
        }
        update_json_locked(verdicts_path, lambda data: data.append(new_verdict), default=[])

        self.log(f"Queued verdict override: {name} → {verdict} ({reason})")

    def _retry_doj_search(self, action):
        """Reset a name for DOJ re-search by the Detective."""
        name = action.get("name")
        reason = action.get("reason", "Editor requested retry")

        if not name:
            self.log("retry_doj_search: missing name", level="WARN")
            return

        # Reset doj_status to "pending" in results.json (with locking)
        xref_dir = os.path.join(DATA_DIR, "cross_references")
        results_path = os.path.join(xref_dir, "results.json")
        name_lower = name.lower()
        try:
            def reset_doj(results):
                for r in results:
                    if r.get("homeowner_name", "").lower() == name_lower:
                        r["doj_status"] = "pending"
                        r["doj_results"] = None
                        r["combined_verdict"] = None
                        r["last_updated"] = datetime.now().isoformat()
                        break
            update_json_locked(results_path, reset_doj, default=[])
        except Exception as e:
            self.log(f"retry_doj_search: failed to update results: {e}", level="ERROR")
            return

        # Clear name from detective_log failures
        det_log_path = os.path.join(DATA_DIR, "detective_log.json")
        if os.path.exists(det_log_path):
            try:
                with open(det_log_path) as f:
                    det_log = json.load(f)
                det_log.get("name_failures", {}).pop(name, None)
                with open(det_log_path, "w") as f:
                    json.dump(det_log, f, indent=2)
            except Exception:
                pass

        self.log(f"Queued DOJ retry: {name} ({reason})")

    def _set_designer_mode(self, action):
        """Switch the Designer agent's mode via file."""
        mode = action.get("mode", "training")
        reason = action.get("reason", "Editor requested mode change")

        if mode not in ("training", "creating"):
            self.log(f"set_designer_mode: invalid mode '{mode}'", level="WARN")
            return

        mode_path = os.path.join(DATA_DIR, "designer_mode.json")
        os.makedirs(os.path.dirname(mode_path), exist_ok=True)
        with open(mode_path, "w") as f:
            json.dump({"mode": mode, "set_by": "editor", "time": datetime.now().isoformat()}, f, indent=2)

        self.log(f"Set Designer mode to '{mode}': {reason}")

    def _write_briefing(self, assessment):
        """Write the human-readable briefing file."""
        briefing = assessment.get("briefing", "")
        if not briefing:
            # Build a minimal briefing from the assessment
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
            health = assessment.get("health", "UNKNOWN")
            summary = assessment.get("summary", "")
            observations = assessment.get("observations", [])
            asks = assessment.get("asks", [])

            lines = [
                f"# Editor Briefing — {timestamp}",
                f"",
                f"## Pipeline Health: {health}",
                f"{summary}",
                f"",
                f"## Observations",
            ]
            for obs in observations:
                lines.append(f"- {obs}")

            if asks:
                lines.append("")
                lines.append("## Asks (needs human input)")
                for ask in asks:
                    lines.append(f"- {ask}")

            briefing = "\n".join(lines)

        os.makedirs(os.path.dirname(BRIEFING_PATH), exist_ok=True)
        with open(BRIEFING_PATH, "w") as f:
            f.write(briefing)

    def _write_inbox_message(self, assessment, is_reply=False):
        """Append a structured message to the inbox JSON file."""
        msg_text = assessment.get("inbox_message")
        if not msg_text:
            # Fallback: use summary
            msg_text = assessment.get("summary", "")
        if not msg_text:
            return

        msg_type = assessment.get("inbox_type", "status")
        if msg_type not in ("status", "alert"):
            msg_type = "status"

        now = datetime.now()
        message = {
            "time": now.strftime("%H:%M"),
            "timestamp": now.isoformat(),
            "type": msg_type,
            "text": msg_text,
            "is_reply": is_reply,
        }

        # Read existing messages
        messages = []
        if os.path.exists(MESSAGES_PATH):
            try:
                with open(MESSAGES_PATH) as f:
                    messages = json.load(f)
            except Exception:
                messages = []

        messages.append(message)

        # Keep only the most recent MAX_MESSAGES
        if len(messages) > MAX_MESSAGES:
            messages = messages[-MAX_MESSAGES:]

        os.makedirs(os.path.dirname(MESSAGES_PATH), exist_ok=True)
        with open(MESSAGES_PATH, "w") as f:
            json.dump(messages, f)

    def get_dashboard_status(self):
        """Override to include editor-specific fields."""
        import time as _time
        base = super().get_dashboard_status()
        # Override editor_state if within happy window
        if _time.time() < self._happy_until:
            base["editor_state"] = "happy"
        else:
            base["editor_state"] = self._editor_state
        base["cost"] = {
            "api_calls": self._api_calls,
            "input_tokens": self._total_input_tokens,
            "output_tokens": self._total_output_tokens,
            "total_cost": round(self._total_cost, 4),
        }
        return base

    def get_progress(self):
        """Editor progress is based on overall pipeline completion."""
        total_agents = len(self.workers)
        idle_agents = sum(
            1 for a in self.workers.values()
            if not a._active and not a.is_paused
        )
        return {"current": idle_agents, "total": total_agents}
