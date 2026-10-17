import type { SuggestionRoute } from "../types/routing.type";

/** A single text change, reduced to what decides which feature handles it. */
export interface EditShape {
  /** Characters the change removed (0 for plain typing). */
  replacedLength: number;
  insertedText: string;
  /** Text after the cursor on its line once the change is applied. */
  lineSuffix: string;
}

export interface RoutedEdit {
  version: number;
  route: SuggestionRoute;
}
