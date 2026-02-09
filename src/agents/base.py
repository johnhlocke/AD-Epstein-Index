"""
Base Agent class — foundation for all pipeline agents.

Provides:
- Async run loop with configurable interval
- Hub-and-spoke task system: inbox (from Editor) → execute → outbox (to Editor)
- Pause/resume via asyncio.Event
- Graceful shutdown
- Activity logging (pipe-delimited file)
- Skills file loading (markdown instructions)
- Dashboard status reporting
- JSON file locking utilities (fcntl-based file locking)
"""

import asyncio
import fcntl
import json
import os
import time as _time
from abc import ABC, abstractmethod
from datetime import datetime

BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "..")
DATA_DIR = os.path.join(BASE_DIR, "data")
SKILLS_DIR = os.path.join(os.path.dirname(__file__), "skills")
LOG_PATH = os.path.join(DATA_DIR, "agent_activity.log")

# ── JSON File Locking Utilities ──────────────────────────────

def update_json_locked(json_path, update_fn, default=None):
    """Atomically read-modify-write a JSON file with file locking.

    Same pattern as update_manifest_locked but for arbitrary JSON files.
    Acquires exclusive lock, reads current data, calls update_fn(data),
    writes back. Prevents race conditions between agents.

    Args:
        json_path: Path to the JSON file.
        update_fn: Receives current data, modifies in place (or returns new data).
        default: Default value if file doesn't exist (default: empty list).
    """
    if default is None:
        default = []
    lock_path = json_path + ".lock"
    os.makedirs(os.path.dirname(lock_path) or ".", exist_ok=True)

    lock_fd = open(lock_path, "w")
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)

        # Read current data under lock
        if os.path.exists(json_path):
            try:
                with open(json_path) as f:
                    data = json.load(f)
            except (json.JSONDecodeError, OSError):
                data = default() if callable(default) else (
                    default.copy() if isinstance(default, (list, dict)) else default
                )
        else:
            data = default() if callable(default) else (
                default.copy() if isinstance(default, (list, dict)) else default
            )

        # Apply changes — update_fn can modify in place or return new data
        result = update_fn(data)
        if result is not None:
            data = result

        # Write back
        with open(json_path, "w") as f:
            json.dump(data, f, indent=2)
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        lock_fd.close()


def read_json_locked(json_path, default=None):
    """Read a JSON file with shared (read) lock to prevent torn reads.

    Args:
        json_path: Path to the JSON file.
        default: Default value if file doesn't exist (default: empty list).
    """
    if default is None:
        default = []
    lock_path = json_path + ".lock"
    os.makedirs(os.path.dirname(lock_path) or ".", exist_ok=True)

    lock_fd = open(lock_path, "w")
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_SH)
        if os.path.exists(json_path):
            try:
                with open(json_path) as f:
                    return json.load(f)
            except (json.JSONDecodeError, OSError):
                pass
        return default() if callable(default) else (
            default.copy() if isinstance(default, (list, dict)) else default
        )
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        lock_fd.close()


