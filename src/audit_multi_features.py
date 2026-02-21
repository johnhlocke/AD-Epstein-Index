#!/usr/bin/env python3
"""Opus audit: for each confirmed person with multiple features,
verify who is the homeowner vs designer in each article."""

import os, json, base64, requests, time
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from db import get_supabase

API_KEY = os.environ["ANTHROPIC_API_KEY"]
sb = get_supabase()

# All orphaned features from multi-feature confirmed people (excluding Bradfield, already audited)
# Format: (feature_id, confirmed_person_name)
AUDIT_TARGETS = [
    # Karin Blake — 6 features, 1 dossier
    (5658, "Karin Blake"), (8090, "Karin Blake"), (7789, "Karin Blake"),
    (7705, "Karin Blake"), (7851, "Karin Blake"),
    # Candice Bergen — 5 features, 1 dossier
    (6641, "Candice Bergen"), (5679, "Candice Bergen"),
    (7294, "Candice Bergen"), (7940, "Candice Bergen"),
    # Sara Story — 4 features, 1 dossier
    (6308, "Sara Story"), (6527, "Sara Story"), (9638, "Sara Story"),
    # Aerin Lauder — 3 features
    (9639, "Aerin Lauder"), (9599, "Aerin Lauder"),
    # Alexa Hampton — 3 features
    (5226, "Alexa Hampton"), (5377, "Alexa Hampton"),
    # Carlos Mota — 3 features
    (6980, "Carlos Mota"), (6265, "Carlos Mota"),
    # Charles S. Cohen — 3 features
    (5852, "Charles S. Cohen"), (6020, "Charles S. Cohen"),
    # Clive Davis — 3 features
    (8229, "Clive Davis"), (4976, "Clive Davis"),
    # Malcolm Forbes — 3 features
    (7366, "Malcolm Forbes"), (7298, "Malcolm Forbes"),
    # Michael Jackson — 3 features (same issue — likely duplicates)
    (9121, "Michael Jackson"), (9118, "Michael Jackson"),
    # Pierre Yovanovitch — 3 features
    (6626, "Pierre Yovanovitch"), (8987, "Pierre Yovanovitch"),
    # Steve Wynn — 3 features
    (6016, "Steve Wynn"), (9081, "Steve Wynn"),
    # Tommy and Dee Hilfiger — 1 orphan
    (9417, "Tommy and Dee Hilfiger"),
    # 2-feature people — 1 orphan each
    (7803, "Alberto Pinto"),
    (9394, "Amanda Brooks"),
    (4130, "Barbara Goldsmith"),
    (4825, "Carolyne Roehm"),
    (7557, "David Copperfield"),  # Known: Mr. Peggotty = Dickens character
    (6137, "George Stephanopoulos"),
    (5981, "Jackie Rogers"),
    (8599, "Joan Rivers"),
    (8550, "Joy and Regis Philbin"),
    (7887, "Linda Garland"),
    (4807, "Mica Ertegun"),
    (8427, "Michael Feinstein"),
    (9313, "Muriel Brandolini"),
    (8269, "Neil Hirsch"),  # Note: dossier is on 8269, orphan would be other
    (7791, "Oliver Stone"),
    (8122, "Penny Drue Baird"),
    (8054, "Sharon Stone"),
    (6740, "Tom Scheerer"),
    (7830, "William I. Koch"),
]

# Fix: Neil Hirsch dossier is on 8269, so the orphan is the other one
# Actually let me just check — the orphan list from the query had these as orphaned
# Keep as-is, the audit will clarify

results = []
total_cost = 0

for fid, person in AUDIT_TARGETS:
    f = sb.table("features").select(
        "id, issue_id, article_title, homeowner_name, designer_name"
    ).eq("id", fid).execute().data
    if not f:
        print(f"\n#{fid}: FEATURE NOT FOUND (deleted?)")
        continue
    f = f[0]
    iss = sb.table("issues").select("month, year").eq("id", f["issue_id"]).execute().data[0]

    # Get first 3 images
    imgs = sb.table("feature_images").select("public_url, page_number").eq(
        "feature_id", fid
    ).order("page_number").limit(3).execute()

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
                content.append({
                    "type": "image",
                    "source": {"type": "base64", "media_type": media_type, "data": b64},
                })
        except Exception:
            pass

    if not content:
        print(f"\n#{fid}: NO IMAGES available")
        continue

    content.append({"type": "text", "text": f"""This is from Architectural Digest {iss['year']}-{str(iss['month']).zfill(2)}.
Article title: "{f['article_title']}"
Currently listed as: homeowner="{f['homeowner_name']}", designer="{f['designer_name']}"
This person is flagged as possibly: {person}

Look at these article pages and tell me:
1. Who is the HOMEOWNER (the person who lives in/owns this home)?
2. Who is the DESIGNER/DECORATOR (the professional who designed it)?
3. Is this {person}'s OWN home, or someone else's home?
4. If {person} is a designer, is this their client's home?

Be specific — read captions, bylines, and article text. Respond as JSON:
{{"homeowner": "Name or Anonymous if not named", "designer": "Name or null", "is_persons_own_home": true/false, "explanation": "brief reason"}}"""})

    print(f"\n{'='*60}")
    print(f"#{fid}: \"{f['article_title']}\" — AD {iss['year']}-{str(iss['month']).zfill(2)} [{person}]")
    print(f"  Current: homeowner={f['homeowner_name']}, designer={f['designer_name']}")
    print(f"  Sending {len(content)-1} images to Opus...")

    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": "claude-opus-4-6",
            "max_tokens": 300,
            "messages": [{"role": "user", "content": content}],
        },
    )

    result = resp.json()
    text = result.get("content", [{}])[0].get("text", "ERROR")
    usage = result.get("usage", {})
    cost = (usage.get("input_tokens", 0) / 1e6) * 15 + (usage.get("output_tokens", 0) / 1e6) * 75
    total_cost += cost
    print(f"  ${cost:.3f} | {text}")

    results.append({
        "feature_id": fid,
        "person": person,
        "issue": f"AD {iss['year']}-{str(iss['month']).zfill(2)}",
        "article_title": f["article_title"],
        "current_homeowner": f["homeowner_name"],
        "current_designer": f["designer_name"],
        "opus_response": text,
        "cost": cost,
    })

    time.sleep(0.5)

# Save results
outpath = os.path.join(os.path.dirname(__file__), "..", "data", "multi_feature_audit.json")
os.makedirs(os.path.dirname(outpath), exist_ok=True)
with open(outpath, "w") as fp:
    json.dump(results, fp, indent=2)

print(f"\n{'='*60}")
print(f"DONE: {len(results)} features audited, ${total_cost:.2f} total")
print(f"Results saved to {outpath}")
