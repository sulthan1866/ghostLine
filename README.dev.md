# Ghostline – developer guide

Notes for working on Ghostline itself. For end-user documentation see [README.md](README.md).

## Setup

```bash
npm install
npm run compile
```

Open the folder in VS Code and press **F5** (the "Run Extension" launch configuration) to start an Extension Development Host. You need the Claude Code extension (`anthropic.claude-code`) installed and signed in there as well.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run compile` | Build TypeScript into `out/` |
| `npm run watch` | Rebuild on change |
| `npm run lint` | ESLint plus Prettier check over `src` and `test` |
| `npm run format` | Prettier write over `src` and `test` |
| `npm test` | Jest unit tests |
| `npm run package` | Produce `ghostline-<version>.vsix` |

Install a packaged build with:

```bash
code --install-extension ghostline-0.1.0.vsix
```

[Fallow](https://www.npmjs.com/package/fallow) is configured in [.fallowrc.json](.fallowrc.json) for unused-code, duplication and dependency checks (`npx fallow`).

## Project layout

```
src/
  extension.ts      activation: wires services together and registers them
  constant/         static values (CLI args, prompts, defaults, privacy patterns)
  services/         stateful classes, usually disposable, grouped by feature
  libs/             pure functions, grouped by feature
  types/
    interfaces/     *.interface.ts
    types/          *.type.ts
test/               mirrors src/ (libs/, services/)
```

Feature folders are `claude`, `completion`, `nextEdit`, `config`, `ui` and `shared`. File names follow `<name>.<kind>.ts`, for example `completionCache.service.ts` or `postProcess.lib.ts`. Keep logic that does not need VS Code or process state in `libs/` so it can be unit tested without mocks.

## How completions work

1. **Trigger** – VS Code calls the `InlineCompletionItemProvider` ([inlineProvider.service.ts](src/services/completion/inlineProvider.service.ts)) as you type.
2. **Typing-through cache** – if what you type matches the current suggestion, the rest is shown instantly with no model call ([completionCache.service.ts](src/services/completion/completionCache.service.ts)).
3. **Debounce** – waits for a pause (default 350 ms); VS Code cancels stale requests automatically.
4. **Context** – code before/after the cursor (fill-in-the-middle) plus the most similar 40-line windows from other open files of the same language, ranked by Jaccard similarity ([neighbourSnippets.lib.ts](src/libs/completion/neighbourSnippets.lib.ts)).
5. **Model call** – a pre-warmed `claude -p --input-format stream-json` process (tools disabled, empty working directory, short custom system prompt) answers once and exits. A fresh spare is spawned immediately, so start-up time is hidden while you type ([cliProcessPool.service.ts](src/services/claude/cliProcessPool.service.ts), [claudeEngine.service.ts](src/services/claude/claudeEngine.service.ts)).
6. **Post-processing** – strips tags/fences, duplicate indentation, repeated line starts and trailing lines that already exist after the cursor; single line only when the cursor is mid-line ([postProcess.lib.ts](src/libs/completion/postProcess.lib.ts)).

## Next edit suggestions

Implemented in [src/services/nextEdit/](src/services/nextEdit/) and [src/libs/nextEdit/](src/libs/nextEdit/). It runs on a second CLI process with its own system prompt, records recent edits ([editHistory.service.ts](src/services/nextEdit/editHistory.service.ts)), and previews the suggestion with plain editor decorations ([editDecoration.lib.ts](src/libs/nextEdit/editDecoration.lib.ts)). It uses only the public VS Code API, so no proposed APIs are needed and the extension can be published.

The `ghostline.editSuggestionVisible` context key drives the Tab/Esc keybindings in [package.json](package.json).

## Privacy guard

[privacy.lib.ts](src/libs/shared/privacy.lib.ts) and [privacy.constant.ts](src/constant/privacy.constant.ts) decide which documents may be sent. Any change here affects what leaves the user's machine, so add a test for it.

## CLI compatibility

CLI flags live in [claude.constant.ts](src/constant/claude.constant.ts); `--system-prompt` is added in [claudeEngine.service.ts](src/services/claude/claudeEngine.service.ts). If a CLI version rejects `--system-prompt` or `--safe-mode`, remove them there (or switch to `--append-system-prompt`). The binary is located by [claudeBinary.lib.ts](src/libs/claude/claudeBinary.lib.ts).

## Releasing

1. Bump `version` in [package.json](package.json).
2. `npm run lint && npm test && npm run compile`
3. `npm run package` and test the `.vsix` locally before publishing.

`README.dev.md` is excluded from the package via [.vscodeignore](.vscodeignore); `README.md` is what the Marketplace shows.
