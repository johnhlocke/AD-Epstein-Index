"""
Task infrastructure for the hub-and-spoke agent system.

The Editor assigns Tasks to agents via their inbox queues.
Agents return TaskResults via their outbox queues.
The EditorLedger tracks all task attempts for retry logic and debugging.
"""

import json
import os
import uuid
from collections import deque
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
LEDGER_PATH = os.path.join(DATA_DIR, "editor_ledger.json")


@dataclass
class Task:
    """A unit of work assigned by the Editor to an agent."""
    type: str               # "discover_issues", "download_pdf", "extract_features", etc.
    goal: str               # Human-readable: "Find AD issues for Jan-Mar 2015"
    params: dict            # Everything the agent needs
    priority: int = 2       # 0=critical, 1=high, 2=normal, 3=low
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    briefing: str = ""      # Pre-execution context from memory + bulletin board

    def to_dict(self):
        return asdict(self)


@dataclass
class TaskResult:
    """Result returned by an agent after executing a Task."""
    task_id: str
    task_type: str
    status: str             # "success" or "failure"
    result: dict            # Agent-specific structured data
    error: Optional[str] = None  # Why it failed
    agent: str = ""         # Which agent produced this

    def to_dict(self):
        return asdict(self)


class EditorLedger:
    """Centralized log of every task attempt — replaces scattered per-agent JSON files.

    Tracks:
    - All task attempts (success/failure) keyed by identifier/name
    - Failure counts for retry eligibility
    - Timestamps for cooldown logic
    """

    def __init__(self, path=None):
        self.path = path or LEDGER_PATH
        self._data = self._load()

    def _load(self):
        """Load ledger from disk."""
        if os.path.exists(self.path):
            try:
                with open(self.path) as f:
                    return json.load(f)
            except (json.JSONDecodeError, OSError):
                pass
        return {}

    def save(self):
        """Persist ledger to disk."""
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        with open(self.path, "w") as f:
            json.dump(self._data, f, indent=2)

    def record(self, key, agent, task_type, success, note="", error=""):
        """Record a task attempt for a given key (identifier, name, etc.)."""
        entries = self._data.setdefault(key, [])
        entries.append({
            "agent": agent,
            "task": task_type,
            "success": success,
            "note": note,
            "error": error[:200] if error else "",
            "time": datetime.now().isoformat(),
        })
        # Keep last 20 entries per key to prevent unbounded growth
        if len(entries) > 20:
            self._data[key] = entries[-20:]

    def failure_count(self, key, task_type=None):
        """Count failures for a key, optionally filtered by task type."""
        entries = self._data.get(key, [])
        return sum(
            1 for e in entries
            if not e["success"]
            and (task_type is None or e["task"] == task_type)
        )

    def attempt_count(self, key, task_type=None):
        """Count total attempts (successes + failures) for a key."""
        entries = self._data.get(key, [])
        if task_type:
            entries = [e for e in entries if e["task"] == task_type]
        return len(entries)

    def last_attempt_time(self, key, task_type=None):
        """Return the ISO timestamp of the last attempt, or None."""
        entries = self._data.get(key, [])
        if task_type:
            entries = [e for e in entries if e["task"] == task_type]
        if entries:
            return entries[-1].get("time")
        return None

    def should_retry(self, key, task_type=None, max_failures=3):
        """Check if a key is eligible for retry (hasn't exceeded max failures)."""
        return self.failure_count(key, task_type) < max_failures

    def get_entries(self, key):
        """Get all ledger entries for a key."""
        return self._data.get(key, [])

    def get_context_for_agent(self, key):
        """Build a brief context string about previous failures for an agent."""
        entries = self._data.get(key, [])
        failures = [e for e in entries if not e["success"]]
        if not failures:
            return ""
        lines = []
        for f in failures[-3:]:  # Last 3 failures
            lines.append(f"  - {f['agent']}/{f['task']}: {f.get('error') or f.get('note', 'unknown')}")
        return f"Previous failures ({len(failures)} total):\n" + "\n".join(lines)


@dataclass
class PlannedTask:
    """A task sitting in an agent's ready queue, waiting for dispatch."""
    task: Task
    agent: str
    created_at: float = field(default_factory=lambda: __import__('time').time())
    source: str = "plan"  # "plan" or "cascade"


class ExecutionPlan:
    """Per-agent ready queues. NOT a dependency DAG.

    Dependencies are implicit in Supabase status:
    - Courier queue: issues with status="discovered"
    - Reader queue: issues with status="downloaded"

    The 30s cycle refreshes queues. Between cycles, agents draw
    from their queue immediately after finishing a task.
    """

    def __init__(self):
        self._queues: dict[str, deque] = {}

    def enqueue(self, agent, task, source="plan"):
        """Add a task to an agent's ready queue. Deduplicates by task key."""
        if agent not in self._queues:
            self._queues[agent] = deque()
        key = self._task_key(task)
        for pt in self._queues[agent]:
            if self._task_key(pt.task) == key:
                return
        self._queues[agent].append(PlannedTask(task=task, agent=agent, source=source))

    def next_for(self, agent):
        """Pop and return the next ready task, or None."""
        q = self._queues.get(agent)
        if not q:
            return None
        return q.popleft().task

    def queue_depth(self, agent):
        return len(self._queues.get(agent, []))

    def clear_agent(self, agent):
        self._queues[agent] = deque()

    def summary(self):
        return {a: len(q) for a, q in self._queues.items() if q}

    def _task_key(self, task):
        p = task.params
        # cross_reference tasks carry a "names" list, not "identifier" or "name".
        # Use a sorted hash of names to deduplicate correctly (different batches
        # should have different keys, same batch should dedup).
        if task.type == "cross_reference" and "names" in p:
            names_key = ",".join(sorted(p["names"][:5]))  # First 5 names as key
            return f"{task.type}:{names_key}"
        ident = p.get("identifier") or p.get("name") or str(p.get("missing_months", ""))
        return f"{task.type}:{ident}"
