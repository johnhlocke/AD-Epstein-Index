#!/usr/bin/env python3
"""Quick Opus audit: who is the homeowner vs designer for Geoffrey Bradfield features?"""

import os, json, base64, requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from db import get_supabase

API_KEY = os.environ["ANTHROPIC_API_KEY"]
sb = get_supabase()

fids = [5749, 5347, 5087, 5516, 8493, 5803, 7522]

for fid in fids:
    f = sb.table("features").select("id, issue_id, article_title, homeowner_name, designer_name").eq("id", fid).execute().data[0]
    iss = sb.table("issues").select("month, year").eq("id", f["issue_id"]).execute().data[0]

    # Get first 3 images
    imgs = sb.table("feature_images").select("public_url, page_number").eq("feature_id", fid).order("page_number").limit(3).execute()

    content = []
    for img in imgs.data:
        url = img["public_url"]
        if not url:
            continue
        try:
            resp = requests.get(url, timeout=15)
            if resp.status_code == 200:
                b64 = base64.standard_b64encode(resp.content).decode()
                media_type = "image/jpeg" if url.endswith(".jpg") else "image/png"
                content.append({"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}})
        except Exception:
            pass

    content.append({"type": "text", "text": f"""This is from Architectural Digest {iss['year']}-{str(iss['month']).zfill(2)}.
Article title: "{f['article_title']}"

Look at these article pages and tell me:
1. Who is the HOMEOWNER (the person who lives in this home)?
2. Who is the DESIGNER/DECORATOR (the professional who designed it)?
3. Is this Geoffrey Bradfield's OWN home, or a CLIENT's home that Bradfield designed?

Be specific — read captions, bylines, and article text. Respond as JSON:
{{"homeowner": "Name", "designer": "Name", "bradfield_own_home": true/false, "explanation": "brief reason"}}"""})

    print(f"\n{'='*60}")
    print(f"#{fid}: \"{f['article_title']}\" — AD {iss['year']}-{str(iss['month']).zfill(2)}")
    print(f"  Sending {len(content)-1} images to Opus...")

    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
        json={"model": "claude-opus-4-6", "max_tokens": 300, "messages": [{"role": "user", "content": content}]},
    )

    result = resp.json()
    text = result.get("content", [{}])[0].get("text", "ERROR")
    usage = result.get("usage", {})
    cost = (usage.get("input_tokens", 0) / 1e6) * 15 + (usage.get("output_tokens", 0) / 1e6) * 75
    print(f"  ${cost:.3f} | {text}")

print("\nDone.")
