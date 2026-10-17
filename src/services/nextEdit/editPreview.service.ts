import * as vscode from "vscode";

import { EditDecorationLib } from "../../libs/nextEdit/editDecoration.lib";
import { EditDiffLib } from "../../libs/nextEdit/editDiff.lib";
import type { ShownPreview } from "../../types/interfaces/nextEdit.interface";

/**
 * Previews a suggested edit with decorations: red strikethrough for removed or changed lines,
 * green text for new ones, and a jump hint when the edit is off-screen.
 */
export class EditPreviewService implements vscode.Disposable {
  private readonly removedLine = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor("diffEditor.removedLineBackground"),
    overviewRulerColor: new vscode.ThemeColor("editorOverviewRuler.deletedForeground"),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
  });
  private readonly changedText = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor("gitDecoration.addedResourceForeground"),
      backgroundColor: new vscode.ThemeColor("diffEditor.insertedTextBackground"),
      margin: "0 0 0 1em",
    },
  });
  private readonly addedText = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor("gitDecoration.addedResourceForeground"),
      backgroundColor: new vscode.ThemeColor("diffEditor.insertedTextBackground"),
      margin: "0 0 0 1em",
    },
  });
  private readonly deletedChars = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor("diffEditor.removedTextBackground"),
  });
  private readonly insertedChars = vscode.window.createTextEditorDecorationType({
    before: {
      color: new vscode.ThemeColor("gitDecoration.addedResourceForeground"),
      backgroundColor: new vscode.ThemeColor("diffEditor.insertedTextBackground"),
    },
  });
  private readonly jumpHint = vscode.window.createTextEditorDecorationType({
    after: { color: new vscode.ThemeColor("editorGhostText.foreground"), margin: "0 0 0 2em" },
  });

  private get allTypes(): vscode.TextEditorDecorationType[] {
    return [this.removedLine, this.changedText, this.addedText, this.deletedChars, this.insertedChars, this.jumpHint];
  }

  /** Decorates the replacement of lines start..end; undefined (and nothing shown) when it changes nothing. */
  show(editor: vscode.TextEditor, start: number, end: number, lines: string[]): ShownPreview | undefined {
    const document = editor.document;
    const old: string[] = [];
    for (let i = start; i <= end; i++) {
      old.push(document.lineAt(i).text);
    }
    if (EditDiffLib.sameLines(old, lines)) {
      return undefined;
    }

    // Only highlight the lines that actually change.
    const { head, removed, added } = EditDiffLib.changedLines(old, lines);
    const base = start + head;
    const hover = EditDecorationLib.diffHover(removed, added);
    const inline =
      removed.length === 1 && added.length === 1 ? EditDiffLib.charChanges(removed[0], added[0]) : undefined;
    const chars = inline ? EditDecorationLib.charDecorations(inline, base, hover) : { deleted: [], inserted: [] };
    const replaced = inline
      ? { removed: [], changed: [] }
      : EditDecorationLib.lineDecorations(document, base, removed, added, hover);

    const focusLine = Math.min(base, document.lineCount - 1);
    const onScreen = editor.visibleRanges.some((range) => range.contains(new vscode.Position(focusLine, 0)));
    editor.setDecorations(this.removedLine, replaced.removed);
    editor.setDecorations(this.changedText, replaced.changed);
    editor.setDecorations(this.addedText, EditDecorationLib.addedDecorations(document, base, removed, added, hover));
    editor.setDecorations(this.deletedChars, chars.deleted);
    editor.setDecorations(this.insertedChars, chars.inserted);
    editor.setDecorations(this.jumpHint, onScreen ? [] : [EditDecorationLib.hintAt(editor, focusLine)]);
    return { focusLine, onScreen };
  }

  hideJumpHint(editor: vscode.TextEditor): void {
    editor.setDecorations(this.jumpHint, []);
  }

  clear(editor: vscode.TextEditor): void {
    for (const type of this.allTypes) {
      editor.setDecorations(type, []);
    }
  }

  dispose(): void {
    this.allTypes.forEach((type) => type.dispose());
  }
}
