"""
Editor Agent — Central coordinator for the hub-and-spoke pipeline.

The Editor is the ONLY agent that writes pipeline state to Supabase.
Worker agents (Scout, Courier, Reader, Detective, Researcher) receive
tasks via their inbox queues and report results via outbox queues.

EVENT-DRIVEN ARCHITECTURE (replaces the old 5-second polling loop):

The Editor blocks on a single asyncio.Queue that receives events from
four background producer tasks:

  ┌─────────────────┐   ┌──────────────────┐   ┌─────────────────┐
  │ Outbox Forwarder │   │ Message Watcher  │   │ Timer Heartbeats│
  │ (checks 0.5s)   │   │ (checks 1s mtime)│   │ (30s / 300s)    │
  └────────┬────────┘   └────────┬─────────┘   └────────┬────────┘
           │                     │                       │
           ▼                     ▼                       ▼
      ┌─────────────────────────────────────────────────────┐
      │              Editor Event Queue                      │
      │   await queue.get()  ← blocks until event arrives   │
      └──────────────────────────┬──────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   _handle_event()      │
                    │                        │
                    │  agent_result → commit  │
                    │  human_message → chat   │
                    │  timer_plan → assign    │
                    │  timer_strategic → LLM  │
                    └────────────────────────┘

Event latencies:
  agent_result  — < 1 second  (0.5s outbox poll)
  human_message — < 2 seconds (1s file mtime watch)
  timer_plan    — every 30s   (planning heartbeat)
  timer_strategic — every 300s (LLM assessment) OR immediately on chat
"""

import asyncio
import json
import os
import sys
import time as _time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agents.base import Agent, DATA_DIR, LOG_PATH, update_json_locked, read_json_locked
from agents.tasks import Task, TaskResult, EditorLedger
from db import (
    get_supabase, update_issue, delete_features_for_issue, list_issues,
    count_issues_by_status, upsert_issue, get_issue_by_identifier,
    update_editor_verdict,
)

@dataclass
class EditorEvent:
    """A single event delivered to the Editor's event queue.

    Event types:
      agent_result   — a worker finished a task (payload: list of (agent_name, TaskResult))
      human_message  — a human sent a chat message (payload: None)
      timer_plan     — 30-second planning heartbeat (payload: None)
      timer_strategic — 5-minute strategic assessment heartbeat (payload: None)
    """
    type: str                              # "agent_result" | "human_message" | "timer_plan" | "timer_strategic"
    payload: Any = None                    # event-specific data
    timestamp: float = field(default_factory=_time.time)


BRIEFING_PATH = os.path.join(DATA_DIR, "editor_briefing.md")
INBOX_PATH = os.path.join(DATA_DIR, "editor_inbox.md")
MESSAGES_PATH = os.path.join(DATA_DIR, "editor_messages.json")
HUMAN_MESSAGES_PATH = os.path.join(DATA_DIR, "human_messages.json")
COST_PATH = os.path.join(DATA_DIR, "editor_cost.json")
MEMORY_PATH = os.path.join(DATA_DIR, "editor_memory.json")
EXTRACTIONS_DIR = os.path.join(DATA_DIR, "extractions")
XREF_DIR = os.path.join(DATA_DIR, "cross_references")
MAX_MESSAGES = 50
MAX_MEMORY_ENTRIES = 100

MIN_YEAR = 1988
MAX_YEAR = 2025
TOTAL_EXPECTED = (MAX_YEAR - MIN_YEAR + 1) * 12  # 456

# Quality gates (moved from Reader)
NULL_RATE_THRESHOLD = 0.50
MIN_FEATURES_FOR_LOAD = 2
QC_FIELDS = ["homeowner_name", "designer_name", "location_city",
             "location_country", "design_style", "year_built"]

# Timing intervals
PLAN_INTERVAL = 30       # seconds between planning cycles
STRATEGIC_INTERVAL = 300  # seconds between LLM assessments
MAX_TASK_FAILURES = 3     # before giving up on an identifier/name

# Opus pricing per 1M tokens (used for strategic assessments)
HAIKU_INPUT_COST_PER_1M = 15.00
HAIKU_OUTPUT_COST_PER_1M = 75.00

# Sonnet model for dossier review (~$0.005 per review)
SONNET_MODEL = "claude-sonnet-4-5-20250929"
SONNET_INPUT_COST_PER_1M = 3.00
SONNET_OUTPUT_COST_PER_1M = 15.00


