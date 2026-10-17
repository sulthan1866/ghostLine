import * as vscode from "vscode";

import { CLI_ARGS, COMPLETION_ARGS, COMPLETION_ENV } from "../../constant/claude.constant";
import type { BlockedEvent } from "../../types/interfaces/claude.interface";
import type { CompletionConfig } from "../../types/interfaces/config.interface";
import { CliProcessPoolService } from "./cliProcessPool.service";
import { CompletionRequestService } from "./completionRequest.service";

/**
 * Sends prompts to the Claude Code CLI with a fixed system prompt.
 * Each request uses a fresh process from the pool, so no conversation history
 * accumulates and cancelling a request is simply killing its process.
 */
export class ClaudeEngineService implements vscode.Disposable {
  private readonly pool: CliProcessPoolService;
  private readonly blocked = new vscode.EventEmitter<BlockedEvent>();
  /** Fires when the model cannot be used, e.g. it needs usage credits the CLI cannot agree to headlessly. */
  readonly onBlocked = this.blocked.event;
  /** Models the user agreed to run on usage credits; the CLI's consent prompt is answered "yes" for these. */
  private readonly creditsAllowed = new Set<string>();

  constructor(
    binaryPath: string,
    private config: CompletionConfig,
    private readonly log: vscode.OutputChannel,
    /** Tags this engine's log lines, so usage can be told apart per feature. */
    private readonly label: string,
    private readonly systemPrompt: string,
  ) {
    this.pool = new CliProcessPoolService(binaryPath, () => this.cliArgs(), COMPLETION_ENV, log);
  }

  updateConfig(config: CompletionConfig): void {
    const restart = config.model !== this.config.model;
    this.config = config;
    if (restart) {
      this.pool.restart();
    }
  }

  /** Answer the CLI's usage-credit prompt with "consent" for this model from now on. */
  allowUsageCredits(model: string): void {
    this.creditsAllowed.add(model);
  }

  complete(prompt: string, token: vscode.CancellationToken): Promise<string | undefined> {
    const proc = this.pool.take();
    const request = new CompletionRequestService({
      proc,
      model: this.config.model,
      timeoutMs: this.config.timeoutMs,
      token,
      isCreditAllowed: (model) => this.creditsAllowed.has(model),
      onBlocked: (event) => this.blocked.fire(event),
      onStderr: (chunk) => this.log.append(`[stderr] ${chunk}`),
      onFinished: (reason, elapsedMs) => {
        this.pool.kill(proc);
        this.log.appendLine(`[${new Date().toISOString()}] [${this.label}] ${reason} in ${elapsedMs} ms`);
      },
    });
    return request.run(prompt);
  }

  private cliArgs(): string[] {
    return [...CLI_ARGS, ...COMPLETION_ARGS, "--model", this.config.model, "--system-prompt", this.systemPrompt];
  }

  dispose(): void {
    this.blocked.dispose();
    this.pool.dispose();
  }
}
