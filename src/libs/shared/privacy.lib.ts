/** Decides which documents may be sent to the model. Kept free of `vscode` so it can be unit tested. */
import { SENDABLE_SCHEMES, SENSITIVE_FILE_NAMES } from "../../constant/privacy.constant";

export class PrivacyLib {
  static isSensitivePath(filePath: string): boolean {
    const fileName = filePath.split(/[\\/]/).pop()?.toLowerCase() ?? "";
    return SENSITIVE_FILE_NAMES.some((pattern) => pattern.test(fileName));
  }

  /** True when a document with this URI scheme and path may be included in a prompt. */
  static isSendable(scheme: string, filePath: string): boolean {
    return SENDABLE_SCHEMES.has(scheme) && !PrivacyLib.isSensitivePath(filePath);
  }
}
