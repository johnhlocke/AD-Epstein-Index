#!/usr/bin/env python3
"""Research-backed wealth & social capital classification pipeline.

Two-stage pipeline:
  Stage 1 — Gemini Deep Research: Autonomous multi-step web research
            on each person's biographical, financial, and social background.
  Stage 2 — Claude Opus: Structured classification based on the research.

Output fields per person:
  - Wealth origin (SELF_MADE / OLD_MONEY / MIXED / MARRIED_INTO / UNKNOWN)
  - Forbes Self-Made Score (1-10)
  - Education (schools attended)
  - Museum board memberships
  - Elite institutional board memberships
  - Generational proximity to wealth (1ST_GEN / 2ND_GEN / 3RD_PLUS / UNKNOWN)
  - Cultural and social capital notes

Modes:
  --mode search-grounding (default):
    Gemini 3.1 Pro with Google Search grounding. Web-grounded research
    with real-time search. ~$0.10-0.15/name, 30-40s/name.

  --mode deep-research:
    Gemini Deep Research via Interactions API. Comprehensive multi-step
    autonomous research. ~$2-5/name, 5-20 min/name. Very expensive.

Usage:
    python3 src/research_classify.py --baseline 600 --dry-run
    python3 src/research_classify.py --baseline 600
    python3 src/research_classify.py --baseline 600 --mode search-grounding
    python3 src/research_classify.py --epstein
    python3 src/research_classify.py --baseline 600 --epstein
    python3 src/research_classify.py --report
    python3 src/research_classify.py --baseline 600 --resume
    python3 src/research_classify.py --all-baseline --resume
    python3 src/research_classify.py --apply-db
    python3 src/research_classify.py --appendix

Cost estimates:
    Search Grounding (3.1 Pro): ~$0.10-0.15/name → 600 baseline ≈ $60-90
    Deep Research:              ~$2-5/name       → 600 baseline ≈ $1,200-3,000
"""

import argparse
import concurrent.futures
import csv
import json
import os
import random
import sys
import time
from datetime import datetime, timezone

import anthropic
import requests as http_requests
from dotenv import load_dotenv
from google import genai
from google.genai import types
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# ── Configuration ────────────────────────────────────────────

OPUS_MODEL = "claude-opus-4-6"
DEEP_RESEARCH_AGENT = "deep-research-pro-preview-12-2025"
SEARCH_MODEL = "gemini-3-pro-preview"  # overridden by --model flag

OPUS_PRICING = {"input": 15.0, "output": 75.0}       # per 1M tokens
SEARCH_PRICING = {"input": 2.0, "output": 12.0}      # Gemini 3.1 Pro per 1M tokens
SEARCH_QUERY_COST = 14.0 / 1000                       # $14 per 1k search queries
DEEP_RESEARCH_COST_EST = 3.0                          # avg $ per task

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "wealth_research")

POLL_INTERVAL = 15  # seconds between Deep Research polls
MAX_RESEARCH_WAIT = 3600  # 60 min max wait per task

# ── Perplexity Configuration ────────────────────────────────
PERPLEXITY_MODEL = "sonar-reasoning-pro"  # reasoning + search grounding
PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"

# ── Research Prompt (Deep Research mode) ─────────────────────

DEEP_RESEARCH_PROMPT = """Research the biographical, financial, and social background of {name}, \
who was featured as a homeowner in Architectural Digest magazine ({year}).

I need COMPREHENSIVE biographical research to classify their wealth origin, \
social capital, and cultural capital. Focus on finding:

## Financial Background
- **Family wealth**: Did they come from a wealthy, middle-class, or working-class family? \
Any inherited wealth, trusts, or family businesses?
- **Career and wealth source**: How did they accumulate the wealth to own an AD-featured home? \
What business, career, investments, or inheritance?
- **Marriage and wealth**: Did they marry into wealth? Is their spouse's fortune a significant factor?

## Education & Cultural Capital
- **Schools attended**: What prep schools, universities, and graduate schools did they attend? \
Specific institution names are critical.
- **Museum boards**: Are they on the board of any museums (MoMA, Met, Guggenheim, Whitney, etc.)?
- **Cultural affiliations**: Any art collection, gallery ownership, cultural philanthropy?

## Social Capital & Institutional Power
- **Board memberships**: Are they on boards of elite institutions? \
(Universities, hospitals, think tanks like CFR, Brookings, Aspen Institute, etc.)
- **Club memberships**: Any exclusive social clubs?
- **Philanthropic boards**: Major foundation or charity board positions?

## Generational Wealth
- **Wealth generation**: Are they 1st generation wealth (built it themselves), \
2nd generation (parents were wealthy), 3rd+ generation (multi-generational fortune)?
- **Family history**: What do we know about their parents' and grandparents' economic status?

Context: {name} was featured in AD under category "{category}" in a home located in {location}.

If you cannot find information about this person, state clearly what could and could not be found. \
Do NOT fabricate details. It is better to say "no information found" than to guess."""

# ── Research Prompt (Search Grounding mode) ──────────────────

SEARCH_GROUNDING_PROMPT = """Research the biographical and financial background of this person \
who was featured as a homeowner in Architectural Digest magazine.

Name: {name}
Context: Featured in AD ({year}), category: {category}, location: {location}

I need SPECIFIC biographical facts. Please research and provide:

1. **Family background**: What family did they come from? Wealthy, middle-class, working-class? \
Any notable family members or inherited wealth?
2. **Career and wealth source**: How did they make their money? What business, career, or investments?
3. **Inherited vs. self-made**: Did they inherit significant wealth, a business, or social connections?
4. **Marriage and wealth**: Did they marry into wealth?
5. **Education**: Where did they go to school? Prep school? College? Graduate school? \
Specific institution names.
6. **Museum/cultural boards**: Any museum board memberships? Art collection? Cultural philanthropy?
7. **Elite institutional boards**: Board positions at universities, hospitals, think tanks, foundations?
8. **Generational wealth**: 1st generation wealth, 2nd generation, 3rd+ generation?
9. **Social class of origin**: Best estimate of the economic class they grew up in.

If you cannot find information about this person, say so clearly. Do NOT fabricate biographical details."""

# ── Classification Prompt (shared by both modes) ────────────

