import * as vscode from "vscode";

import { BlockedEvent, CONSENT_REQUIRED, needsCredits } from "../claude/blockedEvent";
import { USAGE_CREDITS_URL } from "./statusTooltip";

type ActionItem = vscode.QuickPickItem & { run: () => unknown };

export interface BlockedPromptActions {
  /** The user agreed to run the model on usage credits. */
  allowCredits: () => void;
  chooseAnotherModel: () => unknown;
}

/** Why the model cannot be used, in the user's terms. */
export function describeBlocked(event: BlockedEvent, modelName: string): string {
  switch (event.kind) {
    case "usage_limit_reached":
      return "You've reached your Claude Code usage limit.";
    case "long_context_credits_required":
      return `This request was too large for ${modelName} without usage credits.`;
    case CONSENT_REQUIRED:
      if (event.overagesEnabled && event.balanceCents && event.currency) {
        const balance = new Intl.NumberFormat("en-AU", { style: "currency", currency: event.currency });
        return `${modelName} runs on usage credits. You have ${balance.format(event.balanceCents / 100)} in credits.`;
      }
      return event.overagesEnabled
        ? `${modelName} runs on usage credits, purchased separately from your plan.`
        : `${modelName} runs on usage credits, which are not turned on for your account.`;
    default:
      return `${modelName} runs on usage credits, purchased separately from your plan.`;
  }
}

/** A popup like the CLI's "Switch to <model>?" prompt: use credits, pick another model, or wait. */
export async function showBlockedPrompt(
  event: BlockedEvent,
  modelName: string,
  actions: BlockedPromptActions,
): Promise<void> {
  const canConsent = event.kind === CONSENT_REQUIRED && event.overagesEnabled === true;
  const items: ActionItem[] = [];
  if (canConsent) {
    items.push({
      label: "$(check) Yes, use usage credits",
      detail: `Suggestions from ${modelName} are charged to your usage credits`,
      run: actions.allowCredits,
    });
  }
  items.push({ label: "$(arrow-swap) No, choose another model", run: actions.chooseAnotherModel });
  if (needsCredits(event.kind)) {
    items.push({
      label: `$(link-external) ${canConsent ? "Learn more" : "Set up usage credits"}`,
      description: "Opens the Claude help article",
      run: () => vscode.env.openExternal(vscode.Uri.parse(USAGE_CREDITS_URL)),
    });
  }
  items.push({
    label: "$(close) Not now",
    description: "Suggestions stay paused for this model",
    run: () => undefined,
  });

  const quickPick = vscode.window.createQuickPick<ActionItem>();
  quickPick.title = event.kind === CONSENT_REQUIRED ? `Switch to ${modelName}?` : "Ghostline paused";
  quickPick.placeholder = describeBlocked(event, modelName);
  quickPick.items = items;
  quickPick.ignoreFocusOut = true;
  const picked = await new Promise<ActionItem | undefined>((resolve) => {
    quickPick.onDidAccept(() => resolve(quickPick.selectedItems[0]));
    quickPick.onDidHide(() => resolve(undefined));
    quickPick.show();
  });
  quickPick.dispose();
  await picked?.run();
}
