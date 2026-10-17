import type * as vscode from "vscode";

export type ActionItem = vscode.QuickPickItem & { run: () => unknown };

export type ModelItem = vscode.QuickPickItem & { value?: string };
