#!/usr/bin/env python3
"""Measure fame/notoriety of AD homeowners using internet-derived metrics.

Based on Ramirez & Hagen (2018) — "The Quantitative Measure and Statistical
Distribution of Fame" (PLOS ONE). Collects six metrics per person:
  1. Wikipedia edit count   (WE — strongest proxy, R=0.83)
  2. Wikipedia page views   (WV — July 2015 – present)
  3. Google Search results  (GH — via SerpAPI)
  4. News article count     (NewsAPI.ai / Event Registry)
  5. NYT article count      (NYT — prestige media proxy, archive to 1851)
  6. Wikipedia ref count    (WR — archival depth proxy)

Fame follows a power law distribution — all analysis uses log-transformed values.
Geometric mean fame score computed across available metrics.

Usage:
    python3 src/measure_fame.py --dry-run          # Preview names + cost estimate
    python3 src/measure_fame.py --wikipedia-only    # Phase 1 only (free)
    python3 src/measure_fame.py --google-only       # Phase 2 only (SerpAPI)
    python3 src/measure_fame.py --newsapi-only      # Phase 3 only (NewsAPI.ai)
    python3 src/measure_fame.py --nyt-only          # Phase 4 only (NYT, free)
    python3 src/measure_fame.py --wikirefs-only     # Phase 5 only (free)
    python3 src/measure_fame.py                     # All phases
    python3 src/measure_fame.py --resume            # Skip already-collected names
    python3 src/measure_fame.py --report            # Stats + group comparison
    python3 src/measure_fame.py --apply-db          # Upsert to Supabase

Cost estimates:
    Wikipedia:  Free (~15-20 min for ~2,600 names)
    SerpAPI:    ~$50-60 (5,200 queries at $50/5,000 tier)
    NewsAPI.ai: 1 token per name (free tier = 2,000 tokens/month)
    NYT:        Free (500 req/day, 5/min → ~5 days for 2,600 names)
    Wiki refs:  Free (~15 min for ~1,700 names with Wikipedia pages)
"""

import argparse
import asyncio
import glob as globmod
import json
import math
import os
import re
import sys
import time
from datetime import datetime, timezone

import ssl

import aiohttp
import certifi
import requests as sync_requests
from dotenv import load_dotenv
from supabase import create_client

# Import name acquisition from research_classify
sys.path.insert(0, os.path.dirname(__file__))
from research_classify import get_confirmed_names, get_all_baseline_candidates

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# ── Configuration ────────────────────────────────────────────

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "fame_metrics")
USER_AGENT = "AD-Epstein-Index/1.0 (research project; contact@wheretheylive.world)"

WIKIPEDIA_CONCURRENCY = 5   # conservative — Wikipedia 429s at ~200 rapid requests
SERPAPI_CONCURRENCY = 5
NEWSAPI_CONCURRENCY = 5     # NewsAPI.ai concurrent requests
WIKIPEDIA_BATCH_DELAY = 2.0  # seconds between batches to avoid 429
WIKIPEDIA_MAX_RETRIES = 3

# NewsAPI.ai (Event Registry)
NEWSAPI_BASE_URL = "http://eventregistry.org/api/v1/article/getArticles"
NEWSAPI_USAGE_URL = "https://eventregistry.org/api/v1/usage"

# NYT Article Search API (free, 500 req/day, 5 req/min)
NYT_API_BASE_URL = "https://api.nytimes.com/svc/search/v2/articlesearch.json"
NYT_RATE_LIMIT_DELAY = 12.5  # seconds between requests (5/min = 12s, plus buffer)
NYT_DAILY_LIMIT = 500

# Wikipedia reference count
WIKIREFS_CONCURRENCY = 5
WIKIREFS_BATCH_DELAY = 2.0

# Wikipedia pageviews date range (July 2015 = earliest available – present)
PAGEVIEWS_START = "20150701"
PAGEVIEWS_END = "20260301"

# SerpAPI pricing
SERPAPI_COST_PER_QUERY = 50.0 / 5000  # $50 tier = 5,000 searches


# ── Supabase ─────────────────────────────────────────────────

def get_supabase():
    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
    return create_client(url, key)


# ── Name Deduplication ───────────────────────────────────────

def deduplicate_names(people):
    """Case-insensitive dedup, skip Anonymous/Unknown, one entry per unique name."""
    seen = set()
    unique = []
    for p in people:
        name = (p.get("name") or "").strip()
        key = name.lower()
        if not name or key in ("anonymous", "unknown", ""):
            continue
        if key in seen:
            continue
        seen.add(key)
        unique.append(p)
    return unique


# ── Resume Logic ─────────────────────────────────────────────

def load_existing_results():
    """Load all existing JSONL files from data/fame_metrics/."""
    results = {}
    files = sorted(globmod.glob(os.path.join(OUTPUT_DIR, "fame_*.jsonl")))
    for fpath in files:
        with open(fpath) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                name_key = rec.get("name", "").strip().lower()
                if name_key:
                    # Later files overwrite earlier ones (latest wins)
                    results[name_key] = rec
    return results


def should_skip_wikipedia(rec):
    """True if this record already has Wikipedia data collected."""
    return rec.get("wikipedia_collected", False)


def should_skip_google(rec):
    """True if this record already has Google data collected."""
    return rec.get("google_collected", False)


def should_skip_newsapi(rec):
    """True if this record already has NewsAPI data collected."""
    return rec.get("newsapi_collected", False)


def should_skip_nyt(rec):
    """True if this record already has NYT data collected."""
    return rec.get("nyt_collected", False)


def should_skip_wikirefs(rec):
    """True if this record already has Wikipedia reference count."""
    return rec.get("wikirefs_collected", False)


