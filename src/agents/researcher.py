"""
Researcher Agent — tenacious investigator that builds dossiers on Epstein-linked leads.

Hub-and-spoke model: Editor can assign investigate_lead tasks via inbox.
When no task is assigned, falls back to legacy work() loop which
self-manages lead discovery and investigation.

3-STEP INVESTIGATION PIPELINE:
  Step 1 — TRIAGE (Haiku): Quick check for temporal impossibility, non-persons,
           obviously common names. ~$0.001 per lead. COINCIDENCE → dismiss early.
  Step 2 — DEEP ANALYSIS (Sonnet + images): Full investigation with article page
           images for visual design analysis. ~$0.03 per lead.
  Step 3 — SYNTHESIS (Sonnet): Cross-lead patterns, final strength rating,
           complete dossier. ~$0.02 per lead.

Total cost: ~$0.001 for COINCIDENCE, ~$0.05 for full investigation.

All dossiers persisted to Supabase (dossiers table) with disk backup.
Article page images uploaded to Supabase Storage (dossier-images bucket).

Interval: 120s — investigation is thorough but not time-critical.
"""

import asyncio
import json
import os
import shutil
import sys
import tempfile
import time
from collections import Counter
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agents.base import Agent, DATA_DIR
from agents.tasks import TaskResult

XREF_DIR = os.path.join(DATA_DIR, "cross_references")
DOSSIERS_DIR = os.path.join(DATA_DIR, "dossiers")
RESULTS_PATH = os.path.join(XREF_DIR, "results.json")
ESCALATION_PATH = os.path.join(DATA_DIR, "researcher_escalations.json")
LOG_PATH = os.path.join(DATA_DIR, "researcher_log.json")
EXTRACTIONS_DIR = os.path.join(DATA_DIR, "extractions")

LEAD_VERDICTS = {"confirmed_match", "likely_match", "possible_match", "needs_review"}

ESCALATION_COOLDOWN_HOURS = 1
MAX_INVESTIGATION_FAILURES = 3  # Skip name after 3 failed investigations

# Priority ordering for lead investigation
VERDICT_PRIORITY = {
    "confirmed_match": 0,
    "likely_match": 1,
    "possible_match": 2,
    "needs_review": 3,
}

# Model IDs
HAIKU_MODEL = "claude-haiku-4-5-20251001"
SONNET_MODEL = "claude-sonnet-4-5-20250929"

# Rate limit pause between Sonnet calls
SONNET_PAUSE_SECONDS = 2


