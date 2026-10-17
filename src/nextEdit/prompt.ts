import * as vscode from "vscode";

import type { RecentEdit } from "./editHistory";

const MAX_HISTORY_LINES = 10;

export const NEXT_EDIT_SYSTEM_PROMPT = [
  "You predict a developer's next code edit, like GitHub Copilot's next edit suggestions.",
  "You receive their recent edits (oldest first) and a numbered excerpt of the file around the cursor.",
  "Propose ONE small edit that naturally follows from the recent edits: e.g. update other uses of something",
  "they renamed or changed, apply the same change to similar lines, or remove code their change made unused.",
  "Also fix clear typos in code they just wrote: misspelt keywords (retrun, fucntion), identifiers that do not",
  "match their declaration, and misspelt words in comments or strings. Leave unfinished words on the cursor line",
  "alone, and never change intentional names, abbreviations or project-specific spellings.",
  'Reply with <edit start="N" end="M">replacement lines</edit>, where N..M (inclusive) are line numbers from',
  "the excerpt to replace. Write the replacement lines without line-number prefixes, keeping indentation.",
  "An empty replacement deletes those lines. Never undo or repeat the developer's own last edit (fixing a typo in it is fine).",
  "If no follow-up edit is clearly needed, reply <no_edit/>. No explanations, no markdown fences.",
].join("\n");

export function buildNextEditPrompt(
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
