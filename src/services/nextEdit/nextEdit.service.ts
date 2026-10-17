import * as vscode from "vscode";

import { NEXT_EDIT_BUSY_SOURCE, NEXT_EDIT_SYSTEM_PROMPT } from "../../constant/nextEdit.constant";
import type { CompletionConfig } from "../../types/interfaces/config.interface";
import type { RunningFeature } from "../../types/interfaces/nextEdit.interface";
import { ClaudeEngineService } from "../claude/claudeEngine.service";
import type { SuggestionRouterService } from "../routing/suggestionRouter.service";
import type { StatusMenuService } from "../ui/statusMenu.service";
import { NextEditControllerService } from "./nextEditController.service";

/**
 * Starts and stops next edit suggestions with the setting. They get their own CLI
 * process (different system prompt), which only runs while the feature is on.
 */
export class NextEditService implements vscode.Disposable {
  private running?: RunningFeature;
  /** Remembered so an engine started later also answers the usage-credit prompt for these models. */
  private readonly allowedCreditModels = new Set<string>();

  constructor(
    private readonly binaryPath: string,
    private readonly getConfig: () => CompletionConfig,
    private readonly log: vscode.OutputChannel,
    private readonly menu: StatusMenuService,
    private readonly router: SuggestionRouterService,
  ) {
    this.sync();
  }

  /** Starts or stops the feature to match the current settings, and passes them on. */
  sync(): void {
    const config = this.getConfig();
    if (config.nextEditSuggestions && !this.running) {
      this.running = this.start(config);
    } else if (!config.nextEditSuggestions && this.running) {
      this.stop();
    }
    this.running?.engine.updateConfig(config);
  }

  allowUsageCredits(model: string): void {
    this.allowedCreditModels.add(model);
    this.running?.engine.allowUsageCredits(model);
  }

  private start(config: CompletionConfig): RunningFeature {
    const engine = new ClaudeEngineService(
      this.binaryPath,
      config,
      this.log,
      NEXT_EDIT_BUSY_SOURCE,
      NEXT_EDIT_SYSTEM_PROMPT,
    );
    this.allowedCreditModels.forEach((model) => engine.allowUsageCredits(model));
    const controller = new NextEditControllerService(
      engine,
      this.getConfig,
      () => this.menu.isPaused(),
      (document) => this.router.allows(document, "nextEdit"),
      (busy) => this.menu.setBusy(NEXT_EDIT_BUSY_SOURCE, busy),
    );
    return { engine, controller, subscriptions: [engine.onBlocked((event) => this.menu.block(event))] };
  }

  private stop(): void {
    if (this.running) {
      this.running.subscriptions.forEach((d) => d.dispose());
      this.running.controller.dispose();
      this.running.engine.dispose();
      this.running = undefined;
      this.menu.setBusy(NEXT_EDIT_BUSY_SOURCE, false);
    }
  }

  dispose(): void {
    this.stop();
  }
}
