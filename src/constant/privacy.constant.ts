/** Only real files and unsaved buffers; never settings, output, git or other virtual documents. */
export const SENDABLE_SCHEMES = new Set(["file", "untitled"]);

/** Files that commonly hold credentials. Matched against the file name, case-insensitively. */
export const SENSITIVE_FILE_NAMES = [
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
