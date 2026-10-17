/** Pure helpers for next edit suggestions, kept free of `vscode` so they can be unit tested. */

const MAX_EDIT_LINES = 20;
/** A one-line change this small is shown in place, character by character (e.g. a typo fix). */
const MAX_INLINE_CHANGE_CHARS = 30;
const MAX_INLINE_CHANGES = 4;
const MAX_DIFF_LINE_CHARS = 300;
const LINE_NUMBER_PREFIX = /^\s*\d+\| ?/;

export interface ParsedEdit {
  /** 0-based, inclusive lines to replace. */
  start: number;
  end: number;
  lines: string[];
}

/** Parses `<edit start="N" end="M">…</edit>` into 0-based lines, rejecting anything outside the excerpt. */
export function parseEdit(raw: string, first: number, last: number): ParsedEdit | undefined {
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

export function sameLines(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

export interface CharChange {
  /** Column in the old line where the change starts. */
  start: number;
  /** How many old characters are removed. */
  deleted: number;
  /** New text inserted after the removed characters. */
  inserted: string;
}

/**
 * Character-level diff of two versions of a line, when the change is small enough to show in place
 * (e.g. `retrun totl` → `return total`); undefined when it is better shown as a whole new line.
 */
export function charChanges(before: string, after: string): CharChange[] | undefined {
  if (before.trim() === "" || before.length > MAX_DIFF_LINE_CHARS || after.length > MAX_DIFF_LINE_CHARS) {
    return undefined;
  }
  // Longest common subsequence table, filled from the end.
  const n = before.length;
  const m = after.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const changes: CharChange[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && before[i] === after[j]) {
      i++;
      j++;
      continue;
    }
    const change: CharChange = { start: i, deleted: 0, inserted: "" };
    while ((i < n || j < m) && !(i < n && j < m && before[i] === after[j])) {
      if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) {
        change.inserted += after[j++];
      } else {
        i++;
        change.deleted++;
      }
    }
    changes.push(change);
  }
  const changed = changes.reduce((sum, c) => sum + c.deleted + c.inserted.length, 0);
  return changes.length <= MAX_INLINE_CHANGES && changed <= MAX_INLINE_CHANGE_CHARS ? changes : undefined;
}

export interface ChangedLines {
  /** How many leading lines are unchanged. */
  head: number;
  removed: string[];
  added: string[];
}

/** Trims the lines both versions share at the start and end, leaving only the lines that actually change. */
export function changedLines(before: readonly string[], after: readonly string[]): ChangedLines {
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
