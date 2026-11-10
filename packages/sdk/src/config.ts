import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bunSecretStore,
  CREDENTIAL_KEYS,
  readKeychainValues,
  type KeychainStatus,
  type SecretStore,
} from "./secrets.js";
import type { ZendeskConfig } from "./types.js";

export type Env = Record<string, string | undefined>;

export const DEFAULT_BASE_URL = "https://example.zendesk.com";

export interface KeychainState {
  status: KeychainStatus;
  error?: string;
}

export interface ResolvedConfig extends ZendeskConfig {
  /** Where each setting came from, keyed by env-var name. */
  sources: Record<string, string>;
  /** Where each credential came from: env, envfile:<path>, keychain, override, or missing. */
  credentialSources: Record<string, string>;
  /** Whether the OS keychain was consulted for credentials. */
  keychain: KeychainState;
  /** Dotenv files that were found, highest priority first. */
  envFiles: string[];
  cwd: string;
}

export interface ResolveConfigOptions extends Partial<ZendeskConfig> {
  /** Directory to start the `.env` walk from; defaults to process.cwd(). */
  cwd?: string;
  /** Process environment; defaults to process.env. */
  env?: Env;
  /**
   * Also walk up from the SDK's own directory for `.env` files, so a
   * checkout's root `.env` is found from any cwd. Defaults to true.
   */
  searchModuleDir?: boolean;
  /** Credentials already read from the OS keychain; see loadConfig(). */
  keychainValues?: Record<string, string>;
  /** Keychain lookup status to report; defaults to disabled. */
  keychain?: KeychainState;
}

export interface LoadConfigOptions
  extends Omit<ResolveConfigOptions, "keychainValues" | "keychain"> {
  /** Store to read keys from. Defaults to the OS keychain; pass null to skip it. */
  secretStore?: SecretStore | null;
}

interface EnvFileData {
  files: string[];
  values: Env;
  sources: Record<string, string>;
}

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

function parseEnvFile(filePath: string): Env {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return {};
  }
  const values: Env = {};
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseEnvValue(line);
    if (parsed && values[parsed[0]] === undefined) values[parsed[0]] = parsed[1];
  }
  return values;
}

/**
 * Dotenv candidates in priority order: `ZENDESK_DOTENV_PATH`, then
 * `.env.local` and `.env` walking up from cwd, then walking up from the SDK
 * module directory. The first file that sets a key wins.
 */
