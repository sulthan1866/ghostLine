import * as vscode from "vscode";

import { resolveClaudeBinary } from "./claude/binary";
import { ClaudeEngine } from "./claude/claudeEngine";
import { ModelCatalog } from "./claude/modelCatalog";
import { ClaudeInlineProvider } from "./completion/inlineProvider";
import { COMPLETION_SYSTEM_PROMPT } from "./completion/prompt";
import { ConfigStore } from "./config/configStore";
import { NextEditService } from "./nextEdit/nextEditService";
import { StatusMenu } from "./ui/statusMenu";

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel("Ghostline");
  const config = new ConfigStore();
  const getConfig = () => config.current;

  // The menu works without the CLI, so settings can still be changed.
  const menu = new StatusMenu(config, log);
  context.subscriptions.push(
    log,
    config,
    menu,
    config.onDidChange(() => menu.render()),
  );

  const binaryPath = resolveClaudeBinary();
  if (!binaryPath) {
    void vscode.window.showWarningMessage("Ghostline: Claude Code CLI not found. Install the Claude Code extension.");
    return;
  }
  log.appendLine(`Using Claude Code CLI at ${binaryPath}`);
  menu.setModelCatalog(new ModelCatalog(binaryPath));

  const engine = new ClaudeEngine(binaryPath, config.current, log, "complete", COMPLETION_SYSTEM_PROMPT);
  const provider = new ClaudeInlineProvider(
    engine,
    getConfig,
    () => menu.isPaused(),
    (busy) => menu.setBusy("complete", busy),
  );
  const nextEdit = new NextEditService(binaryPath, getConfig, log, menu);

  context.subscriptions.push(
    engine,
    engine.onBlocked((event) => menu.block(event)),
    config.onDidChange((current) => {
      engine.updateConfig(current);
      nextEdit.sync();
    }),
    menu.onDidAllowUsageCredits((model) => {
      engine.allowUsageCredits(model);
      nextEdit.allowUsageCredits(model);
    }),
    vscode.languages.registerInlineCompletionItemProvider([{ scheme: "file" }, { scheme: "untitled" }], provider),
    nextEdit,
  );
}

export function deactivate(): void {}
