/** Arguments, environment and protocol values exchanged with the Claude Code CLI. */
import type { ClaudeModelInfo } from "../types/interfaces/claude.interface";

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

/** `kind` used when the CLI asks for usage-credit consent rather than failing outright. */
export const CONSENT_REQUIRED = "consent_required";

/** Used when the CLI cannot be asked for its model list. */
export const FALLBACK_MODELS: ClaudeModelInfo[] = [
  { value: "haiku", displayName: "Haiku", description: "Fastest; recommended for completions" },
  { value: "sonnet", displayName: "Sonnet", description: "Balanced speed and quality" },
  { value: "opus", displayName: "Opus", description: "Most capable; slowest" },
];

export const MODEL_LIST_TIMEOUT_MS = 30_000;
