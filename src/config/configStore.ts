import * as vscode from "vscode";

import { CONFIG_SECTION } from "../constants";

/** Kept in step with the `ghostline.excludedLanguages` default in package.json. */
const DEFAULT_EXCLUDED_LANGUAGES = ["plaintext", "scminput", "log"];

export interface CompletionConfig {
  enabled: boolean;
  model: string;
  debounceMs: number;
  timeoutMs: number;
  maxPrefixChars: number;
  maxSuffixChars: number;
  maxLines: number;
  useNeighbourFiles: boolean;
  nextEditSuggestions: boolean;
  excludedLanguages: string[];
}

export function readConfig(): CompletionConfig {
  const c = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return {
    enabled: c.get("enabled", true),
    model: c.get("model", "haiku"),
    debounceMs: c.get("debounceMs", 350),
    timeoutMs: 15000,
    maxPrefixChars: 3000,
    maxSuffixChars: 1000,
    maxLines: 12,
    useNeighbourFiles: c.get("useNeighbourFiles", true),
    nextEditSuggestions: c.get("nextEditSuggestions", false),
    excludedLanguages: c.get("excludedLanguages", DEFAULT_EXCLUDED_LANGUAGES),
  };
}

/** Holds the current settings, re-reads them when they change, and writes them back. */
export class ConfigStore implements vscode.Disposable {
  private config = readConfig();
  private readonly changed = new vscode.EventEmitter<CompletionConfig>();
  /** Fires after any `ghostline.*` setting changes, in the order listeners subscribed. */
  readonly onDidChange = this.changed.event;
  private readonly listener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration(CONFIG_SECTION)) {
      this.config = readConfig();
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
