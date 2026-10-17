import { PrivacyLib } from "../../../src/libs/shared/privacy.lib";

describe("isSensitivePath", () => {
  it.each([
    "/repo/.env",
    "/repo/.env.local",
    "C:\\repo\\.ENV.production",
    "/home/me/.npmrc",
    "/home/me/.ssh/id_ed25519",
    "/repo/certs/server.pem",
    "/repo/certs/server.key",
    "/home/me/.aws/credentials",
    "/repo/config/secrets.yaml",
  ])("flags %s", (filePath) => {
    expect(PrivacyLib.isSensitivePath(filePath)).toBe(true);
  });

  it.each(["/repo/src/index.ts", "/repo/src/environment.ts", "/repo/keyboard.ts", "/repo/docs/secrets-handling.md"])(
    "allows %s",
    (filePath) => {
      expect(PrivacyLib.isSensitivePath(filePath)).toBe(false);
    },
  );
});

describe("isSendable", () => {
  it("allows ordinary files and unsaved buffers", () => {
    expect(PrivacyLib.isSendable("file", "/repo/src/index.ts")).toBe(true);
    expect(PrivacyLib.isSendable("untitled", "Untitled-1")).toBe(true);
  });

  it("rejects virtual documents such as user settings, output and git", () => {
    expect(PrivacyLib.isSendable("vscode-userdata", "/User/settings.json")).toBe(false);
    expect(PrivacyLib.isSendable("output", "extension-output-1")).toBe(false);
    expect(PrivacyLib.isSendable("git", "/repo/src/index.ts")).toBe(false);
  });

  it("rejects sensitive files even when the scheme is allowed", () => {
    expect(PrivacyLib.isSendable("file", "/repo/.env")).toBe(false);
  });
});
