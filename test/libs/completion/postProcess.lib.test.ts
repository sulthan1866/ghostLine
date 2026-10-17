import { PostProcessLib } from "../../../src/libs/completion/postProcess.lib";
import type { CompletionContext } from "../../../src/types/interfaces/completion.interface";

const MAX_LINES = 12;

/** Builds a context from source text with a `|` marking the cursor. */
function contextAt(source: string): CompletionContext {
  const cursor = source.indexOf("|");
  const prefix = source.slice(0, cursor);
  const suffix = source.slice(cursor + 1);
  return {
    languageId: "typescript",
    relativePath: "a.ts",
    prefix,
    suffix,
    linePrefix: prefix.slice(prefix.lastIndexOf("\n") + 1),
    lineSuffix: suffix.split("\n")[0],
    snippets: [],
  };
}

describe("cleanCompletion", () => {
  it("unwraps the completion tag and markdown fences", () => {
    const ctx = contextAt("function a() {\n  |\n}");
    expect(PostProcessLib.cleanCompletion("<completion>```ts\nfoo();\n```</completion>", ctx, MAX_LINES)).toBe(
      "foo();",
    );
  });

  it("drops indentation the cursor already sits after", () => {
    const ctx = contextAt("function a() {\n  |\n}");
    expect(PostProcessLib.cleanCompletion("<completion>  return 1;</completion>", ctx, MAX_LINES)).toBe("return 1;");
  });

  it("drops a repeated start of the current line", () => {
    const ctx = contextAt("const total = |");
    expect(PostProcessLib.cleanCompletion("<completion>const total = a + b;</completion>", ctx, MAX_LINES)).toBe(
      "a + b;",
    );
  });

  it("keeps one line mid-line and does not repeat the text after the cursor", () => {
    const ctx = contextAt("call(a|)");
    expect(PostProcessLib.cleanCompletion("<completion>, b)\nmore</completion>", ctx, MAX_LINES)).toBe(", b");
  });

  it("drops trailing lines that already follow the cursor", () => {
    const ctx = contextAt("if (x) {\n  |\n}\n");
    expect(PostProcessLib.cleanCompletion("<completion>doIt();\n}</completion>", ctx, MAX_LINES)).toBe("doIt();");
  });

  it("limits the number of lines", () => {
    const ctx = contextAt("|");
    expect(PostProcessLib.cleanCompletion("<completion>a\nb\nc</completion>", ctx, 2)).toBe("a\nb");
  });

  it("returns undefined for an empty completion", () => {
    const ctx = contextAt("function a() {\n  |\n}");
    expect(PostProcessLib.cleanCompletion("<completion></completion>", ctx, MAX_LINES)).toBeUndefined();
  });

  it("rejects a copy of the line above", () => {
    const ctx = contextAt("const a = 1;\n|");
    expect(PostProcessLib.cleanCompletion("<completion>const a = 1;</completion>", ctx, MAX_LINES)).toBeUndefined();
  });

  it("rejects a long insertion in the middle of code", () => {
    const ctx = contextAt("foo(|bar)");
    expect(
      PostProcessLib.cleanCompletion(`<completion>${"x, ".repeat(15)}</completion>`, ctx, MAX_LINES),
    ).toBeUndefined();
  });

  describe("inside a word", () => {
    it("inserts only the missing letters of a word used nearby", () => {
      const ctx = contextAt("const current = 1;\ncur|ent + 1;");
      expect(PostProcessLib.cleanCompletion("<completion>rent</completion>", ctx, MAX_LINES)).toBe("r");
    });

    it("rejects a guess that makes an unknown word", () => {
      const ctx = contextAt("com|ole.log(x);");
      expect(PostProcessLib.cleanCompletion("<completion>s</completion>", ctx, MAX_LINES)).toBeUndefined();
    });
  });
});

describe("replacedSuffixLength", () => {
  it("replaces an auto-closed quote the completion already writes", () => {
    expect(PostProcessLib.replacedSuffixLength(`Hi! I'm GhostLine";`, `"`)).toBe(1);
  });

  it("replaces auto-closed brackets the completion writes in order", () => {
    expect(PostProcessLib.replacedSuffixLength(`a, ["b"]);`, `])  `)).toBe(2);
  });

  it("keeps closers the completion does not write", () => {
    expect(PostProcessLib.replacedSuffixLength("a, b", ")")).toBe(0);
    expect(PostProcessLib.replacedSuffixLength("a)]", "])")).toBe(0);
  });

  it("keeps the rest of the line when it is real code", () => {
    expect(PostProcessLib.replacedSuffixLength("x, bar)", "bar)")).toBe(0);
  });

  it("does nothing at the end of a line", () => {
    expect(PostProcessLib.replacedSuffixLength("foo();", "")).toBe(0);
  });
});
