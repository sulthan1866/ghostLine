export interface CompletionConfig {
  enabled: boolean;
  model: string;
  debounceMs: number;
  timeoutMs: number;
  maxPrefixChars: number;
  maxSuffixChars: number;
  maxLines: number;
  useNeighbourFiles: boolean;
  nextEditSuggestions: boolean;
  excludedLanguages: string[];
}
