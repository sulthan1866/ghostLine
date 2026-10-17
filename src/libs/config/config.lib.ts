import * as vscode from "vscode";

import { DEFAULT_EXCLUDED_LANGUAGES } from "../../constant/config.constant";
import { CONFIG_SECTION } from "../../constant/extension.constant";
import type { CompletionConfig } from "../../types/interfaces/config.interface";

export class ConfigLib {
  static read(model: string): CompletionConfig {
    const c = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return {
      enabled: c.get("enabled", true),
      model,
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
}
