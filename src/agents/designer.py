"""
Designer Agent — learns design patterns from external sources during training,
then generates JSON design specs for the Phase 3 website when in creating mode.

Training mode: Studies websites, Notion, local images, and Figma via Claude Code CLI.
Creating mode: Generates JSON design spec files (tokens, layouts, charts) that the
Next.js app reads to inform its rendering decisions.

Uses `claude -p` (Claude Code CLI) as a subprocess to access MCP tools.
Interval: 600s (10 min) — cycles are thorough, not frequent.
"""

import asyncio
import glob
import json
import os
import random
import subprocess
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agents.base import Agent, DATA_DIR, BASE_DIR
from agents.tasks import TaskResult

TRAINING_DIR = os.path.join(DATA_DIR, "designer_training")
KNOWLEDGE_PATH = os.path.join(TRAINING_DIR, "knowledge_base.json")
TRAINING_LOG_PATH = os.path.join(TRAINING_DIR, "training_log.json")
ESCALATION_PATH = os.path.join(DATA_DIR, "designer_escalations.json")
MODE_PATH = os.path.join(DATA_DIR, "designer_mode.json")
ESCALATION_COOLDOWN_HOURS = 2  # Longer cooldown — training is less urgent
EXTRACTIONS_DIR = os.path.join(DATA_DIR, "extractions")
DESIGN_SPECS_DIR = os.path.join(BASE_DIR, "web", "design-specs")
DESIGN_RULES_PATH = os.path.join(BASE_DIR, "docs", "design-rules.md")

# Valid spec types that the Designer can generate
SPEC_TYPES = ("tokens", "landing-page", "dossier-detail", "search-index")

# Tools the Designer is allowed to use via Claude Code
ALLOWED_TOOLS = [
    "Read",
    "Glob",
    "WebFetch",
    "WebSearch",
    "mcp__notion__*",
    "mcp__playwright__*",
    "mcp__plugin_figma_figma__*",
]

IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".gif", ".webp")
LOCAL_SAMPLE_SIZE = 8  # images per training cycle


