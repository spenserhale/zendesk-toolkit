import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { resolveConfig } from "../src/config.js";

describe("resolveConfig", () => {
  const originalCwd = process.cwd();
  const originalApiKey = process.env.ZENDESK_API_KEY;
  const originalBaseUrl = process.env.ZENDESK_BASE_URL;
  const originalDotenvPath = process.env.ZENDESK_DOTENV_PATH;
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

    if (originalDotenvPath === undefined) {
      delete process.env.ZENDESK_DOTENV_PATH;
    } else {
      process.env.ZENDESK_DOTENV_PATH = originalDotenvPath;
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

  it("loads config from ZENDESK_DOTENV_PATH when provided", () => {
    delete process.env.ZENDESK_API_KEY;
    delete process.env.ZENDESK_BASE_URL;

    mkdirSync(nestedDir, { recursive: true });
    const explicitDotenvPath = resolve(fixtureRoot, ".env.explicit");
    writeFileSync(
      explicitDotenvPath,
      [
        "ZENDESK_API_KEY=explicit-dotenv-key",
        "ZENDESK_BASE_URL=https://explicit-env.zendesk.com",
      ].join("\n")
    );

    process.env.ZENDESK_DOTENV_PATH = explicitDotenvPath;
    process.chdir("/tmp");

    const config = resolveConfig();
    expect(config.apiKey).toBe("explicit-dotenv-key");
    expect(config.baseUrl).toBe("https://explicit-env.zendesk.com");
  });
});
