"""Inter-agent bulletin board — shared message board for peer communication.

Agents can post notes visible to all other agents. No Editor routing needed.
Used for tips, warnings, and discoveries that any agent might benefit from.

Usage:
    from agents.bulletin import bulletin

    # Post a note
    bulletin.post("scout", "archive.org rate limits are strict today — slow down")

    # Read recent notes (optionally filter by tag)
    notes = bulletin.read(n=5, tag="warning")

    # Read notes from a specific agent
    notes = bulletin.read(n=5, from_agent="detective")
"""

import json
import os
import threading
import time

_bulletin_instance = None
_init_lock = threading.Lock()

BULLETIN_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "bulletin_board.json"
)
MAX_NOTES = 200  # Keep last 200 notes


class BulletinBoard:
    """Thread-safe shared message board for inter-agent communication.

    Notes are stored as a JSON array on disk. Each note has:
    - agent: who posted it
    - text: the message
    - tag: optional category (tip, warning, discovery, question)
    - timestamp: when it was posted
    """

    def __init__(self, path=None):
        self._path = path or os.path.abspath(BULLETIN_PATH)
        self._lock = threading.Lock()
        os.makedirs(os.path.dirname(self._path), exist_ok=True)

    def post(self, agent: str, text: str, tag: str = "tip"):
        """Post a note to the bulletin board.

        Args:
            agent: Name of the posting agent.
            text: The message to share.
            tag: Category — "tip", "warning", "discovery", "question".
        """
        note = {
            "agent": agent,
            "text": text,
            "tag": tag,
            "timestamp": int(time.time()),
        }
        with self._lock:
            notes = self._load()
            notes.append(note)
            if len(notes) > MAX_NOTES:
                notes = notes[-MAX_NOTES:]
            self._save(notes)

    def read(self, n: int = 10, from_agent: str = None, tag: str = None,
             exclude_agent: str = None) -> list[dict]:
        """Read recent notes from the bulletin board.

        Args:
            n: Max notes to return.
            from_agent: Only notes from this agent.
            tag: Only notes with this tag.
            exclude_agent: Skip notes from this agent (avoid reading own notes).

        Returns:
            List of note dicts, newest first.
        """
        with self._lock:
            notes = self._load()

        # Filter
        filtered = []
        for note in reversed(notes):
            if from_agent and note.get("agent") != from_agent:
                continue
            if tag and note.get("tag") != tag:
                continue
            if exclude_agent and note.get("agent") == exclude_agent:
                continue
            filtered.append(note)
            if len(filtered) >= n:
                break

        return filtered

    def count(self) -> int:
        """Total notes on the board."""
        with self._lock:
            return len(self._load())

    def _load(self) -> list:
        if not os.path.exists(self._path):
            return []
        try:
            with open(self._path) as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
        except (json.JSONDecodeError, OSError):
            return []

    def _save(self, notes: list):
        try:
            with open(self._path, "w") as f:
                json.dump(notes, f, separators=(",", ":"))
        except OSError:
            pass


def get_bulletin() -> BulletinBoard:
    """Get the singleton BulletinBoard instance."""
    global _bulletin_instance
    with _init_lock:
        if _bulletin_instance is None:
            _bulletin_instance = BulletinBoard()
    return _bulletin_instance


# Convenience alias
bulletin = None


def _ensure_bulletin():
    global bulletin
    if bulletin is None:
        bulletin = get_bulletin()
    return bulletin
