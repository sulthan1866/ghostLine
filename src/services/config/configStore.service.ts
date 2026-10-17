import * as vscode from "vscode";

import { DEFAULT_MODEL, MODEL_STATE_KEY } from "../../constant/config.constant";
import { CONFIG_SECTION } from "../../constant/extension.constant";
import { ConfigLib } from "../../libs/config/config.lib";
import type { CompletionConfig } from "../../types/interfaces/config.interface";

/**
 * Holds the current settings, re-reads them when they change, and writes them back.
 * The model lives in global state rather than settings, so it can only be set from the model picker.
 */
export class ConfigStoreService implements vscode.Disposable {
  private config: CompletionConfig;
  private readonly changed = new vscode.EventEmitter<CompletionConfig>();
  /** Fires after any `ghostline.*` setting or the model changes, in the order listeners subscribed. */
  readonly onDidChange = this.changed.event;
  private readonly listener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration(CONFIG_SECTION)) {
      this.reload();
    }
  });

  constructor(private readonly state: vscode.ExtensionContext["globalState"]) {
    state.setKeysForSync([MODEL_STATE_KEY]);
    this.config = ConfigLib.read(this.model());
  }

  get current(): CompletionConfig {
    return this.config;
  }

  /** Writes where the setting is currently defined, so a workspace value isn't left overriding the change. */
  async update(key: keyof CompletionConfig, value: unknown): Promise<void> {
    if (key === "model") {
      await this.state.update(MODEL_STATE_KEY, value);
      this.reload();
      return;
    }
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const target =
      config.inspect(key)?.workspaceValue !== undefined
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
    await config.update(key, value, target);
  }

  /** Falls back to a `ghostline.model` left in settings.json from when it was a setting. */
  private model(): string {
    const legacy = vscode.workspace.getConfiguration(CONFIG_SECTION).get<string>("model");
    return this.state.get<string>(MODEL_STATE_KEY) ?? legacy ?? DEFAULT_MODEL;
  }

  private reload(): void {
    this.config = ConfigLib.read(this.model());
    this.changed.fire(this.config);
  }

  dispose(): void {
    this.listener.dispose();
    this.changed.dispose();
  }
}
