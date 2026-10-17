import * as vscode from "vscode";

import { SuggestionRouteLib } from "../../libs/routing/suggestionRoute.lib";
import type { CompletionConfig } from "../../types/interfaces/config.interface";
import type { EditShape, RoutedEdit } from "../../types/interfaces/routing.interface";
import type { SuggestionRoute } from "../../types/types/routing.type";

/** Remembers which feature owns each document's latest edit, so only that one asks the model. */
export class SuggestionRouterService implements vscode.Disposable {
  private readonly routes = new Map<string, RoutedEdit>();
  private readonly disposables: vscode.Disposable[];

  constructor(private readonly getConfig: () => CompletionConfig) {
    this.disposables = [
      vscode.workspace.onDidChangeTextDocument((event) => this.onChange(event)),
      vscode.workspace.onDidCloseTextDocument((document) => this.routes.delete(document.uri.toString())),
    ];
  }

  /** Whether the feature may ask about the document as it is now; with next edit off, completion always may. */
  allows(document: vscode.TextDocument, feature: SuggestionRoute): boolean {
    if (!this.getConfig().nextEditSuggestions) {
      return true;
    }
    const last = this.routes.get(document.uri.toString());
    return !last || last.version !== document.version || last.route === feature;
  }

  private onChange(event: vscode.TextDocumentChangeEvent): void {
    const changes = event.contentChanges;
    if (changes.length === 0) {
      return;
    }
    // Several changes at once (multi-cursor, formatting, refactoring) are never plain typing.
    const route = changes.length === 1 ? SuggestionRouteLib.decide(this.shape(event.document, changes[0])) : "nextEdit";
    this.routes.set(event.document.uri.toString(), { version: event.document.version, route });
  }

  private shape(document: vscode.TextDocument, change: vscode.TextDocumentContentChangeEvent): EditShape {
    const inserted = change.text.split(/\r?\n/);
    const line = Math.min(change.range.start.line + inserted.length - 1, document.lineCount - 1);
    const character = (inserted.length === 1 ? change.range.start.character : 0) + inserted[inserted.length - 1].length;
    return {
      replacedLength: change.rangeLength,
      insertedText: change.text,
      lineSuffix: document.lineAt(line).text.slice(character),
    };
  }

  dispose(): void {
    this.routes.clear();
    this.disposables.forEach((d) => d.dispose());
  }
}
