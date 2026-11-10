import {
  CREDENTIAL_KEYS,
  CREDENTIAL_RESOURCES,
  ZendeskError,
  ZendeskValidationError,
  resourceCredentialKeys,
  resourceForCredentialKey,
  type CredentialResource,
  type ResolvedConfig,
  type SecretStore,
} from "@zendesk-toolkit/sdk";

export function parseResource(raw: string): CredentialResource {
  const value = raw.trim().toLowerCase();
  if (!(CREDENTIAL_RESOURCES as readonly string[]).includes(value)) {
    throw new ZendeskValidationError("Unknown credential resource", {
      got: raw,
      validValues: CREDENTIAL_RESOURCES,
    });
  }
  return value as CredentialResource;
}

/** The keychain entry names to act on: one --key, or every key the resource uses. */
export function selectCredentialKeys(
  resource: CredentialResource,
  key: string | undefined
): string[] {
  const keys = resourceCredentialKeys(resource);
  if (key === undefined) return [...keys];
  const normalized = key.trim().toUpperCase();
  if (!keys.includes(normalized)) {
    throw new ZendeskValidationError(`--key is not a credential for ${resource}`, {
      got: key,
      validValues: keys,
    });
  }
  return [normalized];
}

/** Sources that outrank the keychain, so a stored value would be ignored. */
function isShadowingSource(source: string | undefined): boolean {
  return source === "env" || (source?.startsWith("envfile:") ?? false);
}

/** The credential value currently in effect for a key. */
function credentialValue(config: ResolvedConfig, key: string): string | undefined {
  if (key === "ZENDESK_API_KEY") return config.apiKey || undefined;
  return undefined;
}

export interface SetCredentialsInput {
  resource: CredentialResource;
  keys: readonly string[];
  readValue: (key: string) => Promise<string>;
  store: SecretStore;
  config: ResolvedConfig;
  dryRun: boolean;
}

export interface SetCredentialsResult {
  resource: CredentialResource;
  store: string;
  dry_run: boolean;
  credentials: Array<{ key: string; action: "stored" | "would_store"; shadowed_by?: string }>;
}

export async function setCredentials(input: SetCredentialsInput): Promise<SetCredentialsResult> {
  const values: Array<[string, string]> = [];
  for (const key of input.keys) {
    const value = (await input.readValue(key)).trim();
    if (!value) {
      throw new ZendeskValidationError(`${key} must not be empty`, {
        hint: "Paste the key at the prompt, or pipe it with --stdin.",
      });
    }
    values.push([key, value]);
  }
  const credentials: SetCredentialsResult["credentials"] = [];
  for (const [key, value] of values) {
    if (!input.dryRun) await input.store.set(key, value);
    const source = input.config.credentialSources[key];
    credentials.push({
      key,
      action: input.dryRun ? "would_store" : "stored",
      ...(isShadowingSource(source) ? { shadowed_by: source } : {}),
    });
  }
  return {
    resource: input.resource,
    store: input.store.description,
    dry_run: input.dryRun,
    credentials,
  };
}

export interface CredentialListRow {
  resource: CredentialResource;
  key: string;
  keychain: "set" | "missing" | "unknown";
  active_source: string;
}

export interface ListCredentialsResult {
  store: string;
  keychain_status: "ok" | "unavailable";
  keychain_error?: string;
  credentials: CredentialListRow[];
}

export async function listCredentials(
  store: SecretStore,
  config: ResolvedConfig
): Promise<ListCredentialsResult> {
  let stored: Record<string, boolean> | null = null;
  let error: string | undefined;
  try {
    const entries = await Promise.all(
      CREDENTIAL_KEYS.map(async (key) => [key, Boolean(await store.get(key))] as const)
    );
    stored = Object.fromEntries(entries);
  } catch (caught) {
    error = caught instanceof ZendeskError ? (caught.got ?? caught.message) : String(caught);
  }
  return {
    store: store.description,
    keychain_status: stored ? "ok" : "unavailable",
    ...(error ? { keychain_error: error } : {}),
    credentials: CREDENTIAL_KEYS.map((key) => ({
      resource: resourceForCredentialKey(key) as CredentialResource,
      key,
      keychain: stored ? (stored[key] ? "set" : "missing") : "unknown",
      active_source: config.credentialSources[key] ?? "missing",
    })),
  };
}

export interface DeleteCredentialsResult {
  resource: CredentialResource;
  store: string;
  dry_run: boolean;
  credentials: Array<{ key: string; action: "deleted" | "not_found" | "would_delete" }>;
}

export async function deleteCredentials(input: {
  resource: CredentialResource;
  keys: readonly string[];
  store: SecretStore;
  dryRun: boolean;
}): Promise<DeleteCredentialsResult> {
  const credentials: DeleteCredentialsResult["credentials"] = [];
  for (const key of input.keys) {
    if (input.dryRun) {
      credentials.push({ key, action: "would_delete" });
      continue;
    }
    const deleted = await input.store.delete(key);
    credentials.push({ key, action: deleted ? "deleted" : "not_found" });
  }
  return {
    resource: input.resource,
    store: input.store.description,
    dry_run: input.dryRun,
    credentials,
  };
}

export interface MigrateCredentialsResult {
  store: string;
  dry_run: boolean;
  credentials: Array<{
    resource: CredentialResource;
    key: string;
    from: string;
    action: "stored" | "would_store" | "skipped_exists";
  }>;
  /** Plaintext files that still hold migrated keys; remove the lines yourself. */
  clean_up: string[];
  note?: string;
}

/**
 * Copy keys whose winning source is a dotenv file (including
 * ZENDESK_DOTENV_PATH) into the store. Process-environment keys are left
 * alone: they usually come from op run or CI and are not plaintext at rest.
 * Files are never edited.
 */
export async function migrateCredentials(input: {
  store: SecretStore;
  config: ResolvedConfig;
  dryRun: boolean;
  overwrite: boolean;
}): Promise<MigrateCredentialsResult> {
  const credentials: MigrateCredentialsResult["credentials"] = [];
  const cleanUp = new Set<string>();
  for (const key of CREDENTIAL_KEYS) {
    const source = input.config.credentialSources[key];
    if (!source?.startsWith("envfile:")) continue;
    const value = credentialValue(input.config, key);
    if (!value) continue;
    const resource = resourceForCredentialKey(key) as CredentialResource;

    if (!input.overwrite && (await input.store.get(key))) {
      credentials.push({ resource, key, from: source, action: "skipped_exists" });
      continue;
    }
    if (!input.dryRun) await input.store.set(key, value);
    credentials.push({
      resource,
      key,
      from: source,
      action: input.dryRun ? "would_store" : "stored",
    });
    cleanUp.add(source.slice("envfile:".length));
  }
  return {
    store: input.store.description,
    dry_run: input.dryRun,
    credentials,
    clean_up: [...cleanUp],
    ...(cleanUp.size > 0
      ? {
          note: "Remove the migrated keys from each clean_up file: a .env value keeps overriding the keychain until you do.",
        }
      : {}),
  };
}
