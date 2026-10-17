import * as vscode from "vscode";

import { isSendable } from "../shared/privacy";
import { sameLines } from "./editDiff";

const MAX_HISTORY = 5;
const MAX_TRACKED_LINES = 10_000;

export interface RecentEdit {
  line: number;
  before: string[];
  after: string[];
}

/** Only sendable documents of a manageable size have their edits tracked. */
export function isTrackable(document: vscode.TextDocument): boolean {
  return isSendable(document.uri.scheme, document.uri.fsPath) && document.lineCount <= MAX_TRACKED_LINES;
}

/** The last few edits per document, each with the lines before and after it. */
export class EditHistory {
  private readonly edits = new Map<string, RecentEdit[]>();
  private readonly lastText = new Map<string, string>();

  /** Recent edits to the document, oldest first. */
  get(key: string): RecentEdit[] {
    return this.edits.get(key) ?? [];
  }

  /** The document's text as last remembered, before the change being handled. */
  previousText(key: string): string | undefined {
    return this.lastText.get(key);
  }

  /** Keeps the last text of the active document so each change can be recorded with its "before" lines. */
  remember(document: vscode.TextDocument | undefined): void {
    if (document && isTrackable(document)) {
      this.lastText.set(document.uri.toString(), document.getText());
    }
  }

  forget(key: string): void {
    this.edits.delete(key);
    this.lastText.delete(key);
  }

  record(
    key: string,
    previous: string,
    document: vscode.TextDocument,
    change: vscode.TextDocumentContentChangeEvent,
  ): void {
    const blockStart = previous.lastIndexOf("\n", change.rangeOffset - 1) + 1;
    let blockEnd = previous.indexOf("\n", change.rangeOffset + change.rangeLength);
    if (blockEnd === -1) {
      blockEnd = previous.length;
    }
    const before = previous.slice(blockStart, blockEnd).replace(/\r/g, "").split("\n");
    const line = change.range.start.line;
    const lastLine = Math.min(line + (change.text.match(/\n/g)?.length ?? 0), document.lineCount - 1);
    const after: string[] = [];
    for (let i = line; i <= lastLine; i++) {
      after.push(document.lineAt(i).text);
    }

    const edits = this.edits.get(key) ?? [];
    const last = edits.at(-1);
    if (last && last.line === line && sameLines(last.after, before)) {
      last.after = after; // keep typing on the same lines as one edit
    } else {
      edits.push({ line, before, after });
    }
    this.edits.set(key, edits.slice(-MAX_HISTORY));
  }
}
