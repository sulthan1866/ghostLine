import * as vscode from "vscode";

import type { ClaudeModelInfo } from "../../types/interfaces/claude.interface";
import type { ModelItem } from "../../types/types/ui.type";

export class ModelPickerLib {
  /**
   * Lists the account's models (loading while the picker is already open), with an option
   * to type any model ID. Returns the chosen model, or undefined if the user backed out.
   */
  static async pick(
    current: string,
    loadModels: () => Promise<ClaudeModelInfo[]>,
    /** Models known to need usage credits, flagged in the list. */
    creditModels: ReadonlySet<string>,
  ): Promise<string | undefined> {
    const quickPick = vscode.window.createQuickPick<ModelItem>();
    quickPick.title = "Ghostline: Select model";
    quickPick.placeholder = "A fast model such as Haiku is recommended for inline completions";
    quickPick.busy = true;
    quickPick.show();

    const models = await loadModels();
    quickPick.items = [
      ...models.map((model) => ({
        label: `${model.value === current ? "$(check) " : ""}${model.displayName}`,
        description: model.value,
        detail: creditModels.has(model.value)
          ? "$(warning) Runs on usage credits, purchased separately from your plan"
          : model.description,
        value: model.value,
      })),
      { label: "", kind: vscode.QuickPickItemKind.Separator },
      { label: "$(edit) Enter a model ID…" },
    ];
    quickPick.busy = false;

    const picked = await new Promise<ModelItem | undefined>((resolve) => {
      quickPick.onDidAccept(() => resolve(quickPick.selectedItems[0]));
      quickPick.onDidHide(() => resolve(undefined));
    });
    quickPick.dispose();
    if (!picked) {
      return undefined;
    }

    return (
      picked.value ??
      vscode.window.showInputBox({
        title: "Ghostline: Model ID",
        prompt: "Model alias or full ID passed to the CLI as --model",
        value: current,
      })
    );
  }
}
