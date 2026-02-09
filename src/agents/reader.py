"""
Reader Agent — extracts homeowner data from downloaded AD PDFs.

Hub-and-spoke model: Editor assigns extract_features tasks via inbox.
When no task is assigned, falls back to legacy work() loop.

Task types:
  - extract_features: Extract features from a PDF
  - reextract_features: Re-extract with specific strategy

Wraps extract_features.process_issue() + load_features.load_extraction().
Includes failure tracking, escalation to Editor, and re-extraction support.
Quality gating is done by the Editor (not Reader) in hub-and-spoke model.

Interval: 30s — each extraction takes several minutes via Claude Vision.
"""

import asyncio
import json
import os
import shutil
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agents.base import Agent, DATA_DIR, update_json_locked, read_json_locked
from agents.tasks import TaskResult
from db import list_issues, update_issue, get_issue_by_identifier
EXTRACTIONS_DIR = os.path.join(DATA_DIR, "extractions")
READER_LOG_PATH = os.path.join(DATA_DIR, "reader_log.json")
READER_ESCALATION_PATH = os.path.join(DATA_DIR, "reader_escalations.json")
REEXTRACT_QUEUE_PATH = os.path.join(DATA_DIR, "reader_reextract_queue.json")

# Quality gates
NULL_RATE_THRESHOLD = 0.50       # Hold if >50% features have null homeowner
MIN_FEATURES_FOR_LOAD = 2       # Hold if fewer than 2 features

# Failure tracking
MAX_ISSUE_FAILURES = 3           # After 3 failures, mark extraction_error
MAX_LOAD_FAILURES = 3            # After 3 Supabase load failures, escalate
CONSECUTIVE_FAILURE_THRESHOLD = 3  # After 3 in a row, escalate extraction_stuck
ESCALATION_COOLDOWN_HOURS = 1

# Key fields for quality scoring (out of 6)
QC_FIELDS = ["homeowner_name", "designer_name", "location_city",
             "location_country", "design_style", "year_built"]