CLASSIFY_PROMPT = """Based on the following biographical research, classify this person's wealth origin, \
assign a Forbes Self-Made Score, and assess their cultural and social capital.

**Person**: {name}
**AD Category**: {category}
**Featured in AD**: {year}
**Location**: {location}

{research}

---

**IMPORTANT**: You received multiple independent research passes from separate web searches. \
Each pass may have found DIFFERENT biographical details. Use ALL of them together — if ONE pass \
found that the person's father was wealthy but the others didn't, TRUST the specific finding. \
Specific biographical facts (family wealth, parents' occupations, inheritance) take precedence \
over vague statements like "no information found." The most detailed, fact-rich description wins.

Provide ALL of the following classifications based ONLY on the research above.

## 1. Wealth Origin Classification

Classify into ONE of:
- **SELF_MADE** — Built their own fortune. First-generation wealth.
- **OLD_MONEY** — Inherited wealth from established family. Multi-generational fortune.
- **MARRIED_INTO** — Primary route to wealth/status was through marriage.
- **MIXED** — Combination: e.g., came from wealth AND built their own empire, \
or married wealthy AND had independent success.
- **UNKNOWN** — Insufficient biographical information to classify.

## 2. Forbes Self-Made Score (1-10)

1 — Inherited fortune, not actively managing it. Lives off family trust.
2 — Inherited fortune, has a role managing it but hasn't grown it significantly.
3 — Inherited fortune, maintained family wealth level through own career (stayed rich, didn't build bigger).
4 — Inherited a sizable business/fortune and grew it into something much larger.
5 — Inherited a small/medium advantage (seed money, connections, safety net) and built a major fortune.
6 — Self-made from upper-class background (elite connections, expensive education, family funding \
but NO family wealth available as safety net or inheritance).
7 — Self-made from upper-middle-class background (comfortable, good education, no fortune).
8 — Self-made from middle-class background (no particular advantages).
9 — Self-made from working-class background (overcame meaningful disadvantage).
10 — Self-made from poverty or extreme disadvantage.

Marriage into wealth = scores 2-5 depending on their own career contribution.

Key test for 3 vs 4-5 — WEALTH OUTCOME, not effort:
The question is NOT "did they work hard" or "did they build their own career." \
The question is: did they end up in a HIGHER wealth tier than where they started?
- 3 = Family was rich → they are still rich at roughly the same level. \
They may have built an impressive career (doctor, author, architect, actor) but their NET WORTH \
is comparable to what their family had. They maintained, not multiplied.
- 4 = Family was rich → they are MUCH richer. They took the inherited platform and built an \
empire (e.g., inherited $10M → now worth $500M). Clear upward trajectory in wealth.
- 5 = Family gave a modest boost (seed money, connections, paid for elite education, safety net) \
→ they built a MAJOR fortune that far exceeds the family advantage. \
The inherited advantage was a launchpad, not a fortune.

DEFAULT RULE FOR MIXED: Score is 3 unless you see EXPLICIT markers of wealth multiplication.

Evidence that justifies 4-5 (must be present in the research):
- Founded or ran a company with revenue/valuation far exceeding family wealth
- Appeared on Forbes/Bloomberg billionaire or rich lists
- Built a real estate, media, or financial empire
- Concrete net worth figures showing clear upward jump from family starting point

Evidence that means the score stays at 3:
- Successful professional career (author, doctor, lawyer, architect, actor, designer, musician)
- Bought expensive homes, lived well, featured in AD
- "Prolific," "acclaimed," "bestselling," "highly successful" — these describe career achievement, \
NOT wealth multiplication
- No concrete evidence the person's net worth exceeds their family's starting wealth

Do NOT speculate about relative wealth levels. If the research does not contain explicit evidence \
of wealth multiplication (company founded, Forbes list, concrete net worth), the score is 3.

SELF-CHECK (mandatory before finalizing): If you classified someone as MIXED and your score is \
above 3, stop and answer: what SPECIFIC company, Forbes list appearance, or concrete net worth \
figure in the research proves wealth multiplication? If you cannot name one, change the score to 3. \
"Successful career" and "substantial earnings" are not wealth multiplication — they are wealth \
maintenance. Score 3.

Calibration examples for Forbes 4-5 (inherited advantage + demonstrable wealth multiplication):
- 4: Donny Deutsch — inherited dad's ad agency, grew it into a $265M sale to Interpublic
- 4: Steve Tisch — Loews fortune heir, Oscar-winning producer, Giants co-owner (net worth far exceeds inheritance)
- 4: Malcolm Forbes — inherited Forbes magazine, built it into a media empire + flamboyant personal brand
- 4: William Koch — $470M Koch buyout, then built Oxbow Group (separate empire from family fortune)
- 4: Charles S. Cohen — inherited a real estate firm, expanded into film distribution (Cohen Media Group)
- 5: Nat Rothschild — banking dynasty heir, co-founded his own hedge fund (smaller family boost, bigger outcome)
- 5: DVF (Diane von Furstenberg) — married a prince for the title, built a fashion empire, married a media billionaire
- 5: Lynn Forester de Rothschild — built a telecom career from upper-class background, married into the Rothschild dynasty

Notice the pattern: every 4-5 has a NAMED company, acquisition, or fortune that exceeds the family starting point. \
If you can't name an equivalent for your subject, the score is 3.

Key test for 5 vs 6 — SAFETY NET existence:
Did family wealth EXIST and was it AVAILABLE (even if not directly used)? \
If yes → 5 or below (the safety net is the advantage). \
If no family wealth existed → 6+ (truly self-made, no fallback if they failed).

## THE GOOGLEABLE PARENT RULE (mandatory cap on Forbes score)
If one or both parents are publicly prominent enough to appear in web search results — \
meaning they have a Wikipedia page, press coverage, industry recognition, or any \
documented public career — the subject CANNOT score Forbes 8 or higher. The logic:
- Forbes 8+ means "self-made from middle-class or below, no particular advantages."
- A parent with a public profile in ANY professional field = meaningful access, \
connections, cultural capital, or safety net. That is NOT "no particular advantages."

Scoring caps when parents are Googleable:
- Parent prominent in the SAME or adjacent industry → Forbes 6 max, classify MIXED likely. \
(e.g., Robert Downey Jr.'s father was filmmaker Robert Downey Sr. — not self-made.)
- Parent prominent in an UNRELATED industry → Forbes 7 max. \
(e.g., parent was a famous surgeon but subject became a fashion designer.)
- Parent has a Wikipedia page → almost certainly MIXED (Forbes 4-5), not SELF_MADE. \
A Wikipedia-level parent means the subject grew up with a level of access, \
network, and cultural capital that is incompatible with "self-made."
- Parent was a working professional with NO public profile → no cap applies.

SELF-CHECK: Before assigning Forbes 8+, ask: "Can I find this person's parents \
in the research?" If the research mentions a parent by name, occupation, or \
accomplishment, the subject is NOT Forbes 8+. Adjust downward.

## 3. Education
List specific schools attended (prep school, undergraduate, graduate). If unknown, say "Unknown."

## 4. Board Memberships
- **Museum boards**: List any museum trustee/board positions.
- **Elite institutional boards**: List board positions at universities, hospitals, think tanks, \
foundations, or other elite institutions.

## 5. Generational Wealth
Classify as: 1ST_GEN (built it themselves), 2ND_GEN (parents were wealthy), \
3RD_PLUS (multi-generational fortune), or UNKNOWN.

## Consistency Rules (mandatory)
The Forbes score MUST fall within the valid range for the classification.
Forbes 6+ = self-made (you built it yourself). Forbes 1-5 = some degree of inherited wealth.

- SELF_MADE → Forbes 6-10 (they built it; score reflects starting disadvantage)
- MIXED → Forbes 4-5 (inherited a MATERIAL advantage — money, business, trust, connections — and built significantly on top of it)
- OLD_MONEY → Forbes 1-3 (they inherited the fortune; score reflects how much they grew it)
- MARRIED_INTO → Forbes 2-5 (depends on own career contribution)
- UNKNOWN → Forbes null

Key distinction: The test is whether family wealth EXISTED AND WAS AVAILABLE, not whether \
they literally cashed the check. A person who "rejected" family money but could have fallen \
back on it is NOT self-made — the safety net itself is the advantage. A true self-made person \
has no fallback if they fail.

- Grew up wealthy, family money available as safety net, built own career = MIXED (Forbes 4-5)
- Grew up middle-class or below, no family wealth to fall back on = SELF_MADE (Forbes 6-10)
- The threshold is the EXISTENCE of family wealth, not whether it was directly deployed.

If your initial score falls outside these ranges, re-examine your classification.
Either adjust the classification to match the score, or the score to match the classification.

## Couples
When the research covers a couple, classify based on the PRIMARY wealth holder \
(the person whose wealth/status most explains the AD-featured home). If both \
contributed roughly equally, note this in the rationale and score the higher-earning partner.

## Other Rules
- If the research found NO information, classify as UNKNOWN with forbes_score null and LOW confidence.
- Base ONLY on the research provided. Do not supplement with your own knowledge.
- Be precise about confidence: HIGH = research clearly supports it, MEDIUM = partial but suggestive, \
LOW = thin/speculative.

Respond in this exact JSON format:
{{
  "classification": "SELF_MADE | OLD_MONEY | MARRIED_INTO | MIXED | UNKNOWN",
  "classification_confidence": "HIGH | MEDIUM | LOW",
  "forbes_score": <integer 1-10 or null>,
  "forbes_confidence": "HIGH | MEDIUM | LOW",
  "wealth_source": "Brief description of primary wealth source",
  "background": "Family/class origin in 1-2 sentences",
  "trajectory": "How they reached AD-home wealth level",
  "rationale": "2-3 sentence explanation covering both classifications",
  "education": "Specific schools: prep, undergrad, graduate. Or 'Unknown'",
  "museum_boards": "List of museum board positions, or 'None found'",
  "elite_boards": "List of elite institutional board positions, or 'None found'",
  "generational_wealth": "1ST_GEN | 2ND_GEN | 3RD_PLUS | UNKNOWN",
  "cultural_capital_notes": "Brief assessment of cultural capital indicators",
  "social_capital_notes": "Brief assessment of social network / institutional power"
}}"""


# ── Supabase helpers ─────────────────────────────────────────

def get_supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required in .env")
        sys.exit(1)
    return create_client(url, key)