class ResearcherAgent(Agent):
    def __init__(self):
        super().__init__("researcher", interval=120)
        self._investigated = 0
        self._dossiers_built = 0
        self._client = None

    def _get_client(self):
        """Lazy-init the Anthropic client."""
        if self._client is None:
            import anthropic
            self._client = anthropic.Anthropic()
        return self._client

    # ═══════════════════════════════════════════════════════════
    # HUB-AND-SPOKE: execute() — for targeted investigation tasks
    # ═══════════════════════════════════════════════════════════

    async def execute(self, task):
        """Execute an investigate_lead task from the Editor."""
        if task.type != "investigate_lead":
            return TaskResult(
                task_id=task.id, task_type=task.type, status="failure",
                result={}, error=f"Researcher doesn't handle '{task.type}'",
                agent=self.name,
            )

        name = task.params.get("name", "")
        lead = task.params.get("lead", {})
        if not name:
            return TaskResult(
                task_id=task.id, task_type=task.type, status="failure",
                result={"name": name}, error="No name provided",
                agent=self.name,
            )

        self._current_task = f"Investigating {name}..."
        skills = self.load_skills()

        # Task briefing is now on task.briefing (built by base.run())
        briefing = getattr(task, 'briefing', '')
        if briefing:
            self.log(f"Briefing: {briefing[:120]}")

        try:
            dossier = await asyncio.to_thread(
                self._investigate_match, lead, skills, briefing
            )
            self._save_dossier(name, dossier)
            if lead.get("feature_id"):
                self._mark_investigated(lead["feature_id"])
            self._dossiers_built += 1

            strength = dossier.get("connection_strength", "UNKNOWN")
            triage = dossier.get("triage_result", "investigate")

            # Post learned patterns based on investigation outcome
            try:
                self._post_task_learning(
                    "investigate_lead",
                    f"Investigated {name}: {strength}. Triage: {triage}. "
                    f"{'Pattern correlations found.' if dossier.get('pattern_analysis') else 'No pattern correlations.'}"
                )
            except Exception:
                pass

            # Commit investigation result to episodic memory
            try:
                self.commit_episode(
                    "investigate_lead",
                    f"Investigated {name}: {strength}. "
                    f"Triage: {triage}. "
                    f"Findings: {', '.join(dossier.get('key_findings', [])[:2]) or 'none'}",
                    "success",
                    {"name": name, "strength": strength, "triage": triage},
                )
            except Exception:
                pass

            # Post bulletin for significant findings
            if strength in ("HIGH", "MEDIUM"):
                try:
                    self.post_bulletin(
                        f"Investigation complete: {name} — {strength} connection strength",
                        tags=["investigation", "match", strength.lower()],
                    )
                except Exception:
                    pass

            # Extract metadata for Editor's Supabase persistence
            meta = dossier.pop("_meta", {})

            return TaskResult(
                task_id=task.id, task_type=task.type, status="success",
                result={
                    "name": name,
                    "dossier": dossier,
                    "connection_strength": strength,
                    "triage_result": triage,
                    "feature_id": meta.get("feature_id") or lead.get("feature_id"),
                    "image_paths": meta.get("image_paths", []),
                    "page_numbers": meta.get("page_numbers", []),
                    "temp_dir": meta.get("temp_dir"),
                },
                agent=self.name,
            )

        except Exception as e:
            # Use problem_solve to diagnose investigation failure
            try:
                decision = await asyncio.to_thread(
                    self.problem_solve,
                    error=str(e)[:200],
                    context={"name": name, "feature_id": lead.get("feature_id"),
                             "verdict": lead.get("combined_verdict", "")},
                    strategies={
                        "retry_simpler": "Simplify investigation — skip image analysis",
                        "triage_only": "Just run triage step, skip deep analysis",
                        "skip_lead": "Lead data may be corrupted — mark for manual review",
                        "escalate": "Persistent failure — needs Editor attention",
                    },
                )
                self.log(f"Investigation problem: {decision.get('diagnosis', '?')} → {decision.get('strategy', '?')}")
            except Exception:
                pass

            # Commit failure episode
            try:
                self.commit_episode(
                    "investigate_lead",
                    f"Investigation FAILED for {name}: {str(e)[:100]}",
                    "failure",
                    {"name": name, "error": str(e)[:100]},
                )
            except Exception:
                pass

            return TaskResult(
                task_id=task.id, task_type=task.type, status="failure",
                result={"name": name}, error=str(e),
                agent=self.name,
            )

    # ── Main Work Loop ──────────────────────────────────────────

    async def work(self):
        skills = self.load_skills()

        # Find leads that haven't been investigated yet
        uninvestigated = self._find_uninvestigated_leads()

        if not uninvestigated:
            self._current_task = f"{self._dossiers_built} dossiers built — waiting for leads"
            return False

        # Investigate one lead per cycle (thorough, not rushed)
        lead = uninvestigated[0]
        name = lead.get("homeowner_name", "Unknown")
        verdict = lead.get("combined_verdict", "bb_match")
        self._current_task = f"Investigating {name} ({verdict})..."
        self.log(f"Investigating lead: {name} (verdict: {verdict})")

        # Recall past episodes about this name or similar investigations
        try:
            past = self.recall_episodes(
                f"investigation {name} dossier evidence",
                task_type="investigate_lead", n=3,
            )
            if past:
                self.log(f"Memory: {len(past)} relevant episodes recalled")
        except Exception:
            pass

        # Narrate the start of investigation
        try:
            self.narrate(f"Starting investigation on {name} — {verdict} verdict, {len(uninvestigated)} leads in queue")
        except Exception:
            pass

        try:
            dossier = await asyncio.to_thread(
                self._investigate_match, lead, skills
            )
            self._save_dossier(name, dossier)
            self._mark_investigated(lead["feature_id"])
            self._dossiers_built += 1
            self._investigated += 1

            strength = dossier.get("connection_strength", "UNKNOWN")
            triage = dossier.get("triage_result", "investigate")
            self._current_task = f"Dossier: {name} ({strength})"
            self.log(f"Dossier complete: {name} — {strength} (triage: {triage})")

            # Commit investigation episode to memory
            try:
                findings = dossier.get("key_findings", [])
                self.commit_episode(
                    "investigate_lead",
                    f"Dossier complete: {name} — {strength}. "
                    f"Triage: {triage}. "
                    f"Findings: {', '.join(findings[:2]) or 'none'}. "
                    f"Patterns: {bool(dossier.get('pattern_analysis'))}",
                    "success",
                    {"name": name, "strength": strength, "triage": triage},
                )
            except Exception:
                pass

            # Post bulletin for significant findings
            if strength in ("HIGH", "MEDIUM"):
                try:
                    self.post_bulletin(
                        f"Dossier complete: {name} — {strength} connection strength. "
                        f"Key findings: {', '.join(dossier.get('key_findings', [])[:2]) or 'pending review'}",
                        tags=["investigation", "dossier", strength.lower()],
                    )
                except Exception:
                    pass

            # Narrate the result
            try:
                self.narrate(
                    f"Finished dossier on {name}: {strength} connection. "
                    f"Triage was '{triage}'. {self._dossiers_built} total dossiers built."
                )
            except Exception:
                pass

            # Extract metadata for Editor's Supabase persistence
            meta = dossier.pop("_meta", {})

            # Push result to outbox so Editor can review as gatekeeper
            await self.outbox.put(TaskResult(
                task_id=f"work_{lead['feature_id']}",
                task_type="investigate_lead",
                status="success",
                result={
                    "name": name,
                    "dossier": dossier,
                    "connection_strength": strength,
                    "triage_result": triage,
                    "feature_id": meta.get("feature_id") or lead["feature_id"],
                    "image_paths": meta.get("image_paths", []),
                    "page_numbers": meta.get("page_numbers", []),
                    "temp_dir": meta.get("temp_dir"),
                },
                agent=self.name,
            ))

            # Update run log
            self._update_run_log(success=True, has_patterns=bool(dossier.get("pattern_analysis")))

            # Maybe escalate based on findings
            self._maybe_escalate_findings(name, dossier)

        except Exception as e:
            self.log(f"Investigation failed for {name}: {e}", level="ERROR")
            self._current_task = f"Investigation failed — {name}"
            self._update_run_log(success=False, failed_name=name)

            # Use problem_solve for intelligent recovery
            try:
                decision = await asyncio.to_thread(
                    self.problem_solve,
                    error=str(e)[:200],
                    context={
                        "name": name,
                        "feature_id": lead.get("feature_id"),
                        "verdict": verdict,
                        "dossiers_built": self._dossiers_built,
                    },
                    strategies={
                        "retry_simpler": "Simplify investigation — skip image analysis or pattern context",
                        "triage_only": "Just run triage, skip deep analysis and synthesis",
                        "skip_lead": "Lead data may be corrupted — move to next lead",
                        "escalate": "Persistent failure — needs Editor attention",
                    },
                )
                self.log(f"Problem solve: {decision.get('diagnosis', '?')} → {decision.get('strategy', '?')}")
            except Exception:
                pass

            # Commit failure episode
            try:
                self.commit_episode(
                    "investigate_lead",
                    f"Investigation FAILED for {name}: {str(e)[:100]}",
                    "failure",
                    {"name": name, "error": str(e)[:100], "verdict": verdict},
                )
            except Exception:
                pass

            self._maybe_escalate(
                "investigation_failed",
                f"Investigation failed for {name}: {e}",
                {"name": name, "feature_id": lead.get("feature_id"), "error": str(e)},
            )

        return True

    # ── Lead Discovery ──────────────────────────────────────────

    def _load_results(self):
        """Load cross-reference results from disk."""
        if not os.path.exists(RESULTS_PATH):
            return []
        try:
            with open(RESULTS_PATH) as f:
                return json.load(f)
        except Exception:
            return []

    def _find_uninvestigated_leads(self):
        """Find leads to investigate. Primary: Supabase YES verdicts. Fallback: results.json.

        Checks Supabase features with detective_verdict='YES' that don't have a dossier yet.
        Falls back to legacy results.json for pre-refactor data.
        """
        investigated_ids = self._load_investigated_ids()
        run_log = self._load_run_log()
        failures = run_log.get("investigation_failures", {})

        leads = []

        # Primary: Supabase features with detective_verdict='YES', enriched with xref data
        try:
            from db import get_supabase, get_dossier, get_cross_reference
            sb = get_supabase()
            result = (
                sb.table("features")
                .select("id, homeowner_name, issue_id")
                .eq("detective_verdict", "YES")
                .execute()
            )
            for feat in result.data:
                feature_id = feat["id"]
                name = (feat.get("homeowner_name") or "").strip()
                if not name:
                    continue
                if feature_id in investigated_ids:
                    continue
                if failures.get(name, 0) >= MAX_INVESTIGATION_FAILURES:
                    continue
                # Skip if dossier exists
                try:
                    if get_dossier(feature_id):
                        continue
                except Exception:
                    pass

                # Enrich with xref data from Supabase cross_references
                xref = {}
                try:
                    xref = get_cross_reference(feature_id) or {}
                except Exception:
                    pass

                leads.append({
                    "feature_id": feature_id,
                    "homeowner_name": name,
                    "combined_verdict": xref.get("combined_verdict", "yes_verdict"),
                    "black_book_status": xref.get("black_book_status", "unknown"),
                    "black_book_matches": xref.get("black_book_matches"),
                    "doj_status": xref.get("doj_status", "unknown"),
                    "doj_results": xref.get("doj_results"),
                    "confidence_score": float(xref.get("confidence_score") or 0.5),
                })
        except Exception:
            pass  # Fall through to legacy path

        # Fallback: legacy results.json for pre-refactor data
        if not leads:
            results = self._load_results()
            for r in results:
                if r.get("feature_id") in investigated_ids:
                    continue
                name = r.get("homeowner_name", "")
                if failures.get(name, 0) >= MAX_INVESTIGATION_FAILURES:
                    continue
                verdict = r.get("combined_verdict", "")
                bb_match = r.get("black_book_status") == "match"
                if verdict in LEAD_VERDICTS or bb_match:
                    leads.append(r)

        # Priority: confirmed > likely > possible > needs_review > other
        leads.sort(key=lambda r: VERDICT_PRIORITY.get(r.get("combined_verdict", ""), 4))
        return leads

    def _load_investigated_ids(self):
        """Load set of feature IDs that have been investigated."""
        path = os.path.join(DOSSIERS_DIR, "investigated_ids.json")
        if os.path.exists(path):
            try:
                with open(path) as f:
                    return set(json.load(f))
            except Exception:
                pass
        return set()

    def _mark_investigated(self, feature_id):
        """Mark a feature as investigated."""
        ids = self._load_investigated_ids()
        ids.add(feature_id)
        os.makedirs(DOSSIERS_DIR, exist_ok=True)
        path = os.path.join(DOSSIERS_DIR, "investigated_ids.json")
        with open(path, "w") as f:
            json.dump(list(ids), f)

    # ── AD Context (Supabase + Disk Fallback) ───────────────────

    def _find_ad_context(self, feature_id):
        """Look up full AD feature data from Supabase, fall back to disk."""
        try:
            from db import get_supabase
            sb = get_supabase()
            resp = sb.table("features").select("*").eq("id", feature_id).execute()
            if resp.data:
                row = resp.data[0]
                issue_id = row.get("issue_id")
                if issue_id:
                    issue_resp = sb.table("issues").select("month, year, pdf_path, identifier").eq("id", issue_id).execute()
                    if issue_resp.data:
                        row["issue_month"] = issue_resp.data[0].get("month")
                        row["issue_year"] = issue_resp.data[0].get("year")
                        row["pdf_path"] = issue_resp.data[0].get("pdf_path")
                        row["identifier"] = issue_resp.data[0].get("identifier")
                return row
        except Exception:
            pass
        # Fall back to disk
        return self._find_ad_context_disk(feature_id)

    def _find_ad_context_disk(self, feature_id):
        """Look up the AD feature data from extraction JSON files on disk."""
        if not os.path.exists(EXTRACTIONS_DIR):
            return None

        for fname in os.listdir(EXTRACTIONS_DIR):
            if not fname.endswith(".json"):
                continue
            fpath = os.path.join(EXTRACTIONS_DIR, fname)
            try:
                with open(fpath) as f:
                    data = json.load(f)
                issue_label = data.get("title", fname.replace(".json", ""))
                month = data.get("verified_month") or data.get("month")
                year = data.get("verified_year") or data.get("year")
                for feat in data.get("features", []):
                    if feat.get("id") == feature_id:
                        result = {
                            "issue": issue_label,
                            "issue_month": month,
                            "issue_year": year,
                        }
                        for key in ("homeowner_name", "article_title", "designer_name",
                                    "architecture_firm", "year_built", "square_footage",
                                    "cost", "location_city", "location_state",
                                    "location_country", "design_style", "page_number", "notes"):
                            val = feat.get(key)
                            if val is not None:
                                result[key] = val
                        return result
            except Exception:
                continue
        return None

    # ── Pattern Analysis ────────────────────────────────────────

    def _fetch_features_batch(self, feature_ids):
        """Fetch multiple features from Supabase, fall back to disk."""
        try:
            from db import get_supabase
            sb = get_supabase()
            resp = sb.table("features").select("*").in_("id", feature_ids).execute()
            if resp.data:
                return resp.data
        except Exception:
            pass

        # Fall back to disk
        features = []
        id_set = set(feature_ids)
        if os.path.exists(EXTRACTIONS_DIR):
            for fname in os.listdir(EXTRACTIONS_DIR):
                if not fname.endswith(".json"):
                    continue
                try:
                    with open(os.path.join(EXTRACTIONS_DIR, fname)) as f:
                        data = json.load(f)
                    issue_label = data.get("title", fname.replace(".json", ""))
                    month = data.get("verified_month") or data.get("month")
                    year = data.get("verified_year") or data.get("year")
                    for feat in data.get("features", []):
                        if feat.get("id") in id_set:
                            feat["issue"] = issue_label
                            feat["issue_month"] = month
                            feat["issue_year"] = year
                            features.append(feat)
                except Exception:
                    continue

        return features

    def _build_pattern_context(self, current_name):
        """Analyze patterns across all Epstein-associated features."""
        results = self._load_results()
        associated_ids = [
            r["feature_id"] for r in results
            if r.get("combined_verdict", "no_match") != "no_match"
            or r.get("black_book_status") == "match"
        ]

        if not associated_ids:
            return None

        features = self._fetch_features_batch(associated_ids)
        if not features:
            return None

        patterns = {
            "total_associated": len(features),
            "design_styles": dict(Counter(
                f.get("design_style") for f in features if f.get("design_style")
            )),
            "designers": dict(Counter(
                f.get("designer_name") for f in features if f.get("designer_name")
            )),
            "architects": dict(Counter(
                f.get("architecture_firm") for f in features if f.get("architecture_firm")
            )),
            "locations": dict(Counter(
                f"{f.get('location_city', '')}, {f.get('location_state', '')}".strip(", ")
                for f in features if f.get("location_city") or f.get("location_state")
            )),
            "decades": dict(Counter(
                str(f.get("year_built", ""))[:3] + "0s"
                for f in features if f.get("year_built")
            )),
            "issue_years": dict(Counter(
                f.get("issue_year") for f in features if f.get("issue_year")
            )),
        }

        current_feature = next(
            (f for f in features
             if (f.get("homeowner_name") or "").lower() == current_name.lower()),
            None
        )
        correlations = []
        if current_feature:
            style = current_feature.get("design_style")
            designer = current_feature.get("designer_name")
            city = current_feature.get("location_city")

            if style and patterns["design_styles"].get(style, 0) > 1:
                others = patterns["design_styles"][style] - 1
                correlations.append(
                    f"Design style '{style}' shared with {others} other associated name(s)"
                )
            if designer and patterns["designers"].get(designer, 0) > 1:
                others = patterns["designers"][designer] - 1
                correlations.append(
                    f"Designer '{designer}' also worked for {others} other associated name(s)"
                )
            if city:
                loc_key = f"{city}, {current_feature.get('location_state', '')}".strip(", ")
                if patterns["locations"].get(loc_key, 0) > 1:
                    correlations.append(
                        f"Location '{loc_key}' shared with other associated names"
                    )

        patterns["correlations_for_current"] = correlations
        return patterns

    # ═══════════════════════════════════════════════════════════
    # 3-STEP INVESTIGATION PIPELINE
    # ═══════════════════════════════════════════════════════════

    def _investigate_match(self, match, skills, briefing=""):
        """Build a dossier using 3-step pipeline: triage → deep analysis → synthesis."""
        name = match.get("homeowner_name", "Unknown")
        feature_id = match.get("feature_id")
        combined_verdict = match.get("combined_verdict", "")

        # Build shared context used by all steps
        context = self._build_investigation_context(match)
        if briefing:
            context["briefing"] = briefing

        self.log(f"Step 1: Triage — {name}")

        # ── STEP 1: TRIAGE (Haiku — fast, cheap) ──────────────
        triage = self._step_triage(context, skills)

        if triage.get("result") == "coincidence":
            self.log(f"  Triaged out: {name} — {triage.get('reasoning', '?')[:80]}")
            dossier = self._build_coincidence_dossier(match, context, triage)
            # Tag for image/supabase flow (no images for coincidence)
            dossier["_feature_id"] = feature_id
            dossier["_image_paths"] = []
            dossier["_temp_dir"] = None
            return dossier

        # ── STEP 2: DEEP ANALYSIS (Sonnet + images) ──────────
        self.log(f"Step 2: Deep analysis — {name}")
        time.sleep(SONNET_PAUSE_SECONDS)

        # Extract article page images if PDF available
        image_info = self._extract_article_images(feature_id, context)

        step2_result = self._step_deep_analysis(context, image_info, skills)

        # ── STEP 3: SYNTHESIS (Sonnet — patterns + final) ─────
        self.log(f"Step 3: Synthesis — {name}")
        time.sleep(SONNET_PAUSE_SECONDS)

        pattern_context = self._build_pattern_context(name)
        dossier = self._step_synthesis(context, step2_result, pattern_context, triage, skills)

        # Ensure required fields
        dossier["investigated_at"] = datetime.now().isoformat()
        dossier["combined_verdict"] = combined_verdict
        dossier["triage_result"] = "investigate"
        dossier["triage_reasoning"] = triage.get("reasoning", "")

        # Tag for image/supabase flow
        dossier["_feature_id"] = feature_id
        dossier["_image_paths"] = image_info.get("image_paths", [])
        dossier["_page_numbers"] = image_info.get("page_numbers", [])
        dossier["_temp_dir"] = image_info.get("temp_dir")

        return dossier

    def _build_investigation_context(self, match):
        """Build the shared context dict used across all pipeline steps."""
        name = match.get("homeowner_name", "Unknown")
        bb_matches = match.get("black_book_matches") or []
        feature_id = match.get("feature_id")

        context = {
            "name": name,
            "feature_id": feature_id,
            "combined_verdict": match.get("combined_verdict", ""),
            "confidence_score": match.get("confidence_score"),
            "black_book_status": match.get("black_book_status"),
            "black_book_matches": bb_matches,
            "doj_status": match.get("doj_status", "pending"),
            "doj_results": match.get("doj_results"),
        }

        # Full AD feature data
        ad_context = self._find_ad_context(feature_id)
        if ad_context:
            context["ad_feature"] = ad_context

        # Black Book surrounding text
        bb_contexts = []
        for m in bb_matches:
            if m.get("context"):
                bb_contexts.append(m["context"])
        context["black_book_context"] = bb_contexts

        return context

    # ── Step 1: Triage ─────────────────────────────────────────

    def _step_triage(self, context, skills):
        """Quick triage: COINCIDENCE or investigate? Uses Haiku (~$0.001)."""
        client = self._get_client()

        system_prompt = """You are the Researcher triage agent. Your ONLY job is to quickly determine
if a lead is worth investigating or is obviously a COINCIDENCE (false positive).

Check for:
1. TEMPORAL IMPOSSIBILITY: Person died before 1980 or born after 2000 → coincidence
2. NON-PERSON ENTITY: Hotels, palaces, resorts, clubs, studios → coincidence
3. CLEARLY DIFFERENT PERSON: DOJ results clearly reference someone with a different first name → coincidence
4. HISTORIC RETROSPECTIVE: AD article about a property from 1800s/early 1900s → likely coincidence
5. NO EVIDENCE AT ALL: No BB match AND no DOJ results → coincidence

CRITICAL RULES:
- NEVER dismiss someone as COINCIDENCE just because they are famous, a celebrity, or a public figure.
  Famous people CAN and DO appear in Epstein records. Fame is NOT evidence against a connection.
- If someone has a Black Book match (any type), they MUST be investigated. A Black Book match means
  their name and contact info appeared in Epstein's personal contact book — that is direct evidence.
- The ONLY valid reasons for COINCIDENCE are the 5 checks above. "This person is too prominent" is NOT valid.

Respond with JSON only:
{
  "result": "investigate" or "coincidence",
  "reasoning": "1-2 sentence explanation",
  "temporal_check": "passed" or "failed: reason"
}

Be aggressive about filtering COINCIDENCE — you save expensive Sonnet calls.
But when in doubt, choose "investigate" — better to spend $0.05 than miss a real lead."""

        briefing_section = ""
        if context.get("briefing"):
            briefing_section = f"\n\nCONTEXT FROM PAST EXPERIENCE:\n{context['briefing']}\n"

        user_msg = f"""Triage this lead:

Name: {context['name']}
Combined verdict: {context['combined_verdict']}
Black Book status: {context['black_book_status']}
BB matches: {json.dumps(context.get('black_book_matches', []), default=str)[:500]}
DOJ status: {context['doj_status']}
DOJ results summary: {json.dumps(context.get('doj_results', {}), default=str)[:800]}
AD feature: {json.dumps(context.get('ad_feature', {}), default=str)[:500]}{briefing_section}

Should this lead be fully investigated or dismissed as COINCIDENCE?"""

        response = client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=512,
            system=system_prompt,
            messages=[{"role": "user", "content": user_msg}],
        )

        return self._parse_json_response(response.content[0].text)

    # ── Step 2: Deep Analysis ──────────────────────────────────

    def _step_deep_analysis(self, context, image_info, skills):
        """Full analysis with article images. Uses Sonnet (~$0.03)."""
        client = self._get_client()

        system_prompt = f"""You are the Researcher agent for the AD-Epstein Index project.

{skills}

You are performing DEEP ANALYSIS on a lead that passed triage. You have:
1. Full AD feature data (homeowner, designer, location, style, cost, etc.)
2. Cross-reference results (Black Book matches, DOJ search results)
3. Article page images from the actual magazine (if available)

Analyze the home itself as evidence — the design style, wealth signals, designer choices,
and location all reveal the person's social world.

If article images are provided, perform VISUAL ANALYSIS:
- What does the photography/layout reveal about the home's scale and luxury level?
- What design elements are visible (materials, art, furnishings)?
- Do the visuals suggest a particular social milieu?

Respond with JSON only:
{{
  "ad_appearance": {{
    "issue": "Month Year",
    "location": "City, State/Country",
    "designer": "Interior designer name",
    "architecture_firm": "Firm name or null",
    "design_style": "Style name or null",
    "year_built": "Year or null",
    "square_footage": "Sq ft or null",
    "cost": "Cost or null",
    "article_title": "Title or null",
    "notes": "Any relevant notes"
  }},
  "home_analysis": {{
    "wealth_indicators": "What the home's cost, size, and location reveal",
    "social_circle_clues": "What the designer choice and neighborhood suggest",
    "style_significance": "How the design style relates to Epstein associate patterns",
    "temporal_relevance": "Whether the timeline overlaps with Epstein's active period (1990-2008)"
  }},
  "visual_analysis": {{
    "design_aesthetic": "Overall aesthetic from the photographs",
    "wealth_signals_visual": "What the photos reveal about wealth level",
    "social_markers": "What decor/setting suggests about social circles",
    "notable_details": ["Specific visual observations from the article images"]
  }},
  "epstein_connections": [
    {{
      "source": "black_book | doj_library",
      "match_type": "exact | last_first | last_name_only",
      "evidence": "What was found",
      "context": "Surrounding text or document reference"
    }}
  ]
}}

If no images are available, set visual_analysis to null."""

        # Build message content with images
        content = []

        # Text context
        content.append({
            "type": "text",
            "text": f"""Investigate this lead in depth:

```json
{json.dumps(context, indent=2, default=str)}
```

Analyze the home, the person, and all available evidence.""",
        })

        # Add article images if available
        image_paths = image_info.get("image_paths", [])
        if image_paths:
            from extract_features import make_image_content
            content.append({
                "type": "text",
                "text": f"\n\nArticle page images from the magazine ({len(image_paths)} pages):",
            })
            for img_path in image_paths:
                try:
                    content.append(make_image_content(img_path))
                except Exception:
                    pass  # Skip unreadable images

        response = client.messages.create(
            model=SONNET_MODEL,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": content}],
        )

        return self._parse_json_response(response.content[0].text)

    # ── Step 3: Synthesis ──────────────────────────────────────

    def _step_synthesis(self, context, step2_result, pattern_context, triage, skills):
        """Cross-lead patterns, final strength, complete dossier. Uses Sonnet (~$0.02)."""
        client = self._get_client()

        # Build pattern section
        pattern_prompt = ""
        if pattern_context:
            pattern_prompt = f"""
## Pattern Analysis Context
Aggregate patterns across ALL {pattern_context['total_associated']} Epstein-associated names:

Design styles: {json.dumps(pattern_context['design_styles'])}
Designers: {json.dumps(pattern_context['designers'])}
Architects: {json.dumps(pattern_context['architects'])}
Locations: {json.dumps(pattern_context['locations'])}
Decades built: {json.dumps(pattern_context['decades'])}
Issue years: {json.dumps(pattern_context['issue_years'])}

Correlations for {context['name']}: {json.dumps(pattern_context['correlations_for_current'])}"""

        # Summarize existing dossiers for cross-lead context
        dossier_summaries = self._get_dossier_summaries()

        system_prompt = f"""You are the Researcher agent performing final SYNTHESIS.

You have the deep analysis results from Step 2 and cross-lead pattern data.
Your job: determine final connection_strength, write key findings, and produce
the complete dossier.
{pattern_prompt}

Connection strength guide:
- HIGH: Multiple sources confirm (BB + DOJ), OR pattern correlations reinforce, OR direct evidence
- MEDIUM: Single strong source with some pattern support
- LOW: Weak match with no pattern support
- COINCIDENCE: Almost certainly false positive

**CRITICAL RULES:**
1. **Black Book match = direct evidence.** If someone appears in Epstein's Little Black Book
   (last_first or full_name match), that is equivalent to appearing in the Epstein files.
   BB matches should be rated HIGH or MEDIUM at minimum — never COINCIDENCE or LOW.
2. **Fame is NOT a dismissal factor.** NEVER downgrade or dismiss someone because they are
   famous, a celebrity, or a public figure. Celebrities and prominent people DID associate
   with Epstein — that is the entire point of this investigation. "Well-known" is irrelevant
   to connection strength.
3. False positive identification matters, but only for EVIDENCE-BASED reasons:
   - DOJ results referencing a DIFFERENT person with the same surname → COINCIDENCE
   - DOJ context about contractors/vendors/services → COINCIDENCE
   - Common name + no pattern correlations + no BB match → LOW or COINCIDENCE
   - Person deceased before 1980 → COINCIDENCE

Pattern evidence can UPGRADE strength:
- Shared designer with confirmed match → upgrade one tier
- Same luxury enclave (Palm Beach, UES, etc.) → supporting evidence
- AD feature 1990-2008 → temporal correlation
- Multiple correlations → strong signal

Other dossier summaries (for cross-lead analysis):
{dossier_summaries}

Respond with the COMPLETE dossier JSON:
{{
  "subject_name": "Full name",
  "combined_verdict": "from detective",
  "confidence_score": 0.85,
  "ad_appearance": {{...from step 2...}},
  "home_analysis": {{...from step 2...}},
  "visual_analysis": {{...from step 2 or null...}},
  "epstein_connections": [...from step 2...],
  "pattern_analysis": {{
    "shared_designers": [],
    "shared_locations": [],
    "shared_styles": [],
    "temporal_clustering": "observation",
    "notable_correlations": []
  }},
  "connection_strength": "HIGH | MEDIUM | LOW | COINCIDENCE",
  "strength_rationale": "2-3 sentences with pattern evidence",
  "key_findings": ["bullet 1", "bullet 2"],
  "investigation_depth": "deep",
  "needs_manual_review": true/false,
  "review_reason": "Why, if applicable"
}}"""

        user_msg = f"""Synthesize the final dossier for: {context['name']}

Triage assessment: {json.dumps(triage, default=str)}

Step 2 deep analysis results:
```json
{json.dumps(step2_result, indent=2, default=str)}
```

Original context:
- Combined verdict: {context['combined_verdict']}
- BB status: {context['black_book_status']}
- DOJ status: {context['doj_status']}

Produce the complete dossier with final connection_strength."""

        response = client.messages.create(
            model=SONNET_MODEL,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_msg}],
        )

        return self._parse_json_response(response.content[0].text)

    # ── Image Extraction ───────────────────────────────────────

    def _extract_article_images(self, feature_id, context):
        """Extract article page images from the PDF for visual analysis.

        Returns dict with image_paths, page_numbers, temp_dir (for cleanup).
        """
        result = {"image_paths": [], "page_numbers": [], "temp_dir": None}

        # Get page number and PDF path
        ad_feature = context.get("ad_feature", {})
        page_number = ad_feature.get("page_number")
        pdf_path = ad_feature.get("pdf_path")

        if not page_number or not pdf_path or not os.path.exists(pdf_path):
            self.log(f"  No PDF/page for images (page={page_number}, pdf={pdf_path})")
            return result

        # Convert target page + next 2 pages
        pages = [page_number, page_number + 1, page_number + 2]
        temp_dir = tempfile.mkdtemp(prefix="researcher_")

        try:
            from extract_features import pdf_to_images
            image_paths = pdf_to_images(pdf_path, pages, temp_dir)
            if image_paths:
                result["image_paths"] = image_paths
                result["page_numbers"] = pages[:len(image_paths)]
                result["temp_dir"] = temp_dir
                self.log(f"  Extracted {len(image_paths)} article images")
            else:
                shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception as e:
            self.log(f"  Image extraction failed: {e}", level="WARN")
            shutil.rmtree(temp_dir, ignore_errors=True)

        return result

    # ── Coincidence Dossier ────────────────────────────────────

    def _build_coincidence_dossier(self, match, context, triage):
        """Build a minimal dossier for leads triaged as COINCIDENCE."""
        name = match.get("homeowner_name", "Unknown")
        ad_feature = context.get("ad_feature", {})

        return {
            "subject_name": name,
            "combined_verdict": match.get("combined_verdict", ""),
            "confidence_score": 0.0,
            "connection_strength": "COINCIDENCE",
            "strength_rationale": triage.get("reasoning", "Triaged as coincidence"),
            "triage_result": "coincidence",
            "triage_reasoning": triage.get("reasoning", ""),
            "ad_appearance": {
                "issue": f"{ad_feature.get('issue_month', '?')}/{ad_feature.get('issue_year', '?')}",
                "location": f"{ad_feature.get('location_city', '')}, {ad_feature.get('location_state', ad_feature.get('location_country', ''))}".strip(", "),
                "designer": ad_feature.get("designer_name"),
                "architecture_firm": ad_feature.get("architecture_firm"),
                "design_style": ad_feature.get("design_style"),
                "year_built": ad_feature.get("year_built"),
                "square_footage": ad_feature.get("square_footage"),
                "cost": ad_feature.get("cost"),
                "article_title": ad_feature.get("article_title"),
                "notes": ad_feature.get("notes"),
            },
            "home_analysis": None,
            "visual_analysis": None,
            "epstein_connections": [],
            "pattern_analysis": None,
            "key_findings": [triage.get("reasoning", "Dismissed at triage")],
            "investigation_depth": "triage_only",
            "needs_manual_review": False,
            "review_reason": None,
            "investigated_at": datetime.now().isoformat(),
        }

    # ── Dossier Summaries (for cross-lead analysis) ────────────

    def _get_dossier_summaries(self):
        """Get brief summaries of existing dossiers for cross-lead analysis."""
        try:
            from db import list_dossiers
            dossiers = list_dossiers()
            if not dossiers:
                return "No existing dossiers yet."
            lines = []
            for d in dossiers[:10]:  # Cap at 10 for prompt size
                name = d.get("subject_name", "?")
                strength = d.get("connection_strength", "?")
                lines.append(f"- {name}: {strength}")
            return "\n".join(lines)
        except Exception:
            pass

        # Fallback to disk
        master_path = os.path.join(DOSSIERS_DIR, "all_dossiers.json")
        if os.path.exists(master_path):
            try:
                with open(master_path) as f:
                    all_dossiers = json.load(f)
                lines = []
                for d in all_dossiers[:10]:
                    name = d.get("subject_name", "?")
                    strength = d.get("connection_strength", "?")
                    lines.append(f"- {name}: {strength}")
                return "\n".join(lines)
            except Exception:
                pass
        return "No existing dossiers yet."

    # ── JSON Parsing ───────────────────────────────────────────

    def _parse_json_response(self, text):
        """Parse JSON from an LLM response, handling markdown fences and partial JSON."""
        text = text.strip()
        # Strip markdown code blocks
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if "```" in text:
                text = text[:text.rindex("```")]
            text = text.strip()

        # Try direct parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Extract first complete JSON object using brace counting
        start = text.find("{")
        if start == -1:
            raise ValueError(f"No JSON object found in response: {text[:200]}")
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

        raise ValueError(f"Incomplete JSON in response (truncated?): {text[-200:]}")

    # ── Dossier Persistence (Supabase + Disk) ──────────────────

    def _save_dossier(self, name, dossier):
        """Save a dossier to disk only. Supabase persistence is handled by the Editor.

        Extracts internal metadata (_feature_id, _image_paths, etc.) and stores
        them back on the dossier dict so the caller can pass them in the TaskResult.
        """
        # Extract internal metadata (keep them available for TaskResult)
        feature_id = dossier.pop("_feature_id", None)
        image_paths = dossier.pop("_image_paths", [])
        page_numbers = dossier.pop("_page_numbers", [])
        temp_dir = dossier.pop("_temp_dir", None)

        # Store metadata back as accessible fields for the caller
        dossier["_meta"] = {
            "feature_id": feature_id,
            "image_paths": image_paths,
            "page_numbers": page_numbers,
            "temp_dir": temp_dir,
        }

        # ── Disk backup only ──
        os.makedirs(DOSSIERS_DIR, exist_ok=True)

        safe_name = "".join(c if c.isalnum() or c in " -_" else "" for c in name)
        safe_name = safe_name.strip().replace(" ", "_")
        path = os.path.join(DOSSIERS_DIR, f"{safe_name}.json")
        # Don't write _meta to disk
        disk_dossier = {k: v for k, v in dossier.items() if k != "_meta"}
        with open(path, "w") as f:
            json.dump(disk_dossier, f, indent=2)

        master_path = os.path.join(DOSSIERS_DIR, "all_dossiers.json")
        all_dossiers = []
        if os.path.exists(master_path):
            try:
                with open(master_path) as f:
                    all_dossiers = json.load(f)
            except Exception:
                all_dossiers = []

        replaced = False
        for i, d in enumerate(all_dossiers):
            if d.get("subject_name", "").lower() == name.lower():
                all_dossiers[i] = disk_dossier
                replaced = True
                break
        if not replaced:
            all_dossiers.append(disk_dossier)

        with open(master_path, "w") as f:
            json.dump(all_dossiers, f, indent=2)

    # ── Escalation System ───────────────────────────────────────

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

    def _dismiss_as_no_match(self, name, rationale):
        """Issue a verdict override to dismiss a name as no_match after investigation."""
        from agents.base import update_json_locked
        verdicts_path = os.path.join(DATA_DIR, "detective_verdicts.json")
        override = {
            "name": name,
            "verdict": "no_match",
            "reason": f"Researcher dismissed as COINCIDENCE: {rationale}",
            "queued_by": "researcher",
            "queued_time": datetime.now().isoformat(),
            "applied": False,
        }
        update_json_locked(verdicts_path, lambda data: data.append(override), default=[])
        self.log(f"Dismissed {name} as no_match (COINCIDENCE)")

    def _maybe_escalate_findings(self, name, dossier):
        """Escalate based on dossier findings."""
        strength = dossier.get("connection_strength", "").upper()

        # COINCIDENCE — auto-dismiss via verdict override
        if strength == "COINCIDENCE":
            rationale = dossier.get("strength_rationale", "False positive confirmed by Researcher")
            self._dismiss_as_no_match(name, rationale)
            return  # No need to escalate

        # High-value lead
        if strength == "HIGH":
            self._maybe_escalate(
                "high_value_lead",
                f"HIGH connection strength: {name}",
                {
                    "name": name,
                    "strength": strength,
                    "rationale": dossier.get("strength_rationale", ""),
                    "key_findings": dossier.get("key_findings", []),
                },
            )

        # Pattern detected
        pattern_analysis = dossier.get("pattern_analysis", {})
        if isinstance(pattern_analysis, dict):
            correlations = (
                pattern_analysis.get("shared_designers", [])
                + pattern_analysis.get("shared_locations", [])
                + pattern_analysis.get("shared_styles", [])
                + pattern_analysis.get("notable_correlations", [])
            )
            if correlations:
                self._maybe_escalate(
                    "pattern_detected",
                    f"Pattern correlations found for {name}: {len(correlations)} correlation(s)",
                    {
                        "name": name,
                        "correlations": correlations,
                        "temporal": pattern_analysis.get("temporal_clustering", ""),
                    },
                )

        # Needs manual review
        if dossier.get("needs_manual_review"):
            self._maybe_escalate(
                "needs_manual_review",
                f"Manual review needed: {name} — {dossier.get('review_reason', 'Ambiguous evidence')}",
                {
                    "name": name,
                    "reason": dossier.get("review_reason", ""),
                    "strength": strength,
                },
            )

    # ── Run Log ─────────────────────────────────────────────────

    def _load_run_log(self):
        """Load the researcher run log."""
        if os.path.exists(LOG_PATH):
            try:
                with open(LOG_PATH) as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "cycle_count": 0,
            "last_run": None,
            "investigated": 0,
            "dossiers_built": 0,
            "investigation_failures": {},
            "patterns_detected": 0,
        }

    def _update_run_log(self, success=True, has_patterns=False, failed_name=None):
        """Update the run log after an investigation."""
        log = self._load_run_log()
        log["cycle_count"] = log.get("cycle_count", 0) + 1
        log["last_run"] = datetime.now().isoformat()

        if success:
            log["dossiers_built"] = log.get("dossiers_built", 0) + 1
            log["investigated"] = log.get("investigated", 0) + 1
            if has_patterns:
                log["patterns_detected"] = log.get("patterns_detected", 0) + 1
        elif failed_name:
            failures = log.get("investigation_failures", {})
            failures[failed_name] = failures.get(failed_name, 0) + 1
            log["investigation_failures"] = failures

        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        with open(LOG_PATH, "w") as f:
            json.dump(log, f, indent=2)

    # ── Progress ────────────────────────────────────────────────

    def get_progress(self):
        """Progress: investigated leads / total leads."""
        investigated = len(self._load_investigated_ids())
        total_leads = 0
        results = self._load_results()
        for r in results:
            verdict = r.get("combined_verdict", "")
            if verdict in LEAD_VERDICTS or r.get("black_book_status") == "match":
                total_leads += 1
        return {"current": investigated, "total": total_leads}
