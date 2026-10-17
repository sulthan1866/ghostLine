import * as vscode from "vscode";

import { BlockedEvent, needsCredits } from "../claude/blockedEvent";
import { ClaudeModelInfo, ModelCatalog } from "../claude/modelCatalog";
import { ConfigStore } from "../config/configStore";
import { COMMANDS, CONFIG_SECTION } from "../constants";
import { describeBlocked, showBlockedPrompt } from "./blockedPrompt";
import { pickModel } from "./modelPicker";
import { Snooze } from "./snooze";
import { buildStatusTooltip } from "./statusTooltip";

const SNOOZE_MS = 5 * 60 * 1000;

/**
 * Copilot-style status bar entry: a hover card with links for toggling
 * suggestions, picking the model and snoozing. Also tracks whether suggestions
 * are paused (snoozed, or the model cannot be used).
 */
export class StatusMenu implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  private readonly disposables: vscode.Disposable[] = [];
  private readonly snooze = new Snooze(SNOOZE_MS, () => this.render());
  private readonly busy = new Set<string>();
  private catalog?: ModelCatalog;
  private models: ClaudeModelInfo[] = [];
  /** Set when the current model cannot be used headlessly (e.g. it needs usage credits). */
  private blocked?: BlockedEvent;
  /** Models seen needing usage credits this session, flagged in the model picker. */
  private readonly creditModels = new Set<string>();
  private readonly allowCredits = new vscode.EventEmitter<string>();
  /** Fires with a model the user agreed to run on usage credits. */
  readonly onDidAllowUsageCredits = this.allowCredits.event;

  constructor(
    private readonly config: ConfigStore,
    private readonly log: vscode.OutputChannel,
  ) {
    // VS Code only highlights status bar items that have a command; a no-op one keeps
    // the hover highlight without a click action (extensions cannot open the tooltip on click).
    this.item.command = COMMANDS.statusClick;
    this.item.show();
    this.disposables.push(
      this.item,
      this.snooze,
      ...this.registerCommands(),
      vscode.window.onDidChangeActiveTextEditor(() => this.render()),
    );
    this.render();
  }

  private registerCommands(): vscode.Disposable[] {
    const register = (command: string, callback: () => unknown) => vscode.commands.registerCommand(command, callback);
    return [
      register(COMMANDS.statusClick, () => undefined),
      register(COMMANDS.toggle, () => this.config.update("enabled", !this.config.current.enabled)),
      register(COMMANDS.toggleLanguage, () => this.toggleLanguage()),
      register(COMMANDS.toggleNextEdit, () =>
        this.config.update("nextEditSuggestions", !this.config.current.nextEditSuggestions),
      ),
      register(COMMANDS.selectModel, () => this.selectModel()),
      register(COMMANDS.snooze, () => this.toggleSnooze()),
      register(COMMANDS.retry, () => this.retry()),
      register(COMMANDS.openSettings, () =>
        vscode.commands.executeCommand("workbench.action.openSettings", CONFIG_SECTION),
      ),
    ];
  }

  /** Set once the CLI is found, so the model picker can list the account's models. */
  setModelCatalog(catalog: ModelCatalog): void {
    this.catalog = catalog;
    // Warm the cache before the picker opens.
    void catalog.list().then((models) => (this.models = models));
  }

  /** True while suggestions should not be requested: snoozed, or the model is unusable. */
  isPaused(): boolean {
    return this.snooze.isActive() || this.isBlocked();
  }

  /** Pauses suggestions for the current model and asks the user what to do, once per model. */
  block(event: BlockedEvent): void {
    if (event.model !== this.config.current.model || this.blocked?.model === event.model) {
      return;
    }
    this.blocked = event;
    if (needsCredits(event.kind)) {
      this.creditModels.add(event.model);
    }
    this.render();
    void this.promptBlocked(event);
  }

  /** Shows the spinner while any source (inline completions, next edits) has a request running. */
  setBusy(source: string, busy: boolean): void {
    if (busy) {
      this.busy.add(source);
    } else {
      this.busy.delete(source);
    }
    this.render();
  }

  render(): void {
    const config = this.config.current;
    if (this.blocked && this.blocked.model !== config.model) {
      this.blocked = undefined; // a different model was chosen
    }
    const language = this.activeLanguage();
    const languageOff = language !== undefined && config.excludedLanguages.includes(language);
    this.item.text = `${this.icon(languageOff)} Ghostline`;
    this.item.tooltip = buildStatusTooltip({
      config,
      language,
      languageOff,
      snoozedUntil: this.snooze.isActive() ? this.snooze.endTime() : undefined,
      paused: this.blocked
        ? {
            reason: describeBlocked(this.blocked, this.modelName(this.blocked.model)),
            needsCredits: needsCredits(this.blocked.kind),
          }
        : undefined,
    });
  }

  private icon(languageOff: boolean): string {
    if (this.busy.size > 0) {
      return "$(loading~spin)";
    }
    if (!this.config.current.enabled || languageOff) {
      return "$(circle-slash)";
    }
    if (this.isBlocked()) {
      return "$(warning)";
    }
    return this.snooze.isActive() ? "$(clock)" : "$(sparkle)";
  }

  private async selectModel(): Promise<void> {
    const current = this.config.current.model;
    const catalog = this.catalog;
    const model = await pickModel(current, async () => (catalog ? catalog.list() : []), this.creditModels);
    if (model === current && this.isBlocked()) {
      this.retry(); // picked the paused model again: ask once more on the next suggestion
    } else if (model && model !== current) {
      await this.config.update("model", model);
      vscode.window.setStatusBarMessage(`Ghostline: using ${model}`, 3000);
    }
  }

  private isBlocked(): boolean {
    return this.blocked !== undefined && this.blocked.model === this.config.current.model;
  }

  private retry(): void {
    this.blocked = undefined;
    this.render();
  }

  private async promptBlocked(event: BlockedEvent): Promise<void> {
    this.log.appendLine(`[blocked] ${event.kind} on ${event.model}: ${event.detail ?? ""}`);
    await showBlockedPrompt(event, this.modelName(event.model), {
      allowCredits: () => {
        this.allowCredits.fire(event.model);
        this.retry();
      },
      chooseAnotherModel: () => this.selectModel(),
    });
  }

  private modelName(model: string): string {
    return this.models.find((info) => info.value === model)?.displayName ?? model;
  }

  private async toggleLanguage(): Promise<void> {
    const language = this.activeLanguage();
    if (!language) {
      return;
    }
    const excluded = this.config.current.excludedLanguages;
    const next = excluded.includes(language) ? excluded.filter((id) => id !== language) : [...excluded, language];
    await this.config.update("excludedLanguages", next);
  }

  private toggleSnooze(): void {
    this.snooze.toggle();
    this.render();
  }

  private activeLanguage(): string | undefined {
    return vscode.window.activeTextEditor?.document.languageId;
  }

  dispose(): void {
    this.allowCredits.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
