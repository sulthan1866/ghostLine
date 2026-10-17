import { COMPLETABLE_LINE_END } from "../../constant/completion.constant";
import type { EditShape } from "../../types/interfaces/routing.interface";
import type { SuggestionRoute } from "../../types/types/routing.type";

export class SuggestionRouteLib {
  /**
   * Picks the one feature worth a model call for an edit, so completion and next edit
   * never both run on the same keystroke: writing new code at the end of a line is
   * completion, changing existing code is next edit.
   */
  static decide(edit: EditShape): SuggestionRoute {
    // Accepting an IntelliSense item replaces the typed word with a longer one, which is still typing.
    const extendsWord = !edit.insertedText.includes("\n") && edit.insertedText.length > edit.replacedLength;
    if (edit.replacedLength > 0 && !extendsWord) {
      return "nextEdit";
    }
    return COMPLETABLE_LINE_END.test(edit.lineSuffix) ? "complete" : "nextEdit";
  }
}
