import { isSendable, isSensitivePath } from "../../src/shared/privacy";

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
    expect(isSensitivePath(filePath)).toBe(true);
  });

  it.each(["/repo/src/index.ts", "/repo/src/environment.ts", "/repo/keyboard.ts", "/repo/docs/secrets-handling.md"])(
    "allows %s",
    (filePath) => {
      expect(isSensitivePath(filePath)).toBe(false);
    },
  );
});

describe("isSendable", () => {
  it("allows ordinary files and unsaved buffers", () => {
    expect(isSendable("file", "/repo/src/index.ts")).toBe(true);
    expect(isSendable("untitled", "Untitled-1")).toBe(true);
  });

  it("rejects virtual documents such as user settings, output and git", () => {
    expect(isSendable("vscode-userdata", "/User/settings.json")).toBe(false);
    expect(isSendable("output", "extension-output-1")).toBe(false);
    expect(isSendable("git", "/repo/src/index.ts")).toBe(false);
  });

  it("rejects sensitive files even when the scheme is allowed", () => {
    expect(isSendable("file", "/repo/.env")).toBe(false);
  });
});
