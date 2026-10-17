export const DEFAULT_MODEL = "haiku";

/** Where the chosen model is kept. It is picked from the account's model list, so it is not a setting. */
export const MODEL_STATE_KEY = "ghostline.model";

/** Kept in step with the `ghostline.excludedLanguages` default in package.json. */
export const DEFAULT_EXCLUDED_LANGUAGES = ["plaintext", "scminput", "log"];