def get_confirmed_names(sb):
    """Get all confirmed Epstein dossier names with feature metadata."""
    dossiers = sb.table("dossiers").select(
        "feature_id, subject_name, connection_strength"
    ).eq("editor_verdict", "CONFIRMED").execute()

    if not dossiers.data:
        return []

    feature_ids = [d["feature_id"] for d in dossiers.data if d["feature_id"]]
    features_map = {}
    for i in range(0, len(feature_ids), 50):
        batch = feature_ids[i:i+50]
        result = sb.table("features").select(
            "id, homeowner_name, subject_category, location_city, "
            "location_state, location_country, issue_id"
        ).in_("id", batch).execute()
        if result.data:
            for f in result.data:
                features_map[f["id"]] = f

    issue_ids = list(set(
        f.get("issue_id") for f in features_map.values() if f.get("issue_id")
    ))
    issues_map = {}
    for i in range(0, len(issue_ids), 50):
        batch = issue_ids[i:i+50]
        result = sb.table("issues").select("id, year").in_("id", batch).execute()
        if result.data:
            for iss in result.data:
                issues_map[iss["id"]] = iss.get("year")

    names = []
    for d in dossiers.data:
        fid = d.get("feature_id")
        feat = features_map.get(fid, {})
        issue_year = issues_map.get(feat.get("issue_id"), "Unknown")
        loc_parts = [
            feat.get("location_city"),
            feat.get("location_state"),
            feat.get("location_country"),
        ]
        location = ", ".join(p for p in loc_parts if p) or "Unknown"
        names.append({
            "name": d.get("subject_name", "Unknown"),
            "group": "epstein",
            "feature_id": fid,
            "category": feat.get("subject_category", "Unknown"),
            "location": location,
            "year": str(issue_year),
            "connection_strength": d.get("connection_strength", ""),
        })

    return names


def get_baseline_candidates(sb, n, exclude_names=None):
    """Get n random non-confirmed features with homeowner names."""
    exclude_names = exclude_names or set()

    dossiers = sb.table("dossiers").select(
        "feature_id"
    ).eq("editor_verdict", "CONFIRMED").execute()
    confirmed_fids = set(
        d["feature_id"] for d in (dossiers.data or []) if d["feature_id"]
    )

    all_features = []
    offset = 0
    while True:
        batch = sb.table("features").select(
            "id, homeowner_name, subject_category, location_city, "
            "location_state, location_country, issue_id"
        ).not_.is_("homeowner_name", "null").range(offset, offset + 999).execute()
        if not batch.data:
            break
        all_features.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    issue_ids = list(set(
        f.get("issue_id") for f in all_features if f.get("issue_id")
    ))
    issues_map = {}
    for i in range(0, len(issue_ids), 100):
        batch_ids = issue_ids[i:i+100]
        result = sb.table("issues").select("id, year").in_("id", batch_ids).execute()
        if result.data:
            for iss in result.data:
                issues_map[iss["id"]] = iss.get("year")

    candidates = []
    seen_names = set()
    for f in all_features:
        name = (f.get("homeowner_name") or "").strip()
        if not name or name.lower() == "anonymous":
            continue
        if f["id"] in confirmed_fids:
            continue
        if name in seen_names or name in exclude_names:
            continue
        seen_names.add(name)

        loc_parts = [
            f.get("location_city"),
            f.get("location_state"),
            f.get("location_country"),
        ]
        location = ", ".join(p for p in loc_parts if p) or "Unknown"
        issue_year = issues_map.get(f.get("issue_id"), "Unknown")

        candidates.append({
            "name": name,
            "group": "baseline",
            "feature_id": f["id"],
            "category": f.get("subject_category", "Unknown"),
            "location": location,
            "year": str(issue_year),
        })

    random.shuffle(candidates)
    return candidates[:n]


def get_all_baseline_candidates(sb):
    """Get ALL non-confirmed, non-Anonymous unique homeowner names (no sampling)."""
    dossiers = sb.table("dossiers").select(
        "feature_id"
    ).eq("editor_verdict", "CONFIRMED").execute()
    confirmed_fids = set(
        d["feature_id"] for d in (dossiers.data or []) if d["feature_id"]
    )

    all_features = []
    offset = 0
    while True:
        batch = sb.table("features").select(
            "id, homeowner_name, subject_category, location_city, "
            "location_state, location_country, issue_id"
        ).not_.is_("homeowner_name", "null").range(offset, offset + 999).execute()
        if not batch.data:
            break
        all_features.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    issue_ids = list(set(
        f.get("issue_id") for f in all_features if f.get("issue_id")
    ))
    issues_map = {}
    for i in range(0, len(issue_ids), 100):
        batch_ids = issue_ids[i:i+100]
        result = sb.table("issues").select("id, year").in_("id", batch_ids).execute()
        if result.data:
            for iss in result.data:
                issues_map[iss["id"]] = iss.get("year")

    candidates = []
    seen_names = set()
    for f in all_features:
        name = (f.get("homeowner_name") or "").strip()
        if not name or name.lower() == "anonymous":
            continue
        if f["id"] in confirmed_fids:
            continue
        if name in seen_names:
            continue
        seen_names.add(name)

        loc_parts = [
            f.get("location_city"),
            f.get("location_state"),
            f.get("location_country"),
        ]
        location = ", ".join(p for p in loc_parts if p) or "Unknown"
        issue_year = issues_map.get(f.get("issue_id"), "Unknown")

        candidates.append({
            "name": name,
            "group": "baseline",
            "feature_id": f["id"],
            "category": f.get("subject_category", "Unknown"),
            "location": location,
            "year": str(issue_year),
        })

    return candidates


# ── Deep Research (Interactions API) ─────────────────────────

def start_deep_research(gemini_client, person):
    """Launch an async Deep Research task. Returns interaction ID."""
    prompt = DEEP_RESEARCH_PROMPT.format(
        name=person["name"],
        year=person.get("year", "Unknown"),
        category=person.get("category", "Unknown"),
        location=person.get("location", "Unknown"),
    )
    try:
        interaction = gemini_client.interactions.create(
            agent=DEEP_RESEARCH_AGENT,
            input=prompt,
            background=True,
        )
        return interaction.id
    except Exception as e:
        print(f"    Deep Research launch error for {person['name']}: {e}")
        return None


def poll_deep_research(gemini_client, interaction_id):
    """Check status of a Deep Research task. Returns (status, text_or_error)."""
    try:
        interaction = gemini_client.interactions.get(interaction_id)
        if interaction.status == "completed":
            text = ""
            if interaction.outputs:
                text = interaction.outputs[-1].text or ""
            return ("completed", text)
        elif interaction.status == "failed":
            error = getattr(interaction, "error", "Unknown error")
            return ("failed", str(error))
        return ("pending", None)
    except Exception as e:
        return ("error", str(e))


def run_deep_research_pipeline(gemini_client, opus_client, persons, output_path,
                               max_concurrent=5, done_names=None):
    """Run Deep Research + Opus classification with concurrent research tasks."""
    done_names = done_names or set()
    remaining = [p for p in persons if p["name"] not in done_names]
    total = len(remaining)

    if total == 0:
        print("All names already processed.")
        return []

    print(f"\n  Mode: Deep Research (Interactions API)")
    print(f"  Concurrency: {max_concurrent}")
    print(f"  Names: {total}")
    print(f"  Estimated cost: ~${total * DEEP_RESEARCH_COST_EST:,.0f}")
    print(f"  Estimated time: ~{total * 10 / 60 / max_concurrent:.0f}-"
          f"{total * 20 / 60 / max_concurrent:.0f} hours\n")

    queue = list(remaining)
    # active: {interaction_id: (person, start_time)}
    active = {}
    results = []
    completed_count = 0

    mode = "a" if done_names else "w"
    f = open(output_path, mode)

    def launch_next():
        """Launch the next task from the queue."""
        nonlocal completed_count
        if not queue:
            return
        person = queue.pop(0)
        iid = start_deep_research(gemini_client, person)
        if iid:
            active[iid] = (person, time.time())
            print(f"  [{completed_count + len(active):>3d}/{total}] "
                  f"Launched: {person['name'][:50]}")
        else:
            # Research launch failed — classify as UNKNOWN
            result = _make_failed_result(person, "Deep Research launch failed")
            _save_result(f, result, results)
            completed_count += 1

    # Launch initial batch
    while len(active) < max_concurrent and queue:
        launch_next()

    # Poll loop
    while active:
        time.sleep(POLL_INTERVAL)
        done_ids = []

        for iid, (person, start_time) in active.items():
            elapsed = time.time() - start_time

            # Timeout check
            if elapsed > MAX_RESEARCH_WAIT:
                print(f"  TIMEOUT: {person['name']} ({elapsed/60:.0f} min)")
                done_ids.append(iid)
                result = _make_failed_result(person, "Deep Research timeout")
                _save_result(f, result, results)
                completed_count += 1
                continue

            status, text = poll_deep_research(gemini_client, iid)

            if status == "completed":
                done_ids.append(iid)
                elapsed_min = elapsed / 60

                # Classify with Opus
                classification = classify_person(opus_client, person, text)
                result = {
                    **person,
                    "research": text,
                    "grounded": True,
                    "research_mode": "deep-research",
                    "research_time_min": round(elapsed_min, 1),
                    **classification,
                }
                _save_result(f, result, results)
                completed_count += 1

                cls = classification.get("classification", "?")
                score = classification.get("forbes_score")
                gen = classification.get("generational_wealth", "?")
                print(f"  [{completed_count:>3d}/{total}] "
                      f"{person['name'][:40]:<40s} → "
                      f"{cls:<12s} Forbes {score or '?':>2}/10 "
                      f"Gen:{gen:<8s} ({elapsed_min:.1f}m)")

            elif status == "failed":
                done_ids.append(iid)
                print(f"  FAILED: {person['name']} — {text}")
                result = _make_failed_result(person, f"Deep Research failed: {text}")
                _save_result(f, result, results)
                completed_count += 1

            elif status == "error":
                # Transient polling error — keep trying
                if elapsed > MAX_RESEARCH_WAIT / 2:
                    done_ids.append(iid)
                    result = _make_failed_result(person, f"Polling error: {text}")
                    _save_result(f, result, results)
                    completed_count += 1

        # Remove completed, refill queue
        for iid in done_ids:
            del active[iid]
        while len(active) < max_concurrent and queue:
            launch_next()

        # Progress update
        pending_count = len(queue)
        active_count = len(active)
        if active_count > 0:
            elapsed_strs = []
            for iid, (person, start_time) in active.items():
                mins = (time.time() - start_time) / 60
                elapsed_strs.append(f"{mins:.0f}m")
            print(f"  ... active: {active_count}, "
                  f"queue: {pending_count}, "
                  f"done: {completed_count}/{total} "
                  f"(waits: {', '.join(elapsed_strs[:5])})")

    f.close()
    print(f"\nDeep Research complete: {completed_count}/{total}")
    return results


