import { CompletionCache } from "../../src/completion/completionCache";

describe("CompletionCache", () => {
  const uri = "file:///a.ts";

  it("returns the whole suggestion when nothing new has been typed", () => {
    const cache = new CompletionCache();
    cache.set(uri, "const x = ", "compute();");
    expect(cache.get(uri, "const x = ")).toBe("compute();");
  });

  it("returns the remainder while the user types the suggestion", () => {
    const cache = new CompletionCache();
    cache.set(uri, "const x = ", "compute();");
    expect(cache.get(uri, "const x = comp")).toBe("ute();");
  });

  it("misses once the typed text diverges from the suggestion", () => {
    const cache = new CompletionCache();
    cache.set(uri, "const x = ", "compute();");
    expect(cache.get(uri, "const x = cal")).toBeUndefined();
  });

  it("misses once the whole suggestion has been typed", () => {
    const cache = new CompletionCache();
    cache.set(uri, "const x = ", "compute();");
    expect(cache.get(uri, "const x = compute();")).toBeUndefined();
  });

  it("misses for another document or after clear()", () => {
    const cache = new CompletionCache();
    cache.set(uri, "a", "b");
    expect(cache.get("file:///other.ts", "a")).toBeUndefined();
    cache.clear();
    expect(cache.get(uri, "a")).toBeUndefined();
  });
});
