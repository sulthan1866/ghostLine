import * as vscode from "vscode";

import { COMPLETION_SYSTEM_PROMPT } from "./constant/completion.constant";
import { ClaudeBinaryLib } from "./libs/claude/claudeBinary.lib";
import { ClaudeEngineService } from "./services/claude/claudeEngine.service";
import { ModelCatalogService } from "./services/claude/modelCatalog.service";
import { InlineProviderService } from "./services/completion/inlineProvider.service";
import { ConfigStoreService } from "./services/config/configStore.service";
import { NextEditService } from "./services/nextEdit/nextEdit.service";
import { StatusMenuService } from "./services/ui/statusMenu.service";

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel("Ghostline");
  const config = new ConfigStoreService();
  const getConfig = () => config.current;

  // The menu works without the CLI, so settings can still be changed.
  const menu = new StatusMenuService(config, log);
  context.subscriptions.push(
    log,
    config,
    menu,
    config.onDidChange(() => menu.render()),
  );

  const binaryPath = ClaudeBinaryLib.resolve();
  if (!binaryPath) {
    void vscode.window.showWarningMessage("Ghostline: Claude Code CLI not found. Install the Claude Code extension.");
    return;
  }
  log.appendLine(`Using Claude Code CLI at ${binaryPath}`);
  menu.setModelCatalog(new ModelCatalogService(binaryPath));

  const engine = new ClaudeEngineService(binaryPath, config.current, log, "complete", COMPLETION_SYSTEM_PROMPT);
  const provider = new InlineProviderService(
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
