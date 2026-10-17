import { spawn } from "child_process";

import { CLI_ARGS, FALLBACK_MODELS, MODEL_LIST_TIMEOUT_MS } from "../../constant/claude.constant";
import { CliProtocolLib } from "../../libs/claude/cliProtocol.lib";
import type { ClaudeModelInfo } from "../../types/interfaces/claude.interface";

/** The models this account can use, asked of the CLI once and then cached (a failed attempt is retried). */
export class ModelCatalogService {
  private cached?: Promise<ClaudeModelInfo[]>;

  constructor(
    private readonly binaryPath: string,
    private readonly timeoutMs = MODEL_LIST_TIMEOUT_MS,
  ) {}

  list(): Promise<ClaudeModelInfo[]> {
    this.cached ??= this.queryModels().then(
      (models) => (models.length ? models : FALLBACK_MODELS),
      () => {
        this.cached = undefined;
        return FALLBACK_MODELS;
      },
    );
    return this.cached;
  }

  /** Asks the CLI for its models via the stream-json `initialize` control request. */
  private queryModels(): Promise<ClaudeModelInfo[]> {
    return new Promise((resolve, reject) => {
      const scratchDir = CliProtocolLib.createScratchDir();
      const proc = spawn(this.binaryPath, CLI_ARGS, { cwd: scratchDir, stdio: "pipe", windowsHide: true });
      let done = false;
      const finish = (error?: Error, models?: ClaudeModelInfo[]) => {
        if (done) {
          return;
        }
        done = true;
        clearTimeout(timer);
        if (proc.exitCode === null && !proc.killed) {
          proc.kill();
        }
        CliProtocolLib.removeScratchDir(scratchDir);
        if (error) {
          reject(error);
        } else {
          resolve(models ?? []);
        }
      };
      const timer = setTimeout(() => finish(new Error("Timed out listing models")), this.timeoutMs);

      CliProtocolLib.readJsonLines(proc.stdout, (message) => {
        if (message.type === "control_response") {
          finish(undefined, message.response?.response?.models ?? []);
        }
      });
      proc.on("error", (error) => finish(error));
      proc.on("exit", (code) => finish(new Error(`CLI exited (${code}) before listing models`)));

      proc.stdin.write(CliProtocolLib.encodeLine(CliProtocolLib.initializeRequest("models")));
    });
  }
}
