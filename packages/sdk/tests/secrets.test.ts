import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, redactedConfig, resolveConfig } from "../src/config.js";
import { CREDENTIAL_KEYS, readKeychainValues, type SecretStore } from "../src/secrets.js";

const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "zendesk-secrets-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function memoryStore(initial: Record<string, string> = {}): SecretStore & {
  requested: string[];
} {
  const values = new Map(Object.entries(initial));
  const requested: string[] = [];
  return {
    description: "memory",
    requested,
    async get(name) {
      requested.push(name);
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

function failingStore(): SecretStore {
  const fail = async (): Promise<never> => {
    throw new Error("no secret service");
  };
  return { description: "failing", get: fail, set: fail, delete: fail };
}

/** Isolated from the developer's real .env: temp cwd, no module-dir walk. */
function isolated(cwd = tempDir()) {
  return { cwd, searchModuleDir: false } as const;
}

describe("keychain credential resolution", () => {
  it("resolves the API key from the keychain when env and .env are empty", async () => {
    const config = await loadConfig({
      ...isolated(),
      env: {},
      secretStore: memoryStore({ ZENDESK_API_KEY: "from-keychain" }),
    });
    expect(config.apiKey).toBe("from-keychain");
    expect(config.credentialSources.ZENDESK_API_KEY).toBe("keychain");
    expect(config.keychain.status).toBe("ok");
  });

  it("ranks env above .env above the keychain above the default", () => {
    const cwd = tempDir();
    writeFileSync(join(cwd, ".env"), "ZENDESK_API_KEY=from-env-file\n");

    const fromEnv = resolveConfig({
      ...isolated(cwd),
      env: { ZENDESK_API_KEY: "from-process" },
      keychainValues: { ZENDESK_API_KEY: "from-keychain" },
    });
    expect(fromEnv.apiKey).toBe("from-process");
    expect(fromEnv.credentialSources.ZENDESK_API_KEY).toBe("env");

    const fromFile = resolveConfig({
      ...isolated(cwd),
      env: {},
      keychainValues: { ZENDESK_API_KEY: "from-keychain" },
    });
    expect(fromFile.apiKey).toBe("from-env-file");
    expect(fromFile.credentialSources.ZENDESK_API_KEY).toBe(`envfile:${join(cwd, ".env")}`);

    const fromKeychain = resolveConfig({
      ...isolated(),
      env: {},
      keychainValues: { ZENDESK_API_KEY: "from-keychain" },
    });
    expect(fromKeychain.apiKey).toBe("from-keychain");

    const missing = resolveConfig({ ...isolated(), env: {} });
    expect(missing.apiKey).toBe("");
    expect(missing.credentialSources.ZENDESK_API_KEY).toBe("missing");
    expect(missing.sources.ZENDESK_BASE_URL).toBe("default");
  });

  it("attributes a value Bun auto-loaded from a cwd .env to that file", () => {
    const cwd = tempDir();
    writeFileSync(join(cwd, ".env"), "ZENDESK_API_KEY=same-value\n");
    const config = resolveConfig({ ...isolated(cwd), env: { ZENDESK_API_KEY: "same-value" } });
    expect(config.credentialSources.ZENDESK_API_KEY).toBe(`envfile:${join(cwd, ".env")}`);
  });

  it("ranks ZENDESK_DOTENV_PATH above the keychain", async () => {
    const dir = tempDir();
    const explicit = join(dir, "custom.env");
    writeFileSync(explicit, "ZENDESK_API_KEY=from-explicit-dotenv\n");
    const store = memoryStore({ ZENDESK_API_KEY: "from-keychain" });
    const config = await loadConfig({
      ...isolated(),
      env: { ZENDESK_DOTENV_PATH: explicit },
      secretStore: store,
    });
    expect(config.apiKey).toBe("from-explicit-dotenv");
    expect(config.credentialSources.ZENDESK_API_KEY).toBe(`envfile:${explicit}`);
    expect(store.requested).toHaveLength(0);
  });

  it("only asks the keychain for keys env and .env did not supply", async () => {
    const withEnv = memoryStore();
    await loadConfig({ ...isolated(), env: { ZENDESK_API_KEY: "x" }, secretStore: withEnv });
    expect(withEnv.requested).toEqual([]);

    const cwd = tempDir();
    writeFileSync(join(cwd, ".env"), "ZENDESK_API_KEY=from-env-file\n");
    const withFile = memoryStore();
    const config = await loadConfig({ ...isolated(cwd), env: {}, secretStore: withFile });
    expect(withFile.requested).toEqual([]);
    expect(config.keychain.status).toBe("ok");

    const empty = memoryStore();
    await loadConfig({ ...isolated(), env: {}, secretStore: empty });
    expect(empty.requested).toEqual([...CREDENTIAL_KEYS]);
  });

  it("skips the keychain when ZENDESK_KEYCHAIN=0 in the environment", async () => {
    const store = memoryStore({ ZENDESK_API_KEY: "from-keychain" });
    const config = await loadConfig({
      ...isolated(),
      env: { ZENDESK_KEYCHAIN: "0" },
      secretStore: store,
    });
    expect(store.requested).toHaveLength(0);
    expect(config.apiKey).toBe("");
    expect(config.keychain.status).toBe("disabled");
  });

  it("honors ZENDESK_KEYCHAIN=off from the ZENDESK_DOTENV_PATH file", async () => {
    const dir = tempDir();
    const explicit = join(dir, "custom.env");
    writeFileSync(explicit, "ZENDESK_KEYCHAIN=off\n");
    const store = memoryStore({ ZENDESK_API_KEY: "from-keychain" });
    const config = await loadConfig({
      ...isolated(),
      env: { ZENDESK_DOTENV_PATH: explicit },
      secretStore: store,
    });
    expect(store.requested).toHaveLength(0);
    expect(config.keychain.status).toBe("disabled");
  });

  it("skips the keychain when secretStore is null", async () => {
    const config = await loadConfig({ ...isolated(), env: {}, secretStore: null });
    expect(config.keychain.status).toBe("disabled");
  });

  it("reports an unavailable keychain without failing", async () => {
    const config = await loadConfig({
      ...isolated(),
      env: {},
      secretStore: failingStore(),
    });
    expect(config.keychain.status).toBe("unavailable");
    expect(config.keychain.error).toContain("no secret service");

    const withEnv = await loadConfig({
      ...isolated(),
      env: { ZENDESK_API_KEY: "from-process" },
      secretStore: failingStore(),
    });
    expect(withEnv.apiKey).toBe("from-process");
  });

  it("reads keys in parallel and drops empty values", async () => {
    const result = await readKeychainValues(memoryStore({ A: "a", B: "" }), ["A", "B"]);
    expect(result).toEqual({ status: "ok", values: { A: "a" } });
  });

  it("redacts secrets in the config show payload", async () => {
    const config = await loadConfig({
      ...isolated(),
      env: { ZENDESK_BASE_URL: "https://acme.zendesk.com" },
      secretStore: memoryStore({ ZENDESK_API_KEY: "super-secret-value" }),
    });
    const redacted = redactedConfig(config);
    expect(redacted.credentials.ZENDESK_API_KEY).toBe("set");
    expect(redacted.keychain.status).toBe("ok");
    expect(redacted.values.baseUrl).toBe("https://acme.zendesk.com");
    expect(JSON.stringify(redacted)).not.toContain("super-secret-value");
  });
});
