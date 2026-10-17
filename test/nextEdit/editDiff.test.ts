import { CharChange, changedLines, charChanges, parseEdit, sameLines } from "../../src/nextEdit/editDiff";

/** Applies character changes to a line, from right to left so earlier columns stay valid. */
function apply(line: string, changes: CharChange[]): string {
  return [...changes]
    .reverse()
    .reduce((text, c) => text.slice(0, c.start) + c.inserted + text.slice(c.start + c.deleted), line);
}

describe("parseEdit", () => {
  it("converts 1-based inclusive line numbers to 0-based", () => {
    expect(parseEdit('<edit start="3" end="4">\n  a\n  b\n</edit>', 0, 10)).toEqual({
      start: 2,
      end: 3,
      lines: ["  a", "  b"],
    });
  });

  it("treats an empty body as a deletion", () => {
    expect(parseEdit('<edit start="2" end="2"></edit>', 0, 10)).toEqual({ start: 1, end: 1, lines: [] });
  });

  it("strips copied excerpt line numbers only when every line has one", () => {
    expect(parseEdit('<edit start="12" end="13">12| foo\r\n13|   bar</edit>', 0, 20)?.lines).toEqual(["foo", "  bar"]);
    expect(parseEdit('<edit start="12" end="13">12| foo\nbar</edit>', 0, 20)?.lines).toEqual(["12| foo", "bar"]);
  });

  it.each([
    ["<no_edit/>", 0, 10],
    ['<edit start="1" end="2">x</edit>', 1, 10],
    ['<edit start="5" end="12">x</edit>', 0, 10],
    ['<edit start="5" end="4">x</edit>', 0, 10],
    [`<edit start="1" end="1">${"x\n".repeat(21)}</edit>`, 0, 10],
  ])("rejects %j within lines %i-%i", (raw, first, last) => {
    expect(parseEdit(raw, first, last)).toBeUndefined();
  });
});

describe("charChanges", () => {
  it.each([
    ["retrun totl;", "return total;"],
    ["fucntion add(a, b) {", "function add(a, b) {"],
    ["const x = 1", "const x = 1;"],
  ])("describes %j → %j as a small in-place change", (before, after) => {
    const changes = charChanges(before, after);
    expect(changes).toBeDefined();
    expect(apply(before, changes!)).toBe(after);
  });

  it("returns undefined for a blank line or a rewrite of the whole line", () => {
    expect(charChanges("   ", "foo();")).toBeUndefined();
    expect(
      charChanges("const a = computeTotal(items);", "return items.reduce((s, i) => s + i.price, 0);"),
    ).toBeUndefined();
  });

  it("returns undefined for very long lines", () => {
    expect(charChanges("a".repeat(301), "b")).toBeUndefined();
  });
});

describe("sameLines", () => {
  it("compares line arrays by value", () => {
    expect(sameLines(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameLines(["a"], ["a", "b"])).toBe(false);
    expect(sameLines(["a", "b"], ["a", "c"])).toBe(false);
  });
});

describe("changedLines", () => {
  it("drops the lines both versions share at the start and end", () => {
    expect(changedLines(["a", "b", "c", "d"], ["a", "x", "y", "d"])).toEqual({
      head: 1,
      removed: ["b", "c"],
      added: ["x", "y"],
    });
  });

  it("reports a pure insertion with nothing removed", () => {
    expect(changedLines(["a", "b"], ["a", "new", "b"])).toEqual({ head: 1, removed: [], added: ["new"] });
  });
});
