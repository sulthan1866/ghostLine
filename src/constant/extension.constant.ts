/** Identifiers shared with package.json: command IDs, the settings section and `when` clause contexts. */

export const CONFIG_SECTION = "ghostline";

export const COMMANDS = {
  toggle: "ghostline.toggle",
  toggleLanguage: "ghostline.toggleLanguage",
  toggleNextEdit: "ghostline.toggleNextEdit",
  selectModel: "ghostline.selectModel",
  snooze: "ghostline.snooze",
  retry: "ghostline.retry",
  openSettings: "ghostline.openSettings",
  statusClick: "ghostline.statusClick",
  acceptEdit: "ghostline.acceptEdit",
  dismissEdit: "ghostline.dismissEdit",
} as const;

/** `when` clause context set while a next edit suggestion is shown. */
export const EDIT_SUGGESTION_VISIBLE_CONTEXT = "ghostline.editSuggestionVisible";
