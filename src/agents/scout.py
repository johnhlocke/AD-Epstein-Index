"""
Scout Agent — finds every issue of Architectural Digest from 1988-2024.

Uses an LLM brain (claude -p) to reason about gaps, verify dates,
and search multiple sources. Each cycle picks ONE focused task:
fix a batch of misdated issues, search for specific gaps, or explore
new sources.

Interval: 900s (15 min) — filling a 400+ issue backlog.
"""

import asyncio
import json
import os
import subprocess
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agents.base import Agent, DATA_DIR, BASE_DIR, read_manifest, update_manifest_locked

MANIFEST_PATH = os.path.join(DATA_DIR, "archive_manifest.json")
SCOUT_LOG_PATH = os.path.join(DATA_DIR, "scout_log.json")
KNOWLEDGE_PATH = os.path.join(DATA_DIR, "scout_knowledge.json")
ESCALATION_PATH = os.path.join(DATA_DIR, "scout_escalations.json")

MAX_KNOWLEDGE_PER_CATEGORY = 50
ESCALATION_COOLDOWN_HOURS = 1
EXHAUSTED_ESCALATION_THRESHOLD = 20

MIN_YEAR = 1988
MAX_YEAR = 2024
TOTAL_EXPECTED = (MAX_YEAR - MIN_YEAR + 1) * 12  # 444

# Tools the Scout is allowed to use via Claude Code
ALLOWED_TOOLS = [
    "Read",
    "WebFetch",
    "WebSearch",
    "mcp__playwright__*",
]

# Batch sizes per strategy
DATE_FIX_BATCH = 10
GAP_SEARCH_BATCH = 6

# Cooldown: hours to wait before retrying a failed search, multiplied by attempt count
# Attempt 1 → 6h, attempt 2 → 12h, attempt 3 → 18h, etc.
SEARCH_COOLDOWN_HOURS = 6
MAX_SEARCH_ATTEMPTS = 5  # After this many failures, stop trying until manual reset


