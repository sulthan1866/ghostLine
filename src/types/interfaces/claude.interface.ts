import type * as vscode from "vscode";

import type { CliProcess } from "../types/claude.type";

export interface BlockedEvent {
  /** A CLI `api_error` kind, or CONSENT_REQUIRED. */
  kind: string;
  model: string;
  /** The CLI's own explanation, when it gave one. */
  detail?: string;
  /** Sent with CONSENT_REQUIRED: whether usage credits are turned on, and the balance. */
  overagesEnabled?: boolean;
  balanceCents?: number | null;
  currency?: string | null;
}

export interface ClaudeModelInfo {
  value: string;
  displayName: string;
  description?: string;
}

export interface Usage {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
  output_tokens_details?: { thinking_tokens?: number };
}

export interface CompletionRequestOptions {
  proc: CliProcess;
  model: string;
  timeoutMs: number;
  token: vscode.CancellationToken;
  /** Whether the user agreed to run this model on usage credits. */
  isCreditAllowed: (model: string) => boolean;
  onBlocked: (event: BlockedEvent) => void;
  onStderr: (chunk: string) => void;
  /** Called once when the request ends, after which the process is no longer needed. `usage` is set if it replied. */
  onFinished: (reason: string, elapsedMs: number, usage?: Usage) => void;
}
