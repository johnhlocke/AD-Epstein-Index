"""
AD-Epstein Pipeline — Multi-Agent Orchestrator (Hub-and-Spoke)

Creates agents, wires Editor as central coordinator, runs the async event loop,
writes status.json, handles shutdown.

Hub-and-spoke model:
  - Editor scans Supabase, decides what needs doing, assigns tasks to agents
  - Agents are intelligent and autonomous in HOW they accomplish tasks
  - Editor is the only one committing pipeline state to Supabase
  - Dashboard commands are routed through Editor's inbox

Usage:
    python3 src/orchestrator.py                       # Single pass (run-once)
    python3 src/orchestrator.py --daemon              # Long-running daemon
    python3 src/orchestrator.py --no-editor           # Without LLM supervisor
    python3 src/orchestrator.py --agents scout,courier  # Specific agents only
"""

import argparse
import asyncio
import json
import os
import signal
import sys
from datetime import datetime

# Ensure src/ is on the path
sys.path.insert(0, os.path.dirname(__file__))

from agents.base import DATA_DIR, LOG_PATH
from agents.scout import ScoutAgent
from agents.courier import CourierAgent
from agents.reader import ReaderAgent
from agents.detective import DetectiveAgent
from agents.researcher import ResearcherAgent
from agents.editor import EditorAgent
from agents.designer import DesignerAgent

BASE_DIR = os.path.join(os.path.dirname(__file__), "..")
STATUS_PATH = os.path.join(BASE_DIR, "tools", "agent-office", "status.json")
COMMANDS_PATH = os.path.join(DATA_DIR, "agent_commands.json")

# All available agent classes
AGENT_CLASSES = {
    "scout": ScoutAgent,
    "courier": CourierAgent,
    "reader": ReaderAgent,
    "detective": DetectiveAgent,
    "researcher": ResearcherAgent,
    "editor": EditorAgent,
    "designer": DesignerAgent,
}

WORKER_NAMES = ["scout", "courier", "reader", "detective", "researcher", "designer"]


def parse_args():
    parser = argparse.ArgumentParser(description="AD-Epstein Multi-Agent Orchestrator")
    parser.add_argument("--daemon", action="store_true", help="Run as long-running daemon")
    parser.add_argument("--no-editor", action="store_true", help="Run without LLM supervisor")
    parser.add_argument("--agents", type=str, help="Comma-separated list of agents to run")
    return parser.parse_args()


def create_agents(agent_names, include_editor=True):
    """Create agent instances. Returns dict of name -> Agent."""
    agents = {}

    for name in agent_names:
        if name == "editor":
            continue  # Editor created separately
        if name == "designer":
            agents["designer"] = DesignerAgent()
        elif name in AGENT_CLASSES:
            agents[name] = AGENT_CLASSES[name]()

    # Create Editor with references to worker agents
    if include_editor and "editor" not in agent_names:
        # Editor always gets created if not excluded
        pass
    if include_editor:
        workers = {k: v for k, v in agents.items() if k in WORKER_NAMES}
        agents["editor"] = EditorAgent(workers=workers)

    return agents


