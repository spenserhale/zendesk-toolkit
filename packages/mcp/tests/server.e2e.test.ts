import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const entry = join(import.meta.dirname, "..", "src", "index.ts");
const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

interface JsonRpcResponse {
  id?: number;
  result?: Record<string, unknown>;
  error?: unknown;
}

/** Minimal stdio MCP client: send requests, collect responses by id. */
async function withServer<T>(fn: (request: (method: string, params?: unknown) => Promise<JsonRpcResponse>) => Promise<T>): Promise<T> {
  const cwd = mkdtempSync(join(tmpdir(), "zendesk-mcp-"));
  dirs.push(cwd);
  const proc = Bun.spawn({
    cmd: ["bun", "run", entry],
    cwd,
    // Never touch the real keychain from tests.
    env: { PATH: process.env.PATH ?? "", HOME: cwd, ZENDESK_KEYCHAIN: "0" },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "ignore",
  });
  const pending = new Map<number, (response: JsonRpcResponse) => void>();
  let nextId = 1;
  let buffer = "";
  const decoder = new TextDecoder();
  void (async () => {
    for await (const chunk of proc.stdout) {
      buffer += decoder.decode(chunk);
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const message = JSON.parse(line) as JsonRpcResponse;
        if (message.id !== undefined) pending.get(message.id)?.(message);
      }
    }
  })();
  const send = (payload: unknown) => {
    proc.stdin.write(`${JSON.stringify(payload)}\n`);
    proc.stdin.flush();
  };
  const request = (method: string, params: unknown = {}) =>
    new Promise<JsonRpcResponse>((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      send({ jsonrpc: "2.0", id, method, params });
    });
  try {
    await request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "0.0.0" },
    });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    return await fn(request);
  } finally {
    proc.kill();
    await proc.exited;
  }
}

describe("MCP server", () => {
  it("exposes no tool that writes or deletes secrets", async () => {
    const tools = await withServer(async (request) => {
      const response = await request("tools/list");
      return (response.result?.tools as Array<{ name: string }>).map((tool) => tool.name);
    });
    expect(tools).toContain("get_config_status");
    expect(tools.some((name) => /auth|secret|keychain|credential/i.test(name))).toBe(false);
  }, 20_000);

  it("reports redacted config status with the keychain disabled", async () => {
    const text = await withServer(async (request) => {
      const response = await request("tools/call", { name: "get_config_status", arguments: {} });
      const content = response.result?.content as Array<{ text: string }>;
      return content[0]?.text ?? "";
    });
    const status = JSON.parse(text) as { keychain: { status: string }; credentials: Record<string, string> };
    expect(status.keychain.status).toBe("disabled");
    expect(Object.keys(status.credentials)).toEqual(["ZENDESK_API_KEY"]);
  }, 20_000);
});
