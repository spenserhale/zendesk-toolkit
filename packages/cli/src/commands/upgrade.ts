import { buildCommand } from "@stricli/core";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import pkg from "../../package.json" with { type: "json" };

const REPO = "spenserhale/zendesk-toolkit";

interface UpgradeFlags {
  readonly check: boolean;
  readonly force: boolean;
  readonly version: string | undefined;
}

export interface UpgradeDeps {
  readonly log: (message: string) => void;
  readonly error: (message: string) => void;
  readonly exit: (code: number) => never;
  readonly fetch: typeof fetch;
  readonly execPath: string;
  readonly currentVersion: string;
  readonly platform: NodeJS.Platform;
  readonly arch: string;
  readonly writeBinary: (path: string, bytes: Buffer) => Promise<void>;
  readonly replaceBinary: (target: string, tempSource: string) => Promise<void>;
}

const defaultDeps: UpgradeDeps = {
  log: (message) => console.log(message),
  error: (message) => console.error(message),
  exit: (code) => process.exit(code),
  fetch: fetch as typeof fetch,
  execPath: process.execPath,
  currentVersion: pkg.version,
  platform: process.platform,
  arch: process.arch,
  writeBinary: async (path, bytes) => {
    await writeFile(path, bytes);
    await chmod(path, 0o755);
  },
  replaceBinary: async (target, tempSource) => {
    if (process.platform === "win32") {
      const oldPath = `${target}.old`;
      if (existsSync(oldPath)) await unlink(oldPath).catch(() => {});
      await rename(target, oldPath);
    }
    await rename(tempSource, target);
  },
};

export function resolveAssetName(platform: string, arch: string): string | null {
  if (platform === "linux" && arch === "x64") return "zendesk-linux-x64";
  if (platform === "linux" && arch === "arm64") return "zendesk-linux-arm64";
  if (platform === "darwin" && arch === "x64") return "zendesk-darwin-x64";
  if (platform === "darwin" && arch === "arm64") return "zendesk-darwin-arm64";
  if (platform === "win32" && arch === "x64") return "zendesk-windows-x64.exe";
  return null;
}

export function isCompiledBinary(execPath: string): boolean {
  return basename(execPath).replace(/\.exe$/i, "") === "zendesk";
}

export function compareSemver(a: string, b: string): number {
  const parse = (version: string) => version.replace(/^v/, "").split(".").map((part) => Number(part) || 0);
  const aParts = parse(a);
  const bParts = parse(b);
  for (let index = 0; index < Math.max(aParts.length, bParts.length); index++) {
    const difference = (aParts[index] ?? 0) - (bParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

async function fetchLatestRelease(deps: UpgradeDeps): Promise<{ tag: string; version: string }> {
  const response = await deps.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  const data = (await response.json()) as { tag_name?: string };
  if (!data.tag_name) throw new Error("GitHub response missing tag_name");
  return { tag: data.tag_name, version: data.tag_name.replace(/^v/, "") };
}

async function downloadAndVerify(deps: UpgradeDeps, tag: string, asset: string): Promise<Buffer> {
  const base = `https://github.com/${REPO}/releases/download/${tag}`;
  const [assetResponse, checksumResponse] = await Promise.all([
    deps.fetch(`${base}/${asset}`),
    deps.fetch(`${base}/${asset}.sha256`),
  ]);
  if (!assetResponse.ok) throw new Error(`Failed to download ${asset}: ${assetResponse.status}`);
  if (!checksumResponse.ok) throw new Error(`Failed to download checksum: ${checksumResponse.status}`);

  const bytes = Buffer.from(await assetResponse.arrayBuffer());
  const expected = (await checksumResponse.text()).trim().split(/\s+/)[0];
  if (!expected) throw new Error("Could not parse checksum file");
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) throw new Error(`Checksum mismatch: expected ${expected}, got ${actual}`);
  return bytes;
}

export async function runUpgrade(deps: UpgradeDeps, flags: UpgradeFlags): Promise<void> {
  if (!isCompiledBinary(deps.execPath)) {
    deps.error("`zendesk upgrade` is only supported on the standalone binary install.");
    deps.error("Reinstall with:");
    deps.error("  curl -fsSL https://raw.githubusercontent.com/spenserhale/zendesk-toolkit/main/scripts/install.sh | sh");
    deps.exit(1);
  }

  const asset = resolveAssetName(deps.platform, deps.arch);
  if (!asset) {
    deps.error(`No prebuilt binary for ${deps.platform}/${deps.arch}.`);
    deps.error("Supported: linux-x64, linux-arm64, darwin-x64, darwin-arm64, windows-x64.");
    deps.exit(1);
  }

  const latest = flags.version
    ? { tag: flags.version.startsWith("v") ? flags.version : `v${flags.version}`, version: flags.version.replace(/^v/, "") }
    : await fetchLatestRelease(deps);
  deps.log(`Current: ${deps.currentVersion}`);
  deps.log(`Latest:  ${latest.version}`);
  const comparison = compareSemver(deps.currentVersion, latest.version);

  if (flags.check) {
    deps.log(comparison >= 0 ? "You are on the latest version." : "Update available. Run `zendesk upgrade` to install.");
    return;
  }
  if (!flags.force && comparison >= 0) {
    deps.log("Already on the latest version.");
    return;
  }

  deps.log(`Downloading ${asset}...`);
  const bytes = await downloadAndVerify(deps, latest.tag, asset);
  const tempPath = join(dirname(deps.execPath), `.zendesk-upgrade-${process.pid}.tmp`);
  await deps.writeBinary(tempPath, bytes);
  await deps.replaceBinary(deps.execPath, tempPath);
  deps.log(`Upgraded to ${latest.version}.`);
}

export const upgradeCommand = buildCommand({
  docs: { brief: "Upgrade the CLI to the latest release" },
  parameters: {
    flags: {
      check: { kind: "boolean", brief: "Check for a new version but don't install", default: false },
      force: { kind: "boolean", brief: "Reinstall even if already on the latest version", default: false },
      version: { kind: "parsed", parse: String, optional: true, brief: "Install a specific version (e.g. 0.1.1)" },
    },
  },
  async func(this: void, flags: UpgradeFlags) {
    try {
      await runUpgrade(defaultDeps, flags);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  },
});
