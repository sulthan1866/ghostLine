/** Arguments, environment and stream-json messages exchanged with the Claude Code CLI. */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Readable } from "stream";

/** Stream-json I/O with no tools, MCP servers, hooks or project settings: a plain prompt in, text out. */
export const CLI_ARGS = [
  "-p",
  "--input-format",
  "stream-json",
  "--output-format",
  "stream-json",
  "--verbose",
  "--safe-mode",
  "--strict-mcp-config",
  "--tools",
  "",
];

/** Completions need no reasoning: keep thinking off so output tokens are spent on the answer. */
export const COMPLETION_ARGS = ["--effort", "low", "--settings", JSON.stringify({ alwaysThinkingEnabled: false })];

/**
 * Measured on CLI 2.1.300 (see the usage line in the output channel):
 * - NONESSENTIAL_TRAFFIC stops a second, hidden `generate_session_title` request per completion.
 * - Prompt caching never hits (the prompt changes with every keystroke) but every request paid
 *   for a cache write, which costs more than plain input.
 * - The output cap leaves room for a 12-line completion or a next-edit suggestion.
 */
export const COMPLETION_ENV = {
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: "1",
  DISABLE_PROMPT_CACHING: "1",
  CLAUDE_CODE_MAX_OUTPUT_TOKENS: "512",
};

/** CLI `api_error` kinds that fail every request until the user changes model or account settings. */
export const BLOCKING_ERRORS = new Set([
  "model_requires_usage_credits",
  "long_context_credits_required",
  "consent_unanswered",
  "no_allowed_fallback",
  "usage_limit_reached",
]);

/** The CLI's "Switch to <model>? It runs on usage credits" prompt, which a stream-json host can answer. */
export const CONSENT_DIALOG = "fable_overage_consent_prompt";

interface Usage {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
  output_tokens_details?: { thinking_tokens?: number };
}

export function describeUsage(usage: Usage | undefined): string {
  if (!usage) {
    return "";
  }
  const input =
    (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  const thinking = usage.output_tokens_details?.thinking_tokens ?? 0;
  return ` (${input} in, ${usage.output_tokens ?? 0} out${thinking ? `, ${thinking} thinking` : ""})`;
}

/** One stream-json input line. */
export function encodeLine(message: unknown): string {
  return `${JSON.stringify(message)}\n`;
}

export function userMessage(prompt: string): unknown {
  return { type: "user", message: { role: "user", content: [{ type: "text", text: prompt }] } };
}

/** The `initialize` control request; `supportedDialogKinds` lists the prompts this host can answer. */
export function initializeRequest(requestId: string, supportedDialogKinds?: string[]): unknown {
  const request = supportedDialogKinds ? { subtype: "initialize", supportedDialogKinds } : { subtype: "initialize" };
  return { type: "control_request", request_id: requestId, request };
}

export function dialogResponse(requestId: string, result: string): unknown {
  const response = { subtype: "success", request_id: requestId, response: { behavior: "completed", result } };
  return { type: "control_response", response };
}

/**
 * Calls `onMessage` for each complete JSON line on the stream (a chunk can end part-way through one).
 * Lines that are not JSON, and errors thrown while handling a message, are ignored.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readJsonLines(stream: Readable, onMessage: (message: any) => void): void {
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
export function createScratchDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ghostline-"));
}

export function removeScratchDir(scratchDir: string): void {
  fs.rmSync(scratchDir, { recursive: true, force: true });
}
