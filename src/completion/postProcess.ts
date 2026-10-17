import type { CompletionContext } from "./completionContext";

/** Text after the cursor that leaves room for normal code: closing brackets, quotes and punctuation. */
const COMPLETABLE_LINE_END = /^[\s)\]}>"'`;,:.]*$/;
const WORD_END = /[\w$]$/;
const WORD_START = /^[\w$]/;
/** Longest insertion accepted in the middle of existing code. */
const MAX_MID_LINE_CHARS = 40;

/** Turns the raw model reply into text that can be inserted at the cursor. */
export function cleanCompletion(raw: string, ctx: CompletionContext, maxLines: number): string | undefined {
  const tagged = raw.match(/<completion>([\s\S]*?)<\/completion>/);
  let text = tagged ? tagged[1] : raw;
  text = text.replace(/^```[\w+-]*\n/, "").replace(/\n?```\s*$/, "");

  const lineIsBlank = ctx.linePrefix.trim() === "";

  // Models often pad with a newline after <completion>; drop it on blank lines.
  if (lineIsBlank && text.startsWith("\n")) {
    text = text.slice(1);
  }
  // Avoid double indentation when the cursor already sits after the indent.
  if (lineIsBlank && ctx.linePrefix.length > 0 && text.startsWith(ctx.linePrefix)) {
    text = text.slice(ctx.linePrefix.length);
  }
  // Model repeated the current line's start.
  const typed = ctx.linePrefix.trimStart();
  if (typed && text.startsWith(typed)) {
    text = text.slice(typed.length);
  }

  // Mid-line: one line only, and don't duplicate what's already after the cursor.
  const rest = ctx.lineSuffix.trim();
  if (rest) {
    text = text.split("\n")[0];
    if (text.endsWith(rest)) {
      text = text.slice(0, -rest.length);
    }
  }

  // Drop trailing lines that duplicate the code just after the cursor (e.g. closing braces).
  const lines = text.split("\n");
  const nextLines = ctx.suffix
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let i = 0;
  while (lines.length > 1 && i < nextLines.length) {
    const last = lines[lines.length - 1].trim();
    if (last === "") {
      lines.pop();
      continue;
    }
    if (nextLines.slice(0, 5).includes(last)) {
      lines.pop();
      i++;
      continue;
    }
    break;
  }

  text = lines.slice(0, maxLines).join("\n").trimEnd();
  if (WORD_END.test(ctx.linePrefix) && WORD_START.test(ctx.lineSuffix)) {
    return completeWord(text, ctx);
  }
  if (!text.trim() || !fitsMidLine(text, ctx)) {
    return undefined;
  }

  // Model copied the line above instead of continuing.
  const previousLine = ctx.prefix
    .slice(0, ctx.prefix.length - ctx.linePrefix.length)
    .trimEnd()
    .split("\n")
    .pop()
    ?.trim();
  const newLine = (ctx.linePrefix + text.split("\n")[0] + ctx.lineSuffix).trim();
  return previousLine && newLine === previousLine ? undefined : text;
}

/**
 * Inside existing code, only accept small insertions; anything bigger would be
 * spliced into the middle of the line.
 */
function fitsMidLine(text: string, ctx: CompletionContext): boolean {
  return COMPLETABLE_LINE_END.test(ctx.lineSuffix) || (!text.includes("\n") && text.length <= MAX_MID_LINE_CHARS);
}

/**
 * Cursor inside a word, like Copilot's `cur|ent` → `r`. Models often also write the rest of the word
 * (`rent`, `rrent`), so try each way of dropping the end of the reply and keep the first that makes a
 * word already used nearby. A guess that makes an unknown word (`com|ole` → `comsole`) is dropped.
 */
function completeWord(text: string, ctx: CompletionContext): string | undefined {
  if (!/^[\w$]{1,20}$/.test(text)) {
    return undefined;
  }
  const head = ctx.linePrefix.match(/[\w$]+$/)![0];
  const tail = ctx.lineSuffix.match(/^[\w$]+/)![0];
  const nearby = [
    ctx.prefix.slice(0, -ctx.linePrefix.length),
    ctx.suffix.slice(ctx.lineSuffix.length),
    ...ctx.snippets.map((s) => s.text),
  ].join("\n");
  const words = new Set(nearby.match(/[\w$]+/g));
  for (let length = text.length; length > 0; length--) {
    const insert = text.slice(0, length);
    if (words.has(head + insert + tail)) {
      return insert;
    }
  }
  return undefined;
}
