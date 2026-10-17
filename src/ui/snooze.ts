import * as vscode from "vscode";

/** Pauses suggestions for a fixed time, calling `onExpire` when the pause ends by itself. */
export class Snooze implements vscode.Disposable {
  private until = 0;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly durationMs: number,
    private readonly onExpire: () => void,
  ) {}

  isActive(): boolean {
    return Date.now() < this.until;
  }

  toggle(): void {
    clearTimeout(this.timer);
    if (this.isActive()) {
      this.until = 0;
    } else {
      this.until = Date.now() + this.durationMs;
      this.timer = setTimeout(this.onExpire, this.durationMs);
    }
  }

  /** When the snooze ends, as a local time such as "3:45 pm". */
  endTime(): string {
    return new Date(this.until).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  dispose(): void {
    clearTimeout(this.timer);
  }
}
