import type { CompletionConfig } from "./config.interface";

export interface BlockedPromptActions {
  /** The user agreed to run the model on usage credits. */
  allowCredits: () => void;
  chooseAnotherModel: () => unknown;
}

export interface StatusView {
  config: CompletionConfig;
  /** Language of the active editor, if any. */
  language?: string;
  languageOff: boolean;
  /** When the snooze ends, while snoozed. */
  snoozedUntil?: string;
  /** Why suggestions are paused for the current model, if they are. */
  paused?: { reason: string; needsCredits: boolean };
}
