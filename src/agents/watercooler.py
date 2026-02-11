"""Watercooler conversations — agents chat with each other in character.

Periodically picks two agents, generates a short back-and-forth exchange
using a single Haiku call, and stores it for the dashboard to animate
as sequential speech bubbles.

Cost: ~$0.001 per conversation.
"""

import json
import os
import random
import time

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
WATERCOOLER_PATH = os.path.join(DATA_DIR, "watercooler.json")
SKILLS_DIR = os.path.join(os.path.dirname(__file__), "skills")

# Agent pairs and their relationship dynamics (from persona files)
AGENT_INFO = {
    "scout": {"name": "Arthur", "role": "Scout", "vibe": "enthusiastic, eager to please"},
    "courier": {"name": "Casey", "role": "Courier", "vibe": "approachable, practical, steady"},
    "reader": {"name": "Elias", "role": "Reader", "vibe": "intense, driven, desperate for approval"},
    "detective": {"name": "Silas", "role": "Detective", "vibe": "sardonic, opaque, professionally cool"},
    "researcher": {"name": "Elena", "role": "Researcher", "vibe": "relentless, precise, quietly fierce"},
    "editor": {"name": "Miranda", "role": "Editor", "vibe": "terrifying, clipped, deadpan sarcasm"},
    "designer": {"name": "Sable", "role": "Designer", "vibe": "creative, aesthetic, detail-oriented"},
}

# Interesting pairings with built-in tension/chemistry
GOOD_PAIRINGS = [
    ("detective", "researcher"),   # Silas & Elena — adversarial respect, case handoffs
    ("reader", "detective"),       # Elias & Silas — intensity meets cool detachment
    ("scout", "courier"),          # Arthur & Casey — enthusiasm meets pragmatism
    ("reader", "editor"),          # Elias & Miranda — desperate student & demanding mentor
    ("detective", "courier"),      # Silas & Casey — sardonic meets steady
    ("researcher", "editor"),      # Elena & Miranda — kill, not questions
    ("scout", "detective"),        # Arthur & Silas — mild contempt for enthusiasm
    ("reader", "courier"),         # Elias & Casey — drama meets calm
    ("researcher", "detective"),   # Elena & Silas — professional handoff dynamic
    ("scout", "reader"),           # Arthur & Elias — two different kinds of intensity
]


def _load_personality(agent_id):
    """Load personality snippet from skills file."""
    path = os.path.join(SKILLS_DIR, f"{agent_id}.md")
    if not os.path.exists(path):
        return ""
    try:
        with open(path) as f:
            text = f.read()
        # Extract personality section (first 500 chars after ## Personality or ## Voice)
        for marker in ["## Personality", "## Voice", "## Character"]:
            idx = text.find(marker)
            if idx != -1:
                snippet = text[idx:idx + 500]
                return snippet
        # Fallback: first 400 chars
        return text[:400]
    except Exception:
        return ""


def _get_pipeline_context():
    """Get brief pipeline context for conversation grounding."""
    try:
        from agents.bulletin import get_bulletin
        board = get_bulletin()
        recent = board.read(n=3)
        if recent:
            return "Recent activity: " + "; ".join(
                f"{n['agent']}: {n['text'][:60]}" for n in recent
            )
    except Exception:
        pass
    return "The pipeline is running. Agents are at their desks."


def generate_conversation(agent_a=None, agent_b=None):
    """Generate a watercooler conversation between two agents.

    Returns dict with conversation data, or None on failure.
    """
    # Pick agents if not specified
    if not agent_a or not agent_b:
        pair = random.choice(GOOD_PAIRINGS)
        agent_a, agent_b = pair

    info_a = AGENT_INFO.get(agent_a, {"name": agent_a.title(), "role": agent_a, "vibe": ""})
    info_b = AGENT_INFO.get(agent_b, {"name": agent_b.title(), "role": agent_b, "vibe": ""})

    personality_a = _load_personality(agent_a)
    personality_b = _load_personality(agent_b)

    context = _get_pipeline_context()

    try:
        import anthropic
        client = anthropic.Anthropic()
        model_id = "claude-haiku-4-5-20251001"

        response = client.messages.create(
            model=model_id,
            max_tokens=300,
            system=(
                "You write short, naturalistic watercooler conversations between AI agents in a newsroom-style research office. "
                "Each agent has a distinct personality. The conversations should feel real — casual, in-character, "
                "sometimes tense, sometimes funny, always brief. Like overhearing two colleagues at the coffee machine.\n\n"
                f"AGENT 1: {info_a['name']} (the {info_a['role']})\n"
                f"Personality: {info_a['vibe']}\n"
                f"Details: {personality_a[:300]}\n\n"
                f"AGENT 2: {info_b['name']} (the {info_b['role']})\n"
                f"Personality: {info_b['vibe']}\n"
                f"Details: {personality_b[:300]}\n\n"
                "RULES:\n"
                "- Write exactly 3-4 lines of dialogue (alternating speakers, Agent 1 starts)\n"
                "- Each line is 1 sentence max. Short. Natural.\n"
                "- No emoji. No stage directions. Just dialogue.\n"
                "- They might discuss work, complain, joke, needle each other, share a quiet moment\n"
                "- Stay in character. Their relationship dynamics matter.\n"
                "- Return ONLY a JSON array: [{\"speaker\": \"name\", \"text\": \"line\"}]\n"
            ),
            messages=[{"role": "user", "content": f"Pipeline context: {context}\n\nWrite their conversation."}],
        )

        raw = response.content[0].text.strip()
        # Parse JSON from response (handle markdown code blocks)
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        lines = json.loads(raw)

        if not isinstance(lines, list) or len(lines) < 2:
            return None

        now = time.time()
        conversation = {
            "agent_a": agent_a,
            "agent_b": agent_b,
            "name_a": info_a["name"],
            "name_b": info_b["name"],
            "lines": [
                {"speaker_id": agent_a if ln.get("speaker") == info_a["name"] else agent_b,
                 "speaker": ln.get("speaker", "?"),
                 "text": ln.get("text", "")}
                for ln in lines[:4]
            ],
            "timestamp": now,
            "display_until": now + 45,  # Show for 45 seconds
        }

        # Save to disk
        _save_conversation(conversation)
        return conversation

    except Exception:
        return None


def _save_conversation(conversation):
    """Save current conversation + keep recent history."""
    history = []
    if os.path.exists(WATERCOOLER_PATH):
        try:
            with open(WATERCOOLER_PATH) as f:
                data = json.load(f)
            history = data.get("history", [])
        except Exception:
            pass

    # Keep last 20 conversations
    history.append(conversation)
    if len(history) > 20:
        history = history[-20:]

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(WATERCOOLER_PATH, "w") as f:
        json.dump({
            "current": conversation,
            "history": history,
        }, f)


def get_current_conversation():
    """Read current conversation if it's still active (within display_until)."""
    if not os.path.exists(WATERCOOLER_PATH):
        return None
    try:
        with open(WATERCOOLER_PATH) as f:
            data = json.load(f)
        current = data.get("current")
        if current and time.time() < current.get("display_until", 0):
            return current
        return None
    except Exception:
        return None


def get_recent_conversations(n=5):
    """Get recent conversation history."""
    if not os.path.exists(WATERCOOLER_PATH):
        return []
    try:
        with open(WATERCOOLER_PATH) as f:
            data = json.load(f)
        return data.get("history", [])[-n:]
    except Exception:
        return []
