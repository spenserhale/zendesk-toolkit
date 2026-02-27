import type { ZendeskConfig } from "./types.js";

/**
 * Resolve configuration from environment variables.
 * Useful for both CLI and MCP contexts.
 */
export function resolveConfig(
  overrides: Partial<ZendeskConfig> = {}
): ZendeskConfig {
  return {
    apiKey: overrides.apiKey ?? process.env.ZENDESK_API_KEY ?? "",
    baseUrl:
      overrides.baseUrl ??
      process.env.ZENDESK_BASE_URL ??
      "https://api.zendesk.com",
  };
}