class EditorAgent(Agent):
    def __init__(self, workers=None):
        super().__init__("editor", interval=5)
        self.workers = workers or {}
        self.ledger = EditorLedger()

        # Event-driven architecture
        self._event_queue = asyncio.Queue()
        self._human_messages_mtime = 0.0  # last known mtime of human_messages.json

        # Timing
        self._last_plan_time = 0
        self._last_strategic_time = 0
        self._last_haiku_time = 0

        # State
        self._last_assessment = None
        self._editor_state = "idle"
        self._happy_until = 0
        self._last_health = None

        # Cost tracking
        self._client = None
        self._api_calls = 0
        self._total_input_tokens = 0
        self._total_output_tokens = 0
        self._total_cost = 0.0
        self._load_cost_state()

        # Track assigned tasks (so we can see what's in flight)
        self._tasks_in_flight = {}  # task_id -> {"agent": name, "task": Task, "assigned_at": iso}
        self._tasks_completed = 0
        self._tasks_failed = 0

        # Memory
        memory = self._load_memory()
        memory["restart_count"] = memory.get("restart_count", 0) + 1
        self._last_health = memory.get("last_assessment_health")
        self._save_memory(memory)

    # ── Anthropic Client ────────────────────────────────────────

    def _get_client(self):
        if self._client is None:
            import anthropic
            self._client = anthropic.Anthropic()
        return self._client

    def _load_cost_state(self):
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

    # ── Memory ──────────────────────────────────────────────────

    def _load_memory(self):
        if os.path.exists(MEMORY_PATH):
            try:
                with open(MEMORY_PATH) as f:
                    return json.load(f)
            except Exception:
                pass
        return {"entries": [], "last_assessment_health": None, "restart_count": 0}

    def _save_memory(self, memory):
        if len(memory.get("entries", [])) > MAX_MEMORY_ENTRIES:
            memory["entries"] = memory["entries"][-MAX_MEMORY_ENTRIES:]
        os.makedirs(os.path.dirname(MEMORY_PATH), exist_ok=True)
        with open(MEMORY_PATH, "w") as f:
            json.dump(memory, f, indent=2)

    def _remember(self, category, text):
        memory = self._load_memory()
        memory["entries"].append({
            "time": datetime.now().isoformat(),
            "category": category,
            "text": text,
        })
        self._save_memory(memory)

    def _get_memory_summary(self):
        memory = self._load_memory()
        entries = memory.get("entries", [])
        if not entries:
            return "No prior observations recorded."
        recent = entries[-15:]
        return "\n".join(f"[{e['category']}] {e['text']}" for e in recent)

    # ── Human Messages ──────────────────────────────────────────

    def _read_human_messages(self):
        if not os.path.exists(HUMAN_MESSAGES_PATH):
            return []
        try:
            with open(HUMAN_MESSAGES_PATH) as f:
                messages = json.load(f)
            return [m for m in messages if not m.get("read")]
        except Exception:
            return []

    def _mark_messages_read(self):
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

    # ═══════════════════════════════════════════════════════════
    # EVENT-DRIVEN RUN LOOP — replaces base class polling
    # ═══════════════════════════════════════════════════════════

    async def run(self):
        """Event-driven main loop. Blocks on a unified event queue instead of polling.

        Starts 4 background producer tasks that feed events into self._event_queue,
        then loops on queue.get() dispatching each event to _handle_event().
        """
        self._running = True
        self._stop_requested = False
        self.log("Editor agent started (event-driven)")

        # Initialize human_messages mtime
        if os.path.exists(HUMAN_MESSAGES_PATH):
            try:
                self._human_messages_mtime = os.path.getmtime(HUMAN_MESSAGES_PATH)
            except OSError:
                pass

        # Start background producer tasks
        producers = [
            asyncio.create_task(self._outbox_forwarder(), name="outbox_forwarder"),
            asyncio.create_task(self._human_message_watcher(), name="message_watcher"),
            asyncio.create_task(self._planning_heartbeat(), name="planning_heartbeat"),
            asyncio.create_task(self._strategic_heartbeat(), name="strategic_heartbeat"),
        ]

        try:
            while not self._stop_requested:
                # Block until an event arrives (10s timeout to check stop flag)
                try:
                    event = await asyncio.wait_for(
                        self._event_queue.get(), timeout=10.0
                    )
                except asyncio.TimeoutError:
                    # No event in 10s — just loop back to check stop flag
                    continue

                self._active = True
                try:
                    await self._handle_event(event)
                    # After handling, drain any events that queued up during processing
                    await self._drain_pending_events()
                except Exception as e:
                    self._errors += 1
                    self._last_error = str(e)
                    self._last_error_time = datetime.now()
                    self.log(f"Error handling {event.type} event: {e}", level="ERROR")
                finally:
                    self._active = False
                    self._cycles += 1
                    self._last_work_time = datetime.now()

                # Update idle display
                if _time.time() < self._happy_until:
                    self._editor_state = "happy"
                    self._current_task = "Instructions acknowledged!"
                else:
                    self._editor_state = "idle"
                    self._current_task = f"Coordinating — {self._tasks_completed} tasks done, {len(self._tasks_in_flight)} in flight"

        finally:
            # Cancel all producer tasks
            for task in producers:
                task.cancel()
            await asyncio.gather(*producers, return_exceptions=True)
            self._running = False
            self.log("Editor agent stopped")

    async def work(self):
        """Stub — required by base class @abstractmethod but never called.

        The Editor overrides run() with an event-driven loop, so work() is bypassed.
        """
        return False

    # ── Event Producers ───────────────────────────────────────

    async def _outbox_forwarder(self):
        """Poll worker outboxes every 0.5s and forward results to the event queue.

        This is the bridge between the workers' outbox queues (push model) and
        the Editor's event queue. 0.5s polling is simple and introduces no
        coupling between worker agents and the Editor's internals.
        """
        while not self._stop_requested:
            collected = self._collect_results()
            if collected:
                await self._event_queue.put(
                    EditorEvent(type="agent_result", payload=collected)
                )
            await asyncio.sleep(0.5)

    async def _human_message_watcher(self):
        """Watch human_messages.json mtime every 1s. Fires event on change.

        Uses a single os.path.getmtime() stat() syscall per check — lightweight.
        Only fires an event when new messages arrive (mtime changes).
        """
        while not self._stop_requested:
            try:
                if os.path.exists(HUMAN_MESSAGES_PATH):
                    mtime = os.path.getmtime(HUMAN_MESSAGES_PATH)
                    if mtime > self._human_messages_mtime:
                        # File changed — check if there are unread messages
                        unread = self._read_human_messages()
                        if unread:
                            self._human_messages_mtime = mtime
                            await self._event_queue.put(
                                EditorEvent(type="human_message")
                            )
                        else:
                            # mtime changed but no unread messages (just marked read)
                            self._human_messages_mtime = mtime
            except OSError:
                pass
            await asyncio.sleep(1.0)

    async def _planning_heartbeat(self):
        """Emit timer_plan event every PLAN_INTERVAL seconds."""
        while not self._stop_requested:
            await asyncio.sleep(PLAN_INTERVAL)
            if not self._stop_requested:
                await self._event_queue.put(
                    EditorEvent(type="timer_plan")
                )

    async def _strategic_heartbeat(self):
        """Emit timer_strategic event every STRATEGIC_INTERVAL seconds."""
        while not self._stop_requested:
            await asyncio.sleep(STRATEGIC_INTERVAL)
            if not self._stop_requested:
                await self._event_queue.put(
                    EditorEvent(type="timer_strategic")
                )

    # ── Event Dispatcher ──────────────────────────────────────

    async def _handle_event(self, event):
        """Route a single event to the appropriate handler."""
        if event.type == "agent_result":
            self._process_results(event.payload)

        elif event.type == "human_message":
            # Human messages get immediate strategic assessment
            self._last_strategic_time = _time.time()
            await self._strategic_assessment(has_human_messages=True)

        elif event.type == "timer_plan":
            self._last_plan_time = _time.time()
            await self._plan_and_assign()

        elif event.type == "timer_strategic":
            self._last_strategic_time = _time.time()
            await self._strategic_assessment(has_human_messages=False)

        else:
            self.log(f"Unknown event type: {event.type}", level="WARN")

    async def _drain_pending_events(self):
        """After handling one event, drain any that accumulated during processing.

        During a long LLM call (~5s), multiple agent_result events may queue up.
        This batches them into a single _process_results() call for efficiency.
        Other event types are handled individually.
        """
        batched_results = []

        while not self._event_queue.empty():
            try:
                event = self._event_queue.get_nowait()
            except asyncio.QueueEmpty:
                break

            if event.type == "agent_result":
                # Batch agent results together
                batched_results.extend(event.payload)
            else:
                # Handle non-result events immediately (but first flush any batched results)
                if batched_results:
                    self._process_results(batched_results)
                    batched_results = []
                await self._handle_event(event)

        # Flush any remaining batched results
        if batched_results:
            self._process_results(batched_results)

    # ═══════════════════════════════════════════════════════════
    # PHASE 1: COLLECT RESULTS
    # ═══════════════════════════════════════════════════════════

    def _collect_results(self):
        """Drain all worker outboxes. Returns list of (agent_name, TaskResult)."""
        collected = []
        for name, agent in self.workers.items():
            while True:
                try:
                    result = agent.outbox.get_nowait()
                    collected.append((name, result))
                except asyncio.QueueEmpty:
                    break
        return collected

    # ═══════════════════════════════════════════════════════════
    # PHASE 2: PROCESS RESULTS — validate and commit to Supabase
    # ═══════════════════════════════════════════════════════════

    def _process_results(self, collected):
        """Validate each result and commit to Supabase or handle failure."""
        for agent_name, result in collected:
            # Remove from in-flight tracking
            self._tasks_in_flight.pop(result.task_id, None)

            if result.status == "success":
                self._tasks_completed += 1
                self._handle_success(agent_name, result)
            else:
                self._tasks_failed += 1
                self._handle_failure(agent_name, result)

    def _handle_success(self, agent_name, result):
        """Process a successful task result — validate and commit to Supabase."""
        task_type = result.task_type
        data = result.result

        if task_type == "discover_issues":
            self._commit_discovered_issues(data)
        elif task_type == "fix_dates":
            self._commit_fixed_dates(data)
        elif task_type == "download_pdf":
            self._commit_download(data)
        elif task_type == "extract_features":
            self._commit_extraction(data)
        elif task_type == "reextract_features":
            self._commit_extraction(data)
        elif task_type == "cross_reference":
            self._commit_cross_reference(data)
        elif task_type == "investigate_lead":
            self._commit_investigation(data)
        else:
            self.log(f"Unknown task type '{task_type}' from {agent_name}", level="WARN")

    def _commit_discovered_issues(self, data):
        """Commit Scout's discovered issues to Supabase."""
        found = data.get("found_issues", [])
        for issue in found:
            ident = issue.get("identifier", "")
            if not ident:
                continue
            year = issue.get("year")
            month = issue.get("month")
            if not year or year < MIN_YEAR or year > MAX_YEAR:
                continue

            source = issue.get("source", "archive.org")
            db_source = "ad_archive" if "ad_archive" in source else "archive.org"

            upsert_issue(ident, {
                "title": issue.get("title", ""),
                "month": month,
                "year": year,
                "status": "discovered",
                "needs_review": issue.get("confidence", "low") == "low",
                "date_confidence": issue.get("confidence", "medium"),
                "date_source": source,
                "source": db_source,
                "source_url": issue.get("url"),
            })
            self.ledger.record(ident, "scout", "discover_issues", True)
            self.log(f"Committed: {year}-{month:02d} ({ident[:40]})")

        not_found = data.get("not_found", [])
        for month_key in not_found:
            self.ledger.record(month_key, "scout", "discover_issues", False,
                               note="not found")
        self.ledger.save()

    def _commit_fixed_dates(self, data):
        """Commit Scout's date fixes to Supabase."""
        for verified in data.get("verified_issues", []):
            ident = verified.get("identifier")
            year = verified.get("year")
            month = verified.get("month")
            if not ident or not year:
                continue
            updates = {
                "year": year,
                "month": month,
                "date_confidence": verified.get("confidence", "low"),
                "date_source": verified.get("source", "scout_verified"),
                "needs_review": verified.get("confidence", "low") == "low",
            }
            update_issue(ident, updates)
            self.ledger.record(ident, "scout", "fix_dates", True)
            self.log(f"Date fixed: {ident} → {year}-{month or '??'}")
        self.ledger.save()

    def _commit_download(self, data):
        """Commit Courier's download result to Supabase."""
        identifier = data.get("identifier", "")
        pdf_path = data.get("pdf_path", "")
        if identifier and pdf_path:
            update_issue(identifier, {"status": "downloaded", "pdf_path": pdf_path})
            self.ledger.record(identifier, "courier", "download_pdf", True)
            self.log(f"Downloaded: {identifier}")
        self.ledger.save()

    def _commit_extraction(self, data):
        """Validate Reader's extraction and load into Supabase if quality passes."""
        identifier = data.get("identifier", "")
        features = data.get("features", [])
        output_path = data.get("extraction_path", "")
        quality_metrics = data.get("quality_metrics", {})

        if not identifier:
            return

        # Quality gate (moved from Reader)
        verdict = self._quality_gate(features, quality_metrics)

        if verdict == "load":
            # Load into Supabase
            try:
                from load_features import load_extraction
                inserted = load_extraction(output_path)
                update_issue(identifier, {"status": "extracted"})
                self.ledger.record(identifier, "reader", "extract_features", True,
                                   note=f"Loaded {inserted} features")
                self.log(f"Loaded {inserted} features for {identifier}")
            except Exception as e:
                self.ledger.record(identifier, "reader", "extract_features", False,
                                   error=str(e))
                self.log(f"Supabase load failed for {identifier}: {e}", level="ERROR")
        else:
            # Quality hold — log it, don't load
            esc_type = quality_metrics.get("escalation_type", "unknown")
            self.ledger.record(identifier, "reader", "extract_features", False,
                               note=f"Quality hold: {esc_type}")
            self.log(f"HELD {identifier}: {esc_type} — {quality_metrics}", level="WARN")

        self.ledger.save()

    def _quality_gate(self, features, metrics):
        """Rule-based extraction quality check. Returns 'load' or 'hold'."""
        feature_count = len(features)
        if feature_count == 0:
            metrics["escalation_type"] = "zero_features"
            return "hold"
        if feature_count <= 1:
            metrics["escalation_type"] = "insufficient_features"
            return "hold"

        null_count = sum(
            1 for f in features
            if not f.get("homeowner_name") or f["homeowner_name"] in ("null", "None")
        )
        null_rate = null_count / feature_count
        if null_rate > NULL_RATE_THRESHOLD:
            metrics["escalation_type"] = "high_null_rate"
            metrics["null_homeowner_rate"] = round(null_rate, 2)
            return "hold"

        return "load"

    def _commit_cross_reference(self, data):
        """Save Detective's cross-reference results."""
        checked = data.get("checked", [])
        if not checked:
            return

        # Detective writes results to its own file (analysis output, not pipeline state)
        # The Editor just logs the event
        for entry in checked:
            name = entry.get("name", "?")
            verdict = entry.get("combined", "unknown")
            if verdict in ("confirmed_match", "likely_match"):
                self.log(f"MATCH: {name} → {verdict}")
                self._remember("milestone", f"Detective found {verdict}: {name}")

        self.ledger.save()

    def _commit_investigation(self, data):
        """Review Researcher's dossier as gatekeeper — confirm or reject.

        COINCIDENCE → auto-REJECTED (no LLM call).
        HIGH/MEDIUM/LOW → Sonnet review → CONFIRMED or REJECTED.
        Updates Supabase with final editor verdict.
        """
        name = data.get("name", "?")
        strength = data.get("connection_strength", "UNKNOWN")
        triage = data.get("triage_result", "investigate")
        feature_id = data.get("feature_id")
        dossier = data.get("dossier", {})

        # ── COINCIDENCE: auto-reject, no LLM call ──
        if strength == "COINCIDENCE" or triage == "coincidence":
            verdict = "REJECTED"
            reasoning = f"Auto-rejected: triaged as COINCIDENCE — {dossier.get('strength_rationale', 'false positive')}"
            self.log(f"Dossier: {name} → REJECTED (COINCIDENCE, no review needed)")
        else:
            # ── HIGH / MEDIUM / LOW: Sonnet review ──
            try:
                verdict, reasoning = self._review_dossier(name, strength, dossier)
                self.log(f"Dossier: {name} → {verdict} (proposed {strength})")
            except Exception as e:
                verdict = "PENDING_REVIEW"
                reasoning = f"Review failed: {e}"
                self.log(f"Dossier review failed for {name}: {e}", level="ERROR")

        # ── Update Supabase with editor verdict ──
        if feature_id:
            try:
                update_editor_verdict(feature_id, verdict, reasoning)
            except Exception as e:
                self.log(f"Failed to update editor verdict for {name}: {e}", level="ERROR")

        # ── Ledger + memory ──
        self.ledger.record(name, "researcher", "investigate_lead", True,
                           note=f"proposed={strength} → {verdict}")
        if verdict == "CONFIRMED" and strength in ("HIGH", "MEDIUM"):
            self._remember("milestone", f"CONFIRMED dossier: {name} ({strength})")
        self.ledger.save()

    def _review_dossier(self, name, proposed_strength, dossier):
        """LLM review of a Researcher dossier. Uses Sonnet (~$0.005/review).

        Prompt intensity varies by proposed strength:
          HIGH   → quick sanity check, default CONFIRMED
          MEDIUM → judgment call, could go either way
          LOW    → skeptical, default REJECTED

        Returns:
            (verdict, reasoning) — verdict is "CONFIRMED" or "REJECTED"
        """
        client = self._get_client()

        if proposed_strength == "HIGH":
            stance = (
                "The Researcher rated this HIGH. Your default is CONFIRMED — "
                "only reject if there's a clear factual error, misidentification, "
                "or the evidence obviously doesn't support the rating."
            )
        elif proposed_strength == "MEDIUM":
            stance = (
                "The Researcher rated this MEDIUM. This is a judgment call. "
                "Confirm if the evidence is credible and the reasoning is sound. "
                "Reject if the connection seems coincidental or the evidence is thin."
            )
        else:  # LOW
            stance = (
                "The Researcher rated this LOW. Your default is REJECTED — "
                "only confirm if you see genuine merit the Researcher may have undersold."
            )

        system_prompt = f"""You are the Editor reviewing a Researcher's dossier for the AD-Epstein Index.

Your job: decide if this dossier should be CONFIRMED (real connection worth tracking)
or REJECTED (false positive, coincidence, or insufficient evidence).

{stance}

Key evidence to evaluate:
- Black Book matches (exact with address/phone = strong; last_name_only = weak)
- DOJ Library results (direct mention = strong; same surname different person = worthless)
- Pattern correlations (shared designer/location with confirmed matches = meaningful)
- Temporal relevance (1990-2008 overlap with Epstein's active period)

Respond with JSON only:
{{
  "verdict": "CONFIRMED" or "REJECTED",
  "reasoning": "2-3 sentences explaining your decision"
}}"""

        # Build concise dossier summary for review
        summary = {
            "subject_name": name,
            "proposed_strength": proposed_strength,
            "strength_rationale": dossier.get("strength_rationale", ""),
            "key_findings": dossier.get("key_findings", []),
            "triage_result": dossier.get("triage_result", ""),
            "epstein_connections": dossier.get("epstein_connections", []),
            "pattern_analysis": dossier.get("pattern_analysis"),
            "connection_strength": dossier.get("connection_strength", ""),
            "confidence_score": dossier.get("confidence_score"),
        }

        response = client.messages.create(
            model=SONNET_MODEL,
            max_tokens=512,
            system=system_prompt,
            messages=[{"role": "user", "content": json.dumps(summary, indent=2, default=str)}],
        )

        # Track cost (Sonnet pricing)
        usage = response.usage
        cost = (usage.input_tokens / 1_000_000 * SONNET_INPUT_COST_PER_1M +
                usage.output_tokens / 1_000_000 * SONNET_OUTPUT_COST_PER_1M)
        self._api_calls += 1
        self._total_input_tokens += usage.input_tokens
        self._total_output_tokens += usage.output_tokens
        self._total_cost += cost
        self._save_cost_state()

        # Parse response
        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if "```" in text:
                text = text[:text.rindex("```")]
            text = text.strip()

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            # Try to extract JSON object
            start = text.find("{")
            if start == -1:
                return ("PENDING_REVIEW", f"Could not parse review response: {text[:200]}")
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
                        parsed = json.loads(text[start:i+1])
                        break
            else:
                return ("PENDING_REVIEW", f"Incomplete JSON in review response: {text[:200]}")

        verdict = parsed.get("verdict", "PENDING_REVIEW")
        reasoning = parsed.get("reasoning", "No reasoning provided")

        if verdict not in ("CONFIRMED", "REJECTED"):
            verdict = "PENDING_REVIEW"

        return (verdict, reasoning)

    def _handle_failure(self, agent_name, result):
        """Handle a failed task — log to ledger, maybe reassign."""
        task_id = result.task_id
        task_type = result.task_type
        error = result.error or "unknown error"

        # Extract identifier/key from result data for ledger
        key = result.result.get("identifier") or result.result.get("name") or task_id

        self.ledger.record(key, agent_name, task_type, False, error=error)
        self.ledger.save()
        self.log(f"Task {task_id} failed ({agent_name}/{task_type}): {error}", level="WARN")

    # ═══════════════════════════════════════════════════════════
    # PHASE 3: PLAN AND ASSIGN — scan Supabase, create tasks
    # ═══════════════════════════════════════════════════════════

    async def _plan_and_assign(self):
        """Scan Supabase state, figure out what needs doing, assign tasks to agents."""
        self._editor_state = "assessing"
        self._current_task = "Planning next tasks..."

        try:
            counts = count_issues_by_status()
            all_issues = list_issues()
        except Exception as e:
            self.log(f"Planning failed — Supabase error: {e}", level="ERROR")
            return

        # Assign work to each agent (if they have capacity — inbox empty)
        self._plan_scout_tasks(all_issues, counts)
        self._plan_courier_tasks(counts)
        self._plan_reader_tasks(counts)
        self._plan_detective_tasks()
        self._plan_researcher_tasks()

    def _assign_task(self, agent_name, task):
        """Push a task to an agent's inbox if the agent exists and inbox is empty."""
        agent = self.workers.get(agent_name)
        if not agent:
            return False
        if agent.is_paused:
            return False
        # Don't overload: only assign if inbox is empty
        if not agent.inbox.empty():
            return False

        agent.inbox.put_nowait(task)
        self._tasks_in_flight[task.id] = {
            "agent": agent_name,
            "task": task.to_dict(),
            "assigned_at": datetime.now().isoformat(),
        }
        self.log(f"Assigned {agent_name}: {task.goal[:60]}", level="DEBUG")
        return True

    def _plan_scout_tasks(self, all_issues, counts):
        """Gap analysis — what issues are missing? Assign Scout to find them."""
        if "scout" not in self.workers:
            return

        # Don't assign if Scout already has a task
        if not self.workers["scout"].inbox.empty():
            return

        # Build gap analysis
        confirmed = {}
        misdated = []
        for issue in all_issues:
            year = issue.get("year")
            month = issue.get("month")
            if year and MIN_YEAR <= year <= MAX_YEAR and month:
                confirmed[(year, month)] = issue
            elif year and (year < MIN_YEAR or year > MAX_YEAR):
                # Could be misdated
                misdated.append(issue)

        # Priority 1: Fix misdated issues
        if misdated:
            batch = misdated[:10]
            task = Task(
                type="fix_dates",
                goal=f"Verify dates on {len(batch)} misdated issues",
                params={"batch": [{"identifier": i["identifier"], "title": i.get("title", ""),
                                    "year": i.get("year"), "month": i.get("month")} for i in batch]},
                priority=3,  # LOW priority — don't block discovery
            )
            self._assign_task("scout", task)
            return

        # Priority 2: Discover missing issues
        missing_months = []
        for year in range(MIN_YEAR, MAX_YEAR + 1):
            for month in range(1, 13):
                if (year, month) not in confirmed:
                    month_key = f"{year}-{month:02d}"
                    # Check ledger — skip if exhausted
                    if self.ledger.should_retry(month_key, "discover_issues", max_failures=5):
                        missing_months.append(month_key)

        if missing_months:
            # Assign a batch of 6 months
            batch = missing_months[:6]
            context = self.ledger.get_context_for_agent(batch[0])
            task = Task(
                type="discover_issues",
                goal=f"Find AD issues for {', '.join(batch[:3])}{'...' if len(batch) > 3 else ''}",
                params={
                    "missing_months": batch,
                    "total_missing": len(missing_months),
                    "previous_failures": context,
                },
                priority=1,  # HIGH — this is the main bottleneck
            )
            self._assign_task("scout", task)

    def _plan_courier_tasks(self, counts):
        """What's discovered but not downloaded? Assign Courier."""
        if "courier" not in self.workers:
            return
        if not self.workers["courier"].inbox.empty():
            return

        # Find next issue to download
        issues = list_issues(status="discovered")
        downloadable = [
            i for i in issues
            if i.get("month") and i.get("year")
            and self.ledger.should_retry(i["identifier"], "download_pdf", max_failures=MAX_TASK_FAILURES)
        ]

        if not downloadable:
            return

        issue = downloadable[0]
        ident = issue["identifier"]
        context = self.ledger.get_context_for_agent(ident)

        task = Task(
            type="download_pdf",
            goal=f"Download {issue.get('year')}-{issue.get('month', '?'):02d} ({ident[:30]})",
            params={
                "identifier": ident,
                "title": issue.get("title", ""),
                "year": issue.get("year"),
                "month": issue.get("month"),
                "source": issue.get("source", "archive.org"),
                "source_url": issue.get("source_url"),
                "previous_failures": context,
            },
            priority=2,
        )
        self._assign_task("courier", task)

    def _plan_reader_tasks(self, counts):
        """What's downloaded but not extracted? Assign Reader."""
        if "reader" not in self.workers:
            return
        if not self.workers["reader"].inbox.empty():
            return

        issues = list_issues(status="downloaded")
        for issue in issues:
            ident = issue["identifier"]
            # Check if extraction already exists on disk
            output_path = os.path.join(EXTRACTIONS_DIR, f"{ident}.json")
            if os.path.exists(output_path):
                # Already extracted on disk — maybe needs loading
                # Check if it was already loaded (status would be 'extracted')
                continue

            if not self.ledger.should_retry(ident, "extract_features", max_failures=MAX_TASK_FAILURES):
                continue

            context = self.ledger.get_context_for_agent(ident)
            task = Task(
                type="extract_features",
                goal=f"Extract features from {issue.get('year', '?')}-{issue.get('month', '?'):02d}",
                params={
                    "identifier": ident,
                    "pdf_path": issue.get("pdf_path", ""),
                    "title": issue.get("title", ""),
                    "year": issue.get("year"),
                    "month": issue.get("month"),
                    "previous_failures": context,
                },
                priority=2,
            )
            self._assign_task("reader", task)
            return

        # Also check for extractions on disk that need loading
        for issue in issues:
            ident = issue["identifier"]
            output_path = os.path.join(EXTRACTIONS_DIR, f"{ident}.json")
            if os.path.exists(output_path):
                try:
                    with open(output_path) as f:
                        data = json.load(f)
                    if data.get("skipped"):
                        continue
                    features = data.get("features", [])
                    quality_metrics = {
                        "feature_count": len(features),
                    }
                    verdict = self._quality_gate(features, quality_metrics)
                    if verdict == "load":
                        from load_features import load_extraction
                        inserted = load_extraction(output_path)
                        update_issue(ident, {"status": "extracted"})
                        self.log(f"Loaded {inserted} features for {ident} (disk retry)")
                except Exception as e:
                    self.log(f"Failed to load extraction for {ident}: {e}", level="ERROR")

    def _plan_detective_tasks(self):
        """What features need cross-referencing? Assign Detective."""
        if "detective" not in self.workers:
            return
        if not self.workers["detective"].inbox.empty():
            return

        # Detective's work() already handles this well — just let it run
        # The Detective checks for unchecked features on its own
        # We only assign explicit tasks when we need targeted re-checks

    def _plan_researcher_tasks(self):
        """What leads need investigation? Assign Researcher."""
        if "researcher" not in self.workers:
            return
        if not self.workers["researcher"].inbox.empty():
            return

        # Researcher's work() already handles this well — just let it run

    # ═══════════════════════════════════════════════════════════
    # PHASE 4: STRATEGIC ASSESSMENT (periodic LLM call)
    # ═══════════════════════════════════════════════════════════

    async def _strategic_assessment(self, has_human_messages):
        """Call Claude for complex decisions and human interaction."""
        if has_human_messages:
            self._editor_state = "listening"
            self._current_task = "Reading human message..."
        else:
            self._editor_state = "assessing"
            self._current_task = "Strategic assessment..."

        skills = self.load_skills()
        report = self._build_situation_report()

        try:
            assessment = await asyncio.to_thread(
                self._call_haiku, skills, report
            )
        except Exception as e:
            self._editor_state = "idle"
            self.log(f"Assessment failed: {e}", level="ERROR")
            return

        self._last_assessment = assessment
        self._last_haiku_time = _time.time()

        # Execute actions from assessment
        self._execute_actions(assessment)

        # Write briefing
        self._write_briefing(assessment)

        # Write inbox message
        self._write_inbox_message(assessment, is_reply=has_human_messages)

        # Mark human messages as read
        self._mark_messages_read()

        # Update state
        if has_human_messages:
            self._editor_state = "happy"
            self._happy_until = _time.time() + 20
            self._current_task = "Instructions acknowledged!"
        else:
            self._editor_state = "idle"

        # Persist health to memory
        health = assessment.get("health", "UNKNOWN")
        memory = self._load_memory()
        memory["last_assessment_health"] = health
        memory["last_assessment_time"] = datetime.now().isoformat()
        self._save_memory(memory)
        self._last_health = health

        summary = assessment.get("summary", "No summary")
        self._current_task = f"Pipeline: {health} — {summary}"
        self.log(f"Assessment: {health} — {summary}")

    def _build_situation_report(self):
        """Gather status from all agents + pipeline state + memory."""
        report = {
            "timestamp": datetime.now().isoformat(),
            "agents": {},
            "recent_log": [],
            "inbox": "",
            "task_board": {
                "in_flight": len(self._tasks_in_flight),
                "completed": self._tasks_completed,
                "failed": self._tasks_failed,
                "details": list(self._tasks_in_flight.values())[:10],
            },
        }

        # Agent statuses
        for name, agent in self.workers.items():
            report["agents"][name] = agent.get_dashboard_status()

        # Recent activity log (last 30 lines)
        if os.path.exists(LOG_PATH):
            with open(LOG_PATH) as f:
                lines = f.readlines()
            report["recent_log"] = [line.strip() for line in lines[-30:]]

        # Human messages
        report["human_messages"] = self._read_human_messages()

        # Memory
        report["editor_memory"] = self._get_memory_summary()

        # Quality audit
        report["quality_audit"] = self._build_quality_report()

        # Cross-reference summary
        report["xref_summary"] = self._build_xref_summary()

        # Ledger summary (recent failures)
        report["ledger_summary"] = self._build_ledger_summary()

        return report

    def _build_ledger_summary(self):
        """Build a summary of recent failures from the ledger."""
        summary = {"total_keys": 0, "keys_with_failures": 0, "recent_failures": []}
        for key, entries in self.ledger._data.items():
            summary["total_keys"] += 1
            failures = [e for e in entries if not e["success"]]
            if failures:
                summary["keys_with_failures"] += 1
                last_fail = failures[-1]
                summary["recent_failures"].append({
                    "key": key[:40],
                    "count": len(failures),
                    "last_error": last_fail.get("error", "")[:80],
                    "agent": last_fail.get("agent", ""),
                })
        # Sort by failure count descending, keep top 10
        summary["recent_failures"].sort(key=lambda x: x["count"], reverse=True)
        summary["recent_failures"] = summary["recent_failures"][:10]
        return summary

    def _build_quality_report(self):
        """Audit Supabase for data quality issues."""
        report = {
            "total_features": 0,
            "supabase_nulls": [],
            "duplicates": [],
            "near_duplicates": [],
            "issues_needing_reextraction": [],
            "issue_identifier_map": {},
        }

        try:
            sb = get_supabase()
            all_features = sb.table("features").select("id,homeowner_name,article_title,issue_id,page_number").execute()
            features = all_features.data
            report["total_features"] = len(features)

            all_issues = sb.table("issues").select("id,month,year,identifier").execute()
            issue_map = {row["id"]: row for row in all_issues.data}

            for iid, iss in issue_map.items():
                if iss.get("identifier"):
                    report["issue_identifier_map"][str(iid)] = iss["identifier"]

            # NULL homeowner_name
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

            # Exact duplicates
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

            # Near-duplicates
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
                        if name_a == name_b:
                            continue
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

            # Issues needing re-extraction
            null_by_issue = defaultdict(lambda: {"nulls": 0, "total": 0})
            for f in features:
                iid = f["issue_id"]
                null_by_issue[iid]["total"] += 1
                name = f.get("homeowner_name")
                if not name or str(name).lower() in ("null", "none", "unknown"):
                    null_by_issue[iid]["nulls"] += 1
            for iid, counts_data in null_by_issue.items():
                if counts_data["nulls"] > 0:
                    iss = issue_map.get(iid, {})
                    identifier = report["issue_identifier_map"].get(str(iid), "?")
                    report["issues_needing_reextraction"].append({
                        "issue_id": iid,
                        "issue": f"{iss.get('year','?')}-{iss.get('month','?'):02d}" if isinstance(iss.get('month'), int) else "?",
                        "identifier": identifier,
                        "null_count": counts_data["nulls"],
                        "total_features": counts_data["total"],
                        "null_pct": round(100 * counts_data["nulls"] / counts_data["total"]),
                    })

        except Exception as e:
            self.log(f"Quality audit failed: {e}", level="ERROR")

        return report

    def _build_xref_summary(self):
        """Read cross-reference results summary."""
        summary = {"total_checked": 0, "total_matches": 0, "recent_matches": []}
        checked_path = os.path.join(XREF_DIR, "checked_features.json")
        results_path = os.path.join(XREF_DIR, "results.json")

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
                for m in matches[-5:]:
                    summary["recent_matches"].append({
                        "name": m.get("homeowner_name", "?"),
                        "match_type": m.get("match_type", "?"),
                        "issue": f"{m.get('year', '?')}-{m.get('month', '?')}",
                    })
        except Exception:
            pass

        return summary

    # ═══════════════════════════════════════════════════════════
    # LLM CALL — Strategic assessment
    # ═══════════════════════════════════════════════════════════

    def _call_haiku(self, skills, report):
        """Call Claude with the situation report. Returns parsed JSON."""
        client = self._get_client()

        system_prompt = f"""You are the Editor agent for the AD-Epstein Index pipeline.
You are the CENTRAL COORDINATOR — all pipeline state changes go through you.

{skills}

Respond with JSON only. Schema:
{{
  "health": "GOOD" | "CAUTION" | "ATTENTION",
  "summary": "One-line summary of pipeline state",
  "observations": ["observation 1", "observation 2", ...],
  "actions": [
    {{"type": "pause"|"resume"|"log"|"remember"|"update_skills"|"delete_features"|"reset_issue_pipeline"|"set_designer_mode"|"override_verdict"|"retry_doj_search", ...}}
  ],
  "briefing": "Full markdown briefing text for the human researcher",
  "inbox_message": "A concise 1-2 sentence update for the human's inbox dashboard.",
  "inbox_type": "status" or "alert",
  "asks": ["Question for human, if any"]
}}

## Task Board
The situation report includes "task_board" — your current task assignments:
- in_flight: tasks currently being executed by agents
- completed/failed: total counts
- details: what's currently assigned
Use this to track progress and detect stuck agents.

## Memory
Past observations in "editor_memory". Add new: {{"type": "remember", "category": "...", "reason": "..."}}

## Quality Control
"quality_audit" has Supabase data quality issues. Take cleanup actions:
- Delete exact duplicates: {{"type": "delete_features", "feature_ids": [id1], "reason": "Duplicate"}}
- Delete near-duplicates: keep the longer name
- Handle NULLs: delete if 1-2, reset_issue_pipeline if >50%
- {{"type": "reset_issue_pipeline", "issue_id": N, "identifier": "...", "reason": "..."}}
Only 2-3 cleanup actions per cycle.

## Ledger Summary
"ledger_summary" shows identifiers/names with the most failures. Use this to:
- Identify stuck items
- Avoid retrying exhausted items
- Report systemic issues

## Human Communication
If "human_messages" exist, RESPOND DIRECTLY. This is highest priority.
{{"type": "override_verdict", "name": "X", "verdict": "no_match", "reason": "Human instructed"}}
{{"type": "retry_doj_search", "name": "X", "reason": "Human requested"}}

## Cross-Reference Results
"xref_summary" — flag new matches with inbox_type "alert".

## Agent Actions
- {{"type": "pause", "agent": "agent_name", "reason": "..."}}
- {{"type": "resume", "agent": "agent_name", "reason": "..."}}
- {{"type": "update_skills", "agent": "agent_name", "content": "...", "reason": "..."}}
- {{"type": "set_designer_mode", "mode": "training"|"creating", "reason": "..."}}"""

        user_message = f"""Pipeline situation report:

```json
{json.dumps(report, indent=2, default=str)}
```

Analyze and provide your assessment."""

        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )

        self._track_usage(response)

        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if "```" in text:
                text = text[:text.rindex("```")]
            text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
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

    # ═══════════════════════════════════════════════════════════
    # ACTION EXECUTION
    # ═══════════════════════════════════════════════════════════

    def _execute_actions(self, assessment):
        """Execute actions recommended by the LLM."""
        for action in assessment.get("actions", []):
            action_type = action.get("type")
            agent_name = action.get("agent", "")
            reason = action.get("reason", "")

            if action_type == "remember":
                category = action.get("category", "observation")
                self._remember(category, reason)
                continue

            if action_type == "update_skills":
                self._update_agent_skills(agent_name, action.get("content", ""), reason)
                continue

            if action_type == "delete_features":
                self._delete_features(action)
                continue

            if action_type == "reset_issue_pipeline":
                self._reset_issue_pipeline(action)
                continue

            if action_type == "override_verdict":
                self._override_detective_verdict(action)
                continue

            if action_type == "retry_doj_search":
                self._retry_doj_search(action)
                continue

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

    def _delete_features(self, action):
        feature_ids = action.get("feature_ids", [])
        reason = action.get("reason", "Editor cleanup")
        if not feature_ids:
            return
        try:
            sb = get_supabase()
            for fid in feature_ids:
                sb.table("features").delete().eq("id", fid).execute()
            self.log(f"Deleted {len(feature_ids)} features: {feature_ids} — {reason}")
        except Exception as e:
            self.log(f"delete_features failed: {e}", level="ERROR")

    def _reset_issue_pipeline(self, action):
        issue_id = action.get("issue_id")
        identifier = action.get("identifier")
        reason = action.get("reason", "Editor reset")
        if not identifier or identifier == "?":
            return

        steps_done = []

        if issue_id:
            try:
                sb = get_supabase()
                existing = sb.table("features").select("id").eq("issue_id", issue_id).execute()
                count = len(existing.data)
                if count > 0:
                    sb.table("features").delete().eq("issue_id", issue_id).execute()
                    steps_done.append(f"Deleted {count} features")
                    deleted_ids = {row["id"] for row in existing.data}
                    self._remove_from_xref(deleted_ids)
            except Exception as e:
                self.log(f"Reset Supabase cleanup failed: {e}", level="ERROR")

        extraction_path = os.path.join(EXTRACTIONS_DIR, f"{identifier}.json")
        if os.path.exists(extraction_path):
            os.remove(extraction_path)
            steps_done.append("Deleted extraction")
        backup_path = extraction_path + ".backup"
        if os.path.exists(backup_path):
            os.remove(backup_path)

        issue_row = get_issue_by_identifier(identifier)
        if issue_row and issue_row.get("pdf_path"):
            old_pdf = issue_row["pdf_path"]
            if os.path.exists(old_pdf):
                os.remove(old_pdf)
                steps_done.append("Deleted PDF")

        update_issue(identifier, {"status": "discovered", "pdf_path": None})
        steps_done.append("Reset → discovered")

        self.log(f"Reset {identifier}: {' | '.join(steps_done)} — {reason}")

    def _remove_from_xref(self, feature_ids):
        results_path = os.path.join(XREF_DIR, "results.json")
        if os.path.exists(results_path):
            try:
                with open(results_path) as f:
                    results = json.load(f)
                results = [r for r in results if r.get("feature_id") not in feature_ids]
                with open(results_path, "w") as f:
                    json.dump(results, f, indent=2)
            except Exception:
                pass

        checked_path = os.path.join(XREF_DIR, "checked_features.json")
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
        name = action.get("name")
        verdict = action.get("verdict")
        reason = action.get("reason", "Editor override")
        if not name or not verdict:
            return
        valid_verdicts = {"confirmed_match", "likely_match", "possible_match", "no_match"}
        if verdict not in valid_verdicts:
            return
        verdicts_path = os.path.join(DATA_DIR, "detective_verdicts.json")
        new_verdict = {
            "name": name, "verdict": verdict, "reason": reason,
            "queued_by": "editor", "queued_time": datetime.now().isoformat(),
            "applied": False,
        }
        update_json_locked(verdicts_path, lambda data: data.append(new_verdict), default=[])
        self.log(f"Queued verdict override: {name} → {verdict}")

    def _retry_doj_search(self, action):
        name = action.get("name")
        reason = action.get("reason", "Editor requested retry")
        if not name:
            return
        results_path = os.path.join(XREF_DIR, "results.json")
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
            self.log(f"retry_doj_search failed: {e}", level="ERROR")
        self.log(f"Queued DOJ retry: {name}")

    def _set_designer_mode(self, action):
        mode = action.get("mode", "training")
        reason = action.get("reason", "Editor requested")
        if mode not in ("training", "creating"):
            return
        mode_path = os.path.join(DATA_DIR, "designer_mode.json")
        os.makedirs(os.path.dirname(mode_path), exist_ok=True)
        with open(mode_path, "w") as f:
            json.dump({"mode": mode, "set_by": "editor", "time": datetime.now().isoformat()}, f, indent=2)
        self.log(f"Set Designer mode to '{mode}': {reason}")

    # ═══════════════════════════════════════════════════════════
    # BRIEFING / INBOX
    # ═══════════════════════════════════════════════════════════

    def _write_briefing(self, assessment):
        briefing = assessment.get("briefing", "")
        if not briefing:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
            health = assessment.get("health", "UNKNOWN")
            summary = assessment.get("summary", "")
            observations = assessment.get("observations", [])
            asks = assessment.get("asks", [])
            lines = [
                f"# Editor Briefing — {timestamp}", "",
                f"## Pipeline Health: {health}", f"{summary}", "",
                f"## Observations",
            ]
            for obs in observations:
                lines.append(f"- {obs}")
            if asks:
                lines.append("")
                lines.append("## Asks")
                for ask in asks:
                    lines.append(f"- {ask}")
            briefing = "\n".join(lines)

        os.makedirs(os.path.dirname(BRIEFING_PATH), exist_ok=True)
        with open(BRIEFING_PATH, "w") as f:
            f.write(briefing)

    def _write_inbox_message(self, assessment, is_reply=False):
        msg_text = assessment.get("inbox_message")
        if not msg_text:
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

        messages = []
        if os.path.exists(MESSAGES_PATH):
            try:
                with open(MESSAGES_PATH) as f:
                    messages = json.load(f)
            except Exception:
                messages = []
        messages.append(message)
        if len(messages) > MAX_MESSAGES:
            messages = messages[-MAX_MESSAGES:]

        os.makedirs(os.path.dirname(MESSAGES_PATH), exist_ok=True)
        with open(MESSAGES_PATH, "w") as f:
            json.dump(messages, f)

    # ═══════════════════════════════════════════════════════════
    # DASHBOARD STATUS
    # ═══════════════════════════════════════════════════════════

    def get_dashboard_status(self):
        base = super().get_dashboard_status()
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
        base["task_board"] = {
            "in_flight": len(self._tasks_in_flight),
            "completed": self._tasks_completed,
            "failed": self._tasks_failed,
        }
        return base

    def get_progress(self):
        total_agents = len(self.workers)
        idle_agents = sum(
            1 for a in self.workers.values()
            if not a._active and not a.is_paused
        )
        return {"current": idle_agents, "total": total_agents}
