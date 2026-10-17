# Ghostline

Copilot-style inline (ghost-text) completions in VS Code, powered by the Claude Code CLI you are already signed in to. Not affiliated with Anthropic.

## How it works

1. **Trigger** – VS Code calls the `InlineCompletionItemProvider` as you type.
2. **Typing-through cache** – if what you type matches the current suggestion, the rest is shown instantly with no model call.
3. **Debounce** – waits for a pause (default 350 ms); VS Code cancels stale requests automatically.
4. **Context** – code before/after the cursor (fill-in-the-middle) plus the most similar 40-line windows from other open files of the same language (Jaccard similarity, as Copilot does).
5. **Model call** – a pre-warmed `claude -p --input-format stream-json` process (tools disabled, empty working directory, short custom system prompt) answers once and exits. A fresh spare is spawned immediately, so start-up time is hidden while you type.
6. **Post-processing** – strips tags/fences, duplicate indentation, repeated line starts and trailing lines that already exist after the cursor; single line only when the cursor is mid-line.

## Build and install

```bash
npm install
npm run lint               # ESLint + Prettier check
npm test                   # Jest unit tests
npm run compile
npm run package            # produces ghostline-0.1.0.vsix
code --install-extension ghostline-0.1.0.vsix
```

Or open the folder in VS Code and press F5 to try it in an Extension Development Host.

Requires the official Claude Code extension (`anthropic.claude-code`), signed in.

## Usage

- Accept with Tab, dismiss with Esc, trigger manually with Alt+\ (VS Code's built-in shortcut).
- Hover over the **Ghostline** status-bar item to turn suggestions on or off (globally or for the current language), change the model or snooze for 5 minutes.
- Timings and CLI errors are written to the **Ghostline** channel in the Output panel.

## Next edit suggestions (optional)

Turn on with `ghostline.nextEditSuggestions` or from the status-bar hover card. After you pause typing (800 ms), Ghostline sends your recent edits and the code around the cursor to Claude and asks for one follow-up edit, such as updating other uses of something you just renamed, or fixing a typo in what you just wrote (`retrun totl;` → `return total;`). Unfinished words on the line you are typing are left alone.

- Small one-line changes such as typo fixes are shown in place: wrong characters are struck through in red and missing ones appear in green (`ret+u+r-u-n`). Bigger changes show the old lines red with strikethrough and the new text in green after the line. Hover to see the full diff.
- **Tab** accepts the edit (or first jumps to it when it is off-screen); **Esc** dismisses it. Accepting can lead to a further suggestion.
- Built only on the public VS Code API (decorations and normal edits), so it works in any VS Code and can be published.
- Uses a second CLI process and an extra request after each pause, so it roughly doubles usage while it is on.

## Settings (`ghostline.*`)

`enabled`, `model` (default `haiku`), `nextEditSuggestions` (default off), `debounceMs`, `useNeighbourFiles`, `excludedLanguages`.

## Caveats

- Only files on disk and unsaved buffers are sent; settings, output and git views never are. Files that commonly hold credentials (`.env*`, `.npmrc`, `*.pem`, `*.key`, `credentials`, `secrets.*` and similar) are never sent or used as related snippets.
- Every completion counts against your Claude Code plan's usage limits.
- Models that run on usage credits (for example Fable 5.1) ask before anything is sent. Ghostline shows a "Switch to <model>?" popup: use usage credits (only offered when credits are turned on), choose another model, or leave suggestions paused for that model. Reaching your plan's usage limit shows the same popup without the credits option.
- One idle CLI process is kept running at all times.
- If your CLI version rejects `--system-prompt` or `--safe-mode`, remove them in `src/claude/cliProtocol.ts` (or use `--append-system-prompt`).
- Check Anthropic's current terms and your organisation's policy before using on work code.
