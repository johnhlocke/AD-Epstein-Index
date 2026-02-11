"""
Courier Agent — downloads AD magazine PDFs from archive.org and the AD Archive.

Hub-and-spoke model: Editor assigns download_pdf tasks via inbox.
When no task is assigned, falls back to legacy work() loop.

Two download strategies:
1. archive.org (Primary) — simple HTTP downloads, free, no auth
2. AD Archive (Secondary) — Playwright browser login + 20-page batched downloads

Interval: 5s — checks for new work frequently, actual downloads take 5-30s.
"""

import asyncio
import json
import os
import subprocess
import sys
import time
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agents.base import Agent, DATA_DIR, BASE_DIR
from agents.tasks import TaskResult
from db import list_issues, update_issue, count_issues_by_status

ISSUES_DIR = os.path.join(DATA_DIR, "issues")
BATCHES_DIR = os.path.join(ISSUES_DIR, "batches")
METADATA_URL = "https://archive.org/metadata/{identifier}/files"
DOWNLOAD_URL = "https://archive.org/download/{identifier}/{filename}"
DELAY_SECONDS = 2

AD_ARCHIVE_BATCH_SIZE = 20
AD_ARCHIVE_BLOB_BASE = "https://architecturaldigest.blob.core.windows.net/architecturaldigest{date}thumbnails/Pages/0x600/{page}.jpg"
AD_ARCHIVE_MAX_PAGES_PER_ARTICLE = 3  # First 3 pages capture article opening

# Failure tracking & escalation
COURIER_LOG_PATH = os.path.join(DATA_DIR, "courier_log.json")
COURIER_ESCALATION_PATH = os.path.join(DATA_DIR, "courier_escalations.json")
MAX_ISSUE_FAILURES = 3          # After 3 failures on same issue, escalate
IDLE_ESCALATION_THRESHOLD = 5   # After 5 idle cycles with remaining work, escalate
ESCALATION_COOLDOWN_HOURS = 1   # Max 1 escalation per hour

# Tools for AD Archive downloads (Playwright browser + file management)
AD_ARCHIVE_TOOLS = [
    "Read",
    "Bash",
    "mcp__playwright__*",
]


