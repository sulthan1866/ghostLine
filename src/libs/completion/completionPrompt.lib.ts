import type { CompletionContext } from "../../types/interfaces/completion.interface";

export class CompletionPromptLib {
  static build(ctx: CompletionContext): string {
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
}
