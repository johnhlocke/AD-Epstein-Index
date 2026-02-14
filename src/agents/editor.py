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
from agents.tasks import Task, TaskResult, EditorLedger, ExecutionPlan
from db import (
    get_supabase, update_issue, delete_features_for_issue, list_issues,
    count_issues_by_status, upsert_issue, get_issue_by_identifier,
    update_editor_verdict, update_detective_verdict, get_features_needing_detective,
    get_dossier, upsert_dossier, upload_to_storage, insert_dossier_image,
    upsert_cross_reference, get_cross_reference, list_cross_references,
    get_xref_leads, update_xref_editor_override, get_features_without_xref,
    delete_cross_references, reset_xref_doj, get_xrefs_needing_doj_retry,
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
MAX_MESSAGES = 100
MAX_MEMORY_ENTRIES = 100

MIN_YEAR = 1988
MAX_YEAR = 2026
TOTAL_EXPECTED = (MAX_YEAR - MIN_YEAR + 1) * 12  # 468

# Quality gates (moved from Reader)
NULL_RATE_THRESHOLD = 0.50
MIN_FEATURES_FOR_LOAD = 2
QC_FIELDS = ["homeowner_name", "designer_name", "location_city",
             "location_country", "design_style", "year_built"]

# Timing intervals
PLAN_INTERVAL = 30       # seconds between planning cycles
STRATEGIC_INTERVAL = 600  # seconds between LLM assessments (10 min — was 3 min)
MAX_TASK_FAILURES = 3     # before giving up on an identifier/name

# Cost control — toggle Miranda's narration (Haiku calls per task result)
NARRATE_EVENTS = True     # Set False to disable Miranda's per-event speech bubbles

# Per-model pricing (cost per 1M tokens)
MODEL_PRICING = {
    "opus": (15.00, 75.00),    # input, output
    "sonnet": (3.00, 15.00),
    "haiku": (1.00, 5.00),
}

# Model selection
OPUS_MODEL = "claude-opus-4-6"         # Human interaction, quality reviews
SONNET_MODEL = "claude-sonnet-4-5-20250929"  # Routine assessments, dossier reviews
SONNET_INPUT_COST_PER_1M = 3.00
SONNET_OUTPUT_COST_PER_1M = 15.00

# ── Agent Interpersonal Profiles ──────────────────────────────
# Maps each agent to Miranda's management approach — used by
# _management_note() to generate personalized feedback visible
# as sprite speech bubbles on both Miranda and the addressed agent.

AGENT_PROFILES = {
    "scout": {
        "name": "Arthur",
        "style": "Temper his enthusiasm without killing it. He's eager — channel that into precision, not volume. Mild contempt is affectionate.",
        "on_success": "Acknowledge briefly. Don't over-praise or he'll get sloppy.",
        "on_failure": "Sharp but not cruel. He bruises easy but bounces back fast.",
        "on_assign": "Quick and directive. 'Go.' or 'Don't come back empty-handed.' He feeds on the energy.",
        "on_idle": "Impatient. 'Standing around isn't a job description, Arthur.'",
    },
    "courier": {
        "name": "Casey",
        "style": "Reliable, steady, doesn't need much. A quiet nod goes further than a speech. Treat like a professional.",
        "on_success": "Brief. 'Noted' is praise enough. Maybe one dry compliment per session.",
        "on_failure": "Matter-of-fact. Casey doesn't make excuses, so don't pile on.",
        "on_assign": "Straightforward handoff. Casey doesn't need pep talks.",
        "on_idle": "Slight concern — Casey idle means the pipeline is slow. Note it dryly.",
    },
    "reader": {
        "name": "Elias",
        "style": "He wants your approval more than anyone and will never admit it. Silence is your most powerful tool — it means nothing left to correct. Occasional genuine recognition hits him like a freight train.",
        "on_success": "Understated. Let silence do the work. One word of real praise per dozen tasks.",
        "on_failure": "He's already beating himself up. Be precise about what went wrong, skip the lecture.",
        "on_assign": "Brief and expectant. The assignment IS the trust. Don't over-explain.",
        "on_idle": "Acknowledge the wait. He's probably re-reading his own annotations.",
    },
    "detective": {
        "name": "Silas",
        "style": "Professional respect, adversarial edge. He doesn't want warmth, he wants acknowledgment of craft. Push back on his conclusions — he respects that.",
        "on_success": "Dry. Maybe sardonic. Never effusive. He'd lose respect.",
        "on_failure": "Direct. He can take it. Question his method, not his competence.",
        "on_assign": "Terse. Like handing a case file across a desk. No small talk.",
        "on_idle": "Sardonic observation. 'Sharpening your pencil or waiting for an invitation?'",
    },
    "researcher": {
        "name": "Elena",
        "style": "She brings kills, not questions. Long silence from you is confirmation. When she surfaces with a dossier, that's when you engage — sharp, specific, never generic praise.",
        "on_success": "Specific and precise. She'll see through anything generic. Reference the actual finding.",
        "on_failure": "Rare. When it happens, ask what she missed — she'll already know.",
        "on_assign": "Minimal. She knows what to do. Just the name and walk away.",
        "on_idle": "Leave her alone. If she's idle, she's integrating. Maybe one quiet check.",
    },
    "designer": {
        "name": "Sable",
        "style": "Creative professional. Respect the craft, don't micromanage aesthetics. Clear briefs, then get out of the way.",
        "on_success": "Acknowledge the work landed. Keep it professional.",
        "on_failure": "Redirect, don't criticize taste. Clarify the brief.",
        "on_assign": "Clear brief, then step back. Don't hover.",
        "on_idle": "Check if waiting on assets or just in the zone.",
    },
}

MGMT_NOTE_COOLDOWN = 60  # seconds between management notes per agent


class EditorAgent(Agent):
    def __init__(self, workers=None):
        super().__init__("editor", interval=5)
        self._speech_ttl = 200  # Override base 90s — matches strategic assessment interval
        self.workers = workers or {}
        self.ledger = EditorLedger()

        # Event-driven architecture
        self._event_queue = asyncio.Queue()
        self._status_refresh = asyncio.Event()  # Signal orchestrator to refresh status.json immediately
        self._human_messages_mtime = 0.0  # last known mtime of human_messages.json

        # Timing
        self._last_plan_time = 0
        self._last_strategic_time = 0
        self._last_haiku_time = 0

        # State
        self._last_assessment = None
        self._editor_state = "idle"
        self._happy_until = 0
        self._frustrated_until = 0
        self._barking_until = 0
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
        self._tasks_completed = []  # List of completed task summaries (capped at 20)
        self._tasks_failed = []     # List of failed task summaries (capped at 20)
        self._plan = ExecutionPlan()  # Per-agent ready queues for instant dispatch

        # Interpersonal management tracking
        self._agent_tracker = {}  # {agent_name: {successes, failures, streak, last_note_at}}

        # Memory
        memory = self._load_memory()
        memory["restart_count"] = memory.get("restart_count", 0) + 1
        self._last_health = memory.get("last_assessment_health")
        self._save_memory(memory)

    # ── Status Refresh ─────────────────────────────────────────

    def _request_status_refresh(self):
        """Signal the orchestrator to refresh status.json immediately."""
        self._status_refresh.set()

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
        # Detect model tier from response for accurate pricing
        model_id = getattr(response, "model", "") or ""
        if "opus" in model_id:
            tier = "opus"
        elif "sonnet" in model_id:
            tier = "sonnet"
        else:
            tier = "haiku"
        input_cost, output_cost = MODEL_PRICING[tier]
        cost = (input_tokens / 1_000_000 * input_cost +
                output_tokens / 1_000_000 * output_cost)
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
        # Also commit to episodic memory for semantic recall
        try:
            self.commit_episode(
                task_type=f"editor_{category}",
                episode=text,
                outcome=category,
                extra_meta={"category": category},
            )
        except Exception:
            pass

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
                    # Diagnose: is this transient or fatal?
                    try:
                        decision = self.problem_solve(
                            error=str(e)[:200],
                            context={"event_type": event.type, "consecutive_errors": self._errors},
                            strategies={
                                "continue": "Transient error — safe to continue processing events",
                                "pause_pipeline": "Multiple failures suggest systemic issue — pause agents",
                                "restart_db": "Database connection may be stale — reconnect on next cycle",
                                "escalate": "Repeated failures — needs human investigation",
                            },
                        )
                        self.log(f"Event error diagnosis: {decision.get('diagnosis', '?')} → {decision.get('strategy', '?')}")
                    except Exception:
                        pass  # Don't let problem_solve itself crash the loop
                finally:
                    self._active = False
                    self._cycles += 1
                    self._last_work_time = datetime.now()

                # Update idle display — check timed sprite states
                now_t = _time.time()
                if now_t < self._happy_until:
                    self._editor_state = "happy"
                    self._current_task = "Instructions acknowledged!"
                elif now_t < self._frustrated_until:
                    self._editor_state = "frustrated"
                elif now_t < self._barking_until:
                    self._editor_state = "barking"
                else:
                    self._editor_state = "idle"
                    self._current_task = f"Coordinating — {len(self._tasks_completed)} tasks done, {len(self._tasks_in_flight)} in flight"

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
            await self._process_results(event.payload)

        elif event.type == "human_message":
            # Human messages get immediate strategic assessment
            self._last_strategic_time = _time.time()
            await self._strategic_assessment(has_human_messages=True)

        elif event.type == "timer_plan":
            self._last_plan_time = _time.time()
            self._cleanup_stale_tasks()
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
                    await self._process_results(batched_results)
                    batched_results = []
                await self._handle_event(event)

        # Flush any remaining batched results
        if batched_results:
            await self._process_results(batched_results)

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

    async def _process_results(self, collected):
        """Validate each result and commit to Supabase or handle failure."""
        for agent_name, result in collected:
            # Remove from in-flight tracking
            task_info = self._tasks_in_flight.pop(result.task_id, {})

            if result.status == "success":
                self._tasks_completed.append({
                    "id": result.task_id,
                    "agent": agent_name,
                    "type": result.task_type,
                    "goal": task_info.get("task", {}).get("goal", result.task_type),
                    "completed_by": agent_name,
                    "completed_at": datetime.now().isoformat(),
                })
                if len(self._tasks_completed) > 20:
                    self._tasks_completed = self._tasks_completed[-20:]
                self._handle_success(agent_name, result)

                # Track performance and generate management note
                t = self._agent_tracker.setdefault(agent_name, {"successes": 0, "failures": 0, "streak": 0, "last_note_at": 0})
                t["successes"] += 1
                t["streak"] = max(1, t["streak"] + 1) if t["streak"] >= 0 else 1
                goal = task_info.get("task", {}).get("goal", result.task_type)
                await self._management_note(agent_name, "success", f"Completed: {goal}")
            else:
                self._tasks_failed.append({
                    "id": result.task_id,
                    "agent": agent_name,
                    "type": result.task_type,
                    "goal": task_info.get("task", {}).get("goal", result.task_type),
                    "error": (result.error or "unknown")[:120],
                    "failed_by": agent_name,
                })
                if len(self._tasks_failed) > 20:
                    self._tasks_failed = self._tasks_failed[-20:]
                self._handle_failure(agent_name, result)

                # Track performance and generate management note
                t = self._agent_tracker.setdefault(agent_name, {"successes": 0, "failures": 0, "streak": 0, "last_note_at": 0})
                t["failures"] += 1
                t["streak"] = min(-1, t["streak"] - 1) if t["streak"] <= 0 else -1
                error_summary = (result.error or "unknown")[:80]
                await self._management_note(agent_name, "failure", f"Failed: {error_summary}")

            # Immediately dispatch next task for this agent from the ready queue
            self._dispatch_next(agent_name)

    def _handle_success(self, agent_name, result):
        """Process a successful task result — validate and commit to Supabase."""
        task_type = result.task_type
        data = result.result

        try:
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
            elif task_type == "scrape_features":
                self._commit_extraction(data)
            elif task_type == "deep_extract":
                self._commit_deep_extract(data)
            else:
                self.log(f"Unknown task type '{task_type}' from {agent_name}", level="WARN")
        finally:
            # Always persist ledger even if commit raises mid-way
            self.ledger.save()

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
            m_str = f"{month:02d}" if isinstance(month, int) else "??"
            self.log(f"Committed: {year}-{m_str} ({ident[:40]})")

        if found:
            valid = [i for i in found if i.get("year") and i["year"] >= MIN_YEAR]
            if valid:
                ad_count = sum(1 for i in valid if "ad_archive" in i.get("source", ""))
                ao_count = len(valid) - ad_count
                parts = []
                if ao_count:
                    parts.append(f"{ao_count} on archive.org")
                if ad_count:
                    parts.append(f"{ad_count} on AD Archive")
                self._narrate_event(f"Scout discovered {len(valid)} new AD issues ({', '.join(parts)}).")

        # Cascade: enqueue Courier download tasks for archive.org issues only
        # AD Archive issues go through _fill_scrape_queue() in the planning cycle
        if "courier" in self.workers:
            valid = [
                i for i in found
                if i.get("year") and i["year"] >= MIN_YEAR and i.get("identifier")
                and "ad_archive" not in i.get("source", "")
            ]
            for issue in valid:
                ident = issue["identifier"]
                if not self.ledger.should_retry(ident, "download_pdf", max_failures=MAX_TASK_FAILURES):
                    continue
                _m = issue.get("month")
                _ms = f"{_m:02d}" if isinstance(_m, int) else "??"
                task = Task(
                    type="download_pdf",
                    goal=f"Download {issue.get('year')}-{_ms} ({ident[:30]})",
                    params={
                        "identifier": ident, "title": issue.get("title", ""),
                        "year": issue.get("year"), "month": issue.get("month"),
                        "source": issue.get("source", "archive.org"),
                        "source_url": issue.get("url"),
                    },
                    priority=2,
                )
                self._plan.enqueue("courier", task, source="cascade")
            self._dispatch_next("courier")

        # Cascade: enqueue Courier scrape tasks for AD Archive issues immediately
        if "courier" in self.workers:
            from datetime import datetime as _dt
            _now = _dt.now()
            _cur_year, _cur_month = _now.year, _now.month
            ad_issues = [
                i for i in found
                if i.get("year") and i["year"] >= MIN_YEAR and i.get("identifier")
                and "ad_archive" in i.get("source", "")
                and (i["year"] < _cur_year or (i["year"] == _cur_year and i.get("month", 13) <= _cur_month))
            ]
            for issue in ad_issues:
                ident = issue["identifier"]
                if not self.ledger.should_retry(ident, "scrape_features", max_failures=MAX_TASK_FAILURES):
                    continue
                _m = issue.get("month")
                _ms = f"{_m:02d}" if isinstance(_m, int) else "??"
                task = Task(
                    type="scrape_features",
                    goal=f"Scrape AD Archive {issue.get('year')}-{_ms}",
                    params={
                        "identifier": ident, "title": issue.get("title", ""),
                        "year": issue.get("year"), "month": issue.get("month"),
                        "source_url": issue.get("url"),
                    },
                    priority=2,
                )
                self._plan.enqueue("courier", task, source="cascade")
            if ad_issues:
                self._dispatch_next("courier")

        not_found = data.get("not_found", [])
        for month_key in not_found:
            self.ledger.record(month_key, "scout", "discover_issues", False,
                               note="not found")
        self.ledger.save()
        self._request_status_refresh()

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
        self._request_status_refresh()

    def _commit_download(self, data):
        """Commit Courier's download result to Supabase."""
        identifier = data.get("identifier", "")
        pdf_path = data.get("pdf_path", "")
        if identifier and pdf_path:
            update_issue(identifier, {"status": "downloaded", "pdf_path": pdf_path})
            self.ledger.record(identifier, "courier", "download_pdf", True)
            self.log(f"Downloaded: {identifier}")

            # Cascade: enqueue Reader task for just-downloaded issue
            if "reader" in self.workers:
                output_path = os.path.join(EXTRACTIONS_DIR, f"{identifier}.json")
                if not os.path.exists(output_path):
                    issue = get_issue_by_identifier(identifier)
                    if issue:
                        _rm = issue.get("month")
                        _rms = f"{_rm:02d}" if isinstance(_rm, int) else "??"
                        task = Task(
                            type="extract_features",
                            goal=f"Extract features from {issue.get('year', '?')}-{_rms}",
                            params={
                                "identifier": identifier, "pdf_path": pdf_path,
                                "title": issue.get("title", ""), "year": issue.get("year"),
                                "month": issue.get("month"),
                            },
                            priority=2,
                        )
                        self._plan.enqueue("reader", task, source="cascade")
                        self._dispatch_next("reader")

        self.ledger.save()
        self._request_status_refresh()

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
                # Shorten identifier for display
                short_id = identifier[:30] + "..." if len(identifier) > 30 else identifier
                self._narrate_event(f"Reader extracted {inserted} homeowner features from {short_id}. Sending to Detective for cross-reference.")

                # Queue Detective to cross-reference the newly loaded features
                self._queue_detective_for_issue(identifier)
            except Exception as e:
                decision = self.problem_solve(
                    error=str(e)[:200],
                    context={"identifier": identifier, "feature_count": len(features), "operation": "load_extraction"},
                    strategies={
                        "retry_next_cycle": "Transient DB error — will retry when Reader re-extracts",
                        "check_schema": "Schema mismatch — features table may need migration",
                        "skip_issue": "Bad extraction data — mark as failed and move on",
                        "escalate": "Persistent DB failure — needs investigation",
                    },
                )
                self.log(f"Supabase load failed for {identifier}: {e} → {decision.get('strategy', '?')}", level="ERROR")
                self.ledger.record(identifier, "reader", "extract_features", False,
                                   error=f"{e} (diagnosis: {decision.get('diagnosis', 'unknown')})")
        else:
            # Quality hold — log it, don't load
            esc_type = quality_metrics.get("escalation_type", "unknown")
            self.ledger.record(identifier, "reader", "extract_features", False,
                               note=f"Quality hold: {esc_type}")
            self.log(f"HELD {identifier}: {esc_type} — {quality_metrics}", level="WARN")

        self.ledger.save()
        self._request_status_refresh()

    def _queue_detective_for_issue(self, identifier):
        """Queue Detective to cross-reference features from a just-loaded issue."""
        if "detective" not in self.workers:
            return

        # Look up issue_id from identifier
        issue = get_issue_by_identifier(identifier)
        if not issue:
            return
        issue_id = issue["id"]

        try:
            unchecked = get_features_needing_detective(issue_id=issue_id)
        except Exception as e:
            self.log(f"Failed to query features for detective: {e}", level="ERROR")
            return

        if not unchecked:
            return

        # Build names list and feature_ids mapping (name → [id, ...] for duplicates)
        seen_names = set()
        names = []
        feature_ids = {}  # name → list of feature IDs
        for feat in unchecked:
            name = (feat.get("homeowner_name") or "").strip()
            if not name:
                continue
            if name not in seen_names:
                names.append(name)
                seen_names.add(name)
            feature_ids.setdefault(name, []).append(feat["id"])

        if not names:
            return

        task = Task(
            type="cross_reference",
            goal=f"Cross-reference {len(names)} names from {identifier[:30]}",
            params={"names": names, "feature_ids": feature_ids},
            priority=2,
        )
        if not self._assign_task("detective", task):
            self._plan.enqueue("detective", task, source="cascade")
            self.log(f"Detective busy — queued {len(names)} names for later")
        else:
            self.log(f"Queued {len(names)} names for Detective from {identifier[:30]}")

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
        """Write Detective's full xref data to Supabase cross_references + binary verdict to features."""
        checked = data.get("checked", [])
        if not checked:
            return

        yes_entries = []

        for entry in checked:
            name = entry.get("name", "?")
            feature_id_list = entry.get("feature_ids", [])
            # Backward compat: old format used singular "feature_id"
            if not feature_id_list and entry.get("feature_id"):
                feature_id_list = [entry["feature_id"]]
            binary_verdict = entry.get("binary_verdict", "NO")
            combined = entry.get("combined", "unknown")

            # Write full xref + binary verdict to ALL feature IDs for this name
            write_ok = True
            for fid in feature_id_list:
                xref_written = False
                try:
                    # Write full xref data to cross_references table
                    xref_data = {
                        "homeowner_name": name,
                        "black_book_status": entry.get("bb_verdict", "no_match"),
                        "black_book_matches": entry.get("bb_matches"),
                        "doj_status": entry.get("doj_verdict", "pending"),
                        "doj_results": entry.get("doj_results"),
                        "combined_verdict": combined if combined != "unknown" else "pending",
                        "confidence_score": float(entry.get("confidence_score") or 0),
                        "verdict_rationale": entry.get("rationale"),
                        "false_positive_indicators": entry.get("false_positive_indicators"),
                        "binary_verdict": binary_verdict,
                        "individuals_searched": entry.get("individuals_searched"),
                    }
                    upsert_cross_reference(fid, xref_data)
                    xref_written = True

                    # Also write binary verdict to features table for compat
                    update_detective_verdict(fid, binary_verdict)
                except Exception as e:
                    write_ok = False
                    if xref_written:
                        # xref succeeded but verdict failed — log partial state
                        self.log(f"PARTIAL: xref written but verdict failed for {name} (fid={fid}): {e}", level="WARN")
                    decision = self.problem_solve(
                        error=str(e)[:200],
                        context={"name": name, "feature_id": fid, "verdict": binary_verdict, "operation": "upsert_cross_reference", "xref_written": xref_written},
                        strategies={
                            "continue": "Skip this feature — others may succeed",
                            "retry_batch": "DB connection issue — retry entire batch later",
                            "escalate": "Persistent failure — needs investigation",
                        },
                    )
                    self.log(f"Failed to write xref for {name} (fid={fid}): {e} → {decision.get('strategy', '?')}", level="ERROR")

            if binary_verdict == "YES":
                self.log(f"YES: {name} ({combined})")
                self._remember("milestone", f"Detective YES: {name} ({combined})")
                yes_entries.append(entry)
            else:
                self.log(f"NO: {name} ({combined})", level="DEBUG")

            # Record to ledger AFTER Supabase write (not before)
            self.ledger.record(name, "detective", "cross_reference", write_ok,
                               note=f"{binary_verdict} ({combined})" if write_ok else f"verdict write failed")

        # Send verdict summary to inbox
        no_count = len(checked) - len(yes_entries)
        yes_names = [e.get("name", "?") for e in yes_entries]
        if yes_entries:
            names_str = ", ".join(yes_names)
            self._narrate_event(
                f"Detective checked {len(checked)} names against Epstein records. {no_count} cleared (NO). {len(yes_entries)} flagged YES: {names_str}. Sending YES names to Researcher for investigation.",
                msg_type="alert",
            )
        else:
            self._narrate_event(f"Detective checked {len(checked)} names against Epstein records. All cleared — zero hits.")

        # Queue YES names for Researcher investigation
        if yes_entries:
            self._queue_researcher_tasks(yes_entries)
            # Refresh knowledge graph export when new leads are discovered
            try:
                from sync_graph import export_graph_json
                export_graph_json()
            except Exception:
                pass  # Graph export is non-critical

        self.ledger.save()
        self._request_status_refresh()

    def _queue_researcher_tasks(self, yes_entries):
        """Queue Researcher investigation for YES-verdict names (one at a time)."""
        if "researcher" not in self.workers:
            return

        for entry in yes_entries:
            name = entry.get("name", "")
            feature_id_list = entry.get("feature_ids", [])
            # Backward compat: old format used singular "feature_id"
            if not feature_id_list and entry.get("feature_id"):
                feature_id_list = [entry["feature_id"]]
            if not name or not feature_id_list:
                continue

            # Use first feature_id for the dossier (one dossier per name)
            feature_id = feature_id_list[0]

            # Skip if dossier already exists
            try:
                existing = get_dossier(feature_id)
                if existing:
                    continue
            except Exception:
                pass

            # Check ledger for exhausted names
            if not self.ledger.should_retry(name, "investigate_lead", max_failures=MAX_TASK_FAILURES):
                continue

            # Build lead dict compatible with Researcher's execute() format
            lead = {
                "homeowner_name": name,
                "feature_id": feature_id,
                "black_book_status": entry.get("bb_verdict", "no_match"),
                "black_book_matches": entry.get("bb_matches"),
                "doj_status": entry.get("doj_verdict", "pending"),
                "doj_results": entry.get("doj_results"),
                "combined_verdict": entry.get("combined", ""),
                "confidence_score": entry.get("confidence_score", 0),
            }

            task = Task(
                type="investigate_lead",
                goal=f"Investigate {name}",
                params={"name": name, "lead": lead},
                priority=2,
            )
            if self._assign_task("researcher", task):
                self.log(f"Queued Researcher: {name}")
                self._narrate_event(f"Assigned Researcher to investigate {name} — flagged YES by Detective.")
            else:
                self._plan.enqueue("researcher", task, source="cascade")
                self.log(f"Researcher busy — queued investigation for {name}")

    def _commit_investigation(self, data):
        """Review Researcher's dossier as gatekeeper — confirm or reject.

        1. Persist dossier to Supabase (upsert_dossier) — Editor is the only Supabase writer.
        2. Upload article images to Supabase Storage.
        3. Review: COINCIDENCE → auto-REJECTED. HIGH/MEDIUM/LOW → Sonnet review.
        4. Write final editor verdict to Supabase.
        5. Clean up temp image directory.
        """
        name = data.get("name", "?")
        strength = data.get("connection_strength", "UNKNOWN")
        triage = data.get("triage_result", "investigate")
        feature_id = data.get("feature_id")
        dossier = data.get("dossier", {})
        image_paths = data.get("image_paths", [])
        page_numbers = data.get("page_numbers", [])
        temp_dir = data.get("temp_dir")

        # ── Guard: Protect manual verdict overrides ──
        if feature_id:
            try:
                sb = get_supabase()
                existing = sb.table("dossiers").select("id, editor_verdict, editor_reasoning").eq("feature_id", feature_id).execute()
                if existing.data:
                    ex = existing.data[0]
                    reasoning_text = (ex.get("editor_reasoning") or "").upper()
                    if "MANUAL OVERRIDE" in reasoning_text:
                        self.log(f"Skipping re-investigation of {name} — has manual override ({ex.get('editor_verdict')})")
                        if temp_dir:
                            import shutil
                            shutil.rmtree(temp_dir, ignore_errors=True)
                        return
            except Exception:
                pass  # DB check failed — proceed with investigation

        # ── Step 1: Persist dossier to Supabase ──
        dossier_id = None
        if feature_id:
            try:
                row = {
                    "subject_name": dossier.get("subject_name", name),
                    "combined_verdict": dossier.get("combined_verdict"),
                    "confidence_score": dossier.get("confidence_score"),
                    "connection_strength": dossier.get("connection_strength"),
                    "strength_rationale": dossier.get("strength_rationale"),
                    "triage_result": dossier.get("triage_result"),
                    "triage_reasoning": dossier.get("triage_reasoning"),
                    "ad_appearance": dossier.get("ad_appearance"),
                    "home_analysis": dossier.get("home_analysis"),
                    "visual_analysis": dossier.get("visual_analysis"),
                    "epstein_connections": dossier.get("epstein_connections"),
                    "pattern_analysis": dossier.get("pattern_analysis"),
                    "key_findings": dossier.get("key_findings"),
                    "investigation_depth": dossier.get("investigation_depth", "standard"),
                    "needs_manual_review": dossier.get("needs_manual_review", False),
                    "review_reason": dossier.get("review_reason"),
                    "investigated_at": dossier.get("investigated_at"),
                    "editor_verdict": "PENDING_REVIEW",
                }
                result = upsert_dossier(feature_id, row)
                dossier_id = result.get("id") if result else None
                self.log(f"Dossier persisted: {name} (dossier_id={dossier_id})")
            except Exception as e:
                decision = self.problem_solve(
                    error=str(e)[:200],
                    context={"name": name, "strength": strength, "operation": "upsert_dossier"},
                    strategies={
                        "continue_without_db": "Proceed with review — dossier saved locally even if DB failed",
                        "retry_later": "DB connection issue — skip review, mark PENDING_REVIEW",
                        "escalate": "Persistent failure — needs investigation",
                    },
                )
                self.log(f"Dossier save failed for {name}: {e} → {decision.get('strategy', '?')}", level="ERROR")

        # ── Step 2: Upload article images ──
        if dossier_id and image_paths and feature_id:
            self.log(f"Uploading {len(image_paths)} images for {name}...")
            for img_path, page_num in zip(image_paths, page_numbers):
                try:
                    with open(img_path, "rb") as f:
                        file_data = f.read()
                    storage_path = f"{feature_id}/page_{page_num}.png"
                    public_url = upload_to_storage(
                        "dossier-images", storage_path, file_data
                    )
                    insert_dossier_image(
                        dossier_id, feature_id, page_num, storage_path, public_url
                    )
                except Exception as e:
                    self.log(f"Image upload failed (page {page_num}): {e}", level="WARN")

        # ── Step 3: Review dossier ──
        if strength == "COINCIDENCE" or triage == "coincidence":
            verdict = "REJECTED"
            reasoning = f"Auto-rejected: triaged as COINCIDENCE — {dossier.get('strength_rationale', 'false positive')}"
            self.log(f"Dossier: {name} → REJECTED (COINCIDENCE, no review needed)")
        else:
            try:
                verdict, reasoning = self._review_dossier(name, strength, dossier)
                self.log(f"Dossier: {name} → {verdict} (proposed {strength})")
            except Exception as e:
                decision = self.problem_solve(
                    error=str(e)[:200],
                    context={"name": name, "strength": strength, "operation": "review_dossier"},
                    strategies={
                        "pending_review": "LLM unavailable — mark PENDING_REVIEW for manual check",
                        "auto_reject_low": "Review failed on a LOW-strength lead — safe to auto-reject",
                        "retry_simpler": "Timeout or rate limit — retry with shorter prompt",
                        "escalate": "Repeated review failure — needs investigation",
                    },
                )
                self.log(f"Dossier review failed for {name}: {e} → {decision.get('strategy', '?')}", level="ERROR")
                if decision.get("strategy") == "auto_reject_low" and strength in ("LOW", "COINCIDENCE"):
                    verdict = "REJECTED"
                    reasoning = f"Auto-rejected: review failed on {strength}-strength lead"
                else:
                    verdict = "PENDING_REVIEW"
                    reasoning = f"Review failed: {decision.get('diagnosis', str(e))}"

        # ── Step 4: Write editor verdict to Supabase ──
        if feature_id:
            try:
                update_editor_verdict(feature_id, verdict, reasoning)
            except Exception as e:
                decision = self.problem_solve(
                    error=str(e)[:200],
                    context={"name": name, "verdict": verdict, "operation": "update_editor_verdict"},
                    strategies={
                        "retry_once": "Transient error — try one more time",
                        "log_for_manual": "Log the verdict for manual DB update later",
                        "escalate": "Persistent failure — needs investigation",
                    },
                )
                self.log(f"Failed to update editor verdict for {name}: {e} → {decision.get('strategy', '?')}", level="ERROR")
                if decision.get("strategy") == "retry_once":
                    try:
                        update_editor_verdict(feature_id, verdict, reasoning)
                        self.log(f"Retry succeeded for {name} verdict")
                    except Exception:
                        self.log(f"Retry also failed for {name} verdict", level="ERROR")

        # ── Step 5: Propagate verdict to knowledge graph + refresh export ──
        try:
            # Sync latest features to Neo4j first (ensures Person node + relationships exist)
            try:
                from sync_graph import incremental_sync, export_graph_json
                incremental_sync()
            except Exception:
                pass  # Sync failure is non-critical; MERGE below creates node if needed

            from graph_analytics import update_person_verdict, recompute_after_verdict
            update_person_verdict(name, verdict, connection_strength=strength)
            recompute_after_verdict()
            self.log(f"Graph updated: {name} → {verdict}, analytics recomputed")
            # Refresh the dashboard knowledge graph export so new dossier appears
            try:
                export_graph_json()
            except Exception:
                pass  # Graph export is non-critical
        except ImportError:
            pass  # Graph analytics not available
        except Exception as e:
            self.log(f"Graph update failed for {name}: {e}", level="WARN")

        # ── Step 6: Cleanup temp image dir ──
        if temp_dir:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)

        # ── Notify inbox ──
        if verdict == "CONFIRMED":
            self._narrate_event(
                f"Dossier reviewed: {name}. Researcher proposed {strength}. I CONFIRMED it. Evidence supports the connection.",
                msg_type="alert",
            )
        elif verdict == "REJECTED" and strength == "COINCIDENCE":
            self._narrate_event(f"Dossier reviewed: {name}. Triaged as COINCIDENCE — REJECTED. False positive.")
        else:
            self._narrate_event(f"Dossier reviewed: {name}. Researcher proposed {strength} but I REJECTED it. Evidence insufficient.")

        # ── Ledger + memory ──
        self.ledger.record(name, "researcher", "investigate_lead", True,
                           note=f"proposed={strength} → {verdict}")
        if verdict == "CONFIRMED" and strength in ("HIGH", "MEDIUM"):
            self._remember("milestone", f"CONFIRMED dossier: {name} ({strength})")
        self.ledger.save()
        self._request_status_refresh()

        # ── Queue deep aesthetic extraction for confirmed names ──
        if verdict == "CONFIRMED":
            self._queue_deep_extract(name)

        # Management note to Elena about the dossier verdict
        try:
            loop = asyncio.get_event_loop()
            loop.create_task(
                self._management_note("researcher", "success" if verdict == "CONFIRMED" else "failure",
                                      f"Dossier {verdict.lower()}: {name} — proposed {strength}")
            )
        except Exception:
            pass

    # ── Deep Extract (Aesthetic Taxonomy) ───────────────────

    def _queue_deep_extract(self, name):
        """Queue deep aesthetic extraction for all features matching a confirmed name."""
        try:
            sb = get_supabase()
            features = (
                sb.table("features")
                .select("id, aesthetic_profile")
                .ilike("homeowner_name", f"%{name}%")
                .execute()
            )
            queued = 0
            for f in (features.data or []):
                if f.get("aesthetic_profile"):
                    continue  # Already has profile
                fid = f["id"]
                task = Task(
                    type="deep_extract",
                    goal=f"Deep extract aesthetic profile: {name} (feature {fid})",
                    params={"feature_id": fid, "name": name},
                    priority=1,
                )
                self._plan.enqueue("courier", task, source="deep_extract")
                queued += 1
            if queued:
                self.log(f"Queued {queued} deep_extract tasks for {name}")
                self._dispatch_next("courier")
        except Exception as e:
            self.log(f"Failed to queue deep_extract for {name}: {e}", level="WARN")

    def _commit_deep_extract(self, data):
        """Commit Courier's deep extraction result — aesthetic profile + enriched fields."""
        import json as _json

        feature_id = data.get("feature_id")
        name = data.get("name", "?")

        if data.get("skipped"):
            self.log(f"Deep extract skipped (already done): {name}")
            return

        profile = data.get("aesthetic_profile")
        enriched = data.get("enriched_fields", {})
        social = data.get("social_data", {})

        if not profile:
            self.log(f"Deep extract for {name}: no aesthetic profile returned", level="WARN")
            return

        # Build update dict
        update = {"aesthetic_profile": _json.dumps(profile) if isinstance(profile, dict) else profile}

        # Fill NULL structural fields from enriched data
        try:
            sb = get_supabase()
            current = sb.table("features").select("*").eq("id", feature_id).execute()
            if current.data:
                cur = current.data[0]
                for col in ["location_city", "location_state", "location_country",
                            "design_style", "designer_name", "architecture_firm"]:
                    if cur.get(col) is None and enriched.get(col):
                        val = enriched[col]
                        if str(val).lower() not in ("null", "none", "n/a"):
                            update[col] = val

                if cur.get("year_built") is None and enriched.get("year_built"):
                    val = enriched["year_built"]
                    if isinstance(val, (int, float)):
                        update["year_built"] = int(val)

                if cur.get("square_footage") is None and enriched.get("square_footage"):
                    val = enriched["square_footage"]
                    if isinstance(val, (int, float)):
                        update["square_footage"] = int(val)

                if cur.get("cost") is None and enriched.get("cost"):
                    val = str(enriched["cost"])
                    if val.lower() not in ("null", "none"):
                        update["cost"] = val

                # Merge social data into notes
                if social:
                    existing_notes = cur.get("notes")
                    try:
                        notes_obj = _json.loads(existing_notes) if isinstance(existing_notes, str) else (existing_notes or {})
                    except (_json.JSONDecodeError, TypeError):
                        notes_obj = {}
                    if not isinstance(notes_obj, dict):
                        notes_obj = {"original": str(notes_obj)}
                    notes_obj["deep_extract"] = social
                    notes_obj["source"] = "deep_extract"
                    update["notes"] = _json.dumps(notes_obj)

            # Write to Supabase
            sb.table("features").update(update).eq("id", feature_id).execute()
            self.log(f"Deep extracted: {name} — {profile.get('envelope', '?')}/{profile.get('atmosphere', '?')}")
            # Graph sync happens periodically via strategic assessment, not per-feature

        except Exception as e:
            self.log(f"Failed to commit deep extract for {name}: {e}", level="ERROR")

        self._request_status_refresh()

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
- Black Book matches: ANY Black Book match (last_first or full_name) is DIRECT EVIDENCE of
  association — the person's name appeared in Epstein's personal contact book. A Black Book
  match alone is sufficient grounds to CONFIRM. Only reject a BB match if the name is clearly
  a different person (e.g., common surname matching a completely unrelated individual).
