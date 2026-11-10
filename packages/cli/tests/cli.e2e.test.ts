import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const bin = join(import.meta.dirname, "..", "src", "bin.ts");
const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "zendesk-cli-"));
  dirs.push(dir);
  return dir;
}

/** Spawned CLIs never touch the real keychain. */
function cleanEnv(cwd: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "",
    HOME: cwd,
    ZENDESK_KEYCHAIN: "0",
  };
}

async function runCli(
  args: string[],
  cwd: string,
  stdinText?: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn({
    cmd: ["bun", "run", bin, ...args],
    cwd,
    env: cleanEnv(cwd),
    stdin: stdinText === undefined ? "ignore" : new Blob([stdinText]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { code, stdout, stderr };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("CLI end-to-end", () => {
  it("emits agent context with the auth commands and keychain env switch", async () => {
    const result = await runCli(["agent-context"], tempDir());
    expect(result.code).toBe(0);
    const context = JSON.parse(result.stdout) as {
      cli: { name: string };
      commands: Record<string, { subcommands?: Record<string, unknown> }>;
      env: Array<{ name: string }>;
    };
    expect(context.cli.name).toBe("zendesk");
    expect(Object.keys(context.commands.auth?.subcommands ?? {})).toEqual([
      "set",
      "list",
      "delete",
      "migrate",
    ]);
    expect(context.env.map((entry) => entry.name)).toContain("ZENDESK_KEYCHAIN");
  });

  it("reports keychain disabled in config show", async () => {
    const result = await runCli(["config", "show", "--json"], tempDir());
    expect(result.code).toBe(0);
    const config = JSON.parse(result.stdout) as { keychain: { status: string } };
    expect(config.keychain.status).toBe("disabled");
  });

  it("refuses auth set without a terminal unless --stdin is passed", async () => {
    const result = await runCli(["auth", "set", "zendesk"], tempDir());
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("--stdin");
  });

  it("refuses auth set --stdin with a --key the resource does not use", async () => {
    const result = await runCli(
      ["auth", "set", "zendesk", "--key", "ZENDESK_BASE_URL", "--stdin"],
      tempDir(),
      "x\n"
    );
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("ZENDESK_API_KEY");
  });

  it("previews auth set --stdin --dry-run without writing or echoing the value", async () => {
    const result = await runCli(
      ["auth", "set", "zendesk", "--stdin", "--dry-run", "--json"],
      tempDir(),
      "dummy-e2e-secret\n"
    );
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout) as {
      dry_run: boolean;
      credentials: Array<{ key: string; action: string }>;
    };
    expect(output.dry_run).toBe(true);
    expect(output.credentials[0]).toMatchObject({ key: "ZENDESK_API_KEY", action: "would_store" });
    expect(result.stdout + result.stderr).not.toContain("dummy-e2e-secret");
  });

  it("rejects empty stdin for auth set", async () => {
    const result = await runCli(["auth", "set", "zendesk", "--stdin", "--dry-run"], tempDir(), "\n");
    expect(result.code).toBe(2);
  });

  it("requires --yes for auth delete", async () => {
    const result = await runCli(["auth", "delete", "zendesk"], tempDir());
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("--yes");
  });

  it("rejects an unknown resource for auth commands", async () => {
    const result = await runCli(["auth", "delete", "freshdesk", "--yes"], tempDir());
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("zendesk");
  });
});
