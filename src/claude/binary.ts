import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/** Uses the CLI bundled with the official Claude Code extension. */
export function resolveClaudeBinary(): string | undefined {
  const extension = vscode.extensions.getExtension("anthropic.claude-code");
  if (!extension) {
    return undefined;
  }
  const binaryName = process.platform === "win32" ? "claude.exe" : "claude";
  const binaryPath = path.join(extension.extensionPath, "resources", "native-binary", binaryName);
  return fs.existsSync(binaryPath) ? binaryPath : undefined;
}
