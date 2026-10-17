import * as vscode from "vscode";

import { COMMANDS, EDIT_SUGGESTION_VISIBLE_CONTEXT } from "../../constant/extension.constant";
import { WINDOW_ABOVE, WINDOW_BELOW } from "../../constant/nextEdit.constant";
import { EditDiffLib } from "../../libs/nextEdit/editDiff.lib";
import { EditHistoryLib } from "../../libs/nextEdit/editHistory.lib";
import { LineReplacementLib } from "../../libs/nextEdit/lineReplacement.lib";
import { NextEditPromptLib } from "../../libs/nextEdit/nextEditPrompt.lib";
import type { CompletionConfig } from "../../types/interfaces/config.interface";
import type { Suggestion } from "../../types/interfaces/nextEdit.interface";
import type { ClaudeEngineService } from "../claude/claudeEngine.service";
import { EditHistoryService } from "./editHistory.service";
import { EditPreviewService } from "./editPreview.service";

/**
 * Next edit suggestions built only on the public API: the edit is previewed with
 * decorations and applied with Tab, so it works in any VS Code and can be published.
 */
export class NextEditControllerService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly history = new EditHistoryService();
  private readonly preview = new EditPreviewService();
  private suggestion?: Suggestion;
  private timer?: NodeJS.Timeout;
  private request?: vscode.CancellationTokenSource;

  constructor(
    private readonly engine: ClaudeEngineService,
    private readonly getConfig: () => CompletionConfig,
    private readonly isPaused: () => boolean,
    private readonly onBusyChange: (busy: boolean) => void,
  ) {
    this.disposables.push(
      this.preview,
      vscode.commands.registerCommand(COMMANDS.acceptEdit, () => this.accept()),
      vscode.commands.registerCommand(COMMANDS.dismissEdit, () => this.clear()),
      vscode.workspace.onDidChangeTextDocument((event) => this.onChange(event)),
      vscode.workspace.onDidCloseTextDocument((document) => this.history.forget(document.uri.toString())),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.clear();
        this.history.remember(editor?.document);
      }),
    );
    this.history.remember(vscode.window.activeTextEditor?.document);
  }

  private onChange(event: vscode.TextDocumentChangeEvent): void {
    const document = event.document;
    if (
      event.contentChanges.length === 0 ||
      document !== vscode.window.activeTextEditor?.document ||
      !EditHistoryLib.isTrackable(document)
    ) {
      return;
    }
    const key = document.uri.toString();
    const previous = this.history.previousText(key);
    this.history.remember(document);
    this.clear();
    this.cancel();
    if (previous !== undefined && event.contentChanges.length === 1) {
      this.history.record(key, previous, document, event.contentChanges[0]);
    }
    const undoing =
      event.reason === vscode.TextDocumentChangeReason.Undo || event.reason === vscode.TextDocumentChangeReason.Redo;
    if (!undoing) {
      const version = document.version;
      this.timer = setTimeout(() => void this.suggest(document, version), this.getConfig().debounceMs);
    }
  }

  private async suggest(document: vscode.TextDocument, version: number): Promise<void> {
    const config = this.getConfig();
    const editor = vscode.window.activeTextEditor;
    const edits = this.history.get(document.uri.toString());
    if (
      !config.enabled ||
      !config.nextEditSuggestions ||
      this.isPaused() ||
      config.excludedLanguages.includes(document.languageId) ||
      editor?.document !== document ||
      document.version !== version ||
      edits.length === 0
    ) {
      return;
    }

    const cursor = editor.selection.active.line;
    const first = Math.max(0, cursor - WINDOW_ABOVE);
    const last = Math.min(document.lineCount - 1, cursor + WINDOW_BELOW);
    const prompt = NextEditPromptLib.build(document, edits, first, last, cursor);

    const raw = await this.requestEdit(prompt);
    if (raw === undefined || document.version !== version) {
      return;
    }
    if (vscode.window.activeTextEditor !== editor) {
      return;
    }
    const edit = EditDiffLib.parseEdit(raw, first, last);
    if (edit) {
      this.show(editor, version, edit.start, edit.end, edit.lines);
    }
  }

  /** Asks the model for an edit; undefined if it fails or is cancelled by further typing. */
  private async requestEdit(prompt: string): Promise<string | undefined> {
    const request = new vscode.CancellationTokenSource();
    this.request = request;
    this.onBusyChange(true);
    let raw: string | undefined;
    try {
      raw = await this.engine.complete(prompt, request.token);
    } finally {
      this.onBusyChange(false);
      request.dispose();
      if (this.request === request) {
        this.request = undefined;
      }
    }
    return request.token.isCancellationRequested ? undefined : raw;
  }

  private show(editor: vscode.TextEditor, version: number, start: number, end: number, lines: string[]): void {
    const shown = this.preview.show(editor, start, end, lines);
    if (!shown) {
      return;
    }
    const { focusLine, onScreen } = shown;
    this.suggestion = { editor, version, start, end, lines, focusLine, jumpFirst: !onScreen };
    void vscode.commands.executeCommand("setContext", EDIT_SUGGESTION_VISIBLE_CONTEXT, true);
  }

  private async accept(): Promise<void> {
    const suggestion = this.suggestion;
    const editor = vscode.window.activeTextEditor;
    if (!suggestion || editor !== suggestion.editor || editor.document.version !== suggestion.version) {
      this.clear();
      return;
    }

    if (suggestion.jumpFirst) {
      const position = new vscode.Position(suggestion.focusLine, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      this.preview.hideJumpHint(editor);
      suggestion.jumpFirst = false;
      return;
    }

    const { range, text } = LineReplacementLib.build(
      editor.document,
      suggestion.start,
      suggestion.end,
      suggestion.lines,
    );
    this.clear();
    const applied = await editor.edit((builder) => builder.replace(range, text));
    if (applied) {
      const line = Math.min(suggestion.start + Math.max(suggestion.lines.length, 1) - 1, editor.document.lineCount - 1);
      const position = editor.document.lineAt(line).range.end;
      editor.selection = new vscode.Selection(position, position);
    }
  }

  /** Removes any shown suggestion. */
  clear(): void {
    const suggestion = this.suggestion;
    if (!suggestion) {
      return;
    }
    this.suggestion = undefined;
    this.preview.clear(suggestion.editor);
    void vscode.commands.executeCommand("setContext", EDIT_SUGGESTION_VISIBLE_CONTEXT, false);
  }

  private cancel(): void {
    clearTimeout(this.timer);
    this.request?.cancel();
  }

  dispose(): void {
    this.cancel();
    this.clear();
    this.disposables.forEach((d) => d.dispose());
  }
}