def should_skip_all(rec):
    """True if this record has all phase data."""
    return (should_skip_wikipedia(rec) and should_skip_google(rec) and
            should_skip_newsapi(rec) and should_skip_nyt(rec) and
            should_skip_wikirefs(rec))


# ── Wikipedia API ────────────────────────────────────────────

async def _wiki_get(session, url, params=None, headers=None):
    """GET with retry on 429 rate-limit responses."""
    for attempt in range(WIKIPEDIA_MAX_RETRIES):
        async with session.get(url, params=params, headers=headers) as resp:
            if resp.status == 429:
                wait = 2 ** (attempt + 1)  # 2, 4, 8 seconds
                await asyncio.sleep(wait)
                continue
            return resp.status, await resp.json()
    return 429, None


async def wikipedia_search(session, name):
    """Search Wikipedia for a person's canonical page title."""
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "list": "search",
        "srsearch": name,
        "srnamespace": "0",
        "srlimit": "5",
        "format": "json",
    }
    headers = {"User-Agent": USER_AGENT}
    try:
        status, data = await _wiki_get(session, url, params=params, headers=headers)
        if status != 200 or data is None:
            return None
        results = data.get("query", {}).get("search", [])
        if not results:
            return None

        # Check top results for a plausible person page
        for result in results[:3]:
            title = result.get("title", "")
            snippet = result.get("snippet", "").lower()

            # Skip disambiguation pages
            if "disambiguation" in snippet or "(disambiguation)" in title:
                continue

            # Biographical indicators
            bio_signals = [
                "born", "born in", "was a", "is a", "is an",
                "american", "british", "french", "businessman",
                "actress", "actor", "politician", "designer",
                "artist", "philanthropist", "billionaire",
                "socialite", "entrepreneur", "financier",
                "author", "writer", "singer", "musician",
                "director", "producer", "architect", "lawyer",
                "journalist", "model", "athlete", "player",
            ]
            if any(sig in snippet for sig in bio_signals):
                return title

        # Fall back to first non-disambiguation result
        for result in results[:3]:
            title = result.get("title", "")
            if "(disambiguation)" not in title:
                return title

        return None
    except Exception:
        return None


async def wikipedia_edit_count(session, title):
    """Get edit count for a Wikipedia page."""
    safe_title = title.replace(" ", "_")
    url = f"https://en.wikipedia.org/w/rest.php/v1/page/{safe_title}/history/counts/edits"
    headers = {"User-Agent": USER_AGENT}
    try:
        status, data = await _wiki_get(session, url, headers=headers)
        if status != 200 or data is None:
            return None
        return data.get("count")
    except Exception:
        return None


async def wikipedia_pageviews(session, title):
    """Get cumulative page views (July 2015 – present, monthly)."""
    safe_title = title.replace(" ", "_")
    url = (
        f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
        f"en.wikipedia.org/all-access/user/{safe_title}/monthly/"
        f"{PAGEVIEWS_START}/{PAGEVIEWS_END}"
    )
    headers = {"User-Agent": USER_AGENT}
    try:
        status, data = await _wiki_get(session, url, headers=headers)
        if status != 200 or data is None:
            return None
        items = data.get("items", [])
        return sum(item.get("views", 0) for item in items)
    except Exception:
        return None


async def collect_wikipedia_for_person(session, sem, person):
    """Collect all Wikipedia metrics for one person."""
    async with sem:
        name = person["name"]

        # Step 1: Find Wikipedia page
        title = await wikipedia_search(session, name)

        if not title:
            return {
                "wikipedia_page": None,
                "wikipedia_edit_count": None,
                "wikipedia_pageviews": None,
                "wikipedia_collected": True,
            }

        # Step 2: Edit count
        edits = await wikipedia_edit_count(session, title)

        # Step 3: Page views
        views = await wikipedia_pageviews(session, title)

        return {
            "wikipedia_page": title,
            "wikipedia_edit_count": edits,
            "wikipedia_pageviews": views,
            "wikipedia_collected": True,
        }


# ── SerpAPI (Google) ─────────────────────────────────────────

async def google_search_count(session, name, api_key):
    """Get Google Search total result count via SerpAPI."""
    url = "https://serpapi.com/search"
    params = {
        "engine": "google",
        "q": f'"{name}"',
        "api_key": api_key,
        "num": "10",
    }
    try:
        async with session.get(url, params=params) as resp:
            if resp.status != 200:
                return None
            data = await resp.json()
            search_info = data.get("search_information", {})
            return search_info.get("total_results")
    except Exception:
        return None


async def google_news_count(session, name, api_key):
    """Get Google News result count via SerpAPI."""
    url = "https://serpapi.com/search"
    params = {
        "engine": "google_news",
        "q": f'"{name}"',
        "api_key": api_key,
        "hl": "en",
        "gl": "us",
    }
    try:
        async with session.get(url, params=params) as resp:
            if resp.status != 200:
                return None, None
            data = await resp.json()
            search_info = data.get("search_information", {})
            total = search_info.get("total_results")
            visible = len(data.get("news_results", []))
            return total, visible
    except Exception:
        return None, None


async def collect_google_for_person(session, sem, person, api_key):
    """Collect all Google metrics for one person."""
    async with sem:
        name = person["name"]

        # Step 4: Google Search result count
        search_results = await google_search_count(session, name, api_key)

        # Step 5: Google News result count
        news_total, news_visible = await google_news_count(session, name, api_key)

        return {
            "google_search_results": search_results,
            "google_news_total": news_total,
            "google_news_visible": news_visible,
            "google_collected": True,
        }


# ── Fame Score ───────────────────────────────────────────────

