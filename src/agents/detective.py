"""
Detective Agent — relentless cross-referencing against Epstein records.

Hub-and-spoke model: Editor can assign cross_reference tasks via inbox.
When no task is assigned, falls back to legacy work() loop which
self-manages BB + DOJ searches.

Two-pass search architecture:
  Pass 1: Black Book (local text file — instant, all unchecked names)
  Pass 2: DOJ Epstein Library (Playwright browser — batched, slow)

For every name, produces a combined verdict: confirmed_match, likely_match,
possible_match, no_match, or needs_review. Escalates ambiguous cases to Editor.

Interval: 180s — DOJ browser searches are slow and rate-sensitive.
"""

import asyncio
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agents.base import Agent, DATA_DIR, update_json_locked, read_json_locked
from agents.tasks import TaskResult

XREF_DIR = os.path.join(DATA_DIR, "cross_references")
RESULTS_PATH = os.path.join(XREF_DIR, "results.json")
CHECKED_PATH = os.path.join(XREF_DIR, "checked_features.json")
DETECTIVE_LOG_PATH = os.path.join(DATA_DIR, "detective_log.json")
DETECTIVE_ESCALATION_PATH = os.path.join(DATA_DIR, "detective_escalations.json")
DETECTIVE_VERDICTS_PATH = os.path.join(DATA_DIR, "detective_verdicts.json")

DOJ_BATCH_SIZE = 5                    # Names per DOJ search cycle
DETECTIVE_INTERVAL = 180              # Seconds between cycles
MAX_NAME_FAILURES = 3                 # After 3 failures on same name, skip it
CONSECUTIVE_FAILURE_THRESHOLD = 3     # After 3 consecutive DOJ failures, escalate
ESCALATION_COOLDOWN_HOURS = 1


