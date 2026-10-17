import * as vscode from "vscode";

import { PREVIEW_CHARS } from "../../constant/nextEdit.constant";
import type { CharChange } from "../../types/interfaces/nextEdit.interface";

/** Builds the decorations that preview a suggested edit. */
export class EditDecorationLib {
  static diffHover(removed: string[], added: string[]): vscode.MarkdownString {
    const hover = new vscode.MarkdownString();
    hover.appendMarkdown("**Ghostline: suggested edit** · Tab to accept · Esc to dismiss\n");
    hover.appendCodeblock([...removed.map((l) => `- ${l}`), ...added.map((l) => `+ ${l}`)].join("\n"), "diff");
    return hover;
  }

  /** Small one-line change (typically a typo): strike only the wrong characters and show the new ones in place. */
  static charDecorations(
    changes: CharChange[],
    line: number,
    hover: vscode.MarkdownString,
  ): { deleted: vscode.DecorationOptions[]; inserted: vscode.DecorationOptions[] } {
    const deleted: vscode.DecorationOptions[] = [];
    const inserted: vscode.DecorationOptions[] = [];
    for (const change of changes) {
      const from = new vscode.Position(line, change.start);
      const to = from.translate(0, change.deleted);
      if (change.deleted) {
        deleted.push({ range: new vscode.Range(from, to), hoverMessage: hover });
      }
      if (change.inserted) {
        inserted.push({
          range: new vscode.Range(to, to),
          hoverMessage: hover,
          renderOptions: { before: { contentText: change.inserted } },
        });
      }
    }
    return { deleted, inserted };
  }

  /** Marks each removed line, with its replacement (if any) shown at the end of the line. */
  static lineDecorations(
    document: vscode.TextDocument,
    base: number,
    removed: string[],
    added: string[],
    hover: vscode.MarkdownString,
  ): { removed: vscode.DecorationOptions[]; changed: vscode.DecorationOptions[] } {
    const removedRanges: vscode.DecorationOptions[] = [];
    const changedTexts: vscode.DecorationOptions[] = [];
    for (let i = 0; i < removed.length; i++) {
      const line = document.lineAt(base + i);
      removedRanges.push({ range: line.range, hoverMessage: hover });
      if (i < added.length) {
        changedTexts.push({
          range: EditDecorationLib.endOf(line),
          renderOptions: { after: { contentText: EditDecorationLib.preview(added[i]) } },
        });
      }
    }
    return { removed: removedRanges, changed: changedTexts };
  }

  /** New lines beyond the replaced ones, summarised after the last replaced line (or the line above). */
  static addedDecorations(
    document: vscode.TextDocument,
    base: number,
    removed: string[],
    added: string[],
    hover: vscode.MarkdownString,
  ): vscode.DecorationOptions[] {
    if (added.length <= removed.length) {
      return [];
    }
    const extra = added.slice(removed.length);
    const anchor = document.lineAt(removed.length > 0 ? base + removed.length - 1 : Math.max(base - 1, 0));
    const more = extra.length > 1 ? `   (+${extra.length - 1} more, hover to see)` : "";
    return [
      {
        range: EditDecorationLib.endOf(anchor),
        hoverMessage: hover,
        renderOptions: { after: { contentText: `+ ${EditDecorationLib.preview(extra[0])}${more}` } },
      },
    ];
  }

  static hintAt(editor: vscode.TextEditor, focusLine: number): vscode.DecorationOptions {
    const cursorLine = editor.document.lineAt(editor.selection.active.line);
    return {
      range: EditDecorationLib.endOf(cursorLine),
      renderOptions: { after: { contentText: `⇥ Tab to go to suggested edit (line ${focusLine + 1})` } },
    };
  }

  private static endOf(line: vscode.TextLine): vscode.Range {
    return new vscode.Range(line.range.end, line.range.end);
  }

  private static preview(line: string): string {
    const text = line.trim();
    return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text || "(blank line)";
  }
}
