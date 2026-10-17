export class BlockedLib {
  /** Every blocking kind except the plan's usage limit is resolved with usage credits. */
  static needsCredits(kind: string): boolean {
    return kind !== "usage_limit_reached";
  }
}
