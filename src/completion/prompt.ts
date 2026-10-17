import type { CompletionContext } from "./completionContext";

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

export function buildPrompt(ctx: CompletionContext): string {
  const parts: string[] = [];
  for (const snippet of ctx.snippets) {
    parts.push(`<related_snippet path="${snippet.path}">\n${snippet.text}\n</related_snippet>`);
  }
  const mode = ctx.lineSuffix.trim()
    ? "The cursor is in the middle of a line: complete only the rest of this line."
    : "Complete the current line and, if natural, the next few lines of the block.";
  parts.push(
    `<file path="${ctx.relativePath}" language="${ctx.languageId}">\n${ctx.prefix}<CURSOR/>${ctx.suffix}\n</file>`,
    mode,
  );
  return parts.join("\n\n");
}