async def write_status(agents):
    """Generate and write status.json, merging live agent data with existing status generation."""
    try:
        from agent_status import generate_status
        status = generate_status()
    except Exception:
        status = {
            "title": "AD-EPSTEIN INDEX — AGENT OFFICE",
            "subtitle": "Architectural Digest research pipeline",
            "timestamp": datetime.now().isoformat(),
            "agents": [],
            "stats": [],
        }

    # Overlay live agent data
    live_agents = {}
    for name, agent in agents.items():
        live_agents[name] = agent.get_dashboard_status()

    # Update existing agents with live status
    # IMPORTANT: Only overlay status (idle→working) and add liveTask.
    # Do NOT clobber agent_data["message"] — agent_status.py computes rich
    # summaries from disk data that are more useful than transient _current_task.
    for agent_data in status.get("agents", []):
        agent_id = agent_data.get("id")
        if agent_id in live_agents:
            live = live_agents[agent_id]
            if live["active"]:
                agent_data["status"] = "working"
                agent_data["liveTask"] = live["message"]
            # Overlay personality speech bubble if available
            if live.get("speech"):
                agent_data["speech"] = live["speech"]
            # Always overlay runtime stats
            agent_data["cycles"] = live.get("cycles", 0)
            agent_data["errors"] = live.get("errors", 0)
            if live.get("paused"):
                agent_data["status"] = "paused"
            # Overlay editor_state for sprite animation
            if "editor_state" in live:
                agent_data["editor_state"] = live["editor_state"]

    # Add editor and designer if not already present
    for extra in ["editor", "designer"]:
        if extra in live_agents:
            existing_ids = {a["id"] for a in status.get("agents", [])}
            if extra not in existing_ids:
                live = live_agents[extra]
                color = "#f5c842" if extra == "editor" else "#e91e63"
                role = "Supervises pipeline strategy" if extra == "editor" else "Designs Phase 3 website"
                status.setdefault("agents", []).append({
                    "id": extra,
                    "name": extra.title(),
                    "role": role,
                    "status": "working" if live["active"] else "idle",
                    "message": live["message"],
                    "color": color,
                    "deskItems": [],
                    "progress": live["progress"],
                })

    # Overlay Researcher's live task into notable_finds for "investigating" status
    if "researcher" in live_agents:
        r_task = live_agents["researcher"].get("message", "")
        if "Investigating" in r_task:
            investigating_name = r_task.split("Investigating ")[-1].split(" (")[0].lower().strip()
            for find in status.get("notable_finds", []):
                if find["name"].lower().strip().startswith(investigating_name[:8]):
                    find["research"] = "investigating"

    # Overlay now_processing with live agent tasks
    # agent_status.py infers generic messages from counts ("Downloading (87 remaining)")
    # but we have the actual current task from each running agent
    if "now_processing" in status:
        for agent_id, live in live_agents.items():
            if agent_id in status["now_processing"]:
                if live["active"] and live.get("message"):
                    status["now_processing"][agent_id] = {
                        "task": live["message"],
                        "active": True,
                    }
                elif live.get("paused"):
                    status["now_processing"][agent_id] = {
                        "task": "Paused",
                        "active": False,
                    }

    # Add Editor's task board to status
    if "editor" in live_agents:
        editor_live = live_agents["editor"]
        task_board = editor_live.get("task_board", {})
        cost = editor_live.get("cost", {})
        status["task_board"] = task_board
        status["editor_cost"] = cost

    # Add live activity log entries from agent_activity.log
    # These are real timestamped events (e.g., "Downloaded AD Nov 2013")
    # and replace the static summary lines from agent_status.py
    if os.path.exists(LOG_PATH):
        try:
            with open(LOG_PATH) as f:
                lines = f.readlines()
            recent = lines[-20:]  # Last 20 entries
            live_log = []
            for line in recent:
                parts = line.strip().split("|", 3)
                if len(parts) == 4:
                    timestamp, agent, level, message = parts
                    if level in ("INFO", "WARN", "ERROR"):
                        live_log.append({
                            "time": timestamp.split(" ")[1] if " " in timestamp else timestamp,
                            "agent": agent.title(),
                            "event": message,
                        })
            if live_log:
                status["log"] = live_log
        except Exception:
            pass

    # Write status
    os.makedirs(os.path.dirname(STATUS_PATH), exist_ok=True)
    with open(STATUS_PATH, "w") as f:
        json.dump(status, f)


def process_commands(agents):
    """Read agent_commands.json, execute unprocessed pause/resume commands.

    Note: In the hub-and-spoke model, the Editor also reads human_messages.json
    for strategic instructions. This function handles low-level pause/resume commands
    from the dashboard that need to bypass the Editor (e.g., emergency pause).
    """
    if not os.path.exists(COMMANDS_PATH):
        return

    try:
        with open(COMMANDS_PATH) as f:
            commands = json.load(f)
    except (json.JSONDecodeError, IOError):
        return

    changed = False
    for cmd in commands:
        if cmd.get("processed"):
            continue

        agent_id = cmd.get("agent")
        action = cmd.get("command")
        agent = agents.get(agent_id)

        if agent and action == "pause":
            agent.pause()
            print(f"  [ORCHESTRATOR] Paused {agent_id} (from dashboard)")
        elif agent and action == "resume":
            agent.resume()
            print(f"  [ORCHESTRATOR] Resumed {agent_id} (from dashboard)")
        else:
            print(f"  [ORCHESTRATOR] Unknown command: {action} for {agent_id}")

        cmd["processed"] = True
        changed = True

    if changed:
        with open(COMMANDS_PATH, "w") as f:
            json.dump(commands, f)


