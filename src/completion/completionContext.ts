import * as vscode from "vscode";

import { CompletionConfig } from "../config/configStore";
import { findSimilarSnippets, Snippet } from "./neighbourSnippets";

export type { Snippet } from "./neighbourSnippets";

export interface CompletionContext {
  languageId: string;
  relativePath: string;
  prefix: string;
  suffix: string;
  linePrefix: string;
  lineSuffix: string;
  snippets: Snippet[];
}

/**
 * Copilot-style context: code around the cursor (prefix/suffix, cut at line
 * boundaries) plus the most similar windows from other open files of the same
 * language, ranked by Jaccard similarity of identifiers.
 */
export function buildContext(
  document: vscode.TextDocument,
  position: vscode.Position,
  config: CompletionConfig,
): CompletionContext {
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
    snippets: config.useNeighbourFiles ? findSimilarSnippets(document, prefix) : [],
  };
}
