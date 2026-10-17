import { COMPLETABLE_LINE_END, MAX_MID_LINE_CHARS, WORD_END, WORD_START } from "../../constant/completion.constant";
import type { CompletionContext } from "../../types/interfaces/completion.interface";

export class PostProcessLib {
  /** Turns the raw model reply into text that can be inserted at the cursor. */
  static cleanCompletion(raw: string, ctx: CompletionContext, maxLines: number): string | undefined {
    let text = PostProcessLib.stripWrapping(raw);
    text = PostProcessLib.stripRepeatedPrefix(text, ctx);
    text = PostProcessLib.trimToLineSuffix(text, ctx);
    text = PostProcessLib.dropRepeatedSuffixLines(text.split("\n"), ctx).slice(0, maxLines).join("\n").trimEnd();

    if (WORD_END.test(ctx.linePrefix) && WORD_START.test(ctx.lineSuffix)) {
      return PostProcessLib.completeWord(text, ctx);
    }
    if (!text.trim() || !PostProcessLib.fitsMidLine(text, ctx) || PostProcessLib.copiesPreviousLine(text, ctx)) {
      return undefined;
    }
    return text;
  }

  /** Takes the text inside `<completion>` tags (if any) and drops a surrounding code fence. */
  private static stripWrapping(raw: string): string {
    const tagged = raw.match(/<completion>([\s\S]*?)<\/completion>/);
    const text = tagged ? tagged[1] : raw;
    return text.replace(/^```[\w+-]*\n/, "").replace(/\n?```\s*$/, "");
  }

  /** Removes anything the model repeated from before the cursor on the current line. */
  private static stripRepeatedPrefix(text: string, ctx: CompletionContext): string {
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
    return typed && text.startsWith(typed) ? text.slice(typed.length) : text;
  }

  /** Mid-line: one line only, and don't duplicate what's already after the cursor. */
  private static trimToLineSuffix(text: string, ctx: CompletionContext): string {
    const rest = ctx.lineSuffix.trim();
    if (!rest) {
      return text;
    }
    const line = text.split("\n")[0];
    return line.endsWith(rest) ? line.slice(0, -rest.length) : line;
  }

  /** Drops trailing lines that duplicate the code just after the cursor (e.g. closing braces). */
  private static dropRepeatedSuffixLines(lines: string[], ctx: CompletionContext): string[] {
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
    return lines;
  }

  /** Model copied the line above instead of continuing. */
  private static copiesPreviousLine(text: string, ctx: CompletionContext): boolean {
    const previousLine = ctx.prefix
      .slice(0, ctx.prefix.length - ctx.linePrefix.length)
      .trimEnd()
      .split("\n")
      .pop()
      ?.trim();
    const newLine = (ctx.linePrefix + text.split("\n")[0] + ctx.lineSuffix).trim();
    return !!previousLine && newLine === previousLine;
  }

  /**
   * Inside existing code, only accept small insertions; anything bigger would be
   * spliced into the middle of the line.
   */
  private static fitsMidLine(text: string, ctx: CompletionContext): boolean {
    return COMPLETABLE_LINE_END.test(ctx.lineSuffix) || (!text.includes("\n") && text.length <= MAX_MID_LINE_CHARS);
  }

  /**
   * Cursor inside a word, like Copilot's `cur|ent` → `r`. Models often also write the rest of the word
   * (`rent`, `rrent`), so try each way of dropping the end of the reply and keep the first that makes a
   * word already used nearby. A guess that makes an unknown word (`com|ole` → `comsole`) is dropped.
   */
  private static completeWord(text: string, ctx: CompletionContext): string | undefined {
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
}
