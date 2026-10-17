import * as vscode from "vscode";

import { COMPLETION_SYSTEM_PROMPT } from "./constant/completion.constant";
import { ClaudeBinaryLib } from "./libs/claude/claudeBinary.lib";
import { ClaudeEngineService } from "./services/claude/claudeEngine.service";
import { ModelCatalogService } from "./services/claude/modelCatalog.service";
import { InlineProviderService } from "./services/completion/inlineProvider.service";
import { ConfigStoreService } from "./services/config/configStore.service";
import { NextEditService } from "./services/nextEdit/nextEdit.service";
import { SuggestionRouterService } from "./services/routing/suggestionRouter.service";
import { StatusMenuService } from "./services/ui/statusMenu.service";

export function activate(context: vscode.ExtensionContext): void {
  const logger = vscode.window.createOutputChannel("Ghostline");
  const config = new ConfigStoreService(context.globalState);
  const getConfig = () => config.current;

  // The menu works without the CLI, so settings can still be changed.
  const menu = new StatusMenuService(config, logger);
  context.subscriptions.push(
    logger,
    config,
    menu,
    config.onDidChange(() => menu.render()),
  );

  const binaryPath = ClaudeBinaryLib.resolve();
  if (!binaryPath) {
    void vscode.window.showWarningMessage("Ghostline: Claude Code CLI not found. Install the Claude Code extension.");
    return;
  }
  logger.appendLine(`Using Claude Code CLI at ${binaryPath}`);
  menu.setModelCatalog(new ModelCatalogService(binaryPath));

  const engine = new ClaudeEngineService(binaryPath, config.current, logger, "complete", COMPLETION_SYSTEM_PROMPT);
  // Decides per edit whether completion or next edit asks the model, never both.
  const router = new SuggestionRouterService(getConfig);
  const provider = new InlineProviderService(
    engine,
    getConfig,
    () => menu.isPaused(),
    (document) => router.allows(document, "complete"),
    (busy) => menu.setBusy("complete", busy),
  );
  const nextEdit = new NextEditService(binaryPath, getConfig, logger, menu, router);

  context.subscriptions.push(
    router,
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