class ScoutAgent(Agent):
    def __init__(self):
        super().__init__("scout", interval=900)
        self._cycle_count = 0
        self._search_attempts = {}  # "YYYY-MM" -> {"attempts": N, "last_searched": ISO}
        self._recent_strategy_results = []  # Track last N strategy outcomes for escalation
        self._load_scout_log()

    # ── Persistence ────────────────────────────────────────────────

    def _load_scout_log(self):
        if os.path.exists(SCOUT_LOG_PATH):
            try:
                with open(SCOUT_LOG_PATH) as f:
                    data = json.load(f)
                self._cycle_count = data.get("cycle_count", 0)
                self._search_attempts = data.get("search_attempts", {})
                self._recent_strategy_results = data.get("recent_strategy_results", [])
            except Exception:
                pass

    def _save_scout_log(self):
        data = {
            "cycle_count": self._cycle_count,
            "last_run": datetime.now().isoformat(),
            "search_attempts": self._search_attempts,
            "recent_strategy_results": self._recent_strategy_results[-10:],
        }
        os.makedirs(os.path.dirname(SCOUT_LOG_PATH), exist_ok=True)
        with open(SCOUT_LOG_PATH, "w") as f:
            json.dump(data, f, indent=2)

    def _is_on_cooldown(self, month_key):
        """Check if a month has been searched recently and should be skipped."""
        attempt = self._search_attempts.get(month_key)
        if not attempt:
            return False
        if attempt["attempts"] >= MAX_SEARCH_ATTEMPTS:
            return True  # Exhausted — stop trying
        last = datetime.fromisoformat(attempt["last_searched"])
        cooldown_hours = SEARCH_COOLDOWN_HOURS * attempt["attempts"]
        elapsed_hours = (datetime.now() - last).total_seconds() / 3600
        return elapsed_hours < cooldown_hours

    def _record_search_attempt(self, month_key, found):
        """Record that we searched for a month. Reset if found, increment if not."""
        if found:
            # Found it — remove from attempts
            self._search_attempts.pop(month_key, None)
        else:
            existing = self._search_attempts.get(month_key, {"attempts": 0})
            existing["attempts"] = existing.get("attempts", 0) + 1
            existing["last_searched"] = datetime.now().isoformat()
            self._search_attempts[month_key] = existing

    def _load_manifest(self):
        return read_manifest()

    def _save_manifest_with_findings(self, findings, strategy):
        """Apply findings to the LATEST manifest under lock, then write."""
        def apply(fresh_manifest):
            self._apply_findings(fresh_manifest, findings, strategy)
        update_manifest_locked(apply)

    # ── Knowledge Base ─────────────────────────────────────────────

    def _load_knowledge(self):
        """Load the Scout's persistent knowledge base from disk."""
        if os.path.exists(KNOWLEDGE_PATH):
            try:
                with open(KNOWLEDGE_PATH) as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "successful_sources": [],
            "failed_strategies": [],
            "source_notes": [],
            "insights": [],
        }

    def _save_knowledge(self, kb):
        """Write knowledge base with dedup and cap per category."""
        for category in ("successful_sources", "failed_strategies", "source_notes", "insights"):
            entries = kb.get(category, [])
            # Dedup by content (use 'source'+'query' for sources, 'strategy' for failures, 'text'/'note' for others)
            seen = set()
            deduped = []
            for entry in entries:
                # Build a dedup key from the most distinctive fields
                key_parts = []
                for field in ("source", "query", "strategy", "text", "note"):
                    if field in entry:
                        key_parts.append(str(entry[field]))
                key = "|".join(key_parts)
                if key not in seen:
                    seen.add(key)
                    deduped.append(entry)
            # Cap at MAX_KNOWLEDGE_PER_CATEGORY, keeping most recent
            kb[category] = deduped[-MAX_KNOWLEDGE_PER_CATEGORY:]

        os.makedirs(os.path.dirname(KNOWLEDGE_PATH), exist_ok=True)
        with open(KNOWLEDGE_PATH, "w") as f:
            json.dump(kb, f, indent=2)

    def _record_learning(self, category, entry):
        """Append a learning entry to the knowledge base."""
        kb = self._load_knowledge()
        entry["time"] = datetime.now().isoformat()
        kb.setdefault(category, []).append(entry)
        self._save_knowledge(kb)

    def _get_knowledge_summary(self):
        """Build a concise text summary of recent knowledge for prompt injection."""
        kb = self._load_knowledge()
        lines = []

        # Last 5 successful sources
        for entry in kb.get("successful_sources", [])[-5:]:
            lines.append(f"[SUCCESS] {entry.get('source', '?')}: found {entry.get('found_count', '?')} issues "
                         f"(years {entry.get('year_range', '?')})")

        # Last 5 failed strategies
        for entry in kb.get("failed_strategies", [])[-5:]:
            lines.append(f"[FAILED] {entry.get('strategy', '?')}: {entry.get('reason', '?')}")

        # Last 5 source notes
        for entry in kb.get("source_notes", [])[-5:]:
            lines.append(f"[NOTE] {entry.get('source', '?')}: {entry.get('note', '?')}")

        # Last 5 insights
        for entry in kb.get("insights", [])[-5:]:
            lines.append(f"[INSIGHT] {entry.get('text', '?')}")

        if not lines:
            return "No prior knowledge recorded yet."
        return "\n".join(lines)

    # ── Escalation ─────────────────────────────────────────────────

    def _load_escalations(self):
        """Load existing escalations from disk."""
        if os.path.exists(ESCALATION_PATH):
            try:
                with open(ESCALATION_PATH) as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def _save_escalations(self, escalations):
        """Write escalations to disk."""
        os.makedirs(os.path.dirname(ESCALATION_PATH), exist_ok=True)
        with open(ESCALATION_PATH, "w") as f:
            json.dump(escalations, f, indent=2)

    def _maybe_escalate(self, gap_report, strategy_type, strategy_failed):
        """Check if the Scout should escalate to the Editor. Rate-limited to 1/hour."""
        escalations = self._load_escalations()

        # Rate limit: check last unresolved escalation time
        for esc in reversed(escalations):
            if not esc.get("resolved"):
                last_time = datetime.fromisoformat(esc["time"])
                hours_since = (datetime.now() - last_time).total_seconds() / 3600
                if hours_since < ESCALATION_COOLDOWN_HOURS:
                    return  # Too soon since last escalation

        # Count exhausted months
        exhausted_months = [
            m for m in gap_report.get("missing_months", [])
            if self._search_attempts.get(m, {}).get("attempts", 0) >= MAX_SEARCH_ATTEMPTS
        ]
        exhausted_count = len(exhausted_months)

        # Count consecutive failures of same strategy type
        consecutive_failures = 0
        if hasattr(self, "_recent_strategy_results"):
            for result in reversed(self._recent_strategy_results):
                if result["type"] == strategy_type and not result["success"]:
                    consecutive_failures += 1
                else:
                    break

        # Determine if escalation is warranted
        reason = None
        esc_type = "stuck"

        if strategy_type == "explore_sources" and strategy_failed:
            reason = (f"Creative source exploration failed. {exhausted_count} months exhausted "
                      f"after standard searches. Need new strategy ideas.")
            esc_type = "explore_failed"

        elif exhausted_count >= EXHAUSTED_ESCALATION_THRESHOLD:
            # Find the top stuck years
            stuck_years = {}
            for m in exhausted_months:
                year = int(m.split("-")[0])
                stuck_years[year] = stuck_years.get(year, 0) + 1
            top_stuck = sorted(stuck_years, key=stuck_years.get, reverse=True)[:5]
            reason = (f"{exhausted_count} months exhausted after {MAX_SEARCH_ATTEMPTS} search "
                      f"attempts each. Top stuck years: {', '.join(map(str, top_stuck))}. "
                      f"Need new strategy ideas.")

        elif consecutive_failures >= 3:
            reason = (f"Strategy '{strategy_type}' has failed {consecutive_failures} cycles in "
                      f"a row. May need a different approach.")
            esc_type = "repeated_failure"

        if reason:
            escalation = {
                "time": datetime.now().isoformat(),
                "type": esc_type,
                "message": reason,
                "context": {
                    "exhausted_count": exhausted_count,
                    "strategy_type": strategy_type,
                    "consecutive_failures": consecutive_failures,
                    "missing_months_total": len(gap_report.get("missing_months", [])),
                },
                "resolved": False,
            }
            escalations.append(escalation)
            self._save_escalations(escalations)
            self.log(f"Escalated to Editor: {reason}", level="WARN")

    # ── Gap Analysis ───────────────────────────────────────────────

    def _analyze_gaps(self, manifest):
        """Figure out what's missing, misdated, and unverified."""
        issues = manifest.get("issues", [])

        # Categorize issues
        confirmed = {}  # (year, month) -> issue  — correctly dated
        misdated = []   # issues with dates outside 1988-2024
        no_date = []    # issues with no year
        pre_1988 = []   # legitimately old issues

        for issue in issues:
            year = issue.get("year")
            month = issue.get("month")

            if not year:
                no_date.append(issue)
            elif year < MIN_YEAR:
                # Check if the vol-based estimate would put it in range
                ident = issue.get("identifier", "").lower()
                import re
                vol_match = re.search(r"architecturaldig(\d+)", ident)
                if vol_match:
                    vol = int(vol_match.group(1))
                    # AD vol numbering: very roughly vol 69 ≈ 1988
                    # But this is unreliable — flag for verification
                    if vol >= 45:  # Could be 1964+ — worth checking
                        misdated.append(issue)
                    else:
                        pre_1988.append(issue)
                else:
                    misdated.append(issue)
            elif MIN_YEAR <= year <= MAX_YEAR:
                key = (year, month or 0)
                confirmed[key] = issue
            else:
                misdated.append(issue)

        # Build gap list: which months are missing?
        missing_months = []
        for year in range(MIN_YEAR, MAX_YEAR + 1):
            for month in range(1, 13):
                if (year, month) not in confirmed:
                    missing_months.append(f"{year}-{month:02d}")

        # Confirmed years summary
        years_covered = {}
        for (y, m), _ in confirmed.items():
            years_covered.setdefault(y, []).append(m)

        return {
            "total_expected": TOTAL_EXPECTED,
            "total_confirmed": len(confirmed),
            "total_misdated": len(misdated),
            "total_no_date": len(no_date),
            "total_pre_1988": len(pre_1988),
            "missing_months": missing_months,
            "misdated_issues": misdated,
            "no_date_issues": no_date,
            "years_covered": {y: sorted(ms) for y, ms in sorted(years_covered.items())},
            "coverage_pct": round(len(confirmed) / TOTAL_EXPECTED * 100, 1),
        }

    # ── Strategy Selection ─────────────────────────────────────────

    def _pick_strategy(self, gap_report, manifest):
        """Decide what to work on this cycle.

        Priority order:
        1. Fix misdated archive.org issues (free, no auth needed)
        2. Fix undated archive.org issues
        3. Search archive.org for missing months (free PDFs)
        3.5. Creative source exploration (when fill_gaps is stuck)
        4. Scrape AD Archive to catalog which issues exist (requires auth for downloads)
        5. Broad verification pass
        """
        # Priority 1: Fix misdated issues on archive.org (they might be in our range)
        if gap_report["total_misdated"] > 0:
            batch = gap_report["misdated_issues"][:DATE_FIX_BATCH]
            return {
                "type": "fix_dates",
                "description": f"Verify dates on {len(batch)} misdated issues ({gap_report['total_misdated']} remaining)",
                "batch": batch,
            }

        # Priority 2: Fix issues with no date
        if gap_report["total_no_date"] > 0:
            batch = gap_report["no_date_issues"][:DATE_FIX_BATCH]
            return {
                "type": "fix_dates",
                "description": f"Determine dates for {len(batch)} undated issues ({gap_report['total_no_date']} remaining)",
                "batch": batch,
            }

        # Priority 3: Search archive.org for missing months (free, downloadable PDFs)
        # Filter out months on cooldown (already searched, not found)
        if gap_report["missing_months"]:
            searchable = [m for m in gap_report["missing_months"] if not self._is_on_cooldown(m)]
            exhausted = len(gap_report["missing_months"]) - len(searchable)
            if searchable:
                batch = searchable[-GAP_SEARCH_BATCH:]
                desc = f"Search archive.org for {len(batch)} missing issues ({len(searchable)} searchable, {exhausted} on cooldown)"
                return {
                    "type": "fill_gaps",
                    "description": desc,
                    "batch": batch,
                }
            elif exhausted:
                self.log(f"All {exhausted} missing months on cooldown — skipping fill_gaps")

        # Priority 3.5: Creative source exploration (when fill_gaps is stuck)
        if gap_report["missing_months"]:
            searchable = [m for m in gap_report["missing_months"] if not self._is_on_cooldown(m)]
            if not searchable and len(gap_report["missing_months"]) > 0:
                return {
                    "type": "explore_sources",
                    "description": f"Exploring new sources for {len(gap_report['missing_months'])} stuck months",
                    "batch": gap_report["missing_months"][:20],
                }

        # Priority 4: Scrape AD Archive to catalog which issues exist
        # (Useful for confirming existence, but downloads require auth + 20-page batching)
        ad_archive_years = set()
        for i in manifest.get("issues", []):
            if i.get("date_source") == "ad_archive" and i.get("year"):
                ad_archive_years.add(i["year"])
        all_target_years = set(range(MIN_YEAR, MAX_YEAR + 1))
        unscraped_years = all_target_years - ad_archive_years
        if unscraped_years:
            target_year = max(unscraped_years)
            return {
                "type": "scrape_ad_archive",
                "description": f"Catalog AD Archive for {target_year} ({len(unscraped_years)} years remaining)",
                "batch": [],
                "target_year": target_year,
            }

        # Priority 5: Everything looks good — do a verification pass
        return {
            "type": "verify",
            "description": "All issues accounted for — running verification",
            "batch": [],
        }

    # ── Prompt Building ────────────────────────────────────────────

    def _build_prompt(self, strategy, gap_report, skills):
        """Build a focused prompt for Claude Code CLI."""

        gap_summary = (
            f"Coverage: {gap_report['total_confirmed']}/{gap_report['total_expected']} confirmed "
            f"({gap_report['coverage_pct']}%)\n"
            f"Misdated (need verification): {gap_report['total_misdated']}\n"
            f"No date: {gap_report['total_no_date']}\n"
            f"Missing months: {len(gap_report['missing_months'])}\n"
        )

        if gap_report["years_covered"]:
            gap_summary += "\nYears with confirmed issues:\n"
            for year, months in sorted(gap_report["years_covered"].items()):
                month_names = [
                    ["Jan","Feb","Mar","Apr","May","Jun",
                     "Jul","Aug","Sep","Oct","Nov","Dec"][m-1]
                    for m in months if m > 0
                ]
                gap_summary += f"  {year}: {', '.join(month_names)} ({len(months)}/12)\n"

        if strategy["type"] == "scrape_ad_archive":
            target_year = strategy.get("target_year", 2024)

            # Generate all 12 possible URLs for this year
            urls_to_check = []
            for m in range(1, 13):
                url = f"https://archive.architecturaldigest.com/issue/{target_year}{m:02d}01"
                month_name = ["Jan","Feb","Mar","Apr","May","Jun",
                              "Jul","Aug","Sep","Oct","Nov","Dec"][m-1]
                urls_to_check.append(f"{month_name} {target_year}: {url}")

            urls_text = "\n".join(urls_to_check)

            task = f"""CATALOG which Architectural Digest issues exist on the official AD Archive for {target_year}.
This is for cataloging only — NOT downloading. We just need to confirm which issues exist.

The AD Archive uses predictable URLs: https://archive.architecturaldigest.com/issue/YYYYMM01

For EACH URL below, navigate to it using browser_navigate. If the page loads an issue
(shows article listings, cover image, issue title), it EXISTS. If it redirects to the
homepage or shows a "not found" state, it does NOT exist.

To be efficient: navigate to each URL, take a browser_snapshot, check if the page title
or content mentions the month/year. You don't need to read every article — just confirm
the issue exists.

Check ALL 12 months:
{urls_text}

Note: Combined issues (e.g., Jul/Aug) typically exist under July's URL only.
August may redirect or not exist separately."""

            response_format = f"""Respond with ONLY a JSON object:
{{
  "found_issues": [
    {{
      "identifier": "ad_archive_{target_year}MM",
      "title": "Architectural Digest Month {target_year}",
      "year": {target_year},
      "month": 1,
      "source": "ad_archive",
      "confidence": "high",
      "url": "https://archive.architecturaldigest.com/issue/{target_year}MM01"
    }}
  ],
  "not_found": ["months that returned errors or redirected"],
  "notes": "observations (combined issues, missing months, etc.)"
}}"""

        elif strategy["type"] == "fix_dates":
            issues_text = ""
            for issue in strategy["batch"]:
                issues_text += (
                    f"- identifier: {issue['identifier']}\n"
                    f"  title: {issue['title']}\n"
                    f"  current_date: {issue.get('date', 'none')}\n"
                    f"  current_year: {issue.get('year', 'none')}\n"
                    f"  current_month: {issue.get('month', 'none')}\n\n"
                )

            task = f"""Verify and correct the dates for these Architectural Digest issues.

For each issue:
1. Fetch its archive.org details page: https://archive.org/details/{{identifier}}
2. Look for the actual publication date in the page metadata, description, or scan details
3. The identifier often contains the volume number (e.g., architecturaldig59janlosa = vol 59, January)
4. AD volume 1 started in 1920. Very roughly: publication year ≈ 1919 + volume number, but this is imprecise
5. Look for any mention of the actual year on the details page (description, notes, subject tags)
6. If unsure, mark as "uncertain"

Issues to verify:
{issues_text}"""

            response_format = """Respond with ONLY a JSON object:
{
  "verified_issues": [
    {
      "identifier": "the_identifier",
      "year": 1992,
      "month": 3,
      "confidence": "high|medium|low",
      "source": "how you determined the date"
    }
  ]
}"""

        elif strategy["type"] == "fill_gaps":
            months_text = ", ".join(strategy["batch"])

            # Tell the LLM about prior failed attempts so it tries different strategies
            prior_attempts_text = ""
            for month_key in strategy["batch"]:
                attempt = self._search_attempts.get(month_key)
                if attempt and attempt["attempts"] > 0:
                    prior_attempts_text += f"  - {month_key}: searched {attempt['attempts']}x before without success\n"
            if prior_attempts_text:
                prior_attempts_text = f"\nPrior failed searches (try DIFFERENT strategies this time):\n{prior_attempts_text}"

            task = f"""Search for these specific missing Architectural Digest issues: {months_text}
{prior_attempts_text}
Search strategies to try:
1. Archive.org search: https://archive.org/advancedsearch.php?q=title%3A%22architectural+digest%22+AND+date%3A[YYYY-01-01+TO+YYYY-12-31]&fl[]=identifier,title,date&output=json
2. Web search: "Architectural Digest [Month] [Year] archive.org" or "Architectural Digest [Month] [Year] pdf"
3. Try alternate archive.org queries: subject:"architectural digest", collection:"magazine_rack"
4. Check if Google Books, HathiTrust, or other digital libraries have these issues

For each issue you find, get the archive.org identifier (or URL if from another source)."""

            response_format = """Respond with ONLY a JSON object:
{
  "found_issues": [
    {
      "identifier": "archive_org_identifier_or_url",
      "title": "Architectural Digest Month Year",
      "year": 2001,
      "month": 6,
      "source": "archive.org|google_books|hathitrust|other",
      "confidence": "high|medium|low",
      "url": "full URL if not archive.org"
    }
  ],
  "not_found": ["2001-06", "2001-07"],
  "notes": "any observations about availability"
}"""

        elif strategy["type"] == "explore_sources":
            stuck_months = strategy.get("batch", [])
            months_text = ", ".join(stuck_months[:20])

            # Build year summary of stuck months
            stuck_years = {}
            for m in stuck_months:
                year = int(m.split("-")[0])
                stuck_years[year] = stuck_years.get(year, 0) + 1
            years_text = ", ".join(f"{y} ({c} months)" for y, c in sorted(stuck_years.items()))

            knowledge_text = self._get_knowledge_summary()

            task = f"""You've searched the usual sources (archive.org, AD Archive) and come up empty for many issues.
Time to think CREATIVELY about where else these magazines might exist digitally.

Stuck months ({len(stuck_months)} total): {months_text}{"..." if len(stuck_months) > 20 else ""}
Stuck years: {years_text}

What you already know:
{knowledge_text}

Think outside the box. Try these novel approaches:
1. University digital library collections (many subscribe to ProQuest, EBSCO, or Gale which archive magazines)
2. Magazine collector communities and forums (Reddit r/magazines, collector sites)
3. Condé Nast corporate press archives or annual reports (may list issue dates)
4. Wayback Machine snapshots of architecturaldigest.com — past issue listings, tables of contents
5. ISSN databases (ISSN 0003-8520 for AD) — may link to holdings
6. WorldCat.org — search for library holdings of AD by year
7. eBay, AbeBooks, or collector marketplaces — listings confirm issue existence even if not downloadable
8. Google Scholar or academic databases — articles ABOUT AD issues from specific years
9. ProQuest or Gale databases (note if paywalled — the human may have access)

For each approach you try:
- Record what you searched and what you found (even if nothing)
- Note any new sources that look promising but need credentials/payment
- If you find actual issues, get identifiers and URLs

Be thorough — explore at least 3-4 different approaches."""

            response_format = """Respond with ONLY a JSON object:
{
  "found_issues": [
    {
      "identifier": "id_or_url",
      "title": "Architectural Digest Month Year",
      "year": 2005,
      "month": 3,
      "source": "where you found it",
      "confidence": "high|medium|low",
      "url": "full URL"
    }
  ],
  "new_sources": [
    {
      "name": "Source name",
      "url": "URL if applicable",
      "coverage": "What years/issues they seem to have",
      "access": "free|login_required|paid",
      "notes": "How to use it"
    }
  ],
  "strategy_recommendations": [
    "Actionable recommendation for future searches"
  ],
  "not_found": ["months still not found"],
  "notes": "observations about AD digital availability"
}"""

        elif strategy["type"] == "verify":
            task = """Do a broad search to find any Architectural Digest issues (1988-2024) we might have missed.

Try these searches:
1. Archive.org: different query variations (subject, creator "Condé Nast", collection "magazine_rack")
2. Web search: "Architectural Digest magazine archive digital collection"
3. Check if any digital library or magazine archive has a comprehensive AD collection

Report what you find — new sources, new issues, or confirmation that our collection is complete."""

            response_format = """Respond with ONLY a JSON object:
{
  "found_issues": [
    {
      "identifier": "id_or_url",
      "title": "description",
      "year": 2005,
      "month": 3,
      "source": "where you found it",
      "confidence": "high|medium|low"
    }
  ],
  "new_sources": ["description of any new sources discovered"],
  "notes": "observations about AD digital availability"
}"""

        return f"""You are the Scout agent for the AD-Epstein Index project.

Your mission: Find every issue of Architectural Digest magazine from January 1988 through December 2024. That's {TOTAL_EXPECTED} issues total (12 per year × {MAX_YEAR - MIN_YEAR + 1} years).

Current progress:
{gap_summary}

Your task this cycle: {strategy['description']}

{task}

{response_format}

Important:
- We ONLY care about issues from {MIN_YEAR} to {MAX_YEAR}
- Skip pre-1988 issues entirely
- Combined issues (Jul/Aug) count as one issue for that month range
- International editions should be excluded — US edition only
- Be thorough but focused — quality over quantity

Context from skills file:
{skills}

Prior knowledge (what's worked and what hasn't):
{self._get_knowledge_summary()}"""

    # ── Claude CLI ─────────────────────────────────────────────────

    def _call_claude(self, prompt):
        """Call Claude Code CLI. Returns output text or None."""
        cmd = [
            "claude",
            "-p", prompt,
            "--model", "haiku",
            "--allowedTools", *ALLOWED_TOOLS,
            "--no-session-persistence",
            "--output-format", "text",
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,
                cwd=BASE_DIR,
            )

            if result.returncode != 0:
                self.log(f"Claude CLI error: {result.stderr[:200]}", level="ERROR")
                return None

            return result.stdout.strip()

        except subprocess.TimeoutExpired:
            self.log("Claude CLI timed out (5 min limit)", level="WARN")
            return None
        except FileNotFoundError:
            self.log("Claude CLI not found — is it installed?", level="ERROR")
            return None
        except Exception as e:
            self.log(f"Claude CLI failed: {e}", level="ERROR")
            return None

    # ── Result Parsing ─────────────────────────────────────────────

    def _parse_findings(self, result):
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

        self.log("Could not parse findings from Claude response", level="WARN")
        return None

    # ── Apply Findings ─────────────────────────────────────────────

    def _apply_findings(self, manifest, findings, strategy):
        """Merge findings into the manifest. Returns count of changes."""
        changes = 0
        issues = manifest.get("issues", [])
        existing_ids = {i["identifier"]: i for i in issues}

        if strategy["type"] == "fix_dates":
            for verified in findings.get("verified_issues", []):
                ident = verified.get("identifier")
                year = verified.get("year")
                month = verified.get("month")
                confidence = verified.get("confidence", "low")

                if not ident or not year:
                    continue

                if ident in existing_ids:
                    issue = existing_ids[ident]
                    old_year = issue.get("year")
                    issue["year"] = year
                    issue["month"] = month
                    issue["date_confidence"] = confidence
                    issue["date_source"] = verified.get("source", "scout_verified")
                    issue["needs_review"] = confidence == "low"
                    if year != old_year:
                        changes += 1
                        self.log(f"Date fixed: {ident} → {year}-{month or '??'} ({confidence})")

        elif strategy["type"] in ("scrape_ad_archive", "fill_gaps", "verify", "explore_sources"):
            for found in findings.get("found_issues", []):
                ident = found.get("identifier", "")
                if not ident or ident in existing_ids:
                    continue

                year = found.get("year")
                month = found.get("month")
                if not year or year < MIN_YEAR or year > MAX_YEAR:
                    continue

                issues.append({
                    "identifier": ident,
                    "title": found.get("title", ""),
                    "month": month,
                    "year": year,
                    "date": None,
                    "status": "discovered",
                    "pdf_path": None,
                    "needs_review": found.get("confidence", "low") == "low",
                    "date_confidence": found.get("confidence", "medium"),
                    "date_source": found.get("source", "scout_search"),
                    "source_url": found.get("url"),
                })
                changes += 1
                self.log(f"New issue found: {year}-{month or '??'} ({ident[:40]})")

            # Log notes about new sources
            for note in findings.get("new_sources", []):
                self.log(f"New source discovered: {note}")

        # Re-sort by year/month
        issues.sort(key=lambda x: (x.get("year") or 9999, x.get("month") or 99))
        manifest["issues"] = issues

        return changes

    # ── Main Work Loop ─────────────────────────────────────────────

    async def work(self):
        skills = self.load_skills()
        manifest = self._load_manifest()
        gap_report = self._analyze_gaps(manifest)

        strategy = self._pick_strategy(gap_report, manifest)

        self._current_task = f"{strategy['type']}: {strategy['description'][:50]}"
        self.log(f"Scout strategy: {strategy['type']} — {strategy['description']}")

        prompt = self._build_prompt(strategy, gap_report, skills)
        result = await asyncio.to_thread(self._call_claude, prompt)

        strategy_success = False

        if not result:
            self._current_task = f"Failed — {strategy['type']}"
            self._record_learning("failed_strategies", {
                "strategy": f"{strategy['type']}: {strategy['description'][:80]}",
                "reason": "Claude CLI returned no result",
            })
            self._recent_strategy_results.append({
                "type": strategy["type"], "success": False,
            })
            self._maybe_escalate(gap_report, strategy["type"], strategy_failed=True)
            self._cycle_count += 1
            self._save_scout_log()
            return False

        findings = self._parse_findings(result)
        if findings:
            changes = self._apply_findings(manifest, findings, strategy)
            self._save_manifest_with_findings(findings, strategy)

            # Track search attempts for fill_gaps strategy
            if strategy["type"] == "fill_gaps":
                found_months = set()
                for issue in findings.get("found_issues", []):
                    y, m = issue.get("year"), issue.get("month")
                    if y and m:
                        found_months.add(f"{y}-{m:02d}")
                for month_key in strategy["batch"]:
                    if month_key in found_months:
                        self._record_search_attempt(month_key, found=True)
                    else:
                        self._record_search_attempt(month_key, found=False)
                        self.log(f"Not found (will cooldown): {month_key}")

            # ── Record learnings ──
            found_issues = findings.get("found_issues", [])
            strategy_success = changes > 0

            if found_issues:
                # Record successful source
                sources_used = set(f.get("source", "unknown") for f in found_issues)
                years_found = [f.get("year") for f in found_issues if f.get("year")]
                year_range = (f"{min(years_found)}-{max(years_found)}"
                              if years_found else "unknown")
                for src in sources_used:
                    src_count = sum(1 for f in found_issues if f.get("source") == src)
                    self._record_learning("successful_sources", {
                        "source": src,
                        "query": strategy["type"],
                        "found_count": src_count,
                        "year_range": year_range,
                    })

            if not found_issues and strategy["type"] in ("fill_gaps", "explore_sources"):
                self._record_learning("failed_strategies", {
                    "strategy": f"{strategy['type']}: {strategy['description'][:80]}",
                    "reason": findings.get("notes", "No issues found"),
                })

            # Record new sources discovered (explore_sources returns structured sources)
            new_sources = findings.get("new_sources", [])
            for src in new_sources:
                if isinstance(src, dict):
                    self._record_learning("source_notes", {
                        "source": src.get("name", "unknown"),
                        "note": f"{src.get('coverage', '')} — access: {src.get('access', '?')}. {src.get('notes', '')}",
                    })
                elif isinstance(src, str):
                    self._record_learning("source_notes", {
                        "source": "discovered",
                        "note": src,
                    })

            # Record strategy recommendations as insights
            for rec in findings.get("strategy_recommendations", []):
                self._record_learning("insights", {"text": rec})

            # Record general notes as insights if substantive
            notes = findings.get("notes", "")
            if notes and len(notes) > 20:
                self._record_learning("insights", {"text": notes})

            # Re-analyze after changes
            updated = self._analyze_gaps(manifest)
            self._current_task = (
                f"{changes} changes — {updated['total_confirmed']}/{TOTAL_EXPECTED} "
                f"({updated['coverage_pct']}%)"
            )
            self.log(
                f"Scout complete: {changes} changes, "
                f"{updated['total_confirmed']}/{TOTAL_EXPECTED} confirmed "
                f"({updated['coverage_pct']}%)"
            )
        else:
            self._current_task = f"No findings — {strategy['type']}"
            strategy_success = False
            # If fill_gaps returned nothing at all, mark entire batch as failed
            if strategy["type"] == "fill_gaps":
                for month_key in strategy["batch"]:
                    self._record_search_attempt(month_key, found=False)
            self._record_learning("failed_strategies", {
                "strategy": f"{strategy['type']}: {strategy['description'][:80]}",
                "reason": "Could not parse findings from response",
            })

        # Track strategy result for escalation logic
        self._recent_strategy_results.append({
            "type": strategy["type"],
            "success": strategy_success,
        })
        # Keep only last 10
        self._recent_strategy_results = self._recent_strategy_results[-10:]

        # Check if we should escalate to the Editor
        if not strategy_success:
            self._maybe_escalate(gap_report, strategy["type"], strategy_failed=True)

        self._cycle_count += 1
        self._save_scout_log()
        return True

    def get_progress(self):
        manifest = self._load_manifest()
        gap_report = self._analyze_gaps(manifest)
        on_cooldown = sum(1 for m in gap_report["missing_months"] if self._is_on_cooldown(m))
        exhausted = sum(
            1 for m in gap_report["missing_months"]
            if self._search_attempts.get(m, {}).get("attempts", 0) >= MAX_SEARCH_ATTEMPTS
        )
        return {
            "current": gap_report["total_confirmed"],
            "total": TOTAL_EXPECTED,
            "on_cooldown": on_cooldown,
            "exhausted": exhausted,
        }
