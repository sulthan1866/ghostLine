/** Stream-json messages exchanged with the Claude Code CLI, and the scratch directory it runs in. */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Readable } from "stream";

import type { Usage } from "../../types/interfaces/claude.interface";

export class CliProtocolLib {
  /** e.g. "tokens 1,290 total | 1,234 in (1,100 cached) | 56 out (10 thinking)" */
  static describeUsage(usage: Usage): string {
    const count = (value: number): string => value.toLocaleString("en-AU");
    const cached = usage.cache_read_input_tokens ?? 0;
    const input = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + cached;
    const output = usage.output_tokens ?? 0;
    const thinking = usage.output_tokens_details?.thinking_tokens ?? 0;
    return [
      `tokens ${count(input + output)} total`,
      `${count(input)} in${cached ? ` (${count(cached)} cached)` : ""}`,
      `${count(output)} out${thinking ? ` (${count(thinking)} thinking)` : ""}`,
    ].join(" | ");
  }

  /** One stream-json input line. */
  static encodeLine(message: unknown): string {
    return `${JSON.stringify(message)}\n`;
  }

  static userMessage(prompt: string): unknown {
    return { type: "user", message: { role: "user", content: [{ type: "text", text: prompt }] } };
  }

  /** The `initialize` control request; `supportedDialogKinds` lists the prompts this host can answer. */
  static initializeRequest(requestId: string, supportedDialogKinds?: string[]): unknown {
    const request = supportedDialogKinds ? { subtype: "initialize", supportedDialogKinds } : { subtype: "initialize" };
    return { type: "control_request", request_id: requestId, request };
  }

  static dialogResponse(requestId: string, result: string): unknown {
    const response = { subtype: "success", request_id: requestId, response: { behavior: "completed", result } };
    return { type: "control_response", response };
  }

  /**
   * Calls `onMessage` for each complete JSON line on the stream (a chunk can end part-way through one).
   * Lines that are not JSON, and errors thrown while handling a message, are ignored.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static readJsonLines(stream: Readable, onMessage: (message: any) => void): void {
    let buffer = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
      buffer += chunk;
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        try {
          onMessage(JSON.parse(line));
        } catch {
          /* not JSON, e.g. a blank line */
        }
      }
    });
  }

  /** Empty working directory: keeps project CLAUDE.md files and settings out of the CLI's context. */
  static createScratchDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "ghostline-"));
  }

  static removeScratchDir(scratchDir: string): void {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  }
}
