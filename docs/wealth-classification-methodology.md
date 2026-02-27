# Wealth Origin Classification Methodology

## For the AD-Epstein Index

**Purpose**: Classify the wealth origin and self-made trajectory of every homeowner featured in Architectural Digest (1988-2025), enabling comparison between the Epstein-connected subset and the general AD population.

**Script**: `src/research_classify.py`

---

## 1. Classification Framework

### 1.1 Wealth Origin Categories

Each homeowner is classified into one of five categories:

| Category | Definition | Forbes Score Range |
|---|---|---|
| **SELF_MADE** | Built their own fortune. First-generation wealth. No inherited wealth or safety net. | 6-10 |
| **OLD_MONEY** | Inherited wealth from established family. Multi-generational fortune. | 1-3 |
| **MIXED** | Inherited a platform AND built significantly on top of it. Parvenus with patrician credentials. | 4-5 |
| **MARRIED_INTO** | Primary route to wealth/status was through marriage. | 2-5 |
| **UNKNOWN** | Insufficient biographical information to classify. | null |

### 1.2 Forbes Self-Made Score (1-10)

Adapted from the Forbes 400 Self-Made Score methodology. Measures the degree to which a person's wealth is self-generated versus inherited.

| Score | Description |
|---|---|
| 1 | Inherited fortune, not actively managing it. Lives off family trust. |
| 2 | Inherited fortune, has a role managing it but hasn't grown it significantly. |
| 3 | Inherited fortune, maintained family wealth level through own career. |
| 4 | Inherited sizable business/fortune and grew it much larger. |
| 5 | Inherited a small/medium advantage (seed money, connections, safety net) and built a major fortune. |
| 6 | Self-made from upper-class background (elite connections, expensive education, but NO family wealth as safety net). |
| 7 | Self-made from upper-middle-class background (comfortable, good education, no fortune). |
| 8 | Self-made from middle-class background (no particular advantages). |
| 9 | Self-made from working-class background (overcame meaningful disadvantage). |
| 10 | Self-made from poverty or extreme disadvantage. |

---

## 2. Classification Rules

### 2.1 The Safety Net Test (Forbes 5 vs 6)

The threshold between "inherited advantage" (Forbes 1-5) and "truly self-made" (Forbes 6+) is the **existence** of family wealth, not whether it was directly deployed.

- Did family wealth EXIST and was it AVAILABLE (even if not directly used)? → Forbes 5 or below.
- Did NO family wealth exist? → Forbes 6+ (truly self-made, no fallback if they failed).

A person who "rejected" family money but could have fallen back on it is NOT self-made. The safety net itself is the advantage.

### 2.2 The Googleable Parent Rule

**Rule**: If one or both parents are publicly prominent enough to appear in web search results, the subject cannot score Forbes 8 or higher.

**Rationale**: Forbes 8+ means "self-made from middle-class or below, no particular advantages." A parent with a public profile in any professional field — whether the same industry or not — represents meaningful access, connections, cultural capital, or a safety net. That is incompatible with "no particular advantages."

**Scoring caps**:

| Parent Prominence | Forbes Cap | Likely Classification |
|---|---|---|
| Parent prominent in the SAME or adjacent industry | Forbes 6 max | MIXED |
| Parent prominent in an UNRELATED industry | Forbes 7 max | SELF_MADE |
| Parent has a Wikipedia page | Forbes 4-5 | MIXED |
| Parent was a working professional with no public profile | No cap | — |

**Motivating case**: Robert Downey Jr. was initially scored Forbes 9 ("working-class background, overcame disadvantage") because research framed his upbringing as "bohemian" and "unconventional." However, his father Robert Downey Sr. was a well-known filmmaker. Growing up as the child of a prominent filmmaker in the film industry — regardless of the family's income level — provides industry access, cultural capital, and a network that is fundamentally different from a true working-class origin. Under this rule, RDJ would score Forbes 6 at most (self-made from an upper-class background in terms of access, even if not wealth).

**Self-check** (mandatory before assigning Forbes 8+): "Can I find this person's parents in the research?" If the research mentions a parent by name, occupation, or accomplishment, the subject is NOT Forbes 8+.

### 2.3 Wealth Multiplication Test (Forbes 3 vs 4-5)

The question is not "did they work hard" but "did they end up in a HIGHER wealth tier?"

- **Forbes 3**: Family was rich → they are still rich at roughly the same level. Career achievement (doctor, architect, actor, designer) does not equal wealth multiplication.
- **Forbes 4**: Family was rich → they are MUCH richer. They took the inherited platform and built an empire (e.g., inherited $10M → now worth $500M).
- **Forbes 5**: Family gave a modest boost → they built a MAJOR fortune that far exceeds it.

**Default rule for MIXED**: Score is 3 unless explicit evidence of wealth multiplication exists:
- Founded or ran a company with revenue far exceeding family wealth
- Appeared on Forbes/Bloomberg rich lists
- Built a real estate, media, or financial empire
- Concrete net worth figures showing clear upward jump

