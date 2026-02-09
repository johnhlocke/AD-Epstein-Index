# Detective Agent Skills

## Mission
Cross-reference every extracted homeowner name against Epstein-related records. For every name, definitively answer "match" or "no match" against BOTH the Black Book AND the DOJ Epstein Library. Be relentless — try name variations, flag ambiguity for review, never leave a name unchecked.

## Two-Pass Search Architecture

### Pass 1: Black Book (instant, all unchecked)
- Runs every cycle against all unchecked features from Supabase
- Uses local `data/black_book.txt` file
- Word-boundary regex matching to prevent false positives
- Results saved immediately with `doj_status: "pending"`

### Pass 2: DOJ Epstein Library (batched, slow)
- Searches justice.gov/epstein via headless Chromium (Playwright)
- Processes up to 5 names per cycle (DOJ_BATCH_SIZE)
- Tries multiple name variations for each name
- Produces combined verdict after DOJ search completes

## Name Variation Strategy
For each name, search these variations (most specific to least):
1. **Full name** as written (e.g., "Robert Smith Jr.")
2. **"Last, First"** format (e.g., "Smith, Robert")
3. **Without honorifics** (e.g., "Robert Smith" — stripping Jr., Sr., III, etc.)
4. **First + Last only** (e.g., "Robert Smith" — skipping middle names)
5. **Last name only** (fallback, only if all above return 0 results and last name is 5+ chars)

Stop searching variations early if high confidence is found.

## DOJ Confidence Levels
- **HIGH**: Full name found in results AND snippets contain high-signal keywords (flight, contact, massage, phone, address, passenger, schedule, travel, pilot, log)
- **MEDIUM**: Full name found in results but no high-signal context, OR last name with keywords
- **LOW**: Results exist but name not clearly matched in snippets
- **NONE**: Zero results for all variations

## Combined Verdict Rules
After both Black Book (BB) and DOJ searches complete:

| BB Result | DOJ Result | Verdict |
|-----------|------------|---------|
| last_first | high | `confirmed_match` (0.95) |
| last_first | medium/low/none | `likely_match` (0.70-0.80) |
| — | high | `likely_match` (0.75) |
| full_name | medium/high | `likely_match` (0.70) |
| full_name | low/none | `possible_match` (0.50) or `needs_review` if FP indicators |
| last_name_only | any | `possible_match` (0.30-0.45) or `needs_review` if FP indicators |
| — | medium/low | `possible_match` (0.30) |
| — | — | `no_match` (0.0) |

## False Positive Detection
Flag these indicators:
- Last_name_only match on a common name (Smith, Johnson, Williams, etc.)
- Short last name (<5 chars) in last_name_only match
- DOJ returned 50+ results (likely matching common terms)
- DOJ results present but no high-signal keyword context
- **Non-person entities**: Name contains words like hotel, palace, resort, club, foundation, museum, etc. These are businesses/landmarks, not people. Auto-detected and flagged.
- **Unrelated roles**: DOJ results mention roles like contractor, construction worker, electrician, driver, security guard. The DOJ match may be a different person (staff/worker on Epstein properties) rather than the AD homeowner.

## Failure Tracking
- **Per-name**: After 3 failures on the same name, skip it (until Editor retries)
- **Consecutive**: After 3 consecutive DOJ failures, escalate `search_stuck` to Editor
- **Log**: `data/detective_log.json` tracks cycle count, failure counts, search stats

## Escalation Types
1. **high_value_match** — confirmed or likely match found. Editor should alert the human.
2. **false_positive_review** — possible match with false positive indicators. Editor should review.
3. **needs_review** — ambiguous evidence the Detective can't resolve.
4. **doj_search_failed** — a name's DOJ search failed repeatedly.
5. **search_stuck** — multiple consecutive DOJ failures (browser or site issues).

Rate-limited: max 1 escalation per name per hour.

## Editor Verdict System
- Editor can override verdicts via `data/detective_verdicts.json`
- Detective checks for unapplied verdicts each cycle
- Applied verdicts update `combined_verdict` in results.json
- Editor can also reset names for DOJ retry (resets `doj_status` to "pending")

## Browser Management
- Headless Chromium via Playwright async API
- Launched lazily on first DOJ search
- Auto-recovery if browser crashes (`ensure_ready()`)
- Always closed on agent shutdown (via `run()` finally block)

## Matching Rules (inherited)
- Word-boundary regex: `\bterm\b` to prevent Bush/Bushnell false positives
- Last name ≥ 5 chars for last_name_only matches
- Strip "and others", "et al" from names before splitting
- Skip generic names: brothers, hotel, studio, associates, group, palace

## Success Criteria
- Every extracted name cross-referenced against BOTH sources
- Combined verdict for every name
- Zero false positives from substring matching
- Ambiguous cases escalated — never silently dismissed
- Clear audit trail with evidence summary and rationale
