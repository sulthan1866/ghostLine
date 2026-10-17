/** `kind` used when the CLI asks for usage-credit consent rather than failing outright. */
export const CONSENT_REQUIRED = "consent_required";

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

/** Every blocking kind except the plan's usage limit is resolved with usage credits. */
export function needsCredits(kind: string): boolean {
  return kind !== "usage_limit_reached";
}
