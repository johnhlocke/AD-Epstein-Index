"""
DOJ Search Worker — subprocess that runs Playwright in its own event loop.

Accepts a JSON list of names on stdin, searches DOJ for each,
and writes JSON results to stdout. Designed to be called by the
Detective agent via asyncio.create_subprocess_exec().

This isolates Playwright's CDP communication from the orchestrator's
busy event loop, preventing timeout failures caused by event loop
contention.

Usage:
    echo '["Mathilde Favier-Meyer", "Nate Berkus"]' | python3 src/doj_search_worker.py
"""

import asyncio
import json
import os
import sys
import time

# Ensure src/ is on the path
sys.path.insert(0, os.path.dirname(__file__))


async def run_searches(names: list[str]) -> list[dict]:
    """Search DOJ for each name, return list of results."""
    from doj_search import DOJSearchClient

    client = DOJSearchClient()
    results = []

    try:
        await client.start()
        print(json.dumps({"status": "browser_ready"}), file=sys.stderr, flush=True)

        for name in names:
            t0 = time.time()
            try:
                result = await client.search_name_variations(name)
                elapsed = time.time() - t0
                print(
                    json.dumps({"status": "searched", "name": name, "elapsed": round(elapsed, 1),
                                "success": result.get("search_successful", False),
                                "total": result.get("total_results", 0)}),
                    file=sys.stderr, flush=True,
                )
                results.append({"name": name, "result": result})
            except Exception as e:
                elapsed = time.time() - t0
                print(
                    json.dumps({"status": "error", "name": name, "elapsed": round(elapsed, 1),
                                "error": str(e)[:200]}),
                    file=sys.stderr, flush=True,
                )
                results.append({
                    "name": name,
                    "result": {
                        "name_searched": name,
                        "total_results": 0,
                        "confidence": "none",
                        "confidence_rationale": f"Worker error: {str(e)[:200]}",
                        "top_results": [],
                        "variations_searched": [name],
                        "searched_at": "",
                        "search_successful": False,
                        "error": str(e)[:200],
                    },
                })

            await asyncio.sleep(1)  # Rate limiting between names

    except Exception as e:
        print(json.dumps({"status": "fatal", "error": str(e)[:200]}), file=sys.stderr, flush=True)
    finally:
        await client.stop()

    return results


def main():
    # Read names from stdin
    try:
        raw = sys.stdin.read()
        names = json.loads(raw)
        if not isinstance(names, list):
            names = [names]
    except Exception as e:
        print(json.dumps({"error": f"Invalid input: {e}"}))
        sys.exit(1)

    if not names:
        print(json.dumps([]))
        sys.exit(0)

    # Run in a clean event loop
    results = asyncio.run(run_searches(names))

    # Write results to stdout as JSON
    print(json.dumps(results))


if __name__ == "__main__":
    main()
