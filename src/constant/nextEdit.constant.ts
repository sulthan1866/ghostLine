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

/** Tags this feature's log lines and status bar spinner. */
export const NEXT_EDIT_BUSY_SOURCE = "nextEdit";

/** Lines above and below the cursor sent as the file excerpt. */
export const WINDOW_ABOVE = 30;
export const WINDOW_BELOW = 30;
/** Lines of each recent edit included in the prompt. */
export const MAX_HISTORY_LINES = 10;

/** Recent edits remembered per document. */
export const MAX_HISTORY = 5;
export const MAX_TRACKED_LINES = 10_000;

export const MAX_EDIT_LINES = 20;
/** A one-line change this small is shown in place, character by character (e.g. a typo fix). */
export const MAX_INLINE_CHANGE_CHARS = 30;
export const MAX_INLINE_CHANGES = 4;
export const MAX_DIFF_LINE_CHARS = 300;
export const LINE_NUMBER_PREFIX = /^\s*\d+\| ?/;

export const PREVIEW_CHARS = 120;