function dotenvCandidates(cwd: string, env: Env, searchModuleDir: boolean): string[] {
  const candidates: string[] = [];
  const explicit = env.ZENDESK_DOTENV_PATH?.trim();
  if (explicit) candidates.push(resolve(cwd, explicit));

  const startDirs = [cwd];
  if (searchModuleDir) startDirs.push(dirname(fileURLToPath(import.meta.url)));
  const visited = new Set<string>();
  for (const startDir of startDirs) {
    let dir = startDir;
    while (true) {
      if (!visited.has(dir)) {
        visited.add(dir);
        for (const fileName of [".env.local", ".env"]) {
          candidates.push(join(dir, fileName));
        }
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return candidates;
}

function readEnvFiles(cwd: string, env: Env, searchModuleDir: boolean): EnvFileData {
  const files: string[] = [];
  const values: Env = {};
  const sources: Record<string, string> = {};
  for (const file of dotenvCandidates(cwd, env, searchModuleDir)) {
    if (files.includes(file) || !existsSync(file)) continue;
    files.push(file);
    for (const [key, value] of Object.entries(parseEnvFile(file))) {
      if (value === undefined || value === "" || values[key] !== undefined) continue;
      values[key] = value;
      sources[key] = file;
    }
  }
  return { files, values, sources };
}

function present(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== "";
}

/**
 * Resolve configuration synchronously from overrides, the process
 * environment, and `.env` files. Pass `keychainValues` to slot keychain
 * credentials in below `.env`; loadConfig() does that for you.
 *
 * Precedence: override > process env > ZENDESK_DOTENV_PATH / nearest .env >
 * OS keychain (credentials only) > default.
 */
export function resolveConfig(options: ResolveConfigOptions = {}): ResolvedConfig {
  const cwd = resolve(options.cwd ?? process.cwd());
  const env = options.env ?? process.env;
  const envFile = readEnvFiles(cwd, env, options.searchModuleDir ?? true);
  const keychainValues = options.keychainValues ?? {};

  const sources: Record<string, string> = {};
  const credentialSources: Record<string, string> = {};

  const pick = (
    name: string,
    override: string | undefined,
    keychainValue: string | undefined
  ): string | undefined => {
    const envFileSource = `envfile:${envFile.sources[name] ?? "unknown"}`;
    // Bun auto-loads a cwd .env into process.env; when the values match,
    // report the file so `auth migrate` and `shadowed_by` see plaintext.
    const envSource =
      present(env[name]) && env[name] === envFile.values[name] ? envFileSource : "env";
    const candidates: Array<{ value: string | undefined; source: string }> = [
      { value: override, source: "override" },
      { value: env[name], source: envSource },
      { value: envFile.values[name], source: envFileSource },
      { value: keychainValue, source: "keychain" },
    ];
    for (const candidate of candidates) {
      if (present(candidate.value)) {
        sources[name] = candidate.source;
        return candidate.value.trim();
      }
    }
    return undefined;
  };

  const apiKey = pick("ZENDESK_API_KEY", options.apiKey, keychainValues.ZENDESK_API_KEY);
  credentialSources.ZENDESK_API_KEY = sources.ZENDESK_API_KEY ?? "missing";
  sources.ZENDESK_API_KEY = credentialSources.ZENDESK_API_KEY;

  let baseUrl = pick("ZENDESK_BASE_URL", options.baseUrl, undefined);
  if (baseUrl === undefined) {
    sources.ZENDESK_BASE_URL = "default";
    baseUrl = DEFAULT_BASE_URL;
  }

  return {
    apiKey: apiKey ?? "",
    baseUrl,
    sources,
    credentialSources,
    keychain: options.keychain ?? { status: "disabled" },
    envFiles: envFile.files,
    cwd,
  };
}

/** True when ZENDESK_KEYCHAIN (process env or a dotenv file) turns the lookup off. */
function keychainDisabledBySwitch(env: Env, envFile: EnvFileData): boolean {
  const raw = env.ZENDESK_KEYCHAIN ?? envFile.values.ZENDESK_KEYCHAIN ?? "";
  return ["0", "false", "no", "off"].includes(raw.trim().toLowerCase());
}

/**
 * resolveConfig() plus the OS keychain. Only credentials that overrides, the
 * process environment, and `.env` files did not supply are looked up, so an
 * explicit key never triggers a keychain prompt. Set ZENDESK_KEYCHAIN=0 (in
 * the environment or a dotenv file, including ZENDESK_DOTENV_PATH) to skip
 * the lookup entirely.
 */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<ResolvedConfig> {
  const { secretStore, ...resolveOptions } = options;
  const cwd = resolve(resolveOptions.cwd ?? process.cwd());
  const env = resolveOptions.env ?? process.env;
  const envFile = readEnvFiles(cwd, env, resolveOptions.searchModuleDir ?? true);

  if (secretStore === null || keychainDisabledBySwitch(env, envFile)) {
    return resolveConfig({ ...resolveOptions, keychain: { status: "disabled" } });
  }

  const overrides: Record<string, string | undefined> = {
    ZENDESK_API_KEY: resolveOptions.apiKey,
  };
  const missing = CREDENTIAL_KEYS.filter(
    (name) => !present(overrides[name]) && !present(env[name]) && !present(envFile.values[name])
  );
  if (missing.length === 0) {
    return resolveConfig({ ...resolveOptions, keychain: { status: "ok" } });
  }

  const result = await readKeychainValues(secretStore ?? bunSecretStore(), missing);
  return resolveConfig({
    ...resolveOptions,
    keychainValues: result.values,
    keychain: result.error
      ? { status: result.status, error: result.error }
      : { status: result.status },
  });
}

export interface RedactedConfig {
  schema_version: "1";
  cwd: string;
  env_files: string[];
  values: { baseUrl: string };
  sources: Record<string, string>;
  credentials: Record<string, "set" | "missing">;
  credential_sources: Record<string, string>;
  keychain: KeychainState;
}

/** The resolved config with secrets reduced to set/missing, for `config show`. */
export function redactedConfig(config: ResolvedConfig): RedactedConfig {
  return {
    schema_version: "1",
    cwd: config.cwd,
    env_files: config.envFiles,
    values: { baseUrl: config.baseUrl },
    sources: config.sources,
    credentials: Object.fromEntries(
      CREDENTIAL_KEYS.map((key) => [key, config.credentialSources[key] === "missing" ? "missing" : "set"])
    ),
    credential_sources: config.credentialSources,
    keychain: config.keychain,
  };
}
