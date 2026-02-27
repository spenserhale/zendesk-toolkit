import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { resolveConfig } from "../src/config.js";

describe("resolveConfig", () => {
  const originalCwd = process.cwd();
  const originalApiKey = process.env.ZENDESK_API_KEY;
  const originalBaseUrl = process.env.ZENDESK_BASE_URL;
  const fixtureRoot = resolve(originalCwd, "packages", "sdk", "tests", ".tmp-env-root");
  const nestedDir = resolve(fixtureRoot, "a", "b", "c");

  afterEach(() => {
    process.chdir(originalCwd);

    if (originalApiKey === undefined) {
      delete process.env.ZENDESK_API_KEY;
    } else {
      process.env.ZENDESK_API_KEY = originalApiKey;
    }

    if (originalBaseUrl === undefined) {
      delete process.env.ZENDESK_BASE_URL;
    } else {
      process.env.ZENDESK_BASE_URL = originalBaseUrl;
    }

    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it("loads config from a parent .env file when env vars are unset", () => {
    delete process.env.ZENDESK_API_KEY;
    delete process.env.ZENDESK_BASE_URL;

    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(
      resolve(fixtureRoot, ".env"),
      [
        "ZENDESK_API_KEY=parent-dotenv-key",
        "ZENDESK_BASE_URL=https://parent-env.zendesk.com",
      ].join("\n")
    );

    process.chdir(nestedDir);

    const config = resolveConfig();
    expect(config.apiKey).toBe("parent-dotenv-key");
    expect(config.baseUrl).toBe("https://parent-env.zendesk.com");
  });
});
