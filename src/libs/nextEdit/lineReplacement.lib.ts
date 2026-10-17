import * as vscode from "vscode";

export class LineReplacementLib {
  /** The range and text that replace whole lines start..end; deleting also removes their line break. */
  static build(
    document: vscode.TextDocument,
    start: number,
    end: number,
    lines: string[],
  ): { range: vscode.Range; text: string } {
    const endOfLast = document.lineAt(end).range.end;
    if (lines.length > 0) {
      const eol = document.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n";
      return { range: new vscode.Range(new vscode.Position(start, 0), endOfLast), text: lines.join(eol) };
    }
    if (end + 1 < document.lineCount) {
      return { range: new vscode.Range(start, 0, end + 1, 0), text: "" };
    }
    if (start > 0) {
      return { range: new vscode.Range(document.lineAt(start - 1).range.end, endOfLast), text: "" };
    }
    return { range: new vscode.Range(new vscode.Position(0, 0), endOfLast), text: "" };
  }
}
