import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ZendeskConfig } from "./types.js";

function parseEnvValue(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) return null;

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) return null;

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

function getEnvValueFromNearestDotenv(key: string): string | undefined {
  let dir = process.cwd();

  while (true) {
    for (const fileName of [".env.local", ".env"]) {
      const filePath = join(dir, fileName);
      if (!existsSync(filePath)) continue;

      const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
      for (const line of lines) {
        const parsed = parseEnvValue(line);
        if (parsed && parsed[0] === key) {
          return parsed[1];
        }
      }
    }

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return undefined;
}

/**
 * Resolve configuration from environment variables.
 * Useful for both CLI and MCP contexts.
 */
export function resolveConfig(
  overrides: Partial<ZendeskConfig> = {}
): ZendeskConfig {
  const apiKey =
    overrides.apiKey ??
    process.env.ZENDESK_API_KEY ??
    getEnvValueFromNearestDotenv("ZENDESK_API_KEY") ??
    "";
  const baseUrl =
    overrides.baseUrl ??
    process.env.ZENDESK_BASE_URL ??
    getEnvValueFromNearestDotenv("ZENDESK_BASE_URL") ??
    "https://example.zendesk.com";

  return {
    apiKey,
    baseUrl,
  };
}
