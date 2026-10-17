import * as vscode from "vscode";

import { isSendable } from "../shared/privacy";

export interface Snippet {
  path: string;
  text: string;
}

const WINDOW_LINES = 40;
const MAX_SNIPPETS = 3;
const SNIPPET_BUDGET_CHARS = 3000;
const MAX_NEIGHBOUR_LINES = 5000;
const MIN_SIMILARITY = 0.1;

interface TokenisedWindow {
  text: string;
  tokens: Set<string>;
}

/** Tokenised windows per open document, rebuilt only when the document changes. */
const windowCache = new WeakMap<vscode.TextDocument, { version: number; windows: TokenisedWindow[] }>();

/** The best-matching window from each other open file of the same language, most similar first. */
export function findSimilarSnippets(document: vscode.TextDocument, prefix: string): Snippet[] {
  const target = tokenise(prefix.split("\n").slice(-30).join("\n"));
  if (target.size === 0) {
    return [];
  }

  const bestPerFile: { path: string; text: string; score: number }[] = [];
  for (const other of vscode.workspace.textDocuments) {
    if (!isNeighbour(document, other)) {
      continue;
    }
    let best = { text: "", score: 0 };
    for (const window of tokenisedWindows(other)) {
      const score = jaccard(target, window.tokens);
      if (score > best.score) {
        best = { text: window.text, score };
      }
    }
    if (best.score > MIN_SIMILARITY) {
      bestPerFile.push({ path: vscode.workspace.asRelativePath(other.uri), ...best });
    }
  }

  const result: Snippet[] = [];
  let budget = SNIPPET_BUDGET_CHARS;
  for (const candidate of bestPerFile.sort((a, b) => b.score - a.score).slice(0, MAX_SNIPPETS)) {
    if (candidate.text.length > budget) {
      break;
    }
    budget -= candidate.text.length;
    result.push({ path: candidate.path, text: candidate.text });
  }
  return result;
}

/** Another saved, sendable, not-too-large file in the same language. */
function isNeighbour(document: vscode.TextDocument, other: vscode.TextDocument): boolean {
  return !(
    other.uri.toString() === document.uri.toString() ||
    other.uri.scheme !== "file" ||
    !isSendable(other.uri.scheme, other.uri.fsPath) ||
    other.languageId !== document.languageId ||
    other.lineCount > MAX_NEIGHBOUR_LINES
  );
}

function tokenise(text: string): Set<string> {
  return new Set(text.split(/[^A-Za-z0-9_$]+/).filter((token) => token.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const token of a) {
    if (b.has(token)) {
      shared++;
    }
  }
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

function tokenisedWindows(document: vscode.TextDocument): TokenisedWindow[] {
  const cached = windowCache.get(document);
  if (cached && cached.version === document.version) {
    return cached.windows;
  }
  const lines = document.getText().split("\n");
  const windows: TokenisedWindow[] = [];
  for (let start = 0; start < lines.length; start += WINDOW_LINES / 2) {
    const text = lines.slice(start, start + WINDOW_LINES).join("\n");
    windows.push({ text, tokens: tokenise(text) });
  }
  windowCache.set(document, { version: document.version, windows });
  return windows;
}
