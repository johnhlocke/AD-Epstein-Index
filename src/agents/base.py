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
            "active": self._active,
            "paused": self.is_paused,
            "cycles": self._cycles,
            "errors": self._errors,
            "last_error": self._last_error,
            "last_error_time": self._last_error_time.isoformat() if self._last_error_time else None,
            "last_work": self._last_work_time.isoformat() if self._last_work_time else None,
            "progress": self.get_progress(),
        }
