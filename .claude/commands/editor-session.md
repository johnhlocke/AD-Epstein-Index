Open a new macOS Terminal window running Claude Code in this project, ready for an Editor Agent conversation.

Steps:
1. Determine the current project directory (the working directory of this session)
2. Use the Bash tool to run an `osascript` command that opens a new Terminal.app window
3. In that new window: `cd` to the project directory, print a brief banner, then start `claude`
4. Tell the user the window is open and to type `/talk-to-editor` there

The osascript command:
```
osascript -e 'tell application "Terminal" to do script "cd \"<PROJECT_DIR>\" && clear && printf \"\\n  \\033[1m📰 Editor Agent Session\\033[0m\\n  Type: /talk-to-editor <your message>\\n  The Editor will read pipeline state and respond as itself.\\n\\n\" && claude"'
```

Replace `<PROJECT_DIR>` with the actual project directory path (properly escaped for the nested quoting).

After running, tell the user:
- A new Terminal window has opened with Claude Code starting up
- Type `/talk-to-editor what's the pipeline status?` to start a conversation with the Editor
- The Editor will read Supabase, agent logs, escalations, and its own memory before responding
- It speaks in first person as the Editor agent — like talking to an AI newsroom coordinator
- They can work in both windows simultaneously — this session for code work, the new one for Editor conversations
