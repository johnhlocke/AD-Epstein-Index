"""
DOJ Epstein Library search client — Playwright-based browser automation.

Searches justice.gov/epstein for names, extracts results, and assesses
confidence levels. Used by the Detective agent for automated cross-referencing.

Usage:
    from doj_search import DOJSearchClient
    client = DOJSearchClient()
    await client.start()
    result = await client.search_name("Miranda Brooks")
    await client.stop()
"""

import asyncio
import re
from datetime import datetime

DOJ_URL = "https://www.justice.gov/epstein"
SEARCH_TIMEOUT_MS = 8000
MAX_RETRIES = 2

# Keywords in DOJ result snippets that indicate high-relevance Epstein connection
HIGH_SIGNAL_KEYWORDS = {
    "flight", "passenger", "contact", "message", "phone", "address",
    "massage", "visit", "schedule", "travel", "pilot", "log",
    "butler", "housekeeper", "employee", "associate",
}

# Keywords suggesting the DOJ match is about a service worker / contractor, NOT a principal
LOW_RELEVANCE_CONTEXT = {
    "contractor", "construction", "invoice", "plumbing", "electrical",
    "maintenance", "repair", "equipment", "supplies", "vendor",
    "delivery", "installation", "permit", "building permit",
    "landscaping", "painting", "flooring", "hvac", "roofing",
}