def compute_fame_score(rec):
    """Compute geometric mean of available metrics.

    Uses exp(mean(log(max(x, 1)))) — the max(x, 1) floor prevents zeros
    from collapsing the product. For names with no Wikipedia page, only
    Google/News metrics contribute.

    Core 5 metrics (best available):
      1. Wikipedia edit count     (WE — strongest proxy, R=0.83)
      2. Wikipedia page views     (WV)
      3. Google search results    (GH — SerpAPI estimate)
      4. NYT article count        (NYT — prestige media, archive to 1851)
      5. Wikipedia reference count (WR — archival depth)

    Falls back to newsapi_article_count if NYT not yet collected.
    """
    values = []
    for key in [
        "wikipedia_edit_count",
        "wikipedia_pageviews",
        "google_search_results",
        "nyt_article_count",
        "wikipedia_reference_count",
    ]:
        v = rec.get(key)
        if v is not None:
            values.append(max(v, 1))

    # Fallback: if NYT not collected yet, use newsapi_article_count
    if rec.get("nyt_article_count") is None and rec.get("newsapi_article_count") is not None:
        values.append(max(rec["newsapi_article_count"], 1))

    if not values:
        return None

    log_mean = sum(math.log(v) for v in values) / len(values)
    return round(math.exp(log_mean), 2)


# ── NewsAPI.ai (Event Registry) ──────────────────────────────

async def collect_newsapi_for_person(session, sem, person, api_key):
    """Collect news article count for a person from NewsAPI.ai."""
    name = person["name"]
    payload = {
        "apiKey": api_key,
        "keyword": f'"{name}"',
        "lang": "eng",
        "articlesCount": 0,  # we only want totalResults, no article bodies
    }

    async with sem:
        async with session.post(NEWSAPI_BASE_URL, json=payload) as resp:
            if resp.status != 200:
                text = await resp.text()
                return {"newsapi_article_count": None, "newsapi_collected": True,
                        "newsapi_error": f"HTTP {resp.status}: {text[:200]}"}
            data = await resp.json()

    total = data.get("articles", {}).get("totalResults")
    return {
        "newsapi_article_count": total,
        "newsapi_collected": True,
    }


async def run_newsapi_phase(people, existing, output_file):
    """Collect news article counts for all people via NewsAPI.ai."""
    api_key = os.environ.get("NEWSAPI_KEY")
    if not api_key:
        print("\n  ERROR: NEWSAPI_KEY not found in environment. Add it to .env")
        return 0, 0, 0

    # Check remaining tokens before starting
    try:
        usage = sync_requests.get(NEWSAPI_USAGE_URL, params={"apiKey": api_key}, timeout=10).json()
        available = usage.get("availableTokens", 0)
        used = usage.get("usedTokens", 0)
        print(f"  NewsAPI tokens: {used} used / {available} available")
    except Exception as e:
        print(f"  Warning: could not check token usage: {e}")
        available = float("inf")

    sem = asyncio.Semaphore(NEWSAPI_CONCURRENCY)
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    connector = aiohttp.TCPConnector(limit=NEWSAPI_CONCURRENCY, ssl=ssl_ctx)
    timeout = aiohttp.ClientTimeout(total=30)

    skipped = 0
    collected = 0
    errors = 0
    tokens_used = 0

    BATCH_SIZE = 20

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        with open(output_file, "a") as f:
            for batch_start in range(0, len(people), BATCH_SIZE):
                batch = people[batch_start:batch_start + BATCH_SIZE]
                tasks = []

                for person in batch:
                    name_key = person["name"].strip().lower()
                    existing_rec = existing.get(name_key, {})
                    if should_skip_newsapi(existing_rec):
                        skipped += 1
                        continue
                    tasks.append((person, collect_newsapi_for_person(session, sem, person, api_key)))

                if not tasks:
                    continue

                # Check if we're about to exceed available tokens
                if tokens_used + len(tasks) > available:
                    print(f"\n  Stopping: would exceed available tokens "
                          f"({tokens_used} used + {len(tasks)} pending > {available} available)")
                    break

                results = await asyncio.gather(
                    *[t[1] for t in tasks], return_exceptions=True
                )

                for (person, _), result in zip(tasks, results):
                    name_key = person["name"].strip().lower()
                    if isinstance(result, Exception):
                        print(f"    ERROR {person['name']}: {result}")
                        errors += 1
                        continue

                    if result.get("newsapi_error"):
                        print(f"    ERROR {person['name']}: {result['newsapi_error']}")
                        errors += 1

                    existing_rec = existing.get(name_key, {})
                    rec = {
                        "name": person["name"],
                        "group": person.get("group", "baseline"),
                        "feature_id": person.get("feature_id"),
                        "category": person.get("category", "Unknown"),
                        **existing_rec,
                        **result,
                        "collected_at": datetime.now(timezone.utc).isoformat(),
                    }
                    existing[name_key] = rec

                    f.write(json.dumps(rec, default=str) + "\n")
                    f.flush()
                    collected += 1
                    tokens_used += 1

                print(
                    f"  [{batch_start + len(batch):>4}/{len(people)}] "
                    f"collected={collected} skipped={skipped} "
                    f"tokens={tokens_used}"
                )

    return collected, skipped, errors


# ── NYT Article Search API ───────────────────────────────────

