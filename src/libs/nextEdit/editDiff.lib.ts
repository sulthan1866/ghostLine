/** Pure helpers for next edit suggestions, kept free of `vscode` so they can be unit tested. */
import {
  LINE_NUMBER_PREFIX,
  MAX_DIFF_LINE_CHARS,
  MAX_EDIT_LINES,
  MAX_INLINE_CHANGE_CHARS,
  MAX_INLINE_CHANGES,
} from "../../constant/nextEdit.constant";
import type { ChangedLines, CharChange, ParsedEdit } from "../../types/interfaces/nextEdit.interface";

export class EditDiffLib {
  /** Parses `<edit start="N" end="M">…</edit>` into 0-based lines, rejecting anything outside the excerpt. */
  static parseEdit(raw: string, first: number, last: number): ParsedEdit | undefined {
    const match = raw.match(/<edit\s+start="(\d+)"\s+end="(\d+)"\s*>([\s\S]*?)<\/edit>/);
    if (!match) {
      return undefined;
    }
    const start = Number(match[1]) - 1;
    const end = Number(match[2]) - 1;
    if (start < first || end > last || start > end) {
      return undefined;
    }
    const body = match[3].replace(/^\r?\n/, "").replace(/\r?\n$/, "");
    let lines = body === "" ? [] : body.replace(/\r/g, "").split("\n");
    // Models sometimes copy the excerpt's "12| " prefixes; strip them only if every line has one.
    if (lines.length > 0 && lines.every((line) => LINE_NUMBER_PREFIX.test(line))) {
      lines = lines.map((line) => line.replace(LINE_NUMBER_PREFIX, ""));
    }
    return lines.length > MAX_EDIT_LINES ? undefined : { start, end, lines };
  }

  static sameLines(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((line, i) => line === b[i]);
  }

  /**
   * Character-level diff of two versions of a line, when the change is small enough to show in place
   * (e.g. `retrun totl` → `return total`); undefined when it is better shown as a whole new line.
   */
  static charChanges(before: string, after: string): CharChange[] | undefined {
    if (before.trim() === "" || before.length > MAX_DIFF_LINE_CHARS || after.length > MAX_DIFF_LINE_CHARS) {
      return undefined;
    }
    const changes = EditDiffLib.diffChars(before, after);
    const changed = changes.reduce((sum, c) => sum + c.deleted + c.inserted.length, 0);
    return changes.length <= MAX_INLINE_CHANGES && changed <= MAX_INLINE_CHANGE_CHARS ? changes : undefined;
  }

  /** Trims the lines both versions share at the start and end, leaving only the lines that actually change. */
  static changedLines(before: readonly string[], after: readonly string[]): ChangedLines {
    let head = 0;
    while (head < before.length && head < after.length && before[head] === after[head]) {
      head++;
    }
    let tail = 0;
    while (
      tail < before.length - head &&
      tail < after.length - head &&
      before[before.length - 1 - tail] === after[after.length - 1 - tail]
    ) {
      tail++;
    }
    return { head, removed: before.slice(head, before.length - tail), added: after.slice(head, after.length - tail) };
  }

  /** Longest common subsequence table, filled from the end: `lcs[i][j]` is the LCS of `a[i..]` and `b[j..]`. */
  private static lcsTable(a: string, b: string): Uint16Array[] {
    const lcs = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--) {
        lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
    return lcs;
  }

  /** Walks the LCS table, grouping each run of differing characters into one change. */
  private static diffChars(before: string, after: string): CharChange[] {
    const lcs = EditDiffLib.lcsTable(before, after);
    const n = before.length;
    const m = after.length;
    const matches = (i: number, j: number) => i < n && j < m && before[i] === after[j];
    const changes: CharChange[] = [];
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (matches(i, j)) {
        i++;
        j++;
        continue;
      }
      const change: CharChange = { start: i, deleted: 0, inserted: "" };
      while ((i < n || j < m) && !matches(i, j)) {
        if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) {
          change.inserted += after[j++];
        } else {
          i++;
          change.deleted++;
        }
      }
      changes.push(change);
    }
    return changes;
  }
}