class DesignerAgent(Agent):
    def __init__(self):
        super().__init__("designer", interval=600)
        self._mode = "training"  # "training" or "creating"
        self._sources_studied = 0
        self._patterns_learned = 0
        self._consecutive_failures = 0
        self._transition_escalated = False
        self._load_progress()

    def _load_personality(self):
        """Override: Sable's personality lives in docs/design-rules.md (single source of truth)."""
        if self._personality is not None:
            return self._personality
        if os.path.exists(DESIGN_RULES_PATH):
            try:
                with open(DESIGN_RULES_PATH) as f:
                    content = f.read()
                # Extract the personality section
                marker = "## Sable — Design Agent Personality"
                idx = content.find(marker)
                if idx != -1:
                    start = idx + len(marker)
                    # Find the next --- or ## that isn't part of the personality
                    end = content.find("\n---", start)
                    if end == -1:
                        end = len(content)
                    self._personality = content[start:end].strip()
                    return self._personality
            except Exception:
                pass
        # Fallback to skills file
        self._personality = ""
        return super()._load_personality()

    def _load_progress(self):
        """Load training progress from disk."""
        if os.path.exists(TRAINING_LOG_PATH):
            try:
                with open(TRAINING_LOG_PATH) as f:
                    data = json.load(f)
                self._sources_studied = data.get("sources_studied", 0)
                self._patterns_learned = data.get("patterns_learned", 0)
            except Exception:
                pass

    def _save_progress(self):
        """Persist training progress."""
        os.makedirs(TRAINING_DIR, exist_ok=True)
        data = {
            "sources_studied": self._sources_studied,
            "patterns_learned": self._patterns_learned,
            "last_updated": datetime.now().isoformat(),
        }
        with open(TRAINING_LOG_PATH, "w") as f:
            json.dump(data, f, indent=2)

    def _load_knowledge(self):
        """Load the accumulated knowledge base."""
        if os.path.exists(KNOWLEDGE_PATH):
            try:
                with open(KNOWLEDGE_PATH) as f:
                    return json.load(f)
            except Exception:
                pass
        return {"patterns": [], "color_palettes": [], "layout_ideas": [],
                "typography": [], "inspirations": [], "notes": []}

    def _save_knowledge(self, knowledge):
        """Save the knowledge base."""
        os.makedirs(TRAINING_DIR, exist_ok=True)
        with open(KNOWLEDGE_PATH, "w") as f:
            json.dump(knowledge, f, indent=2)

    # ── Escalation System ──────────────────────────────────────

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

        # Cooldown: check for recent unresolved escalation of same type
        for esc in reversed(escalations):
            if not esc.get("resolved") and esc.get("type") == reason_type:
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

    # ── Mode Switching ──────────────────────────────────────────

    def _check_mode(self):
        """Read the mode file to determine training vs creating."""
        if os.path.exists(MODE_PATH):
            try:
                with open(MODE_PATH) as f:
                    data = json.load(f)
                return data.get("mode", "training")
            except Exception:
                pass
        return "training"

    # ── Data Exploration ──────────────────────────────────────────

    def _explore_data_shapes(self):
        """Query local extraction data to understand real data shapes for design."""
        summary = {"total_features": 0, "field_fill_rates": {}, "sample_values": {},
                   "issues_extracted": 0, "verdict_distribution": {}}

        # Read extraction JSONs from disk
        if not os.path.exists(EXTRACTIONS_DIR):
            return "No extraction data available yet."

        all_features = []
        extracted_count = 0
        for fname in os.listdir(EXTRACTIONS_DIR):
            if not fname.endswith(".json"):
                continue
            try:
                with open(os.path.join(EXTRACTIONS_DIR, fname)) as f:
                    data = json.load(f)
                if not data.get("skipped"):
                    extracted_count += 1
                    for feat in data.get("features", []):
                        all_features.append(feat)
            except Exception:
                continue

        summary["total_features"] = len(all_features)
        summary["issues_extracted"] = extracted_count

        if not all_features:
            return "No features extracted yet — pipeline is still in early stages."

        # Field fill rates
        fields = ["homeowner_name", "designer_name", "location_city", "location_state",
                  "location_country", "design_style", "year_built", "square_footage"]
        for field in fields:
            filled = sum(1 for f in all_features if f.get(field))
            summary["field_fill_rates"][field] = f"{filled}/{len(all_features)} ({round(100*filled/len(all_features))}%)"

        # Sample values (up to 5 unique per field)
        for field in ["homeowner_name", "location_city", "designer_name", "design_style"]:
            values = list(set(str(f.get(field)) for f in all_features if f.get(field)))[:5]
            if values:
                summary["sample_values"][field] = values

        # Verdict distribution from cross-references
        xref_results_path = os.path.join(DATA_DIR, "cross_references", "results.json")
        if os.path.exists(xref_results_path):
            try:
                with open(xref_results_path) as f:
                    results = json.load(f)
                verdicts = {}
                for r in results:
                    v = r.get("combined_verdict", "no_match")
                    verdicts[v] = verdicts.get(v, 0) + 1
                summary["verdict_distribution"] = verdicts
            except Exception:
                pass

        # Dossier stats (Supabase first, disk fallback)
        dossiers = []
        try:
            from db import list_dossiers
            dossiers = list_dossiers()
        except Exception:
            dossier_path = os.path.join(DATA_DIR, "dossiers", "all_dossiers.json")
            if os.path.exists(dossier_path):
                try:
                    with open(dossier_path) as f:
                        dossiers = json.load(f)
                except Exception:
                    pass

        if dossiers:
            strengths = {}
            for d in dossiers:
                s = d.get("connection_strength", "unknown")
                strengths[s] = strengths.get(s, 0) + 1
            summary["dossier_strengths"] = strengths

            # Visual analysis samples (for design inspiration)
            visual_samples = []
            for d in dossiers[:10]:
                va = d.get("visual_analysis")
                if va:
                    visual_samples.append({
                        "subject": d.get("subject_name", "?"),
                        "visual_analysis": va,
                    })
                    if len(visual_samples) >= 5:
                        break
            if visual_samples:
                summary["sample_visual_analyses"] = visual_samples

        # Format as readable string
        lines = [f"Real Pipeline Data Snapshot ({datetime.now().strftime('%Y-%m-%d %H:%M')}):"]
        lines.append(f"- {summary['issues_extracted']} issues extracted, {summary['total_features']} total features")
        lines.append(f"\nField fill rates:")
        for field, rate in summary["field_fill_rates"].items():
            lines.append(f"  - {field}: {rate}")
        if summary["sample_values"]:
            lines.append(f"\nSample values:")
            for field, vals in summary["sample_values"].items():
                lines.append(f"  - {field}: {', '.join(vals[:3])}")
        if summary["verdict_distribution"]:
            lines.append(f"\nCross-reference verdicts:")
            for v, count in summary["verdict_distribution"].items():
                lines.append(f"  - {v}: {count}")
        if summary.get("dossier_strengths"):
            lines.append(f"\nDossier connection strengths:")
            for s, count in summary["dossier_strengths"].items():
                lines.append(f"  - {s}: {count}")

        return "\n".join(lines)

    # ── Source Selection ──────────────────────────────────────────

    def _parse_sources(self, skills):
        """Parse the skills file for all training sources. Returns list of {type, source}."""
        sources = []
        in_sources = False
        current_type = None
        for line in skills.split("\n"):
            stripped = line.strip()
            if stripped.startswith("## Training Sources"):
                in_sources = True
                continue
            if in_sources and stripped.startswith("## "):
                break  # Next section
            if in_sources and stripped.startswith("### "):
                current_type = stripped.lstrip("# ").strip().lower()
                continue
            if in_sources and stripped.startswith("- ") and current_type:
                url_or_id = stripped[2:].strip()
                if url_or_id and not url_or_id.startswith("("):
                    if " — " in url_or_id:
                        url_or_id = url_or_id.split(" — ")[0].strip()
                    sources.append({"type": current_type, "source": url_or_id})
        return sources

    def _get_next_source(self, skills):
        """Pick the next source to study (round-robin)."""
        sources = self._parse_sources(skills)
        if not sources:
            return None
        idx = self._sources_studied % len(sources)
        return sources[idx]

    async def work(self, task=None):
        self._mode = self._check_mode()
        skills = self.load_skills()

        # If given a specific task by the Editor, handle it
        if task and task.type == "generate_design_spec":
            return await self._creation_cycle(skills, task=task)

        if self._mode == "training":
            return await self._training_cycle(skills)
        elif self._mode == "creating":
            return await self._creation_cycle(skills)

        return False

    async def _training_cycle(self, skills):
        """Study one source and extract design patterns."""
        source = self._get_next_source(skills)

        if not source:
            self._current_task = "Training mode — no sources configured in skills file"
            self.log("No training sources found in skills file", level="WARN")
            return False

        source_type = source["type"]
        source_ref = source["source"]
        self._current_task = f"Studying {source_type}: {source_ref[:40]}..."
        self.log(f"Training on {source_type}: {source_ref}")

        # Narrate the start of training in Sable's voice
        try:
            self.narrate(f"Starting to study {source_type} source: {source_ref[:50]}")
        except Exception:
            pass

        # Recall what we learned from similar sources before (episodic memory)
        past_learnings = ""
        try:
            episodes = self.recall_episodes(
                f"design patterns from {source_type} {source_ref[:60]}",
                task_type="training",
                n=3,
            )
            if episodes:
                past_learnings = "\n\nRelevant past learnings from your memory:\n"
                for ep in episodes:
                    past_learnings += f"- {ep['text'][:200]}\n"
        except Exception:
            pass

        # Explore real data shapes to include in training context
        data_context = self._explore_data_shapes()

        # Build the prompt for Claude Code
        knowledge = self._load_knowledge()
        knowledge_summary = self._summarize_knowledge(knowledge)

        prompt = self._build_training_prompt(source_type, source_ref, skills, knowledge_summary, data_context, past_learnings)

        # Check for empty local source before calling CLI
        if source_type == "local" and "No images found" in prompt:
            self._maybe_escalate("source_unavailable",
                                 f"No images found in local folder: {source_ref[:60]}",
                                 {"source_type": source_type, "source_ref": source_ref})
            self._current_task = f"Source unavailable — {source_ref[:30]}"
            return False

        # Call Claude Code CLI with MCP access
        result = await asyncio.to_thread(self._call_claude, prompt)

        if not result:
            self._consecutive_failures += 1
            # Diagnose the training failure
            decision = await asyncio.to_thread(
                self.problem_solve,
                error=f"CLI call returned None for {source_type}: {source_ref[:60]}",
                context={
                    "source_type": source_type,
                    "source_ref": source_ref,
                    "consecutive_failures": self._consecutive_failures,
                    "patterns_learned": self._patterns_learned,
                    "sources_studied": self._sources_studied,
                },
                strategies={
                    "skip_source": "This source may be unavailable — move to the next one",
                    "simplify_request": "Ask for fewer patterns or simpler analysis",
                    "retry_next_cycle": "Transient error — will retry on next work cycle",
                    "escalate": "Multiple failures — needs Editor attention",
                },
            )
            self.log(f"Training problem: {decision.get('diagnosis', '?')} → {decision.get('strategy', '?')}")

            if decision.get("strategy") == "escalate" or self._consecutive_failures >= 3:
                self._maybe_escalate("training_stuck",
                                     f"{self._consecutive_failures} failures. Diagnosis: {decision.get('diagnosis', 'unknown')}",
                                     {"consecutive_failures": self._consecutive_failures,
                                      "recommended_strategy": decision.get("strategy", "unknown")})
            self._current_task = f"Training failed — {source_ref[:30]} ({decision.get('strategy', '?')})"
            # Narrate the failure in Sable's voice
            try:
                self.narrate(
                    f"Couldn't study {source_type} source '{source_ref[:40]}'. "
                    f"Problem: {decision.get('diagnosis', 'unknown')[:60]}. "
                    f"Going to {decision.get('strategy', 'try again later')}."
                )
            except Exception:
                pass
            # Remember this failure so we can learn from it
            try:
                self.commit_episode(
                    "training",
                    f"Failed to study {source_type} source '{source_ref[:60]}'. "
                    f"Diagnosis: {decision.get('diagnosis', 'unknown')[:100]}. "
                    f"Strategy: {decision.get('strategy', 'unknown')}",
                    "failure",
                    {"source_type": source_type, "source_ref": source_ref[:100]},
                )
            except Exception:
                pass
            return False

        # Reset consecutive failures on success
        self._consecutive_failures = 0

        # Parse learnings from the result
        learnings = self._parse_learnings(result)
        if learnings:
            self._merge_learnings(knowledge, learnings)
            self._save_knowledge(knowledge)
            self._patterns_learned = sum(len(v) for v in knowledge.values() if isinstance(v, list))

        self._sources_studied += 1
        self._save_progress()

        # Commit learnings to episodic memory (the 384-dim vector constellation)
        # This makes design knowledge searchable by semantic similarity and
        # visible to other agents' curiosity exploration
        try:
            learned_items = []
            for key in ["patterns", "color_palettes", "layout_ideas", "typography", "inspirations"]:
                for item in (learnings or {}).get(key, []):
                    learned_items.append(f"{key}: {item}")
            if learned_items:
                episode_text = (
                    f"Studied {source_type} source '{source_ref[:60]}'. "
                    f"Learned {len(learned_items)} design patterns: "
                    + "; ".join(learned_items[:5])  # First 5 for the embedding
                )
                self.commit_episode(
                    "training",
                    episode_text,
                    "success",
                    {"source_type": source_type, "source_ref": source_ref[:100],
                     "patterns_count": len(learned_items)},
                )
        except Exception:
            pass

        # Check if ready for mode transition
        total_sources = len(self._parse_sources(skills))
        if (not self._transition_escalated
                and total_sources > 0
                and self._sources_studied >= total_sources
                and self._patterns_learned >= 50):
            self._maybe_escalate("mode_transition_ready",
                                 f"Studied all {total_sources} sources, {self._patterns_learned} patterns learned — may be ready for Phase 3",
                                 {"sources_studied": self._sources_studied, "patterns_learned": self._patterns_learned})
            self._transition_escalated = True

        self._current_task = f"Learned from {source_type} ({self._patterns_learned} patterns total)"
        self.log(f"Training complete: {source_type} — {self._patterns_learned} patterns in knowledge base")

        # Post bulletin about new patterns learned
        try:
            learned_count = sum(len(v) for v in (learnings or {}).values() if isinstance(v, list))
            if learned_count > 0:
                self.post_bulletin(
                    f"Design training: learned {learned_count} patterns from {source_type} ({self._patterns_learned} total)",
                    tags=["design", "training", source_type],
                )
        except Exception:
            pass

        # Narrate what was learned in Sable's voice
        try:
            learned_summary = []
            for key in ["patterns", "layout_ideas", "color_palettes", "typography", "inspirations"]:
                items = (learnings or {}).get(key, [])
                if items:
                    learned_summary.append(f"{key.replace('_', ' ')}: {items[0][:60]}")
            narration_facts = (
                f"Just finished studying {source_type} source '{source_ref[:40]}'. "
                f"Found {sum(len(v) for v in (learnings or {}).values() if isinstance(v, list))} new patterns. "
                + (f"Highlights: {'; '.join(learned_summary[:2])}" if learned_summary else "")
            )
            self.narrate(narration_facts)
        except Exception:
            pass

        return True

    async def _creation_cycle(self, skills, task=None):
        """Generate JSON design spec files for the Phase 3 website.

        When invoked by the Editor with a generate_design_spec task, generates
        the spec type requested. When running autonomously, generates the next
        spec type that hasn't been created yet (or regenerates stale ones).
        """
        spec_type = None
        task_id = None

        # If Editor assigned a specific spec task, use its params
        if task:
            spec_type = task.params.get("spec_type")
            task_id = task.id

        # Otherwise, find the next spec to generate
        if not spec_type:
            spec_type = self._next_needed_spec()

        if not spec_type:
            self._current_task = "All design specs up to date"
            self.log("All design specs are current — nothing to generate")
            return False

        self._current_task = f"Generating {spec_type} design spec..."
        self.log(f"Generating design spec: {spec_type}")

        # Check pipeline state to inform design decisions
        try:
            world = self.get_world_state()
            if world:
                pipeline_context = (
                    f"Pipeline: {world.get('total_issues', '?')} issues, "
                    f"{world.get('total_features', '?')} features, "
                    f"bottleneck: {world.get('bottleneck', 'unknown')}"
                )
                self.log(f"World state: {pipeline_context}")
        except Exception:
            pass

        # Narrate the start of creation in Sable's voice
        try:
            self.narrate(f"Starting to generate the {spec_type} design spec using {sum(len(v) for v in self._load_knowledge().values() if isinstance(v, list))} accumulated patterns")
        except Exception:
            pass

        knowledge = self._load_knowledge()
        knowledge_summary = self._summarize_knowledge(knowledge)
        data_context = self._explore_data_shapes()
        design_rules = self._load_design_rules()

        prompt = self._build_spec_prompt(spec_type, knowledge_summary, data_context, design_rules)
        result = await asyncio.to_thread(self._call_claude, prompt)

        if not result:
            decision = await asyncio.to_thread(
                self.problem_solve,
                error=f"Spec generation CLI returned nothing for {spec_type}",
                context={"spec_type": spec_type, "patterns_available": sum(len(v) for v in knowledge.values() if isinstance(v, list))},
                strategies={
                    "retry_simpler": "Simplify the spec request — fewer components",
                    "skip_spec": "Skip this spec type, try the next one",
                    "escalate": "CLI may be broken — needs Editor attention",
                },
            )
            self.log(f"Spec generation problem: {decision.get('diagnosis', '?')} → {decision.get('strategy', '?')}")
            self._current_task = f"Spec failed — {spec_type} ({decision.get('strategy', '?')})"
            if task_id:
                await self.outbox.put(TaskResult(
                    task_id=task_id, task_type="generate_design_spec",
                    status="failure", result={"recommended_strategy": decision.get("strategy")},
                    error=f"Spec generation failed. Diagnosis: {decision.get('diagnosis', 'unknown')}",
                    agent="designer",
                ))
            return False

        # Parse the JSON spec from the response
        spec = self._parse_learnings(result)  # Reuses existing JSON parser
        if not spec:
            self._current_task = f"Could not parse spec JSON — {spec_type}"
            if task_id:
                await self.outbox.put(TaskResult(
                    task_id=task_id, task_type="generate_design_spec",
                    status="failure", result={}, error="Could not parse JSON from response",
                    agent="designer",
                ))
            return False

        # Write spec to disk
        os.makedirs(DESIGN_SPECS_DIR, exist_ok=True)
        spec_path = os.path.join(DESIGN_SPECS_DIR, f"{spec_type}.json")
        spec["_generated_at"] = datetime.now().isoformat()
        spec["_patterns_used"] = sum(len(v) for v in knowledge.values() if isinstance(v, list))

        with open(spec_path, "w") as f:
            json.dump(spec, f, indent=2)

        self._current_task = f"Wrote {spec_type}.json ({len(spec)} keys)"
        self.log(f"Design spec written: {spec_path}")

        # Narrate the creation success in Sable's voice
        try:
            self.narrate(f"Wrote the {spec_type} design spec — {len(spec)} keys, informed by all my training patterns. This one feels solid.")
        except Exception:
            pass

        # Commit creation success to memory
        try:
            self.commit_episode(
                "generate_design_spec",
                f"Generated {spec_type} design spec with {len(spec)} keys. "
                f"Used {sum(len(v) for v in knowledge.values() if isinstance(v, list))} accumulated patterns.",
                "success",
                {"spec_type": spec_type, "keys": list(spec.keys())[:10]},
            )
        except Exception:
            pass

        # Post bulletin about new spec
        try:
            self.post_bulletin(
                f"Design spec generated: {spec_type}.json ({len(spec)} keys). Ready for frontend integration.",
                tags=["design", "spec", spec_type],
            )
        except Exception:
            pass

        # Report success to Editor
        if task_id:
            await self.outbox.put(TaskResult(
                task_id=task_id, task_type="generate_design_spec",
                status="success",
                result={"spec_type": spec_type, "path": spec_path, "keys": list(spec.keys())},
                agent="designer",
            ))

        return True

    def _next_needed_spec(self):
        """Find the next spec type that hasn't been generated or is stale (>24h old)."""
        for spec_type in SPEC_TYPES:
            spec_path = os.path.join(DESIGN_SPECS_DIR, f"{spec_type}.json")
            if not os.path.exists(spec_path):
                return spec_type
            # Check staleness — regenerate if older than 24 hours
            try:
                mtime = os.path.getmtime(spec_path)
                age_hours = (datetime.now().timestamp() - mtime) / 3600
                if age_hours > 24:
                    return spec_type
            except OSError:
                return spec_type
        return None

    def _load_design_rules(self):
        """Load docs/design-rules.md for inclusion in spec prompts."""
        if os.path.exists(DESIGN_RULES_PATH):
            try:
                with open(DESIGN_RULES_PATH) as f:
                    return f.read()
            except Exception:
                pass
        return "No design rules found."

    def _sample_local_images(self, folder_path):
        """Randomly sample images from a local folder (recursive)."""
        all_images = []
        for ext in IMAGE_EXTENSIONS:
            all_images.extend(glob.glob(os.path.join(folder_path, "**", f"*{ext}"), recursive=True))
        if not all_images:
            return [], ""
        sample = random.sample(all_images, min(LOCAL_SAMPLE_SIZE, len(all_images)))
        # Build a subfolder summary for context
        subfolders = set()
        for img in all_images:
            rel = os.path.relpath(os.path.dirname(img), folder_path)
            if rel != ".":
                subfolders.add(rel.split(os.sep)[0])
        summary = f"{len(all_images)} images across {len(subfolders)} subfolders: {', '.join(sorted(subfolders)[:10])}"
        return sample, summary

    def _build_training_prompt(self, source_type, source_ref, skills, knowledge_summary, data_context="", past_learnings=""):
        """Build a prompt for Claude Code to study a source."""

        if source_type == "websites":
            action = f'Fetch and analyze this website for design patterns: {source_ref}'
        elif source_type == "notion":
            action = (
                f'Search this Notion database for visual inspiration and design patterns: {source_ref}\n'
                f'Use the notion-fetch tool to read the database, then query its gallery view to browse entries.\n'
                f'For entries with URLs, fetch a few of the most interesting ones (especially infographics, data viz, and typography).\n'
                f'Focus on visual patterns relevant to data journalism and interactive storytelling.'
            )
        elif source_type == "local":
            sample, summary = self._sample_local_images(source_ref)
            if not sample:
                action = f'No images found yet in {source_ref} (folder may still be syncing)'
            else:
                file_list = "\n".join(f"- {path}" for path in sample)
                action = (
                    f'Study these local reference images for design patterns.\n'
                    f'Folder: {source_ref}\n'
                    f'Collection overview: {summary}\n\n'
                    f'Read each of these {len(sample)} images using the Read tool and analyze them:\n{file_list}\n\n'
                    f'Look at composition, color palettes, typography, layout structure, and any visual techniques '
                    f'relevant to data visualization or editorial design.'
                )
        elif source_type == "figma":
            action = f'Get a screenshot and design context from this Figma file: {source_ref}'
        else:
            action = f'Study this source for design patterns: {source_ref}'

        return f"""You are the Designer agent for the AD-Epstein Index project, currently in training mode.

Your task: {action}

After studying the source, respond with ONLY a JSON object (no markdown, no explanation) with the design patterns you extracted:

{{
  "patterns": ["layout pattern 1", "layout pattern 2"],
  "color_palettes": ["description of color scheme"],
  "layout_ideas": ["specific layout approach that could work for data visualization"],
  "typography": ["font pairing or type treatment worth noting"],
  "inspirations": ["specific element or interaction worth replicating"],
  "notes": ["any other design insight"]
}}

Only include categories where you found something noteworthy. Empty arrays for categories with nothing to report.

Context — what you've already learned:
{knowledge_summary}

Context — the project's design goals:
{skills}

Real Data Context — the actual data you'll be designing for:
{data_context}

Focus on patterns relevant to: data visualization, investigative journalism, interactive timelines, searchable databases, and name/connection mapping.
{past_learnings}"""

    def _build_spec_prompt(self, spec_type, knowledge_summary, data_context, design_rules):
        """Build a prompt for generating a JSON design spec."""

        spec_instructions = {
            "tokens": """Generate a design tokens JSON spec with these keys:
{
  "colors": { "background": "#hex", "foreground": "#hex", "accent": "#hex", ... },
  "typography": { "headline": "font-family string", "body": "...", "data": "..." },
  "spacing": { "textMaxWidth": "px value", "vizMaxWidth": "...", "sectionGap": "..." },
  "chartPalette": ["#hex1", "#hex2", ...],
  "verdictColors": { "confirmed": {...}, "rejected": {...}, "pending": {...} },
  "rationale": "Brief explanation of why these tokens were chosen, citing specific patterns"
}""",
            "landing-page": """Generate a landing page layout JSON spec with these keys:
{
  "sections": [
    {
      "id": "hero",
      "type": "hero|stats|chart|table|prose",
      "title": "Section title",
      "chartType": "bar|pie|heatmap|treemap|timeline|null",
      "dataSource": "Which API endpoint / data field",
      "layout": "full-width|text-width|viz-width",
      "rationale": "Why this section is here, citing specific design patterns"
    }
  ],
  "chartRecommendations": {
    "coverageMap": { "type": "heatmap", "rationale": "..." },
    "featuresTimeline": { "type": "bar", "rationale": "..." }
  },
  "overallRationale": "Design philosophy for the page"
}""",
            "dossier-detail": """Generate a dossier detail page JSON spec with these keys:
{
  "layout": "Content layout description",
  "sections": [
    { "id": "header", "components": ["name", "verdict-badge", "issue-date"], "rationale": "..." },
    { "id": "evidence", "components": [...], "collapsible": true, "rationale": "..." }
  ],
  "verdictPresentation": { "style": "badge|banner|card", "rationale": "..." },
  "imageGallery": { "layout": "grid|carousel|lightbox", "rationale": "..." },
  "overallRationale": "Design philosophy for dossier pages"
}""",
            "search-index": """Generate a searchable index page JSON spec with these keys:
{
  "filters": [
    { "id": "search", "type": "text|select|range|toggle", "label": "...", "rationale": "..." }
  ],
  "table": {
    "columns": [
      { "id": "homeowner", "label": "...", "sortable": true, "width": "..." }
    ],
    "defaultSort": { "column": "...", "direction": "asc|desc" },
    "pagination": { "style": "numbered|infinite|load-more", "pageSize": 20 }
  },
  "filterState": "url-params|local-state",
  "overallRationale": "Design philosophy for the index"
}""",
        }

        instructions = spec_instructions.get(spec_type, "Generate a JSON design spec.")

        return f"""You are the Designer agent for the AD-Epstein Index project, now in spec-generation mode.

Your task: Generate a **{spec_type}** design spec as JSON.

{instructions}

Respond with ONLY a JSON object (no markdown, no explanation).

Your accumulated design knowledge ({sum(1 for _ in knowledge_summary.split(chr(10)))} lines):
{knowledge_summary}

Design rules for this project:
{design_rules}

Real data context (what will be rendered):
{data_context}

Key constraints:
- Editorial/investigative journalism aesthetic (NYT, ProPublica, The Pudding)
- Serious and credible, not flashy — let the data speak
- Warm copper accent (#B87333), off-white background (#FAFAFA)
- Serif headlines (Playfair Display), sans-serif body (Inter), monospace data (JetBrains Mono)
- Max text width 720px, max viz width 1200px
- Verdict colors: confirmed=green, rejected=muted red, pending=amber
- Every recommendation must cite which pattern from your knowledge base informed it"""

    def _call_claude(self, prompt):
        """Call Claude Code CLI with MCP access. Returns output text or None."""
        tools_arg = " ".join(f'"{t}"' for t in ALLOWED_TOOLS)

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
                timeout=300,  # 5 min max per training cycle
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

    def _parse_learnings(self, result):
        """Extract JSON learnings from Claude's response."""
        text = result.strip()

        # Try to find JSON in the response
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]

        # Find JSON object boundaries
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass

        self.log("Could not parse learnings from Claude response", level="WARN")
        return None

    def _merge_learnings(self, knowledge, learnings):
        """Merge new learnings into the knowledge base, avoiding duplicates."""
        for key in ["patterns", "color_palettes", "layout_ideas",
                     "typography", "inspirations", "notes"]:
            new_items = learnings.get(key, [])
            if not isinstance(new_items, list):
                continue
            if not new_items:
                continue
            # Ensure knowledge[key] is a list (LLM may have returned a dict)
            if not isinstance(knowledge.get(key), list):
                knowledge[key] = []
            existing = set(knowledge[key])
            for item in new_items:
                if isinstance(item, str) and item not in existing:
                    knowledge[key].append(item)

        # Cap each category at 50 entries
        for key in knowledge:
            if isinstance(knowledge[key], list) and len(knowledge[key]) > 50:
                knowledge[key] = knowledge[key][-50:]

    def _summarize_knowledge(self, knowledge):
        """Build a concise summary of accumulated knowledge for prompts."""
        total = sum(len(v) for v in knowledge.values() if isinstance(v, list))
        if total == 0:
            return "No design patterns learned yet — this is the first training session."

        lines = [f"Total patterns learned: {total}"]
        for key, items in knowledge.items():
            if isinstance(items, list) and items:
                # Show last 3 entries per category
                recent = items[-3:]
                lines.append(f"\n{key.replace('_', ' ').title()} ({len(items)} total):")
                for item in recent:
                    lines.append(f"  - {item}")

        return "\n".join(lines)

    def get_progress(self):
        return {
            "current": self._sources_studied,
            "total": self._patterns_learned,
        }