async def collect_nyt_for_person(session, name, api_key):
    """Collect NYT article count for a person. Sequential (rate-limited)."""
    params = {
        "q": f'"{name}"',
        "api-key": api_key,
    }
    try:
        async with session.get(NYT_API_BASE_URL, params=params) as resp:
            if resp.status == 429:
                return {"nyt_article_count": None, "nyt_collected": False,
                        "nyt_error": "rate_limited"}
            if resp.status != 200:
                text = await resp.text()
                return {"nyt_article_count": None, "nyt_collected": True,
                        "nyt_error": f"HTTP {resp.status}: {text[:200]}"}
            data = await resp.json()
        hits = data.get("response", {}).get("metadata", {}).get("hits")
        return {"nyt_article_count": hits, "nyt_collected": True}
    except Exception as e:
        return {"nyt_article_count": None, "nyt_collected": True,
                "nyt_error": str(e)[:200]}


async def run_nyt_phase(people, existing, output_file):
    """Collect NYT article counts. Sequential due to strict rate limit (5/min)."""
    api_key = os.environ.get("NYT_API_KEY")
    if not api_key:
        print("\n  ERROR: NYT_API_KEY not found in environment. Add it to .env")
        return 0, 0, 0

    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    connector = aiohttp.TCPConnector(limit=1, ssl=ssl_ctx)
    timeout = aiohttp.ClientTimeout(total=30)

    skipped = 0
    collected = 0
    errors = 0
    daily_count = 0

    # Build todo list
    todo = []
    for person in people:
        name_key = person["name"].strip().lower()
        existing_rec = existing.get(name_key, {})
        if should_skip_nyt(existing_rec):
            skipped += 1
            continue
        todo.append(person)

    print(f"  NYT: {len(todo)} names to collect, {skipped} already done")
    print(f"  Rate: 1 request per {NYT_RATE_LIMIT_DELAY}s (5/min)")
    est_min = len(todo) * NYT_RATE_LIMIT_DELAY / 60
    est_days = len(todo) / NYT_DAILY_LIMIT
    print(f"  Estimated: {est_min:.0f} min continuous, "
          f"or {est_days:.1f} days at {NYT_DAILY_LIMIT}/day limit")

    if not todo:
        return 0, skipped, 0

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        with open(output_file, "a") as f:
            for i, person in enumerate(todo):
                name_key = person["name"].strip().lower()

                if daily_count >= NYT_DAILY_LIMIT:
                    print(f"\n  Stopping: daily limit of {NYT_DAILY_LIMIT} reached. "
                          f"Use --resume to continue tomorrow.")
                    break

                result = await collect_nyt_for_person(session, person["name"], api_key)

                # Handle rate limiting — back off and retry once
                if result.get("nyt_error") == "rate_limited":
                    print(f"    Rate limited at {person['name']}, waiting 60s...")
                    await asyncio.sleep(60)
                    result = await collect_nyt_for_person(session, person["name"], api_key)

                if result.get("nyt_error") and result["nyt_error"] != "rate_limited":
                    print(f"    ERROR {person['name']}: {result['nyt_error']}")
                    errors += 1

                existing_rec = existing.get(name_key, {})
                rec = {
                    "name": person["name"],
                    "group": person.get("group", "baseline"),
                    "feature_id": person.get("feature_id"),
                    "category": person.get("category", "Unknown"),
                    **existing_rec,
                    **result,
                    "collected_at": datetime.now(timezone.utc).isoformat(),
                }
                existing[name_key] = rec

                f.write(json.dumps(rec, default=str) + "\n")
                f.flush()
                collected += 1
                daily_count += 1

                if (i + 1) % 10 == 0 or i == len(todo) - 1:
                    hits = result.get("nyt_article_count", "?")
                    print(
                        f"  [{i + 1:>4}/{len(todo)}] "
                        f"{person['name']:<35} hits={hits:<8} "
                        f"daily={daily_count}/{NYT_DAILY_LIMIT}"
                    )

                # Rate limit delay (except on last item)
                if i < len(todo) - 1:
                    await asyncio.sleep(NYT_RATE_LIMIT_DELAY)

    return collected, skipped, errors


# ── Wikipedia Reference Count ────────────────────────────────

async def collect_wikirefs_for_person(session, sem, person, existing_rec):
    """Count <ref> tags on a person's Wikipedia page."""
    wiki_page = existing_rec.get("wikipedia_page")
    if not wiki_page:
        # No Wikipedia page → null ref count
        return {"wikipedia_reference_count": None, "wikirefs_collected": True}

    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "parse",
        "page": wiki_page,
        "prop": "wikitext",
        "format": "json",
    }
    headers = {"User-Agent": USER_AGENT}

    async with sem:
        try:
            status, data = await _wiki_get(session, url, params=params, headers=headers)
            if status != 200 or data is None:
                return {"wikipedia_reference_count": None, "wikirefs_collected": True,
                        "wikirefs_error": f"HTTP {status}"}
            if "error" in data:
                return {"wikipedia_reference_count": None, "wikirefs_collected": True}
            wikitext = data.get("parse", {}).get("wikitext", {}).get("*", "")
            ref_count = len(re.findall(r"<ref[\s>]", wikitext))
            return {"wikipedia_reference_count": ref_count, "wikirefs_collected": True}
        except Exception as e:
            return {"wikipedia_reference_count": None, "wikirefs_collected": True,
                    "wikirefs_error": str(e)[:200]}


