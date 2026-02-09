"""
Dashboard API Server — serves static files + inbox API.

Replaces `python -m http.server` with a server that also handles
POST /api/inbox for human-to-Editor communication.

Usage:
    python3 src/dashboard_server.py              # Port 8787
    python3 src/dashboard_server.py --port 9000  # Custom port
"""

import json
import os
import sys
import time
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

BASE_DIR = os.path.join(os.path.dirname(__file__), "..")
DATA_DIR = os.path.join(BASE_DIR, "data")
HUMAN_MESSAGES_PATH = os.path.join(DATA_DIR, "human_messages.json")
SKILLS_DIR = os.path.join(BASE_DIR, "src", "agents", "skills")
AGENT_COMMANDS_PATH = os.path.join(DATA_DIR, "agent_commands.json")


class DashboardHandler(SimpleHTTPRequestHandler):
    """Serves static files from project root + handles API endpoints."""

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/skills":
            self._handle_skills_list()
        elif parsed.path.startswith("/api/skills/"):
            agent_name = parsed.path.split("/")[-1]
            self._handle_skills_get(agent_name)
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/inbox":
            self._handle_inbox_post()
        elif parsed.path.startswith("/api/skills/"):
            agent_name = parsed.path.split("/")[-1]
            self._handle_skills_save(agent_name)
        elif parsed.path.startswith("/api/agent/") and parsed.path.endswith("/pause"):
            agent_id = parsed.path.split("/")[3]
            self._handle_agent_command(agent_id, "pause")
        elif parsed.path.startswith("/api/agent/") and parsed.path.endswith("/resume"):
            agent_id = parsed.path.split("/")[3]
            self._handle_agent_command(agent_id, "resume")
        else:
            self.send_error(404, "Not found")

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _handle_inbox_post(self):
        """Receive a message from the human and append to human_messages.json."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)
        except (json.JSONDecodeError, ValueError):
            self.send_error(400, "Invalid JSON")
            return

        text = data.get("text", "").strip()
        if not text:
            self.send_error(400, "Empty message")
            return

        # Read existing messages
        messages = []
        if os.path.exists(HUMAN_MESSAGES_PATH):
            try:
                with open(HUMAN_MESSAGES_PATH) as f:
                    messages = json.load(f)
            except (json.JSONDecodeError, IOError):
                messages = []

        # Append new message
        now = datetime.now()
        messages.append({
            "time": now.strftime("%H:%M"),
            "timestamp": now.isoformat(),
            "text": text,
            "read": False,
        })

        # Cap at 100 messages
        if len(messages) > 100:
            messages = messages[-100:]

        # Write back
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(HUMAN_MESSAGES_PATH, "w") as f:
            json.dump(messages, f)

        # Respond
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode())

    def _handle_skills_list(self):
        """Return list of available agent skills files."""
        skills = []
        if os.path.exists(SKILLS_DIR):
            for fname in sorted(os.listdir(SKILLS_DIR)):
                if fname.endswith(".md"):
                    agent_name = fname[:-3]
                    skills.append({"agent": agent_name, "file": fname})

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps({"skills": skills}).encode())

    def _handle_skills_get(self, agent_name):
        """Return the contents of a specific agent's skills file."""
        # Sanitize agent_name to prevent path traversal
        safe_name = os.path.basename(agent_name)
        skills_path = os.path.join(SKILLS_DIR, f"{safe_name}.md")

        if not os.path.exists(skills_path):
            self.send_error(404, f"No skills file for '{safe_name}'")
            return

        try:
            with open(skills_path) as f:
                content = f.read()
        except IOError:
            self.send_error(500, "Failed to read skills file")
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps({
            "agent": safe_name,
            "content": content,
        }).encode())

    def _handle_skills_save(self, agent_name):
        """Save updated content to an agent's skills file."""
        safe_name = os.path.basename(agent_name)
        skills_path = os.path.join(SKILLS_DIR, f"{safe_name}.md")

        if not os.path.exists(skills_path):
            self.send_error(404, f"No skills file for '{safe_name}'")
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)
        except (json.JSONDecodeError, ValueError):
            self.send_error(400, "Invalid JSON")
            return

        content = data.get("content")
        if content is None:
            self.send_error(400, "Missing 'content' field")
            return

        try:
            with open(skills_path, "w") as f:
                f.write(content)
        except IOError as e:
            self.send_error(500, f"Failed to write skills file: {e}")
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True, "agent": safe_name}).encode())

    def _handle_agent_command(self, agent_id, command):
        """Queue a pause/resume command for an agent."""
        # Write command to a JSON file that the orchestrator reads
        commands = []
        if os.path.exists(AGENT_COMMANDS_PATH):
            try:
                with open(AGENT_COMMANDS_PATH) as f:
                    commands = json.load(f)
            except (json.JSONDecodeError, IOError):
                commands = []

        commands.append({
            "agent": agent_id,
            "command": command,
            "timestamp": datetime.now().isoformat(),
            "processed": False,
        })

        os.makedirs(DATA_DIR, exist_ok=True)
        with open(AGENT_COMMANDS_PATH, "w") as f:
            json.dump(commands, f)

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True, "command": command, "agent": agent_id}).encode())

    def log_message(self, format, *args):
        """Quieter logging — only show errors and POSTs."""
        if args and ("POST" in str(args[0]) or "404" in str(args[1]) if len(args) > 1 else False):
            super().log_message(format, *args)


def main():
    port = 8787
    if "--port" in sys.argv:
        idx = sys.argv.index("--port")
        port = int(sys.argv[idx + 1])

    # Change to project root so static files are served correctly
    os.chdir(BASE_DIR)

    server = HTTPServer(("", port), DashboardHandler)
    print(f"Dashboard server running at http://localhost:{port}")
    print(f"Open: http://localhost:{port}/tools/agent-office/agent-office.html")
    print("Press Ctrl+C to stop.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()


if __name__ == "__main__":
    main()