class ReaderAgent(Agent):
    def __init__(self):
        super().__init__("reader", interval=30)
        self._extracted_count = 0
        self._features_count = 0

    # ═══════════════════════════════════════════════════════════
    # HUB-AND-SPOKE: execute() — called when Editor assigns a task
    # ═══════════════════════════════════════════════════════════

    async def execute(self, task):
        """Execute an extraction task from the Editor. Returns a TaskResult.

        The Reader extracts features and returns them. The Editor applies
        quality gating and loads into Supabase.
        """
        if task.type not in ("extract_features", "reextract_features"):
            return TaskResult(
                task_id=task.id, task_type=task.type, status="failure",
                result={}, error=f"Reader doesn't handle '{task.type}'",
                agent=self.name,
            )

        identifier = task.params.get("identifier", "")
        pdf_path = task.params.get("pdf_path", "")

        if not identifier:
            return TaskResult(
                task_id=task.id, task_type=task.type, status="failure",
                result={"identifier": identifier}, error="No identifier provided",
                agent=self.name,
            )

        self._current_task = f"Extracting: {identifier[:40]}..."

        # Build issue dict for process_issue
        issue = get_issue_by_identifier(identifier)
        if not issue:
            return TaskResult(
                task_id=task.id, task_type=task.type, status="failure",
                result={"identifier": identifier}, error="Issue not found in Supabase",
                agent=self.name,
            )

        # Recovery strategies the Reader knows how to execute
        READER_STRATEGIES = {
            "compress_images": "Re-encode page images as JPEG to reduce API payload size",
            "reduce_batch": "Send fewer pages per API call (5 instead of 10)",
            "text_extraction": "Extract text directly from PDF using pdftotext — skip images entirely",
            "wider_scan": "Re-extract with wider_scan strategy (scan every 3 pages from page 20)",
            "lower_resolution": "Render pages at 100 DPI instead of 150 DPI",
        }

        max_attempts = 2  # Original attempt + 1 recovery
        last_error = None
        recovery_context = {}

        for attempt in range(max_attempts):
            try:
                if task.type == "reextract_features":
                    strategy = task.params.get("strategy", "wider_scan")
                    old_path = os.path.join(EXTRACTIONS_DIR, f"{identifier}.json")
                    backup_path = old_path + ".backup"
                    if os.path.exists(old_path):
                        shutil.copy2(old_path, backup_path)
                        os.remove(old_path)

                    from extract_features import process_issue_reextract
                    output_path = await asyncio.to_thread(process_issue_reextract, issue, strategy)
                else:
                    from extract_features import process_issue
                    output_path = await asyncio.to_thread(process_issue, issue)

                if not output_path:
                    last_error = "process_issue returned None"
                    raise RuntimeError(last_error)

                # Read the extraction output
                with open(output_path) as f:
                    data = json.load(f)

                features = data.get("features", [])
                quality_metrics = {
                    "feature_count": len(features),
                    "null_homeowner_count": sum(
                        1 for f in features
                        if not f.get("homeowner_name") or f["homeowner_name"] in ("null", "None")
                    ),
                }
                if len(features) > 0:
                    quality_metrics["null_homeowner_rate"] = round(
                        quality_metrics["null_homeowner_count"] / len(features), 2
                    )

                self._extracted_count += 1
                self._features_count += len(features)

                result_data = {
                    "identifier": identifier,
                    "features": features,
                    "quality_metrics": quality_metrics,
                    "extraction_path": output_path,
                }
                if recovery_context:
                    result_data["recovery_used"] = recovery_context
                    result_data["summary"] = f"Extracted {len(features)} features from {identifier} (recovered via {recovery_context.get('strategy', 'unknown')})"
                else:
                    result_data["summary"] = f"Extracted {len(features)} features from {identifier}"

                return TaskResult(
                    task_id=task.id, task_type=task.type, status="success",
                    result=result_data, agent=self.name,
                )

            except Exception as e:
                last_error = str(e)

                if attempt < max_attempts - 1:
                    # ── Problem-solving loop ──
                    # Ask the LLM to diagnose the error and pick a recovery strategy
                    pdf_path = issue.get("pdf_path", "")
                    pdf_size_mb = 0
                    try:
                        pdf_size_mb = round(os.path.getsize(pdf_path) / 1024 / 1024, 1)
                    except Exception:
                        pass

                    decision = await asyncio.to_thread(
                        self.problem_solve,
                        error=last_error,
                        context={
                            "identifier": identifier,
                            "pdf_path": pdf_path,
                            "pdf_size_mb": pdf_size_mb,
                            "task_type": task.type,
                            "attempt": attempt + 1,
                        },
                        strategies=READER_STRATEGIES,
                    )

                    strategy = decision.get("strategy", "escalate")
                    recovery_context = decision

                    if strategy == "escalate":
                        break  # Give up, return failure

                    # Execute the chosen recovery strategy
                    self.log(f"Recovering: {strategy} — {decision.get('reasoning', '')}")

                    if strategy == "compress_images":
                        # The JPEG compression is now automatic in make_image_content()
                        # Just clear the old extraction and retry
                        old_path = os.path.join(EXTRACTIONS_DIR, f"{identifier}.json")
                        if os.path.exists(old_path):
                            os.remove(old_path)

                    elif strategy == "reduce_batch":
                        # Set an env hint that process_issue reads for smaller batches
                        os.environ["READER_SMALL_BATCHES"] = "1"
                        old_path = os.path.join(EXTRACTIONS_DIR, f"{identifier}.json")
                        if os.path.exists(old_path):
                            os.remove(old_path)

                    elif strategy == "text_extraction":
                        # Check if PDF has text, if so try text-based extraction
                        from extract_features import pdf_has_text_layer
                        if pdf_has_text_layer(pdf_path):
                            self.log(f"PDF has text layer — using text extraction for {identifier}")
                        old_path = os.path.join(EXTRACTIONS_DIR, f"{identifier}.json")
                        if os.path.exists(old_path):
                            os.remove(old_path)

                    elif strategy == "wider_scan":
                        # Switch to reextract mode with wider_scan
                        task.type = "reextract_features"
                        task.params["strategy"] = "wider_scan"
                        old_path = os.path.join(EXTRACTIONS_DIR, f"{identifier}.json")
                        if os.path.exists(old_path):
                            os.remove(old_path)

                    elif strategy == "lower_resolution":
                        os.environ["READER_LOW_RES"] = "1"
                        old_path = os.path.join(EXTRACTIONS_DIR, f"{identifier}.json")
                        if os.path.exists(old_path):
                            os.remove(old_path)

                    continue  # Retry with the recovery strategy applied

        # All attempts exhausted
        return TaskResult(
            task_id=task.id, task_type=task.type, status="failure",
            result={"identifier": identifier, "recovery_attempted": recovery_context},
            error=last_error,
            agent=self.name,
        )

    # ── Quality Assessment ──────────────────────────────────

    def _assess_quality(self, output_path, identifier):
        """Assess extraction quality. Returns (verdict, metrics).

        verdict: "load" — good enough to load into Supabase
                 "hold" — don't load, escalate to Editor
        metrics: dict with feature_count, null_homeowner_count, etc.
        """
        try:
            with open(output_path) as f:
                data = json.load(f)
        except Exception as e:
            return "hold", {
                "error": str(e),
                "escalation_type": "extraction_failed",
            }

        if data.get("skipped"):
            return "load", {"skipped": True, "feature_count": 0}

        features = data.get("features", [])
        feature_count = len(features)

        # Count null homeowners
        null_homeowner_count = sum(
            1 for f in features
            if not f.get("homeowner_name") or f["homeowner_name"] in ("null", "None")
        )
        null_homeowner_rate = null_homeowner_count / feature_count if feature_count > 0 else 1.0

        # Average fields filled per feature
        if features:
            total_filled = sum(
                sum(1 for k in QC_FIELDS if feat.get(k) and feat[k] not in ("null", "None"))
                for feat in features
            )
            avg_fields_filled = total_filled / len(features)
        else:
            avg_fields_filled = 0

        metrics = {
            "feature_count": feature_count,
            "null_homeowner_count": null_homeowner_count,
            "null_homeowner_rate": round(null_homeowner_rate, 2),
            "avg_fields_filled": round(avg_fields_filled, 1),
        }

        # Determine verdict
        if feature_count == 0:
            metrics["escalation_type"] = "zero_features"
            return "hold", metrics

        if feature_count <= 1:
            metrics["escalation_type"] = "insufficient_features"
            return "hold", metrics

        if null_homeowner_rate > NULL_RATE_THRESHOLD:
            metrics["escalation_type"] = "high_null_rate"
            return "hold", metrics

        # Passes all gates — load it
        return "load", metrics

    # ── Failure Tracking (reader_log.json) ──────────────────

    def _load_reader_log(self):
        """Load persistent failure/success tracking from disk."""
        if os.path.exists(READER_LOG_PATH):
            try:
                with open(READER_LOG_PATH) as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "cycle_count": 0,
            "last_run": None,
            "issue_failures": {},
            "load_failures": {},
            "consecutive_failures": 0,
            "issues_held": [],
            "issues_loaded": 0,
        }

    def _save_reader_log(self, log):
        """Persist tracking to disk."""
        os.makedirs(os.path.dirname(READER_LOG_PATH), exist_ok=True)
        with open(READER_LOG_PATH, "w") as f:
            json.dump(log, f, indent=2)

    def _record_issue_failure(self, log, identifier, error_msg):
        """Increment failure count for an issue."""
        failures = log.setdefault("issue_failures", {})
        entry = failures.get(identifier, {"failures": 0})
        entry["failures"] = entry.get("failures", 0) + 1
        entry["last_error"] = str(error_msg)[:200]
        entry["last_attempt"] = datetime.now().isoformat()
        failures[identifier] = entry
        log["consecutive_failures"] = log.get("consecutive_failures", 0) + 1

    def _record_issue_success(self, log, identifier):
        """Clear failure tracking for a successfully processed issue."""
        log.get("issue_failures", {}).pop(identifier, None)
        log.get("load_failures", {}).pop(identifier, None)
        log["consecutive_failures"] = 0

    def _record_load_failure(self, log, identifier, error_msg):
        """Track Supabase load failure separately from extraction failure."""
        load_failures = log.setdefault("load_failures", {})
        entry = load_failures.get(identifier, {"failures": 0})
        entry["failures"] = entry.get("failures", 0) + 1
        entry["last_error"] = str(error_msg)[:200]
        entry["last_attempt"] = datetime.now().isoformat()
        load_failures[identifier] = entry

    # ── Escalation I/O ──────────────────────────────────────

    def _load_escalations(self):
        """Load existing escalations from disk."""
        if os.path.exists(READER_ESCALATION_PATH):
            try:
                with open(READER_ESCALATION_PATH) as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def _save_escalations(self, escalations):
        """Write escalations to disk."""
        os.makedirs(os.path.dirname(READER_ESCALATION_PATH), exist_ok=True)
        with open(READER_ESCALATION_PATH, "w") as f:
            json.dump(escalations, f, indent=2)

    def _maybe_escalate(self, reason_type, message, context=None):
        """Write an escalation if rate-limited (max 1/hour per identifier)."""
        escalations = self._load_escalations()
        ctx = context or {}
        identifier = ctx.get("identifier", "")

        # Per-issue cooldown: check for recent unresolved escalation with same identifier
        for esc in reversed(escalations):
            if not esc.get("resolved"):
                esc_ident = esc.get("context", {}).get("identifier", "")
                # Match on identifier if both have one, otherwise match on type
                same_issue = (identifier and esc_ident == identifier) or (not identifier and esc.get("type") == reason_type)
                if same_issue:
                    try:
                        last_time = datetime.fromisoformat(esc["time"])
                        hours_since = (datetime.now() - last_time).total_seconds() / 3600
                        if hours_since < ESCALATION_COOLDOWN_HOURS:
                            return  # Too soon for this issue
                    except Exception:
                        pass
                    break  # Only check the most recent matching escalation

        escalation = {
            "time": datetime.now().isoformat(),
            "type": reason_type,
            "message": message,
            "context": ctx,
            "resolved": False,
        }
        escalations.append(escalation)
        self._save_escalations(escalations)
        self.log(f"Escalated to Editor: {message}", level="WARN")

    # ── Re-Extraction Queue ─────────────────────────────────

    def _load_reextract_queue(self):
        """Load the re-extraction queue (with shared lock — Editor also writes this)."""
        return read_json_locked(REEXTRACT_QUEUE_PATH, default=[])

    def _save_reextract_queue(self, queue):
        """Persist re-extraction queue (with exclusive lock)."""
        update_json_locked(REEXTRACT_QUEUE_PATH, lambda _: queue, default=[])

    def _get_next_reextraction(self):
        """Return the first pending re-extraction item, or None."""
        queue = self._load_reextract_queue()
        for item in queue:
            if item.get("status") == "pending":
                return item
        return None

    def _mark_reextraction_done(self, identifier, success, notes=""):
        """Mark a re-extraction item as completed or failed."""
        queue = self._load_reextract_queue()
        for item in queue:
            if item.get("identifier") == identifier and item.get("status") == "pending":
                item["status"] = "completed" if success else "failed"
                item["completed_time"] = datetime.now().isoformat()
                item["notes"] = notes
                break
        self._save_reextract_queue(queue)

    async def _run_reextraction(self, reextract_item):
        """Backup old extraction JSON and re-extract with specified strategy."""
        identifier = reextract_item["identifier"]
        strategy = reextract_item.get("strategy", "wider_scan")

        # Find the issue in Supabase
        issue = get_issue_by_identifier(identifier)

        if not issue:
            self.log(f"Re-extraction: issue {identifier} not found in Supabase", level="ERROR")
            self._mark_reextraction_done(identifier, False, "not found in Supabase")
            return None

        # Backup old extraction JSON (don't delete — rename to .backup)
        old_path = os.path.join(EXTRACTIONS_DIR, f"{identifier}.json")
        backup_path = os.path.join(EXTRACTIONS_DIR, f"{identifier}.json.backup")
        if os.path.exists(old_path):
            shutil.copy2(old_path, backup_path)
            os.remove(old_path)
            self.log(f"Backed up old extraction: {identifier}.json → .backup")

        # Run re-extraction with strategy
        self._current_task = f"Re-extracting ({strategy}): {issue.get('title', identifier)}"
        self.log(f"Re-extracting {identifier} with strategy: {strategy}")

        from extract_features import process_issue_reextract
        try:
            output_path = await asyncio.to_thread(process_issue_reextract, issue, strategy)
        except Exception as e:
            self.log(f"Re-extraction crashed for {identifier}: {e}", level="ERROR")
            self._mark_reextraction_done(identifier, False, f"Crashed: {e}")
            # Restore backup if it exists
            if os.path.exists(backup_path):
                shutil.copy2(backup_path, old_path)
                self.log(f"Restored backup for {identifier}")
            return None

        # If re-extraction failed and we have a backup, restore it
        if not output_path and os.path.exists(backup_path):
            shutil.copy2(backup_path, old_path)
            self.log(f"Re-extraction failed, restored backup for {identifier}")

        return output_path

    # ── Supabase Loading (with retry tracking) ──────────────

    async def _load_into_supabase(self, output_path, identifier, reader_log):
        """Load extraction into Supabase with failure tracking.

        Returns True if loaded successfully, False if failed.
        On failure, tracks load_failures and escalates after threshold.
        """
        try:
            from load_features import load_extraction
            inserted = await asyncio.to_thread(load_extraction, output_path)
            self.log(f"Loaded {inserted} features into Supabase for {identifier}")
            reader_log["issues_loaded"] = reader_log.get("issues_loaded", 0) + 1
            # Clear any load failure tracking
            reader_log.get("load_failures", {}).pop(identifier, None)
            return True
        except Exception as e:
            self.log(f"Failed to load into Supabase: {e}", level="ERROR")
            self._record_load_failure(reader_log, identifier, str(e))

            # Check if load has failed too many times
            load_entry = reader_log.get("load_failures", {}).get(identifier, {})
            if load_entry.get("failures", 0) >= MAX_LOAD_FAILURES:
                self._maybe_escalate(
                    "supabase_load_failed",
                    f"Supabase load for {identifier} has failed {load_entry['failures']} times. "
                    f"Last error: {str(e)[:100]}. Database may be unreachable.",
                    {"identifier": identifier, "failures": load_entry["failures"]},
                )
            return False

    # ── Issue Selection (with infinite loop fix) ─────────────

    def _find_next_issue(self, reader_log):
        """Find the next downloaded issue that hasn't been extracted.

        Skips issues that have failed MAX_ISSUE_FAILURES times.
        """
        issue_failures = reader_log.get("issue_failures", {})
        issues = list_issues(status="downloaded")

        for issue in issues:
            identifier = issue["identifier"]

            # Skip issues that have exceeded failure threshold
            entry = issue_failures.get(identifier, {})
            if entry.get("failures", 0) >= MAX_ISSUE_FAILURES:
                continue

            output_path = os.path.join(EXTRACTIONS_DIR, f"{identifier}.json")
            if not os.path.exists(output_path):
                return issue
        return None

    def _find_issues_needing_load(self, reader_log):
        """Find extracted issues that haven't been loaded into Supabase yet.

        These are issues with extraction JSON on disk but status still 'downloaded'
        (not yet 'extracted'). Skips issues with too many load failures.
        """
        load_failures = reader_log.get("load_failures", {})
        issues = list_issues(status="downloaded")

        for issue in issues:
            identifier = issue["identifier"]

            # Skip if too many load failures
            entry = load_failures.get(identifier, {})
            if entry.get("failures", 0) >= MAX_LOAD_FAILURES:
                continue

            # Check if extraction JSON exists (extraction done, load pending)
            output_path = os.path.join(EXTRACTIONS_DIR, f"{identifier}.json")
            if os.path.exists(output_path):
                return issue, output_path
        return None, None

    # ── Main Work Loop ──────────────────────────────────────

    async def work(self):
        self.load_skills()

        # Load state
        reader_log = self._load_reader_log()
        reader_log["cycle_count"] = reader_log.get("cycle_count", 0) + 1
        reader_log["last_run"] = datetime.now().isoformat()

        # ── Priority 1: Re-extraction queue ─────────────────
        reextract_item = self._get_next_reextraction()
        if reextract_item:
            identifier = reextract_item["identifier"]
            strategy = reextract_item.get("strategy", "wider_scan")
            self.log(f"Processing re-extraction: {identifier} ({strategy})")

            output_path = await self._run_reextraction(reextract_item)

            if output_path:
                verdict, metrics = self._assess_quality(output_path, identifier)
                self.log(f"Re-extraction quality: {verdict} — {metrics}")

                if verdict == "load":
                    self._current_task = f"Loading re-extraction: {identifier}"
                    loaded = await self._load_into_supabase(output_path, identifier, reader_log)

                    if loaded:
                        self._mark_reextraction_done(identifier, True, f"Loaded {metrics.get('feature_count', 0)} features")
                        self._record_issue_success(reader_log, identifier)
                        # Remove from held list if present
                        held = reader_log.get("issues_held", [])
                        if identifier in held:
                            held.remove(identifier)
                        update_issue(identifier, {"status": "extracted"})
                    else:
                        self._mark_reextraction_done(identifier, False, "Supabase load failed")
                else:
                    # Still bad — re-escalate
                    esc_type = metrics.get("escalation_type", "unknown")
                    self._mark_reextraction_done(identifier, False, f"Still {esc_type}: {metrics}")
                    self._maybe_escalate(
                        f"reextraction_{esc_type}",
                        f"Re-extraction of {identifier} with {strategy} still failed QC: "
                        f"{metrics.get('feature_count', 0)} features, "
                        f"{metrics.get('null_homeowner_rate', 1.0):.0%} null rate. "
                        f"May need more aggressive strategy or manual review.",
                        {"identifier": identifier, "strategy": strategy, "metrics": metrics},
                    )

            else:
                self._mark_reextraction_done(identifier, False, "process_issue_reextract returned None")
                self._record_issue_failure(reader_log, identifier, "reextraction returned None")

            self._save_reader_log(reader_log)
            self._update_counts()
            return True

        # ── Priority 2: Retry Supabase loads for extracted-but-not-loaded issues
        retry_issue, retry_path = self._find_issues_needing_load(reader_log)
        if retry_issue:
            identifier = retry_issue["identifier"]
            self._current_task = f"Retrying Supabase load: {identifier}"
            self.log(f"Retrying Supabase load for {identifier}")

            # Quality-check first (the extraction may have been held previously)
            verdict, metrics = self._assess_quality(retry_path, identifier)
            if verdict == "load":
                loaded = await self._load_into_supabase(retry_path, identifier, reader_log)
                if loaded:
                    self._record_issue_success(reader_log, identifier)
                    held = reader_log.get("issues_held", [])
                    if identifier in held:
                        held.remove(identifier)
                    update_issue(identifier, {"status": "extracted"})

            self._save_reader_log(reader_log)
            self._update_counts()
            return True

        # ── Priority 3: Normal extraction ───────────────────
        issue = self._find_next_issue(reader_log)
        if not issue:
            # Check for issues that hit the failure threshold this cycle
            self._check_for_exhausted_issues(reader_log)
            self._save_reader_log(reader_log)
            self._current_task = f"All {self._extracted_count} issues extracted"
            return False

        identifier = issue["identifier"]
        title = issue.get("title", identifier)
        self._current_task = f"Extracting: {title}"
        self.log(f"Starting extraction: {identifier}")

        # Run extraction in thread (blocking, takes minutes)
        from extract_features import process_issue
        try:
            output_path = await asyncio.to_thread(process_issue, issue)
        except Exception as e:
            output_path = None
            self.log(f"Extraction crashed for {identifier}: {e}", level="ERROR")

        if not output_path:
            # Extraction returned None — record failure
            self._record_issue_failure(reader_log, identifier, "process_issue returned None")
            self.log(f"Extraction returned None for {identifier}", level="WARN")

            # Check if this issue has exhausted its retries
            failures = reader_log.get("issue_failures", {}).get(identifier, {})
            if failures.get("failures", 0) >= MAX_ISSUE_FAILURES:
                update_issue(identifier, {"status": "extraction_error"})
                self._maybe_escalate(
                    "extraction_failed",
                    f"Issue {identifier} failed extraction {failures['failures']} times. "
                    f"Marking as extraction_error. Last error: process_issue returned None.",
                    {"identifier": identifier, "failures": failures["failures"]},
                )

            # Check consecutive failure threshold
            if reader_log.get("consecutive_failures", 0) >= CONSECUTIVE_FAILURE_THRESHOLD:
                self._maybe_escalate(
                    "extraction_stuck",
                    f"Reader has failed {reader_log['consecutive_failures']} extractions in a row "
                    f"across different issues. Extraction pipeline may be stuck.",
                    {"consecutive_failures": reader_log["consecutive_failures"]},
                )
        else:
            # Extraction succeeded — assess quality
            verdict, metrics = self._assess_quality(output_path, identifier)
            self.log(f"Quality assessment: {verdict} — {metrics}")

            if verdict == "load":
                # Good extraction — load into Supabase
                self._current_task = f"Loading into database: {title}"
                loaded = await self._load_into_supabase(output_path, identifier, reader_log)

                if loaded:
                    self._record_issue_success(reader_log, identifier)
                    update_issue(identifier, {"status": "extracted"})
                else:
                    # Supabase failed but extraction is good — don't mark as success
                    # Next cycle will retry via _find_issues_needing_load
                    reader_log["consecutive_failures"] = 0  # Not an extraction failure
            else:
                # Bad extraction — hold and escalate
                esc_type = metrics.get("escalation_type", "unknown")
                self.log(f"HELD {identifier}: {esc_type} ({metrics})", level="WARN")

                held = reader_log.setdefault("issues_held", [])
                if identifier not in held:
                    held.append(identifier)

                self._maybe_escalate(
                    esc_type,
                    f"Extraction of {identifier} held: {esc_type}. "
                    f"{metrics.get('feature_count', 0)} features, "
                    f"{metrics.get('null_homeowner_rate', 1.0):.0%} null rate, "
                    f"{metrics.get('avg_fields_filled', 0):.1f}/6 avg fields.",
                    {"identifier": identifier, "metrics": metrics},
                )

                # Reset consecutive failures — this was a quality hold, not a crash
                reader_log["consecutive_failures"] = 0

        # Save reader log
        self._save_reader_log(reader_log)
        self._update_counts()
        return True

    def _check_for_exhausted_issues(self, reader_log):
        """Mark issues that have hit MAX_ISSUE_FAILURES as extraction_error."""
        issue_failures = reader_log.get("issue_failures", {})
        for ident, entry in issue_failures.items():
            if entry.get("failures", 0) >= MAX_ISSUE_FAILURES:
                update_issue(ident, {"status": "extraction_error"})
                self.log(f"Marking {ident} as extraction_error after {entry['failures']} failures")

    # ── Counts ──────────────────────────────────────────────

    def _update_counts(self):
        """Refresh extracted/features counts from disk."""
        if not os.path.exists(EXTRACTIONS_DIR):
            return
        extracted = 0
        features = 0
        for fname in os.listdir(EXTRACTIONS_DIR):
            if not fname.endswith(".json"):
                continue
            try:
                with open(os.path.join(EXTRACTIONS_DIR, fname)) as f:
                    data = json.load(f)
                if not data.get("skipped"):
                    extracted += 1
                    features += len(data.get("features", []))
            except Exception:
                pass
        self._extracted_count = extracted
        self._features_count = features

    def get_progress(self):
        try:
            from db import count_issues_by_status
            counts = count_issues_by_status()
            downloaded = counts["downloaded"] + counts["extracted"]
            self._update_counts()
            return {"current": self._extracted_count, "total": downloaded}
        except Exception:
            pass
        return {"current": 0, "total": 0}
