import * as vscode from "vscode";

import { CompletionContextLib } from "../../libs/completion/completionContext.lib";
import { CompletionPromptLib } from "../../libs/completion/completionPrompt.lib";
import { PostProcessLib } from "../../libs/completion/postProcess.lib";
import { AsyncLib } from "../../libs/shared/async.lib";
import { PrivacyLib } from "../../libs/shared/privacy.lib";
import type { CompletionConfig } from "../../types/interfaces/config.interface";
import type { ClaudeEngineService } from "../claude/claudeEngine.service";
import { CompletionCacheService } from "./completionCache.service";

export class InlineProviderService implements vscode.InlineCompletionItemProvider {
  private readonly cache = new CompletionCacheService();
  private pending = 0;
  /** The latest call; a new keystroke supersedes it even if VS Code keeps its token alive. */
  private current?: vscode.CancellationTokenSource;

  constructor(
    private readonly engine: ClaudeEngineService,
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
      !PrivacyLib.isSendable(document.uri.scheme, document.uri.fsPath)
    ) {
      return undefined;
    }

    // A newer call supersedes any earlier one, so its spinner stops and it never reaches the model.
    this.current?.cancel();
    const source = new vscode.CancellationTokenSource();
    this.current = source;
    const sub = token.onCancellationRequested(() => source.cancel());
    try {
      return await this.provide(document, position, context, source.token);
    } finally {
      sub.dispose();
      source.dispose();
      if (this.current === source) {
        this.current = undefined;
      }
    }
  }

  private async provide(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    const config = this.getConfig();
    const uri = document.uri.toString();
    const fullPrefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));

    // 1. Typing-through: reuse the previous suggestion if the user is typing it.
    const cached = this.cache.get(uri, fullPrefix);
    if (cached) {
      return [this.item(cached, position)];
    }

    // 2. Debounce: VS Code cancels the token when the user keeps typing.
    if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic) {
      await AsyncLib.sleep(config.debounceMs);
      if (token.isCancellationRequested) {
        return undefined;
      }
    }

    // 3. Build context, ask Claude, clean up the answer.
    const ctx = CompletionContextLib.build(document, position, config);
    this.setBusy(+1);
    try {
      const raw = await this.engine.complete(CompletionPromptLib.build(ctx), token);
      if (raw === undefined || token.isCancellationRequested) {
        return undefined;
      }
      const completion = PostProcessLib.cleanCompletion(raw, ctx, config.maxLines);
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
