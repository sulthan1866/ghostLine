import * as vscode from "vscode";

import { MAX_HISTORY_LINES } from "../../constant/nextEdit.constant";
import type { RecentEdit } from "../../types/interfaces/nextEdit.interface";

export class NextEditPromptLib {
  static build(
    document: vscode.TextDocument,
    edits: RecentEdit[],
    first: number,
    last: number,
    cursor: number,
  ): string {
    const parts = edits.map((edit) => {
      const lines = [
        ...edit.before.slice(0, MAX_HISTORY_LINES).map((line) => `- ${line}`),
        ...edit.after.slice(0, MAX_HISTORY_LINES).map((line) => `+ ${line}`),
      ];
      return `<recent_edit line="${edit.line + 1}">\n${lines.join("\n")}\n</recent_edit>`;
    });
    const width = String(last + 1).length;
    const excerpt: string[] = [];
    for (let i = first; i <= last; i++) {
      excerpt.push(`${String(i + 1).padStart(width)}| ${document.lineAt(i).text}`);
    }
    const path = vscode.workspace.asRelativePath(document.uri);
    parts.push(
      `<file path="${path}" language="${document.languageId}" lines="${first + 1}-${last + 1}" cursor_line="${cursor + 1}">\n${excerpt.join("\n")}\n</file>`,
      "Suggest the next edit.",
    );
    return parts.join("\n\n");
  }
}