async def run_wikirefs_phase(people, existing, output_file):
    """Collect Wikipedia reference counts for all people with Wikipedia pages."""
    sem = asyncio.Semaphore(WIKIREFS_CONCURRENCY)
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    connector = aiohttp.TCPConnector(limit=WIKIREFS_CONCURRENCY, ssl=ssl_ctx)
    timeout = aiohttp.ClientTimeout(total=30)

    skipped = 0
    collected = 0
    errors = 0
    has_page = 0

    BATCH_SIZE = 20

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        with open(output_file, "a") as f:
            for batch_start in range(0, len(people), BATCH_SIZE):
                batch = people[batch_start:batch_start + BATCH_SIZE]
                tasks = []

                for person in batch:
                    name_key = person["name"].strip().lower()
                    existing_rec = existing.get(name_key, {})
                    if should_skip_wikirefs(existing_rec):
                        skipped += 1
                        continue
                    tasks.append((person, existing_rec,
                                  collect_wikirefs_for_person(session, sem, person, existing_rec)))

                if not tasks:
                    continue

                results = await asyncio.gather(
                    *[t[2] for t in tasks], return_exceptions=True
                )

                batch_refs = 0
                for (person, existing_rec, _), result in zip(tasks, results):
                    name_key = person["name"].strip().lower()
                    if isinstance(result, Exception):
                        print(f"    ERROR {person['name']}: {result}")
                        errors += 1
                        continue

                    if result.get("wikirefs_error"):
                        errors += 1

                    rec = {
                        "name": person["name"],
                        "group": person.get("group", "baseline"),
                        "feature_id": person.get("feature_id"),
                        "category": person.get("category", "Unknown"),
                        **existing.get(name_key, {}),
                        **result,
                        "collected_at": datetime.now(timezone.utc).isoformat(),
                    }
                    existing[name_key] = rec

                    f.write(json.dumps(rec, default=str) + "\n")
                    f.flush()
                    collected += 1
                    if result.get("wikipedia_reference_count") is not None:
                        batch_refs += 1
                        has_page += 1

                done = batch_start + len(batch)
                print(
                    f"  [{done:>4}/{len(people)}] "
                    f"collected={collected} skipped={skipped} "
                    f"with_refs={has_page} errors={errors}"
                )

                await asyncio.sleep(WIKIREFS_BATCH_DELAY)

    return collected, skipped, errors


# ── Collection Orchestrators ─────────────────────────────────

async def run_wikipedia_phase(people, existing, output_file):
    """Collect Wikipedia metrics for all people."""
    sem = asyncio.Semaphore(WIKIPEDIA_CONCURRENCY)
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    connector = aiohttp.TCPConnector(limit=WIKIPEDIA_CONCURRENCY, ssl=ssl_ctx)
    timeout = aiohttp.ClientTimeout(total=30)

    skipped = 0
    collected = 0
    errors = 0

    # Each person needs up to 3 API calls (search + edits + pageviews).
    # Wikipedia rate-limits at ~200 requests/min. Use small batches + delay.
    BATCH_SIZE = 20

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        with open(output_file, "a") as f:
            for batch_start in range(0, len(people), BATCH_SIZE):
                batch = people[batch_start:batch_start + BATCH_SIZE]
                tasks = []

                for person in batch:
                    name_key = person["name"].strip().lower()
                    existing_rec = existing.get(name_key, {})
                    if should_skip_wikipedia(existing_rec):
                        skipped += 1
                        continue
                    tasks.append((person, collect_wikipedia_for_person(session, sem, person)))

                if not tasks:
                    continue

                results = await asyncio.gather(
                    *[t[1] for t in tasks], return_exceptions=True
                )

                batch_pages = 0
                for (person, _), result in zip(tasks, results):
                    name_key = person["name"].strip().lower()
                    if isinstance(result, Exception):
                        print(f"    ERROR {person['name']}: {result}")
                        errors += 1
                        continue

                    existing_rec = existing.get(name_key, {})
                    rec = {
                        "name": person["name"],
                        "group": person.get("group", "baseline"),
                        "feature_id": person.get("feature_id"),
                        "category": person.get("category", "Unknown"),
                        **existing_rec,
                        **result,
                        "collected_at": datetime.now(timezone.utc).isoformat(),
                    }
                    existing[name_key] = rec

                    f.write(json.dumps(rec, default=str) + "\n")
                    f.flush()
                    collected += 1
                    if rec.get("wikipedia_page"):
                        batch_pages += 1

                done = batch_start + len(batch)
                print(
                    f"  [{done:>4}/{len(people)}] "
                    f"collected={collected} skipped={skipped} "
                    f"pages_found={batch_pages} errors={errors}"
                )

                # Rate-limit delay between batches
                await asyncio.sleep(WIKIPEDIA_BATCH_DELAY)

    return collected, skipped, errors


async def run_google_phase(people, existing, output_file):
    """Collect Google metrics for all people via SerpAPI."""
    api_key = os.environ.get("SERPAPI_KEY")
    if not api_key:
        print("\n  ERROR: SERPAPI_KEY not found in environment. Add it to .env")
        return 0, 0, 0

    sem = asyncio.Semaphore(SERPAPI_CONCURRENCY)
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    connector = aiohttp.TCPConnector(limit=SERPAPI_CONCURRENCY, ssl=ssl_ctx)
    timeout = aiohttp.ClientTimeout(total=60)

    skipped = 0
    collected = 0
    errors = 0
    total_queries = 0

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        with open(output_file, "a") as f:
            for batch_start in range(0, len(people), 20):
                batch = people[batch_start:batch_start + 20]
                tasks = []

                for person in batch:
                    name_key = person["name"].strip().lower()
                    existing_rec = existing.get(name_key, {})
                    if should_skip_google(existing_rec):
                        skipped += 1
                        continue
                    tasks.append((person, collect_google_for_person(session, sem, person, api_key)))

                if not tasks:
                    continue

                results = await asyncio.gather(
                    *[t[1] for t in tasks], return_exceptions=True
                )

                for (person, _), result in zip(tasks, results):
                    name_key = person["name"].strip().lower()
                    if isinstance(result, Exception):
                        print(f"    ERROR {person['name']}: {result}")
                        errors += 1
                        continue

                    existing_rec = existing.get(name_key, {})
                    rec = {
                        "name": person["name"],
                        "group": person.get("group", "baseline"),
                        "feature_id": person.get("feature_id"),
                        "category": person.get("category", "Unknown"),
                        **existing_rec,
                        **result,
                        "collected_at": datetime.now(timezone.utc).isoformat(),
                    }
                    existing[name_key] = rec

                    f.write(json.dumps(rec, default=str) + "\n")
                    f.flush()
                    collected += 1
                    total_queries += 2  # search + news

                cost_so_far = total_queries * SERPAPI_COST_PER_QUERY
                print(
                    f"  [{batch_start + len(batch):>4}/{len(people)}] "
                    f"collected={collected} skipped={skipped} "
                    f"queries={total_queries} cost=${cost_so_far:.2f}"
                )

    return collected, skipped, errors