class CourierAgent(Agent):
    def __init__(self):
        super().__init__("courier", interval=5)

    # ═══════════════════════════════════════════════════════════
    # HUB-AND-SPOKE: execute() — called when Editor assigns a task
    # ═══════════════════════════════════════════════════════════

    async def execute(self, task):
        """Execute a download or scrape task from the Editor. Returns a TaskResult."""
        if task.type == "scrape_features":
            return await self._scrape_ad_archive(task)

        if task.type != "download_pdf":
            return TaskResult(
                task_id=task.id, task_type=task.type, status="failure",
                result={}, error=f"Courier doesn't handle '{task.type}'",
                agent=self.name,
            )

        identifier = task.params.get("identifier", "")
        source = task.params.get("source", "archive.org")
        year = task.params.get("year")
        month = task.params.get("month")

        if not identifier:
            return TaskResult(
                task_id=task.id, task_type=task.type, status="failure",
                result={"identifier": identifier}, error="No identifier provided",
                agent=self.name,
            )

        month_str = f"{month:02d}" if month else "??"
        self._current_task = f"Downloading {year}-{month_str}..."

        # Log briefing if present
        briefing = getattr(task, 'briefing', '')
        if briefing:
            self.log(f"Briefing: {briefing[:120]}")

        # Build a minimal issue dict for existing download logic
        issue = {
            "identifier": identifier,
            "title": task.params.get("title", identifier),
            "year": year,
            "month": month,
            "source": source,
            "source_url": task.params.get("source_url"),
        }

        try:
            if source == "ad_archive":
                success = await self._download_ad_archive_batch(issue)
            else:
                success = await self._download_archive_org(issue)

            if success and issue.get("pdf_path"):
                # Post what download pattern succeeded
                try:
                    self._post_task_learning(
                        "download_pdf",
                        f"Downloaded {identifier[:30]} from {source}. "
                        f"Year: {year}, month: {month_str}."
                    )
                except Exception:
                    pass
                return TaskResult(
                    task_id=task.id, task_type=task.type, status="success",
                    result={
                        "identifier": identifier,
                        "pdf_path": issue["pdf_path"],
                        "pages": issue.get("pages", 0),
                    },
                    agent=self.name,
                )
            elif issue.get("status") == "no_pdf":
                # Diagnose why no PDF was found
                decision = await asyncio.to_thread(
                    self.problem_solve,
                    error="No PDF file found in archive.org metadata",
                    context={"identifier": identifier, "source": source, "year": year, "month": month},
                    strategies={
                        "try_ad_archive": "Try official AD Archive as alternative source",
                        "check_identifier": "Identifier may be wrong — suggest Scout re-search",
                        "accept_missing": "This issue may not have been digitized yet",
                        "escalate": "Needs manual investigation",
                    },
                )
                self.log(f"No PDF: {decision.get('diagnosis', '?')} → {decision.get('strategy', '?')}")
                return TaskResult(
                    task_id=task.id, task_type=task.type, status="failure",
                    result={"identifier": identifier, "recommended_strategy": decision.get("strategy")},
                    error=f"No PDF found. Diagnosis: {decision.get('diagnosis', 'unknown')}",
                    agent=self.name,
                )
            else:
                return TaskResult(
                    task_id=task.id, task_type=task.type, status="failure",
                    result={"identifier": identifier},
                    error="Download returned no PDF path",
                    agent=self.name,
                )
        except Exception as e:
            return TaskResult(
                task_id=task.id, task_type=task.type, status="failure",
                result={"identifier": identifier},
                error=str(e),
                agent=self.name,
            )

    # ── Failure Tracking ──────────────────────────────────────

    def _load_courier_log(self):
        """Load persistent failure tracking from disk."""
        if os.path.exists(COURIER_LOG_PATH):
            try:
                with open(COURIER_LOG_PATH) as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "cycle_count": 0,
            "last_run": None,
            "issue_failures": {},
            "consecutive_idle_cycles": 0,
        }

    def _save_courier_log(self, log):
        """Persist failure tracking to disk."""
        os.makedirs(os.path.dirname(COURIER_LOG_PATH), exist_ok=True)
        with open(COURIER_LOG_PATH, "w") as f:
            json.dump(log, f, indent=2)

    def _record_issue_failure(self, log, identifier, error_msg):
        """Increment failure count for an issue."""
        failures = log.setdefault("issue_failures", {})
        entry = failures.get(identifier, {"failures": 0})
        entry["failures"] = entry.get("failures", 0) + 1
        entry["last_error"] = str(error_msg)[:200]
        entry["last_attempt"] = datetime.now().isoformat()
        failures[identifier] = entry

    def _record_issue_success(self, log, identifier):
        """Clear failure tracking for a successfully downloaded issue."""
        log.get("issue_failures", {}).pop(identifier, None)

    # ── Escalation I/O ────────────────────────────────────────

    def _load_escalations(self):
        """Load existing escalations from disk."""
        if os.path.exists(COURIER_ESCALATION_PATH):
            try:
                with open(COURIER_ESCALATION_PATH) as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def _save_escalations(self, escalations):
        """Write escalations to disk."""
        os.makedirs(os.path.dirname(COURIER_ESCALATION_PATH), exist_ok=True)
        with open(COURIER_ESCALATION_PATH, "w") as f:
            json.dump(escalations, f, indent=2)

    def _maybe_escalate(self, reason_type, message, context=None):
        """Write an escalation if warranted and rate-limited (max 1/hour per identifier)."""
        escalations = self._load_escalations()
        ctx = context or {}
        identifier = ctx.get("identifier", "")

        # Per-issue cooldown: check for recent unresolved escalation with same identifier
        for esc in reversed(escalations):
            if not esc.get("resolved"):
                esc_ident = esc.get("context", {}).get("identifier", "")
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
            "context": context or {},
            "resolved": False,
        }
        escalations.append(escalation)
        self._save_escalations(escalations)
        self.log(f"Escalated to Editor: {message}", level="WARN")

    # ── Issue Selection ───────────────────────────────────────

    def _find_next_archive_org_issue(self):
        """Find the next archive.org issue that needs downloading."""
        issues = list_issues(status="discovered")
        # Filter to archive.org source with month/year
        downloadable = [
            i for i in issues
            if i.get("month") and i.get("year")
            and i.get("source", "archive.org") != "ad_archive"
        ]
        # Newest first (list_issues already sorts desc, but be explicit)
        downloadable.sort(key=lambda x: (x["year"], x["month"]), reverse=True)
        for issue in downloadable:
            identifier = issue["identifier"]
            m = issue['month']
            filename_base = f"{issue['year']}_{m:02d}_{identifier}" if isinstance(m, int) else f"{issue['year']}_XX_{identifier}"
            if os.path.exists(ISSUES_DIR):
                existing = [f for f in os.listdir(ISSUES_DIR) if f.startswith(filename_base)]
                if existing:
                    pdf_path = os.path.join(ISSUES_DIR, existing[0])
                    # Reconcile: already on disk, mark as downloaded in Supabase
                    update_issue(identifier, {"status": "downloaded", "pdf_path": pdf_path})
                    continue
            return issue
        return None

    def _find_next_ad_archive_issue(self):
        """Find the next AD Archive issue — prioritize partial downloads, then new ones."""
        all_issues = list_issues(source="ad_archive")

        # First: resume partial downloads (batches already started)
        for issue in all_issues:
            progress = issue.get("ad_archive_progress")
            if progress and progress.get("batches_downloaded"):
                total = progress.get("total_pages")
                if total:
                    max_downloaded = max(end for _, end in progress["batches_downloaded"])
                    if max_downloaded < total:
                        return issue

        # Then: start new AD Archive issues
        for issue in all_issues:
            if (issue.get("month") and issue.get("year")
                    and issue.get("status") not in ("downloaded", "error", "skipped_pre1988", "extracted", "extraction_error")):
                identifier = issue["identifier"]
                filename_base = f"{issue['year']}_{issue['month']:02d}"
                if os.path.exists(ISSUES_DIR):
                    existing = [f for f in os.listdir(ISSUES_DIR) if f.startswith(filename_base)]
                    if existing:
                        update_issue(identifier, {"status": "downloaded", "pdf_path": os.path.join(ISSUES_DIR, existing[0])})
                        continue
                if not issue.get("ad_archive_progress"):
                    return issue

        return None

    # ── Main Work Loop ────────────────────────────────────────

    async def work(self):
        # If the Editor is managing us (sent a task recently), defer to inbox tasks
        # instead of independently finding downloads. This prevents double-downloading.
        if self._last_task_time and (time.time() - self._last_task_time) < 300:
            self._current_task = "Waiting for Editor assignment"
            return False

        self.load_skills()

        courier_log = self._load_courier_log()
        courier_log["cycle_count"] = courier_log.get("cycle_count", 0) + 1
        courier_log["last_run"] = datetime.now().isoformat()

        # Priority 1: archive.org downloads (simple HTTP, no auth)
        issue = self._find_next_archive_org_issue()
        if issue:
            courier_log["consecutive_idle_cycles"] = 0
            self._save_courier_log(courier_log)

            # Recall past download issues for this identifier
            try:
                past = self.recall_episodes(
                    f"download {issue['identifier']} archive.org PDF",
                    task_type="download_pdf", n=2,
                )
                if past:
                    self.log(f"Memory: {len(past)} past download episodes recalled")
            except Exception:
                pass

            # Narrate the download start
            try:
                m = issue.get('month')
                m_str = f"{m:02d}" if isinstance(m, int) else "??"
                self.narrate(f"Downloading {issue.get('year', '?')}-{m_str} from archive.org: {issue['identifier'][:40]}")
            except Exception:
                pass

            success = await self._download_archive_org(issue, courier_log)

            # Commit episode based on result
            try:
                status = issue.get("status", "unknown")
                ep_m = issue.get('month')
                ep_m_str = f"{ep_m:02d}" if isinstance(ep_m, int) else "??"
                if status == "downloaded":
                    self.commit_episode(
                        "download_pdf",
                        f"Downloaded {issue['identifier'][:40]} ({issue.get('year', '?')}-{ep_m_str}) from archive.org",
                        "success",
                        {"identifier": issue["identifier"], "year": issue.get("year"), "month": issue.get("month")},
                    )
                elif status in ("no_pdf", "error"):
                    self.commit_episode(
                        "download_pdf",
                        f"Download FAILED for {issue['identifier'][:40]}: {status}",
                        "failure",
                        {"identifier": issue["identifier"], "status": status},
                    )
            except Exception:
                pass

            return success

        # Priority 2: AD Archive downloads (Playwright, batched, needs auth)
        issue = self._find_next_ad_archive_issue()
        if issue:
            courier_log["consecutive_idle_cycles"] = 0
            self._save_courier_log(courier_log)
            return await self._download_ad_archive_batch(issue, courier_log)

        # Idle — check if there are stuck issues we can't process
        counts = count_issues_by_status() or {}
        stuck_count = counts.get("error", 0) + counts.get("no_pdf", 0)
        if stuck_count > 0:
            courier_log["consecutive_idle_cycles"] = courier_log.get("consecutive_idle_cycles", 0) + 1
            if courier_log["consecutive_idle_cycles"] >= IDLE_ESCALATION_THRESHOLD:
                self._maybe_escalate(
                    "idle_with_errors",
                    f"Courier idle for {courier_log['consecutive_idle_cycles']} cycles but "
                    f"{stuck_count} issues are stuck in error/no_pdf state. "
                    f"May need: retry strategy, alternative sources, or manual download.",
                    {"idle_cycles": courier_log["consecutive_idle_cycles"], "stuck_issues": stuck_count},
                )
                # Post bulletin about stuck downloads
                try:
                    self.post_bulletin(
                        f"Courier idle with {stuck_count} stuck downloads (error/no_pdf). Need alternative sources.",
                        tags=["download", "stuck", "needs_help"],
                    )
                except Exception:
                    pass
        else:
            courier_log["consecutive_idle_cycles"] = 0

        self._save_courier_log(courier_log)
        self._current_task = "All available issues downloaded"
        return False

    # ── archive.org Downloads (existing logic) ────────────────

    async def _download_archive_org(self, issue, courier_log=None):
        """Download one issue from archive.org via HTTP."""
        identifier = issue["identifier"]
        title = issue.get("title", identifier)
        self._current_task = f"Downloading: {title}"
        self.log(f"Downloading from archive.org: {identifier}")

        try:
            success = await asyncio.to_thread(self._download_one_http, issue)
            if success:
                self.log(f"Downloaded: {identifier}")
                self._current_task = f"Downloaded: {title}"
                if courier_log:
                    self._record_issue_success(courier_log, identifier)
                    self._save_courier_log(courier_log)
            else:
                self.log(f"No PDF found for {identifier}", level="WARN")
                if courier_log:
                    self._record_issue_failure(courier_log, identifier, "no_pdf")
                    self._save_courier_log(courier_log)
        except Exception as e:
            issue["status"] = "error"
            self.log(f"Download failed for {identifier}: {e}", level="ERROR")
            if courier_log:
                self._record_issue_failure(courier_log, identifier, str(e))
                self._save_courier_log(courier_log)
                # Diagnose the failure and decide recovery
                failures = courier_log.get("issue_failures", {}).get(identifier, {})
                failure_count = failures.get("failures", 0)
                decision = await asyncio.to_thread(
                    self.problem_solve,
                    error=str(e)[:200],
                    context={
                        "identifier": identifier,
                        "source": issue.get("source", "archive.org"),
                        "year": issue.get("year"),
                        "failure_count": failure_count,
                    },
                    strategies={
                        "retry_next_cycle": "Transient network error — will retry automatically next cycle",
                        "try_ad_archive": "archive.org may not have it — try official AD Archive instead",
                        "mark_unavailable": "This issue genuinely doesn't exist or is permanently broken",
                        "escalate": "Report to Editor — needs human intervention",
                    },
                )
                self.log(f"Problem solve: {decision.get('diagnosis', '?')} → {decision.get('strategy', '?')}")
                if decision.get("strategy") == "escalate" or failure_count >= MAX_ISSUE_FAILURES:
                    esc_month = f"{issue.get('month'):02d}" if issue.get('month') else "??"
                    self._maybe_escalate(
                        "download_failure",
                        f"Issue {identifier} ({issue.get('year')}-{esc_month}) "
                        f"failed {failure_count} times. "
                        f"Diagnosis: {decision.get('diagnosis', str(e)[:100])}",
                        {"identifier": identifier, "failures": failure_count, "last_error": str(e)[:200],
                         "recommended_strategy": decision.get("strategy", "unknown")},
                    )

        # Save the issue's updated status to Supabase
        updates = {"status": issue.get("status", "discovered")}
        if issue.get("pdf_path"):
            updates["pdf_path"] = issue["pdf_path"]
        update_issue(identifier, updates)
        return bool(issue.get("pdf_path"))

    def _download_one_http(self, issue):
        """Download a single issue's PDF via HTTP. Runs in a thread."""
        import requests

        HEADERS = {"User-Agent": "AD-Epstein-Index-Research/1.0 (academic research project)"}
        identifier = issue["identifier"]
        os.makedirs(ISSUES_DIR, exist_ok=True)

        meta_url = METADATA_URL.format(identifier=identifier)
        meta_resp = requests.get(meta_url, headers=HEADERS)
        meta_resp.raise_for_status()
        files = meta_resp.json().get("result", [])

        from archive_download import find_pdf_file
        pdf_name = find_pdf_file(files)
        if not pdf_name:
            issue["status"] = "no_pdf"
            return False

        dl_url = DOWNLOAD_URL.format(identifier=identifier, filename=pdf_name)
        ext = os.path.splitext(pdf_name)[1] or ".pdf"
        m = issue['month']
        m_str = f"{m:02d}" if isinstance(m, int) else "00"
        filename_base = f"{issue['year']}_{m_str}_{identifier}"
        dest = os.path.join(ISSUES_DIR, f"{filename_base}{ext}")

        from archive_download import download_file
        download_file(dl_url, dest)

        issue["status"] = "downloaded"
        issue["pdf_path"] = dest

        time.sleep(DELAY_SECONDS)
        return True

    # ── AD Archive Downloads (Playwright + LLM) ──────────────

    async def _download_ad_archive_batch(self, issue, courier_log=None):
        """Download one 20-page batch from the AD Archive via Playwright."""
        from dotenv import load_dotenv
        load_dotenv(os.path.join(BASE_DIR, ".env"))

        email = os.environ.get("AD_ARCHIVE_EMAIL")
        password = os.environ.get("AD_ARCHIVE_PASSWORD")

        if not email or not password or email == "your-email-here":
            self._current_task = "AD Archive: set AD_ARCHIVE_EMAIL/PASSWORD in .env"
            self.log("AD Archive credentials not configured in .env", level="WARN")
            self._maybe_escalate(
                "credentials_missing",
                "AD Archive credentials not configured. Set AD_ARCHIVE_EMAIL and "
                "AD_ARCHIVE_PASSWORD in .env to enable AD Archive downloads.",
            )
            return False

        identifier = issue["identifier"]
        year = issue["year"]
        month = issue["month"]
        url = (issue.get("source_url")
               or f"https://archive.architecturaldigest.com/issue/{year}{month:02d}01")

        # Get or initialize progress
        progress = issue.get("ad_archive_progress", {})
        batches_done = progress.get("batches_downloaded", [])
        total_pages = progress.get("total_pages")

        # Determine which pages to download next
        if batches_done:
            last_end = max(end for _, end in batches_done)
            start_page = last_end + 1
        else:
            start_page = 1
        end_page = start_page + AD_ARCHIVE_BATCH_SIZE - 1

        # If we know total pages and we're past it, combine
        if total_pages and start_page > total_pages:
            return await self._combine_and_finalize(issue)

        # Cap end_page at total if known
        if total_pages and end_page > total_pages:
            end_page = total_pages

        # Create batch directory
        batch_dir = os.path.join(BATCHES_DIR, identifier)
        os.makedirs(batch_dir, exist_ok=True)

        batch_filename = f"batch_{start_page:03d}_{end_page:03d}.pdf"
        batch_path = os.path.join(batch_dir, batch_filename)

        self._current_task = f"AD Archive: {year}-{month:02d} pp.{start_page}-{end_page}"
        self.log(f"AD Archive batch: {identifier} pages {start_page}-{end_page}")

        # Build prompt and call Claude CLI + Playwright
        prompt = self._build_ad_archive_prompt(
            email, password, url, start_page, end_page, batch_path, total_pages
        )
        result = await asyncio.to_thread(self._call_claude, prompt)

        if not result:
            self._current_task = f"AD Archive batch failed: {identifier}"
            if courier_log:
                self._record_issue_failure(courier_log, identifier, "no response from Claude CLI")
                self._save_courier_log(courier_log)
                failures = courier_log.get("issue_failures", {}).get(identifier, {})
                if failures.get("failures", 0) >= MAX_ISSUE_FAILURES:
                    self._maybe_escalate(
                        "download_failure",
                        f"Issue {identifier} ({year}-{month:02d}) has failed download "
                        f"{failures['failures']} times. Last error: no response from Claude CLI. "
                        f"May need manual intervention or alternative source.",
                        {"identifier": identifier, "failures": failures["failures"]},
                    )
            return False

        # Parse result
        findings = self._parse_result_json(result)

        if findings and findings.get("downloaded"):
            # Update total pages if discovered
            if findings.get("total_pages"):
                progress["total_pages"] = findings["total_pages"]
                total_pages = findings["total_pages"]

            actual_start = findings.get("start_page", start_page)
            actual_end = findings.get("end_page", end_page)
            batches_done.append([actual_start, actual_end])
            progress["batches_downloaded"] = batches_done
            progress["batch_dir"] = batch_dir
            issue["ad_archive_progress"] = progress
            issue["status"] = "downloading"

            # Record success — clear failure count
            if courier_log:
                self._record_issue_success(courier_log, identifier)
                self._save_courier_log(courier_log)

            # Check if all batches are now done
            if total_pages:
                max_page = max(end for _, end in batches_done)
                if max_page >= total_pages:
                    self.log(f"All batches done for {identifier} — combining")
                    return await self._combine_and_finalize(issue)

            update_issue(identifier, {
                "status": "downloading",
                "ad_archive_progress": progress,
            })
            self._current_task = f"AD Archive batch done: pp.{actual_start}-{actual_end}"
            self.log(f"Batch saved: {identifier} pages {actual_start}-{actual_end}")
            return True

        # Download failed or unclear result
        notes = findings.get("notes", "unknown error") if findings else "no response"
        self.log(f"AD Archive batch failed: {notes}", level="WARN")
        if courier_log:
            self._record_issue_failure(courier_log, identifier, notes)
            self._save_courier_log(courier_log)
            failures = courier_log.get("issue_failures", {}).get(identifier, {})
            if failures.get("failures", 0) >= MAX_ISSUE_FAILURES:
                self._maybe_escalate(
                    "download_failure",
                    f"Issue {identifier} ({year}-{month:02d}) has failed download "
                    f"{failures['failures']} times. Last error: {notes[:100]}. "
                    f"May need manual intervention or alternative source.",
                    {"identifier": identifier, "failures": failures["failures"], "last_error": notes[:200]},
                )
        # No issue status changes on failure — no DB update needed
        return False

    def _build_ad_archive_prompt(self, email, password, url, start_page, end_page, save_path, total_pages):
        """Build prompt for Claude CLI to download a batch from AD Archive."""

        total_info = ""
        if total_pages:
            total_info = f"This issue has {total_pages} total pages."
        else:
            total_info = "We don't know the total page count yet — find it on the issue page and report it."

        return f"""You are the Courier agent downloading pages from the Architectural Digest Archive.

TASK: Download pages {start_page} through {end_page} from this issue.

ISSUE URL: {url}
{total_info}

STEPS:
1. Navigate to {url}
2. If prompted to login, use:
   - Email: {email}
   - Password: {password}
3. Find the total number of pages in this issue (look in the page viewer/navigator)
4. Download pages {start_page}-{end_page} using the site's download feature:
   - Look for a "Download" button, "Export PDF" option, or page range selector
   - The site limits downloads to 20 pages at a time
   - Select the page range {start_page} to {end_page}
   - Trigger the download
5. After the download completes, move the file to: {save_path}
   - Check ~/Downloads/ for the most recently downloaded PDF
   - Use: mv ~/Downloads/FILENAME "{save_path}"

TIPS:
- Take a browser_snapshot after each navigation to see the page
- The viewer toolbar usually has download/export options
- If you see a page range input, enter {start_page} and {end_page}
- If there's no range selector, look for print-to-PDF or similar

Respond with ONLY a JSON object:
{{
  "downloaded": true,
  "start_page": {start_page},
  "end_page": {end_page},
  "total_pages": 240,
  "saved_to": "{save_path}",
  "notes": "observations about the download process"
}}

If the download FAILED, respond:
{{
  "downloaded": false,
  "total_pages": 240,
  "notes": "what went wrong"
}}"""

    # ── Claude CLI ────────────────────────────────────────────

    def _call_claude(self, prompt, timeout=300, tools=None):
        """Call Claude Code CLI with optional tool access.

        Args:
            prompt: The prompt to send
            timeout: Timeout in seconds (default 300s / 5 min)
            tools: List of allowed tools. Pass [] for text-only mode.
                   Default (None) uses AD_ARCHIVE_TOOLS.
        """
        allowed = AD_ARCHIVE_TOOLS if tools is None else tools
        cmd = [
            "claude",
            "-p", prompt,
            "--model", "haiku",
            "--no-session-persistence",
            "--output-format", "text",
        ]
        if allowed:
            cmd.extend(["--allowedTools", *allowed])

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=BASE_DIR,
            )

            if result.returncode != 0:
                self.log(f"Claude CLI error: {result.stderr[:200]}", level="ERROR")
                return None

            return result.stdout.strip()

        except subprocess.TimeoutExpired:
            self.log(f"Claude CLI timed out ({timeout}s limit)", level="WARN")
            return None
        except FileNotFoundError:
            self.log("Claude CLI not found", level="ERROR")
            return None
        except Exception as e:
            self.log(f"Claude CLI failed: {e}", level="ERROR")
            return None

    def _parse_result_json(self, result):
        """Extract JSON from Claude's response."""
        if not result:
            return None

        text = result.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]

        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass

        self.log("Could not parse JSON from Claude response", level="WARN")
        return None

    # ── PDF Combining ─────────────────────────────────────────

    async def _combine_and_finalize(self, issue):
        """Combine all PDF batches into a single file using pdfunite."""
        progress = issue.get("ad_archive_progress", {})
        batch_dir = progress.get("batch_dir")

        if not batch_dir or not os.path.isdir(batch_dir):
            self.log(f"Batch directory not found: {batch_dir}", level="ERROR")
            return False

        # Find and sort all batch PDFs
        batch_files = sorted([
            os.path.join(batch_dir, f)
            for f in os.listdir(batch_dir)
            if f.startswith("batch_") and f.endswith(".pdf")
        ])

        if not batch_files:
            self.log("No batch files found to combine", level="ERROR")
            return False

        identifier = issue["identifier"]
        year = issue["year"]
        month = issue["month"]
        dest = os.path.join(ISSUES_DIR, f"{year}_{month:02d}_{identifier}.pdf")
        os.makedirs(ISSUES_DIR, exist_ok=True)

        if len(batch_files) == 1:
            # Single batch — just move it
            import shutil
            shutil.move(batch_files[0], dest)
        else:
            # Multiple batches — combine with pdfunite
            try:
                cmd = ["pdfunite"] + batch_files + [dest]
                result = await asyncio.to_thread(
                    subprocess.run, cmd, capture_output=True, text=True, timeout=120
                )
                if result.returncode != 0:
                    error_msg = result.stderr[:200]
                    self.log(f"pdfunite failed: {error_msg}", level="ERROR")
                    self._maybe_escalate(
                        "combine_failure",
                        f"Failed to combine PDF batches for {identifier}: {error_msg}. "
                        f"Install poppler-utils or investigate corrupted batches.",
                        {"identifier": identifier, "error": error_msg, "batch_count": len(batch_files)},
                    )
                    return False
            except FileNotFoundError:
                self.log("pdfunite not found — install poppler-utils", level="ERROR")
                self._maybe_escalate(
                    "combine_failure",
                    f"Failed to combine PDF batches for {identifier}: pdfunite not found. "
                    f"Install poppler-utils (brew install poppler on macOS).",
                    {"identifier": identifier, "error": "pdfunite not found"},
                )
                return False

        update_issue(identifier, {"status": "downloaded", "pdf_path": dest})

        total = progress.get("total_pages", "?")
        self.log(f"Combined {len(batch_files)} batches → {dest} ({total} pages)")
        self._current_task = f"Combined: {year}-{month:02d} ({len(batch_files)} batches, {total}pp)"
        return True

    # ── AD Archive Direct HTTP Scraping ─────────────────────

    async def _scrape_ad_archive(self, task):
        """Scrape article data from AD Archive via direct HTTP + JWT decoding.

        Phase A (instant): HTTP GET issue page → extract JWT tocConfig → decode featured articles.
        Phase B (one LLM call): Send all article titles + teasers to Claude CLI for batch extraction.
        Produces same extraction JSON format as Reader output.
        """
        identifier = task.params.get("identifier", "")
        year = task.params.get("year")
        month = task.params.get("month")
        source_url = task.params.get("source_url", "")

        if not source_url:
            source_url = f"https://archive.architecturaldigest.com/issue/{year}{month:02d}01"

        month_str = f"{month:02d}" if month else "??"
        self._current_task = f"Scraping AD Archive {year}-{month_str}..."
        self.log(f"Scrape start: {identifier} from {source_url}")

        # Phase A: Fetch TOC via HTTP + JWT (instant, no auth needed)
        try:
            toc_articles = await asyncio.to_thread(self._fetch_issue_toc, source_url)
        except Exception as e:
            return TaskResult(
                task_id=task.id, task_type=task.type, status="failure",
                result={"identifier": identifier},
                error=f"TOC fetch failed: {e}",
                agent=self.name,
            )

        if not toc_articles:
            return TaskResult(
                task_id=task.id, task_type=task.type, status="failure",
                result={"identifier": identifier},
                error="No featured articles found in issue JWT",
                agent=self.name,
            )

        self.log(f"JWT TOC: {len(toc_articles)} featured articles in {year}-{month_str}")

        # Phase B: Try deep scraping with page images from Azure Blob Storage
        date_str = f"{year}{month:02d}01"
        self._current_task = f"Fetching page images for {len(toc_articles)} articles..."
        article_pages = await asyncio.to_thread(
            self._fetch_article_pages, date_str, toc_articles
        )

        if article_pages:
            self.log(f"Fetched page images for {len(article_pages)}/{len(toc_articles)} articles")
            self._current_task = f"Extracting features from page images..."
            features = await asyncio.to_thread(
                self._extract_features_with_images, toc_articles, article_pages, year, month
            )
        else:
            self.log(f"No page images available — falling back to teaser-only extraction")
            self._current_task = f"Extracting features from {len(toc_articles)} articles..."
            features = await asyncio.to_thread(
                self._extract_features_from_toc, toc_articles, year, month
            )

        if not features:
            return TaskResult(
                task_id=task.id, task_type=task.type, status="failure",
                result={"identifier": identifier},
                error="No features extracted from article teasers",
                agent=self.name,
            )

        # Build extraction JSON (same format as Reader output)
        extraction = {
            "identifier": identifier,
            "title": task.params.get("title", f"AD {year}-{month_str}"),
            "year": year,
            "month": month,
            "verified_year": year,
            "verified_month": month,
            "source": "ad_archive_scrape",
            "features": features,
        }

        # Save to disk
        extractions_dir = os.path.join(DATA_DIR, "extractions")
        os.makedirs(extractions_dir, exist_ok=True)
        extraction_path = os.path.join(extractions_dir, f"{identifier}.json")
        with open(extraction_path, "w") as f:
            json.dump(extraction, f, indent=2)

        self.log(f"Scraped {len(features)} features from {year}-{month_str}")
        self._current_task = f"Scraped {len(features)} features from {year}-{month_str}"

        return TaskResult(
            task_id=task.id, task_type=task.type, status="success",
            result={
                "identifier": identifier,
                "features": features,
                "extraction_path": extraction_path,
            },
            agent=self.name,
        )

    def _fetch_article_pages(self, date_str, articles):
        """Download page images from Azure Blob Storage for article openings.

        Args:
            date_str: Issue date string like "20200101" for URL construction
            articles: List of article dicts from _fetch_issue_toc() (must have page_range)

        Returns:
            Dict mapping article index to list of (page_num, image_bytes) tuples
        """
        import requests

        HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
        article_pages = {}

        for idx, art in enumerate(articles):
            page_range = art.get("page_range", "")
            if not page_range:
                continue

            # Parse page numbers from "188,189,190,191,192,193,194,195"
            try:
                pages = [int(p.strip()) for p in page_range.split(",") if p.strip().isdigit()]
            except (ValueError, AttributeError):
                continue

            if not pages:
                continue

            # Take only first N pages (article opening has homeowner + designer info)
            pages = pages[:AD_ARCHIVE_MAX_PAGES_PER_ARTICLE]
            fetched = []

            for page_num in pages:
                url = AD_ARCHIVE_BLOB_BASE.format(date=date_str, page=page_num)
                try:
                    resp = requests.get(url, headers=HEADERS, timeout=15)
                    if resp.status_code == 200 and len(resp.content) > 1000:
                        fetched.append((page_num, resp.content))
                    else:
                        self.log(f"Page {page_num} returned {resp.status_code} ({len(resp.content)}b)", level="WARN")
                except Exception as e:
                    self.log(f"Failed to fetch page {page_num}: {e}", level="WARN")

            if fetched:
                article_pages[idx] = fetched

        return article_pages

    def _extract_features_with_images(self, articles, article_pages, year, month):
        """Extract rich features using page images + article metadata via Claude Vision.

        Sends first 2-3 pages of each article to Claude Vision for extraction,
        falling back to teaser-only extraction for articles without page images.
        """
        if not articles:
            return []

        # Split: articles with images vs teaser-only
        image_articles = []
        teaser_only_articles = []

        for idx, art in enumerate(articles):
            if idx in article_pages and article_pages[idx]:
                image_articles.append((idx, art, article_pages[idx]))
            else:
                teaser_only_articles.append(art)

        features = []

        # Batch 1: Image-based extraction (one article at a time — images are large)
        for idx, art, pages in image_articles:
            try:
                feat = self._extract_single_article_from_images(art, pages, year, month)
                if feat:
                    features.append(feat)
            except Exception as e:
                self.log(f"Image extraction failed for '{art.get('title', '?')}': {e}", level="WARN")
                # Fall back to teaser-only
                teaser_only_articles.append(art)

        # Batch 2: Teaser-only extraction (batch all remaining)
        if teaser_only_articles:
            teaser_features = self._extract_features_from_toc(teaser_only_articles, year, month)
            if teaser_features:
                features.extend(teaser_features)

        return features

    def _extract_single_article_from_images(self, article, pages, year, month):
        """Extract features from one article's page images using Claude Vision.

        Args:
            article: Article dict from TOC (title, teaser, author, etc.)
            pages: List of (page_num, image_bytes) tuples
            year, month: Issue date

        Returns:
            Feature dict or None
        """
        import base64

        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            from dotenv import load_dotenv
            load_dotenv(os.path.join(BASE_DIR, ".env"))
            api_key = os.environ.get("ANTHROPIC_API_KEY")

        if not api_key:
            return None

        try:
            import anthropic
        except ImportError:
            return None

        month_str = f"{month:02d}" if isinstance(month, int) else str(month)

        # Build content blocks: images + text prompt
        content = []
        for page_num, img_bytes in pages:
            b64 = base64.b64encode(img_bytes).decode("utf-8")
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": b64,
                },
            })

        prompt = f"""You are reading pages from an Architectural Digest magazine article.

ISSUE: AD {year}-{month_str}
ARTICLE TITLE: {article.get('title', 'Unknown')}
ARTICLE SECTION: {article.get('section', '')}
AUTHOR/PHOTOGRAPHER: {article.get('author', '')}
TEASER: {article.get('teaser', '')}

Extract the following from these magazine page images:
- homeowner_name: The person(s) whose home is featured (NOT the writer/photographer/designer)
- designer_name: Interior designer or architect who designed/renovated the space
- architecture_firm: Architecture firm (if separate from designer)
- location_city: City where the home is located
- location_state: State or region
- location_country: Country
- design_style: Architectural or interior design style
- year_built: Year the home was built or renovated
- square_footage: Size of the home
- cost: Cost mentioned

RULES:
- Extract ONLY what is stated or strongly implied in the text/images
- Use null for any field not found
- The homeowner is whose HOME it is — look for possessives, "home of", "residence of"
- The designer/architect is who designed the space — look for "designed by", "architect", "interior designer"
- If the article is NOT about a private home/apartment/estate, return null

Respond with ONLY a JSON object (not array):
{{
  "homeowner_name": "Name or null",
  "designer_name": "Name or null",
  "architecture_firm": "Firm or null",
  "location_city": "City or null",
  "location_state": "State or null",
  "location_country": "Country or null",
  "design_style": "Style or null",
  "year_built": null,
  "square_footage": null,
  "cost": null
}}"""

        content.append({"type": "text", "text": prompt})

        try:
            client = anthropic.Anthropic(api_key=api_key)
            model_id = "claude-haiku-4-5-20251001"
            message = client.messages.create(
                model=model_id,
                max_tokens=1024,
                messages=[{"role": "user", "content": content}],
            )
            self._track_api_cost(message, model_id)
            result_text = message.content[0].text
        except Exception as e:
            self.log(f"Vision API error: {e}", level="ERROR")
            return None

        # Parse response
        parsed = self._parse_result_json(result_text)
        if not parsed:
            return None

        # Build feature dict
        page_number = pages[0][0] if pages else None
        if not page_number:
            page_number = article.get("start_page")

        feature = {
            "article_title": article.get("title", ""),
            "article_author": article.get("author", ""),
            "homeowner_name": parsed.get("homeowner_name") or "Anonymous",
            "designer_name": parsed.get("designer_name"),
            "architecture_firm": parsed.get("architecture_firm"),
            "year_built": parsed.get("year_built"),
            "square_footage": parsed.get("square_footage"),
            "cost": parsed.get("cost"),
            "location_city": parsed.get("location_city"),
            "location_state": parsed.get("location_state"),
            "location_country": parsed.get("location_country"),
            "design_style": parsed.get("design_style"),
            "page_number": page_number,
            "notes": "Extracted from AD Archive page images (source: ad_archive_deep_scrape)",
        }

        # Clean null-string values
        for key, val in list(feature.items()):
            if isinstance(val, str) and val.lower() in ("null", "none", "n/a", "unknown"):
                feature[key] = None

        return feature

    def _fetch_issue_toc(self, issue_url):
        """Fetch issue page via HTTP and extract featured articles from JWT tocConfig.

        The AD Archive embeds a JWT token in the page source as a JavaScript variable
        called `tocConfig`. The JWT payload contains structured article metadata
        including titles, teasers, authors, page ranges, and slugs.

        No authentication required. Returns list of article dicts.
        """
        import base64
        import re
        import requests

        HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

        resp = requests.get(issue_url, headers=HEADERS, timeout=30)
        resp.raise_for_status()

        # Extract JWT from tocConfig JavaScript variable
        match = re.search(r"tocConfig\s*=\s*'([^']+)'", resp.text)
        if not match:
            self.log("No tocConfig JWT found in page source", level="WARN")
            return []

        jwt_token = match.group(1)
        parts = jwt_token.split(".")
        if len(parts) < 2:
            self.log("Invalid JWT format in tocConfig", level="WARN")
            return []

        # Decode JWT payload (base64url → JSON)
        payload_b64 = parts[1]
        payload_b64 += "=" * (4 - len(payload_b64) % 4)  # Add padding
        decoded = base64.urlsafe_b64decode(payload_b64).decode("utf-8")

        data = json.loads(decoded)
        # Payload may be double-encoded as string
        if isinstance(data, str):
            data = json.loads(data)

        featured = data.get("featured", [])
        if not featured:
            self.log("JWT decoded but no 'featured' array found", level="WARN")
            return []

        # Filter to home feature articles (skip resources, ads, editor letters)
        SKIP_SECTIONS = {"resources", "ad trade", "shopping", "classified", "promotion"}
        SKIP_GENRES = {"resources"}
        articles = []
        for art in featured:
            section = (art.get("Section") or "").strip().lower()
            genre = (art.get("Genre") or "").strip().lower()
            title = (art.get("Title") or "").strip()

            if section in SKIP_SECTIONS or genre in SKIP_GENRES:
                continue
            if not title or title.lower() in ("resources", "ad trade", "classified"):
                continue

            # Strip HTML from teaser
            teaser = art.get("Teaser") or ""
            teaser = re.sub(r"<[^>]+>", "", teaser).strip()

            # Extract starting page number from PageRange
            page_range = art.get("PageRange") or ""
            start_page = None
            if page_range:
                first = page_range.split(",")[0].strip()
                try:
                    start_page = int(first)
                except ValueError:
                    pass

            articles.append({
                "title": title,
                "teaser": teaser,
                "author": (art.get("CreatorString") or "").strip(),
                "slug": art.get("Slug") or "",
                "article_key": art.get("ArticleKey") or "",
                "section": (art.get("Section") or "").strip(),
                "start_page": start_page,
                "page_range": page_range,
                "wordcount": art.get("Wordcount"),
            })

        return articles

    def _extract_features_from_toc(self, articles, year, month):
        """Extract structured home feature data from article titles + teasers.

        Uses the Anthropic API directly (Haiku) for fast batch extraction.
        Returns list of feature dicts compatible with load_extraction().
        """
        if not articles:
            return []

        # Build article summaries for the prompt
        article_lines = []
        for idx, art in enumerate(articles):
            line = f"[{idx+1}] Title: {art['title']}"
            if art.get("teaser"):
                line += f"\n    Teaser: {art['teaser'][:300]}"
            if art.get("author"):
                line += f"\n    Author: {art['author']}"
            if art.get("section"):
                line += f"\n    Section: {art['section']}"
            article_lines.append(line)

        articles_text = "\n\n".join(article_lines)
        month_str = f"{month:02d}" if isinstance(month, int) else str(month)

        prompt = f"""You are extracting structured data from Architectural Digest article listings.

ISSUE: AD {year}-{month_str}

Below are {len(articles)} featured articles from this issue. For each article that is about a PRIVATE HOME
(someone's house, apartment, estate, retreat, penthouse, loft), extract the homeowner and design details.

SKIP articles about: hotels, restaurants, product roundups, designer profiles without a specific home,
travel destinations, editor's letters, art collections without a home context, or commercial spaces.

ARTICLES:
{articles_text}

For each home feature, extract:
- homeowner_name: The person(s) whose home is featured (NOT the writer/photographer/editor)
- designer_name: Interior designer or architect who designed/renovated the space
- location_city: City where the home is located
- location_state: State or region
- location_country: Country
- design_style: Architectural or design style
- article_title: The article title (as given above)
- article_number: The [N] number from the listing above

RULES:
- Only extract what's explicitly stated or strongly implied in the title/teaser
- Use null for any field not mentioned
- If the teaser mentions a possessive name ("X's home"), that's the homeowner
- If someone "designed for" or "creates for" a person, that person is the homeowner
- The CreatorString/Author is the WRITER, not the homeowner
- "Anonymous" if the home is featured but homeowner not named

Respond with ONLY a JSON array:
[
  {{
    "article_number": 1,
    "article_title": "THE GREAT ESCAPE",
    "homeowner_name": "Barry and Sheryl Schwartz",
    "designer_name": "Thierry Despont",
    "location_city": "Palm Beach",
    "location_state": "Florida",
    "location_country": "United States",
    "design_style": "Beachfront Contemporary"
  }}
]

Return an empty array [] if no home features are found."""

        # Call Anthropic API directly (faster than CLI)
        result = self._call_anthropic_api(prompt)

        if not result:
            self.log("Feature extraction API call returned no result", level="WARN")
            return []

        # Parse the JSON array from the response
        parsed = self._parse_result_json_array(result)
        if not parsed:
            self.log("Could not parse features from API response", level="WARN")
            return []

        # Map back to extraction format with page numbers
        features = []
        for feat in parsed:
            # Default unnamed homeowners to "Anonymous" (matches Reader behavior)
            if not feat.get("homeowner_name"):
                feat["homeowner_name"] = "Anonymous"

            art_num = feat.get("article_number", 0)
            art_idx = art_num - 1 if art_num > 0 else -1

            # Get page number from the original TOC data
            page_number = None
            if 0 <= art_idx < len(articles):
                page_number = articles[art_idx].get("start_page")
            # Fallback: sequential page number for dedup
            if not page_number:
                page_number = len(features) + 1

            feature = {
                "article_title": feat.get("article_title", ""),
                "article_author": articles[art_idx]["author"] if 0 <= art_idx < len(articles) else "",
                "homeowner_name": feat.get("homeowner_name"),
                "designer_name": feat.get("designer_name"),
                "architecture_firm": feat.get("architecture_firm"),
                "year_built": feat.get("year_built"),
                "square_footage": feat.get("square_footage"),
                "cost": feat.get("cost"),
                "location_city": feat.get("location_city"),
                "location_state": feat.get("location_state"),
                "location_country": feat.get("location_country"),
                "design_style": feat.get("design_style"),
                "page_number": page_number,
                "notes": f"Extracted from AD Archive teaser (source: ad_archive_scrape)",
            }

            # Clean up null-string values from LLM
            for key, val in list(feature.items()):
                if isinstance(val, str) and val.lower() in ("null", "none", "n/a", "unknown"):
                    feature[key] = None

            features.append(feature)

        return features

    def _call_anthropic_api(self, prompt):
        """Call Anthropic API directly using the SDK. Returns text response or None."""
        try:
            import anthropic
        except ImportError:
            self.log("anthropic SDK not installed, falling back to CLI", level="WARN")
            return self._call_claude(prompt, timeout=180, tools=[])

        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            # Try loading from .env
            from dotenv import load_dotenv
            load_dotenv(os.path.join(BASE_DIR, ".env"))
            api_key = os.environ.get("ANTHROPIC_API_KEY")

        if not api_key:
            self.log("No ANTHROPIC_API_KEY found, falling back to CLI", level="WARN")
            return self._call_claude(prompt, timeout=180, tools=[])

        try:
            client = anthropic.Anthropic(api_key=api_key)
            model_id = "claude-haiku-4-5-20251001"
            message = client.messages.create(
                model=model_id,
                max_tokens=4096,
                messages=[{
                    "role": "user",
                    "content": [{"type": "text", "text": prompt}],
                }],
            )
            self._track_api_cost(message, model_id)
            return message.content[0].text
        except Exception as e:
            self.log(f"Anthropic API error: {e}", level="ERROR")
            return None

    def _parse_result_json_array(self, result):
        """Extract a JSON array from Claude's response."""
        if not result:
            return None

        text = result.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]

        # Try to find a JSON array
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass

        # Fallback: try parsing as a JSON object with an array inside
        obj = self._parse_result_json(result)
        if obj and isinstance(obj, list):
            return obj
        if obj and isinstance(obj, dict):
            # Check common wrapper keys
            for key in ("features", "articles", "results", "data"):
                if isinstance(obj.get(key), list):
                    return obj[key]

        return None

    # ── Progress ──────────────────────────────────────────────

    def get_progress(self):
        try:
            counts = count_issues_by_status()
            total = counts["total"]
            downloaded = counts["downloaded"] + counts["extracted"]
            return {"current": downloaded, "total": total}
        except Exception:
            pass
        return {"current": 0, "total": 0}
