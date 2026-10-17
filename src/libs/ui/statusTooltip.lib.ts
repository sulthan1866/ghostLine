import * as vscode from "vscode";

import { COMMANDS } from "../../constant/extension.constant";
import { USAGE_CREDITS_URL } from "../../constant/ui.constant";
import type { StatusView } from "../../types/interfaces/ui.interface";

export class StatusTooltipLib {
  /** The status bar hover card: current state with a link to change each setting. */
  static build(view: StatusView): vscode.MarkdownString {
    const { config, language, languageOff, snoozedUntil, paused } = view;
    const status = !config.enabled ? "Disabled" : snoozedUntil ? `Snoozed until ${snoozedUntil}` : "Enabled";
    const toggleRow = StatusTooltipLib.toggleRow;
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
    md.appendMarkdown(
      `**Ghostline** &nbsp; [$(settings-gear)](command:${COMMANDS.openSettings} "Settings")\n\n---\n\n`,
    );
    md.appendMarkdown(toggleRow("Inline suggestions", status, config.enabled, COMMANDS.toggle));
    if (language) {
      md.appendMarkdown(toggleRow(language, languageOff ? "Off" : "On", !languageOff, COMMANDS.toggleLanguage));
    }
    md.appendMarkdown(
      toggleRow(
        "Next edit suggestions",
        config.nextEditSuggestions ? "On" : "Off",
        config.nextEditSuggestions,
        COMMANDS.toggleNextEdit,
      ),
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

  /** One setting row: its label and state, with a link that flips it. */
  private static toggleRow(label: string, state: string, isOn: boolean, command: string): string {
    return `**${label}:** ${state} &nbsp; [${isOn ? "Turn off" : "Turn on"}](command:${command})\n\n`;
  }
}