# ── Report Mode ──────────────────────────────────────────────

def print_report(records):
    """Print fame comparison: Epstein vs baseline with Mann-Whitney U tests."""
    epstein = [r for r in records if r.get("group") == "epstein"]
    baseline = [r for r in records if r.get("group") == "baseline"]

    print("\n" + "=" * 70)
    print("  FAME METRICS — COMPARATIVE REPORT")
    print("  Based on Ramirez & Hagen (2018), PLOS ONE")
    print("=" * 70)

    # Coverage summary
    def coverage(group, label):
        total = len(group)
        has_wiki = sum(1 for r in group if r.get("wikipedia_page"))
        has_google = sum(1 for r in group if r.get("google_collected"))
        has_newsapi = sum(1 for r in group if r.get("newsapi_collected"))
        has_nyt = sum(1 for r in group if r.get("nyt_collected"))
        has_wikirefs = sum(1 for r in group if r.get("wikirefs_collected"))
        wiki_pct = (has_wiki / total * 100) if total else 0
        google_pct = (has_google / total * 100) if total else 0
        newsapi_pct = (has_newsapi / total * 100) if total else 0
        nyt_pct = (has_nyt / total * 100) if total else 0
        wikirefs_pct = (has_wikirefs / total * 100) if total else 0
        print(f"\n  {label} (n={total}):")
        print(f"    Wikipedia page found:    {has_wiki:>5} ({wiki_pct:.1f}%)")
        print(f"    Google data collected:   {has_google:>5} ({google_pct:.1f}%)")
        print(f"    NewsAPI data collected:  {has_newsapi:>5} ({newsapi_pct:.1f}%)")
        print(f"    NYT data collected:      {has_nyt:>5} ({nyt_pct:.1f}%)")
        print(f"    Wiki refs collected:     {has_wikirefs:>5} ({wikirefs_pct:.1f}%)")

    coverage(epstein, "EPSTEIN ORBIT")
    coverage(baseline, "AD BASELINE")

    # Distribution stats per metric
    metrics = [
        ("wikipedia_edit_count", "Wikipedia Edits"),
        ("wikipedia_pageviews", "Wikipedia Pageviews"),
        ("google_search_results", "Google Search Results"),
        ("newsapi_article_count", "News Articles (NewsAPI.ai)"),
        ("nyt_article_count", "NYT Articles (1851–present)"),
        ("wikipedia_reference_count", "Wikipedia References"),
    ]

    print(f"\n  {'─' * 66}")
    print(f"  DISTRIBUTION STATS (non-null values, raw scale)")
    print(f"  {'─' * 66}")

    for key, label in metrics:
        ep_vals = sorted(r[key] for r in epstein if r.get(key) is not None)
        bl_vals = sorted(r[key] for r in baseline if r.get(key) is not None)

        def stats_line(vals, glabel):
            if not vals:
                return f"    {glabel:<12} n=0"
            n = len(vals)
            median = vals[n // 2]
            mean = sum(vals) / n
            p25 = vals[n // 4] if n >= 4 else vals[0]
            p75 = vals[3 * n // 4] if n >= 4 else vals[-1]
            return (
                f"    {glabel:<12} n={n:<5} "
                f"median={median:>12,}  mean={mean:>14,.1f}  "
                f"P25={p25:>10,}  P75={p75:>10,}"
            )

        print(f"\n  {label}:")
        print(stats_line(ep_vals, "Epstein"))
        print(stats_line(bl_vals, "Baseline"))

    # Mann-Whitney U test
    try:
        from scipy.stats import mannwhitneyu
        has_scipy = True
    except ImportError:
        has_scipy = False

    if has_scipy:
        print(f"\n  {'─' * 66}")
        print(f"  MANN-WHITNEY U TEST (non-parametric, log-transformed)")
        print(f"  {'─' * 66}")

        for key, label in metrics:
            ep_vals = [math.log(max(r[key], 1)) for r in epstein if r.get(key) is not None]
            bl_vals = [math.log(max(r[key], 1)) for r in baseline if r.get(key) is not None]

            if len(ep_vals) < 5 or len(bl_vals) < 5:
                print(f"\n  {label}: Insufficient data (ep={len(ep_vals)}, bl={len(bl_vals)})")
                continue

            stat, pval = mannwhitneyu(ep_vals, bl_vals, alternative="two-sided")
            ep_median = sorted(ep_vals)[len(ep_vals) // 2]
            bl_median = sorted(bl_vals)[len(bl_vals) // 2]
            direction = "HIGHER" if ep_median > bl_median else "LOWER" if ep_median < bl_median else "EQUAL"
            sig = "***" if pval < 0.001 else "**" if pval < 0.01 else "*" if pval < 0.05 else "n.s."

            print(f"\n  {label}:")
            print(f"    Epstein log-median: {ep_median:.2f}  Baseline: {bl_median:.2f}  → Epstein {direction}")
            print(f"    U={stat:,.0f}  p={pval:.2e}  {sig}")
    else:
        print(f"\n  (Install scipy for Mann-Whitney U test: pip install scipy)")

    # Geometric mean fame score
    print(f"\n  {'─' * 66}")
    print(f"  GEOMETRIC MEAN FAME SCORE")
    print(f"  {'─' * 66}")

    for group, label in [(epstein, "Epstein"), (baseline, "Baseline")]:
        scores = []
        for r in group:
            s = compute_fame_score(r)
            if s is not None:
                scores.append(s)
        if not scores:
            print(f"\n  {label}: No scores computed")
            continue
        scores.sort()
        n = len(scores)
        median = scores[n // 2]
        mean = sum(scores) / n
        log_scores = [math.log(max(s, 1)) for s in scores]
        log_mean = sum(log_scores) / len(log_scores)
        geo_mean = math.exp(log_mean)
        p25 = scores[n // 4] if n >= 4 else scores[0]
        p75 = scores[3 * n // 4] if n >= 4 else scores[-1]
        print(
            f"\n  {label} (n={n}):"
            f"\n    Median: {median:>12,.1f}  Geo-Mean: {geo_mean:>12,.1f}"
            f"\n    P25:    {p25:>12,.1f}  P75:      {p75:>12,.1f}"
        )

    if has_scipy and epstein and baseline:
        ep_scores = [compute_fame_score(r) for r in epstein]
        bl_scores = [compute_fame_score(r) for r in baseline]
        ep_log = [math.log(max(s, 1)) for s in ep_scores if s is not None]
        bl_log = [math.log(max(s, 1)) for s in bl_scores if s is not None]
        if len(ep_log) >= 5 and len(bl_log) >= 5:
            stat, pval = mannwhitneyu(ep_log, bl_log, alternative="two-sided")
            sig = "***" if pval < 0.001 else "**" if pval < 0.01 else "*" if pval < 0.05 else "n.s."
            print(f"\n  Fame Score Mann-Whitney U: U={stat:,.0f}  p={pval:.2e}  {sig}")

    print("\n" + "=" * 70)


# ── Apply to DB ──────────────────────────────────────────────

def apply_to_db(records):
    """Upsert fame metrics to Supabase fame_metrics table."""
    sb = get_supabase()
    upserted = 0
    errors = 0

    for rec in records:
        name = rec.get("name", "").strip()
        if not name:
            continue

        fame_score = compute_fame_score(rec)

        row = {
            "homeowner_name": name,
            "group_label": rec.get("group", "baseline"),
            "feature_id": rec.get("feature_id"),
            "wikipedia_page": rec.get("wikipedia_page"),
            "wikipedia_edit_count": rec.get("wikipedia_edit_count"),
            "wikipedia_pageviews": rec.get("wikipedia_pageviews"),
            "google_search_results": rec.get("google_search_results"),
            "google_news_total": rec.get("google_news_total"),
            "google_news_visible": rec.get("google_news_visible"),
            "newsapi_article_count": rec.get("newsapi_article_count"),
            "nyt_article_count": rec.get("nyt_article_count"),
            "wikipedia_reference_count": rec.get("wikipedia_reference_count"),
            "fame_score": fame_score,
        }

        try:
            sb.table("fame_metrics").upsert(
                row, on_conflict="homeowner_name"
            ).execute()
            upserted += 1
        except Exception as e:
            print(f"  ERROR upserting {name}: {e}")
            errors += 1

    print(f"\n  Upserted {upserted} rows, {errors} errors")


# ── Main ─────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Measure fame/notoriety of AD homeowners"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview names + cost estimate")
    parser.add_argument("--wikipedia-only", action="store_true",
                        help="Phase 1 only (free)")
    parser.add_argument("--google-only", action="store_true",
                        help="Phase 2 only (SerpAPI)")
    parser.add_argument("--newsapi-only", action="store_true",
                        help="Phase 3 only (NewsAPI.ai)")
    parser.add_argument("--nyt-only", action="store_true",
                        help="Phase 4 only (NYT Article Search, free)")
    parser.add_argument("--wikirefs-only", action="store_true",
                        help="Phase 5 only (Wikipedia reference count, free)")
    parser.add_argument("--resume", action="store_true",
                        help="Skip already-collected names")
    parser.add_argument("--report", action="store_true",
                        help="Print stats + group comparison")
    parser.add_argument("--apply-db", action="store_true",
                        help="Upsert to Supabase fame_metrics table")
    parser.add_argument("--limit", type=int, default=None,
                        help="Limit total names (for testing)")
    args = parser.parse_args()

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Report mode: just load and print
    if args.report:
        existing = load_existing_results()
        if not existing:
            print("No results found in data/fame_metrics/")
            return
        print(f"Loaded {len(existing)} records from data/fame_metrics/")
        print_report(list(existing.values()))
        return

    # Apply-db mode: load and upsert
    if args.apply_db:
        existing = load_existing_results()
        if not existing:
            print("No results found in data/fame_metrics/")
            return
        print(f"Applying {len(existing)} records to Supabase...")
        apply_to_db(list(existing.values()))
        return

    # Fetch names from Supabase
    print("Connecting to Supabase...")
    sb = get_supabase()

    print("Fetching confirmed Epstein names...")
    epstein_names = get_confirmed_names(sb)
    print(f"  Found {len(epstein_names)} confirmed names")

    print("Fetching all baseline homeowner names...")
    baseline_names = get_all_baseline_candidates(sb)
    print(f"  Found {len(baseline_names)} baseline names")

    all_people = deduplicate_names(epstein_names + baseline_names)
    epstein_count = sum(1 for p in all_people if p.get("group") == "epstein")
    baseline_count = sum(1 for p in all_people if p.get("group") == "baseline")
    print(f"\n  Total unique names: {len(all_people)} "
          f"(Epstein: {epstein_count}, Baseline: {baseline_count})")

    if args.limit:
        all_people = all_people[:args.limit]
        print(f"  Limited to {len(all_people)} names")

    # Load existing for resume
    existing = {}
    if args.resume:
        existing = load_existing_results()
        print(f"  Loaded {len(existing)} existing records for resume")

    # Dry run
    if args.dry_run:
        # Count what would be collected
        wiki_todo = sum(
            1 for p in all_people
            if not should_skip_wikipedia(existing.get(p["name"].strip().lower(), {}))
        )
        google_todo = sum(
            1 for p in all_people
            if not should_skip_google(existing.get(p["name"].strip().lower(), {}))
        )
        google_queries = google_todo * 2
        google_cost = google_queries * SERPAPI_COST_PER_QUERY

        print(f"\n{'─' * 60}")
        print(f"  DRY RUN — Fame Measurement Pipeline")
        print(f"{'─' * 60}")
        print(f"  Total unique names:    {len(all_people)}")
        print(f"  Epstein orbit:         {epstein_count}")
        print(f"  AD baseline:           {baseline_count}")
        print(f"{'─' * 60}")
        print(f"  Wikipedia (Phase 1):   {wiki_todo} names to collect (free)")
        print(f"  Google (Phase 2):      {google_todo} names → {google_queries} SerpAPI queries")
        print(f"  Estimated SerpAPI cost: ${google_cost:.2f}")
        print(f"{'─' * 60}")

        # Show sample names
        print(f"\n  Sample Epstein names:")
        ep_sample = [p for p in all_people if p.get("group") == "epstein"][:10]
        for p in ep_sample:
            print(f"    {p['name']:<35} {p.get('category', '?')}")
        print(f"\n  Sample baseline names:")
        bl_sample = [p for p in all_people if p.get("group") == "baseline"][:10]
        for p in bl_sample:
            print(f"    {p['name']:<35} {p.get('category', '?')}")
        return

    # Determine which phases to run
    only_flags = (args.wikipedia_only or args.google_only or args.newsapi_only
                  or args.nyt_only or args.wikirefs_only)
    run_wiki = args.wikipedia_only or not only_flags
    run_google = args.google_only or not only_flags
    run_newsapi = args.newsapi_only or not only_flags
    run_nyt = args.nyt_only or not only_flags
    run_wikirefs = args.wikirefs_only or not only_flags

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(OUTPUT_DIR, f"fame_{timestamp}.jsonl")
    print(f"\n  Output: {output_file}")

    # Phase 1: Wikipedia
    if run_wiki:
        print(f"\n{'═' * 60}")
        print(f"  PHASE 1: WIKIPEDIA METRICS")
        print(f"{'═' * 60}")
        t0 = time.time()
        collected, skipped, errors = asyncio.run(
            run_wikipedia_phase(all_people, existing, output_file)
        )
        elapsed = time.time() - t0
        print(f"\n  Wikipedia phase complete: {collected} collected, "
              f"{skipped} skipped, {errors} errors ({elapsed:.0f}s)")

    # Phase 2: Google
    if run_google:
        print(f"\n{'═' * 60}")
        print(f"  PHASE 2: GOOGLE METRICS (SerpAPI)")
        print(f"{'═' * 60}")
        t0 = time.time()
        collected, skipped, errors = asyncio.run(
            run_google_phase(all_people, existing, output_file)
        )
        elapsed = time.time() - t0
        print(f"\n  Google phase complete: {collected} collected, "
              f"{skipped} skipped, {errors} errors ({elapsed:.0f}s)")

    # Phase 3: NewsAPI.ai
    if run_newsapi:
        print(f"\n{'═' * 60}")
        print(f"  PHASE 3: NEWS ARTICLES (NewsAPI.ai)")
        print(f"{'═' * 60}")
        t0 = time.time()
        collected, skipped, errors = asyncio.run(
            run_newsapi_phase(all_people, existing, output_file)
        )
        elapsed = time.time() - t0
        print(f"\n  NewsAPI phase complete: {collected} collected, "
              f"{skipped} skipped, {errors} errors ({elapsed:.0f}s)")

    # Phase 4: NYT Article Search
    if run_nyt:
        print(f"\n{'═' * 60}")
        print(f"  PHASE 4: NYT ARTICLE SEARCH (1851–present)")
        print(f"{'═' * 60}")
        t0 = time.time()
        collected, skipped, errors = asyncio.run(
            run_nyt_phase(all_people, existing, output_file)
        )
        elapsed = time.time() - t0
        print(f"\n  NYT phase complete: {collected} collected, "
              f"{skipped} skipped, {errors} errors ({elapsed:.0f}s)")

    # Phase 5: Wikipedia Reference Count
    if run_wikirefs:
        print(f"\n{'═' * 60}")
        print(f"  PHASE 5: WIKIPEDIA REFERENCE COUNT")
        print(f"{'═' * 60}")
        t0 = time.time()
        collected, skipped, errors = asyncio.run(
            run_wikirefs_phase(all_people, existing, output_file)
        )
        elapsed = time.time() - t0
        print(f"\n  Wiki refs phase complete: {collected} collected, "
              f"{skipped} skipped, {errors} errors ({elapsed:.0f}s)")

    # Print summary
    existing = load_existing_results()
    if existing:
        print(f"\n  Total records in data/fame_metrics/: {len(existing)}")
        print_report(list(existing.values()))


if __name__ == "__main__":
    main()