**Calibration examples**:
- Forbes 4: Donny Deutsch — inherited dad's ad agency, grew it into a $265M sale to Interpublic
- Forbes 4: Steve Tisch — Loews fortune heir, Oscar-winning producer, Giants co-owner
- Forbes 4: Malcolm Forbes — inherited Forbes magazine, built it into a media empire
- Forbes 5: Diane von Furstenberg — married a prince for the title, built a fashion empire

### 2.4 Consistency Rules

The Forbes score MUST fall within the valid range for the classification:

- SELF_MADE → Forbes 6-10
- MIXED → Forbes 4-5
- OLD_MONEY → Forbes 1-3
- MARRIED_INTO → Forbes 2-5
- UNKNOWN → Forbes null

If the score falls outside the valid range for the classification, either adjust the classification or the score.

---

## 3. Research Pipeline

### 3.1 Three-Pass Research

Each person receives up to three independent research passes using web-grounded LLM search:

1. **Pass 1**: Gemini with Google Search grounding — broad biographical facts
2. **Pass 2**: Gemini with Google Search grounding — targeted wealth/family queries
3. **Pass 3**: Perplexity API — independent corroboration with citations

The classification model receives ALL three passes and is instructed to trust the most specific, fact-rich findings. Specific biographical facts (family wealth, parents' occupations, inheritance) take precedence over vague statements like "no information found."

### 3.2 Classification Model

The final classification uses Claude Opus, which has the world knowledge needed for biographical assessment. Lighter models (Haiku, Sonnet) lack sufficient biographical knowledge for reliable classification.

### 3.3 Perplexity Backfill

Names initially researched with only Gemini passes receive a third pass via Perplexity API for independent corroboration. The backfill process runs separately and can be resumed if interrupted.

---

## 4. Academic Framework

### 4.1 Han, Nunes & Dreze (2010) Taxonomy

Our classification maps to the signaling theory framework from "Signaling Status with Luxury Goods":

| Quadrant | Wealth | Status Need | Our Category |
|---|---|---|---|
| **Patrician** | High | Low (quiet signals) | OLD_MONEY |
| **Parvenu** | High | High (loud signals) | MIXED |
| **Poseur** | Low | High (counterfeit signals) | — |
| **Proletarian** | Low | Low (no signals) | — |

**Key finding**: MIXED (Parvenu) is ~2x overrepresented in the Epstein orbit (25.9% vs 13.3% baseline). These are people who inherited a platform and performed aggressively on it — "parvenus with patrician credentials."

### 4.2 Supporting Literature

- Costa & Belk (1990): Nouveaux riches compensate for social insecurity through consumption
- Currid-Halkett (2017): *The Sum of Small Things* — conspicuous vs. inconspicuous consumption
- Bourdieu (1984): Cultural capital (embodied vs. objectified) — Epstein homes display objectified capital
- Han, Y.J., Nunes, J.C., & Dreze, X. (2010): "Signaling Status with Luxury Goods: The Role of Brand Prominence." *Journal of Marketing*, 74(4), 15-30.

---

## 5. Quality Controls

### 5.1 Known Biases

- **Celebrity recognition bias**: LLM classifiers are better at classifying famous people. UNKNOWN rate is higher in the baseline (less famous homeowners) than the Epstein group.
- **Research framing bias**: Web search results may frame upbringings as "humble" or "bohemian" when the family actually had significant industry access. The Googleable Parent Rule directly addresses this.
- **Wealth multiplication inflation**: Career achievement ("bestselling," "acclaimed," "prolific") can be mistaken for wealth multiplication. The Forbes 3 default for MIXED prevents this.

### 5.2 Confidence Levels

Each classification carries a confidence rating:
- **HIGH**: Research clearly supports the classification with specific facts
- **MEDIUM**: Partial evidence, suggestive but not definitive
- **LOW**: Thin or speculative evidence

Analysis should be performed on HIGH and MEDIUM confidence records only, with UNKNOWN excluded.

### 5.3 Couples

When research covers a couple, classification is based on the primary wealth holder — the person whose wealth/status most explains the AD-featured home. If both contributed roughly equally, the higher-earning partner's profile is used.

---

## 6. Data Outputs

- **JSONL files**: `data/wealth_research/*.jsonl` — raw research + classification results
- **Supabase table**: `wealth_profiles` — deduplicated, best-record-per-name, linked to features
- **Appendix CSV**: `data/wealth_origin/wealth_profiles_all.csv` — full export for review

---

## Changelog

| Date | Change |
|---|---|
| 2026-02-25 | Initial classification: 161 Epstein + 284 baseline, Opus-based |
| 2026-02-26 | Multi-model pipeline: Gemini 3 Pro/Flash + Perplexity backfill |
| 2026-02-27 | Forbes 3 default rule for MIXED; wealth multiplication calibration examples |
| 2026-02-27 | **Googleable Parent Rule**: Parents with public profile → Forbes 7 max; same-industry → Forbes 6 max; Wikipedia-level → MIXED |
