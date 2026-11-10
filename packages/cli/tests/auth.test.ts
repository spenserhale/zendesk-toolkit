import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConfig, type SecretStore } from "@zendesk-toolkit/sdk";
import {
  deleteCredentials,
  listCredentials,
  migrateCredentials,
  parseResource,
  selectCredentialKeys,
  setCredentials,
} from "../src/lib/auth.js";

function memoryStore(initial: Record<string, string> = {}): SecretStore & {
  values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial));
  return {
    description: "memory",
    values,
    async get(name) {
      return values.get(name) ?? null;
    },
    async set(name, value) {
      values.set(name, value);
    },
    async delete(name) {
      return values.delete(name);
    },
  };
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "zendesk-auth-"));
}

function emptyConfig(env: Record<string, string> = {}, cwd = tempDir()) {
  return resolveConfig({ cwd, env, searchModuleDir: false });
}

describe("auth helpers", () => {
  it("validates resources and --key", () => {
    expect(parseResource("ZENDESK")).toBe("zendesk");
    expect(() => parseResource("freshdesk")).toThrow("Unknown credential resource");
    expect(selectCredentialKeys("zendesk", undefined)).toEqual(["ZENDESK_API_KEY"]);
    expect(selectCredentialKeys("zendesk", "zendesk_api_key")).toEqual(["ZENDESK_API_KEY"]);
    expect(() => selectCredentialKeys("zendesk", "ZENDESK_BASE_URL")).toThrow("not a credential");
  });

  it("stores trimmed values and flags keys that env still overrides", async () => {
    const store = memoryStore();
    const result = await setCredentials({
      resource: "zendesk",
      keys: ["ZENDESK_API_KEY"],
      readValue: async () => "  secret-value\n",
      store,
      config: emptyConfig({ ZENDESK_API_KEY: "from-shell" }),
      dryRun: false,
    });
    expect(store.values.get("ZENDESK_API_KEY")).toBe("secret-value");
    expect(result.credentials).toEqual([
      { key: "ZENDESK_API_KEY", action: "stored", shadowed_by: "env" },
    ]);
    expect(JSON.stringify(result)).not.toContain("secret-value");
  });

  it("flags a key that a .env file shadows", async () => {
    const cwd = tempDir();
    writeFileSync(join(cwd, ".env"), "ZENDESK_API_KEY=from-file\n");
    const result = await setCredentials({
      resource: "zendesk",
      keys: ["ZENDESK_API_KEY"],
      readValue: async () => "v",
      store: memoryStore(),
      config: emptyConfig({}, cwd),
      dryRun: false,
    });
    expect(result.credentials[0]?.shadowed_by).toBe(`envfile:${join(cwd, ".env")}`);
  });

  it("does not write on --dry-run and rejects empty input", async () => {
    const store = memoryStore();
    const dry = await setCredentials({
      resource: "zendesk",
      keys: ["ZENDESK_API_KEY"],
      readValue: async () => "v",
      store,
      config: emptyConfig(),
      dryRun: true,
    });
    expect(dry.credentials[0]?.action).toBe("would_store");
    expect(store.values.size).toBe(0);
    await expect(
      setCredentials({
        resource: "zendesk",
        keys: ["ZENDESK_API_KEY"],
        readValue: async () => "  \n",
        store,
        config: emptyConfig(),
        dryRun: false,
      })
    ).rejects.toThrow("must not be empty");
  });

  it("lists keychain state and active source without values", async () => {
    const store = memoryStore({ ZENDESK_API_KEY: "kc-secret" });
    const result = await listCredentials(store, emptyConfig({ ZENDESK_API_KEY: "env-secret" }));
    expect(result.credentials).toEqual([
      { resource: "zendesk", key: "ZENDESK_API_KEY", keychain: "set", active_source: "env" },
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("kc-secret");
    expect(serialized).not.toContain("env-secret");
  });

  it("reports an unavailable keychain as unknown in list", async () => {
    const fail = async (): Promise<never> => {
      throw new Error("locked");
    };
    const result = await listCredentials(
      { description: "failing", get: fail, set: fail, delete: fail },
      emptyConfig()
    );
    expect(result.keychain_status).toBe("unavailable");
    expect(result.credentials[0]?.keychain).toBe("unknown");
  });

  it("deletes entries and reports missing ones", async () => {
    const store = memoryStore({ ZENDESK_API_KEY: "x" });
    const first = await deleteCredentials({
      resource: "zendesk",
      keys: ["ZENDESK_API_KEY"],
      store,
      dryRun: false,
    });
    const second = await deleteCredentials({
      resource: "zendesk",
      keys: ["ZENDESK_API_KEY"],
      store,
      dryRun: false,
    });
    expect(first.credentials[0]?.action).toBe("deleted");
    expect(second.credentials[0]?.action).toBe("not_found");
  });

  it("migrates .env keys, skips existing ones, and leaves env alone", async () => {
    const cwd = tempDir();
    const envPath = join(cwd, ".env");
    writeFileSync(envPath, "ZENDESK_API_KEY=key-from-file\n");
    const config = emptyConfig({}, cwd);

    const store = memoryStore();
    const dry = await migrateCredentials({ store, config, dryRun: true, overwrite: false });
    expect(dry.credentials.map((row) => row.action)).toEqual(["would_store"]);
    expect(store.values.size).toBe(0);

    const result = await migrateCredentials({ store, config, dryRun: false, overwrite: false });
    expect(store.values.get("ZENDESK_API_KEY")).toBe("key-from-file");
    expect(result.clean_up).toEqual([envPath]);
    expect(JSON.stringify(result)).not.toContain("key-from-file");

    const existing = memoryStore({ ZENDESK_API_KEY: "already-there" });
    const skipped = await migrateCredentials({
      store: existing,
      config,
      dryRun: false,
      overwrite: false,
    });
    expect(skipped.credentials[0]?.action).toBe("skipped_exists");
    expect(existing.values.get("ZENDESK_API_KEY")).toBe("already-there");
    const overwritten = await migrateCredentials({
      store: existing,
      config,
      dryRun: false,
      overwrite: true,
    });
    expect(overwritten.credentials[0]?.action).toBe("stored");
    expect(existing.values.get("ZENDESK_API_KEY")).toBe("key-from-file");

    const envOnly = memoryStore();
    const fromEnv = await migrateCredentials({
      store: envOnly,
      config: emptyConfig({ ZENDESK_API_KEY: "from-op-run" }),
      dryRun: false,
      overwrite: false,
    });
    expect(fromEnv.credentials).toEqual([]);
    expect(envOnly.values.size).toBe(0);
  });
});