async def status_loop(agents, interval=5):
    """Periodically write status.json and process dashboard commands.

    If an Editor is running, its _status_refresh event triggers an immediate
    refresh (e.g., after committing features to Supabase) instead of waiting
    for the full 5-second interval.
    """
    editor = agents.get("editor")
    refresh_event = getattr(editor, '_status_refresh', None) if editor else None
    while True:
        process_commands(agents)
        await write_status(agents)

        if refresh_event:
            try:
                await asyncio.wait_for(refresh_event.wait(), timeout=interval)
                refresh_event.clear()
            except asyncio.TimeoutError:
                pass  # Normal 5s tick
        else:
            await asyncio.sleep(interval)


async def run_single_pass(agents):
    """Run all agents once, wait for them to complete one cycle, then exit."""
    print("\n=== AD-Epstein Pipeline — Single Pass Mode ===\n")
    print(f"Running agents: {', '.join(agents.keys())}\n")

    tasks = {}
    for name, agent in agents.items():
        tasks[name] = asyncio.create_task(agent.run())

    # Write status once at start
    await write_status(agents)

    # Wait for all agents to complete at least one work cycle
    # In single-pass, we wait a reasonable time then stop
    max_wait = 300  # 5 minutes max for single pass
    elapsed = 0
    while elapsed < max_wait:
        await asyncio.sleep(5)
        elapsed += 5
        process_commands(agents)
        await write_status(agents)

        # Check if all agents have completed at least one cycle
        all_cycled = all(a._cycles >= 1 for a in agents.values())
        all_idle = all(not a._active for a in agents.values())
        if all_cycled and all_idle:
            break

    # Stop all agents
    for agent in agents.values():
        agent.stop()

    # Wait for tasks to finish
    await asyncio.gather(*tasks.values(), return_exceptions=True)

    # Final status write
    await write_status(agents)
    print("\n=== Single pass complete ===\n")


async def run_daemon(agents):
    """Run agents continuously until interrupted."""
    print("\n=== AD-Epstein Pipeline — Daemon Mode ===\n")
    print(f"Running agents: {', '.join(agents.keys())}")
    print("Press Ctrl+C to stop.\n")

    # Start all agent loops
    tasks = {}
    for name, agent in agents.items():
        tasks[name] = asyncio.create_task(agent.run())

    # Start status update loop
    status_task = asyncio.create_task(status_loop(agents, interval=5))

    # Set up signal handlers for graceful shutdown
    loop = asyncio.get_event_loop()
    shutdown_event = asyncio.Event()

    def handle_signal():
        print("\n\nShutting down gracefully...")
        for agent in agents.values():
            agent.stop()
        shutdown_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, handle_signal)

    # Wait for shutdown signal
    await shutdown_event.wait()

    # Cancel status loop
    status_task.cancel()

    # Wait for all agents to finish current work
    await asyncio.gather(*tasks.values(), return_exceptions=True)

    # Final status write
    await write_status(agents)
    print("\n=== Daemon stopped ===\n")


def main():
    args = parse_args()

    # Determine which agents to run
    if args.agents:
        agent_names = [a.strip() for a in args.agents.split(",")]
    else:
        agent_names = list(AGENT_CLASSES.keys())

    include_editor = not args.no_editor and "editor" in agent_names

    # Remove editor from the list if --no-editor (it gets created separately)
    if args.no_editor and "editor" in agent_names:
        agent_names.remove("editor")

    agents = create_agents(agent_names, include_editor=include_editor)

    if not agents:
        print("No agents to run.")
        return

    if args.daemon:
        asyncio.run(run_daemon(agents))
    else:
        asyncio.run(run_single_pass(agents))


if __name__ == "__main__":
    main()
