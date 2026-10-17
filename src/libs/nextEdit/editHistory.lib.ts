import * as vscode from "vscode";

import { MAX_TRACKED_LINES } from "../../constant/nextEdit.constant";
import { PrivacyLib } from "../shared/privacy.lib";

export class EditHistoryLib {
  /** Only sendable documents of a manageable size have their edits tracked. */
  static isTrackable(document: vscode.TextDocument): boolean {
    return PrivacyLib.isSendable(document.uri.scheme, document.uri.fsPath) && document.lineCount <= MAX_TRACKED_LINES;
  }
}
