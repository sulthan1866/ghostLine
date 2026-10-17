import * as vscode from "vscode";

import { BlockedEvent, CONSENT_REQUIRED } from "./blockedEvent";
import { CliProcess } from "./cliProcessPool";
import {
  BLOCKING_ERRORS,
  CONSENT_DIALOG,
  describeUsage,
  dialogResponse,
  encodeLine,
  readJsonLines,
  userMessage,
} from "./cliProtocol";

export interface CompletionRequestOptions {
  proc: CliProcess;
  model: string;
  timeoutMs: number;
  token: vscode.CancellationToken;
  /** Whether the user agreed to run this model on usage credits. */
  isCreditAllowed: (model: string) => boolean;
  onBlocked: (event: BlockedEvent) => void;
  onStderr: (chunk: string) => void;
  /** Called once when the request ends, after which the process is no longer needed. */
  onFinished: (reason: string, elapsedMs: number) => void;
}

/**
 * One prompt sent to one CLI process. Settles with the model's reply, or undefined on
 * timeout, cancellation, error, or when the model cannot be used.
 */
export class CompletionRequest {
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

      readJsonLines(proc.stdout, (message) => this.handleMessage(message));
      proc.stderr.setEncoding("utf8");
      proc.stderr.on("data", (chunk: string) => this.options.onStderr(chunk));
      proc.on("exit", (code) => this.finish(undefined, `process exited (${code})`));

      // stdin stays open so the consent prompt can be answered; the process is killed when done.
      proc.stdin.write(encodeLine(userMessage(prompt)));
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleMessage(message: any): void {
    const { proc, model } = this.options;
    const request = message.type === "control_request" ? message.request : undefined;
    if (request?.subtype === "request_user_dialog" && request.dialog_kind === CONSENT_DIALOG) {
      if (this.options.isCreditAllowed(model)) {
        proc.stdin.write(encodeLine(dialogResponse(message.request_id, "consent")));
        return;
      }
      // Nothing has been sent to the model yet; stop here and let the user decide.
      if (!this.done) {
        const { overagesEnabled, balanceCents, currency } = request.payload ?? {};
        this.options.onBlocked({ kind: CONSENT_REQUIRED, model, overagesEnabled, balanceCents, currency });
      }
      this.finish(undefined, "usage-credit consent needed");
    } else if (BLOCKING_ERRORS.has(message.api_error)) {
      const detail = message.message?.content?.find((block: { type: string }) => block.type === "text")?.text;
      if (!this.done) {
        this.options.onBlocked({ kind: message.api_error, model, detail });
      }
      this.finish(undefined, `blocked: ${message.api_error}`);
    } else if (message.type !== "result") {
      return;
    } else if (message.is_error) {
      this.finish(undefined, `error: ${message.result ?? message.subtype}${describeUsage(message.usage)}`);
    } else {
      this.finish(message.result ?? "", `ok${describeUsage(message.usage)}`);
    }
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
