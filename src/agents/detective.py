"""
Detective Agent — relentless cross-referencing against Epstein records.

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
        self.load_skills()

        det_log = self._load_detective_log()
        det_log["cycle_count"] = det_log.get("cycle_count", 0) + 1
        det_log["last_run"] = datetime.now().isoformat()

        results = self._load_results()

        # Step 1: Apply any pending Editor verdict overrides
        self._apply_editor_verdicts(results)

        # Step 2: PASS 1 — Black Book (fast, all unchecked names)
        bb_did_work = await self._pass_black_book(results, det_log)

        # Step 3: PASS 2 — DOJ search (slow, batched)
        doj_did_work = await self._pass_doj(results, det_log)

        # Save results after both passes
        self._save_results(results)

        # Update counts
        self._update_counts_from_results(results)
        det_log["names_checked"] = self._checked
        det_log["names_matched"] = self._matches
        self._save_detective_log(det_log)

        did_work = bb_did_work or doj_did_work
        if did_work:
            self._current_task = f"Checked {self._checked} names ({self._matches} matches)"
            self.log(f"Cycle complete: {self._checked} checked, {self._matches} matches, "
                     f"DOJ: {det_log.get('doj_searches_completed', 0)} done")
        else:
            pending_doj = sum(1 for r in results if r.get("doj_status") == "pending")
            if pending_doj:
                self._current_task = f"All BB checked, {pending_doj} DOJ pending"
            else:
                self._current_task = f"All {self._checked} names fully checked"

        return did_work

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
        """Real progress from Supabase features vs checked."""
        results = self._load_results()
        total = len(results)
        doj_done = sum(1 for r in results if r.get("doj_status") == "searched")

        # Try to get total features from Supabase for a more accurate total
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
