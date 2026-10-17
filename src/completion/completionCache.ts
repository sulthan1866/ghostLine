/**
 * "Typing-through" cache, as Copilot does: if the user types characters that
 * match the start of the current suggestion, show the remainder instantly
 * instead of calling the model again.
 */
export class CompletionCache {
  private last?: { uri: string; prefix: string; completion: string };

  get(uri: string, prefix: string): string | undefined {
    const last = this.last;
    if (!last || last.uri !== uri || !prefix.startsWith(last.prefix)) {
      return undefined;
    }
    const typed = prefix.slice(last.prefix.length);
    if (typed.length === 0) {
      return last.completion;
    }
    if (last.completion.startsWith(typed) && typed.length < last.completion.length) {
      return last.completion.slice(typed.length);
    }
    return undefined;
  }

  set(uri: string, prefix: string, completion: string): void {
    this.last = { uri, prefix, completion };
  }

  clear(): void {
    this.last = undefined;
  }
}
