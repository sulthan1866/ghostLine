import * as vscode from "vscode";

import { ClaudeEngine } from "../claude/claudeEngine";
import { CompletionConfig } from "../config/configStore";
import { isSendable } from "../shared/privacy";
import { CompletionCache } from "./completionCache";
import { buildContext } from "./completionContext";
import { cleanCompletion } from "./postProcess";
import { buildPrompt } from "./prompt";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class ClaudeInlineProvider implements vscode.InlineCompletionItemProvider {
  private readonly cache = new CompletionCache();
  private pending = 0;

  constructor(
    private readonly engine: ClaudeEngine,
    private readonly getConfig: () => CompletionConfig,
    private readonly isPaused: () => boolean,
    private readonly onBusyChange: (busy: boolean) => void,
  ) {}

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    const config = this.getConfig();
    if (
      !config.enabled ||
      this.isPaused() ||
      config.excludedLanguages.includes(document.languageId) ||
      !isSendable(document.uri.scheme, document.uri.fsPath)
    ) {
      return undefined;
    }

    const uri = document.uri.toString();
    const fullPrefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));

    // 1. Typing-through: reuse the previous suggestion if the user is typing it.
    const cached = this.cache.get(uri, fullPrefix);
    if (cached) {
      return [this.item(cached, position)];
    }

    // 2. Debounce: VS Code cancels the token when the user keeps typing.
    if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic) {
      await sleep(config.debounceMs);
      if (token.isCancellationRequested) {
        return undefined;
      }
    }

    // 3. Build context, ask Claude, clean up the answer.
    const ctx = buildContext(document, position, config);
    this.setBusy(+1);
    try {
      const raw = await this.engine.complete(buildPrompt(ctx), token);
      if (raw === undefined || token.isCancellationRequested) {
        return undefined;
      }
      const completion = cleanCompletion(raw, ctx, config.maxLines);
      if (!completion) {
        return undefined;
      }
      this.cache.set(uri, fullPrefix, completion);
      return [this.item(completion, position)];
    } finally {
      this.setBusy(-1);
    }
  }

  private item(text: string, position: vscode.Position): vscode.InlineCompletionItem {
    return new vscode.InlineCompletionItem(text, new vscode.Range(position, position));
  }

  private setBusy(delta: number): void {
    this.pending += delta;
    this.onBusyChange(this.pending > 0);
  }
}
