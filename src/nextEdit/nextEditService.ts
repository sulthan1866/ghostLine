import * as vscode from "vscode";

import { ClaudeEngine } from "../claude/claudeEngine";
import { CompletionConfig } from "../config/configStore";
import { StatusMenu } from "../ui/statusMenu";
import { NextEditController } from "./nextEditController";
import { NEXT_EDIT_SYSTEM_PROMPT } from "./prompt";

const BUSY_SOURCE = "nextEdit";

interface RunningFeature {
  engine: ClaudeEngine;
  controller: NextEditController;
  subscriptions: vscode.Disposable[];
}

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
    private readonly menu: StatusMenu,
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
    const engine = new ClaudeEngine(this.binaryPath, config, this.log, BUSY_SOURCE, NEXT_EDIT_SYSTEM_PROMPT);
    this.allowedCreditModels.forEach((model) => engine.allowUsageCredits(model));
    const controller = new NextEditController(
      engine,
      this.getConfig,
      () => this.menu.isPaused(),
      (busy) => this.menu.setBusy(BUSY_SOURCE, busy),
    );
    return { engine, controller, subscriptions: [engine.onBlocked((event) => this.menu.block(event))] };
  }

  private stop(): void {
    if (this.running) {
      this.running.subscriptions.forEach((d) => d.dispose());
      this.running.controller.dispose();
      this.running.engine.dispose();
      this.running = undefined;
      this.menu.setBusy(BUSY_SOURCE, false);
    }
  }

  dispose(): void {
    this.stop();
  }
}
