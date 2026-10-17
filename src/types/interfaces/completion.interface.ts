export interface Snippet {
  path: string;
  text: string;
}

export interface CompletionContext {
  languageId: string;
  relativePath: string;
  prefix: string;
  suffix: string;
  linePrefix: string;
  lineSuffix: string;
  snippets: Snippet[];
}

export interface TokenisedWindow {
  text: string;
  tokens: Set<string>;
}
