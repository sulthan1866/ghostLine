import { SuggestionRouteLib } from "../../../src/libs/routing/suggestionRoute.lib";

describe("decide", () => {
  it.each([
    ["typing at the end of a line", 0, "x", ""],
    ["typing before closing brackets", 0, "a", ");"],
    ["pressing Enter onto a new line", 0, "\n  ", ""],
    ["accepting an IntelliSense item over the typed word", 2, "log", ")"],
  ])("routes %s to completion", (_name, replacedLength, insertedText, lineSuffix) => {
    expect(SuggestionRouteLib.decide({ replacedLength, insertedText, lineSuffix })).toBe("complete");
  });

  it.each([
    ["typing in the middle of existing code", 0, "x", "Name = 1;"],
    ["deleting characters", 1, "", ""],
    ["overwriting a selection with shorter text", 3, "b", ""],
    ["replacing across lines", 4, "a\nb", ""],
  ])("routes %s to next edit", (_name, replacedLength, insertedText, lineSuffix) => {
    expect(SuggestionRouteLib.decide({ replacedLength, insertedText, lineSuffix })).toBe("nextEdit");
  });
});
