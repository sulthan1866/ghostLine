import * as vscode from "vscode";

import { CompletionConfig } from "../config/configStore";
import { COMMANDS } from "../constants";

export const USAGE_CREDITS_URL = "https://support.claude.com/en/articles/12429409-extra-usage-for-paid-claude-plans";

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

/** The status bar hover card: current state with a link to change each setting. */
export function buildStatusTooltip(view: StatusView): vscode.MarkdownString {
  const { config, language, languageOff, snoozedUntil, paused } = view;
  const status = !config.enabled ? "Disabled" : snoozedUntil ? `Snoozed until ${snoozedUntil}` : "Enabled";
  const md = new vscode.MarkdownString(undefined, true);
  md.isTrusted = {
    enabledCommands: [
      COMMANDS.toggle,
      COMMANDS.toggleLanguage,
      COMMANDS.toggleNextEdit,
      COMMANDS.selectModel,
      COMMANDS.snooze,
      COMMANDS.retry,
      COMMANDS.openSettings,
    ],
  };
  md.appendMarkdown(`**Ghostline** &nbsp; [$(settings-gear)](command:${COMMANDS.openSettings} "Settings")\n\n---\n\n`);
  md.appendMarkdown(
    `**Inline suggestions:** ${status} &nbsp; [${config.enabled ? "Turn off" : "Turn on"}](command:${COMMANDS.toggle})\n\n`,
  );
  if (language) {
    md.appendMarkdown(
      `**${language}:** ${languageOff ? "Off" : "On"} &nbsp; [${languageOff ? "Turn on" : "Turn off"}](command:${COMMANDS.toggleLanguage})\n\n`,
    );
  }
  md.appendMarkdown(
    `**Next edit suggestions:** ${config.nextEditSuggestions ? "On" : "Off"} &nbsp; [${config.nextEditSuggestions ? "Turn off" : "Turn on"}](command:${COMMANDS.toggleNextEdit})\n\n`,
  );
  md.appendMarkdown(`**Model:** \`${config.model}\` &nbsp; [Change](command:${COMMANDS.selectModel})\n\n`);
  if (paused) {
    const learnMore = paused.needsCredits ? ` · [Learn more](${USAGE_CREDITS_URL})` : "";
    md.appendMarkdown(
      `$(warning) **Paused:** ${paused.reason}\n\n` +
        `[Choose another model](command:${COMMANDS.selectModel}) · [Try again](command:${COMMANDS.retry})${learnMore}\n\n`,
    );
  }
  md.appendMarkdown("---\n\n");
  md.appendMarkdown(`[$(clock) ${snoozedUntil ? "Resume now" : "Snooze 5 min"}](command:${COMMANDS.snooze})`);
  return md;
}
