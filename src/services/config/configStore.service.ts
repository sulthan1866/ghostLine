import * as vscode from "vscode";

import { CONFIG_SECTION } from "../../constant/extension.constant";
import { ConfigLib } from "../../libs/config/config.lib";
import type { CompletionConfig } from "../../types/interfaces/config.interface";

/** Holds the current settings, re-reads them when they change, and writes them back. */
export class ConfigStoreService implements vscode.Disposable {
  private config = ConfigLib.read();
  private readonly changed = new vscode.EventEmitter<CompletionConfig>();
  /** Fires after any `ghostline.*` setting changes, in the order listeners subscribed. */
  readonly onDidChange = this.changed.event;
  private readonly listener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration(CONFIG_SECTION)) {
      this.config = ConfigLib.read();
      this.changed.fire(this.config);
    }
  });

  get current(): CompletionConfig {
    return this.config;
  }

  /** Writes where the setting is currently defined, so a workspace value isn't left overriding the change. */
  update(key: keyof CompletionConfig, value: unknown): Thenable<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const target =
      config.inspect(key)?.workspaceValue !== undefined
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
    return config.update(key, value, target);
  }

  dispose(): void {
    this.listener.dispose();
    this.changed.dispose();
  }
}