HONORIFICS = {"jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "esq", "esq.", "phd"}


class DOJSearchClient:
    """Headless Chromium client for searching justice.gov/epstein."""

    def __init__(self):
        self._playwright = None
        self._browser = None
        self._page = None

    async def start(self):
        """Launch Chromium, navigate to DOJ page, and pass gatekeeping.

        Uses non-headless mode with a real user-agent to avoid WAF blocking.
        The DOJ site (Akamai WAF) blocks headless browser API requests.
        """
        from playwright.async_api import async_playwright
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=False,
            args=["--window-position=-2000,-2000"],  # Off-screen
        )
        context = await self._browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 720},
        )
        self._page = await context.new_page()
        # Navigate to DOJ page and handle gatekeeping
        await self._navigate_and_authenticate()

    async def stop(self):
        """Close browser and Playwright (idempotent)."""
        try:
            if self._browser:
                await self._browser.close()
        except Exception:
            pass
        try:
            if self._playwright:
                await self._playwright.stop()
        except Exception:
            pass
        self._browser = None
        self._page = None
        self._playwright = None

    async def ensure_ready(self) -> bool:
        """Check if browser is alive, relaunch if crashed. Returns True if ready."""
        try:
            if self._page and self._browser and self._browser.is_connected():
                return True
        except Exception:
            pass
        # Browser is dead — restart
        await self.stop()
        try:
            await self.start()
            return True
        except Exception:
            return False

    async def _navigate_and_authenticate(self):
        """Navigate to DOJ Epstein page and pass bot-check + age verification gates.

        The DOJ site has two gates:
        1. Bot check: An "I am not a robot" <input type="button"> that calls reauth(),
           which sets authorization cookies via SHA256 hashing, then reloads the page.
        2. Age verification: A button to confirm you're 18+.
        """
        page = self._page
        await page.goto(DOJ_URL, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(2)

        # Gate 1: Bot check — "I am not a robot" input button
        # It's an <input type="button" value="I am not a robot" onclick="reauth();">
        try:
            robot_input = page.locator("input[value='I am not a robot']")
            if await robot_input.count() > 0:
                # Click it — this runs reauth() which sets cookies and reloads
                await robot_input.click()
                # Wait for the page to reload after reauth()
                try:
                    await page.wait_for_load_state("networkidle", timeout=15000)
                except Exception:
                    pass
                await asyncio.sleep(3)
        except Exception:
            pass

        # Gate 2: Age verification ("Are you 18 years of age or older?")
        try:
            age_button = page.locator("#age-button-yes")
            if await age_button.count() > 0:
                await age_button.click()
                await asyncio.sleep(2)
            else:
                # Try broader selectors
                yes_button = page.locator("button:has-text('Yes'), input[value='Yes']")
                if await yes_button.count() > 0:
                    await yes_button.click()
                    await asyncio.sleep(2)
        except Exception:
            pass

        # Wait for the search interface to appear
        try:
            await page.wait_for_selector("#searchInput", timeout=15000)
            self._search_ready = True
        except Exception:
            self._search_ready = False

    async def _ensure_search_ready(self) -> bool:
        """Ensure we're on the search page with the search input available."""
        page = self._page
        if not page:
            return False

        # Check if search input is already present
        try:
            if await page.locator("#searchInput").count() > 0:
                return True
        except Exception:
            pass

        # Try navigating again
        try:
            await self._navigate_and_authenticate()
            return await page.locator("#searchInput").count() > 0
        except Exception:
            return False

    async def search_name(self, name: str) -> dict:
        """Search DOJ for a single name. Returns structured result dict."""
        result = {
            "name_searched": name,
            "total_results": 0,
            "confidence": "none",
            "confidence_rationale": "",
            "top_results": [],
            "variations_searched": [name],
            "searched_at": datetime.now().isoformat(),
            "search_successful": False,
            "error": None,
        }

        for attempt in range(MAX_RETRIES + 1):
            try:
                if not await self.ensure_ready():
                    result["error"] = "Browser not ready"
                    return result

                page = self._page

                # Ensure we're on the search page with the input available
                if not await self._ensure_search_ready():
                    result["error"] = f"Attempt {attempt + 1}: Search page not ready (age gate or CAPTCHA)"
                    if attempt < MAX_RETRIES:
                        await asyncio.sleep(3)
                    continue

                # Clear and fill search input
                search_input = page.locator("#searchInput")
                await search_input.fill("")
                await search_input.fill(name)

                # Click search button
                search_button = page.locator("#searchButton")
                await search_button.click()

                # Wait for results to load
                try:
                    await page.wait_for_selector(
                        "#paginationLabel, .search-results, .no-results, #results",
                        timeout=SEARCH_TIMEOUT_MS,
                    )
                except Exception:
                    # Timeout waiting for results — page may have different structure
                    pass

                # Small delay for dynamic content
                await asyncio.sleep(1)

                # Parse result count
                total_results = await self._parse_result_count(page)
                result["total_results"] = total_results

                # Extract top results
                top_results = await self._extract_results(page)
                result["top_results"] = top_results[:10]  # Cap at 10

                # Assess confidence
                confidence, rationale = self._assess_confidence(
                    name, total_results, top_results
                )
                result["confidence"] = confidence
                result["confidence_rationale"] = rationale
                result["snippets"] = [r.get("snippet", "") for r in top_results if r.get("snippet")]
                result["search_successful"] = True
                result["error"] = None
                return result

            except Exception as e:
                result["error"] = f"Attempt {attempt + 1}: {str(e)[:200]}"
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(2)
                    # Try to recover browser
                    await self.ensure_ready()

        return result

    async def search_name_variations(self, name: str) -> dict:
        """Try multiple name variations, merge results. Returns best result."""
        from cross_reference import generate_name_variations

        variations = generate_name_variations(name)
        best_result = None
        all_variations_searched = []
        all_top_results = []
        seen_filenames = set()

        for variation in variations:
            all_variations_searched.append(variation)
            result = await self.search_name(variation)

            if not result["search_successful"]:
                continue

            # Collect unique results by filename
            for r in result.get("top_results", []):
                fname = r.get("filename", "")
                if fname and fname not in seen_filenames:
                    seen_filenames.add(fname)
                    all_top_results.append(r)

            # Track best result by confidence level
            if best_result is None or self._confidence_rank(result["confidence"]) > self._confidence_rank(best_result["confidence"]):
                best_result = result

            # If we got high confidence, no need to try more variations
            if result["confidence"] == "high":
                break

            # If we got zero results on the full name, continue to try variations
            # If we got some results, last-name-only search might add noise
            if result["total_results"] > 0 and variation != variations[-1]:
                # Skip last-name-only if we already have some results
                if len(variations) > 3 and variations.index(variation) >= len(variations) - 2:
                    continue

        if best_result is None:
            return {
                "name_searched": name,
                "total_results": 0,
                "confidence": "none",
                "confidence_rationale": "All search variations failed",
                "top_results": [],
                "variations_searched": all_variations_searched,
                "searched_at": datetime.now().isoformat(),
                "search_successful": False,
                "error": "All variations failed",
            }

        # Merge into best result
        best_result["variations_searched"] = all_variations_searched
        best_result["top_results"] = all_top_results[:10]
        best_result["name_searched"] = name  # Original name, not variation
        return best_result

    # ── Private helpers ─────────────────────────────────────────

    async def _parse_result_count(self, page) -> int:
        """Parse total result count from the page."""
        try:
            # Try pagination label first (DOJ format: "Showing 1 to 10 of 5,633 Results")
            pagination = page.locator("#paginationLabel")
            if await pagination.count() > 0:
                text = await pagination.inner_text()
                # Pattern like "Showing 1 to 10 of 5,633 Results"
                match = re.search(r'of\s+([\d,]+)', text)
                if match:
                    return int(match.group(1).replace(",", ""))
                # Pattern like "42 results"
                match = re.search(r'([\d,]+)\s+results?', text, re.IGNORECASE)
                if match:
                    return int(match.group(1).replace(",", ""))

            # Try counting result items directly
            results_container = page.locator("#results .result-item, #results li, .search-result")
            count = await results_container.count()
            if count > 0:
                return count

        except Exception:
            pass
        return 0

    async def _extract_results(self, page) -> list:
        """Extract individual result entries from the page."""
        results = []
        try:
            # Try common result selectors
            items = page.locator("#results .result-item, #results li, .search-result, #results tr")
            count = await items.count()

            for i in range(min(count, 10)):
                try:
                    item = items.nth(i)
                    text = await item.inner_text()

                    # Try to extract link
                    link = item.locator("a").first
                    url = ""
                    filename = ""
                    if await link.count() > 0:
                        url = await link.get_attribute("href") or ""
                        filename = await link.inner_text() or ""

                    # Try to find dataset name
                    dataset = ""
                    dataset_el = item.locator(".dataset, .source, .category")
                    if await dataset_el.count() > 0:
                        dataset = await dataset_el.inner_text()

                    results.append({
                        "filename": filename.strip(),
                        "dataset": dataset.strip(),
                        "url": url.strip(),
                        "snippet": text.strip()[:300],
                    })
                except Exception:
                    continue
        except Exception:
            pass
        return results

    def _assess_confidence(self, name: str, total_results: int, top_results: list) -> tuple:
        """Assess confidence of DOJ search results. Returns (confidence, rationale).

        The DOJ Epstein Library contains all documents from the investigation —
        invoices, flight logs, contact lists, correspondence, legal filings, etc.
        A name appearing in these docs could mean:
          - Direct connection (contact list, flight log, message) → high
          - Ambiguous context (name appears but no clear signal) → medium
          - Incidental mention (contractor invoice, cultural reference) → low
        Elena (Researcher) does the deep contextual analysis — this is a first pass.
        """
        if total_results == 0:
            return "none", f"No results found for '{name}'"

        all_snippets = " ".join(r.get("snippet", "") for r in top_results).lower()
        name_lower = name.lower()
        name_parts = name_lower.split()

        full_name_in_snippets = name_lower in all_snippets
        found_keywords = [kw for kw in HIGH_SIGNAL_KEYWORDS if kw in all_snippets]
        found_low_relevance = [kw for kw in LOW_RELEVANCE_CONTEXT if kw in all_snippets]

        if full_name_in_snippets:
            # Personal-connection context → high (flight log, contact list, message, etc.)
            if found_keywords and not found_low_relevance:
                return "high", f"Full name in {total_results} docs with personal-connection signals: {', '.join(found_keywords[:3])}"

            # Mixed signals — both personal and contractor context
            if found_keywords and found_low_relevance:
                return "medium", (
                    f"Full name in {total_results} docs with mixed context — "
                    f"personal ({', '.join(found_keywords[:2])}) and "
                    f"vendor ({', '.join(found_low_relevance[:2])})"
                )

            # Only contractor/vendor context → low (probably a plumber, not a guest)
            if found_low_relevance and not found_keywords:
                return "low", (
                    f"Full name in {total_results} docs but context is "
                    f"contractor/vendor ({', '.join(found_low_relevance[:3])})"
                )

            # Name found but no keyword context either way — ambiguous.
            # Could be the person, could be incidental. Elena will dig deeper.
            return "medium", f"Full name in {total_results} docs — context ambiguous, needs investigation"

        # Last name only — low (could be anyone with that surname)
        if len(name_parts) >= 2:
            last_name = name_parts[-1]
            if last_name in all_snippets:
                if found_keywords:
                    return "medium", f"Last name '{last_name}' in {total_results} docs with signals: {', '.join(found_keywords[:3])}"
                return "low", f"Only last name '{last_name}' in {total_results} docs — could be a different person"

        return "low", f"{total_results} results but name not clearly matched in snippets"

    @staticmethod
    def _confidence_rank(confidence: str) -> int:
        """Rank confidence levels for comparison."""
        return {"high": 4, "medium": 3, "low": 2, "none": 1}.get(confidence, 0)
