# Changelog

All notable changes to this project will be documented in this file. This changelog should be automatically updated with each commit or major milestone.

Format: entries are grouped by date, with the most recent at the top.

---

## 2026-02-17 (Session 40)

### Added — Full Archive Re-Extraction Pipeline

- **`src/reextract_features.py`** — NEW: Complete re-extraction pipeline that reads the full AD Archive spread data (not just JWT `featured` array). Parses all article metadata from spread JSON embedded in each issue page, aggregates pages per article across spreads, filters by section (SKIP_SECTIONS) + page count (>=3), then classifies remaining candidates via Haiku. Pipeline modes: `--scan` (preview counts), `--extract` (full pipeline with image download), `--images` (backfill images for existing stubs). Processes all 470 issues.
- **Result**: 2,305 new features extracted and inserted with images (6 pages each from Azure Blob), bringing total from ~1,600 to **4,081 features**. Haiku classification cost: $0.57. ~81-90% coverage of actual home tours (misses are designer-name-only titles and themed specials).

### Changed — Manual Dossier Overrides (DOJ Evidence Review)

- **Diane von Furstenberg** (dossier #416): REJECTED → CONFIRMED (HIGH). DOJ document EFTA00758094 shows her on a Yom Kippur guest list with Jeffrey Epstein. Original rejection was based on surname-only BB match + marketing email false positives.
- **Sharon Stone** (dossier #466): REJECTED → CONFIRMED (MEDIUM). DOJ evidence indicates attendance at event with someone close to Epstein, with plans to meet up.
- **Nat Rothschild** (dossier #414): Added 8th finding — DOJ document EFTA02426782 showing email chain with Peter Mandelson, Epstein cc'd.
- **Total confirmed**: 73 → 75

### Changed — Opus Vision Scoring (Batch 2 In Progress)

- **`src/score_features.py`** — Batch 1 complete (254 scored, $36.31). Batch 2 launched for 1,649 new features. Scoring includes 9-axis v2.2 rubric + structural data enrichment (homeowner name, designer, location, style, year built).

---

## 2026-02-17 (Session 39)

### Changed — Sankey 6-Stage Funnel + Agent Attribution

- **`web/src/components/charts/VerdictSankey.tsx`** — Added DOSSIER BUILT node as new Researcher stage, expanding from 5-stage to 6-stage funnel (Features → Cross-Refs → Detective Tiers → Dossier Built → Editor Verdict → Connection Strength). Added agent attribution labels (italic, dimmed) on every Sankey node showing which agent handles that stage (Reader+Courier, Detective, Researcher, Editor). Agent names also appear in tooltips. Purple color scheme for Dossier Built node. Right margin reduced 120→80px.

### Changed — Methodology Section Visual Polish

- **`web/src/components/landing/MethodologySection.tsx`** — Section subhead fonts reduced (32→24px titles, 20→15px subtitles) and constrained to 2 major columns width via `maxWidth: calc(2 * (100% - 5 * 24px) / 6 + 1 * 24px)`. Applied to both SectionHeader component and manual Section 3 header. Added figure captions (Fig. 1–6) for pipeline flow, architecture SVG, hub-and-spoke diagram, Miranda card, agent grid, and Agent Office video. Replaced plain div connectors in verdict flow with SVG directional arrows (circle → line → arrowhead). Miranda sprite video now uses `<source>` elements: .mov (Safari) primary, .webm (Chrome/Firefox) fallback via Supabase Storage.

### Changed — Dossier Aesthetic Radar

- **`web/src/components/dossier/DossierDetail.tsx`** — Replaced design_style Badge card with new DossierAestheticRadar component showing per-feature 9-axis radar chart.
- **`web/src/components/dossier/DossierAestheticRadar.tsx`** — NEW: Recharts radar chart for individual feature aesthetic scores.

### Fixed — Editor Inconclusive Verdict Handling

- **`src/agents/editor.py`** — Inconclusive detective verdicts (timeout/error) no longer prematurely write `binary_verdict=NO` to features table. Instead, xref is written for observability but `detective_verdict` stays NULL, keeping the name in the unchecked pool for re-queuing. Sanitizes doj_status and combined_verdict values to match Supabase CHECK constraints before writing. Immediate detective re-queue after batch completion (eliminates 5-15 hour gap between batches). Deferred graph analytics: `recompute_after_verdict()` removed from dossier confirm path to avoid blocking Playwright DOJ searches (~140s freeze). DOJ retry now collects all feature_ids for duplicate names.

### Fixed — Pipeline Event Loop Blocking

- **`src/orchestrator.py`** — `graph_sync_loop` and `watercooler_loop` now use `asyncio.to_thread()` to run sync functions off the main event loop, preventing Playwright CDP contention.
- **`src/db.py`** — `get_xrefs_needing_doj_retry()` now includes `doj_status='error'` (not just 'pending'), returns `or []` fallback for empty results.
- **`src/agents/tasks.py`** — Cross-reference task deduplication uses sorted name hash instead of missing identifier (fixes duplicate batches).

### Changed — Scoring v2.2 (Per-Axis Rationale)

- **`src/score_features.py`** — Bumped to v2.2: LLM now provides 1-sentence rationale for each of the 9 scoring axes. Added CRITICAL scoring clarifications for hospitality (intent not room size), formality (lived-in aristocratic homes ≠ formal), curation (personal collections ≠ designer-curated), theatricality (inherited wealth ≠ performance). max_tokens increased 1024→2048 for rationale output. Rationale stored as JSONB in `scoring_rationale` column. Updated cost estimates for v2.2 output size.

### Changed — Agent Skills Updates

- **`src/agents/skills/reader.md`** — 7 meta-commentary discipline interventions for Elias (keeps writing proposals instead of extracting).
- **`src/agents/skills/scout.md`** — Claude Code session handling workaround (don't launch claude_code inside claude_code).
- **`src/agents/skills/designer.md`** — Source rotation protocol for failed training sources.

### Changed — Agent Office

- **`tools/agent-office/agent-office.html`** — Disabled Neo4j knowledge graph panel (queries were slowing dashboard refresh).

---

## 2026-02-16 (Session 38)

### Changed — Sankey Diagram & Methodology Visual Polish

- **`web/src/components/charts/VerdictSankey.tsx`** — Renamed "NOT CROSS-REFERENCED" node to "ANONYMOUS" throughout (NODE_THEME, LINK_THEME, node construction). Increased chart height from 560px to 600px and bottom margin from 12 to 32 to prevent COINCIDENCE node from being cut off.
- **`web/src/components/landing/MethodologySection.tsx`** — Updated vertical flow diagram colors to on-system palette: GOLD (`#B8860B`), RED (`#9B2226`), COPPER (`#B87333`), SLATE (`#4A7C8F`). BLACK BOOK/DOJ boxes now copper instead of gold. Detective verdict badges updated: NEEDS REVIEW (slate), LIKELY (copper), POSSIBLE (gold), NO MATCH (red). Fixed bright-yellow borders and bright-red headers to on-system colors.
- **`web/src/lib/queries.ts`** — Fixed Supabase 1,000-row limit for features count: added `{ count: "exact" }` to `.select()` and use `featuresCount` instead of `allFeatures.length`. Stats now correctly report ~1,600 features instead of capping at 1,000.

---

## 2026-02-16 (Session 37)

### Fixed — Detective DOJ Search Timeouts (Subprocess Architecture)

- **`src/doj_search_worker.py`** — NEW: Standalone subprocess that runs Playwright DOJ searches in its own clean asyncio event loop. Accepts JSON names on stdin, returns results on stdout, sends progress to stderr. Isolates Playwright's CDP protocol from orchestrator event loop contention.
- **`src/agents/detective.py`** — Major refactor: DOJ searches now run in a subprocess instead of in-process. New `_search_doj_subprocess()` launches worker via `asyncio.create_subprocess_exec()`, collects all individual names first, searches them in one batch, then processes verdicts from cached results. Removes per-name browser retry/relaunch complexity and `problem_solve()` DOJ recovery logic.
- **`src/doj_search.py`** — Removed timing instrumentation (`[DOJ-TIMING]` debug prints)
- **Root cause**: Orchestrator event loop contention from watercooler, graph sync, reflections, curiosity, and LLM calls blocked Playwright's CDP pipe, preventing `wait_for_selector` timeout callbacks from firing. Subprocess gives Playwright a dedicated event loop immune to contention.
- **Result**: First batch of 60/60 names searched successfully (was 0/60 with timeouts before)

### Fixed — Undefined `timeouts` Variable

- Fixed `NameError` in detective.py batch completion log — `timeouts` variable was referenced but never defined after subprocess refactor removed per-name timeout tracking

---

## 2026-02-15 (Session 36)

### Added — Aesthetic Methodology Section (Warm Dark-Cream Palette)

- **`web/src/components/landing/AestheticMethodologySection.tsx`** — NEW: Standalone methodology section for the v2 9-axis scoring instrument, visually distinct from the Agent Methodology section
- **Warm dark-cream palette**: BG `#1B1815`, card `#242019`, border `#3A332A`, text `#E8E0D4`/`#B0A594` — espresso tones vs the cool purple-blue of Agent Methodology
- **Typography split**: Inter (BODY) for prose/descriptions, JetBrains Mono (MONO) for headers/labels/data values — scholarly instrument feel, not terminal
- **9-axis radar chart**: Recharts RadarChart showing all 9 predicted divergence values (AD Baseline vs Epstein Orbit), group-colored axis labels (SPACE/STORY/STAGE), full-width card
- **Three sections**: The Instrument (9 axis cards with 1-5 scale bars), The Epstein Signature (diagnostic formula + predicted gaps), Scoring Methodology (rater/input/validation + bibliography)
- **Proper bibliography**: 8 academic citations formatted with italic titles, journal names, article titles in quotes — single column layout
- **Warm card glow**: Subtle copper box-shadow on all cards (`0 0 24px rgba(184, 115, 51, 0.06)`)
- **1px border-top** separates Agent and Aesthetic methodology sections

### Changed — Methodology Section Split

- Split single `MethodologySection` into two independent sections: `AgentMethodologySection` (cool purple-blue, terminal aesthetic) and `AestheticMethodologySection` (warm dark-cream, scholarly aesthetic)
- `page.tsx` updated to import and render both sections sequentially
- Header nav: added "Aesthetic Methodology" link
- Footer: added "Aesthetic Methodology" link

---

## 2026-02-14 (Session 35)

### Added — Aesthetic Scoring Pipeline (Opus Vision)

- **`src/score_features.py`** — NEW: Opus Vision scoring script implementing v2 9-axis rubric. Sends article page images + rubric prompt to Claude, extracts 1-5 numeric scores for all 9 axes, updates `features` table. Flags: `--dry-run`, `--limit`, `--id`, `--rescore`, `--model`.
- **`src/backfill_feature_images.py`** — NEW: Downloads article page images from Azure Blob Storage (free, public) and uploads to Supabase Storage (`feature-images` bucket). Records URLs in `feature_images` table. Flags: `--dry-run`, `--limit`, `--id`, `--skip-done`, `--unscored`.
- **`migrations/002_feature_images_and_scores.sql`** — NEW: Adds 9 SMALLINT score columns (1-5 CHECK constraints) + `scoring_version` + `scored_at` to features table. Creates `feature_images` table with storage paths and public URLs.

### Changed — 3-Strategy Article Matching

- Both `score_features.py` and `backfill_feature_images.py` now use 3-strategy matching to find articles in the AD Archive JWT catalog:
  1. **Name matching**: Homeowner last name in Title/Teaser/Creator (original approach)
  2. **Title matching**: Feature's `article_title` against JWT Title field
  3. **Page number matching**: Feature's `page_number` falls within article's PageRange
- Reduces skip rate from ~30% to ~5% — features like "Virginia's Shirley Plantation" (Hill Carter) and "High Style in Palm Beach" (Irene Benson Williams) now resolve correctly

### Database

- Added 9 score columns to `features`: `score_grandeur`, `score_material_warmth`, `score_maximalism`, `score_historicism`, `score_provenance`, `score_hospitality`, `score_formality`, `score_curation`, `score_theatricality`
- Added `scoring_version TEXT` and `scored_at TIMESTAMPTZ` to features
- Created `feature_images` table (feature_id, page_number, storage_path, public_url)
- Created `feature-images` Supabase Storage bucket (public)

### Initial Scoring Results (38 features)

- 38 features scored with Opus Vision at ~$0.08/feature
- Average scores: Grandeur 3.2, Material Warmth 4.5, Maximalism 3.3, Historicism 3.4, Provenance 4.4, Hospitality 2.6, Formality 2.6, Curation 2.6, Theatricality 1.9
- STAGE composite ranges from 3 (Vonnegut, Updike) to 12 (Nile Rodgers, Cecil Hayes)
- These 38 will be re-scored with full image sets (originally capped at 6 images)

---

## 2026-02-14 (Session 34)

### Added — 9-Axis Aesthetic Scoring Instrument v2

- **`docs/aesthetic-scoring-instrument.md`** — NEW: Complete specification for the v2 scoring system replacing the v1 categorical taxonomy
- **9 axes in 3 groups**: SPACE (Grandeur, Material Warmth, Maximalism), STORY (Historicism, Provenance, Hospitality), STAGE (Formality, Curation, Theatricality)
- Numeric 1-5 scales replace single-select categorical values — enables statistical analysis (t-tests, effect sizes, clustering, PCA)
- Each axis has concrete scoring anchors calibrated through Q&A with licensed architect/designer
- 8 academic citations grounding methodology in Bourdieu, Veblen, Shabrina et al., semantic differential theory, and LLM-as-a-Judge reliability
- Previous "Eclecticism" axis removed — redundant with Historicism (same dimension, opposite ends)
- New "Hospitality" axis added — private retreat vs. social venue. Critical for Epstein investigation (homes as venues)
- Predicted Epstein signature: STAGE group (Formality + Curation + Theatricality) shows largest divergence from baseline
- Diagnostic composite formula: `(Theatricality + Curation + Formality) - (Provenance + Material Warmth)`
- Two edge case exercises validated scoring consistency (Palm Beach mansion, Connecticut farmhouse)

---

## 2026-02-14 (Session 33)

### Added — Subject Category Classification (Profession Tags)
- **`src/classify_dossier_subjects.py`** — NEW: Classifies all AD homeowner names into profession categories. 10 categories: Associate, Politician, Legal, Royalty, Celebrity, Business, Designer, Socialite, Private, Other. Flags: `--all`, `--reclassify-other`, `--dry-run`.
- Initial pass with Haiku (~$0.05), then full QA audit with Opus (~$1.70) after 27% disagreement rate found systematic errors: Haiku over-classified artists/writers as Celebrity, and homeowner=designer heuristic overcorrected Private→Designer
- Opus reclassified all 1,368 unique names across 1,600 features + 320 dossiers. 458 features corrected.
- **Corrected baseline**: Private 34.9%, Designer 18.6%, Celebrity 15.5%, Business 13.3%, Other 9.8%, Socialite 4.2%, Royalty 2.6%, Politician 0.9%
- **Key finding**: Socialites 3.3x, Royalty 2.3x, Business 1.8x overrepresented in Epstein orbit. Private citizens 0.3x (nearly absent).
- Guy and Marie-Hélène de Rothschild manually overridden to CONFIRMED (duplicate of already-confirmed "Baron and Baroness Guy de Rothschild")

### Fixed — Supabase 1000-Row Pagination Bug
- **`src/db.py`** — `list_cross_references()` and `list_dossiers()` were silently truncating at 1000 rows (Supabase default limit). Added pagination loops with `.range(offset, offset + 999)`. Agent Office dashboard "Names" panel was stuck at 1000 instead of actual 1,057.

### Fixed — Detective Dashboard Status Messaging
- **`src/agent_status.py`** — Detective status now shows backlog progress ("Checking 1056/1600 names (66%) — 544 remaining") instead of misleading completion stats.

### Database
- Added `subject_category TEXT` column to both `features` and `dossiers` tables (10 valid categories)

---

## 2026-02-14 (Session 32)

### Changed — Tighter Spacing Between "Who Are They?" and Searchable Index
- **`web/src/components/landing/KeyFinding.tsx`** — Reduced bottom padding from `pb-20` (80px) to `pb-6` (24px) so the searchable index flows directly below the editorial text.
- **`web/src/components/landing/SearchableIndex.tsx`** — Removed top padding (`pt-6` → `pt-0`) for seamless connection with the section above.
- **`web/src/app/page.tsx`** — Suspense fallback changed from `py-20` to `pb-20` to match tighter spacing.

### Added — "What's Next" Section + Contact Email
- **`web/src/components/landing/WhatsNext.tsx`** — NEW: Two-column section between Conclusion and Methodology. Left column: "The Pipeline Is Still Running" (ongoing investigation status, live data). Right column: "Future Directions" (other shelter magazines, open codebase). Contact line centered below with copper mailto link (john.h.locke@gmail.com).
- **`web/src/app/page.tsx`** — Added `WhatsNext` import and placement between Conclusion and Methodology.

### Figma Sync
- Created "What's Next + Contact" frame in Figma matching website layout (two-column text, copper sub-labels, centered contact).
- Updated "B: Who Are They?" frame: reduced bottom padding from ~132px to 24px to match website `pb-6`.
- Updated "Searchable Index" frame: removed top padding to match website `pt-0`. All downstream frames shifted up 132px.

---

## 2026-02-14 (Session 31)

### Added — Live Radar Chart in "Is There an Epstein Aesthetic?"
- **`web/src/components/charts/AestheticRadarCard.tsx`** — NEW: Compact radar chart client component matching ConfirmedTimeline diagram styling (#FAFAFA bg, 1px border, subtle drop shadow, 340px height). Copper fill for Epstein orbit, dashed green for AD baseline. Custom tooltip and multi-line axis tick labels.
- **`web/src/components/landing/EpsteinAesthetic.tsx`** — Rewrote three-column layout: center text column replaced with live `AestheticRadarCard`. Now accepts `radarData` prop from server. Updated body text to match editorial copy.
- **`web/src/app/page.tsx`** — Added `getAestheticRadarData()` call via `Promise.all` with `getStats()`. Passes `radarData` to both `EpsteinAesthetic` and `MethodologySection`.
- **`web/src/components/landing/MethodologySection.tsx`** — Now receives `radarData` prop and passes it to embedded `AestheticRadar`, making it live (was previously showing loading state).

### Added — "Full Dossier Created" Filter
- **`web/src/components/landing/SearchableIndex.tsx`** — Added "Full dossier created" checkbox filter above "Confirmed connections only". Queries dossier table to filter features.
- **`web/src/app/api/features/route.ts`** — Added `hasDossier` query parameter passthrough.
- **`web/src/lib/queries.ts`** — Implemented `hasDossier` filter: queries dossiers table for all feature_ids, filters features to those IDs.

### Changed — Body Text Styling
- All body text across HeroSection, KeyFindingsIntro, Conclusion, ConfirmedTimeline, and GraphPreview changed from opacity-based `text-foreground/XX` to solid `text-[#1A1A1A]` for consistent readability.
- Section headings in page.tsx (sections C and D) reduced from `text-[36px]` to `text-[28px]` to match design system.

### Figma Sync
- Updated "E: Is There an Epstein Aesthetic?" frame: center text column replaced with radar chart placeholder, "KEY FINDING 02" label set to copper (#B87333), "Aesthetic Score Distribution" made full width, body text updated to match website copy.

---

## 2026-02-14 (Session 30)

### Fixed — Rejected Dossier Audit & Verdict Overrides
- **Full audit of 154 rejected dossiers** — Found 3 wrongly rejected due to triage not reading DOJ evidence:
  - **Mica Ertegun** — 3 DOJ hits including contact database entry and dinner thank-you letter. Overridden to CONFIRMED.
  - **David Copperfield** — 54 DOJ hits, publicly documented Epstein associate. Auto-rejected as COINCIDENCE due to fame-dismissal bug. Overridden to CONFIRMED.
  - **Joy and Regis Philbin** — DOJ docs say "lunch with Regis and Joy Philbin today." Dining together = direct connection per investigation policy. Overridden to CONFIRMED.
- **Total confirmed: 33** (was 30).

### Fixed — Detective Stale Task Purge
- **`src/agents/editor.py`** — Exempted `cross_reference` tasks from stale task cleanup. Detective's DOJ browser searches legitimately take hours (50 names × DOJ search = 2-3 hours). The 60-minute stale cleanup was killing batches before completion, leaving 845 features unchecked.
- Pipeline restarted — detective now processing the 845 remaining unchecked features.

### Added — Investigation Policy Refinements
- Dining/lunch together = confirmed connection (Mica Ertegun, Philbin precedents)
- BB contact entry with phone numbers = confirmed (direct network evidence)
- DOJ mention alone ≠ confirmed — must show actual interaction
- Dislike/negative context ≠ connection (Isabel Goldsmith precedent)
- "Mentioned by someone else" ≠ connection (William Goldman precedent)
- Family members in DOJ ≠ confirmed for different family member (Elissa Cullman precedent)

---

## 2026-02-14 (Session 29)

### Added — Aesthetic Radar Chart (Real Data)
- **`web/src/components/charts/AestheticRadar.tsx`** — Rewrote placeholder radar chart to accept real server data via props. Two variants: `"standalone"` (light bg, editorial text + chart) for page sections, `"embedded"` (dark bg, chart-only) for MethodologySection. 6 composite axes derived from taxonomy data: Classical Grandeur, Old Masters & Antiques, Maximalism, Euro-Centric, Gallery & Institutional, Minimalism.
- **`web/src/lib/queries.ts`** — Added `getAestheticRadarData()` server query (cached 5 min). Fetches all features with `aesthetic_profile` JSONB, splits by confirmed dossier status, computes 6 composite axis percentages. Replaced Stone & Marble axis (1.0x, no signal) with Gallery & Institutional (1.4x).
- **`web/src/lib/types.ts`** — Added `RadarAxisData` and `AestheticRadarData` interfaces.
- **`web/src/components/landing/MethodologySection.tsx`** — Updated `AestheticRadar` usage to pass `variant="embedded"`.

### Fixed — Pipeline Agent Responsiveness
- **`src/agents/base.py`** — Idle work loop now checks inbox between each idle call (reflect, explore, improve, chatter) and breaks out immediately if a task arrives. Each idle call gets a 30s timeout via `asyncio.wait_for()`. Sleep loop checks inbox every 1s for wake-up.
- **`src/agents/detective.py`** — Pre-warms DOJ browser before the name-checking loop. Added progress logging showing batch position and verdicts.
- **`src/agents/editor.py`** — Increased stale task cleanup threshold from 15 min to 60 min. Capped detective batch at 50 names to avoid overflowing LLM name analysis.

---

## 2026-02-14 (Session 28)

### Changed — Searchable Index Grid Alignment
- **`web/src/components/landing/SearchableIndex.tsx`** — Replaced flexbox filter bar with 6-column CSS Grid (`grid grid-cols-6 gap-x-6 gap-y-3`) for pixel-perfect alignment with the design grid. Search spans columns 1-2, Year/Style/Location each get one column. Moved "Confirmed connections only" checkbox to a second row below search with smaller text. Removed redundant "Showing X of Y results" text (pagination already at bottom). Added Location filter input wired into API.

### Changed — Hero Section Polish
- **`web/src/components/landing/HeroSection.tsx`** — Increased spacer between Thoreau epigraph and headline from `mb-12 md:mb-16` to `mb-24` (96px). Added `shadow-sm` drop shadow to the Confirmed Connections stat box.

### Changed — Pipeline Architecture Diagram (Phase 01)
- **`web/src/components/landing/MethodologySection.tsx`** — Separated phase cards from architecture diagrams. Phase cards now render as a clean 3-column grid without stacked placeholders. Architecture diagrams render full-width below: Phase 01 as live SVG, Phases 02 & 03 as placeholders.
- **`web/public/pipeline-phase01.svg`** — NEW: Phase 01 Architecture diagram exported from Figma. Hub-and-spoke layout showing Scout, Courier, and Reader agents with assign/task-result arrows through the Editor Agent to Supabase. 2496x960, dark purple background (#1A0E2E).

### Figma Sync
- Synced all code changes to Figma (hero spacer, stat shadow, filter grid, table columns)
- Added 6-column layout grids to all Figma section frames for snap-to-column design
- Resized Phase 01 Architecture placeholder to 480px, shifted downstream sections
- Designed and exported Phase 01 pipeline architecture diagram in Figma

---

## 2026-02-13 (Session 27)

### Changed — Simplified Page Layout
- **`web/src/app/page.tsx`** — Removed 5 standalone chart sections (CoverageHeatmap, FeaturesTimeline, StyleDistribution, GeographicMap, VerdictBreakdown). Page now flows: Hero → Key Finding → Searchable Index → Confirmed Timeline → Knowledge Graph → Methodology. Replaced `KeyFindings` with new `KeyFinding` component.
- **`web/src/components/landing/SearchableIndex.tsx`** — Confirmed-only checkbox defaults to ON (`!== "false"` logic). Reduced to 8 rows per page. Widened to full grid width (`width="wide"`). Removed title/subtitle — filters are first content. Added copper-accented checkbox with "Confirmed connections only" label.
- **`web/src/app/api/features/route.ts`** — Added `confirmedOnly` filter param to features API.
- **`web/src/lib/queries.ts`** — Added confirmed timeline data to stats query (dossier subjects placed on year axis with location/strength).
- **`web/src/lib/types.ts`** — Added `confirmedTimeline` array to `StatsResponse` interface.

### Added — New Components
- **`web/src/components/landing/KeyFinding.tsx`** — NEW: Three-column editorial Key Finding section replacing the old KeyFindings dashboard-style cards.
- **`web/src/components/charts/ConfirmedTimeline.tsx`** — NEW: Timeline visualization of confirmed Epstein connections by year.
- **`web/src/components/charts/AestheticRadar.tsx`** — NEW: Radar chart component for aesthetic taxonomy comparison.
- **`web/src/components/charts/USMapDiagram.tsx`** — NEW: US map diagram component.

### Changed — Methodology Section Overhaul
- **`web/src/components/landing/MethodologySection.tsx`** — Complete rewrite: dark investigative-themed design with 5-phase pipeline visualization, agent grid (7 agents with sprites + roles), data metrics, "Epstein Aesthetic" radar comparison, and footnotes. Includes Miranda hero row and Sable designer agent.

### Changed — Hero & Header Polish
- **`web/src/components/landing/HeroSection.tsx`** — Removed bottom border, lightened epigraph color to `#B7B7B7`, centered headline block, adjusted subtitle sizing.
- **`web/src/components/layout/Header.tsx`** — Minor layout adjustment.

### Changed — Agent Skills
- **`src/agents/skills/designer.md`** — Added Sable designer agent personality and methodology documentation.
- **`src/agents/skills/reader.md`** — Updated Elias reader agent skill file.

### Figma Sync
- Deleted 5 chart section frames from Figma (Coverage Heatmap, Features by Year, Design Styles, Locations, Epstein Connections).
- Rebuilt Searchable Index in Figma with real confirmed data (8 rows, copper checkbox, full width).
- Repositioned all Figma sections to match new localhost layout order.

---

## 2026-02-13 (Session 26)

### Added — 6-Dimension Aesthetic Taxonomy
- **`src/aesthetic_taxonomy.py`** — NEW: Shared taxonomy module with 36 values across 6 dimensions (Envelope, Atmosphere, Materiality, Power/Status, Cultural Orientation, Art Collection). Includes `build_vision_prompt()` for Claude Vision extraction, `build_text_prompt()` for Haiku text-only batch tagging, `parse_aesthetic_response()` with fuzzy matching to controlled vocabulary, `validate_profile()`, and `extract_structural_and_social()` helper.
- **`src/batch_tag_aesthetics.py`** — NEW: Standalone batch script that tags all features using text-only Haiku (~$0.001/feature). Processes ~1,628 features for ~$2.90 total. Flags: `--dry-run`, `--limit N`, `--skip-done`, `--confirmed-only`.

### Changed — Courier Deep Extract Handler
- **`src/agents/courier.py`** — Added `deep_extract` task type: fetches ALL article page images (no 3-page limit), sends through 6-dimension taxonomy Vision prompt, returns aesthetic_profile + enriched structural fields + social network data. Batches images in groups of 6 for token limits.

### Changed — Editor Triggers Deep Extract on CONFIRMED
- **`src/agents/editor.py`** — Added `_queue_deep_extract(name)` that auto-enqueues `deep_extract` tasks for Courier when a dossier is confirmed. Added `_commit_deep_extract()` to write aesthetic_profile JSONB + fill NULL structural fields.

### Changed — Graph Sync with Aesthetic Dimensions
- **`src/sync_graph.py`** — Parses `aesthetic_profile` JSONB from features, creates dimensional Style nodes with `dimension` property (envelope, atmosphere, materiality, power_status, cultural_orientation) and dimension-tagged HAS_STYLE relationships. ArtCategory nodes (multi-value) with DISPLAYS relationships. Type validation filters bad LLM output.
- **`src/graph_db.py`** — Added `ArtCategory` uniqueness constraint.

### Changed — Schema & Loader Updates
- **`docs/schema.sql`** — Added `aesthetic_profile JSONB DEFAULT NULL` column to features table with full JSONB structure documentation.
- **`src/load_features.py`** — Added `aesthetic_profile` to FEATURE_FIELDS, JSONB serialization for dict values.

### Changed — Deep Extract Uses Taxonomy
- **`src/deep_extract_confirmed.py`** — Refactored to use `aesthetic_taxonomy.build_vision_prompt()` instead of hardcoded prompt. All 23 confirmed names re-extracted with 6-dimension profiles.

### Database
- Added `aesthetic_profile` JSONB column to Supabase `features` table
- 1,622 features tagged with aesthetic taxonomy (1,583 batch + 39 resume run)
- 23 confirmed names deep-extracted with Vision (rich profiles + social data)
- Neo4j graph rebuilt: 570 Style nodes, 10 ArtCategory nodes, 8,737 HAS_STYLE relationships, 2,548 DISPLAYS relationships

### Research Findings — "The Epstein Aesthetic"
Statistical comparison of 27 confirmed Epstein connections vs 1,567 general AD features:
- **Classical/Neoclassical**: 39% Epstein vs 11% general (+28pt, 3.4x over)
- **Formal/Antiquarian**: 48% vs 20% (+28pt, 2.4x over)
- **Minimalist/Reductive**: 0% vs 21% (ZERO in Epstein orbit)
- **Glass & Steel**: 4% vs 26% (-22pt, 7x under)
- **Wood & Warmth**: 59% vs 40% (+20pt)
- **Institutional/Monumental**: 25% vs 9% (+16pt, 2.7x over)
- **Euro-Centric/Old World**: 57% vs 38% (+19pt)
- **Placeless/Globalist**: 7% vs 30% (-22pt, 4.2x under)

---

## 2026-02-12 (Session 25)

### Changed — Hero Section Redesign
- **`web/src/components/landing/HeroSection.tsx`** — Complete hero overhaul: Futura PT Black headline ("Where They Live"), Playfair Display italic epigraph (Thoreau quote), 3-column serif introduction body text, 6-column stats grid with copper-highlighted "Confirmed Connections" anchor stat.
- **`web/src/components/layout/Header.tsx`** — Updated header layout with grid-aligned navigation spanning rightmost 2 grid slices (400px = 2×188 + 24 gutter).
- **`web/src/app/layout.tsx`** — Added Adobe Typekit stylesheet for Futura PT font family.
- **`web/src/lib/queries.ts`** — Added cross-references count to stats query for hero display.
- **`web/src/lib/types.ts`** — Added `crossReferences` field to `StatsResponse` interface.

### Added — Figma Design System Sync
- Synced hero section to Figma via Console MCP (Desktop Bridge plugin): epigraph, headline, 3-col intro, 6-stat grid aligned to 6-slice design grid (188px slices, 24px gutters).
- Header synced with nav aligned to grid slices 5-6.
- Logo exploration: "They Live" Wayfarer sunglasses concept — left lens dark (facade), right lens reveals house (truth). Vector path Wayfarer frame with thick brow bar, keyhole bridge, organic trapezoidal silhouette.

### Changed — Header & Subtitle Polish
- **`web/src/components/layout/Header.tsx`** — Removed "AD Epstein Index" logo text, centered four nav links (`justify-center`, `gap-8`).
- **`web/src/components/landing/HeroSection.tsx`** — Removed `max-w-[600px]` from subtitle so "A Visual Map..." runs on one continuous line.
- Figma synced: header rebuilt with centered nav + bottom stroke border, hero subtitle set to HUG width.

### Fixed — Graph Component Lint Errors
- **`web/src/components/graph/GraphPreview.tsx`** — Fixed `any` type annotation to satisfy ESLint (moved from `as any` cast to typed variable declaration).
- **`web/src/components/graph/ConnectionExplorer.tsx`** — Same lint fix for react-force-graph-2d dynamic import.

---

## 2026-02-12 (Session 24)

### Added — Cost Control Toggles
- **`src/agents/base.py`** — New `IDLE_LLM_ENABLED` toggle (default True). When False, disables `reflect()`, `curious_explore()`, `propose_improvement()`, and `idle_chatter()` for ALL agents. `narrate()` short-circuits to raw facts (no Haiku call) when disabled.
- **`src/agents/editor.py`** — New `NARRATE_EVENTS` toggle (default True). When False, Miranda skips per-event Haiku narration calls, saving ~$0.001 per pipeline event. Strategic assessment interval increased from 180s to 600s (3min → 10min).

### Changed — Detective Batch Size
- **`src/agents/editor.py`** — Increased detective batch size from 30 to 50 names per batch in `_fill_detective_queue()`. Reduces overhead from batch initialization.

### Fixed — Courier NoneType Error
- **`src/agents/courier.py`** — Lines 535 and 769: `issue.get("ad_archive_progress", {})` returns None when key exists but value is None. Fixed with `issue.get("ad_archive_progress") or {}` pattern.

### Fixed — Activity Log Parser Traceback Pollution
- **`src/agent_status.py`** — `read_activity_log_from_lines()` was slicing last 20 lines before filtering, causing multiline Python tracebacks to fill the entire window with garbage. Now pre-filters to pipe-delimited lines (`l.count("|") >= 3`) before slicing.

### Fixed — Future-Date Scraping
- **`src/agents/editor.py`** — Casey was attempting to scrape September 2026 issues that don't exist yet. Added current year/month cap in three places: `_fill_scrape_queue()`, `_commit_discovered_issues()` cascade, and `_fill_scout_queue()` gap analysis. Issues beyond the current month are now excluded from scrape and discovery queues.

### Changed — Website Design Polish (Sable Session)
- **`web/src/`** — Comprehensive design pass across landing page components: refined typography hierarchy, section spacing, chart styling, color consistency, header/footer updates, and responsive layout improvements. Updated `design-tokens.ts`, `globals.css`, and most landing page components.

---

## 2026-02-12 (Session 23)

### Added — Agent Done Sprite State
- **`src/agents/base.py`** — New `done` sprite state for agents that complete all available work and enter extended idle. After 5 consecutive idle cycles with no work, agents switch from `waiting` to `done` sprite. Resets on next work cycle. Dashboard shows front-facing "done" pose distinct from normal waiting.

### Changed — Non-Home Feature Cleanup
- **`src/reextract_anonymous.py`** — Added `--delete-non-homes` mode that removes features flagged as non-home content (columns, editorials, museums, designer profiles, hotels) from Supabase. 457 non-home features deleted, reducing total from ~1457 to ~1000 real features.

### Fixed — Skills Modal Without Dashboard Server
- **`tools/agent-office/agent-office.html`** — Skills modal (Edit Skills button) now works without the dashboard HTTP server running. Falls back gracefully when `localhost:8766` is unavailable instead of showing a blank modal.

### Fixed — Speech Bubble Persistence
- **`tools/agent-office/agent-office.html`** — Speech bubbles were auto-hiding after 8 seconds due to a `setTimeout` that cleared them. Removed the auto-hide timer — bubbles now persist until the next status poll updates them. All active agents (Arthur, Elias, Silas, Elena, Miranda) show persistent speech.

### Fixed — Sync Graph Pagination
- **`src/sync_graph.py`** — Incremental sync was hitting Supabase's 1000-row limit on feature queries. Added pagination loop matching the fix in `agent_status.py`.

### Fixed — Agent Work Cycle Errors
- **`src/agents/base.py`** — Added `traceback.format_exc()` to error logging in the agent work cycle outer exception handler. Previously only logged the exception message, losing the stack trace.
- **`src/agents/courier.py`** — Added `or []` defensive guards on `list_issues()` calls (lines 253, 278) to prevent NoneType errors when Supabase returns None.
- **`src/agents/scout.py`** — Fixed `KeyError: slice(-5, None, None)` in `_get_knowledge_summary()`. `scout_knowledge.json` had `"successful_sources": {}` (dict) instead of `[]` (list). Added `_as_list()` helper and type check in `_save_knowledge()`.

---

## 2026-02-12 (Session 22)

### Added — Sonnet Re-extraction of Anonymous Features
- **`src/reextract_anonymous.py`** — New standalone script that re-processes Anonymous features using Claude Sonnet vision instead of Haiku. Queries Supabase for features where `homeowner_name = 'Anonymous'` from AD Archive deep scrape, re-fetches page images from Azure Blob Storage, and runs Sonnet extraction with enhanced prompt (detects non-home content, designer-as-homeowner patterns).
- Features: resume support (saves progress to `data/reextract_anonymous_results.json`), dry-run mode, `--apply` for Supabase updates, `--skip-non-homes` to re-classify editorial content, `--stats` for breakdown, numeric field sanitization (handles "4,600-square-foot" → 4600).
- **Results**: 956 Anonymous features processed across two passes. 237 homeowner names recovered, 497 non-home content classified (columns, editorials, museums, designer profiles, hotels), ~250 genuinely anonymous. Anonymous rate reduced from 44% to 32%. Total cost: ~$8.77 (Sonnet).

### Changed — Episodic Memory Cap
- **`src/agents/memory.py`** — `MAX_EPISODES` increased from 2,000 to 10,000. Agents were losing oldest memories at the 2K cap. 10K capacity supports ~5MB JSON file.

### Fixed — KeyError 'successes' in Editor
- **`src/agents/editor.py`** — Line 2786: `_management_note()` used `.get(agent_name, {})` which created partial tracker entries (missing `successes/failures/streak` keys) when called during task assignment before `_process_results()` initialized the full schema. Fixed by using `setdefault()` with complete schema dict. Eliminated 273+ cascading errors per session.

### Fixed — Supabase 1000-Row Pagination
- **`src/agent_status.py`** — `read_pipeline_stats()` and `_read_extractions_from_db()` both hit Supabase's default 1000-row limit. Dashboard showed "1000 features from 283 issues" instead of true counts. Fixed by adding pagination loops with `.range(offset, offset+999)`.

---

## 2026-02-12 (Session 21)

### Added — Researcher Jumping Sprite
- **`src/agents/researcher.py`** — New `_jumping_until` timed sprite state (30s). Triggers when Elena completes a dossier with HIGH or MEDIUM connection strength. `get_dashboard_status()` override exposes `researcher_state: "jumping"` to dashboard.
- **Dashboard** — `researcher_front_jumping_trans.png` sprite added to ASSETS. Dashboard checks `researcher_state === 'jumping'` and switches to jumping sprite, overriding normal working/idle state.

### Changed — Speech Bubble Opacity
- Watercooler sprite speech bubbles now use full solid agent color (no transparency). Previously 35% opacity tint.
- Miranda management note cooldown restored to 60s (was 15s).

### Data — Full Reset (Run 4)
- All Supabase tables wiped: 356 issues, 979 features, 194 cross-references, 30 dossiers
- Neo4j knowledge graph wiped (all nodes and relationships)
- All local data cleared: costs, agent memory (1,127 episodes), editor memory, ledger, watercooler, bulletin board, detective verdicts, researcher logs, designer training
- Reference data preserved: Black Book PDF/text, epstein_db SQLite
- Run 3 results before wipe: 345 issues, 960 features, 194 xrefs, 62 YES verdicts, 28 dossiers (1 HIGH, 2 MEDIUM, 2 LOW, 23 COINCIDENCE), $10.74 total cost over ~3.5 hours

---

## 2026-02-11 (Session 20)

### Changed — Emotionally Reactive Agent Speech
- **`src/agents/base.py`** — New `_get_emotional_context()` method builds real emotional state (cycles, errors, wait time, recent memories). Both `narrate()` and `idle_chatter()` now include emotional context in Haiku prompts, producing speech that reacts to what's actually happening.
- **`src/agents/editor.py`** — Miranda now cycles through 6 sprite states: `happy` (agent success, 15s), `frustrated` (agent failure, 15s), `barking` (assigning tasks, 10s), `listening` (human messages), `assessing` (strategic), `monitoring` (watching). Management note cooldown reduced 120s → 60s.
- **Dashboard** — New sprite mappings: `frustrated` → failure sprite, `barking` → tap sprite, `monitoring` → watch sprite. Miranda's speech bubble always yellow-tinted at 35% opacity.
- **Watercooler** — Interval reduced 5min → 2min. Conversations grounded in real-time agent status from `status.json` + bulletin board. Prompts emphasize emotional reactions to actual pipeline events.
- **Speech bubble opacity** — Agent-colored bubbles increased 18% → 35%. Watercooler panel line tints increased 12% → 25%.

### Added — Watercooler Conversations (Agent-to-Agent Dialogue)
- **`src/agents/watercooler.py`** — New system generates in-character 3-4 line conversations between agent pairs via single Haiku call (~$0.001 each). 10 curated pairings with built-in relationship dynamics (e.g., Silas & Elena adversarial respect, Elias & Miranda student/mentor). Loads personality snippets from skills files. Stored at `data/watercooler.json` with 20-conversation history.
- **`src/orchestrator.py`** — Added `watercooler_loop()` running every 5 minutes. Conversations animate sequentially on agent sprites (6s per line).

### Added — Newsroom Chatter Panel
- **`src/agent_status.py`** — `read_bulletin_notes()` and `read_watercooler()` functions feed dashboard
- **`src/agents/base.py`** — `narrate()` and `idle_chatter()` now post to bulletin board for dashboard visibility
- **Dashboard** — Collapsible "NEWSROOM CHATTER" panel shows active watercooler conversations at top + color-coded bulletin board notes below

### Added — Agent-Colored Speech Bubbles
- Speech bubbles during watercooler conversations tint to each speaker's agent color (Scout=green, Courier=blue, Detective=orange, etc.) at 18% opacity
- CSS variable `--bubble-bg` drives both bubble background and arrow triangle color
- Watercooler panel lines also get 12% opacity background tint matching speaker
- Bubbles auto-reset to white when conversation line expires

### Changed — Miranda Vocal Management (Barking Orders & Encouragement)
- **`src/agents/editor.py`** — `MGMT_NOTE_COOLDOWN` reduced 60s → 15s for much more frequent Miranda speech. `AGENT_PROFILES` expanded with `on_assign` and `on_idle` guidance for all 6 agents. Miranda now fires `_management_note()` on every task assignment (not just success/failure). Prompt changed: Miranda ALWAYS speaks — removed "respond with — if not worth noting" suppression.
- **`src/agents/watercooler.py`** — 3 more Miranda watercooler pairings added (editor+scout, editor+detective, editor+courier) — Miranda appears in 6 of 16 possible pairings.

### Changed — Graph Export Optimization
- **`src/sync_graph.py`** — `export_graph_json()` rewritten: only exports lead subgraph (persons with `connection_strength` + 1-hop neighbors) instead of full graph. Keeps agent office panel lightweight while Neo4j retains full graph. Extracted `_make_node()` helper, added link deduplication.
- **`src/graph_analytics.py`** — `update_person_verdict()` now uses `MERGE` instead of `MATCH` (creates Person node if it doesn't exist yet during incremental sync), accepts optional `connection_strength` parameter.

### Fixed — Agent Robustness
- **`src/agents/designer.py`** — Fixed crash when LLM returns dict instead of list for knowledge categories. Added `isinstance` guard before set conversion.
- **`src/agents/researcher.py`** — Safe string conversion for graph query results (`path_names`, `shared_connections`, `prox.path`). Safe `.get()` access for potentially missing dict keys. Fixed `update_json_locked` lambda → named function for verdict overrides.

### Fixed — Miranda Inbox (Reply Threading)
- **`read_combined_inbox()`** rewritten: fixed sender override bug (human messages in editor_messages.json lost their `sender: "human"` field), added deduplication, conversation messages (human + replies) always included regardless of cap
- **`src/agents/editor.py`** — `MAX_MESSAGES` increased from 50 to 100 to prevent human messages from being evicted
- **Dashboard** — Miranda replies now display with yellow (#f5c842) text and "MIRANDA" label instead of green "EDITOR"

---

## 2026-02-11 (Session 19)

### Fixed — Verdict Pipeline (4 Critical Bugs)
- **verdict_to_binary() precedence bug**: `glance_override` was checked BEFORE `combined_verdict`, allowing Haiku's contextual glance to override strong verdicts (`likely_match`, `confirmed_match`) → binary NO. Fixed by moving strong verdict check first — `confirmed_match` and `likely_match` are now immune to glance override, always return YES.
- **Contextual glance scope**: `contextual_glance()` was being called on ALL non-no_match verdicts including `likely_match`. Fixed to only run for ambiguous tiers (`possible_match`, `needs_review`). Strong verdicts skip the LLM call entirely.
- **Glance prompt bias**: Prompt was biased toward NO (DOJ snippets are just filenames, not descriptive evidence). Rewrote with flipped burden of proof: "Answer YES if there is any reasonable possibility... Answer NO only if it is clearly a different person." Added explicit anti-fame-bias instruction.
- **DOJ retry for pending entries**: Names checked when Chromium wasn't installed got `doj_status='pending'` permanently. Added `get_xrefs_needing_doj_retry()` to `db.py` and wired into Editor's `_fill_detective_queue()` to reset and re-enqueue pending entries.

### Fixed — Miranda Inbox (Human Messages Not Visible)
- Dashboard checked `m.sender === 'human'` to style human messages, but Miranda's `status.json` entries never included `sender` or `type` fields
- Added `_write_human_to_inbox()` method in `editor.py` — writes human messages with `type: 'human'` and `sender: 'human'` fields
- Dashboard now correctly shows human messages with blue "YOU" badge

### Changed — Miranda Cost Optimization (Opus Gate)
- `_has_quality_issues()` returned True almost every cycle during active pipeline (nulls, duplicates always exist), causing Opus ($15/$75/M) for ~95% of assessments
- Changed Opus gate: `needs_opus = has_human_messages` only — quality cleanup no longer triggers Opus
- Expected cost reduction: Miranda drops from ~82% to ~30% of total pipeline spend

### Data — Intentional Reset (Run 3)
- All Supabase tables wiped (57 cross-references, 8 dossiers, 419 features, 121 issues)
- All local data directories wiped (costs, extractions, dossiers, cross-references, issues)
- Agent episodic memory preserved (1,127+ episodes in `data/agent_memory/episodes.json`)
- Pipeline verified end-to-end before wipe: 351 issues, 419 features, 57 xrefs, 13 YES verdicts, 8 dossiers produced in ~54 minutes

### Pipeline Verification (Run 2 Results Before Wipe)
- **351 issues** discovered (121 committed to Supabase)
- **419 features** extracted across AD Archive + archive.org sources
- **57 cross-references** completed (Detective two-pass: BB + DOJ)
- **13 YES verdicts** (up from 0 in Run 1 — verdict bug fixes working)
- **8 dossiers** produced (all COINCIDENCE — correct triage by Elena)
- **$16.57 total cost** in 54 minutes — Miranda at $13.53 (82%, prompting Opus gate fix)

---

## 2026-02-11 (Session 18)

### Added — Neo4j Knowledge Graph (Phase 3.5)
- **`src/graph_db.py`** — Python Neo4j singleton client matching `db.py` pattern. SSL cert fix for Python 3.14 via certifi.
- **`src/sync_graph.py`** — CLI to sync Supabase → Neo4j (`--full`, `--incremental`, `--stats`, `--export`). Batch UNWIND Cypher queries. Anonymous homeowners get unique node keys. Auto-exports `graph.json` after sync.
- **`src/graph_analytics.py`** — Hybrid Aura + NetworkX analytics engine: Louvain community detection, PageRank, betweenness centrality, degree centrality, clustering coefficient, Jaccard similarity, Epstein proximity (shortest path to flagged person). 1-hour cache. Writes analytics back to Neo4j node properties.
- **Graph schema**: Person, Designer, Location, Style, Issue, Author, EpsteinSource nodes with FEATURED_IN, HIRED, LIVES_IN, HAS_STYLE, PROFILED_BY, APPEARS_IN relationships

### Added — Connection Explorer (Web Frontend)
- **`web/src/lib/neo4j.ts`** — TypeScript Neo4j singleton driver (server-side only)
- **`web/src/lib/graph-types.ts`** — GraphNode, GraphLink, GraphData interfaces with dark celestial color palette
- **`web/src/lib/graph-queries.ts`** — 7 Cypher query functions: ego network, shortest path, shared designers, hubs, Epstein subgraph, full graph, person search
- **`web/src/app/api/graph/route.ts`** — API route (`runtime = "nodejs"`) with preset-based dispatch
- **`web/src/app/explorer/page.tsx`** — Connection Explorer page
- **`web/src/components/graph/ConnectionExplorer.tsx`** — Three-panel layout: controls sidebar, force-directed canvas graph (react-force-graph-2d), node details sidebar. Custom ring-style nodes with glow, curved links, Epstein red ring, PageRank-based sizing.
- **`web/src/components/graph/GraphControls.tsx`** — Preset buttons, person search with autocomplete, ego network depth slider, shortest path finder
- **`web/src/components/graph/NodeDetails.tsx`** — Properties panel showing verdict badges, analytics (community, PageRank, betweenness), explore action
- Added `neo4j-driver` and `react-force-graph-2d` to web dependencies
- Added "Explorer" nav link to Header

### Added — Agent Office Knowledge Graph Panel
- Embedded force-graph (vanilla JS via CDN) in agent-office.html as collapsible panel under CURRENT LEADS
- Polls `tools/agent-office/graph.json` every 6 seconds for real-time updates
- Custom canvas node rendering matching dark pixel-art aesthetic (ring nodes, glow, Epstein highlights)
- Stats bar: node count, edge count, community count

### Changed — Courier Deep Scraping
- Enhanced AD Archive scraping flow: JWT TOC → Azure Blob Storage page images → Claude Vision extraction → rich features
- Added `_fetch_article_pages()`: downloads page thumbnails from public Azure CDN (max 3 pages per article)
- Added `_extract_features_with_images()` and `_extract_single_article_from_images()`: Claude Vision for richer extraction
- Fallback to teaser-only extraction if page images unavailable

### Added — Elena Dynamic Cypher Query Generation
- **`safe_read_query()`** in `src/graph_queries.py` — Write-guarded Cypher executor for LLM-generated queries. Rejects any query containing CREATE/MERGE/DELETE/SET/REMOVE/DROP/DETACH/CALL. Auto-appends `LIMIT 50` if missing.
- **`_graph_followup_queries()`** in `src/agents/researcher.py` — Elena generates 0-3 ad-hoc Cypher queries via Haiku (~$0.001) after reviewing preset graph results. Executes through `safe_read_query()`, caps at 20 results per query.
- **Pipeline integration**: Followup queries run between graph investigation (preset queries) and synthesis. Results injected into synthesis prompt alongside cached analytics and preset results.
- **Audit trail**: Every generated query (question, Cypher, result count) stored in dossier JSON under `graph_followup_queries` field.
- **Cost**: ~$0.001 per non-COINCIDENCE investigation (one Haiku call). ~2% pipeline cost increase.

### Added — Sable Rest Sprite State
- New `rest` sprite state for Sable (Designer agent) using `designer_front_rest_trans.png`
- Rest pose is the default idle state when Sable has no work (replaces front-facing idle)
- Bored sprite still kicks in after the randomized threshold, alternating with rest
- Generic implementation: any agent with a `rest` asset defined gets the same behavior
- Added `hub-rest` CSS class and sprite element creation to agent-office.html

### Changed — Researcher Graph Integration
- Elena now calls `get_person_analytics(name)` from `graph_analytics.py` before synthesis step
- Synthesis prompt includes: PageRank percentile, betweenness, community membership, flagged community members, similar persons, Epstein proximity
- Dossier output schema extended with graph fields: `graph_community_id`, `graph_pagerank_percentile`, `graph_betweenness_percentile`, `graph_similar_persons`, `graph_epstein_proximity`

### Changed — Miranda Speech System Overhaul
- **Management notes routed to sprite speech** — `_management_note()` now sets `self._speech` on Miranda and `agent._speech` on the addressed worker instead of writing to Editor Inbox. Both sprites show speech bubbles simultaneously.
- **Strategic assessment drives sprite speech** — After each ~3-minute assessment, Miranda's sprite shows the LLM-generated `inbox_message` or `summary` (capped at 200 chars). No extra API calls.
- **Editor speech TTL extended to 200s** — Matches the 180s strategic assessment interval so speech doesn't expire between cycles.
- **Removed `mirandaSays()` from agent-office.html** — Eliminated ~120 lines of canned random phrases. All 22 call sites now use `mirandaCurrentSpeech`, a variable populated from `agentData.speech` in the data polling loop.
- **Editor Inbox now exclusively Miranda ↔ Human** — No more `[to Name]` management notes cluttering the inbox.

### Fixed — Dashboard Popup Positioning
- Stat detail popups and agent control popups now appear above the cursor when near bottom of viewport (previously clipped off-screen)

---

## 2026-02-10 (Session 17)

### Changed — Editor: Sonnet/Opus Model Split
- **Cost optimization**: Editor now uses Sonnet (`claude-sonnet-4-5-20250929`) for routine status assessments and Opus (`claude-opus-4-6`) only for human interaction and quality reviews
- Added `OPUS_MODEL` constant and `_has_quality_issues(report)` method — checks for supabase nulls, duplicates, near-duplicates, reextraction needs, and xref leads
- `_strategic_assessment()` determines `needs_opus` based on human messages present OR quality issues detected
- `_call_haiku()` accepts `use_opus=False` parameter, logs model selection
- Estimated 80%+ of assessment cycles use Sonnet (~$3/$15 per 1M tokens vs ~$15/$75 for Opus)

### Fixed — AD Archive Cascade in Editor
- `_commit_discovered_issues()` was sending `download_pdf` tasks for AD Archive issues — identifiers like `ad-archive-YYYYMM01` don't exist on archive.org, so these would fail silently
- Added source filter: `"ad_archive" not in i.get("source", "")` to archive.org download cascade
- Added immediate `scrape_features` cascade for AD Archive issues — no longer waits for 30s planning cycle
- Fixed narration: dynamic source counting replaces hardcoded "on archive.org"

### Fixed — Scout Legacy `work()` Three-Tier Bypass
- Scout's `work()` fallback (runs when no Editor task assigned) was using legacy single-tier Claude CLI path, bypassing the three-tier `_execute_discover()` strategy (AD Archive HTTP → archive.org API → CLI)
- Race condition: Scout runs before Editor can assign tasks, falls through to `work()`, skips AD Archive tier
- Fixed: `work()` now self-assigns a `discover_issues` Task and routes through `_execute_discover()` for fill_gaps strategy

### Fixed — Bug Fixes (from prior session, first documented here)
- `db.py`: Added `@retry_supabase` decorator with exponential backoff (3 retries, 2s base) for transient Supabase failures
- Cross-reference atomicity: `_commit_cross_reference()` records ledger success AFTER Supabase write, not before
- Cost tracking: API cost accumulator in agent status
- Scout priority inversion: fix_dates no longer blocks discovery
- Stale task cleanup: Editor clears orphaned in-progress tasks on startup
- Orphan xref cleanup: Removes cross-references for deleted features

### Data — Intentional Reset
- All Supabase tables and local data directories wiped per user request to rebuild pipeline from clean slate
- Agent episodic memory (1,127 episodes) preserved in `data/agent_memory/episodes.json`

### Verified — Integration Test
- Full pipeline flow verified end-to-end in 40 seconds:
  - Scout discovered 6 issues on AD Archive (2025-01 through 2025-06)
  - Editor committed all 6 to Supabase
  - Editor cascaded `scrape_features` to Courier for 2025-01
  - Courier scraped JWT, extracted 5 features (Kelly Ripa, Lorenzo Hadar, Markham Roberts, 2 Anonymous)
  - Editor loaded 5 features to Supabase, queued Detective for 4 names

---

## 2026-02-10 (Session 16)

### Database — Cross-References → Supabase
- Created `cross_references` table in Supabase — full detective work now persisted to DB (BB matches, DOJ results, confidence scores, verdicts, editor overrides)
- Added 9 new functions to `src/db.py`: `upsert_cross_reference`, `get_cross_reference`, `list_cross_references`, `get_xref_leads`, `update_xref_editor_override`, `get_features_without_xref`, `delete_cross_references`, `reset_xref_doj`, `migrate_disk_xrefs`
- Migrated 14 existing cross-reference records from local JSON to Supabase (5 skipped due to deleted features)
- `agent_status.py` reads from Supabase primary with disk fallback
- Editor, Detective, Researcher, and cross_reference.py all updated to read/write from Supabase

### Added — AD Archive Direct HTTP Scraper
- Discovered that AD Archive issue pages embed article catalogs in JWT tokens (`tocConfig` JavaScript variable)
- **Phase A (instant)**: HTTP GET → JWT decode → featured articles with titles, teasers, authors, page ranges
- **Phase B (~3s)**: Single Anthropic API call (Haiku) batch-extracts structured homeowner/designer/location data from all article teasers at once
- Total time per issue: ~4 seconds (was 7-15 minutes with Playwright approach)
- No authentication or browser automation needed — plain HTTP requests + JWT decoding
- Produces same extraction JSON format as Reader output — feeds directly into `_commit_extraction()` → Supabase
- Tested across all eras (1988-2024) — ~7 featured articles per issue typically

### Added — AD Archive Issue Discovery
- Bulk-discovered 297 missing issues via AD Archive URL pattern (`ad-archive-YYYYMM01`)
- Brought issue coverage from 41% (185/456) to 100% (456/456)
- 318 AD Archive issues ready for scraping

### Changed — Courier Agent
- Replaced Claude CLI + Playwright scraping with direct HTTP + JWT approach
- Added `_fetch_issue_toc()` — HTTP GET + JWT decode (instant, no LLM)
- Added `_extract_features_from_toc()` — batch extraction via Anthropic API (Haiku)
- Added `_call_anthropic_api()` — direct SDK call, falls back to Claude CLI if unavailable
- Added `_parse_result_json_array()` — JSON array parsing from LLM responses
- Made `_call_claude()` properly handle empty tools list (text-only mode)
- Unnamed homeowners default to "Anonymous" instead of being filtered out

### Changed — Editor Agent
- `_commit_cross_reference()` writes full xref data to Supabase `cross_references` table
- `_override_detective_verdict()` writes directly to Supabase
- `_retry_doj_search()` resets in Supabase
- `_remove_from_xref()` deletes from Supabase
- `_fill_researcher_queue()` enriches leads from Supabase xref data
- `_build_xref_summary()` reads from Supabase
- Added `_fill_scrape_queue()` — enqueues `scrape_features` tasks for AD Archive issues
- `_handle_success()` routes `scrape_features` results through `_commit_extraction()`

### Changed — Detective & Researcher Agents
- `detective.py` `get_progress()` reads from Supabase cross_references
- `researcher.py` enriches leads with xref data from Supabase
- `cross_reference.py` `get_unchecked_features()` uses Supabase

### Fixed — Detective BB Match Verdict Bug
- When DOJ browser was unavailable, Detective set `combined_verdict` to raw BB status string `"match"` — not a valid verdict tier. `verdict_to_binary()` didn't recognize it, fell through to `"NO"`, silently dropping Black Book hits
- Fixed all three DOJ fallback paths: BB match + DOJ unavailable → `needs_review` → binary `YES`
- Patched Leo Seigal/Maxwell Anderson record directly in Supabase

### Changed — Investigation Policy: BB = Confirmed, Fame ≠ Dismissal
- **Black Book matches are direct evidence**: `last_first`/`full_name` → `confirmed_match` (was `likely_match`). `last_name_only` → `likely_match` (was `possible_match`)
- **Fame is never a dismissal factor**: Added explicit anti-fame-bias instructions to Researcher triage prompt, synthesis prompt, and Editor dossier review prompt
- Updated all agent skills files (detective.md, researcher.md, editor.md) with new policy
- Fixed Henri Samuel xref — cleared stale editor_override that contradicted CONFIRMED dossier

### Changed — Editor Source Filtering
- Added `source != "ad_archive"` filter to `_fill_courier_queue()` — prevents AD Archive issues from getting `download_pdf` tasks (they go through `_fill_scrape_queue` instead)

### Changed — Skills Files
- `courier.md` — replaced Playwright docs with JWT scraping docs
- `scout.md` — noted AD Archive direct HTTP scraping availability
- `detective.md` — updated verdict table (BB matches → confirmed_match), added BB policy note
- `researcher.md` — added anti-fame-bias rules, updated connection strength guide for BB matches
- `editor.md` — added dossier review policy (BB = confirm, fame irrelevant)

---

## 2026-02-09 (Session 15)

### Added — Memory Feedback Loop: Agents Read Before They Act

The agent intelligence infrastructure (episodic memory, bulletin board, reflection) was write-only — agents committed episodes but never read them before the next task. This session closes the feedback loop across 3 layers:

- **Layer 1: Pre-Execution Briefing** (`base.py` → `_get_task_briefing()`)
  - Before every task, queries own episodic memory for similar past episodes (~5ms, numpy dot product)
  - Reads bulletin board for warnings and learned rules from other agents
  - Returns formatted context string attached to `task.briefing` for agents to inject into LLM prompts
  - Wired into `run()` loop — every task gets a briefing before `execute()` is called

- **Layer 2: Post-Execution Learning** (`base.py` → `_post_task_learning()`)
  - After successful tasks, agents post structured lessons tagged `"learned"` to the bulletin board
  - Detective: cross-reference batch stats (YES/NO counts, DOJ availability)
  - Reader: extraction recovery strategies and null rates
  - Researcher: investigation outcomes and pattern correlations
  - Scout: discovery results with year ranges and successful strategies
  - Courier: successful download patterns by source

- **Layer 3: Reflection → Behavioral Rules** (enhanced `reflect()`)
  - Reflection prompt now requests `RULE:` prefixed actionable rules alongside insights
  - Extracted rules posted to bulletin board as `"learned"` entries
  - Rules picked up by Layer 1's `_get_task_briefing()` on the next task cycle
  - Same Haiku call (folded into existing prompt), no extra cost

### Changed — Task Dataclass
- Added `briefing: str = ""` field to `Task` in `src/agents/tasks.py` — clean, explicit, serialization-safe

### Changed — Detective Agent
- Removed dead `recall_episodes()` block in `execute()` (recalled but never used)
- `_analyze_names()` now accepts optional `briefing` parameter, injects past experience into LLM prompt
- Posts cross-reference batch stats to bulletin board after completing each batch

### Changed — Reader Agent
- Uses `task.briefing` for strategy pre-selection (e.g., detects "text_extraction + scanned" hints from past experience)
- Posts extraction stats (recovery strategy, feature count, null rate) after successful extractions

### Changed — Researcher Agent
- Removed dead `recall_episodes()` block in `execute()` (recalled but never used)
- `_investigate_match()` accepts `briefing` parameter, injects into investigation context
- `_step_triage()` includes briefing in triage prompt for evidence-informed decisions
- Posts investigation outcomes (strength, triage result, pattern correlations) after each dossier

### Changed — Scout Agent
- `_build_prompt()` accepts optional `briefing` parameter, appends past experience context to CLI prompt
- `_execute_discover()` logs briefing and passes it through to CLI prompt generation
- Posts discovery results (issue count, year ranges, strategies tried) after successful batches

### Changed — Courier Agent
- Logs briefing if present before download attempts
- Posts successful download patterns (identifier, source, year/month) to bulletin board

---

## 2026-02-09 (Session 14)

### Added — Episodic Memory (Gap 1 of Intelligence Roadmap)
- **`src/agents/memory.py`** — Lightweight vector store using ONNX embeddings (all-MiniLM-L6-v2, 384-dim)
  - `AgentMemory.commit()` stores episodes with pre-computed embeddings + filterable metadata
  - `AgentMemory.recall()` retrieves similar past episodes via cosine similarity + metadata filters
  - JSON-backed persistence (`data/agent_memory/episodes.json`), capped at 2,000 episodes
  - No external services needed — runs entirely locally with onnxruntime + numpy + tokenizers
- **Base Agent integration** (`src/agents/base.py`):
  - `recall_episodes()` — convenience wrapper for semantic memory recall
  - `commit_episode()` — convenience wrapper for storing episodes
  - `problem_solve()` now recalls similar past errors before making decisions (PAST EXPERIENCE section in LLM prompt)
  - `problem_solve()` commits every decision to memory (error, diagnosis, strategy, reasoning)
  - `run()` loop commits success/failure episodes after every task execution
- **Editor integration** — `_remember()` now also commits to episodic memory for semantic recall
- **Dashboard** — "Memories" stat added to top bar showing total episode count
- **ChromaDB installed but unused** — Python 3.14 incompatibility (pydantic v1). Built custom vector store instead.

### Added — Reflection Loops (Gap 2 of Intelligence Roadmap)
- **`reflect()`** method in base Agent class — periodic self-assessment every 10 minutes
  - Reviews last 10 episodes from this agent's memory via Haiku (~$0.001/call)
  - Identifies patterns (recurring problems, strategies that work) and areas for improvement
  - Commits insights back to memory as 'reflection' episodes — building compound knowledge
  - Shows reflection as speech bubble on dashboard
- Wired into idle path of `run()` loop — agents reflect before chattering when idle

### Added — Self-Improvement Proposals (Gap 3 of Intelligence Roadmap)
- **`propose_improvement()`** in base Agent class — periodic methodology proposals every 30 minutes
  - Reviews reflection episodes and failure patterns, proposes specific changes via Haiku
  - Structured format: WHAT / WHY / HOW — practical, not theoretical
  - Proposals committed to memory as 'proposal' episodes
  - Editor reads proposals during strategic assessment (`_get_improvement_proposals()`)
  - NOT self-modifying: proposals are structured feedback for human/Editor review

### Added — Planning/Lookahead (Gap 4 of Intelligence Roadmap)
- **`_memory_informed_priority()`** in Editor — adjusts task priority based on past experience
  - Queries memory for similar past tasks on the target agent
  - 3+ failures with 0 successes → deprioritize (avoid repeating doomed tasks)
  - 3+ successes with 0 failures → boost priority (lean into what works)
  - Called automatically by `_assign_task()` before pushing to agent inbox

### Added — Curiosity (Gap 5 of Intelligence Roadmap)
- **`curious_explore()`** in base Agent class — cross-agent pattern exploration every 15 minutes
  - Unlike reflection (reviews YOUR episodes), curiosity queries ALL agents' episodes
  - Asks Haiku to find interesting patterns nobody explicitly asked about
  - Commits insights as 'curiosity' episodes — cross-pollinating knowledge between agents
  - Shows insight as speech bubble on dashboard

### Added — World Model (Gap 6 of Intelligence Roadmap)
- **`get_world_state()`** in base Agent class — structured pipeline state snapshot
  - Returns pipeline metrics (discovered/downloaded/extracted/target/coverage%)
  - Includes intelligence stats (memory episodes, bulletin notes)
  - Identifies current bottleneck (discovery/download/extraction/cross-reference)
  - 30-second cache to avoid hammering Supabase

### Added — Inter-Agent Communication (Gap 7 of Intelligence Roadmap)
- **`src/agents/bulletin.py`** — Shared bulletin board for peer-to-peer communication
  - `post(agent, text, tag)` — post notes visible to all agents
  - `read(n, from_agent, tag, exclude_agent)` — read notes from other agents
  - Tags: "tip", "warning", "discovery", "question"
  - JSON-backed persistence (`data/bulletin_board.json`), capped at 200 notes
- **Base Agent integration**:
  - `post_bulletin()` / `read_bulletin()` convenience methods
  - `problem_solve()` now checks bulletin for relevant warnings/tips from peers
  - Agents auto-post warnings when escalating (other agents should know)

### Changed — Idle Intelligence Pipeline
- Agents now have a 4-stage idle intelligence pipeline (all with independent cooldowns):
  1. `reflect()` — self-assessment (every 10 min)
  2. `curious_explore()` — cross-agent patterns (every 15 min)
  3. `propose_improvement()` — methodology proposals (every 30 min)
  4. `idle_chatter()` — personality banter (every 2 min)

---

## 2026-02-09 (Session 13)

### Added — LLM-Powered Problem Solving for All Agents
- **`problem_solve(error, context, strategies)`** added to base Agent class — uses Haiku (~$0.001/call) to diagnose errors and choose recovery strategies instead of hardcoded retry logic
- All `problem_solve()` calls wrapped in `await asyncio.to_thread()` for non-blocking execution
- **Scout** (`src/agents/scout.py`): 2 locations — CLI failure diagnosis + strategy failure diagnosis (only escalates when LLM recommends it)
- **Courier** (`src/agents/courier.py`): 2 locations — no-PDF diagnosis + download failure diagnosis (escalation includes LLM diagnosis)
- **Detective** (`src/agents/detective.py`): DOJ search failure with browser restart recovery — actually stops and relaunches Playwright on "restart_browser" strategy
- **Designer** (`src/agents/designer.py`): 2 locations — training cycle CLI failure + creation cycle spec generation failure
- **Reader** (`src/agents/reader.py`): Already had problem_solve; wired `READER_LOW_RES` and `READER_SMALL_BATCHES` env vars into `extract_features.py` so recovery strategies take effect
- **Editor** (`src/agents/editor.py`): 6 locations — main event loop, extraction commit, cross-reference commit, investigation commit (3 sub-steps), assessment cycle with 3 fallback strategies

### Added — Agent Personalities: Names and Idle Chatter
- Each agent picked their own name via Gemini Vision analysis of their pixel sprite + personality:
  - **Arthur** (Scout), **Casey** (Courier), **Elias** (Reader), **Silas** (Detective), **Elena** (Researcher)
- Names saved in `src/agents/skills/*.md` files under `## Name` section
- **`idle_chatter()`** in base Agent class — generates personality-driven idle thoughts via Haiku when agents have no work (120s cooldown)
- **`_load_agent_name()`** extracts name from skills file, cached
- Removed hardcoded "Waiting for assignment..." from Agent Office dashboard — agents now show their own idle thoughts

### Added — Editor-Directed Detective & Researcher Flow
- **`verdict_to_binary()`** and **`contextual_glance()`** in `src/cross_reference.py` — maps 5-tier verdicts to YES/NO, uses Haiku for ambiguous cases only
- **`update_detective_verdict()`** and **`get_features_needing_detective()`** in `src/db.py` — new Supabase functions for detective verdicts
- Editor now routes data through pipeline: Reader → Editor → Detective → Editor (writes YES/NO) → Researcher
- `_commit_extraction()` immediately queues Detective for newly-loaded features
- `_commit_cross_reference()` rewritten: writes YES/NO to Supabase, queues YES names for Researcher
- `_queue_researcher_tasks()` new helper for assigning investigation tasks
- `_plan_detective_tasks()` and `_plan_researcher_tasks()` fallbacks catch unchecked features
- Detective `work()` disabled — returns immediately with "Waiting for Editor assignment"

### Fixed — Editor Bug Fixes
- **Ledger recording order**: `_commit_cross_reference()` was recording success BEFORE Supabase write could fail. Moved to AFTER with `write_ok` boolean tracking
- **Per-action error wrapping**: `_execute_actions()` now wraps each action in try/except so one failure doesn't stop subsequent actions. Tracks succeeded/failed counts
- **Assessment cycle fallbacks**: LLM failure now has 3 recovery strategies: reuse last assessment, minimal planning, or skip
- **Investigation review recovery**: auto-rejects LOW-strength leads when Sonnet review fails

### Changed — Reader Recovery Strategies
- `src/extract_features.py` now reads `READER_LOW_RES` env var (100 DPI instead of 150)
- `src/extract_features.py` now reads `READER_SMALL_BATCHES` env var (5-page TOC chunks instead of 10)
- Reader's `problem_solve()` sets these env vars, and they now actually take effect

### Database
- Added `detective_verdict` (YES/NO) and `detective_checked_at` columns to `features` table
- Added index `idx_features_detective_verdict`

---

## 2026-02-09 (Session 12)

### Added — Phase 3: Interactive Visualization Website
- **Full Next.js app** in `web/` — App Router, TypeScript strict, Tailwind v4, Shadcn UI, Recharts
- **Landing page** with 10 sections: Hero, Key Findings, Coverage Heatmap, Features Timeline, Style Distribution, Geographic Treemap, Verdict Breakdown, Searchable Index, Methodology
- **Dossier detail pages** (`/dossier/[id]`) with evidence sections, verdict badges, article image gallery
- **API routes**: `/api/stats`, `/api/features` (paginated, filterable by year/style/designer/location/search), `/api/dossiers`, `/api/dossiers/[id]`
- **Design tokens** (`web/src/lib/design-tokens.ts`): copper accent, editorial typography (Playfair Display + Inter + JetBrains Mono), verdict color system
- **Server-side Supabase** — service key never exposed to client, all data via server components + API routes
- **Coverage heatmap** — custom CSS Grid, year x month (1988-2025), color-coded by pipeline status
- **Searchable index** — debounced search, URL-based filter state for shareable links, paginated table
- **Recharts visualizations** — bar charts (features by year, styles), donut (verdicts), treemap (locations)

### Changed — Designer Agent Evolution
- `src/agents/designer.py` `_creation_cycle()` rewritten: generates JSON design specs instead of Figma designs
- New method `_build_spec_prompt()` builds targeted prompts for each spec type (tokens, landing-page, dossier-detail, search-index)
- New method `_next_needed_spec()` auto-detects which specs need generation/refresh (>24h staleness)
- New method `_load_design_rules()` reads docs/design-rules.md for context
- `work()` now accepts optional `task` param for Editor-assigned `generate_design_spec` tasks
- Pushes `TaskResult` to outbox so Editor knows when specs are generated
- Spec files written to `web/design-specs/*.json`

### Fixed — Recharts + React 19 Compatibility
- **`style` data field crash**: Recharts spreads data properties onto SVG elements — a field named `style` with a string value (e.g., "Contemporary") crashes React 19 (`style` prop must be an object). Renamed to `styleName` in `StyleDistribution.tsx`
- **SSR hydration errors**: All Recharts chart components (FeaturesTimeline, StyleDistribution, GeographicMap, VerdictBreakdown) now use centralized `useMounted()` hook (`web/src/lib/use-mounted.ts`) to defer rendering until after hydration
- **CoverageHeatmap Fragment key**: Replaced `<>` with `<Fragment key={row.year}>` for React key support in CSS Grid rows

### Infrastructure
- `web/.env.local` — Supabase URL + service key (gitignored)
- `web/next.config.ts` — Supabase Storage image hostname whitelisted
- All Shadcn components added: button, card, badge, input, table, select, separator, skeleton, tooltip

---

## 2026-02-09 (Session 11)

### Changed — Editor as Final Gatekeeper for Researcher Dossiers
- **Editor now reviews every Researcher dossier before it becomes final** — Researcher proposes a `connection_strength`, Editor confirms or rejects
- `_commit_investigation()` replaced with gatekeeper logic:
  - COINCIDENCE → auto-REJECTED (no LLM call, free)
  - HIGH → Sonnet review with "default CONFIRMED" stance
  - MEDIUM → Sonnet review with balanced judgment call
  - LOW → Sonnet review with "default REJECTED" stance
- New `_review_dossier()` method uses Claude Sonnet (~$0.005/review) for evidence evaluation
- On review failure → safe fallback to PENDING_REVIEW (never silently drops)

### Changed — Researcher Outbox Push
- `work()` loop now pushes `TaskResult` to `self.outbox` after saving each dossier — Editor receives every investigation for gatekeeper review (previously work() was self-managing and Editor never saw results)
- `execute()` now includes `feature_id` in result dict for Supabase lookup

### Changed — Dossier Supabase Row
- Researcher now writes `editor_verdict: "PENDING_REVIEW"` on every new dossier — no dossier goes straight to CONFIRMED

### Database
- Added 3 columns to `dossiers` table: `editor_verdict` (CONFIRMED/REJECTED/PENDING_REVIEW), `editor_reasoning`, `editor_reviewed_at`
- Added index `idx_dossiers_editor_verdict` for filtering by verdict
- Backfill migration: existing HIGH/MEDIUM → CONFIRMED, LOW/COINCIDENCE → REJECTED

### Added — `db.py` Functions
- `update_editor_verdict(feature_id, verdict, reasoning)` — clean separation: only Editor calls this
- `list_dossiers()` now accepts optional `editor_verdict` filter parameter

### Changed — Researcher Skills Doc
- Clarified that `connection_strength` is a proposal, not a final verdict — Editor has final say

---

## 2026-02-09 (Session 10)

### Changed — Editor: Event-Driven Architecture
- **Replaced 5-second polling loop with unified event queue** (`asyncio.Queue`) — Editor now blocks on `await queue.get()` instead of waking every 5s
- New `EditorEvent` dataclass (type, payload, timestamp) as event envelope
- 4 background producer tasks feed events into the queue:
  - `_outbox_forwarder()` — polls worker outboxes every 0.5s (was 5s)
  - `_human_message_watcher()` — checks `human_messages.json` mtime every 1s (was 300s)
  - `_planning_heartbeat()` — emits event every 30s (unchanged)
  - `_strategic_heartbeat()` — emits event every 300s (unchanged)
- `_handle_event()` dispatcher routes events to existing handlers
- `_drain_pending_events()` batches agent_result events that accumulate during long LLM calls
- `work()` stubbed out (required by base class `@abstractmethod` but never called)
- **Latency improvements**: agent results <0.5s (was 5s), human messages <2s (was 300s), CPU sleeps when idle (was polling)
- No changes to base.py — worker agents completely unaffected

### Changed — Dashboard: Live Task Overlays
- Orchestrator now overlays real agent tasks into `now_processing` (e.g., "Downloading: architecturaldig47losa" instead of generic "Downloading (87 remaining)")
- Paused agents show "Paused" in now_processing panel

### Changed — Dashboard: Activity Log Priority
- `build_log()` now prioritizes real timestamped entries from `agent_activity.log` over pipeline summary
- Fallback summary lines marked with `--:--` timestamp to distinguish from live events

### Changed — Dashboard: Chalkboard Readability
- Increased chalkboard padding, brightened chalk text and goal text opacity
- Chalk title text now solid white with stronger text-shadow
- Chalk item borders slightly more visible

### Added — Dashboard: Editor Aisle Pathfinding
- `walkEditorTo()` routes Editor sprite along aisles (never diagonally through desks)
- Board positions defined for left/right chalkboard visits
- Walk speed constant (`EDITOR_WALK_SPEED`) for consistent animation

### Changed — Agent Sprite Assets
- Updated Courier sprites (front, back, waiting) — higher resolution
- Updated Scout sprites (front, back, waiting) — refined art

### Added — Dashboard Assets
- `bg-office-chalkboard.png` — new background with chalkboard overlay
- `bg-office-clear-new-layers.psd` — layered source file
- `bg-office-clear-old.png` — previous background preserved

---

## 2026-02-09 (Session 9)

### Added — Dashboard: Editor's Board Chalkboard
- Left chalkboard renamed from "ACTIVE TASKS" to "EDITOR'S BOARD" — shows the Editor's failure tracking view instead of all agent tasks
- Displays "GAVE UP" section (exhausted items, >=3 failures, red strikethrough) and "RETRYING" section (stuck items, yellow)
- Each item shows identifier key, last error message, and failure count (Nx)
- Summary line shows total ok/fail counts from EditorLedger
- Falls back to in-flight tasks when ledger is empty

### Added — Dashboard: Discovery Coverage Map
- New 38-year x 12-month grid (1988-2025 = 456 cells) in right panel showing pipeline status per AD issue
- Color-coded cells: red (discovered), blue (downloaded), green (extracted), dim (missing/skipped)
- Year labels every 5th year plus 1988 and 2025, month headers (J-D)
- Legend with status color swatches
- `build_coverage_map()` in `src/agent_status.py` reads issue status from Supabase

### Added — EditorLedger Dashboard Visibility
- `read_editor_ledger()` in `src/agent_status.py` reads `data/editor_ledger.json` and computes:
  - Stuck items (failures < max, still retryable)
  - Exhausted items (failures >= 3, gave up)
  - Recent failures sorted by time
  - Total success/failure counts
- `editor_ledger` field added to `status.json` output

### Added — Agent Sprite Variants
- Waiting/front-facing sprites for all 6 worker agents (bored/idle state when no task assigned)
- Editor sprite variants: clipboard (reviewing), failure (concerned), studying (reading)
- Updated background image and detective front sprite

### Changed — Dashboard CSS
- New CSS classes: `.exhausted`, `.stuck`, `.chalk-section-label`, `.chalk-count` for chalkboard styling
- Coverage map CSS: `.coverage-grid`, `.coverage-cell`, `.coverage-legend` with status-colored variants

---

## 2026-02-09 (Session 8)

### Changed — Hub-and-Spoke Architecture: Editor as Central Coordinator
- **Major architectural redesign**: Editor is now the central coordinator using asyncio.Queue task system
- **New file `src/agents/tasks.py`**: `Task`, `TaskResult` dataclasses + `EditorLedger` for centralized failure tracking
- **Base class (`src/agents/base.py`)**: Added `inbox`/`outbox` asyncio.Queue per agent, `execute(task)` method, watchdog timer (warns if inbox empty >120s)
- **Editor rewrite (`src/agents/editor.py`)**: Coordinator loop with 3 timing tiers:
  - Every 5s: collect results from all outboxes, validate, commit to Supabase
  - Every 30s: plan and assign tasks (rule-based gap analysis, not LLM)
  - Every 5min: strategic LLM assessment + human message processing
- **Quality gating moved to Editor**: Reader no longer decides load/hold — Editor applies quality gate on extraction results
- **EditorLedger (`data/editor_ledger.json`)**: Centralized failure tracking replaces scattered per-agent escalation files

### Changed — Scout Agent
- Added `execute()` for `discover_issues` and `fix_dates` task types
- **Built-in archive.org API search** (direct HTTP `requests.get()`) — no LLM needed for basic discovery
- Three-tier search strategy: archive.org API → Claude CLI → report not_found
- Fix_dates priority set to LOW (3) — no longer blocks discovery (was the main pipeline bottleneck)
- Legacy `work()` still available as fallback when no task assigned

### Changed — Courier Agent
- Added `execute()` for `download_pdf` task type
- Builds issue dict from task params, delegates to existing download logic
- Returns structured result with `pdf_path` and `pages` on success

### Changed — Reader Agent
- Added `execute()` for `extract_features` and `reextract_features` task types
- Returns features + quality_metrics to Editor for quality gating
- Editor decides whether to load into Supabase (not Reader)

### Changed — Detective + Researcher Agents
- Both get `execute()` for targeted tasks from Editor (`cross_reference` / `investigate_lead`)
- Legacy `work()` still runs when no task assigned — these agents are largely self-managing

### Changed — Orchestrator + Status
- `src/orchestrator.py`: Added Editor task board to `status.json` output
- `src/agent_status.py`: Updated TOTAL_EXPECTED_ISSUES from 444 to 456 (1988-2025)

### Architecture
- **What vs How separation**: Editor decides WHAT needs doing (gap analysis, priority), agents decide HOW to do it (search strategies, retry logic)
- **Only Editor writes pipeline state to Supabase** — agents can still READ for context
- **Agent watchdog**: if inbox empty >120s, agent logs warning and continues with `work()` fallback
- **No breaking changes**: All agents still have `work()` loop, so the system degrades gracefully if Editor stops assigning tasks

---

## 2026-02-09 (Session 7)

### Changed — Pipeline Source of Truth: Manifest → Supabase
- **Migrated all agents from `archive_manifest.json` to Supabase `issues` table as single source of truth**
- Created `src/db.py` — shared DB module with singleton Supabase client and all issue/feature CRUD functions
- Added 14 pipeline tracking columns to `issues` table: `identifier`, `status`, `pdf_path`, `source`, `verified_month`, `verified_year`, `date_confidence`, `needs_review`, etc.
- Created `src/migrate_manifest_to_supabase.py` — one-time migration script (92 issues migrated, 72 pre-1988 removed)
- Updated all 7 agents (Scout, Courier, Reader, Editor, Detective, Researcher, Designer) to use `db.py` instead of manifest
- Updated `src/agent_status.py` — all stats now come from Supabase
- Updated `src/pipeline.py` — `status` command reads from Supabase
- Updated `src/extract_features.py` and `src/load_features.py` — use `db.py` imports
- Removed `read_manifest()` and `update_manifest_locked()` from `src/agents/base.py`
- Scout now covers all issues through December 2025 (456 expected total) plus monitors for new monthly issues
- Updated `docs/schema.sql` with full issues table definition including pipeline columns

---

## 2026-02-09 (Session 6)

### Fixed — Researcher Agent (3 bugs)
- **NoneType crash**: `black_book_matches` was `null` in results.json, causing `'NoneType' object is not iterable` when iterating. Fixed with `match.get("black_book_matches") or []`
- **Supabase key**: Was using `SUPABASE_KEY` (doesn't exist) instead of `SUPABASE_ANON_KEY` in both `_find_ad_context()` and `_fetch_features_batch()`
- **JSON parsing**: Increased `max_tokens` from 2048 to 4096, added brace-counting JSON extraction fallback for truncated Haiku responses

### Fixed — Reader Agent (2 bugs)
- **413 infinite loop**: Re-extraction crashes (413 Request Too Large) were uncaught, leaving queue items as "pending" forever. Added try/except in `_run_reextraction()` that marks items as failed on crash
- **Pre-1988 crash loop**: Hardened `pdf_to_images()` and Reader's `work()` with try/except around subprocess/extraction calls

### Fixed — Editor Agent (3 issues)
- **Unauthorized verdict overrides**: Editor was dismissing detective leads (7 names including a BB match) before Researcher could investigate. Added explicit prompt restriction: only override verdicts when human instructs or Researcher rates COINCIDENCE
- **Over-frequent Haiku calls**: Added minimum cooldowns — 30s for escalations, 90s for milestones, instant for human messages
- **Quality report wrong path**: `_build_quality_report()` was looking in wrong directory. Fixed to read correct extraction path AND check Supabase for NULL homeowners

### Changed — Dashboard Stats (Supabase-backed)
- "Downloaded" → "Downloaded Issues" (now includes both `downloaded` + `extracted` manifest statuses = all issues with PDFs)
- "Extracted" → "Extracted Issues" (pulls distinct issue count from Supabase, not local JSON)
- "Features" now pulls total count from Supabase (source of truth)
- Added "Confirmed" stat showing HIGH + MEDIUM connection strength dossier count
- Right-click context menu on "Confirmed" stat shows names, strength, and rationale

### Changed — Dashboard Editor Behavior
- Editor sprite no longer walks to each agent saying "Report?" on every assessment (looked like soliciting)
- Instead: Editor stays at desk during routine assessments, shows "thinking" pose
- Event-driven visits: dashboard detects agent state changes (new task, error, status change) and queues editor visits to specific agents
- `editorGatherReports()` now includes collab-glow on both editor and visited agent, with 90s cooldown
- Behavior timer shortens (5-10s) when agents need attention, lengthens (35-55s) when idle

### Changed — Notable Finds
- Filters out names checked as `no_match` by Detective
- Shows xref verdict status (likely_match, confirmed_match, etc.) with colored badges
- Shows research status: "queued", "investigating", "dossier_complete" with animated indicators
- Orchestrator overlays Researcher's live task for real-time "investigating" status

### Progress
- **Researcher operational**: First-ever dossier built (Yves Vidal → COINCIDENCE). 6 total dossiers built
- **2 confirmed associates**: William Randolph Hearst (MEDIUM), Henri Samuel (MEDIUM — Black Book match)
- **4 false positives dismissed**: Yves Vidal, Fernando Botero, Jiří Mucha, Botero (all COINCIDENCE)
- **Pipeline stats**: 164 discovered → 80 downloaded → 15 extracted → 87 features in Supabase

---

## 2026-02-08 (Session 5)

### Added — Multi-Agent System
- Built full autonomous agent framework with 7 specialized agents:
  - **Scout** (`src/agents/scout.py`) — Discovers AD issues on archive.org
  - **Courier** (`src/agents/courier.py`) — Downloads PDFs
  - **Reader** (`src/agents/reader.py`) — Extracts homeowner data via Claude Sonnet
  - **Detective** (`src/agents/detective.py`) — Cross-references names against Epstein records (BB + DOJ two-pass)
  - **Researcher** (`src/agents/researcher.py`) — Builds dossiers on Epstein-linked leads using Claude Haiku
  - **Editor** (`src/agents/editor.py`) — Monitors pipeline health, processes human messages, escalations
  - **Designer** (`src/agents/designer.py`) — Learns design patterns from training sources
- **Agent base class** (`src/agents/base.py`) — Async work loop, pause/resume, progress tracking, skills loading, dashboard status reporting
- **Orchestrator** (`src/orchestrator.py`) — Launches all agents, merges live status into `status.json`, processes pause/resume commands
- **Dashboard server** (`src/dashboard_server.py`) — HTTP server for Agent Office (inbox API, agent commands, skills editing)
- **DOJ search module** (`src/doj_search.py`) — Playwright-based DOJ Epstein Library search with WAF bypass, bot check handling, age gate
- **Agent skills** (`src/agents/skills/*.md`) — Per-agent personality, methodology, and behavior documentation

### Added — Researcher Home Analysis
- Enhanced Researcher Haiku prompt with home-as-evidence analysis: design style, cost/size, designer choice, location, and temporal relevance to Epstein's active period (1990-2008)
- New `home_analysis` section in dossier JSON schema with 4 fields: `wealth_indicators`, `social_circle_clues`, `style_significance`, `temporal_relevance`
- Updated `src/agents/skills/researcher.md` with Home Analysis methodology section
- Added home-based pattern upgrade factors to connection strength guide (Epstein enclaves, shared designers, UHNW signals)

### Added — Researcher Per-Name Failure Tracking
- `MAX_INVESTIGATION_FAILURES = 3` — names that fail investigation 3 times are skipped, preventing infinite API quota burn
- Failure counts tracked in `researcher_log.json` (was already written, now enforced in `_find_uninvestigated_leads()`)

### Added — Article Author Extraction
- `article_author` field added to `EXTRACT_PROMPT` in `src/extract_features.py` — extracts journalist byline
- `article_author` added to `FEATURE_FIELDS` in `src/load_features.py`
- `article_author TEXT` column added to `docs/schema.sql` and live Supabase `features` table

### Fixed — Agent Office Dashboard Real-Time Gaps
- **Speech bubbles now show live tasks**: Changed to prefer `liveTask` (real-time agent action from orchestrator) over `message` (stale disk summary) — e.g., "Downloading: AD Nov 2013" instead of "18 PDFs ready"
- **Cycle counts + progress in nametags**: Agent desk labels now show runtime stats like `12 cycles · 164/444` in a smaller sub-line
- **Error tooltip on hover**: Hovering the `!` error badge now shows the `last_error` message in a red tooltip (was badge-only, no details)
- **Error details propagated**: `data-error` attribute set from `last_error` field for tooltip content

### Changed
- Detective verdict system: `confirmed_match` / `likely_match` / `possible_match` / `no_match` / `needs_review` with confidence scores
- Researcher pattern analysis: cross-lead correlations (shared designers, location clusters, style trends, temporal patterns)

---

## 2026-02-08 (Session 4)

### Added — Agent Office Horizontal Dashboard Redesign
- Restructured `tools/agent-office/agent-office.html` from vertical layout to 3-column CSS Grid dashboard (left panel, center office scene, right panel)
- **Left panel:** Pipeline funnel visualization, queue depth indicators, "Now Processing" per-agent status
- **Right panel:** Activity log with agent filter buttons, Notable Finds (celebrities + Epstein matches), Data Quality progress bars
- **Top bar:** Horizontal stats strip (Discovered, Downloaded, Extracted, Features, Matches)
- Fixed 1920x1080 design with JS `transform: scale()` for uniform viewport scaling
- New rendering functions: `renderPipeline()`, `renderQueueDepths()`, `renderNowProcessing()`, `renderLogWithFilters()`, `renderNotableFinds()`, `renderQuality()`, `renderTopStats()`
- Extended `DEMO_DATA` with all new dashboard fields

### Added — Agent Status Adapter Expansion (`src/agent_status.py`)
- 5 new builder functions: `build_pipeline()`, `build_queue_depths()`, `build_now_processing()`, `build_notable_finds()`, `build_quality()`
- `read_extractions()` now returns `feature_list` with full homeowner details for Notable Finds
- `CELEBRITY_NAMES` list for tagging celebrity homeowners in extraction data

### Added — Pixel Art Visual Depth System
- 7-layer z-index system for isometric depth: back desks → back agents → front desks → front agents → collab lines → UI
- CSS `::after` pseudo-element shadows under each agent (radial gradient ellipse)
- Reader and Detective agents render above all other layers for front-row depth
- Swapped office background to `bg-office-clear-new.png` for brighter palette
- Adjusted Scout/Courier positions down 5% to avoid wall overlap

### Changed
- Font sizes increased across all dashboard panels (5-7px → 7-9px) for readability
- Panel padding increased from 12px to 16px
- Grid proportions: `1.2fr 2fr 1.3fr` for wider side panels

---

## 2026-02-07 (Session 3)

### Changed — Extraction Engine: Gemini → Claude Sonnet
- Migrated `src/extract_features.py` from Gemini 2.0 Flash to Claude Sonnet (`claude-sonnet-4-5-20250929`) for significantly better extraction quality
- Replaced `google.genai` SDK with `anthropic` SDK (v0.79.0)
- New image encoding: base64 content blocks instead of `types.Part.from_bytes()`
- New API call function: `call_claude_with_retry()` with exponential backoff for rate limits and overloaded errors
- Updated all callers: `verify_date()`, `find_articles_from_toc()`, `detect_page_offset()`, `_call_extraction()`

### Added — Extraction Quality Improvements
- **Auto page offset detection** (`detect_page_offset()`): Samples interior pages (20, 30, 50) to auto-detect the offset between PDF page numbers and printed magazine page numbers
- **Expanded TOC scanning**: Now reads pages 1-20 (was 1-12) to catch TOCs deeper in the magazine
- **Nearby-page retry**: When homeowner_name comes back NULL, retries with expanded range (±3 pages around target)
- **3 pages per article** (was 2) for better context
- **Minimum features threshold**: `MIN_FEATURES_PER_ISSUE = 3` — if fewer features found from TOC, supplements with page scanning (every 8 pages)
- **`--reextract` CLI flag**: Re-processes issues with NULL homeowners or too few features
- **`find_issues_needing_reextraction()`**: Replaces `find_issues_with_nulls()`, catches both NULLs and under-extracted issues
- **TOC prompt improvements**: More inclusive (includes "AD Visits"), notes typical issue has 4-8 features
- **String "null" cleanup**: Converts "null"/"None" strings to actual None in extracted data

### Added — Cross-Reference Engine (`src/cross_reference.py`)
- Built automated cross-reference engine for batch processing all extracted names
- Word-boundary matching (`re.search(r'\b' + re.escape(term) + r'\b', ...)`) prevents false positives (Bush≠Bushnell, Sultana≠Sultanate)
- Minimum 5-char last name for `last_name_only` matches
- Strips "and others", "et al" from compound names
- Individual word checking against SKIP_NAMES list
- Searches both DOJ Epstein Library (Playwright) and Little Black Book (text grep)

### Fixed
- NULL extraction results reduced from 9 to 5 across all issues (via expanded TOC, auto offset, nearby-page retry)
- Cross-reference false positives eliminated: Bush/Bushnell, Sultana/Sultanate, "brothers"/"others", "Kevin and Nicole" (no last name)
- Under-extracted issues (Oct 2019, Nov 2019, Jul/Aug 2020 had only 1 feature each) — addressed with MIN_FEATURES and supplemental scanning

### Progress
- 32 PDFs downloaded from archive.org (16 post-1988 usable, 16 pre-1925 skipped)
- 15 issues extracted with homeowner data
- Cross-reference results: Miranda Brooks is the only real Black Book match so far

---

## 2026-02-07 (Session 2)

### Added — PDF Ingestion Pipeline
- Built complete 4-step pipeline for processing AD issues from Internet Archive:
  - `src/archive_discovery.py` — Queries archive.org API, finds 163 AD items, parses month/year from titles and identifiers
  - `src/archive_download.py` — Downloads PDFs with rate limiting, resume support, newest-first sorting
  - `src/extract_features.py` — Converts PDF pages to images via pdftoppm, sends to Gemini 2.0 Flash Vision API for structured data extraction (TOC analysis + article-level extraction)
  - `src/load_features.py` — Loads extracted JSON into Supabase with duplicate detection
- Built `src/pipeline.py` orchestrator with CLI commands: `discover`, `download`, `extract`, `load`, `run`, `status`
- Generated `data/archive_manifest.json` with 163 discovered issues (141 with month/year parsed)

### Added — Custom Agents (Slash Commands)
- `/epstein-search <name>` — Searches DOJ Epstein Library via Playwright MCP with confidence scoring (HIGH/MEDIUM/LOW/NONE)
- `/black-book-search <name>` — Searches Epstein's Little Black Book text file (extracted from PDF via pdftotext)
- `/update-docs-and-commit` — Updates project docs before committing

### Changed
- Migrated Gemini SDK from deprecated `google.generativeai` to new `google.genai` package
- Extraction uses inline image passing (`types.Part.from_bytes()`) instead of file uploads to avoid quota issues
- Added exponential backoff retry logic for Gemini API rate limits (5 retries, 15s → 240s)
- Enabled Gemini API billing for higher quotas

### Database
- Updated `matches` table schema: replaced `confidence_score NUMERIC` with `confidence TEXT` (high/medium/low), added `confidence_rationale`, `needs_manual_review`, `manually_confirmed`, `total_doj_results`
- Added `black_book_matches` table design (commented out, Phase 2)

### Tested
- Pipeline end-to-end: Downloaded AD Jul/Aug 2020 (41MB), extracted 3 featured homes via Gemini Vision, loaded into Supabase
- Batch tested May 2013 homeowner names against DOJ Epstein Library — only false positives found (Peter Rogers = contractor invoices)
- Tested Black Book search — no May 2013 homeowners found; verified search works (e.g., Trump entries present)
- Extracted `data/black_book.txt` from Little Black Book PDF (19,547 lines)

---

## 2026-02-07 (Session 1)

### Added
- Project initialized with folder structure (`src/`, `docs/`, `tests/`, `data/`)
- Created CLAUDE.md with project overview, data model, phases, repository etiquette, design style guide, constraints & policies, documentation references, and personal learning goals (MCP servers, multi-agent AI, beginner-friendly teaching)
- Created `.env` with Supabase credentials and placeholder API keys
- Created `.gitignore` (excludes `.env`, `data/`, Python cache, IDE files)
- Connected local repo to GitHub (`johnhlocke/AD-Epstein-Index`)
- Created documentation files: `project_spec.md`, `docs/architecture.md`, `docs/changelog.md`, `docs/project_status.md`, `docs/schema.sql`, `docs/schema_feature_images.sql`
- Installed poppler for PDF rendering, Node.js, Playwright browser

### Database
- Set up Supabase project (PostgreSQL)
- Created `issues`, `features`, and `feature_images` tables
- Created Supabase Storage bucket `feature-images` (public, for matched homeowner images only)
- Seeded May 2013 data: 1 issue + 8 features via `src/seed_may_2013.py`

### Proof of Concept
- Extracted 8 featured homes from AD May 2013 via PDF-to-image pipeline (pdftoppm → visual reading)
- Confirmed feasibility: can accurately read homeowner names, designers, locations from scanned magazine PDFs

### Epstein Data Source Evaluation
- Downloaded LMSBAND/epstein-files-db (835MB SQLite) to `data/epstein_db/`
- Tested accuracy: "Larry Summers" returned 17 files in LMSBAND vs. 5,635 results on justice.gov
- Conclusion: LMSBAND database is incomplete — cannot be primary cross-reference source
- Configured Playwright MCP server in `.claude.json` to enable direct browser searching of justice.gov (requires Claude Code restart to activate)
