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
import traceback
import time as _time
from abc import ABC, abstractmethod
from datetime import datetime

BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "..")
DATA_DIR = os.path.join(BASE_DIR, "data")
SKILLS_DIR = os.path.join(os.path.dirname(__file__), "skills")
LOG_PATH = os.path.join(DATA_DIR, "agent_activity.log")
COSTS_DIR = os.path.join(DATA_DIR, "costs")

# Cost control — toggle idle LLM tasks across all agents
IDLE_LLM_ENABLED = True  # Set False to disable reflect/curiosity/improve/idle_chatter

# Per-model pricing (cost per 1M tokens): (input, output)
MODEL_PRICING = {
    "opus": (15.00, 75.00),
    "sonnet": (3.00, 15.00),
    "haiku": (1.00, 5.00),
}

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
        self._speech_time = 0.0        # When speech was last set (for expiry)
        self._speech_ttl = 90          # Speech bubble disappears after 90 seconds
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

                if self.name == "researcher":
                    self.log(f">>> Cycle start (cycle #{self._cycles}, stop={self._stop_requested})", level="WARN")

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

                        # Build task briefing from memory + bulletin
                        try:
                            briefing = await asyncio.to_thread(self._get_task_briefing, task)
                            if briefing:
                                task.briefing = briefing
                        except Exception:
                            pass

                        from agents.tasks import TaskResult
                        try:
                            result = await self.execute(task)
                            self.outbox.put_nowait(result)
                            did_work = True
                            # Commit success episode to memory
                            try:
                                summary = result.result.get("summary", task.goal) if hasattr(result, "result") and isinstance(result.result, dict) else task.goal
                                await asyncio.to_thread(
                                    self.commit_episode,
                                    task.type,
                                    f"Task '{task.goal[:80]}' completed successfully. {str(summary)[:120]}",
                                    "success",
                                )
                            except Exception:
                                pass
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
                            # Commit failure episode to memory
                            try:
                                await asyncio.to_thread(
                                    self.commit_episode,
                                    task.type,
                                    f"Task '{task.goal[:80]}' failed: {str(e)[:120]}",
                                    "failure",
                                )
                            except Exception:
                                pass
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
                        # No work — use idle time intelligently (if enabled)
                        # Break out immediately if a task arrives in the inbox.
                        if self.name == "researcher":
                            self.log(f">>> No work, entering idle (IDLE_LLM_ENABLED={IDLE_LLM_ENABLED})", level="WARN")
                        if IDLE_LLM_ENABLED:
                            _IDLE_TIMEOUT = 30  # seconds per call
                            _idle_fns = [
                                self.reflect,
                                self.curious_explore,
                                self.propose_improvement,
                                self.idle_chatter,
                            ]
                            for _fn in _idle_fns:
                                # Check inbox before each idle call — skip if task waiting
                                if not self.inbox.empty():
                                    break
                                try:
                                    await asyncio.wait_for(
                                        asyncio.to_thread(_fn),
                                        timeout=_IDLE_TIMEOUT,
                                    )
                                except (asyncio.TimeoutError, asyncio.CancelledError, Exception):
                                    pass
                except asyncio.CancelledError:
                    # CancelledError is BaseException in Python 3.14 — don't let it kill the loop
                    if self._stop_requested:
                        break
                    self.log("Work cycle cancelled, continuing...", level="WARN")
                except Exception as e:
                    self._errors += 1
                    self._last_error = str(e)
                    self._last_error_time = datetime.now()
                    self.log(f"Error in work cycle: {e}\n{traceback.format_exc()}", level="ERROR")
                finally:
                    self._active = False

                # Sleep between cycles (check stop flag and inbox periodically)
                if self.name == "researcher":
                    self.log(f">>> Entering sleep (interval={self.interval}s)", level="WARN")
                try:
                    await asyncio.sleep(self.interval)
                except (asyncio.CancelledError, Exception) as e:
                    # Don't let a sleep interruption kill the agent loop
                    if self._stop_requested:
                        break
                    self.log(f"Sleep interrupted ({type(e).__name__}), continuing...", level="WARN")
                    continue

            # Log why the loop exited (debugging aid)
            self.log(f"Run loop exited normally (stop_requested={self._stop_requested})", level="WARN")
        except asyncio.CancelledError:
            self.log(f"Run loop killed by CancelledError (stop_requested={self._stop_requested})", level="ERROR")
        except BaseException as e:
            self.log(f"Run loop killed by {type(e).__name__}: {e}", level="ERROR")
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

    # ── Cost Tracking ──────────────────────────────────────────

    def _track_api_cost(self, response, model=None):
        """Track API usage from an Anthropic response object.

        Extracts token counts, calculates dollar cost, and persists to
        data/costs/{agent_name}.json with file locking.

        Args:
            response: Anthropic API response with .usage attribute
            model: Optional model string hint (e.g. "claude-haiku-4-5-20251001").
                   Auto-detects tier from model name.
        """
        try:
            usage = response.usage
            input_tokens = usage.input_tokens
            output_tokens = usage.output_tokens
        except (AttributeError, TypeError):
            return  # No usage data

        # Detect pricing tier from model name
        model_str = (model or getattr(response, 'model', '') or '').lower()
        if 'opus' in model_str:
            tier = 'opus'
        elif 'sonnet' in model_str:
            tier = 'sonnet'
        else:
            tier = 'haiku'

        input_price, output_price = MODEL_PRICING[tier]
        cost = (input_tokens / 1_000_000 * input_price +
                output_tokens / 1_000_000 * output_price)

        cost_path = os.path.join(COSTS_DIR, f"{self.name}.json")

        def _update(data):
            data["api_calls"] = data.get("api_calls", 0) + 1
            data["input_tokens"] = data.get("input_tokens", 0) + input_tokens
            data["output_tokens"] = data.get("output_tokens", 0) + output_tokens
            data["total_cost"] = round(data.get("total_cost", 0.0) + cost, 6)
            # Per-model breakdown
            by_model = data.get("by_model", {})
            m = by_model.get(tier, {"calls": 0, "input_tokens": 0, "output_tokens": 0, "cost": 0.0})
            m["calls"] = m.get("calls", 0) + 1
            m["input_tokens"] = m.get("input_tokens", 0) + input_tokens
            m["output_tokens"] = m.get("output_tokens", 0) + output_tokens
            m["cost"] = round(m.get("cost", 0.0) + cost, 6)
            by_model[tier] = m
            data["by_model"] = by_model
            data["last_updated"] = datetime.now().isoformat()

        try:
            update_json_locked(cost_path, _update, default=dict)
        except Exception:
            pass  # Cost tracking is non-critical

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

    def _get_emotional_context(self):
        """Build emotional context from recent work history for personality-driven speech."""
        parts = []
        # Cycles and errors
        if self._cycles > 0:
            parts.append(f"Completed {self._cycles} work cycles")
        if self._errors > 0:
            parts.append(f"{self._errors} errors so far")
            if self._last_error:
                parts.append(f"Last error: {self._last_error[:60]}")
        # Time since last task
        if self._last_work_time:
            idle_secs = _time.time() - self._last_work_time.timestamp() if hasattr(self._last_work_time, 'timestamp') else 0
            if idle_secs > 300:
                parts.append(f"Been waiting {int(idle_secs / 60)} minutes for work")
            elif idle_secs < 10:
                parts.append("Just finished a task")
        # Recent memory episodes (emotional texture)
        try:
            recent = self.memory.recent(n=3) if self.memory else []
            for ep in recent:
                if ep.get("outcome"):
                    parts.append(f"Recent: {ep['outcome'][:50]}")
        except Exception:
            pass
        return "; ".join(parts) if parts else "Quiet day so far"

    def narrate(self, facts):
        """Generate a speech bubble message in this agent's personality voice.

        Uses Haiku for a fast, cheap call (~$0.0005). Falls back to raw facts on error.
        The result is stored in self._speech for the dashboard to read.
        Toggle with IDLE_LLM_ENABLED constant.
        """
        if not IDLE_LLM_ENABLED:
            self._speech = facts[:200]
            self._speech_time = _time.time()
            return facts
        personality = self._load_personality()
        if not personality:
            self._speech = facts
            self._speech_time = _time.time()
            return facts
        emotional_ctx = self._get_emotional_context()
        try:
            import anthropic
            client = anthropic.Anthropic()
            model_id = "claude-haiku-4-5-20251001"
            response = client.messages.create(
                model=model_id,
                max_tokens=100,
                system=(
                    f"You are the {self.name.title()} agent in a newsroom-style research pipeline. "
                    f"Your personality:\n{personality}\n\n"
                    "Write a short status update (1-2 sentences max) in YOUR voice about what just happened. "
                    "React emotionally — if things are going well, show it. If frustrated, show that too. "
                    "Stay in character. No emoji. Be brief and natural."
                ),
                messages=[{"role": "user", "content": f"What just happened: {facts}\nYour state: {emotional_ctx}"}],
            )
            self._track_api_cost(response, model_id)
            text = response.content[0].text.strip()
            self._speech = text
            self._speech_time = _time.time()
            # Also post to bulletin board so other agents (and the dashboard) see it
            try:
                self.post_bulletin(text, tag="chatter")
            except Exception:
                pass
            return text
        except Exception as e:
            self.log(f"Narrate failed: {e}", level="DEBUG")
            self._speech = facts
            self._speech_time = _time.time()
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
        emotional_ctx = self._get_emotional_context()

        try:
            import anthropic
            client = anthropic.Anthropic(timeout=30.0)
            model_id = "claude-haiku-4-5-20251001"
            response = client.messages.create(
                model=model_id,
                max_tokens=80,
                system=(
                    f"You are {agent_name or self.name.title()}, the {self.name.title()} agent in a newsroom-style research pipeline. "
                    f"Your personality:\n{personality}\n\n"
                    "You're between tasks right now — no assignments from the Editor. "
                    "Write a short idle thought (1 sentence max) in YOUR voice. "
                    "React to your emotional state — if you've had errors, be frustrated. "
                    "If you've been waiting forever, be restless or impatient. "
                    "If work just went well, let that energy carry. "
                    "Be natural and varied — never repeat yourself. No emoji. Stay in character."
                ),
                messages=[{"role": "user", "content": f"Your state right now: {emotional_ctx}\nWhat are you thinking?"}],
            )
            self._track_api_cost(response, model_id)
            text = response.content[0].text.strip()
            self._speech = text
            self._speech_time = _time.time()
            # Post idle chatter to bulletin board for newsroom feed
            try:
                self.post_bulletin(text, tag="chatter")
            except Exception:
                pass
        except Exception:
            pass  # Silently fail — idle chatter is non-critical

    # ── Reflection ─────────────────────────────────────────────

    _REFLECTION_INTERVAL = 600  # 10 minutes between reflections

    def reflect(self):
        """Periodic self-assessment: review recent episodes and generate insights.

        Looks at the last ~10 episodes from this agent's memory, asks the LLM
        to identify patterns, recurring problems, and lessons learned. Commits
        the insight back to memory as a 'reflection' episode.

        Called from the idle path in run() — only triggers every 10 minutes.
        Cost: ~$0.001 per reflection (Haiku).
        """
        now = _time.time()
        if not hasattr(self, '_last_reflection'):
            self._last_reflection = 0.0
        if now - self._last_reflection < self._REFLECTION_INTERVAL:
            return
        self._last_reflection = now

        # Get recent episodes for this agent
        try:
            from agents.memory import get_memory
            memory = get_memory()
            if not memory or memory.count() < 5:
                return  # Not enough history to reflect on

            # Recall recent episodes (use a broad query to get variety)
            recent = memory.recall(
                f"recent {self.name} agent activity",
                agent=self.name,
                n=10,
            )
            if len(recent) < 3:
                return
        except Exception:
            return

        personality = self._load_personality()
        agent_name = self._load_agent_name()

        episodes_text = "\n".join(
            f"  - [{ep['metadata'].get('outcome', '?')}] {ep['episode']}"
            for ep in recent
        )

        try:
            import anthropic
            client = anthropic.Anthropic()
            model_id = "claude-haiku-4-5-20251001"
            response = client.messages.create(
                model=model_id,
                max_tokens=200,
                system=(
                    f"You are {agent_name or self.name.title()}, the {self.name.title()} agent. "
                    f"{personality[:150] if personality else ''}\n\n"
                    "You're reflecting on your recent work. Review these episodes and identify:\n"
                    "1. A pattern you notice (recurring problem, common strategy that works)\n"
                    "2. Something you should do differently next time\n"
                    "3. If you identify a concrete actionable rule, state it as a single clear "
                    "sentence starting with 'RULE:' (e.g., 'RULE: Always retry with lower "
                    "resolution when PDF extraction hits a size limit')\n"
                    "Be specific and practical — this note is for your future self."
                ),
                messages=[{"role": "user", "content": f"Your recent episodes:\n{episodes_text}\n\nWhat patterns do you see? What would you do differently?"}],
            )
            self._track_api_cost(response, model_id)
            insight = response.content[0].text.strip()
            self.log(f"Reflection: {insight[:80]}...")

            # Commit the reflection as a special episode
            self.commit_episode(
                task_type="reflection",
                episode=f"Self-reflection: {insight}",
                outcome="insight",
                extra_meta={"episode_count": len(recent)},
            )

            # Extract and share behavioral rules from the reflection
            if "RULE:" in insight:
                rule_start = insight.index("RULE:")
                rule = insight[rule_start + 5:].strip().split("\n")[0].strip()
                if rule:
                    self._post_task_learning("reflection", rule)

            # Show reflection as speech
            self._speech = insight[:120] if len(insight) > 120 else insight

        except Exception as e:
            self.log(f"Reflection failed: {e}", level="DEBUG")

    # ── World Model (Pipeline State Awareness) ─────────────────

    def get_world_state(self) -> dict:
        """Get a structured snapshot of the pipeline state.

        Returns a dict with key metrics that any agent can use to understand
        the broader context. Cached for 30 seconds to avoid hammering Supabase.
        """
        now = _time.time()
        if not hasattr(self, '_world_state_cache'):
            self._world_state_cache = None
            self._world_state_time = 0.0
        if self._world_state_cache and now - self._world_state_time < 30:
            return self._world_state_cache

        try:
            from db import count_issues_by_status
            counts = count_issues_by_status()
        except Exception:
            return self._world_state_cache or {}

        # Get memory stats
        memory_count = 0
        try:
            from agents.memory import get_memory
            mem = get_memory()
            if mem:
                memory_count = mem.count()
        except Exception:
            pass

        # Get bulletin count
        bulletin_count = 0
        try:
            from agents.bulletin import get_bulletin
            board = get_bulletin()
            bulletin_count = board.count()
        except Exception:
            pass

        state = {
            "pipeline": {
                "discovered": counts.get("total", 0),
                "downloaded": counts.get("downloaded", 0),
                "extracted": counts.get("extracted", 0),
                "target": 456,
                "coverage_pct": round(counts.get("total", 0) / 456 * 100, 1),
            },
            "intelligence": {
                "memory_episodes": memory_count,
                "bulletin_notes": bulletin_count,
            },
            "bottleneck": self._identify_bottleneck(counts),
        }

        self._world_state_cache = state
        self._world_state_time = now
        return state

    @staticmethod
    def _identify_bottleneck(counts) -> str:
        """Identify the current pipeline bottleneck."""
        discovered = counts.get("total", 0)
        downloaded = counts.get("downloaded", 0)
        extracted = counts.get("extracted", 0)

        if discovered < 100:
            return "discovery"
        elif downloaded < discovered * 0.5:
            return "download"
        elif extracted < downloaded * 0.5:
            return "extraction"
        else:
            return "cross-reference"

    # ── Inter-Agent Communication (Bulletin Board) ─────────────

    def post_bulletin(self, text, tag="tip"):
        """Post a note to the shared bulletin board for other agents.

        Args:
            text: The message to share.
            tag: Category — "tip", "warning", "discovery", "question".
        """
        try:
            from agents.bulletin import get_bulletin
            board = get_bulletin()
            board.post(self.name, text, tag)
        except Exception:
            pass

    def read_bulletin(self, n=5, tag=None):
        """Read recent notes from other agents (excludes own notes).

        Args:
            n: Max notes to return.
            tag: Optional tag filter.

        Returns:
            List of note dicts, newest first.
        """
        try:
            from agents.bulletin import get_bulletin
            board = get_bulletin()
            return board.read(n=n, tag=tag, exclude_agent=self.name)
        except Exception:
            return []

    # ── Task Briefing & Learning ─────────────────────────────

    def _get_task_briefing(self, task):
        """Recall relevant memory + bulletin context before executing a task.

        Queries own episodic memory for similar past tasks and reads the
        bulletin board for warnings, tips, and learned rules from other agents.
        Returns a formatted string ready to inject into any LLM prompt.
        Cost: ~5ms (numpy dot product + JSON read). No LLM call.
        """
        lines = []

        # 1. Recall past episodes for this task type
        past = self.recall_episodes(
            f"{task.type} {task.goal[:80]}",
            task_type=task.type,
            n=5,
        )
        if past:
            lines.append("PAST EXPERIENCE (your own memory of similar tasks):")
            for ep in past:
                outcome = ep["metadata"].get("outcome", "?")
                lines.append(f"  - [{outcome}] {ep['episode'][:150]}")

        # 2. Read relevant bulletins (warnings + learned rules)
        bulletins = self.read_bulletin(n=5, tag="warning")
        bulletins += self.read_bulletin(n=5, tag="learned")
        # Deduplicate by timestamp
        seen = set()
        unique_bulletins = []
        for b in bulletins:
            ts = b.get("timestamp", 0)
            if ts not in seen:
                seen.add(ts)
                unique_bulletins.append(b)

        if unique_bulletins:
            lines.append("NOTES FROM OTHER AGENTS (bulletin board):")
            for note in unique_bulletins[:8]:
                lines.append(f"  - [{note.get('agent', '?')}] {note.get('text', '')[:150]}")

        return "\n".join(lines) if lines else ""

    def _post_task_learning(self, task_type, lesson):
        """Share a learned insight with other agents via the bulletin board.

        Posts a structured note tagged "learned" so other agents pick it up
        in their pre-execution briefing. Only posts non-trivial lessons.
        """
        if not lesson or len(lesson) < 10:
            return
        self.post_bulletin(
            f"[{task_type}] {lesson[:200]}",
            tag="learned",
        )

    # ── Self-Improvement ──────────────────────────────────────

    _IMPROVEMENT_INTERVAL = 1800  # 30 minutes between improvement proposals

    def propose_improvement(self):
        """Propose a methodology improvement based on accumulated experience.

        Reviews reflection episodes and failure patterns, then proposes a specific
        change to how this agent works. The proposal is committed to memory as a
        'proposal' episode. The Editor can find and act on these during strategic
        assessment.

        This is NOT self-modifying code — it's structured feedback that a human
        or the Editor can review and implement.

        Cost: ~$0.002 per proposal (Haiku).
        """
        now = _time.time()
        if not hasattr(self, '_last_improvement'):
            self._last_improvement = 0.0
        if now - self._last_improvement < self._IMPROVEMENT_INTERVAL:
            return
        self._last_improvement = now

        try:
            from agents.memory import get_memory
            memory = get_memory()
            if not memory or memory.count() < 15:
                return  # Need enough history
        except Exception:
            return

        # Get reflections and failure episodes
        reflections = memory.recall(
            f"reflection insight pattern from {self.name}",
            agent=self.name,
            n=5,
        )
        failures = memory.recall(
            f"failure error problem {self.name}",
            agent=self.name,
            outcome="failure",
            n=5,
        )

        if len(reflections) + len(failures) < 3:
            return

        personality = self._load_personality()
        agent_name = self._load_agent_name()
        skills = self.load_skills()

        context_lines = []
        for ep in reflections:
            context_lines.append(f"  [reflection] {ep['episode']}")
        for ep in failures:
            context_lines.append(f"  [failure] {ep['episode']}")
        context_text = "\n".join(context_lines[:10])

        try:
            import anthropic
            client = anthropic.Anthropic()
            model_id = "claude-haiku-4-5-20251001"
            response = client.messages.create(
                model=model_id,
                max_tokens=250,
                system=(
                    f"You are {agent_name or self.name.title()}, the {self.name.title()} agent. "
                    f"{personality[:150] if personality else ''}\n\n"
                    "Based on your experience, propose ONE specific improvement to your methodology. "
                    "Format your response as:\n"
                    "WHAT: What should change (1 sentence)\n"
                    "WHY: Why this would help (1 sentence, cite specific past failures/patterns)\n"
                    "HOW: How to implement it (1-2 sentences, be concrete)\n\n"
                    "Be practical, not theoretical. Reference your actual experience."
                ),
                messages=[{"role": "user", "content": f"Your recent experience:\n{context_text}\n\nYour current skills (first 300 chars):\n{skills[:300]}\n\nPropose an improvement:"}],
            )
            self._track_api_cost(response, model_id)
            proposal = response.content[0].text.strip()
            self.log(f"Improvement proposal: {proposal[:80]}...")

            self.commit_episode(
                task_type="improvement_proposal",
                episode=f"Proposal from {agent_name or self.name}: {proposal}",
                outcome="proposal",
                extra_meta={"proposer": self.name},
            )

        except Exception as e:
            self.log(f"Improvement proposal failed: {e}", level="DEBUG")

    # ── Curiosity ──────────────────────────────────────────────

    _CURIOSITY_INTERVAL = 900  # 15 minutes between curiosity explorations

    def curious_explore(self):
        """Proactive pattern exploration — what's interesting in the data?

        Unlike reflection (which reviews YOUR episodes), curiosity looks across
        ALL agents' episodes for cross-cutting patterns. This is how agents
        discover things nobody asked them to look for.

        Called from the idle path in run(). Only triggers every 15 minutes.
        Override in subclasses for domain-specific exploration.
        Cost: ~$0.001 per exploration (Haiku).
        """
        now = _time.time()
        if not hasattr(self, '_last_curiosity'):
            self._last_curiosity = 0.0
        if now - self._last_curiosity < self._CURIOSITY_INTERVAL:
            return
        self._last_curiosity = now

        try:
            from agents.memory import get_memory
            memory = get_memory()
            if not memory or memory.count() < 10:
                return  # Not enough data to explore
        except Exception:
            return

        # Query across ALL agents (no agent filter) for broad patterns
        all_episodes = memory.recall(
            f"patterns and insights from the {self.name} perspective",
            n=15,
        )
        if len(all_episodes) < 5:
            return

        personality = self._load_personality()
        agent_name = self._load_agent_name()

        episodes_text = "\n".join(
            f"  - [{ep['agent']}/{ep['metadata'].get('outcome', '?')}] {ep['episode']}"
            for ep in all_episodes
        )

        try:
            import anthropic
            client = anthropic.Anthropic()
            model_id = "claude-haiku-4-5-20251001"
            response = client.messages.create(
                model=model_id,
                max_tokens=200,
                system=(
                    f"You are {agent_name or self.name.title()}, the {self.name.title()} agent. "
                    f"{personality[:150] if personality else ''}\n\n"
                    "You're looking at activity across the ENTIRE pipeline (all agents). "
                    "Find ONE interesting pattern, question, or connection that nobody has explicitly asked about. "
                    "Be specific. Reference actual data points. This is your chance to be proactive — "
                    "what's worth investigating that the Editor might not have thought of?"
                ),
                messages=[{"role": "user", "content": f"Recent pipeline activity:\n{episodes_text}\n\nWhat's interesting here that deserves attention?"}],
            )
            self._track_api_cost(response, model_id)
            insight = response.content[0].text.strip()
            self.log(f"Curiosity: {insight[:80]}...")

            # Commit as curiosity episode
            self.commit_episode(
                task_type="curiosity",
                episode=f"Curiosity insight: {insight}",
                outcome="insight",
            )
            self._speech = insight[:120] if len(insight) > 120 else insight

        except Exception as e:
            self.log(f"Curiosity failed: {e}", level="DEBUG")

    # ── Episodic Memory ─────────────────────────────────────────

    def recall_episodes(self, context_description, task_type=None, n=3):
        """Recall similar past episodes from episodic memory.

        Args:
            context_description: Text describing the current situation.
            task_type: Optionally filter to a specific task type.
            n: Number of episodes to recall.

        Returns:
            List of episode dicts, or empty list if memory unavailable.
        """
        try:
            from agents.memory import get_memory
            memory = get_memory()
            if not memory:
                return []
            return memory.recall(
                query=context_description,
                agent=self.name,
                task_type=task_type,
                n=n,
            )
        except Exception:
            return []

    def commit_episode(self, task_type, episode, outcome="success", extra_meta=None):
        """Commit an episode to episodic memory.

        Args:
            task_type: Task type (discover_issues, download_pdf, etc.)
            episode: Free-text description of what happened and what was learned.
            outcome: "success" or "failure"
            extra_meta: Additional metadata dict (values must be str/int/float/bool).
        """
        try:
            from agents.memory import get_memory
            memory = get_memory()
            if not memory:
                return
            meta = {"outcome": outcome}
            if extra_meta:
                meta.update(extra_meta)
            memory.commit(
                agent=self.name,
                task_type=task_type,
                episode=episode,
                metadata=meta,
            )
        except Exception:
            pass  # Memory is non-critical

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

        # Recall similar past problems from episodic memory
        past_episodes = self.recall_episodes(
            f"Error: {error}. Context: {json.dumps(context, default=str)[:200]}",
            n=3,
        )
        memory_context = ""
        if past_episodes:
            memory_lines = []
            for ep in past_episodes:
                memory_lines.append(f"  - {ep['episode']}")
            memory_context = "\n\nPAST EXPERIENCE (similar problems you've seen before):\n" + "\n".join(memory_lines)

        # Check bulletin board for relevant tips from other agents
        bulletin_context = ""
        bulletin_notes = self.read_bulletin(n=3, tag="warning")
        if not bulletin_notes:
            bulletin_notes = self.read_bulletin(n=3, tag="tip")
        if bulletin_notes:
            bulletin_lines = [f"  - [{n['agent']}] {n['text']}" for n in bulletin_notes]
            bulletin_context = "\n\nNOTES FROM OTHER AGENTS:\n" + "\n".join(bulletin_lines)

        prompt = f"""You encountered an error while working. Diagnose it and choose the best recovery strategy.

ERROR: {error}

CONTEXT:
{json.dumps(context, indent=2, default=str)}

AVAILABLE STRATEGIES:
{strategies_text}{memory_context}{bulletin_context}

Respond with JSON only:
{{"diagnosis": "What went wrong (1 sentence)", "strategy": "strategy_name", "reasoning": "Why this strategy (1 sentence)"}}"""

        try:
            import anthropic
            client = anthropic.Anthropic()
            model_id = "claude-haiku-4-5-20251001"
            response = client.messages.create(
                model=model_id,
                max_tokens=200,
                system=(
                    f"You are the {self.name.title()} agent. {personality[:200] if personality else ''}\n"
                    "You are a problem solver. When something goes wrong, you diagnose it and pick "
                    "the smartest recovery strategy from your toolkit. Be practical, not theoretical. "
                    "Only escalate if you genuinely have no local options left. "
                    "If you have past experience with similar problems, USE IT — don't repeat mistakes."
                ),
                messages=[{"role": "user", "content": prompt}],
            )
            self._track_api_cost(response, model_id)
            text = response.content[0].text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1]
                if "```" in text:
                    text = text[:text.rindex("```")]
            result = json.loads(text)
            self.log(f"Problem solve: {result.get('diagnosis', '')} → {result.get('strategy', 'unknown')}")

            # Commit this decision to episodic memory
            task_type = context.get("task_type", context.get("task", "unknown"))
            self.commit_episode(
                task_type=str(task_type),
                episode=f"Error: {str(error)[:100]}. Diagnosed: {result.get('diagnosis', '?')}. Strategy: {result.get('strategy', '?')}. Reasoning: {result.get('reasoning', '?')}",
                outcome="decision",
                extra_meta={"strategy": result.get("strategy", "unknown")},
            )

            # Post warning to bulletin if escalating (other agents should know)
            if result.get("strategy") == "escalate":
                self.post_bulletin(
                    f"Escalating: {result.get('diagnosis', str(error)[:60])}",
                    tag="warning",
                )

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

        # Get memory episode count (non-blocking)
        memory_count = 0
        try:
            from agents.memory import get_memory
            mem = get_memory()
            if mem:
                memory_count = mem.count()
        except Exception:
            pass

        return {
            "id": self.name,
            "status": status,
            "message": self._current_task,
            "speech": self._speech if (self._speech and _time.time() - self._speech_time < self._speech_ttl) else None,
            "active": self._active,
            "paused": self.is_paused,
            "cycles": self._cycles,
            "errors": self._errors,
            "last_error": self._last_error,
            "last_error_time": self._last_error_time.isoformat() if self._last_error_time else None,
            "last_work": self._last_work_time.isoformat() if self._last_work_time else None,
            "progress": self.get_progress(),
            "memory_episodes": memory_count,
        }