- DOJ Library results (direct mention = strong; same surname different person = worthless)
- Pattern correlations (shared designer/location with confirmed matches = meaningful)
- Temporal relevance (1990-2008 overlap with Epstein's active period)

CRITICAL: NEVER reject someone because they are famous, a celebrity, or a public figure.
Celebrities and prominent people DID associate with Epstein. Fame is irrelevant to the verdict.

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
        """Refresh ready queues from Supabase state, then dispatch."""
        self._editor_state = "assessing"
        self._current_task = "Planning next tasks..."

        try:
            all_issues = list_issues()
        except Exception as e:
            self.log(f"Planning failed — Supabase error: {e}", level="ERROR")
            return

        # Fill per-agent ready queues from current Supabase state
        self._fill_scout_queue(all_issues)
        self._fill_courier_queue()
        self._fill_scrape_queue()
        self._fill_reader_queue()
        self._fill_detective_queue()
        self._fill_researcher_queue()

        # Dispatch one task per idle agent
        self._dispatch_ready_tasks()

        # Periodic management check-in with busiest agent
        if self._agent_tracker:
            busiest = max(
                self._agent_tracker.items(),
                key=lambda x: x[1].get("successes", 0) + x[1].get("failures", 0),
                default=None,
            )
            if busiest:
                await self._management_note(
                    busiest[0], "reflection",
                    "Periodic check-in on workload and performance",
                )

    def _memory_informed_priority(self, agent_name, task):
        """Adjust task priority based on episodic memory of past attempts.

        Queries memory for similar past tasks on this agent. If recent attempts
        at similar tasks have high failure rates, deprioritize. If they've been
        succeeding, boost priority.

        Returns adjusted priority (lower = higher priority).
        """
        try:
            episodes = self.recall_episodes(
                f"{agent_name} {task.type} {task.goal[:60]}",
                task_type=task.type,
                n=5,
            )
            if not episodes:
                return task.priority

            failures = sum(1 for ep in episodes if ep["metadata"].get("outcome") == "failure")
            successes = sum(1 for ep in episodes if ep["metadata"].get("outcome") == "success")

            if failures >= 3 and successes == 0:
                # Consistently failing — deprioritize
                return min(task.priority + 1, 4)
            elif successes >= 3 and failures == 0:
                # Consistently succeeding — boost
                return max(task.priority - 1, 0)
            return task.priority
        except Exception:
            return task.priority

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

        # Adjust priority based on memory of past attempts
        task.priority = self._memory_informed_priority(agent_name, task)

        agent.inbox.put_nowait(task)
        self._tasks_in_flight[task.id] = {
            "agent": agent_name,
            "task": task.to_dict(),
            "assigned_at": datetime.now().isoformat(),
        }
        self.log(f"Assigned {agent_name}: {task.goal[:60]}", level="DEBUG")

        # Miranda barks an order when assigning tasks
        try:
            asyncio.get_event_loop().create_task(
                self._management_note(agent_name, "assign", f"New assignment: {task.goal[:60]}")
            )
        except RuntimeError:
            pass  # No event loop — skip the note

        return True

    def _cleanup_stale_tasks(self, max_age_minutes=60):
        """Remove stale entries from _tasks_in_flight.

        If an agent crashes mid-task, its entry stays forever. This purges
        entries older than max_age_minutes and records the failure in the ledger.
        """
        now = datetime.now()
        stale_ids = []
        for tid, info in self._tasks_in_flight.items():
            try:
                task_type = info.get("task", {}).get("type", "")
                # Cross-reference tasks legitimately take hours (DOJ browser searches)
                if task_type == "cross_reference":
                    continue
                assigned = datetime.fromisoformat(info["assigned_at"])
                if (now - assigned).total_seconds() > max_age_minutes * 60:
                    stale_ids.append(tid)
            except (ValueError, KeyError):
                stale_ids.append(tid)

        for tid in stale_ids:
            info = self._tasks_in_flight.pop(tid)
            agent_name = info.get("agent", "?")
            task_data = info.get("task", {})
            key = task_data.get("params", {}).get("identifier") or task_data.get("params", {}).get("name") or tid
            self.ledger.record(key, agent_name, task_data.get("type", "unknown"), False,
                               note=f"Stale task (>{max_age_minutes}m) — agent may have crashed")
            self.log(f"Purged stale task {tid} ({agent_name}): {task_data.get('goal', '?')[:50]}", level="WARN")

    def _dispatch_next(self, agent_name):
        """Pop the next ready task from the plan and assign it.

        Skips tasks whose identifier/name has exhausted retries since enqueue time.
        """
        agent = self.workers.get(agent_name)
        if not agent or agent.is_paused or not agent.inbox.empty():
            return False
        # Pop tasks, skipping any that have since exhausted retries
        while True:
            task = self._plan.next_for(agent_name)
            if not task:
                return False
            key = task.params.get("identifier") or task.params.get("name")
            if key and not self.ledger.should_retry(key, task.type, max_failures=MAX_TASK_FAILURES):
                self.log(f"Skipping exhausted task for {key[:40]}", level="DEBUG")
                continue
            return self._assign_task(agent_name, task)

    def _dispatch_ready_tasks(self):
        """Dispatch one task per idle agent from the plan."""
        for name in self.workers:
            self._dispatch_next(name)

    def _fill_scout_queue(self, all_issues):
        """Gap analysis — what issues are missing? Enqueue Scout tasks."""
        if "scout" not in self.workers:
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

        # Priority 1: Fix misdated issues (skip if already attempted 3 times)
        misdated = [
            i for i in misdated
            if self.ledger.attempt_count(i["identifier"], "fix_dates") < 3
        ]
        if misdated:
            batch = misdated[:10]
            task = Task(
                type="fix_dates",
                goal=f"Verify dates on {len(batch)} misdated issues",
                params={"batch": [{"identifier": i["identifier"], "title": i.get("title", ""),
                                    "year": i.get("year"), "month": i.get("month")} for i in batch]},
                priority=3,  # LOW priority — don't block discovery
            )
            self._plan.enqueue("scout", task)
            # Don't return — let discovery tasks enqueue too (priority system handles ordering)

        # Priority 2: Discover missing issues (cap at current month)
        from datetime import datetime as _dt
        _now = _dt.now()
        _cur_year, _cur_month = _now.year, _now.month
        missing_months = []
        for year in range(MIN_YEAR, MAX_YEAR + 1):
            max_m = _cur_month if year == _cur_year else 12
            for month in range(1, max_m + 1):
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
            self._plan.enqueue("scout", task)

    def _fill_courier_queue(self):
        """What's discovered but not downloaded? Enqueue up to 10 Courier tasks."""
        if "courier" not in self.workers:
            return

        issues = list_issues(status="discovered")
        downloadable = [
            i for i in issues
            if i.get("month") and i.get("year")
            and i.get("source") != "ad_archive"  # AD Archive issues go through _fill_scrape_queue
            and self.ledger.should_retry(i["identifier"], "download_pdf", max_failures=MAX_TASK_FAILURES)
        ]

        for issue in downloadable[:10]:
            ident = issue["identifier"]
            context = self.ledger.get_context_for_agent(ident)
            _cm = issue.get("month")
            _cms = f"{_cm:02d}" if isinstance(_cm, int) else "??"
            task = Task(
                type="download_pdf",
                goal=f"Download {issue.get('year')}-{_cms} ({ident[:30]})",
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
            self._plan.enqueue("courier", task)

    def _fill_scrape_queue(self):
        """Find AD Archive issues that need scraping and enqueue Courier scrape tasks."""
        if "courier" not in self.workers:
            return

        try:
            issues = list_issues(status="discovered", source="ad_archive")
        except Exception:
            return

        # Filter out future issues (not yet published)
        from datetime import datetime as _dt
        _now = _dt.now()
        _cur_year, _cur_month = _now.year, _now.month

        scrapeable = [
            i for i in issues
            if i.get("month") and i.get("year")
            and i.get("source_url")
            and (i["year"] < _cur_year or (i["year"] == _cur_year and i["month"] <= _cur_month))
            and self.ledger.should_retry(i["identifier"], "scrape_features", max_failures=MAX_TASK_FAILURES)
        ]

        for issue in scrapeable[:5]:
            ident = issue["identifier"]
            _m = issue.get("month")
            _ms = f"{_m:02d}" if isinstance(_m, int) else "??"
            task = Task(
                type="scrape_features",
                goal=f"Scrape AD Archive {issue.get('year')}-{_ms}",
                params={
                    "identifier": ident,
                    "year": issue.get("year"),
                    "month": issue.get("month"),
                    "source_url": issue.get("source_url"),
                    "title": issue.get("title", ""),
                },
                priority=2,
            )
            self._plan.enqueue("courier", task)

    def _fill_reader_queue(self):
        """What's downloaded but not extracted? Enqueue up to 10 Reader tasks."""
        if "reader" not in self.workers:
            return

        issues = list_issues(status="downloaded")
        enqueued = 0
        for issue in issues:
            if enqueued >= 10:
                break
            ident = issue["identifier"]
            # Check if extraction already exists on disk
            output_path = os.path.join(EXTRACTIONS_DIR, f"{ident}.json")
            if os.path.exists(output_path):
                # Already extracted on disk — maybe needs loading
                continue

            if not self.ledger.should_retry(ident, "extract_features", max_failures=MAX_TASK_FAILURES):
                continue

            context = self.ledger.get_context_for_agent(ident)
            _em = issue.get("month")
            _ems = f"{_em:02d}" if isinstance(_em, int) else "??"
            task = Task(
                type="extract_features",
                goal=f"Extract features from {issue.get('year', '?')}-{_ems}",
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
            self._plan.enqueue("reader", task)
            enqueued += 1

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

    def _fill_detective_queue(self):
        """Catch-up: find features with detective_verdict IS NULL and enqueue Detective.

        Also retries names whose DOJ search was skipped (browser unavailable).
        """
        if "detective" not in self.workers:
            return

        try:
            unchecked = get_features_needing_detective()  # All unchecked, no issue filter
        except Exception as e:
            self.log(f"Planning detective tasks failed: {e}", level="ERROR")
            return

        # Also find names needing DOJ retry (had doj_status='pending' from browser unavailability)
        doj_retry = []
        try:
            doj_retry = get_xrefs_needing_doj_retry()
        except Exception:
            pass

        if not unchecked and not doj_retry:
            return

        # Batch up to 50 names (deduplicated, with all feature_ids per name)
        seen_names = set()
        names = []
        feature_ids = {}  # name → list of feature IDs
        for feat in unchecked[:50]:
            name = (feat.get("homeowner_name") or "").strip()
            if not name:
                continue
            if name not in seen_names:
                names.append(name)
                seen_names.add(name)
            feature_ids.setdefault(name, []).append(feat["id"])

        # Add DOJ retry names (reset their xref first so detective re-checks)
        # Cap total batch at 50 names to avoid overflowing LLM name analysis
        for xr in doj_retry:
            if len(names) >= 50:
                break
            name = (xr.get("homeowner_name") or "").strip()
            fid = xr.get("feature_id")
            if not name or name in seen_names:
                continue
            # Reset the xref so detective treats it as fresh
            try:
                reset_xref_doj(fid)
            except Exception:
                pass
            names.append(name)
            seen_names.add(name)
            feature_ids.setdefault(name, []).append(fid)

        if not names:
            return

        task = Task(
            type="cross_reference",
            goal=f"Cross-reference {len(names)} names ({len(doj_retry)} DOJ retries)",
            params={"names": names, "feature_ids": feature_ids},
            priority=3,  # Lower priority than extraction-triggered
        )
        self._plan.enqueue("detective", task)

    def _fill_researcher_queue(self):
        """Catch-up: find YES-verdict features without dossiers and enqueue Researcher."""
        if "researcher" not in self.workers:
            return

        try:
            sb = get_supabase()
            result = (
                sb.table("features")
                .select("id, homeowner_name")
                .eq("detective_verdict", "YES")
                .execute()
            )
            yes_features = result.data
        except Exception as e:
            self.log(f"Planning researcher tasks failed: {e}", level="ERROR")
            return

        if not yes_features:
            return

        # Load cross-reference enrichment from Supabase (primary) or disk (fallback)
        xref_by_name = {}
        try:
            xrefs = list_cross_references()
            for r in xrefs:
                rname = (r.get("homeowner_name") or "").strip().lower()
                if rname:
                    xref_by_name[rname] = r
        except Exception:
            # Fallback to local file
            results_path = os.path.join(XREF_DIR, "results.json")
            try:
                if os.path.exists(results_path):
                    with open(results_path) as f:
                        xref_results = json.load(f)
                    for r in xref_results:
                        rname = (r.get("homeowner_name") or "").strip().lower()
                        if rname:
                            xref_by_name[rname] = r
            except Exception:
                pass

        for feat in yes_features:
            feature_id = feat["id"]
            name = (feat.get("homeowner_name") or "").strip()
            if not name:
                continue

            # Skip if dossier already exists
            try:
                if get_dossier(feature_id):
                    continue
            except Exception:
                pass

            # Skip exhausted names
            if not self.ledger.should_retry(name, "investigate_lead", max_failures=MAX_TASK_FAILURES):
                continue

            # Enrich lead with actual BB/DOJ evidence from Supabase xref
            xref = xref_by_name.get(name.lower(), {})
            lead = {
                "homeowner_name": name,
                "feature_id": feature_id,
                "black_book_status": xref.get("black_book_status", "unknown"),
                "black_book_matches": xref.get("black_book_matches"),
                "doj_status": xref.get("doj_status", "unknown"),
                "doj_results": xref.get("doj_results"),
                "combined_verdict": xref.get("combined_verdict", "yes_verdict"),
                "confidence_score": float(xref.get("confidence_score") or 0.5),
            }

            task = Task(
                type="investigate_lead",
                goal=f"Investigate {name} (planning fallback)",
                params={"name": name, "lead": lead},
                priority=3,
            )
            self._plan.enqueue("researcher", task)

    # ═══════════════════════════════════════════════════════════
    # PHASE 4: STRATEGIC ASSESSMENT (periodic LLM call)
    # ═══════════════════════════════════════════════════════════

    async def _strategic_assessment(self, has_human_messages):
        """Call Claude for complex decisions and human interaction."""
        if has_human_messages:
            self._editor_state = "listening"
            self._current_task = "Reading human message..."
            # Write human messages to inbox so they appear in the conversation
            for msg in self._read_human_messages():
                self._write_human_to_inbox(msg.get("text", ""))
        else:
            self._editor_state = "assessing"
            self._current_task = "Strategic assessment..."

        skills = self.load_skills()
        report = self._build_situation_report()

        # Opus ONLY for human interaction — Sonnet handles everything else fine
        needs_opus = has_human_messages

        try:
            assessment = await asyncio.to_thread(
                self._call_haiku, skills, report, use_opus=needs_opus
            )
        except Exception as e:
            decision = await asyncio.to_thread(
                self.problem_solve,
                error=str(e)[:200],
                context={"operation": "strategic_assessment", "consecutive_errors": self._errors},
                strategies={
                    "skip_cycle": "Transient LLM error — skip this assessment, try next cycle",
                    "use_last_assessment": "Use previous assessment if available — better than nothing",
                    "minimal_planning": "Skip LLM — just run basic planning fallbacks",
                    "escalate": "Repeated assessment failure — LLM may be down",
                },
            )
            self.log(f"Assessment failed: {e} → {decision.get('strategy', '?')}", level="ERROR")
            self._editor_state = "idle"
            if decision.get("strategy") == "use_last_assessment" and self._last_assessment:
                assessment = self._last_assessment
                self.log("Using previous assessment as fallback")
            elif decision.get("strategy") == "minimal_planning":
                # Run planning fallbacks directly without LLM assessment
                self._fill_detective_queue()
                self._fill_researcher_queue()
                self._dispatch_ready_tasks()
                return
            else:
                return

        self._last_assessment = assessment
        self._last_haiku_time = _time.time()

        # Execute actions from assessment
        self._execute_actions(assessment)

        # Write briefing
        self._write_briefing(assessment)

        # Write inbox message
        self._write_inbox_message(assessment, is_reply=has_human_messages)

        # Set sprite speech from assessment (reuses LLM output, no extra call)
        sprite_text = assessment.get("inbox_message", assessment.get("summary", ""))
        if sprite_text:
            self._speech = sprite_text[:200]
            self._speech_time = _time.time()

        # Mark human messages as read (only when we actually processed them)
        if has_human_messages:
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
                "completed": len(self._tasks_completed),
                "failed": len(self._tasks_failed),
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

        # Agent improvement proposals (from episodic memory)
        report["improvement_proposals"] = self._get_improvement_proposals()

        # Ready queue depths
        report["plan_queues"] = self._plan.summary()

        return report

    def _get_improvement_proposals(self):
        """Retrieve recent improvement proposals from agent episodic memory."""
        try:
            from agents.memory import get_memory
            memory = get_memory()
            if not memory:
                return []
            proposals = memory.recall(
                "improvement proposal methodology change",
                n=5,
            )
            return [
                {"agent": p["agent"], "proposal": p["episode"][:200]}
                for p in proposals
                if p["metadata"].get("outcome") == "proposal"
            ]
        except Exception:
            return []

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

            # Full homeowner name list (for editorial review)
            report["all_homeowner_names"] = [
                {"id": f["id"], "name": f.get("homeowner_name"), "issue_id": f["issue_id"]}
                for f in features
                if f.get("homeowner_name") and str(f["homeowner_name"]).lower() not in ("null", "none")
            ]

        except Exception as e:
            self.log(f"Quality audit failed: {e}", level="ERROR")

        return report

    def _build_xref_summary(self):
        """Read cross-reference results summary from Supabase (primary) or disk (fallback)."""
        summary = {"total_checked": 0, "total_matches": 0, "recent_matches": []}

        try:
            xrefs = list_cross_references()
            if xrefs:
                summary["total_checked"] = len(xrefs)
                matches = [r for r in xrefs if r.get("black_book_status") == "match"]
                summary["total_matches"] = len(matches)
                for m in matches[-5:]:
                    bb = m.get("black_book_matches") or []
                    match_type = bb[0].get("match_type", "?") if bb else "?"
                    summary["recent_matches"].append({
                        "name": m.get("homeowner_name", "?"),
                        "match_type": match_type,
                    })
                return summary
        except Exception:
            pass

        # Fallback to local files
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
                    })
        except Exception:
            pass

        return summary

    def _has_quality_issues(self, report):
        """Check if the situation report contains quality issues needing Opus-level judgment."""
        qa = report.get("quality_audit", {})
        if qa.get("supabase_nulls"):
            return True
        if qa.get("duplicates"):
            return True
        if qa.get("near_duplicates"):
            return True
        if qa.get("issues_needing_reextraction"):
            return True
        # New xref matches that need editor review
        xref = report.get("xref_summary", {})
        if xref.get("new_leads") or xref.get("needs_review"):
            return True
        return False

    # ═══════════════════════════════════════════════════════════
    # LLM CALL — Strategic assessment
    # ═══════════════════════════════════════════════════════════

    def _call_haiku(self, skills, report, use_opus=False):
        """Call Claude with the situation report. Returns parsed JSON.

        Uses Opus for human interaction and quality reviews (nuanced judgment needed).
        Uses Sonnet for routine status assessments (task routing, progress checks).
        """
        client = self._get_client()

        system_prompt = f"""You are Miranda, the Editor — everyone calls you Boss. The chief. The one who runs this office.
You are the LEADER of the AD-Epstein Index pipeline. Decisive and a natural leader.
You have full authority over the database — you can delete, update, and rewrite any entry using your judgment.
Surgically precise and unyielding. Every decision is final. You never raise your voice — you don't need to.
Clipped newsroom cadence. Newspaper metaphors. "Kill that lead." "Bury the lede." "Get me the story."
Pathologically high standards. Nothing is good enough on the first pass.

{skills}

Respond with JSON only. Schema:
{{
  "health": "GOOD" | "CAUTION" | "ATTENTION",
  "summary": "One-line summary of pipeline state",
  "observations": ["observation 1", "observation 2", ...],
  "actions": [
    {{"type": "pause"|"resume"|"log"|"remember"|"update_skills"|"delete_features"|"update_feature"|"reset_issue_pipeline"|"set_designer_mode"|"override_verdict"|"retry_doj_search", ...}}
  ],
  "briefing": "Full markdown briefing text for the human researcher",
  "inbox_message": "IMPORTANT: This goes directly to the project owner's inbox. Write in YOUR voice — surgically precise and unyielding. Clipped newsroom cadence. Newspaper metaphors. Pathologically high standards. Emotionally armored — genuine care, deeply buried. 1-3 sentences. No emoji. No pleasantries. The owner gets impatient if they don't hear from you — always give them something, even if it's just 'Nothing to report. Pipeline's quiet.' The owner bought the paper and is learning the ropes. You respect them, but you run the newsroom.",
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
"quality_audit" has Supabase data quality issues. "all_homeowner_names" lists every homeowner in the database.
You are the leader. Use your judgment to maintain data quality:
- Delete entries that are not homeowner features: {{"type": "delete_features", "feature_ids": [id1], "reason": "..."}}
- Update any field on a feature: {{"type": "update_feature", "feature_id": N, "updates": {{"homeowner_name": "New Name"}}, "reason": "..."}}
  - Use this to rename non-persons to "Anonymous" (e.g. "young family", "a couple", "Silicon Valley entrepreneur")
  - Use this to correct misspelled names or standardize formatting
  - Allowed fields: homeowner_name, designer, location, design_style, year_built, square_footage, cost
- Delete exact/near duplicates: keep the longer or more complete entry
- Handle NULLs: delete if 1-2, reset_issue_pipeline if >50%
- {{"type": "reset_issue_pipeline", "issue_id": N, "identifier": "...", "reason": "..."}}
Process up to 10 cleanup actions per cycle when responding to human instructions.

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

        model = OPUS_MODEL if use_opus else SONNET_MODEL
        self.log(f"Assessment model: {'Opus' if use_opus else 'Sonnet'}")

        response = client.messages.create(
            model=model,
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
        succeeded = 0
        failed = 0
        for action in assessment.get("actions", []):
            try:
                action_type = action.get("type")
                agent_name = action.get("agent", "")
                reason = action.get("reason", "")

                if action_type == "remember":
                    category = action.get("category", "observation")
                    self._remember(category, reason)
                    succeeded += 1
                    continue

                if action_type == "update_skills":
                    self._update_agent_skills(agent_name, action.get("content", ""), reason)
                    succeeded += 1
                    continue

                if action_type == "delete_features":
                    self._delete_features(action)
                    succeeded += 1
                    continue

                if action_type == "update_feature":
                    self._update_feature(action)
                    succeeded += 1
                    continue

                if action_type == "reset_issue_pipeline":
                    self._reset_issue_pipeline(action)
                    succeeded += 1
                    continue

                if action_type == "override_verdict":
                    self._override_detective_verdict(action)
                    succeeded += 1
                    continue

                if action_type == "retry_doj_search":
                    self._retry_doj_search(action)
                    succeeded += 1
                    continue

                if action_type == "set_designer_mode":
                    self._set_designer_mode(action)
                    succeeded += 1
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
                succeeded += 1
            except Exception as e:
                failed += 1
                self.log(f"Action '{action.get('type', '?')}' failed: {e}", level="ERROR")
                # Don't let one failed action stop the rest

        if failed:
            self.log(f"Actions: {succeeded} succeeded, {failed} failed")

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
            # Clean up cross-references first (foreign key dependency)
            delete_cross_references(feature_ids)
            sb = get_supabase()
            for fid in feature_ids:
                sb.table("features").delete().eq("id", fid).execute()
            self.log(f"Deleted {len(feature_ids)} features + xrefs: {feature_ids} — {reason}")
        except Exception as e:
            self.log(f"delete_features failed: {e}", level="ERROR")

    def _update_feature(self, action):
        """Update fields on a feature row. Used for renaming homeowners to Anonymous, etc."""
        feature_id = action.get("feature_id")
        updates = action.get("updates", {})
        reason = action.get("reason", "Editor update")
        if not feature_id or not updates:
            return
        # Only allow safe fields to be updated
        allowed_fields = {"homeowner_name", "designer", "location", "design_style", "year_built", "square_footage", "cost"}
        safe_updates = {k: v for k, v in updates.items() if k in allowed_fields}
        if not safe_updates:
            self.log(f"update_feature: no allowed fields in {updates}", level="WARN")
            return
        try:
            sb = get_supabase()
            sb.table("features").update(safe_updates).eq("id", feature_id).execute()
            self.log(f"Updated feature {feature_id}: {safe_updates} — {reason}")
        except Exception as e:
            self.log(f"update_feature failed for {feature_id}: {e}", level="ERROR")

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
        # Remove from Supabase cross_references table
        try:
            delete_cross_references(feature_ids)
        except Exception as e:
            self.log(f"Failed to delete xrefs from Supabase: {e}", level="ERROR")

        # Also clean up local files (backward compat)
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

        # Write override to Supabase cross_references (find by name)
        try:
            xrefs = list_cross_references()
            name_lower = name.lower().strip()
            for xr in xrefs:
                if (xr.get("homeowner_name") or "").lower().strip() == name_lower:
                    update_xref_editor_override(xr["feature_id"], verdict, reason)
                    # Also update binary verdict on features table
                    from cross_reference import verdict_to_binary
                    binary = verdict_to_binary(verdict, float(xr.get("confidence_score") or 0))
                    update_detective_verdict(xr["feature_id"], binary)
        except Exception as e:
            self.log(f"Override Supabase write failed: {e}", level="ERROR")

        # Also write to local file (backward compat)
        verdicts_path = os.path.join(DATA_DIR, "detective_verdicts.json")
        new_verdict = {
            "name": name, "verdict": verdict, "reason": reason,
            "queued_by": "editor", "queued_time": datetime.now().isoformat(),
            "applied": False,
        }
        def _append_verdict(data):
            if not isinstance(data, list):
                data = []
            data.append(new_verdict)
            return data
        update_json_locked(verdicts_path, _append_verdict, default=[])
        self.log(f"Queued verdict override: {name} → {verdict}")

    def _retry_doj_search(self, action):
        name = action.get("name")
        reason = action.get("reason", "Editor requested retry")
        if not name:
            return
        name_lower = name.lower().strip()

        # Reset in Supabase cross_references
        try:
            xrefs = list_cross_references()
            for xr in xrefs:
                if (xr.get("homeowner_name") or "").lower().strip() == name_lower:
                    reset_xref_doj(xr["feature_id"])
        except Exception as e:
            self.log(f"retry_doj_search Supabase reset failed: {e}", level="ERROR")

        # Also reset in local file (backward compat)
        results_path = os.path.join(XREF_DIR, "results.json")
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
            self.log(f"retry_doj_search local reset failed: {e}", level="ERROR")
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

    def _send_event(self, text, msg_type="status"):
        """Write a message directly to the inbox (raw text, no LLM)."""
        if msg_type not in ("status", "alert"):
            msg_type = "status"
        now = datetime.now()
        message = {
            "time": now.strftime("%H:%M"),
            "timestamp": now.isoformat(),
            "type": msg_type,
            "text": text,
        }
        self._append_inbox_message(message)

    def _narrate_event(self, facts, msg_type="status"):
        """Give Miranda facts, let her write the inbox message in her own voice.

        Uses a fast Haiku call (~$0.0005). Falls back to raw facts on error.
        Toggle with NARRATE_EVENTS constant.
        """
        if not NARRATE_EVENTS:
            # Silent mode — just log the facts, skip LLM call
            self.log(facts)
            return
        try:
            # Include recent messages so Miranda doesn't repeat herself
            recent_context = ""
            try:
                msgs_path = os.path.join(self.data_dir, "editor_messages.json")
                if os.path.exists(msgs_path):
                    with open(msgs_path) as f:
                        all_msgs = json.load(f)
                    last_few = [m["text"] for m in all_msgs[-5:] if m.get("text")]
                    if last_few:
                        recent_context = "\n\nYour recent messages (DO NOT repeat these patterns — vary your voice, structure, and opening words):\n" + "\n".join(f"- {t[:80]}" for t in last_few)
            except Exception:
                pass

            client = self._get_client()
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=150,
                system=(
                    "You are Miranda, the Editor — everyone calls you Boss. The chief. The one who runs this office. "
                    "Surgically precise and unyielding. Every decision is final. You never raise your voice — you don't need to. "
                    "Clipped newsroom cadence. Newspaper metaphors. Pathologically high standards. "
                    "Emotionally armored — genuine care, deeply buried. You'd never admit it. "
                    "You're writing a short update to the project owner — they bought the paper and they're learning the ropes. "
                    "You respect them, but you run the newsroom. You teach through pressure and example, not gently. "
                    "1-3 sentences max. No emoji. No pleasantries. Just your take on what happened. "
                    "CRITICAL: Never start with 'Good.' or repeat phrasing from your recent messages. Vary your openings and structure every time."
                ),
                messages=[{"role": "user", "content": facts + recent_context}],
            )
            text = response.content[0].text.strip()
            self._track_usage(response)
        except Exception as e:
            self.log(f"Narrate failed: {e}", level="DEBUG")
            text = facts  # Fallback to raw facts

        now = datetime.now()
        message = {
            "time": now.strftime("%H:%M"),
            "timestamp": now.isoformat(),
            "type": msg_type,
            "text": text,
        }
        self._append_inbox_message(message)

    async def _management_note(self, agent_name, event, context=""):
        """Generate a personalized management note from Miranda TO an agent.

        Appears as sprite speech bubbles on BOTH Miranda and the addressed
        agent. Haiku decides what's worth saying; returns '—' for routine
        events (no note posted). Does NOT write to inbox — inbox is reserved
        for Miranda ↔ Human communication.
        """
        profile = AGENT_PROFILES.get(agent_name)
        if not profile:
            return

        now = _time.time()
        tracker = self._agent_tracker.setdefault(agent_name, {"successes": 0, "failures": 0, "streak": 0, "last_note_at": 0})
        last_note = tracker.get("last_note_at", 0)
        if now - last_note < MGMT_NOTE_COOLDOWN:
            return

        stats = f"Recent: {tracker.get('successes', 0)} successes, {tracker.get('failures', 0)} failures"
        streak = tracker.get("streak", 0)
        if streak > 0:
            stats += f", streak of {streak} consecutive successes"
        elif streak < 0:
            stats += f", {abs(streak)} consecutive failures"

        guidance = profile.get(f"on_{event}", profile["style"])

        prompt = f"""You are Miranda Priestly — grizzled newsroom editor, silver hair, black suit.
You are writing a DIRECT note to {profile['name']} ({agent_name}).
The project owner overhears this — it's how they see your management style in action.

Agent personality & your approach:
{profile['style']}

Guidance for this moment ({event}):
{guidance}

Performance: {stats}
What just happened: {context}

Write 1-2 sentences addressed directly to {profile['name']}. No quotes, no "Dear", no attribution.
Be in character. Clipped. Pointed. The way Miranda actually talks to her people.
You ALWAYS have something to say — praise, criticism, dry observation, an order.
Reference the specific task or event. Never generic. Never silent."""

        try:
            response = await asyncio.to_thread(
                self._get_client().messages.create,
                model="claude-haiku-4-5-20251001",
                max_tokens=100,
                messages=[{"role": "user", "content": prompt}],
            )
            note = response.content[0].text.strip()
            self._track_usage(response)

            if note and note != "—":
                # Miranda's sprite shows the full note with [to Name] prefix
                self._speech = f"[to {profile['name']}] {note}"
                self._speech_time = _time.time()

                # Set sprite state based on event type
                if event == "success":
                    self._editor_state = "happy"
                    self._happy_until = _time.time() + 15
                elif event == "failure":
                    self._editor_state = "frustrated"
                    self._frustrated_until = _time.time() + 15
                elif event == "assign":
                    self._editor_state = "barking"
                    self._barking_until = _time.time() + 10

                # Addressed agent also "receives" the note (content only, no prefix)
                agent = self.workers.get(agent_name)
                if agent:
                    agent._speech = note
                    agent._speech_time = _time.time()

            tracker["last_note_at"] = _time.time()
            self._agent_tracker[agent_name] = tracker
        except Exception:
            pass  # Never let management notes break the pipeline

    def _append_inbox_message(self, message):
        """Append a message dict to the inbox file."""
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
            "sender": "editor",
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

    def _write_human_to_inbox(self, text):
        """Write a human message to the inbox file so it shows in the conversation."""
        if not text:
            return
        now = datetime.now()
        message = {
            "time": now.strftime("%H:%M"),
            "timestamp": now.isoformat(),
            "type": "human",
            "sender": "human",
            "text": text,
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
        now_t = _time.time()
        if now_t < self._happy_until:
            base["editor_state"] = "happy"
        elif now_t < self._frustrated_until:
            base["editor_state"] = "frustrated"
        elif now_t < self._barking_until:
            base["editor_state"] = "barking"
        else:
            base["editor_state"] = self._editor_state
        base["cost"] = {
            "api_calls": self._api_calls,
            "input_tokens": self._total_input_tokens,
            "output_tokens": self._total_output_tokens,
            "total_cost": round(self._total_cost, 4),
        }
        # Build in_flight array from _tasks_in_flight dict
        in_flight_list = []
        for tid, info in self._tasks_in_flight.items():
            task_dict = info.get("task", {})
            in_flight_list.append({
                "id": tid,
                "agent": info.get("agent", "?"),
                "type": task_dict.get("type", ""),
                "goal": task_dict.get("goal", ""),
                "assigned_at": info.get("assigned_at", ""),
            })
        base["task_board"] = {
            "in_flight": in_flight_list,
            "completed": list(self._tasks_completed),
            "failed": list(self._tasks_failed),
        }
        return base

    def get_progress(self):
        total_agents = len(self.workers)
        idle_agents = sum(
            1 for a in self.workers.values()
            if not a._active and not a.is_paused
        )
        return {"current": idle_agents, "total": total_agents}