# ── Search Grounding (generate_content) ──────────────────────

def _extract_response_text(response):
    """Extract text from Gemini response, handling both .text and .parts formats."""
    try:
        if response.text:
            return response.text
    except Exception:
        pass
    # Fallback: iterate parts
    try:
        parts = response.candidates[0].content.parts or []
        texts = [p.text for p in parts if hasattr(p, "text") and p.text]
        return "\n".join(texts)
    except Exception:
        return ""


GEMINI_TIMEOUT = 120  # seconds max per Gemini API call


def _gemini_call(gemini_client, prompt):
    """Make a single Gemini API call (runs in a thread for timeout support)."""
    return gemini_client.models.generate_content(
        model=SEARCH_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
            temperature=0.1,
        ),
    )


def research_person_grounded(gemini_client, person, max_retries=2):
    """Use Gemini with search grounding to research a person (single-pass mode only).

    For multi-pass mode, use _run_parallel_research instead.
    """
    prompt = SEARCH_GROUNDING_PROMPT.format(
        name=person["name"],
        year=person.get("year", "Unknown"),
        category=person.get("category", "Unknown"),
        location=person.get("location", "Unknown"),
    )

    for attempt in range(max_retries + 1):
        try:
            # Run Gemini call in a thread with timeout to prevent hangs
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_gemini_call, gemini_client, prompt)
                response = future.result(timeout=GEMINI_TIMEOUT)

            research_text = _extract_response_text(response)
            grounded = bool(
                response.candidates
                and response.candidates[0].grounding_metadata
            )

            usage = response.usage_metadata
            input_tokens = usage.prompt_token_count if usage else 0
            output_tokens = usage.candidates_token_count if usage else 0

            if not research_text and attempt < max_retries:
                print(f"    Empty response, retrying ({attempt + 1}/{max_retries})...")
                time.sleep(2)
                continue

            return {
                "research": research_text,
                "grounded": grounded,
                "gemini_input_tokens": input_tokens,
                "gemini_output_tokens": output_tokens,
            }

        except concurrent.futures.TimeoutError:
            if attempt < max_retries:
                print(f"    Gemini TIMEOUT ({GEMINI_TIMEOUT}s), retrying "
                      f"({attempt + 1}/{max_retries})...")
                time.sleep(2)
                continue
            print(f"    Gemini TIMEOUT after {max_retries + 1} attempts")
            return {
                "research": f"ERROR: Gemini timeout ({GEMINI_TIMEOUT}s × {max_retries + 1})",
                "grounded": False,
                "gemini_input_tokens": 0,
                "gemini_output_tokens": 0,
            }

        except Exception as e:
            if attempt < max_retries:
                print(f"    Gemini error (attempt {attempt + 1}): {e}, retrying...")
                time.sleep(3)
                continue
            print(f"    Gemini error: {e}")
            return {
                "research": f"ERROR: {e}",
                "grounded": False,
                "gemini_input_tokens": 0,
                "gemini_output_tokens": 0,
            }


NUM_RESEARCH_PASSES = 3  # independent Gemini web searches per name


def _single_research_call(gemini_client, prompt):
    """Single Gemini research call — runs in thread, returns dict or raises."""
    response = _gemini_call(gemini_client, prompt)
    text = _extract_response_text(response)
    grounded = bool(response.candidates and response.candidates[0].grounding_metadata)
    usage = response.usage_metadata
    return {
        "research": text,
        "grounded": grounded,
        "source": "gemini",
        "gemini_input_tokens": usage.prompt_token_count if usage else 0,
        "gemini_output_tokens": usage.candidates_token_count if usage else 0,
    }


# ── Perplexity Research ──────────────────────────────────────

