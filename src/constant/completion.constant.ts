export const COMPLETION_SYSTEM_PROMPT = [
  "You are a code completion engine embedded in an editor, like GitHub Copilot.",
  "You receive a file with a <CURSOR/> marker and optional related snippets from other files.",
  "Reply with ONLY the exact text to insert at <CURSOR/>, wrapped in <completion></completion>.",
  "Never repeat code that already appears before or after the cursor.",
  "If <CURSOR/> is in the middle of a line, insert only what makes that line correct together with the text",
  "after it, such as a missing letter in a misspelt word. Never copy nearby lines into the middle of code.",
  "Match the file's indentation, style and language. No explanations, no markdown fences.",
  "Prefer completing the current statement or block; stop at a natural boundary.",
  "If nothing useful should be inserted, reply <completion></completion>.",
].join("\n");

/** Neighbour snippets: window size, how many to include and their combined size. */
export const SNIPPET_WINDOW_LINES = 40;
export const MAX_SNIPPETS = 3;
export const SNIPPET_BUDGET_CHARS = 3000;
export const MAX_NEIGHBOUR_LINES = 5000;
export const MIN_SNIPPET_SIMILARITY = 0.1;

/** Text after the cursor that leaves room for normal code: closing brackets, quotes and punctuation. */
export const COMPLETABLE_LINE_END = /^[\s)\]}>"'`;,:.]*$/;
export const WORD_END = /[\w$]$/;
export const WORD_START = /^[\w$]/;
/** Longest insertion accepted in the middle of existing code. */
export const MAX_MID_LINE_CHARS = 40;
