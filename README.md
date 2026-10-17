# Ghostline

Copilot-style inline (ghost-text) completions in VS Code, powered by the Claude Code CLI you are already signed in to. Not affiliated with Anthropic.

## Requirements

- VS Code 1.90 or later.
- The official Claude Code extension (`anthropic.claude-code`), signed in. Ghostline uses the CLI it installs, so there is no separate API key to set up.

## Usage

- Suggestions appear as grey text while you type. Accept with **Tab**, dismiss with **Esc**, trigger manually with **Alt+\\** (VS Code's built-in shortcut).
- If what you type matches the current suggestion, the rest stays on screen without a new request.
- Hover over the **Ghostline** status-bar item to turn suggestions on or off (globally or for the current language), change the model or snooze for 5 minutes.
- Timings and CLI errors are written to the **Ghostline** channel in the Output panel.

## Next edit suggestions (optional)

Turn on with `ghostline.nextEditSuggestions` or from the status-bar hover card. After you pause typing (800 ms), Ghostline sends your recent edits and the code around the cursor to Claude and asks for one follow-up edit, such as updating other uses of something you just renamed, or fixing a typo in what you just wrote (`retrun totl;` → `return total;`). Unfinished words on the line you are typing are left alone.

- Small one-line changes such as typo fixes are shown in place: wrong characters are struck through in red and missing ones appear in green (`ret+u+r-u-n`). Bigger changes show the old lines red with strikethrough and the new text in green after the line. Hover to see the full diff.
- **Tab** accepts the edit (or first jumps to it when it is off-screen); **Esc** dismisses it. Accepting can lead to a further suggestion.
- Sends an extra request after each pause, so it roughly doubles usage while it is on.

## Commands

All available from the Command Palette:

| Command | What it does |
| --- | --- |
| Ghostline: Toggle Inline Completions | Turn suggestions on or off everywhere |
| Ghostline: Toggle for Current Language | Turn suggestions on or off for the active file's language |
| Ghostline: Select Model | Choose the model used for suggestions |
| Ghostline: Snooze / Resume | Pause suggestions for 5 minutes, or resume |
| Ghostline: Toggle Next Edit Suggestions | Turn next edit suggestions on or off |
| Ghostline: Open Settings | Open Ghostline's settings |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `ghostline.enabled` | `true` | Enable inline completions. |
| `ghostline.nextEditSuggestions` | `false` | Suggest follow-up edits near the cursor. |
| `ghostline.debounceMs` | `350` | Pause in typing (ms) before a completion is requested. |
| `ghostline.useNeighbourFiles` | `true` | Include similar snippets from other open files of the same language. |
| `ghostline.excludedLanguages` | `plaintext`, `scminput`, `log` | Language IDs where completions are disabled. |

## Privacy and usage

- Only the code around the cursor and short snippets from other open files of the same language are sent. Settings, output and git views never are.
- Files that commonly hold credentials (`.env*`, `.npmrc`, `*.pem`, `*.key`, `credentials`, `secrets.*` and similar) are never sent or used as related snippets, whatever `excludedLanguages` is set to.
- Every completion counts against your Claude Code plan's usage limits.
- Models that run on usage credits (for example Fable 5.1) ask before anything is sent. A "Switch to <model>?" popup lets you use usage credits (only offered when credits are turned on), choose another model, or leave suggestions paused for that model. Reaching your plan's usage limit shows the same popup without the credits option.
- One idle Claude Code CLI process is kept running in the background so suggestions appear quickly.
- Check Anthropic's current terms and your organisation's policy before using Ghostline on work code.

## Troubleshooting

- **"Claude Code CLI not found"** – install the Claude Code extension and sign in, then reload the window.
- **No suggestions** – check the status-bar item is not paused or snoozed, that the language is not excluded, and look in the **Ghostline** output channel for errors.
- **Slow suggestions** – use a fast model such as `haiku`, or increase `ghostline.debounceMs` if requests are firing too often.
