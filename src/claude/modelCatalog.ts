import { spawn } from "child_process";

import {
  CLI_ARGS,
  createScratchDir,
  encodeLine,
  initializeRequest,
  readJsonLines,
  removeScratchDir,
} from "./cliProtocol";

export interface ClaudeModelInfo {
  value: string;
  displayName: string;
  description?: string;
}

/** Used when the CLI cannot be asked for its model list. */
export const FALLBACK_MODELS: ClaudeModelInfo[] = [
  { value: "haiku", displayName: "Haiku", description: "Fastest; recommended for completions" },
  { value: "sonnet", displayName: "Sonnet", description: "Balanced speed and quality" },
  { value: "opus", displayName: "Opus", description: "Most capable; slowest" },
];

/** The models this account can use, asked of the CLI once and then cached (a failed attempt is retried). */
export class ModelCatalog {
  private cached?: Promise<ClaudeModelInfo[]>;

  constructor(
    private readonly binaryPath: string,
    private readonly timeoutMs = 30_000,
  ) {}

  list(): Promise<ClaudeModelInfo[]> {
    this.cached ??= queryModels(this.binaryPath, this.timeoutMs).then(
      (models) => (models.length ? models : FALLBACK_MODELS),
      () => {
        this.cached = undefined;
        return FALLBACK_MODELS;
      },
    );
    return this.cached;
  }
}

/** Asks the CLI for its models via the stream-json `initialize` control request. */
function queryModels(binaryPath: string, timeoutMs: number): Promise<ClaudeModelInfo[]> {
  return new Promise((resolve, reject) => {
    const scratchDir = createScratchDir();
    const proc = spawn(binaryPath, CLI_ARGS, { cwd: scratchDir, stdio: "pipe", windowsHide: true });
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
      removeScratchDir(scratchDir);
      if (error) {
        reject(error);
      } else {
        resolve(models ?? []);
      }
    };
    const timer = setTimeout(() => finish(new Error("Timed out listing models")), timeoutMs);

    readJsonLines(proc.stdout, (message) => {
      if (message.type === "control_response") {
        finish(undefined, message.response?.response?.models ?? []);
      }
    });
    proc.on("error", (error) => finish(error));
    proc.on("exit", (code) => finish(new Error(`CLI exited (${code}) before listing models`)));

    proc.stdin.write(encodeLine(initializeRequest("models")));
  });
}
