"""
Designer Agent — learns design patterns from Notion, websites, and Figma,
then creates designs via Figma Make when Phase 3 is active.

Uses `claude -p` (Claude Code CLI) as a subprocess to access MCP tools:
Notion, Playwright (for browsing + Figma Make), Figma (for reading designs).

Interval: 600s (10 min) — training cycles are thorough, not frequent.
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

TRAINING_DIR = os.path.join(DATA_DIR, "designer_training")
KNOWLEDGE_PATH = os.path.join(TRAINING_DIR, "knowledge_base.json")
TRAINING_LOG_PATH = os.path.join(TRAINING_DIR, "training_log.json")
ESCALATION_PATH = os.path.join(DATA_DIR, "designer_escalations.json")
MODE_PATH = os.path.join(DATA_DIR, "designer_mode.json")
ESCALATION_COOLDOWN_HOURS = 2  # Longer cooldown — training is less urgent
EXTRACTIONS_DIR = os.path.join(DATA_DIR, "extractions")

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

    async def work(self):
        self._mode = self._check_mode()
        skills = self.load_skills()

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

        # Explore real data shapes to include in training context
        data_context = self._explore_data_shapes()

        # Build the prompt for Claude Code
        knowledge = self._load_knowledge()
        knowledge_summary = self._summarize_knowledge(knowledge)

        prompt = self._build_training_prompt(source_type, source_ref, skills, knowledge_summary, data_context)

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
            self._maybe_escalate("training_failed",
                                 f"CLI call returned None for {source_type}: {source_ref[:60]}",
                                 {"source_type": source_type, "source_ref": source_ref})
            if self._consecutive_failures >= 3:
                self._maybe_escalate("training_stuck",
                                     f"{self._consecutive_failures} consecutive training failures",
                                     {"consecutive_failures": self._consecutive_failures})
            self._current_task = f"Training failed — {source_ref[:30]}"
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
        return True

    async def _creation_cycle(self, skills):
        """Create designs via Figma Make (Phase 3)."""
        knowledge = self._load_knowledge()
        knowledge_summary = self._summarize_knowledge(knowledge)

        prompt = self._build_creation_prompt(skills, knowledge_summary)
        result = await asyncio.to_thread(self._call_claude, prompt)

        if result:
            self._current_task = "Design created — check Figma"
            self.log("Created design via Figma Make")
            return True

        self._current_task = "Design creation failed"
        return False

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

    def _build_training_prompt(self, source_type, source_ref, skills, knowledge_summary, data_context=""):
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

Focus on patterns relevant to: data visualization, investigative journalism, interactive timelines, searchable databases, and name/connection mapping."""

    def _build_creation_prompt(self, skills, knowledge_summary):
        """Build a prompt for creating designs via Figma Make."""
        return f"""You are the Designer agent for the AD-Epstein Index project.

Using everything you've learned, create a design in Figma Make for the Phase 3 visualization website.

Your accumulated design knowledge:
{knowledge_summary}

Project design goals:
{skills}

Steps:
1. Open Figma Make in the browser
2. Create a design for the main dashboard/landing page
3. Take a screenshot of the result
4. Evaluate if it matches the design goals
5. Report what you created and any refinements needed

Respond with a summary of what was created and the Figma URL."""

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
            if not new_items:
                continue
            existing = set(knowledge.get(key, []))
            for item in new_items:
                if isinstance(item, str) and item not in existing:
                    knowledge.setdefault(key, []).append(item)

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
