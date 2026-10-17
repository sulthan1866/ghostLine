import * as vscode from "vscode";

import type { CompletionContext } from "../../types/interfaces/completion.interface";
import type { CompletionConfig } from "../../types/interfaces/config.interface";
import { NeighbourSnippetsLib } from "./neighbourSnippets.lib";

export class CompletionContextLib {
  /**
   * Copilot-style context: code around the cursor (prefix/suffix, cut at line
   * boundaries) plus the most similar windows from other open files of the same
   * language, ranked by Jaccard similarity of identifiers.
   */
  static build(document: vscode.TextDocument, position: vscode.Position, config: CompletionConfig): CompletionContext {
    const text = document.getText();
    const offset = document.offsetAt(position);

    let prefix = text.slice(Math.max(0, offset - config.maxPrefixChars), offset);
    if (offset > config.maxPrefixChars) {
      prefix = prefix.slice(prefix.indexOf("\n") + 1);
    }
    let suffix = text.slice(offset, offset + config.maxSuffixChars);
    if (offset + config.maxSuffixChars < text.length) {
      suffix = suffix.slice(0, Math.max(0, suffix.lastIndexOf("\n")));
    }

    const line = document.lineAt(position.line).text;

    return {
      languageId: document.languageId,
      relativePath: vscode.workspace.asRelativePath(document.uri),
      prefix,
      suffix,
      linePrefix: line.slice(0, position.character),
      lineSuffix: line.slice(position.character),
      snippets: config.useNeighbourFiles ? NeighbourSnippetsLib.findSimilar(document, prefix) : [],
    };
  }
}
