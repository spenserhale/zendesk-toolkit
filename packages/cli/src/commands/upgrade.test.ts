import { describe, expect, it, mock } from "bun:test";
import { createHash } from "node:crypto";
import { compareSemver, isCompiledBinary, resolveAssetName, runUpgrade, type UpgradeDeps } from "./upgrade.js";

function makeDeps(overrides: Partial<UpgradeDeps> = {}): UpgradeDeps {
  return {
    log: mock(),
    error: mock(),
    exit: mock(() => { throw new Error("exit called"); }) as unknown as (code: number) => never,
    fetch: mock() as unknown as typeof fetch,
    execPath: "/usr/local/bin/zendesk",
    currentVersion: "0.1.0",
    platform: "linux",
    arch: "x64",
    writeBinary: mock(async () => {}),
    replaceBinary: mock(async () => {}),
    ...overrides,
  };
}

describe("upgrade", () => {
  it("maps binaries and compares versions", () => {
    expect(resolveAssetName("darwin", "arm64")).toBe("zendesk-darwin-arm64");
    expect(resolveAssetName("win32", "x64")).toBe("zendesk-windows-x64.exe");
    expect(resolveAssetName("freebsd", "x64")).toBeNull();
    expect(isCompiledBinary("/usr/local/bin/zendesk")).toBe(true);
    expect(isCompiledBinary("/usr/bin/bun")).toBe(false);
    expect(compareSemver("v0.1.0", "0.1.1")).toBe(-1);
  });

  it("checks a newer release without downloading it", async () => {
    const fetchMock = mock(async () => new Response(JSON.stringify({ tag_name: "v0.2.0" }), { status: 200 }));
    const deps = makeDeps({ fetch: fetchMock as unknown as typeof fetch });
    await runUpgrade(deps, { check: true, force: false, version: undefined });
    expect(deps.log).toHaveBeenCalledWith("Update available. Run `zendesk upgrade` to install.");
    expect(deps.writeBinary).not.toHaveBeenCalled();
  });

  it("downloads, verifies, and replaces an update", async () => {
    const bytes = Buffer.from("binary");
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const fetchMock = mock(async (input: unknown) => {
      const url = String(input);
      if (url.includes("/releases/latest")) return new Response(JSON.stringify({ tag_name: "v0.2.0" }), { status: 200 });
      if (url.endsWith(".sha256")) return new Response(`${checksum}  zendesk-linux-x64\n`, { status: 200 });
      return new Response(bytes, { status: 200 });
    });
    const deps = makeDeps({ fetch: fetchMock as unknown as typeof fetch });
    await runUpgrade(deps, { check: false, force: false, version: undefined });
    expect(deps.writeBinary).toHaveBeenCalledTimes(1);
    expect(deps.replaceBinary).toHaveBeenCalledTimes(1);
  });
});