class Agent(ABC):
    """Base class for all pipeline agents.

    Hub-and-spoke model:
    - Editor pushes Tasks to agent's inbox queue
    - Agent executes tasks and pushes TaskResults to outbox queue
    - When inbox is empty, agent enters idle_work() (optional background maintenance)
    - Watchdog: if inbox empty for >120s, logs a warning
    """

    # How long an agent waits for inbox before logging a watchdog warning
    WATCHDOG_TIMEOUT = 120

    def __init__(self, name, interval=60):
        """
        Args:
            name: Agent identifier (e.g. "scout", "courier")
            interval: Seconds between work cycles
        """
        self.name = name
        self.interval = interval
        self._running = False
        self._paused = asyncio.Event()
        self._paused.set()  # Start unpaused
        self._stop_requested = False
        self._current_task = "Initializing"
        self._active = False
        self._last_work_time = None
        self._cycles = 0
        self._errors = 0
        self._last_error = None
        self._last_error_time = None

        # Hub-and-spoke: task queues
        self.inbox = asyncio.Queue()   # Editor pushes Tasks here
        self.outbox = asyncio.Queue()  # Agent pushes TaskResults here
        self._last_task_time = 0.0     # For watchdog timer
        self._current_task_obj = None  # The Task currently being executed

        # Personality-driven speech
        self._speech = ""              # Latest narrated speech bubble text
        self._personality = None       # Cached personality from skills file
        self._agent_name = None        # Character name from skills file (e.g. "Arthur")
        self._last_idle_chatter = 0.0  # Timestamp of last idle narration
        self._idle_chatter_interval = 120  # Seconds between idle chatter (2 min)

    # ── Lifecycle ──────────────────────────────────────────────

    async def run(self):
        """Main run loop. Checks inbox for tasks first, falls back to idle_work()."""
        self._running = True
        self._stop_requested = False
        self._last_task_time = _time.time()
        self.log(f"{self.name.title()} agent started (interval={self.interval}s)")

        try:
            while not self._stop_requested:
                # Wait if paused
                await self._paused.wait()

                if self._stop_requested:
                    break

                self._active = True
                try:
                    # Check inbox for tasks from Editor
                    did_work = False
                    try:
                        task = self.inbox.get_nowait()
                        self._last_task_time = _time.time()
                        self._current_task_obj = task
                        self._current_task = f"Task: {task.goal[:60]}"
                        self.log(f"Executing task {task.id}: {task.goal}")

                        from agents.tasks import TaskResult
                        try:
                            result = await self.execute(task)
                            self.outbox.put_nowait(result)
                            did_work = True
                            # Narrate completion in agent's personality
                            try:
                                summary = result.result.get("summary", task.goal) if hasattr(result, "result") and isinstance(result.result, dict) else task.goal
                                await asyncio.to_thread(self.narrate, f"Completed: {summary}")
                            except Exception:
                                pass
                        except Exception as e:
                            # Task execution failed — send failure result
                            fail_result = TaskResult(
                                task_id=task.id,
                                task_type=task.type,
                                status="failure",
                                result={},
                                error=str(e),
                                agent=self.name,
                            )
                            self.outbox.put_nowait(fail_result)
                            self._errors += 1
                            self._last_error = str(e)
                            self._last_error_time = datetime.now()
                            self.log(f"Task {task.id} failed: {e}", level="ERROR")
                            # Narrate failure in agent's personality
                            try:
                                await asyncio.to_thread(self.narrate, f"Failed: {task.goal} — {e}")
                            except Exception:
                                pass
                        finally:
                            self._current_task_obj = None

                    except asyncio.QueueEmpty:
                        # No task from Editor — run legacy work() or idle_work()
                        did_work = await self.work()

                        # Watchdog: warn if inbox has been empty too long
                        if _time.time() - self._last_task_time > self.WATCHDOG_TIMEOUT:
                            if self._cycles > 0 and self._cycles % 10 == 0:
                                self.log(f"Inbox empty for >{self.WATCHDOG_TIMEOUT}s", level="DEBUG")

                    self._cycles += 1
                    self._last_work_time = datetime.now()
                    if did_work:
                        self.log(f"Work cycle completed (cycle #{self._cycles})", level="DEBUG")
                    else:
                        # No work — generate personality-driven idle chatter
                        try:
                            await asyncio.to_thread(self.idle_chatter)
                        except Exception:
                            pass
                except Exception as e:
                    self._errors += 1
                    self._last_error = str(e)
                    self._last_error_time = datetime.now()
                    self.log(f"Error in work cycle: {e}", level="ERROR")
                finally:
                    self._active = False

                # Sleep between cycles (check stop flag periodically)
                elapsed = 0
                while elapsed < self.interval and not self._stop_requested:
                    await asyncio.sleep(min(1, self.interval - elapsed))
                    elapsed += 1
                    # Also wait if paused during sleep
                    if not self._paused.is_set():
                        await self._paused.wait()
        finally:
            self._running = False
            self.log(f"{self.name.title()} agent stopped")

    def stop(self):
        """Request graceful shutdown. Agent finishes current work and exits."""
        self._stop_requested = True
        # Unpause if paused, so the loop can exit
        self._paused.set()

    def pause(self):
        """Pause the agent. It will finish current work but not start new work."""
        self._paused.clear()
        self._current_task = "Paused"
        self.log("Paused")

    def resume(self):
        """Resume a paused agent."""
        self._paused.set()
        self.log("Resumed")

    @property
    def is_paused(self):
        return not self._paused.is_set()

    @property
    def is_running(self):
        return self._running

    # ── Abstract methods (each agent implements) ──────────────

    @abstractmethod
    async def work(self):
        """Do one unit of work (legacy loop). Return True if work was done, False if idle.

        In the hub-and-spoke model, this is called when the inbox is empty.
        Agents should implement execute() for task-driven work and use work()
        only as a fallback idle behavior.
        """
        ...

    async def execute(self, task):
        """Execute a task from the Editor. Returns a TaskResult.

        Override this in each agent to handle task types. The base implementation
        raises NotImplementedError — agents that haven't been migrated yet will
        fall through to work() via the inbox-empty path.
        """
        from agents.tasks import TaskResult
        return TaskResult(
            task_id=task.id,
            task_type=task.type,
            status="failure",
            result={},
            error=f"{self.name} has not implemented execute() for task type '{task.type}'",
            agent=self.name,
        )

    @abstractmethod
    def get_progress(self):
        """Return progress dict: {"current": N, "total": M}"""
        ...

    # ── Skills loading ────────────────────────────────────────

    def load_skills(self):
        """Read this agent's skills file. Returns contents as string, or empty string."""
        path = os.path.join(SKILLS_DIR, f"{self.name}.md")
        if os.path.exists(path):
            with open(path) as f:
                return f.read()
        return ""

    # ── Personality & Speech ─────────────────────────────────

    def _load_personality(self):
        """Extract the Personality section from this agent's skills file. Cached."""
        if self._personality is not None:
            return self._personality
        skills = self.load_skills()
        # Extract ## Personality section
        marker = "## Personality"
        idx = skills.find(marker)
        if idx == -1:
            self._personality = ""
            return ""
        start = idx + len(marker)
        # Find next ## heading or end of file
        next_section = skills.find("\n## ", start)
        section = skills[start:next_section].strip() if next_section != -1 else skills[start:].strip()
        self._personality = section
        return section

    def narrate(self, facts):
        """Generate a speech bubble message in this agent's personality voice.

        Uses Haiku for a fast, cheap call (~$0.0005). Falls back to raw facts on error.
        The result is stored in self._speech for the dashboard to read.
        """
        personality = self._load_personality()
        if not personality:
            self._speech = facts
            return facts
        try:
            import anthropic
            client = anthropic.Anthropic()
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=100,
                system=(
                    f"You are the {self.name.title()} agent in a newsroom-style research pipeline. "
                    f"Your personality:\n{personality}\n\n"
                    "Write a short status update (1-2 sentences max) in YOUR voice about what just happened. "
                    "Stay in character. No emoji. Be brief."
                ),
                messages=[{"role": "user", "content": f"What just happened: {facts}"}],
            )
            text = response.content[0].text.strip()
            self._speech = text
            return text
        except Exception as e:
            self.log(f"Narrate failed: {e}", level="DEBUG")
            self._speech = facts
            return facts

    def _load_agent_name(self):
        """Extract the Name from this agent's skills file. Cached."""
        if self._agent_name is not None:
            return self._agent_name
        skills = self.load_skills()
        marker = "## Name"
        idx = skills.find(marker)
        if idx == -1:
            self._agent_name = ""
            return ""
        start = idx + len(marker)
        next_section = skills.find("\n## ", start)
        name = skills[start:next_section].strip() if next_section != -1 else skills[start:].strip()
        self._agent_name = name.split("\n")[0].strip()  # First line only
        return self._agent_name

    def idle_chatter(self):
        """Generate a personality-driven idle/bored message.

        Called when the agent has no work. Uses Haiku to produce a short
        in-character quip about being bored, waiting, thinking, etc.
        Respects a cooldown interval to avoid spamming.
        """
        now = _time.time()
        if now - self._last_idle_chatter < self._idle_chatter_interval:
            return  # Too soon since last chatter

        personality = self._load_personality()
        if not personality:
            return

        agent_name = self._load_agent_name()
        self._last_idle_chatter = now

        try:
            import anthropic
            client = anthropic.Anthropic()
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=80,
                system=(
                    f"You are {agent_name or self.name.title()}, the {self.name.title()} agent in a newsroom-style research pipeline. "
                    f"Your personality:\n{personality}\n\n"
                    "You're between tasks right now — no assignments from the Editor. "
                    "Write a short idle thought (1 sentence max) in YOUR voice. "
                    "You might be bored, restless, thinking about work, fidgeting, "
                    "making an observation about the office, or reflecting on recent work. "
                    "Be natural and varied — never repeat yourself. No emoji. Stay in character."
                ),
                messages=[{"role": "user", "content": "What are you thinking right now while you wait?"}],
            )
            text = response.content[0].text.strip()
            self._speech = text
        except Exception:
            pass  # Silently fail — idle chatter is non-critical

    # ── Problem Solving ────────────────────────────────────────

    def problem_solve(self, error, context, strategies):
        """Diagnose an error and choose a recovery strategy using LLM reasoning.

        This gives agents the ability to THINK about problems instead of blindly
        retrying. The LLM sees the error, the context, and the available strategies,
        then picks the best approach — or decides to escalate to the Editor.

        Args:
            error: The error message or exception string
            context: Dict with relevant context (file, task, what was attempted)
            strategies: Dict of {strategy_name: description} — the agent's toolkit

        Returns:
            Dict with:
                diagnosis: What the agent thinks went wrong
                strategy: Key from strategies dict (or "escalate")
                reasoning: Why this strategy was chosen
        """
        personality = self._load_personality()
        strategies_text = "\n".join(f"  - {k}: {v}" for k, v in strategies.items())
        strategies_text += "\n  - escalate: Report to Editor — all local strategies exhausted"

        prompt = f"""You encountered an error while working. Diagnose it and choose the best recovery strategy.

ERROR: {error}

CONTEXT:
{json.dumps(context, indent=2, default=str)}

AVAILABLE STRATEGIES:
{strategies_text}

Respond with JSON only:
{{"diagnosis": "What went wrong (1 sentence)", "strategy": "strategy_name", "reasoning": "Why this strategy (1 sentence)"}}"""

        try:
            import anthropic
            client = anthropic.Anthropic()
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=200,
                system=(
                    f"You are the {self.name.title()} agent. {personality[:200] if personality else ''}\n"
                    "You are a problem solver. When something goes wrong, you diagnose it and pick "
                    "the smartest recovery strategy from your toolkit. Be practical, not theoretical. "
                    "Only escalate if you genuinely have no local options left."
                ),
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1]
                if "```" in text:
                    text = text[:text.rindex("```")]
            result = json.loads(text)
            self.log(f"Problem solve: {result.get('diagnosis', '')} → {result.get('strategy', 'unknown')}")
            # Narrate the decision
            try:
                self.narrate(f"Hit a problem: {result.get('diagnosis', error)}. Trying: {result.get('strategy', 'unknown')}")
            except Exception:
                pass
            return result
        except Exception as e:
            self.log(f"Problem solve LLM failed: {e}", level="DEBUG")
            # Fallback: pick the first non-escalate strategy
            fallback = next(iter(strategies), "escalate")
            return {
                "diagnosis": str(error)[:100],
                "strategy": fallback,
                "reasoning": "LLM unavailable, trying first available strategy",
            }

    # ── Logging ───────────────────────────────────────────────

    def log(self, message, level="INFO"):
        """Append to the shared activity log. Format: TIMESTAMP|AGENT|LEVEL|MESSAGE"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"{timestamp}|{self.name.upper()}|{level}|{message}\n"

        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        with open(LOG_PATH, "a") as f:
            f.write(line)

        # Also print for visibility
        prefix = f"[{self.name.upper()}]"
        if level == "ERROR":
            print(f"  {prefix} ERROR: {message}")
        elif level != "DEBUG":
            print(f"  {prefix} {message}")

    # ── Dashboard status ──────────────────────────────────────

    def get_dashboard_status(self):
        """Return status dict for the dashboard."""
        if self._stop_requested:
            status = "idle"
        elif self.is_paused:
            status = "paused"
        elif self._active:
            status = "working"
        else:
            status = "idle"

        return {
            "id": self.name,
            "status": status,
            "message": self._current_task,
            "speech": self._speech or None,
            "active": self._active,
            "paused": self.is_paused,
            "cycles": self._cycles,
            "errors": self._errors,
            "last_error": self._last_error,
            "last_error_time": self._last_error_time.isoformat() if self._last_error_time else None,
            "last_work": self._last_work_time.isoformat() if self._last_work_time else None,
            "progress": self.get_progress(),
        }
