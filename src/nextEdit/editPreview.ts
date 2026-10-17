import * as vscode from "vscode";

import { changedLines, charChanges, sameLines } from "./editDiff";

const PREVIEW_CHARS = 120;

export interface ShownPreview {
  /** First line that actually changes, used for the jump-to hint. */
  focusLine: number;
  /** Whether that line is visible in the editor. */
  onScreen: boolean;
}

/**
 * Previews a suggested edit with decorations: red strikethrough for removed or changed lines,
 * green text for new ones, and a jump hint when the edit is off-screen.
 */
export class EditPreview implements vscode.Disposable {
  private readonly removedLine = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor("diffEditor.removedLineBackground"),
    textDecoration: "line-through",
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
    textDecoration: "line-through",
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
    if (sameLines(old, lines)) {
      return undefined;
    }

    // Only highlight the lines that actually change.
    const { head, removed, added } = changedLines(old, lines);
    const base = start + head;

    const hover = new vscode.MarkdownString();
    hover.appendMarkdown("**Ghostline: suggested edit** · Tab to accept · Esc to dismiss\n");
    hover.appendCodeblock([...removed.map((l) => `- ${l}`), ...added.map((l) => `+ ${l}`)].join("\n"), "diff");

    const removedRanges: vscode.DecorationOptions[] = [];
    const changedTexts: vscode.DecorationOptions[] = [];
    const deletedChars: vscode.DecorationOptions[] = [];
    const insertedChars: vscode.DecorationOptions[] = [];
    const inline = removed.length === 1 && added.length === 1 ? charChanges(removed[0], added[0]) : undefined;
    const paired = inline ? 0 : Math.min(removed.length, added.length);
    if (inline) {
      // Small one-line change (typically a typo): strike only the wrong characters and show the new ones in place.
      for (const change of inline) {
        const from = new vscode.Position(base, change.start);
        const to = from.translate(0, change.deleted);
        if (change.deleted) {
          deletedChars.push({ range: new vscode.Range(from, to), hoverMessage: hover });
        }
        if (change.inserted) {
          insertedChars.push({
            range: new vscode.Range(to, to),
            hoverMessage: hover,
            renderOptions: { before: { contentText: change.inserted } },
          });
        }
      }
    }
    for (let i = 0; i < (inline ? 0 : removed.length); i++) {
      const line = document.lineAt(base + i);
      removedRanges.push({ range: line.range, hoverMessage: hover });
      if (i < paired) {
        changedTexts.push({ range: endOf(line), renderOptions: { after: { contentText: preview(added[i]) } } });
      }
    }
    const addedTexts: vscode.DecorationOptions[] = [];
    if (added.length > removed.length) {
      const extra = added.slice(removed.length);
      const anchor = document.lineAt(removed.length > 0 ? base + removed.length - 1 : Math.max(base - 1, 0));
      const more = extra.length > 1 ? `   (+${extra.length - 1} more, hover to see)` : "";
      addedTexts.push({
        range: endOf(anchor),
        hoverMessage: hover,
        renderOptions: { after: { contentText: `+ ${preview(extra[0])}${more}` } },
      });
    }

    const focusLine = Math.min(base, document.lineCount - 1);
    const onScreen = editor.visibleRanges.some((range) => range.contains(new vscode.Position(focusLine, 0)));
    editor.setDecorations(this.removedLine, removedRanges);
    editor.setDecorations(this.changedText, changedTexts);
    editor.setDecorations(this.addedText, addedTexts);
    editor.setDecorations(this.deletedChars, deletedChars);
    editor.setDecorations(this.insertedChars, insertedChars);
    editor.setDecorations(this.jumpHint, onScreen ? [] : [hintAt(editor, focusLine)]);
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

function hintAt(editor: vscode.TextEditor, focusLine: number): vscode.DecorationOptions {
  const cursorLine = editor.document.lineAt(editor.selection.active.line);
  return {
    range: endOf(cursorLine),
    renderOptions: { after: { contentText: `⇥ Tab to go to suggested edit (line ${focusLine + 1})` } },
  };
}

function endOf(line: vscode.TextLine): vscode.Range {
  return new vscode.Range(line.range.end, line.range.end);
}

function preview(line: string): string {
  const text = line.trim();
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text || "(blank line)";
}
