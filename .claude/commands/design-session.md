Open a new macOS Terminal window running Claude Code in this project, ready for a Design Agent conversation.

Steps:
1. Determine the current project directory (the working directory of this session)
2. Use the Bash tool to run an `osascript` command that opens a new Terminal.app window
3. In that new window: `cd` to the project directory, print a brief banner, then start `claude`
4. Tell the user the window is open and to type `/design-agent` there

The osascript command:
```
osascript -e 'tell application "Terminal" to do script "cd \"<PROJECT_DIR>\" && clear && printf \"\\n  \\033[1m🎨 Design Agent Session\\033[0m\\n  Type: /design-agent\\n\\n\" && claude"'
```

Replace `<PROJECT_DIR>` with the actual project directory path (properly escaped for the nested quoting).

After running, tell the user:
- A new Terminal window has opened with Claude Code starting up
- Type `/design-agent` in the new window to begin the design conversation
- They can work in both windows simultaneously — this session for pipeline/agent work, the new one for design
