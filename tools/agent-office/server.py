"""
Minimal HTTP server for the Agent Office dashboard.

Serves static files AND handles API endpoints so the dashboard
can send messages and commands to the orchestrator via JSON files.

Usage:
    python3 tools/agent-office/server.py          # Port 3000
    python3 tools/agent-office/server.py --port 8080
"""

import http.server
import json
import os
import sys
from datetime import datetime
from urllib.parse import urlparse

PORT = 3000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "..", "..", "data")
HUMAN_MESSAGES_PATH = os.path.join(DATA_DIR, "human_messages.json")
COMMANDS_PATH = os.path.join(DATA_DIR, "agent_commands.json")


class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    """Serve static files + handle API routes."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_POST(self):
        path = urlparse(self.path).path

        if path == "/api/inbox":
            self._handle_inbox()
        elif path == "/api/command":
            self._handle_command()
        elif path.startswith("/api/agent/"):
            # /api/agent/{id}/{command} — pause/resume from dashboard
            parts = path.split("/")  # ['', 'api', 'agent', '{id}', '{command}']
            if len(parts) == 5:
                self._handle_agent_command(parts[3], parts[4])
            else:
                self.send_error(400, "Invalid agent command path")
        else:
            self.send_error(404, "Not found")

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw)

    def _json_response(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _handle_inbox(self):
        """POST /api/inbox — save a human message for the Editor to read."""
        try:
            body = self._read_body()
            text = body.get("text", "").strip()
            if not text:
                self._json_response({"error": "Empty message"}, 400)
                return

            now = datetime.now()
            message = {
                "time": now.strftime("%H:%M"),
                "timestamp": now.isoformat(),
                "text": text,
                "sender": "human",
                "read": False,
            }

            # Read existing messages
            messages = []
            os.makedirs(DATA_DIR, exist_ok=True)
            if os.path.exists(HUMAN_MESSAGES_PATH):
                try:
                    with open(HUMAN_MESSAGES_PATH) as f:
                        messages = json.load(f)
                except Exception:
                    messages = []

            messages.append(message)

            with open(HUMAN_MESSAGES_PATH, "w") as f:
                json.dump(messages, f)

            self._json_response({"ok": True})

        except Exception as e:
            self._json_response({"error": str(e)}, 500)

    def _handle_agent_command(self, agent_id, command):
        """POST /api/agent/{id}/{command} — pause/resume from dashboard clicks."""
        if command not in ("pause", "resume"):
            self._json_response({"error": f"Unknown command: {command}"}, 400)
            return

        cmd = {
            "agent": agent_id,
            "command": command,
            "time": datetime.now().isoformat(),
            "processed": False,
        }

        commands = []
        os.makedirs(DATA_DIR, exist_ok=True)
        if os.path.exists(COMMANDS_PATH):
            try:
                with open(COMMANDS_PATH) as f:
                    commands = json.load(f)
            except Exception:
                commands = []

        commands.append(cmd)
        with open(COMMANDS_PATH, "w") as f:
            json.dump(commands, f)

        self._json_response({"ok": True, "agent": agent_id, "command": command})

    def _handle_command(self):
        """POST /api/command — queue an agent command (pause/resume)."""
        try:
            body = self._read_body()
            agent = body.get("agent", "")
            command = body.get("command", "")

            if not agent or command not in ("pause", "resume"):
                self._json_response({"error": "Invalid command"}, 400)
                return

            cmd = {
                "agent": agent,
                "command": command,
                "time": datetime.now().isoformat(),
                "processed": False,
            }

            # Read existing commands
            commands = []
            os.makedirs(DATA_DIR, exist_ok=True)
            if os.path.exists(COMMANDS_PATH):
                try:
                    with open(COMMANDS_PATH) as f:
                        commands = json.load(f)
                except Exception:
                    commands = []

            commands.append(cmd)

            with open(COMMANDS_PATH, "w") as f:
                json.dump(commands, f)

            self._json_response({"ok": True})

        except Exception as e:
            self._json_response({"error": str(e)}, 500)

    def log_message(self, format, *args):
        """Suppress request logging to keep output clean."""
        pass


def main():
    port = PORT
    if "--port" in sys.argv:
        idx = sys.argv.index("--port")
        port = int(sys.argv[idx + 1])

    server = http.server.HTTPServer(("", port), DashboardHandler)
    print(f"Dashboard server running at http://localhost:{port}/agent-office.html")
    print(f"API endpoints: POST /api/inbox, POST /api/command")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()


if __name__ == "__main__":
    main()
