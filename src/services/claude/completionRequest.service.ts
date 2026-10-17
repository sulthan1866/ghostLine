import * as vscode from "vscode";

import { BLOCKING_ERRORS, CONSENT_DIALOG, CONSENT_REQUIRED } from "../../constant/claude.constant";
import { CliProtocolLib } from "../../libs/claude/cliProtocol.lib";
import type { BlockedEvent, CompletionRequestOptions } from "../../types/interfaces/claude.interface";

/**
 * One prompt sent to one CLI process. Settles with the model's reply, or undefined on
 * timeout, cancellation, error, or when the model cannot be used.
 */
export class CompletionRequestService {
  private readonly started = Date.now();
  private done = false;
  private resolve!: (value: string | undefined) => void;
  private timer?: NodeJS.Timeout;
  private cancelSub?: vscode.Disposable;

  constructor(private readonly options: CompletionRequestOptions) {}

  run(prompt: string): Promise<string | undefined> {
    const { proc, timeoutMs, token } = this.options;
    return new Promise<string | undefined>((resolve) => {
      this.resolve = resolve;
      this.timer = setTimeout(() => this.finish(undefined, "timeout"), timeoutMs);
      this.cancelSub = token.onCancellationRequested(() => this.finish(undefined, "cancelled"));

      CliProtocolLib.readJsonLines(proc.stdout, (message) => this.handleMessage(message));
      proc.stderr.setEncoding("utf8");
      proc.stderr.on("data", (chunk: string) => this.options.onStderr(chunk));
      proc.on("exit", (code) => this.finish(undefined, `process exited (${code})`));

      // stdin stays open so the consent prompt can be answered; the process is killed when done.
      proc.stdin.write(CliProtocolLib.encodeLine(CliProtocolLib.userMessage(prompt)));
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleMessage(message: any): void {
    const request = message.type === "control_request" ? message.request : undefined;
    if (request?.subtype === "request_user_dialog" && request.dialog_kind === CONSENT_DIALOG) {
      this.handleConsent(message.request_id, request.payload);
    } else if (BLOCKING_ERRORS.has(message.api_error)) {
      const detail = message.message?.content?.find((block: { type: string }) => block.type === "text")?.text;
      this.block({ kind: message.api_error, model: this.options.model, detail }, `blocked: ${message.api_error}`);
    } else if (message.type === "result") {
      this.handleResult(message);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleConsent(requestId: string, payload: any): void {
    const { proc, model } = this.options;
    if (this.options.isCreditAllowed(model)) {
      proc.stdin.write(CliProtocolLib.encodeLine(CliProtocolLib.dialogResponse(requestId, "consent")));
      return;
    }
    // Nothing has been sent to the model yet; stop here and let the user decide.
    const { overagesEnabled, balanceCents, currency } = payload ?? {};
    this.block(
      { kind: CONSENT_REQUIRED, model, overagesEnabled, balanceCents, currency },
      "usage-credit consent needed",
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleResult(message: any): void {
    const usage = CliProtocolLib.describeUsage(message.usage);
    if (message.is_error) {
      this.finish(undefined, `error: ${message.result ?? message.subtype}${usage}`);
    } else {
      this.finish(message.result ?? "", `ok${usage}`);
    }
  }

  /** Reports why the model can't be used (once, while the request is still open), then ends the request. */
  private block(event: BlockedEvent, reason: string): void {
    if (!this.done) {
      this.options.onBlocked(event);
    }
    this.finish(undefined, reason);
  }

  private finish(value: string | undefined, reason: string): void {
    if (this.done) {
      return;
    }
    this.done = true;
    clearTimeout(this.timer);
    this.cancelSub?.dispose();
    this.options.onFinished(reason, Date.now() - this.started);
    this.resolve(value);
  }
}
