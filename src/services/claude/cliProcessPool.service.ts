import { spawn } from "child_process";
import * as vscode from "vscode";

import { CONSENT_DIALOG } from "../../constant/claude.constant";
import { CliProtocolLib } from "../../libs/claude/cliProtocol.lib";
import type { CliProcess } from "../../types/types/claude.type";

/**
 * Keeps one CLI process spawned and idle ("warm spare") so the 1-2 s start-up
 * cost is paid while the user is typing, not when a completion is needed.
 * Every process runs in the pool's own empty scratch directory.
 */
export class CliProcessPoolService implements vscode.Disposable {
  private spare?: CliProcess;
  private readonly scratchDir = CliProtocolLib.createScratchDir();
  private readonly live = new Set<CliProcess>();

  constructor(
    private readonly binaryPath: string,
    /** Read on every spawn, so a changed model applies to the next process. */
    private readonly getArgs: () => string[],
    /** Added to this extension host's environment. */
    private readonly extraEnv: Record<string, string>,
    private readonly log: vscode.OutputChannel,
  ) {
    this.warm();
  }

  /** Hands out the warm spare (or a fresh process if it died) and starts the next spare. */
  take(): CliProcess {
    let proc = this.spare;
    this.spare = undefined;
    if (!proc || proc.exitCode !== null || proc.killed) {
      proc = this.spawnProcess();
    }
    this.warm();
    return proc;
  }

  /** Replaces the spare, e.g. after the arguments changed. */
  restart(): void {
    this.kill(this.spare);
    this.spare = undefined;
    this.warm();
  }

  kill(proc?: CliProcess): void {
    if (proc && proc.exitCode === null && !proc.killed) {
      proc.kill();
    }
  }

  private warm(): void {
    if (!this.spare || this.spare.exitCode !== null) {
      this.spare = this.spawnProcess();
    }
  }

  private spawnProcess(): CliProcess {
    const proc = spawn(this.binaryPath, this.getArgs(), {
      cwd: this.scratchDir,
      env: { ...process.env, ...this.extraEnv },
      stdio: "pipe",
      windowsHide: true,
    });
    // Declare that we can answer the usage-credit prompt; otherwise the CLI cannot ask.
    proc.stdin.write(CliProtocolLib.encodeLine(CliProtocolLib.initializeRequest("init", [CONSENT_DIALOG])));
    this.live.add(proc);
    proc.on("exit", () => this.live.delete(proc));
    proc.on("error", (error) => this.log.appendLine(`[spawn error] ${error.message}`));
    proc.stdin.on("error", () => undefined); // writes after the process exits are expected
    return proc;
  }

  dispose(): void {
    for (const proc of this.live) {
      this.kill(proc);
    }
    CliProtocolLib.removeScratchDir(this.scratchDir);
  }
}
