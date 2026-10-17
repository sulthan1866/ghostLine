import type * as vscode from "vscode";

import type { ClaudeEngineService } from "../../services/claude/claudeEngine.service";
import type { NextEditControllerService } from "../../services/nextEdit/nextEditController.service";

export interface ParsedEdit {
  /** 0-based, inclusive lines to replace. */
  start: number;
  end: number;
  lines: string[];
}

export interface CharChange {
  /** Column in the old line where the change starts. */
  start: number;
  /** How many old characters are removed. */
  deleted: number;
  /** New text inserted after the removed characters. */
  inserted: string;
}

export interface ChangedLines {
  /** How many leading lines are unchanged. */
  head: number;
  removed: string[];
  added: string[];
}

export interface RecentEdit {
  line: number;
  before: string[];
  after: string[];
}

export interface ShownPreview {
  /** First line that actually changes, used for the jump-to hint. */
  focusLine: number;
  /** Whether that line is visible in the editor. */
  onScreen: boolean;
}

export interface Suggestion {
  editor: vscode.TextEditor;
  version: number;
  /** 0-based, inclusive lines to replace. */
  start: number;
  end: number;
  lines: string[];
  /** First line that actually changes, used for the jump-to hint. */
  focusLine: number;
  /** True while the edit is off-screen: the first Tab jumps to it instead of applying it. */
  jumpFirst: boolean;
}

export interface RunningFeature {
  engine: ClaudeEngineService;
  controller: NextEditControllerService;
  subscriptions: vscode.Disposable[];
}