class DetectiveAgent(Agent):
    def __init__(self):
        super().__init__("detective", interval=DETECTIVE_INTERVAL)
        self._checked = 0
        self._matches = 0
        self._doj_client = None

    # ═══════════════════════════════════════════════════════════
    # HUB-AND-SPOKE: execute() — for targeted cross-reference tasks
    # ═══════════════════════════════════════════════════════════

    async def execute(self, task):
        """Execute a cross_reference task from the Editor.

        Runs BB + DOJ search on a batch of names, applies contextual glance
        for ambiguous cases, and returns binary YES/NO verdicts.
        """
        if task.type != "cross_reference":
            return TaskResult(
                task_id=task.id, task_type=task.type, status="failure",
                result={}, error=f"Detective doesn't handle '{task.type}'",
                agent=self.name,
            )

        names = task.params.get("names", [])
        feature_ids = task.params.get("feature_ids", {})  # name → [feature_id, ...] list
        if not names:
            return TaskResult(
                task_id=task.id, task_type=task.type, status="success",
                result={"checked": []}, agent=self.name,
            )

        self._current_task = f"Cross-referencing {len(names)} names..."
        checked = []

        # Task briefing is now on task.briefing (built by base.run())
        briefing = getattr(task, 'briefing', '')
        if briefing:
            self.log(f"Briefing: {briefing[:120]}")

        from cross_reference import (
            search_black_book, load_black_book, assess_combined_verdict,
            contextual_glance, verdict_to_binary,
        )
        book_text = await asyncio.to_thread(load_black_book)

        # Step 0: Analyze names with LLM — split compounds, flag skips
        name_analysis = await asyncio.to_thread(self._analyze_names, names, briefing)

        for name in names:
            analysis = name_analysis.get(name, {})
            individuals = analysis.get("search_names", [name])
            if not individuals:
                individuals = [name]  # Fallback

            # Skip if LLM says not a real person
            if analysis.get("skip"):
                self.log(f"Skipping '{name}': {analysis.get('reason', 'not a person')}", level="DEBUG")
                checked.append({
                    "name": name,
                    "individuals_searched": [],
                    "feature_ids": feature_ids.get(name, []),
                    "bb_verdict": "no_match",
                    "bb_matches": None,
                    "doj_verdict": "skipped",
                    "doj_results": None,
                    "combined": "no_match",
                    "confidence_score": 0,
                    "rationale": f"Skipped: {analysis.get('reason', 'not a searchable person')}",
                    "glance_result": None,
                    "binary_verdict": "NO",
                })
                continue

            # Search each individual, take the strongest result
            best_bb_matches = None
            best_doj_result = None
            best_verdict_info = None
            best_bb_verdict = "no_match"
            best_doj_verdict = "pending"

            for individual in individuals:
                bb_matches = search_black_book(individual, book_text)
                if bb_matches:
                    best_bb_matches = bb_matches
                    best_bb_verdict = "match"

                # DOJ search (if browser available)
                doj_result = None
                doj_verdict = "pending"
                try:
                    if await self._ensure_browser():
                        doj_result = await self._doj_client.search_name_variations(individual)
                        if doj_result.get("search_successful"):
                            doj_verdict = "searched"
                            verdict_info = assess_combined_verdict(individual, bb_matches, doj_result)
                        else:
                            doj_verdict = "error"
                            verdict_info = {"verdict": best_bb_verdict, "confidence_score": 0.5,
                                            "rationale": f"DOJ search failed for {individual}", "false_positive_indicators": []}
                    else:
                        verdict_info = {"verdict": best_bb_verdict, "confidence_score": 0.5,
                                        "rationale": "DOJ browser unavailable", "false_positive_indicators": []}
                except Exception as e:
                    # Diagnose DOJ failure and decide recovery
                    decision = await asyncio.to_thread(
                        self.problem_solve,
                        error=str(e)[:200],
                        context={
                            "name": individual,
                            "bb_verdict": best_bb_verdict,
                            "search_type": "DOJ browser search",
                        },
                        strategies={
                            "skip_doj": "DOJ unavailable — use BB verdict only (lower confidence)",
                            "retry_with_backoff": "Possible rate limit — wait and retry",
                            "restart_browser": "Browser may have crashed — close and relaunch",
                            "escalate": "DOJ site down or WAF blocking — needs Editor attention",
                        },
                    )
                    self.log(f"DOJ problem: {decision.get('diagnosis', '?')} → {decision.get('strategy', '?')}")

                    recovered = False
                    if decision.get("strategy") == "restart_browser":
                        try:
                            await self._stop_browser()
                            await asyncio.sleep(5)
                            await self._ensure_browser()
                            doj_result = await self._doj_client.search_name_variations(individual)
                            if doj_result.get("search_successful"):
                                doj_verdict = "searched"
                                verdict_info = assess_combined_verdict(individual, bb_matches, doj_result)
                                recovered = True
                        except Exception:
                            pass  # Fall through to BB-only verdict

                    if not recovered:
                        doj_verdict = "error"
                        verdict_info = {"verdict": best_bb_verdict, "confidence_score": 0.3,
                                        "rationale": f"DOJ error: {decision.get('diagnosis', str(e))}", "false_positive_indicators": []}

                # Keep the strongest result across individuals
                if best_verdict_info is None or verdict_info.get("confidence_score", 0) > best_verdict_info.get("confidence_score", 0):
                    best_verdict_info = verdict_info
                    best_doj_result = doj_result
                    best_doj_verdict = doj_verdict

                await asyncio.sleep(2)  # Rate limiting between individuals

            if best_verdict_info is None:
                best_verdict_info = {"verdict": "no_match", "confidence_score": 0, "rationale": "No results", "false_positive_indicators": []}

            # Contextual glance for ambiguous cases
            combined = best_verdict_info["verdict"]
            glance_result = None
            if combined in ("possible_match", "needs_review", "likely_match"):
                glance_result = await asyncio.to_thread(
                    contextual_glance, name, best_bb_matches, best_doj_result
                )

            # Map to binary YES/NO
            binary_verdict = verdict_to_binary(
                combined,
                best_verdict_info.get("confidence_score", 0),
                glance_override=glance_result,
            )

            checked.append({
                "name": name,
                "individuals_searched": individuals,
                "feature_ids": feature_ids.get(name, []),
                "bb_verdict": best_bb_verdict,
                "bb_matches": best_bb_matches,
                "doj_verdict": best_doj_verdict,
                "doj_results": best_doj_result,
                "combined": combined,
                "confidence_score": best_verdict_info.get("confidence_score", 0),
                "rationale": best_verdict_info.get("rationale", ""),
                "glance_result": glance_result,
                "binary_verdict": binary_verdict,
            })

            await asyncio.sleep(2)  # Rate limiting between names

        # Commit episodes for significant findings
        yes_names = [c["name"] for c in checked if c.get("binary_verdict") == "YES"]
        no_names = [c["name"] for c in checked if c.get("binary_verdict") == "NO"]
        try:
            self.commit_episode(
                "cross_reference",
                f"Cross-referenced {len(checked)} names: {len(yes_names)} YES, {len(no_names)} NO. "
                f"YES names: {', '.join(yes_names[:5]) or 'none'}",
                "success",
                {"total": len(checked), "yes_count": len(yes_names), "no_count": len(no_names)},
            )
        except Exception:
            pass

        # Post bulletin for YES matches
        if yes_names:
            try:
                self.post_bulletin(
                    f"Cross-reference results: {len(yes_names)} YES verdict(s) — {', '.join(yes_names[:5])}",
                    tags=["cross_reference", "match", "yes_verdict"],
                )
            except Exception:
                pass

        # Post learned patterns to bulletin board
        if checked:
            try:
                self._post_task_learning(
                    "cross_reference",
                    f"Checked {len(checked)} names: {len(yes_names)} YES, {len(no_names)} NO. "
                    f"{'DOJ browser active.' if self._doj_client else 'DOJ unavailable — BB only.'}"
                )
            except Exception:
                pass

        # Narrate the batch summary
        try:
            self.narrate(
                f"Finished cross-referencing {len(checked)} names. "
                f"{len(yes_names)} flagged YES, {len(no_names)} cleared NO."
            )
        except Exception:
            pass

        return TaskResult(
            task_id=task.id, task_type=task.type, status="success",
            result={"checked": checked}, agent=self.name,
        )

    # ── Name Analysis (LLM) ──────────────────────────────────────

    def _analyze_names(self, names, briefing=""):
        """Use Haiku to analyze a batch of names — split compounds, flag non-persons.

        Returns dict: { original_name: { "search_names": [...], "skip": bool, "reason": str } }
        One LLM call for the whole batch (~$0.001).
        """
        import anthropic

        names_list = "\n".join(f"  {i+1}. {n}" for i, n in enumerate(names))

        briefing_section = ""
        if briefing:
            briefing_section = f"\n\nCONTEXT FROM PAST EXPERIENCE:\n{briefing}\n"

        prompt = f"""You are a detective's assistant preparing names for a search against the Epstein document library.{briefing_section}

For each name below, tell me:
1. The individual people to search for (split couples, groups, etc.)
2. Whether to skip it entirely (not a real searchable person)

Names from Architectural Digest homeowner features:
{names_list}

Rules:
- "Inga and Keith Rubenstein" → search "Inga Rubenstein" AND "Keith Rubenstein" separately
- "George Clooney, Rande Gerber, and his wife, Cindy Crawford" → search each person
- "Anonymous", "young family" → skip (not identifiable)
- "Gritti Palace (hotel)", "The Danaos brothers" → skip (not individual people)
- "Mr. and Mrs. Charles Yalem" → search "Charles Yalem" (and optionally "Mrs. Charles Yalem")
- Single names like "Tyler Perry" → search as-is
- Historical figures who died before 1950 → skip (cannot have known Epstein)

Respond with JSON only. Format:
{{
  "Original Name Here": {{
    "search_names": ["First Last", "First Last"],
    "skip": false
  }},
  "Anonymous": {{
    "search_names": [],
    "skip": true,
    "reason": "Not an identifiable person"
  }}
}}"""

        try:
            client = anthropic.Anthropic()
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            return json.loads(text)
        except Exception as e:
            self.log(f"Name analysis LLM failed: {e}", level="WARN")
            # Fallback: return each name as-is, no skips
            return {n: {"search_names": [n], "skip": False} for n in names}

    # ── Browser Lifecycle ────────────────────────────────────────

    async def _start_browser(self):
        """Launch DOJ search client (lazy — called first time DOJ search is needed)."""
        if self._doj_client is not None:
            return
        from doj_search import DOJSearchClient
        self._doj_client = DOJSearchClient()
        await self._doj_client.start()
        self.log("DOJ browser launched")

    async def _stop_browser(self):
        """Close DOJ browser (idempotent)."""
        if self._doj_client:
            await self._doj_client.stop()
            self._doj_client = None
            self.log("DOJ browser closed")

    async def _ensure_browser(self) -> bool:
        """Ensure browser is alive. Returns True if ready."""
        if self._doj_client is None:
            await self._start_browser()
            return self._doj_client is not None
        return await self._doj_client.ensure_ready()

    # ── Failure Tracking ─────────────────────────────────────────

    def _load_detective_log(self):
        """Load persistent tracking from disk."""
        if os.path.exists(DETECTIVE_LOG_PATH):
            try:
                with open(DETECTIVE_LOG_PATH) as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "cycle_count": 0,
            "last_run": None,
            "name_failures": {},
            "consecutive_failures": 0,
            "names_checked": 0,
            "names_matched": 0,
            "doj_searches_completed": 0,
            "doj_searches_failed": 0,
        }

    def _save_detective_log(self, log):
        """Persist tracking to disk."""
        os.makedirs(os.path.dirname(DETECTIVE_LOG_PATH), exist_ok=True)
        with open(DETECTIVE_LOG_PATH, "w") as f:
            json.dump(log, f, indent=2)

    def _record_name_failure(self, log, name, error_msg):
        """Increment failure count for a name."""
        failures = log.setdefault("name_failures", {})
        entry = failures.get(name, {"failures": 0})
        entry["failures"] = entry.get("failures", 0) + 1
        entry["last_error"] = str(error_msg)[:200]
        entry["last_attempt"] = datetime.now().isoformat()
        failures[name] = entry

    def _record_name_success(self, log, name):
        """Clear failure tracking for a successfully searched name."""
        log.get("name_failures", {}).pop(name, None)
        log["consecutive_failures"] = 0

    def _should_skip_name(self, log, name) -> bool:
        """Check if a name has exceeded max failures."""
        entry = log.get("name_failures", {}).get(name)
        if not entry:
            return False
        return entry.get("failures", 0) >= MAX_NAME_FAILURES

    # ── Escalation I/O ───────────────────────────────────────────

    def _load_escalations(self):
        """Load existing escalations from disk."""
        if os.path.exists(DETECTIVE_ESCALATION_PATH):
            try:
                with open(DETECTIVE_ESCALATION_PATH) as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def _save_escalations(self, escalations):
        """Write escalations to disk."""
        os.makedirs(os.path.dirname(DETECTIVE_ESCALATION_PATH), exist_ok=True)
        with open(DETECTIVE_ESCALATION_PATH, "w") as f:
            json.dump(escalations, f, indent=2)

    def _maybe_escalate(self, reason_type, message, context=None):
        """Write an escalation if warranted and rate-limited."""
        escalations = self._load_escalations()
        ctx = context or {}
        name = ctx.get("name", "")

        # Per-name cooldown: check for recent unresolved escalation
        for esc in reversed(escalations):
            if not esc.get("resolved"):
                esc_name = esc.get("context", {}).get("name", "")
                same_name = (name and esc_name == name) or (not name and esc.get("type") == reason_type)
                if same_name:
                    try:
                        last_time = datetime.fromisoformat(esc["time"])
                        hours_since = (datetime.now() - last_time).total_seconds() / 3600
                        if hours_since < ESCALATION_COOLDOWN_HOURS:
                            return  # Too soon
                    except Exception:
                        pass
                    break

        escalation = {
            "time": datetime.now().isoformat(),
            "type": reason_type,
            "message": message,
            "context": context or {},
            "resolved": False,
        }
        escalations.append(escalation)
        self._save_escalations(escalations)
        self.log(f"Escalated to Editor: {message}", level="WARN")

    # ── Editor Verdicts ──────────────────────────────────────────

    def _load_editor_verdicts(self):
        """Load Editor verdict overrides (with shared lock)."""
        return read_json_locked(DETECTIVE_VERDICTS_PATH, default=[])

    def _apply_editor_verdicts(self, results):
        """Apply unapplied Editor verdicts to results. Marks verdicts as applied."""
        verdicts = self._load_editor_verdicts()
        unapplied = [v for v in verdicts if not v.get("applied")]

        if not unapplied:
            return

        # Build name -> result index map
        name_to_idx = {}
        for i, r in enumerate(results):
            name_to_idx[r.get("homeowner_name", "").lower()] = i

        applied_count = 0
        for verdict in unapplied:
            name = verdict.get("name", "").lower()
            if name in name_to_idx:
                idx = name_to_idx[name]
                results[idx]["combined_verdict"] = verdict["verdict"]
                results[idx]["verdict_rationale"] = f"Editor override: {verdict.get('reason', '')}"
                results[idx]["last_updated"] = datetime.now().isoformat()
                verdict["applied"] = True
                verdict["applied_time"] = datetime.now().isoformat()
                applied_count += 1

        if applied_count:
            # Save updated verdicts with exclusive lock
            def mark_applied(data):
                for v in data:
                    matching = [u for u in unapplied if u.get("applied") and u.get("name") == v.get("name")]
                    if matching:
                        v["applied"] = True
                        v["applied_time"] = matching[0].get("applied_time")
            update_json_locked(DETECTIVE_VERDICTS_PATH, mark_applied, default=[])
            self.log(f"Applied {applied_count} Editor verdict override(s)")

    # ── Results I/O ──────────────────────────────────────────────

    def _load_results(self):
        """Load cross-reference results (with shared lock)."""
        os.makedirs(XREF_DIR, exist_ok=True)
        return read_json_locked(RESULTS_PATH, default=[])

    def _save_results(self, results):
        """Save cross-reference results (with exclusive lock)."""
        os.makedirs(XREF_DIR, exist_ok=True)
        update_json_locked(RESULTS_PATH, lambda _: results, default=[])

    def _load_checked_ids(self):
        """Load set of already-checked feature IDs."""
        if os.path.exists(CHECKED_PATH):
            try:
                with open(CHECKED_PATH) as f:
                    return set(json.load(f))
            except Exception:
                pass
        return set()

    def _save_checked_ids(self, checked_ids):
        """Save checked feature IDs."""
        os.makedirs(XREF_DIR, exist_ok=True)
        with open(CHECKED_PATH, "w") as f:
            json.dump(sorted(checked_ids), f)

    # ── Main Work Loop ───────────────────────────────────────────

    async def work(self):
        """Idle — Detective is now fully Editor-directed via execute().

        The Editor assigns cross_reference tasks after loading extractions
        and via planning fallbacks. Detective no longer self-manages work.
        """
        self._current_task = "Waiting for Editor assignment"
        return False

    async def _pass_black_book(self, results, det_log):
        """Pass 1: Check unchecked features against Black Book (fast, local)."""
        from cross_reference import get_unchecked_features, search_black_book, load_black_book, SKIP_NAMES

        unchecked, checked_ids = await asyncio.to_thread(get_unchecked_features)

        if not unchecked:
            return False

        self._current_task = f"BB: Checking {len(unchecked)} names"
        self.log(f"Pass 1 (Black Book): {len(unchecked)} unchecked names")

        book_text = await asyncio.to_thread(load_black_book)
        new_results = 0

        for feature in unchecked:
            name = feature.get("homeowner_name")
            feature_id = feature["id"]

            if not name or name.strip().lower() in SKIP_NAMES:
                checked_ids.add(feature_id)
                continue

            bb_matches = search_black_book(name, book_text)
            bb_status = "match" if bb_matches else "no_match"

            if bb_matches:
                self.log(f"BB MATCH: {name} ({bb_matches[0]['match_type']})")

            result_entry = {
                "feature_id": feature_id,
                "homeowner_name": name,
                "black_book_status": bb_status,
                "black_book_matches": bb_matches,
                "doj_status": "pending",
                "doj_results": None,
                "combined_verdict": None,
                "confidence_score": 0.0,
                "verdict_rationale": None,
                "false_positive_indicators": [],
                "last_updated": datetime.now().isoformat(),
            }
            results.append(result_entry)
            checked_ids.add(feature_id)
            new_results += 1

        # Save checked IDs
        from cross_reference import save_checked_ids
        await asyncio.to_thread(save_checked_ids, checked_ids)

        if new_results:
            self.log(f"Pass 1 done: {new_results} names checked against Black Book")
        return new_results > 0

    async def _pass_doj(self, results, det_log):
        """Pass 2: DOJ search for names with doj_status='pending' (batched)."""
        from cross_reference import assess_combined_verdict

        # Find pending DOJ searches (skip names that have exceeded failure threshold)
        pending = []
        for i, r in enumerate(results):
            if r.get("doj_status") == "pending":
                name = r.get("homeowner_name", "")
                if not self._should_skip_name(det_log, name):
                    pending.append((i, name))

        if not pending:
            return False

        batch = pending[:DOJ_BATCH_SIZE]
        self._current_task = f"DOJ: Searching {len(batch)}/{len(pending)} names"
        self.log(f"Pass 2 (DOJ): Searching {len(batch)} of {len(pending)} pending names")

        # Launch browser if needed
        try:
            if not await self._ensure_browser():
                self.log("Failed to start DOJ browser", level="ERROR")
                det_log["consecutive_failures"] = det_log.get("consecutive_failures", 0) + 1
                if det_log["consecutive_failures"] >= CONSECUTIVE_FAILURE_THRESHOLD:
                    self._maybe_escalate(
                        "search_stuck",
                        "DOJ browser failed to launch after multiple attempts",
                        {"consecutive_failures": det_log["consecutive_failures"]},
                    )
                return False
        except Exception as e:
            self.log(f"Browser launch error: {e}", level="ERROR")
            return False

        doj_did_work = False

        for idx, name in batch:
            self._current_task = f"DOJ: Searching '{name}'"
            try:
                doj_result = await self._doj_client.search_name_variations(name)

                if doj_result.get("search_successful"):
                    results[idx]["doj_status"] = "searched"
                    results[idx]["doj_results"] = doj_result
                    self._record_name_success(det_log, name)
                    det_log["doj_searches_completed"] = det_log.get("doj_searches_completed", 0) + 1

                    # Compute combined verdict
                    bb_matches = results[idx].get("black_book_matches")
                    verdict_info = assess_combined_verdict(name, bb_matches, doj_result)
                    results[idx]["combined_verdict"] = verdict_info["verdict"]
                    results[idx]["confidence_score"] = verdict_info["confidence_score"]
                    results[idx]["verdict_rationale"] = verdict_info["rationale"]
                    results[idx]["false_positive_indicators"] = verdict_info["false_positive_indicators"]
                    results[idx]["last_updated"] = datetime.now().isoformat()

                    # Log significant findings
                    verdict = verdict_info["verdict"]
                    if verdict in ("confirmed_match", "likely_match"):
                        self.log(f"DOJ {verdict.upper()}: {name} "
                                 f"(confidence={doj_result.get('confidence')}, "
                                 f"results={doj_result.get('total_results')})")

                    # Escalate as needed
                    self._maybe_escalate_verdict(name, verdict_info)

                    doj_did_work = True
                    det_log["consecutive_failures"] = 0
                else:
                    # Search failed but browser is alive
                    error = doj_result.get("error", "Unknown")
                    self._record_name_failure(det_log, name, error)
                    det_log["doj_searches_failed"] = det_log.get("doj_searches_failed", 0) + 1
                    det_log["consecutive_failures"] = det_log.get("consecutive_failures", 0) + 1
                    results[idx]["doj_status"] = "error"
                    results[idx]["doj_results"] = {"error": error}
                    results[idx]["last_updated"] = datetime.now().isoformat()
                    self.log(f"DOJ search failed for '{name}': {error}", level="WARN")

            except Exception as e:
                self._record_name_failure(det_log, name, str(e))
                det_log["doj_searches_failed"] = det_log.get("doj_searches_failed", 0) + 1
                det_log["consecutive_failures"] = det_log.get("consecutive_failures", 0) + 1
                results[idx]["doj_status"] = "error"
                results[idx]["doj_results"] = {"error": str(e)[:200]}
                results[idx]["last_updated"] = datetime.now().isoformat()
                self.log(f"DOJ search error for '{name}': {e}", level="ERROR")

            # Check consecutive failure threshold
            if det_log.get("consecutive_failures", 0) >= CONSECUTIVE_FAILURE_THRESHOLD:
                self._maybe_escalate(
                    "search_stuck",
                    f"DOJ search failed {det_log['consecutive_failures']} times consecutively",
                    {"consecutive_failures": det_log["consecutive_failures"]},
                )
                break  # Stop this batch

            # Small delay between DOJ searches to be polite
            await asyncio.sleep(2)

        return doj_did_work

    def _maybe_escalate_verdict(self, name, verdict_info):
        """Escalate notable verdicts to Editor."""
        verdict = verdict_info["verdict"]
        fp = verdict_info.get("false_positive_indicators", [])

        if verdict in ("confirmed_match", "likely_match"):
            self._maybe_escalate(
                "high_value_match",
                f"{verdict}: {name} — {verdict_info['rationale']}",
                {"name": name, "verdict": verdict,
                 "confidence_score": verdict_info["confidence_score"]},
            )
        elif verdict == "possible_match" and fp:
            self._maybe_escalate(
                "false_positive_review",
                f"Possible match with false positive risk: {name} — {', '.join(fp)}",
                {"name": name, "verdict": verdict, "indicators": fp},
            )
        elif verdict == "needs_review":
            self._maybe_escalate(
                "needs_review",
                f"Ambiguous evidence for: {name} — {verdict_info['rationale']}",
                {"name": name, "verdict": verdict},
            )

    # ── Counts & Progress ────────────────────────────────────────

    def _update_counts_from_results(self, results):
        """Update in-memory counts from results list."""
        self._checked = len(results)
        self._matches = sum(
            1 for r in results
            if r.get("combined_verdict") in ("confirmed_match", "likely_match")
            or r.get("black_book_status") == "match"
        )

    def get_progress(self):
        """Real progress from Supabase cross_references + features."""
        # Primary: Supabase cross_references table
        try:
            from db import list_cross_references, get_features_without_xref
            xrefs = list_cross_references()
            unchecked = get_features_without_xref()
            total = len(xrefs) + len(unchecked)
            doj_done = sum(1 for r in xrefs if r.get("doj_status") == "searched")
            matches = sum(
                1 for r in xrefs
                if r.get("combined_verdict") in ("confirmed_match", "likely_match")
                or r.get("black_book_status") == "match"
            )
            return {
                "current": doj_done,
                "total": total,
                "bb_checked": len(xrefs),
                "doj_pending": sum(1 for r in xrefs if r.get("doj_status") == "pending"),
                "doj_errors": sum(1 for r in xrefs if r.get("doj_status") == "error"),
                "matches": matches,
            }
        except Exception:
            pass

        # Fallback: local results.json
        results = self._load_results()
        total = len(results)
        doj_done = sum(1 for r in results if r.get("doj_status") == "searched")

        try:
            from cross_reference import get_unchecked_features
            unchecked, checked_ids = get_unchecked_features()
            total = len(unchecked) + len(checked_ids)
        except Exception:
            pass

        return {
            "current": doj_done,
            "total": total,
            "bb_checked": len(results),
            "doj_pending": sum(1 for r in results if r.get("doj_status") == "pending"),
            "doj_errors": sum(1 for r in results if r.get("doj_status") == "error"),
            "matches": self._matches,
        }

    # ── Run Override (browser cleanup) ───────────────────────────

    async def run(self):
        """Override run() to ensure browser is closed on shutdown."""
        try:
            await super().run()
        finally:
            await self._stop_browser()
