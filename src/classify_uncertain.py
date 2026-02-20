#!/usr/bin/env python3
"""
Classify uncertain features as HOME_TOUR or NOT_HOME_TOUR using Haiku Vision.

Downloads the first page image and asks Haiku to classify the article type.
"""

import os
import sys
import json
import base64
import time
import anthropic
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

CLASSIFY_PROMPT = """Look at this magazine page from Architectural Digest. I need you to classify this article into one of two categories:

**HOME_TOUR**: An article that is primarily about a specific person's home, apartment, or residence. The article tours or showcases the interior/exterior of a private home. This includes:
- Celebrity home tours
- Designer's own home
- "AD Visits" style home features
- Renovation/restoration of a specific person's residence
- Historical homes shown as someone lived in them

**NOT_HOME_TOUR**: Anything else, including:
- Travel guides or regional roundups (about a town, region, or area — NOT a specific home)
- Department columns (TRAVELS, CULTURE, DISCOVERIES, FOR COLLECTORS, AD at LARGE)
- Profiles of designers, firms, or artisans (about their WORK, not their home)
- Product roundups or shopping guides
- Museum/gallery/hotel features (not private residences)
- Architecture criticism or essays about buildings (not personal homes)
- Gardening/landscape firm profiles
- Historical essays about art movements or periods
- Book reviews or personality profiles

IMPORTANT: If the article MENTIONS a famous person but is really about a place, firm, region, or topic — it's NOT_HOME_TOUR. The test is: does this article primarily show us inside someone's private residence?

Respond with EXACTLY this JSON format:
{"classification": "HOME_TOUR" or "NOT_HOME_TOUR", "section_header": "the section/department header if visible (e.g. TRAVELS, CULTURE, DISCOVERIES) or null", "reason": "brief 5-10 word reason"}"""


def get_first_image(feature_id: int) -> bytes | None:
    """Download first page image for a feature."""
    imgs = (
        sb.table("feature_images")
        .select("storage_path")
        .eq("feature_id", feature_id)
        .order("page_number")
        .limit(1)
        .execute()
    )
    if not imgs.data:
        return None

    path = imgs.data[0]["storage_path"]
    for bucket in ["feature-images", "dossier-images"]:
        try:
            return sb.storage.from_(bucket).download(path)
        except Exception:
            continue
    return None


def classify_image(image_data: bytes) -> dict:
    """Send image to Haiku Vision for classification."""
    b64 = base64.b64encode(image_data).decode("utf-8")

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": b64,
                        },
                    },
                    {"type": "text", "text": CLASSIFY_PROMPT},
                ],
            }
        ],
    )

    text = response.content[0].text.strip()
    # Parse JSON from response
    try:
        # Find JSON in response
        start = text.index("{")
        end = text.rindex("}") + 1
        return json.loads(text[start:end])
    except (ValueError, json.JSONDecodeError):
        return {
            "classification": "UNKNOWN",
            "section_header": None,
            "reason": f"Parse error: {text[:100]}",
        }


def main():
    # Load remaining uncertain features
    with open("data/unmatched_uncertain.json") as f:
        all_uncertain = json.load(f)

    already_handled = {4384, 7234, 6602, 6690, 5407}
    features = [f for f in all_uncertain if f["id"] not in already_handled]

    print(f"Classifying {len(features)} uncertain features with Haiku Vision...")
    print()

    results = []
    home_tours = []
    not_home_tours = []
    errors = []

    for i, feat in enumerate(features):
        fid = feat["id"]
        title = feat["title"]
        owner = feat["owner"]
        issue = feat["issue"]

        # Download first page
        img = get_first_image(fid)
        if not img:
            print(f"  [{i+1}/{len(features)}] #{fid} — NO IMAGE, skipping")
            errors.append({**feat, "error": "no_image"})
            continue

        # Classify
        try:
            result = classify_image(img)
        except Exception as e:
            print(f"  [{i+1}/{len(features)}] #{fid} — API ERROR: {e}")
            errors.append({**feat, "error": str(e)})
            time.sleep(2)
            continue

        classification = result.get("classification", "UNKNOWN")
        section = result.get("section_header")
        reason = result.get("reason", "")

        entry = {
            **feat,
            "classification": classification,
            "section_header": section,
            "reason_llm": reason,
        }
        results.append(entry)

        if classification == "HOME_TOUR":
            home_tours.append(entry)
            marker = "KEEP"
        else:
            not_home_tours.append(entry)
            marker = "DEL "

        section_str = f" [{section}]" if section else ""
        print(
            f"  [{i+1}/{len(features)}] {marker} #{fid} \"{title}\" ({owner}, {issue}){section_str} — {reason}"
        )

        # Rate limit: ~1 req/sec is fine for Haiku
        if (i + 1) % 50 == 0:
            time.sleep(2)

    # Save results
    with open("data/uncertain_classified.json", "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    with open("data/uncertain_keep.json", "w") as f:
        json.dump(home_tours, f, indent=2, ensure_ascii=False)

    with open("data/uncertain_delete.json", "w") as f:
        json.dump(not_home_tours, f, indent=2, ensure_ascii=False)

    print()
    print(f"=== RESULTS ===")
    print(f"  HOME_TOUR (keep):     {len(home_tours)}")
    print(f"  NOT_HOME_TOUR (del):  {len(not_home_tours)}")
    print(f"  Errors:               {len(errors)}")
    print()
    print(f"Saved to:")
    print(f"  data/uncertain_classified.json (all {len(results)} results)")
    print(f"  data/uncertain_keep.json ({len(home_tours)} to keep)")
    print(f"  data/uncertain_delete.json ({len(not_home_tours)} to delete)")


if __name__ == "__main__":
    main()
