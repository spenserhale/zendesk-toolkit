import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

function getValueFromDotenvFile(
  filePath: string,
  key: string
): string | undefined {
  if (!existsSync(filePath)) return undefined;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const parsed = parseEnvValue(line);
    if (parsed && parsed[0] === key) {
      return parsed[1];
    }
  }

  return undefined;
}

function getEnvValueFromNearestDotenv(key: string): string | undefined {
  const explicitDotenvPath = process.env.ZENDESK_DOTENV_PATH?.trim();
  if (explicitDotenvPath) {
    const explicitValue = getValueFromDotenvFile(explicitDotenvPath, key);
    if (explicitValue !== undefined) {
      return explicitValue;
    }
  }

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const startDirs = [process.cwd(), moduleDir];
  const visitedDirs = new Set<string>();

  for (const startDir of startDirs) {
    let dir = startDir;

    while (true) {
      if (!visitedDirs.has(dir)) {
        visitedDirs.add(dir);

        for (const fileName of [".env.local", ".env"]) {
          const value = getValueFromDotenvFile(join(dir, fileName), key);
          if (value !== undefined) {
            return value;
          }
        }
      }

      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
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
