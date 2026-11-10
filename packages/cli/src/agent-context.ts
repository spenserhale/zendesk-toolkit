import { CREDENTIAL_KEYS, KEYCHAIN_SERVICE } from "@zendesk-toolkit/sdk";
import pkg from "../package.json" with { type: "json" };
import { EXIT_CODES } from "./lib/errors.js";
import { describeTree, type CommandTree } from "./lib/introspect.js";
import { OUTPUT_FORMATS } from "./lib/output.js";

export const SCHEMA_VERSION = "1";

export interface AgentContext {
  schema_version: string;
  cli: { name: string; version: string; repo: string };
  purpose: string;
  commands: CommandTree;
  output_formats: readonly string[];
  exit_codes: Record<string, number>;
  env: Array<{ name: string; secret: boolean; description: string }>;
  credentials: {
    keychain_service: string;
    keys: readonly string[];
    precedence: string[];
    write_commands: string[];
  };
}

export function buildAgentContext(root: unknown): AgentContext {
  return {
    schema_version: SCHEMA_VERSION,
    cli: { name: "zendesk", version: pkg.version, repo: "spenserhale/zendesk-toolkit" },
    purpose: "List, search, and read Zendesk tickets and comments; manage local credentials.",
    commands: describeTree(root),
    output_formats: OUTPUT_FORMATS,
    exit_codes: { ...EXIT_CODES, dry_run: 0 },
    env: [
      {
        name: "ZENDESK_API_KEY",
        secret: true,
        description:
          "OAuth access token, or you@example.com/token:<api_token>. Prefer `zendesk auth set zendesk` (OS keychain).",
      },
      {
        name: "ZENDESK_BASE_URL",
        secret: false,
        description: "https://<subdomain>.zendesk.com",
      },
      {
        name: "ZENDESK_DOTENV_PATH",
        secret: false,
        description: "Explicit dotenv file, checked before .env.local/.env discovery.",
      },
      {
        name: "ZENDESK_KEYCHAIN",
        secret: false,
        description: "Set to 0/false/no/off to skip the OS keychain lookup (honored from env or dotenv).",
      },
    ],
    credentials: {
      keychain_service: KEYCHAIN_SERVICE,
      keys: CREDENTIAL_KEYS,
      precedence: ["env", "ZENDESK_DOTENV_PATH / nearest .env.local, .env", "keychain", "default"],
      write_commands: ["zendesk auth set", "zendesk auth delete", "zendesk auth migrate"],
    },
  };
}
