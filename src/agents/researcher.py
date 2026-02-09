"""
Researcher Agent — tenacious investigator that builds dossiers on Epstein-linked leads.

Hub-and-spoke model: Editor can assign investigate_lead tasks via inbox.
When no task is assigned, falls back to legacy work() loop which
self-manages lead discovery and investigation.

Picks up ALL leads from the Detective's combined verdicts (confirmed_match,
likely_match, possible_match, needs_review) plus legacy BB matches. Enriches
each investigation with full Supabase feature data and cross-lead pattern
analysis (shared designers, location clusters, style correlations).

Interval: 120s — investigation is thorough but not time-critical.
"""

import asyncio
import json
import os
import sys
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

        try:
            dossier = await asyncio.to_thread(
                self._investigate_match, lead, skills
            )
            self._save_dossier(name, dossier)
            if lead.get("feature_id"):
                self._mark_investigated(lead["feature_id"])
            self._dossiers_built += 1

            strength = dossier.get("connection_strength", "UNKNOWN")
            return TaskResult(
                task_id=task.id, task_type=task.type, status="success",
                result={
                    "name": name,
                    "dossier": dossier,
                    "connection_strength": strength,
                },
                agent=self.name,
            )

        except Exception as e:
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

        try:
            dossier = await asyncio.to_thread(
                self._investigate_match, lead, skills
            )
            self._save_dossier(name, dossier)
            self._mark_investigated(lead["feature_id"])
            self._dossiers_built += 1
            self._investigated += 1

            strength = dossier.get("connection_strength", "UNKNOWN")
            self._current_task = f"Dossier: {name} ({strength})"
            self.log(f"Dossier complete: {name} — {strength}")

            # Update run log
            self._update_run_log(success=True, has_patterns=bool(dossier.get("pattern_analysis")))

            # Maybe escalate based on findings
            self._maybe_escalate_findings(name, dossier)

        except Exception as e:
            self.log(f"Investigation failed for {name}: {e}", level="ERROR")
            self._current_task = f"Investigation failed — {name}"
            self._update_run_log(success=False, failed_name=name)
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
        """Find all leads (any non-no_match verdict OR BB match) not yet investigated."""
        results = self._load_results()
        investigated_ids = self._load_investigated_ids()
        run_log = self._load_run_log()
        failures = run_log.get("investigation_failures", {})

        leads = []
        for r in results:
            if r.get("feature_id") in investigated_ids:
                continue
            # Skip names that have failed too many times
            name = r.get("homeowner_name", "")
            if failures.get(name, 0) >= MAX_INVESTIGATION_FAILURES:
                continue
            # Lead if: combined_verdict is actionable, OR BB match (backward compat)
            verdict = r.get("combined_verdict", "")
            bb_match = r.get("black_book_status") == "match"
            if verdict in LEAD_VERDICTS or bb_match:
                leads.append(r)

        # Priority: confirmed > likely > possible > needs_review > bb_only
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
        # Try Supabase first (has all 13+ fields)
        try:
            from supabase import create_client
            url = os.environ.get("SUPABASE_URL")
            key = os.environ.get("SUPABASE_ANON_KEY")
            if url and key:
                sb = create_client(url, key)
                resp = sb.table("features").select("*").eq("id", feature_id).execute()
                if resp.data:
                    row = resp.data[0]
                    # Also get issue month/year
                    issue_id = row.get("issue_id")
                    if issue_id:
                        issue_resp = sb.table("issues").select("month, year").eq("id", issue_id).execute()
                        if issue_resp.data:
                            row["issue_month"] = issue_resp.data[0].get("month")
                            row["issue_year"] = issue_resp.data[0].get("year")
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
                        # Copy all available fields
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
        features = []

        # Try Supabase
        try:
            from supabase import create_client
            url = os.environ.get("SUPABASE_URL")
            key = os.environ.get("SUPABASE_ANON_KEY")
            if url and key:
                sb = create_client(url, key)
                # Supabase IN filter
                resp = sb.table("features").select("*").in_("id", feature_ids).execute()
                if resp.data:
                    return resp.data
        except Exception:
            pass

        # Fall back to disk
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

        # Fetch all associated features
        features = self._fetch_features_batch(associated_ids)
        if not features:
            return None

        # Compute pattern stats
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

        # Find correlations specific to this name
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

    # ── Investigation (Haiku Call) ──────────────────────────────

    def _investigate_match(self, match, skills):
        """Build a dossier for a lead using Claude Haiku with full context + pattern analysis."""
        name = match.get("homeowner_name", "Unknown")
        bb_matches = match.get("black_book_matches") or []
        doj_results = match.get("doj_results")
        feature_id = match.get("feature_id")
        combined_verdict = match.get("combined_verdict", "")

        # Gather all available context
        context = {
            "name": name,
            "feature_id": feature_id,
            "combined_verdict": combined_verdict,
            "confidence_score": match.get("confidence_score"),
            "black_book_status": match.get("black_book_status"),
            "black_book_matches": bb_matches,
            "doj_status": match.get("doj_status", "pending"),
            "doj_results": doj_results,
        }

        # Full AD feature data (all 13+ fields)
        ad_context = self._find_ad_context(feature_id)
        if ad_context:
            context["ad_feature"] = ad_context

        # Black Book surrounding text
        bb_contexts = []
        for m in bb_matches:
            if m.get("context"):
                bb_contexts.append(m["context"])
        context["black_book_context"] = bb_contexts

        # Pattern analysis across all associated names
        pattern_context = self._build_pattern_context(name)

        # Call Claude for analysis
        client = self._get_client()

        # Build pattern section for prompt
        pattern_prompt = ""
        if pattern_context:
            pattern_prompt = f"""

## Pattern Analysis Context
These are aggregate patterns across ALL {pattern_context['total_associated']} Epstein-associated names in the AD database:

Design styles: {json.dumps(pattern_context['design_styles'])}
Designers: {json.dumps(pattern_context['designers'])}
Architects: {json.dumps(pattern_context['architects'])}
Locations: {json.dumps(pattern_context['locations'])}
Decades built: {json.dumps(pattern_context['decades'])}
Issue years: {json.dumps(pattern_context['issue_years'])}

Correlations specific to {name}: {json.dumps(pattern_context['correlations_for_current'])}

Analyze these patterns. Do any correlations stand out? Shared designers, location clusters, or style preferences among Epstein-associated names are significant."""

        system_prompt = f"""You are the Researcher agent for the AD-Epstein Index project.

{skills}

You are investigating a lead — a person who appeared in Architectural Digest AND was flagged by the Detective agent's cross-reference against Epstein records. Your job is to build a thorough dossier assessing the connection.

You have access to:
1. The full AD feature data (homeowner, designer, location, style, cost, etc.)
2. The Detective's cross-reference results (Black Book matches, DOJ search results, combined verdict)
3. Pattern analysis across ALL Epstein-associated names in the database (shared designers, locations, styles)

Be tenacious. Ask WHY this person appears in a high-end lifestyle magazine alongside Epstein associates. Look for patterns.

Pay special attention to the HOME ITSELF as evidence:
- What does the design style reveal? (e.g., Mediterranean Revival in Palm Beach = old-money social circle)
- What does the cost/square footage suggest about wealth level?
- Who was the designer/architect? Do they work for other Epstein-associated clients?
- Where is the home? Is this a known luxury enclave (Palm Beach, Upper East Side, Aspen, St. Barts)?
- When was it built/renovated relative to Epstein's active period (1990-2008)?
- The home is a window into someone's social world — the designer they hired, the neighborhood they chose, the style they preferred all tell a story.{pattern_prompt}

Respond with JSON only:
{{
  "subject_name": "Full name of the person",
  "combined_verdict": "{combined_verdict}",
  "confidence_score": 0.85,
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
    "wealth_indicators": "What the home's cost, size, and location reveal about wealth level",
    "social_circle_clues": "What the designer choice and neighborhood suggest about social connections",
    "style_significance": "How the design style relates to broader patterns among Epstein associates",
    "temporal_relevance": "Whether the home's timeline overlaps with Epstein's active period (1990-2008)"
  }},
  "epstein_connections": [
    {{
      "source": "black_book | doj_library | flight_logs | court_docs",
      "match_type": "exact | last_first | last_name_only",
      "evidence": "What was found",
      "context": "Surrounding text or document reference"
    }}
  ],
  "pattern_analysis": {{
    "shared_designers": ["Designer X (also worked for Name A, Name B)"],
    "shared_locations": ["Palm Beach (N other associated names)"],
    "shared_styles": ["Style name (used by N other associated names)"],
    "temporal_clustering": "Observation about timing of AD feature vs Epstein's activity",
    "notable_correlations": ["Any other cross-lead patterns worth noting"]
  }},
  "connection_strength": "HIGH | MEDIUM | LOW | COINCIDENCE",
  "strength_rationale": "2-3 sentences explaining the rating, including pattern evidence",
  "key_findings": ["bullet point 1", "bullet point 2"],
  "investigation_depth": "standard",
  "needs_manual_review": true/false,
  "review_reason": "Why manual review is needed, if applicable",
  "investigated_at": "ISO timestamp"
}}

Connection strength guide:
- HIGH: Multiple sources confirm (BB + DOJ), OR pattern correlations reinforce (shared designer/location with other matches), OR direct communication evidence
- MEDIUM: Single strong source (exact BB match) with some pattern support, or DOJ-only match with relevant context
- LOW: Weak match (last_name_only, common name) with no pattern support
- COINCIDENCE: Almost certainly a false positive — name too common, no pattern connections, context doesn't fit. **When you rate COINCIDENCE, the name will be automatically dismissed from the leads list.**

**CRITICAL: Temporal impossibility check — do this FIRST.**
Before any other analysis, check if the person could have possibly interacted with Jeffrey Epstein (born 1953, active 1990s-2008, arrested 2019):
- If the person DIED before 1980, rate COINCIDENCE immediately. A person who died decades before Epstein's social prominence cannot be a personal associate. Examples: William Randolph Hearst (d. 1951), Henri de Toulouse-Lautrec (d. 1901).
- If the person was born after 2000, they were too young to be an associate — rate COINCIDENCE.
- If the AD article is a historic/retrospective feature about a property built in the 1800s or early 1900s, the homeowner is likely historical, not a contemporary Epstein associate.
- DOJ results matching a historical figure's SURNAME (e.g., "Hearst" matching Hearst family/corporation) do NOT constitute evidence of a personal connection to the deceased individual.

**CRITICAL: False positive identification is one of your most important jobs.**
You are the last line of defense before a name reaches the human. Be aggressive about rating COINCIDENCE when:
- The person is deceased and could not have interacted with Epstein (see temporal check above)
- The name is a hotel, palace, resort, club, or other non-person entity (e.g., "Gritti Palace" is a hotel in Venice)
- DOJ results reference a contractor, vendor, or service worker — not a personal associate (e.g., Peter Rogers appears in Epstein docs as a construction contractor, not a social connection)
- The DOJ result context (invoices, equipment, permits, maintenance) has nothing to do with personal relationships
- DOJ results match a DIFFERENT person with the same surname (e.g., "Vidal" matching Jose Luis Contreras-Vidal, not Yves Vidal)
- A common name matched coincidentally with no supporting pattern evidence
Your job is to confirm real leads AND eliminate false positives with equal confidence.

Pattern evidence can UPGRADE strength:
- Shared designer with another confirmed match → upgrade one tier
- Same location cluster (e.g., Palm Beach, NYC Upper East Side) → note as supporting evidence
- AD feature from Epstein's active period (1990-2008) → note as temporal correlation
- Multiple pattern correlations → strong signal, consider upgrading
- Home in a known Epstein-associated enclave (Palm Beach, NYC UES, London Belgravia, Aspen) → note as lifestyle overlap
- Same designer as a confirmed Epstein associate → strong signal, upgrade one tier
- Cost/size consistent with ultra-high-net-worth circle → supporting context"""

        user_message = f"""Investigate this lead:

```json
{json.dumps(context, indent=2, default=str)}
```

Build a thorough dossier. Be tenacious — dig into the patterns."""

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )

        text = response.content[0].text.strip()
        # Strip markdown code blocks
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if "```" in text:
                text = text[:text.rindex("```")]
            text = text.strip()

        # Try direct parse first
        try:
            dossier = json.loads(text)
        except json.JSONDecodeError:
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
                        dossier = json.loads(text[start:i+1])
                        break
            else:
                raise ValueError(f"Incomplete JSON in response (truncated at max_tokens?): {text[-200:]}")

        dossier["investigated_at"] = datetime.now().isoformat()
        dossier["combined_verdict"] = combined_verdict
        return dossier

    # ── Dossier Persistence ─────────────────────────────────────

    def _save_dossier(self, name, dossier):
        """Save a dossier to disk."""
        os.makedirs(DOSSIERS_DIR, exist_ok=True)

        # Save individual dossier
        safe_name = "".join(c if c.isalnum() or c in " -_" else "" for c in name)
        safe_name = safe_name.strip().replace(" ", "_")
        path = os.path.join(DOSSIERS_DIR, f"{safe_name}.json")
        with open(path, "w") as f:
            json.dump(dossier, f, indent=2)

        # Also append to the master dossiers list
        master_path = os.path.join(DOSSIERS_DIR, "all_dossiers.json")
        all_dossiers = []
        if os.path.exists(master_path):
            try:
                with open(master_path) as f:
                    all_dossiers = json.load(f)
            except Exception:
                all_dossiers = []

        # Replace existing dossier for same name, or append
        replaced = False
        for i, d in enumerate(all_dossiers):
            if d.get("subject_name", "").lower() == name.lower():
                all_dossiers[i] = dossier
                replaced = True
                break
        if not replaced:
            all_dossiers.append(dossier)

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
