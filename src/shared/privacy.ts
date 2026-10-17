/** Decides which documents may be sent to the model. Kept free of `vscode` so it can be unit tested. */

/** Only real files and unsaved buffers; never settings, output, git or other virtual documents. */
const SENDABLE_SCHEMES = new Set(["file", "untitled"]);

/** Files that commonly hold credentials. Matched against the file name, case-insensitively. */
const SENSITIVE_FILE_NAMES = [
  /^\.env(\..*)?$/,
  /^\.npmrc$/,
  /^\.yarnrc(\.yml)?$/,
  /^\.netrc$/,
  /^\.pgpass$/,
  /^\.git-credentials$/,
  /^credentials(\..*)?$/,
  /^secrets?(\..*)?$/,
  /^id_(rsa|dsa|ecdsa|ed25519)$/,
  /\.(pem|key|p12|pfx|jks|keystore)$/,
];

export function isSensitivePath(filePath: string): boolean {
  const fileName = filePath.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  return SENSITIVE_FILE_NAMES.some((pattern) => pattern.test(fileName));
}

/** True when a document with this URI scheme and path may be included in a prompt. */
export function isSendable(scheme: string, filePath: string): boolean {
  return SENDABLE_SCHEMES.has(scheme) && !isSensitivePath(filePath);
}