def _single_perplexity_call(prompt):
    """Single Perplexity Sonar research call — runs in thread, returns dict or raises."""
    api_key = os.getenv("PERPLEXITY_API_KEY")
    if not api_key:
        return {
            "research": "ERROR: PERPLEXITY_API_KEY not set",
            "grounded": False,
            "source": "perplexity",
            "gemini_input_tokens": 0,
            "gemini_output_tokens": 0,
        }

    resp = http_requests.post(
        PERPLEXITY_API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": PERPLEXITY_MODEL,
            "messages": [
                {"role": "system", "content": "You are a biographical researcher. "
                 "Provide factual, well-sourced biographical and financial information. "
                 "If you cannot find information, say so clearly."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
        },
        timeout=GEMINI_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()

    text = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    return {
        "research": text,
        "grounded": True,  # Sonar always searches the web
        "source": "perplexity",
        "gemini_input_tokens": usage.get("prompt_tokens", 0),
        "gemini_output_tokens": usage.get("completion_tokens", 0),
    }


def _run_parallel_research(gemini_client, person, num_passes=NUM_RESEARCH_PASSES):
    """Run Gemini + Perplexity research passes in parallel with timeout.

    Fires NUM_RESEARCH_PASSES Gemini calls + 1 Perplexity call concurrently.
    Returns list of results: [gemini_1, gemini_2, gemini_3, perplexity_1].
    """
    prompt = SEARCH_GROUNDING_PROMPT.format(
        name=person["name"],
        year=person.get("year", "Unknown"),
        category=person.get("category", "Unknown"),
        location=person.get("location", "Unknown"),
    )

    failed_result = {
        "research": "ERROR: timeout or failure",
        "grounded": False,
        "source": "unknown",
        "gemini_input_tokens": 0,
        "gemini_output_tokens": 0,
    }

    has_perplexity = bool(os.getenv("PERPLEXITY_API_KEY"))
    total_workers = num_passes + (1 if has_perplexity else 0)

    # Use daemon threads so they don't block process exit
    pool = concurrent.futures.ThreadPoolExecutor(max_workers=total_workers)

    # Submit Gemini passes
    gemini_futures = [pool.submit(_single_research_call, gemini_client, prompt)
                      for _ in range(num_passes)]

    # Submit Perplexity pass
    pplx_future = pool.submit(_single_perplexity_call, prompt) if has_perplexity else None

    results = []
    # Collect Gemini results
    for i, future in enumerate(gemini_futures):
        try:
            result = future.result(timeout=GEMINI_TIMEOUT)
            results.append(result)
        except concurrent.futures.TimeoutError:
            future.cancel()
            results.append({**failed_result, "source": "gemini",
                            "research": f"ERROR: Gemini pass {i+1} timeout ({GEMINI_TIMEOUT}s)"})
        except Exception as e:
            results.append({**failed_result, "source": "gemini",
                            "research": f"ERROR: Gemini pass {i+1}: {e}"})

    # Collect Perplexity result
    if pplx_future:
        try:
            result = pplx_future.result(timeout=GEMINI_TIMEOUT)
            results.append(result)
        except concurrent.futures.TimeoutError:
            pplx_future.cancel()
            results.append({**failed_result, "source": "perplexity",
                            "research": f"ERROR: Perplexity timeout ({GEMINI_TIMEOUT}s)"})
        except Exception as e:
            results.append({**failed_result, "source": "perplexity",
                            "research": f"ERROR: Perplexity: {e}"})

    # Don't wait for hung threads — let them die as daemon threads
    pool.shutdown(wait=False, cancel_futures=True)

    return results


def _merge_research_texts(research_results):
    """Format multiple research results for Opus, labeling each pass with source."""
    sections = []
    gemini_idx = 0
    for r in research_results:
        text = r.get("research", "")
        source = r.get("source", "gemini")

        if source == "perplexity":
            label = "Perplexity Sonar"
        else:
            gemini_idx += 1
            label = f"Gemini Pass {gemini_idx}"

        if text.startswith("ERROR:"):
            sections.append(f"**{label}**: [Search failed — no results]")
        else:
            grounded = "web-grounded" if r.get("grounded") else "ungrounded"
            sections.append(f"**{label}** ({grounded}):\n{text}")

    return "\n\n---\n\n".join(sections)


def run_search_grounding_pipeline(gemini_client, opus_client, persons, output_path,
                                  done_names=None):
    """Run 3-pass search grounding + Opus classification."""
    done_names = done_names or set()
    remaining = [p for p in persons if p["name"] not in done_names]
    total = len(remaining)

    if total == 0:
        print("All names already processed.")
        return []

    has_perplexity = bool(os.getenv("PERPLEXITY_API_KEY"))
    total_passes = NUM_RESEARCH_PASSES + (1 if has_perplexity else 0)
    est = total * 0.08 * NUM_RESEARCH_PASSES
    est_hours = total * 100 / 3600  # ~100s per name (parallel searches + Opus)
    pplx_label = f" + Perplexity {PERPLEXITY_MODEL}" if has_perplexity else ""
    print(f"\n  Mode: {total_passes}-Pass Search Grounding ({SEARCH_MODEL}{pplx_label})")
    print(f"  Names: {total}")
    print(f"  Research passes per name: {total_passes} (concurrent)")
    print(f"  Estimated cost: ~${est:.0f} (Gemini) + ~${total * 0.09:.0f} (Opus)")
    print(f"  Estimated time: ~{est_hours:.1f} hours\n")

    mode = "a" if done_names else "w"
    results = []

    with open(output_path, mode) as f:
        for i, person in enumerate(remaining, 1):
            group_label = person["group"].upper()
            name = person["name"]
            print(f"  [{i:>3d}/{total}] [{group_label:8s}] "
                  f"{name:<45s}", end="", flush=True)

            # Stage 1: 3 parallel Gemini research passes
            research_results = _run_parallel_research(gemini_client, person)

            # Count successful passes
            good_passes = [
                r for r in research_results
                if not r["research"].startswith("ERROR:")
            ]

            if not good_passes:
                total_passes = len(research_results)
                print(f" → ALL {total_passes} PASSES FAILED")
                result = {
                    **person,
                    **_make_unknown_fields(),
                    "research_1": research_results[0]["research"] if research_results else "",
                    "research_2": research_results[1]["research"] if len(research_results) > 1 else "",
                    "research_3": research_results[2]["research"] if len(research_results) > 2 else "",
                    "research_4": research_results[3]["research"] if len(research_results) > 3 else "",
                    "passes_succeeded": 0,
                    "grounded": False,
                    "research_mode": f"search-grounding-{total_passes}pass",
                    "gemini_model": SEARCH_MODEL,
                    "perplexity_model": PERPLEXITY_MODEL if any(r.get("source") == "perplexity" for r in research_results) else None,
                    "gemini_input_tokens": 0,
                    "gemini_output_tokens": 0,
                    "opus_input_tokens": 0,
                    "opus_output_tokens": 0,
                }
                _save_result(f, result, results)
                continue

            # Merge all research texts for Opus
            merged_research = _merge_research_texts(research_results)

            # Stage 2: Opus classification using all passes
            classification = classify_person(opus_client, person, merged_research)

            cls = classification.get("classification", "?")
            score = classification.get("forbes_score")
            gen = classification.get("generational_wealth", "?")
            cls_conf = classification.get("classification_confidence", "?")
            any_grounded = any(r.get("grounded") for r in research_results)
            total_passes = len(research_results)
            has_pplx = any(r.get("source") == "perplexity" for r in research_results)
            grounded_tag = f"{len(good_passes)}G" if any_grounded else "U"
            if has_pplx:
                grounded_tag += "+P"

            print(f" → {cls:<12s} Forbes {score or '?':>2}/10 "
                  f"Gen:{gen:<8s} ({cls_conf}) [{grounded_tag}]")

            # Sum tokens across all passes (guard against None values)
            total_gemini_in = sum(r.get("gemini_input_tokens") or 0 for r in research_results)
            total_gemini_out = sum(r.get("gemini_output_tokens") or 0 for r in research_results)

            result = {
                **person,
                "research_1": research_results[0]["research"] if research_results else "",
                "research_2": research_results[1]["research"] if len(research_results) > 1 else "",
                "research_3": research_results[2]["research"] if len(research_results) > 2 else "",
                "research_4": research_results[3]["research"] if len(research_results) > 3 else "",
                "passes_succeeded": len(good_passes),
                "grounded": any_grounded,
                "research_mode": f"search-grounding-{total_passes}pass",
                "gemini_model": SEARCH_MODEL,
                "perplexity_model": PERPLEXITY_MODEL if has_pplx else None,
                **classification,
                "gemini_input_tokens": total_gemini_in,
                "gemini_output_tokens": total_gemini_out,
            }
            _save_result(f, result, results)

            time.sleep(0.5)

    print(f"\nSearch Grounding complete: {len(results)}/{total}")
    return results


# ── Opus Classification ──────────────────────────────────────

def classify_person(opus_client, person, research_text):
    """Use Opus to classify based on research."""
    prompt = CLASSIFY_PROMPT.format(
        name=person["name"],
        category=person.get("category", "Unknown"),
        year=person.get("year", "Unknown"),
        location=person.get("location", "Unknown"),
        research=research_text,
    )

    try:
        response = opus_client.messages.create(
            model=OPUS_MODEL,
            max_tokens=1500,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.content[0].text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        result = json.loads(text)
        result["opus_input_tokens"] = response.usage.input_tokens
        result["opus_output_tokens"] = response.usage.output_tokens
        return result

    except json.JSONDecodeError as e:
        print(f"    Opus JSON error: {e}")
        print(f"    Raw: {text[:200]}")
        return {
            **_make_unknown_fields(),
            "rationale": f"JSON parse error: {e}",
            "opus_input_tokens": 0,
            "opus_output_tokens": 0,
        }
    except Exception as e:
        print(f"    Opus error: {e}")
        return {
            **_make_unknown_fields(),
            "rationale": str(e),
            "opus_input_tokens": 0,
            "opus_output_tokens": 0,
        }


# ── Helpers ──────────────────────────────────────────────────

def _make_unknown_fields():
    """Return default UNKNOWN classification fields."""
    return {
        "classification": "UNKNOWN",
        "classification_confidence": "LOW",
        "forbes_score": None,
        "forbes_confidence": "LOW",
        "wealth_source": "",
        "background": "",
        "trajectory": "",
        "rationale": "",
        "education": "Unknown",
        "museum_boards": "None found",
        "elite_boards": "None found",
        "generational_wealth": "UNKNOWN",
        "cultural_capital_notes": "",
        "social_capital_notes": "",
    }


def _make_failed_result(person, error_msg):
    """Return a failed result for a person."""
    return {
        **person,
        "research": f"ERROR: {error_msg}",
        "grounded": False,
        "research_mode": person.get("research_mode", "deep-research"),
        **_make_unknown_fields(),
        "rationale": error_msg,
        "gemini_input_tokens": 0,
        "gemini_output_tokens": 0,
        "opus_input_tokens": 0,
        "opus_output_tokens": 0,
    }


def _save_result(f, result, results_list):
    """Write result to JSONL and append to list."""
    results_list.append(result)
    f.write(json.dumps(result, ensure_ascii=False) + "\n")
    f.flush()


# ── Report ───────────────────────────────────────────────────

def print_report(results):
    """Print comprehensive summary analysis."""
    epstein = [r for r in results if r.get("group") == "epstein"]
    baseline = [r for r in results if r.get("group") == "baseline"]

    for label, group in [("EPSTEIN", epstein), ("BASELINE", baseline)]:
        if not group:
            continue

        print(f"\n{'='*70}")
        print(f"  {label} (n={len(group)})")
        print(f"{'='*70}")

        # Classification breakdown
        cls_counts = {}
        for r in group:
            c = r.get("classification", "UNKNOWN")
            cls_counts[c] = cls_counts.get(c, 0) + 1
        print(f"\n  Wealth Origin:")
        for c in ["SELF_MADE", "OLD_MONEY", "MIXED", "MARRIED_INTO", "UNKNOWN"]:
            n = cls_counts.get(c, 0)
            pct = n / len(group) * 100 if group else 0
            bar = "█" * int(pct / 2)
            print(f"    {c:<15s}: {n:>4d} ({pct:>5.1f}%) {bar}")

        # Generational wealth breakdown
        gen_counts = {}
        for r in group:
            g = r.get("generational_wealth", "UNKNOWN")
            gen_counts[g] = gen_counts.get(g, 0) + 1
        print(f"\n  Generational Wealth:")
        for g in ["1ST_GEN", "2ND_GEN", "3RD_PLUS", "UNKNOWN"]:
            n = gen_counts.get(g, 0)
            pct = n / len(group) * 100 if group else 0
            bar = "█" * int(pct / 2)
            print(f"    {g:<10s}: {n:>4d} ({pct:>5.1f}%) {bar}")

        # Forbes score distribution
        scored = [r for r in group if r.get("forbes_score") is not None]
        if scored:
            scores = [r["forbes_score"] for r in scored]
            print(f"\n  Forbes Self-Made Score (n={len(scored)}):")
            print(f"    Mean: {sum(scores)/len(scores):.2f}")
            dist = {}
            for s in scores:
                dist[s] = dist.get(s, 0) + 1
            for s in range(1, 11):
                n = dist.get(s, 0)
                pct = n / len(scored) * 100
                bar = "█" * int(pct / 2)
                print(f"    {s:>2d}: {n:>4d} ({pct:>5.1f}%) {bar}")

        # Confidence breakdown
        cls_confs = {}
        for r in group:
            c = r.get("classification_confidence", "LOW")
            cls_confs[c] = cls_confs.get(c, 0) + 1
        print(f"\n  Classification Confidence:")
        for c in ["HIGH", "MEDIUM", "LOW"]:
            print(f"    {c:<8s}: {cls_confs.get(c, 0):>4d}")

        # Education stats
        has_edu = sum(
            1 for r in group
            if r.get("education") and r["education"] != "Unknown"
        )
        print(f"\n  Education data found: {has_edu}/{len(group)} "
              f"({has_edu/len(group)*100:.0f}%)")

        # Board membership stats
        has_museum = sum(
            1 for r in group
            if r.get("museum_boards") and r["museum_boards"] != "None found"
        )
        has_elite = sum(
            1 for r in group
            if r.get("elite_boards") and r["elite_boards"] != "None found"
        )
        print(f"  Museum board members: {has_museum}/{len(group)} "
              f"({has_museum/len(group)*100:.0f}%)")
        print(f"  Elite board members:  {has_elite}/{len(group)} "
              f"({has_elite/len(group)*100:.0f}%)")

        # Grounding rate
        grounded = sum(1 for r in group if r.get("grounded"))
        print(f"  Web-grounded: {grounded}/{len(group)} "
              f"({grounded/len(group)*100:.0f}%)")

        # Pass success rate (multi-pass mode)
        pass_counts = [r.get("passes_succeeded") for r in group if r.get("passes_succeeded") is not None]
        if pass_counts:
            avg_passes = sum(pass_counts) / len(pass_counts)
            full_passes = sum(1 for p in pass_counts if p == NUM_RESEARCH_PASSES)
            print(f"  Avg passes succeeded: {avg_passes:.1f}/{NUM_RESEARCH_PASSES}")
            print(f"  All {NUM_RESEARCH_PASSES} passes succeeded: {full_passes}/{len(pass_counts)} "
                  f"({full_passes/len(pass_counts)*100:.0f}%)")

    # Cost summary
    total_gemini_in = sum(r.get("gemini_input_tokens", 0) for r in results)
    total_gemini_out = sum(r.get("gemini_output_tokens", 0) for r in results)
    total_opus_in = sum(r.get("opus_input_tokens", 0) for r in results)
    total_opus_out = sum(r.get("opus_output_tokens", 0) for r in results)

    gemini_cost = (
        total_gemini_in * SEARCH_PRICING["input"]
        + total_gemini_out * SEARCH_PRICING["output"]
    ) / 1_000_000
    opus_cost = (
        total_opus_in * OPUS_PRICING["input"]
        + total_opus_out * OPUS_PRICING["output"]
    ) / 1_000_000

    # Deep Research tasks don't report token usage — estimate from count
    deep_research_count = sum(
        1 for r in results if r.get("research_mode") == "deep-research"
    )
    deep_est = deep_research_count * DEEP_RESEARCH_COST_EST

    print(f"\n{'='*70}")
    print(f"  COST SUMMARY")
    print(f"{'='*70}")
    if deep_research_count > 0:
        print(f"  Deep Research: ~${deep_est:,.0f} "
              f"(est. {deep_research_count} tasks × ${DEEP_RESEARCH_COST_EST}/task)")
    if total_gemini_in > 0:
        print(f"  Gemini tokens: {total_gemini_in:>10,} in + "
              f"{total_gemini_out:>10,} out = ${gemini_cost:.2f}")
    print(f"  Opus tokens:   {total_opus_in:>10,} in + "
          f"{total_opus_out:>10,} out = ${opus_cost:.2f}")
    print(f"  Total:  ~${deep_est + gemini_cost + opus_cost:,.2f}")


# ── Backfill Perplexity ──────────────────────────────────────

def backfill_perplexity():
    """Add Perplexity pass to existing results and re-classify with Opus."""
    records = _load_all_results()
    if not records:
        return

    api_key = os.getenv("PERPLEXITY_API_KEY")
    if not api_key:
        print("ERROR: PERPLEXITY_API_KEY not set in .env")
        sys.exit(1)

    opus_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Filter to records that DON'T already have a perplexity pass
    needs_backfill = [r for r in records if not r.get("research_4")]
    already_done = len(records) - len(needs_backfill)

    print(f"Total unique records: {len(records)}")
    print(f"Already have Perplexity pass: {already_done}")
    print(f"Need backfill: {len(needs_backfill)}")

    if not needs_backfill:
        print("All records already have Perplexity pass.")
        return

    est_cost_pplx = len(needs_backfill) * 0.02
    est_cost_opus = len(needs_backfill) * 0.09
    est_hours = len(needs_backfill) * 15 / 3600  # ~15s per name (Perplexity + Opus)
    print(f"\nEstimated cost: ~${est_cost_pplx:.0f} (Perplexity) + "
          f"~${est_cost_opus:.0f} (Opus re-classify)")
    print(f"Estimated time: ~{est_hours:.1f} hours")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(OUTPUT_DIR, f"backfill_pplx_{timestamp}.jsonl")
    print(f"Output: {output_path}\n")

    results = []
    with open(output_path, "w") as f:
        for i, rec in enumerate(needs_backfill, 1):
            name = rec.get("name", "Unknown")
            print(f"  [{i:>4d}/{len(needs_backfill)}] {name:<45s}", end="", flush=True)

            # Build the prompt for Perplexity
            prompt = SEARCH_GROUNDING_PROMPT.format(
                name=name,
                year=rec.get("year", "Unknown"),
                category=rec.get("category", "Unknown"),
                location=rec.get("location", "Unknown"),
            )

            # Run Perplexity pass
            try:
                pplx_result = _single_perplexity_call(prompt)
            except Exception as e:
                pplx_result = {
                    "research": f"ERROR: Perplexity: {e}",
                    "grounded": False,
                    "source": "perplexity",
                    "gemini_input_tokens": 0,
                    "gemini_output_tokens": 0,
                }

            pplx_text = pplx_result.get("research", "")
            pplx_ok = not pplx_text.startswith("ERROR:")

            # Merge existing Gemini passes + new Perplexity pass for Opus
            all_research = []
            for pass_key in ["research_1", "research_2", "research_3"]:
                text = rec.get(pass_key, "")
                if text:
                    all_research.append({"research": text, "grounded": True, "source": "gemini"})

            all_research.append(pplx_result)
            merged = _merge_research_texts(all_research)

            # Re-classify with Opus using all passes
            person = {
                "name": name,
                "category": rec.get("category", "Unknown"),
                "year": rec.get("year", "Unknown"),
                "location": rec.get("location", "Unknown"),
            }
            classification = classify_person(opus_client, person, merged)

            cls = classification.get("classification", "?")
            score = classification.get("forbes_score")
            gen = classification.get("generational_wealth", "?")
            pplx_tag = "P" if pplx_ok else "Px"
            print(f" → {cls:<12s} Forbes {score or '?':>2}/10 "
                  f"Gen:{gen:<8s} [{pplx_tag}]")

            # Build updated record
            result = {
                **rec,
                "research_4": pplx_text,
                "perplexity_model": PERPLEXITY_MODEL,
                "passes_succeeded": (rec.get("passes_succeeded", 0) or 0) + (1 if pplx_ok else 0),
                **classification,
            }
            _save_result(f, result, results)

            time.sleep(0.3)

    print(f"\nBackfill complete: {len(results)}/{len(needs_backfill)}")
    print(f"Output: {output_path}")
    print(f"\nRun --apply-db to push updated results to Supabase.")


# ── Apply to DB ──────────────────────────────────────────────

# Model mapping for legacy files (before gemini_model field was added)
FILE_MODEL_MAP = {
    "researched_20260226_171429.jsonl": "gemini-3-pro-preview",
    "researched_20260226_203239.jsonl": "gemini-2.5-pro",
    "researched_20260226_203947.jsonl": "gemini-3-flash-preview",
    "researched_20260226_220217.jsonl": "gemini-3-flash-preview",
}


def _load_all_results():
    """Load all JSONL results, deduplicate (best record per name), return list."""
    files = sorted(
        f for f in os.listdir(OUTPUT_DIR)
        if (f.startswith("researched_") or f.startswith("backfill_pplx_"))
        and f.endswith(".jsonl")
    )
    if not files:
        print("No output files found in", OUTPUT_DIR)
        return []

    # Load all records, tagging with source file
    all_records = []
    for fname in files:
        fpath = os.path.join(OUTPUT_DIR, fname)
        model_fallback = FILE_MODEL_MAP.get(fname)
        with open(fpath) as f:
            for line in f:
                if line.strip():
                    rec = json.loads(line)
                    # Backfill gemini_model for legacy files
                    if not rec.get("gemini_model") and model_fallback:
                        rec["gemini_model"] = model_fallback
                    rec["_source_file"] = fname
                    all_records.append(rec)

    print(f"Loaded {len(all_records)} records from {len(files)} files")

    # Deduplicate: best record per name
    # Priority: classified > UNKNOWN, more passes > fewer, later file > earlier
    best = {}
    for rec in all_records:
        name = rec.get("name", "").strip()
        if not name:
            continue
        existing = best.get(name)
        if existing is None:
            best[name] = rec
            continue
        # Prefer classified over UNKNOWN
        new_classified = rec.get("classification", "UNKNOWN") != "UNKNOWN"
        old_classified = existing.get("classification", "UNKNOWN") != "UNKNOWN"
        if new_classified and not old_classified:
            best[name] = rec
        elif new_classified == old_classified:
            # Prefer more passes succeeded
            new_passes = rec.get("passes_succeeded", 0) or 0
            old_passes = existing.get("passes_succeeded", 0) or 0
            if new_passes > old_passes:
                best[name] = rec
            elif new_passes == old_passes:
                # Prefer later file (already sorted)
                best[name] = rec

    print(f"Deduplicated to {len(best)} unique names")
    return list(best.values())


def apply_to_db():
    """Read all JSONL results and upsert into wealth_profiles table."""
    records = _load_all_results()
    if not records:
        return

    sb = get_supabase()

    # Build name→feature_id map from records
    # Some records have feature_id, some might not
    records_with_fid = [r for r in records if r.get("feature_id")]
    records_without_fid = [r for r in records if not r.get("feature_id")]

    if records_without_fid:
        print(f"  {len(records_without_fid)} records missing feature_id — "
              "looking up by name...")
        # Look up feature_ids by homeowner_name
        all_features = []
        offset = 0
        while True:
            batch = sb.table("features").select(
                "id, homeowner_name"
            ).not_.is_("homeowner_name", "null").range(offset, offset + 999).execute()
            if not batch.data:
                break
            all_features.extend(batch.data)
            if len(batch.data) < 1000:
                break
            offset += 1000

        name_to_fid = {}
        for f in all_features:
            name = (f.get("homeowner_name") or "").strip()
            if name and name not in name_to_fid:
                name_to_fid[name] = f["id"]

        for rec in records_without_fid:
            name = rec.get("name", "").strip()
            fid = name_to_fid.get(name)
            if fid:
                rec["feature_id"] = fid
                records_with_fid.append(rec)
            else:
                print(f"    SKIP (no feature_id): {name}")

    # Upsert into wealth_profiles
    success = 0
    errors = 0
    for i, rec in enumerate(records_with_fid):
        row = {
            "feature_id": rec["feature_id"],
            "homeowner_name": rec.get("name", "Unknown"),
            "classification": rec.get("classification", "UNKNOWN"),
            "classification_confidence": rec.get("classification_confidence", "LOW"),
            "forbes_score": rec.get("forbes_score"),
            "forbes_confidence": rec.get("forbes_confidence", "LOW"),
            "wealth_source": rec.get("wealth_source", "Unknown") or "Unknown",
            "background": rec.get("background", "Unknown") or "Unknown",
            "trajectory": rec.get("trajectory", "Unknown") or "Unknown",
            "rationale": rec.get("rationale", "Unknown") or "Unknown",
            "education": rec.get("education", "Unknown") or "Unknown",
            "museum_boards": rec.get("museum_boards", "Unknown") or "Unknown",
            "elite_boards": rec.get("elite_boards", "Unknown") or "Unknown",
            "generational_wealth": rec.get("generational_wealth", "UNKNOWN") or "UNKNOWN",
            "cultural_capital_notes": rec.get("cultural_capital_notes", "Unknown") or "Unknown",
            "social_capital_notes": rec.get("social_capital_notes", "Unknown") or "Unknown",
            "gemini_model": rec.get("gemini_model"),
            "research_pass_1": rec.get("research_1", "")[:60000] if rec.get("research_1") else None,
            "research_pass_2": rec.get("research_2", "")[:60000] if rec.get("research_2") else None,
            "research_pass_3": rec.get("research_3", "")[:60000] if rec.get("research_3") else None,
            "research_pass_4": rec.get("research_4", "")[:60000] if rec.get("research_4") else None,
            "passes_succeeded": rec.get("passes_succeeded", 0) or 0,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        # Clean None/empty strings that would violate CHECK constraints
        if row["classification"] not in ("SELF_MADE", "OLD_MONEY", "MIXED", "MARRIED_INTO", "UNKNOWN"):
            row["classification"] = "UNKNOWN"
        if row["classification_confidence"] not in ("HIGH", "MEDIUM", "LOW"):
            row["classification_confidence"] = "LOW"
        if row["forbes_confidence"] not in ("HIGH", "MEDIUM", "LOW"):
            row["forbes_confidence"] = "LOW"
        if row["generational_wealth"] not in ("1ST_GEN", "2ND_GEN", "3RD_PLUS", "UNKNOWN"):
            row["generational_wealth"] = "UNKNOWN"

        try:
            sb.table("wealth_profiles").upsert(
                row, on_conflict="feature_id"
            ).execute()
            success += 1
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"    ERROR {rec.get('name', '?')}: {e}")

        if (i + 1) % 100 == 0:
            print(f"  Upserted {i + 1}/{len(records_with_fid)}...")

    print(f"\nApply complete: {success} upserted, {errors} errors")


# ── Appendix CSV ─────────────────────────────────────────────

APPENDIX_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "wealth_origin")

def export_appendix():
    """Generate wealth_profiles_all.csv from all JSONL files."""
    records = _load_all_results()
    if not records:
        return

    os.makedirs(APPENDIX_DIR, exist_ok=True)
    out_path = os.path.join(APPENDIX_DIR, "wealth_profiles_all.csv")

    fieldnames = [
        "name", "group", "feature_id", "category", "location", "year",
        "classification", "classification_confidence",
        "forbes_score", "forbes_confidence",
        "wealth_source", "background", "trajectory", "rationale",
        "education", "museum_boards", "elite_boards",
        "generational_wealth", "cultural_capital_notes", "social_capital_notes",
        "gemini_model", "perplexity_model", "passes_succeeded",
        "research_pass_1", "research_pass_2", "research_pass_3", "research_pass_4",
    ]

    with open(out_path, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for rec in sorted(records, key=lambda r: (r.get("group", ""), r.get("name", ""))):
            row = {k: rec.get(k, "") for k in fieldnames}
            # Map research_1/2/3/4 to research_pass_1/2/3/4
            row["research_pass_1"] = rec.get("research_1", "")
            row["research_pass_2"] = rec.get("research_2", "")
            row["research_pass_3"] = rec.get("research_3", "")
            row["research_pass_4"] = rec.get("research_4", "")
            writer.writerow(row)

    print(f"Exported {len(records)} rows to {out_path}")


# ── Main ─────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Research-backed wealth & social capital classification"
    )
    parser.add_argument(
        "--mode",
        choices=["search-grounding", "deep-research"],
        default="search-grounding",
        help="Research mode (default: search-grounding)",
    )
    parser.add_argument(
        "--baseline", type=int, default=0,
        help="Number of baseline names to classify (random sample)",
    )
    parser.add_argument(
        "--all-baseline", action="store_true",
        help="Classify ALL non-Epstein, non-Anonymous homeowners (no sampling)",
    )
    parser.add_argument(
        "--epstein", action="store_true",
        help="Classify all confirmed Epstein names",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Preview names and cost estimates without API calls",
    )
    parser.add_argument(
        "--resume", action="store_true",
        help="Resume interrupted run (skip already-done names)",
    )
    parser.add_argument(
        "--report", action="store_true",
        help="Print results summary from latest output",
    )
    parser.add_argument(
        "--apply-db", action="store_true",
        help="Read all JSONL results and upsert into wealth_profiles table",
    )
    parser.add_argument(
        "--appendix", action="store_true",
        help="Export wealth_profiles_all.csv from all JSONL files",
    )
    parser.add_argument(
        "--backfill-perplexity", action="store_true",
        help="Add Perplexity pass to existing results and re-classify with Opus",
    )
    parser.add_argument(
        "--concurrency", type=int, default=5,
        help="Max concurrent Deep Research tasks (default: 5)",
    )
    parser.add_argument(
        "--seed", type=int, default=42,
        help="Random seed for baseline selection (default: 42)",
    )
    parser.add_argument(
        "--model", type=str, default=None,
        help="Gemini model for search grounding (default: gemini-3-pro-preview)",
    )
    parser.add_argument(
        "--split", choices=["first", "second"],
        help="Process only first or second half of remaining names (for parallel runs)",
    )
    args = parser.parse_args()

    # Override global search model if specified
    if args.model:
        global SEARCH_MODEL
        SEARCH_MODEL = args.model

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # ── Backfill Perplexity mode ──
    if args.backfill_perplexity:
        backfill_perplexity()
        return

    # ── Apply-DB mode ──
    if args.apply_db:
        apply_to_db()
        return

    # ── Appendix mode ──
    if args.appendix:
        export_appendix()
        return

    # ── Report mode ──
    if args.report:
        files = sorted(
            f for f in os.listdir(OUTPUT_DIR)
            if f.startswith("researched_") and f.endswith(".jsonl")
        )
        if not files:
            print("No output files found in", OUTPUT_DIR)
            sys.exit(1)
        latest = os.path.join(OUTPUT_DIR, files[-1])
        print(f"Reading: {latest}")
        results = []
        with open(latest) as f:
            for line in f:
                if line.strip():
                    results.append(json.loads(line))
        print_report(results)
        return

    if not args.baseline and not args.epstein and not args.all_baseline:
        parser.print_help()
        print("\nSpecify --baseline N, --all-baseline, and/or --epstein")
        sys.exit(1)

    # ── Build name lists ──
    sb = get_supabase()
    random.seed(args.seed)

    names_to_process = []

    if args.epstein:
        epstein_names = get_confirmed_names(sb)
        print(f"Epstein confirmed names: {len(epstein_names)}")
        names_to_process.extend(epstein_names)

    if args.all_baseline:
        epstein_name_set = set(n["name"] for n in names_to_process)
        baseline_names = get_all_baseline_candidates(sb)
        baseline_names = [n for n in baseline_names if n["name"] not in epstein_name_set]
        print(f"All baseline candidates: {len(baseline_names)}")
        names_to_process.extend(baseline_names)
    elif args.baseline > 0:
        epstein_name_set = set(n["name"] for n in names_to_process)
        baseline_names = get_baseline_candidates(
            sb, args.baseline, exclude_names=epstein_name_set
        )
        print(f"Baseline candidates: {len(baseline_names)}")
        names_to_process.extend(baseline_names)

    print(f"Total to process: {len(names_to_process)}")

    # ── Resume mode ──
    done_names = set()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(OUTPUT_DIR, f"researched_{timestamp}.jsonl")

    if args.resume:
        files = sorted(
            f for f in os.listdir(OUTPUT_DIR)
            if f.startswith("researched_") and f.endswith(".jsonl")
        )
        if files:
            # Load done names from ALL existing output files
            # Only count CLASSIFIED names as done (not failed UNKNOWN)
            for fname in files:
                fpath = os.path.join(OUTPUT_DIR, fname)
                with open(fpath) as f:
                    for line in f:
                        if line.strip():
                            r = json.loads(line)
                            if r.get("classification", "UNKNOWN") != "UNKNOWN":
                                done_names.add(r["name"])
            resume_path = os.path.join(OUTPUT_DIR, files[-1])
            print(f"Resuming from: {resume_path}")
            print(f"  Already done: {len(done_names)}")
            if not args.split:
                output_path = resume_path  # Append to same file

    remaining = [n for n in names_to_process if n["name"] not in done_names]

    # ── Split mode (for parallel runs with different models) ──
    if args.split:
        mid = len(remaining) // 2
        if args.split == "first":
            remaining = remaining[:mid]
            print(f"Split: FIRST half ({len(remaining)} names)")
        else:
            remaining = remaining[mid:]
            print(f"Split: SECOND half ({len(remaining)} names)")

    print(f"Remaining to process: {len(remaining)}")

    # ── Dry run ──
    if args.dry_run:
        print(f"\n{'='*70}")
        print(f"  DRY RUN — {args.mode.upper()}")
        print(f"{'='*70}")

        ep = [n for n in remaining if n["group"] == "epstein"]
        bl = [n for n in remaining if n["group"] == "baseline"]

        if ep:
            print(f"\nEpstein ({len(ep)}):")
            for n in ep[:20]:
                print(f"  {n['name']:<45s} [{n['category']}] {n['location']}")
            if len(ep) > 20:
                print(f"  ... and {len(ep) - 20} more")

        if bl:
            print(f"\nBaseline ({len(bl)}):")
            for n in bl[:20]:
                print(f"  {n['name']:<45s} [{n['category']}] {n['location']}")
            if len(bl) > 20:
                print(f"  ... and {len(bl) - 20} more")

        total = len(remaining)
        if args.mode == "deep-research":
            est_cost = total * DEEP_RESEARCH_COST_EST
            est_hours_lo = total * 5 / 60 / args.concurrency
            est_hours_hi = total * 20 / 60 / args.concurrency
            print(f"\n  Estimated cost:  ~${est_cost:,.0f} "
                  f"({total} names × ~${DEEP_RESEARCH_COST_EST}/name)")
            print(f"  Estimated time:  ~{est_hours_lo:.0f}-{est_hours_hi:.0f} hours "
                  f"({total} names, {args.concurrency} concurrent)")
            print(f"\n  NOTE: Deep Research is expensive but comprehensive.")
            print(f"  For cheaper alternative: --mode search-grounding (~${total * 0.08:.0f})")
        else:
            est_cost = total * 0.08
            est_hours = total * 40 / 3600
            print(f"\n  Estimated cost:  ~${est_cost:.0f} "
                  f"({total} names × ~$0.08/name)")
            print(f"  Estimated time:  ~{est_hours:.1f} hours "
                  f"({total} names × ~40s/name)")
        return

    # ── Run pipeline ──
    gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    opus_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    print(f"\nOutput: {output_path}")

    if args.mode == "deep-research":
        results = run_deep_research_pipeline(
            gemini_client, opus_client, remaining, output_path,
            max_concurrent=args.concurrency, done_names=done_names,
        )
    else:
        results = run_search_grounding_pipeline(
            gemini_client, opus_client, remaining, output_path,
            done_names=done_names,
        )

    # Load any previously-done results for full report
    all_results = []
    with open(output_path) as f:
        for line in f:
            if line.strip():
                all_results.append(json.loads(line))

    print(f"\nDone! Output: {output_path}")
    print_report(all_results)


if __name__ == "__main__":
    main()
