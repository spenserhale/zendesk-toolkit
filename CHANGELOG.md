# Changelog

## 0.3.0 - 2026-11-10

### OS keychain credentials

Store the Zendesk API key once in the OS credential store (macOS Keychain, Linux libsecret, Windows Credential Manager) via `Bun.secrets`. The CLI and the MCP server both find it with no `.env` and no MCP `env` block.

```sh
zendesk auth set zendesk                        # hidden prompt
pbpaste | zendesk auth set zendesk --stdin      # non-interactive
zendesk auth list                               # keychain state + active source, never values
zendesk auth migrate --dry-run                  # move a plaintext .env key into the keychain
zendesk auth delete zendesk --yes
```

- Precedence: process env > `ZENDESK_DOTENV_PATH` / nearest `.env.local`, `.env` > OS keychain > default. `.env` still beats the keychain; `auth set` flags a key that one shadows.
- Keychain entry: service `zendesk-toolkit`, account `ZENDESK_API_KEY`. `ZENDESK_BASE_URL` stays ordinary config.
- `ZENDESK_KEYCHAIN=0` skips the lookup, honored from the environment or any dotenv file (including `ZENDESK_DOTENV_PATH`).
- Secrets are never accepted as arguments; `auth set` without a TTY requires `--stdin` (exit 2 otherwise). `auth delete` requires `--yes`. All `auth` commands support `--dry-run` where they write.
- `auth migrate` copies dotenv keys into the keychain without editing files and lists them under `clean_up`.

### CLI

- `zendesk config show`: resolved config with secrets redacted, per-value sources, and `keychain.status` (`ok` / `disabled` / `unavailable`).
- `zendesk agent-context`: machine-readable schema of commands, flags, exit codes, and env vars.
- New commands use enumerated exit codes (validation 2, config/keychain 3) and `--toon` / `--json` / `--csv` / `--text` output.

### MCP

- Reads credentials through `loadConfig()` on every tool call, so a rotated key applies without a restart.
- New read-only `get_config_status` tool. No tool writes or deletes secrets.
- Recommended host config has no `env` block; see `packages/mcp/README.md`.

### SDK

- `loadConfig()` (async, keychain-aware), `redactedConfig()`, `SecretStore`, `bunSecretStore()`, `readKeychainValues()`, `CREDENTIAL_KEYS`, `KEYCHAIN_SERVICE`.
- `resolveConfig()` stays synchronous, accepts `cwd`, `env`, `keychainValues`, and `keychain` options, and returns sources and keychain state alongside `apiKey`/`baseUrl`.
- `ZendeskConfigError` and `ZendeskValidationError`; `ZendeskError` gains optional `hint`, `got`, and `validValues`.

### Upgrading

```sh
zendesk upgrade
zendesk auth migrate --dry-run
```

## 0.2.0 - 2026-08-18

- `zendesk tickets list` and `zendesk tickets search` across the SDK, CLI, and MCP server (`list_tickets`, `search_tickets`).

## 0.1.0 - 2026-08-18

- Initial release: ticket details and comments in the SDK, CLI, and MCP server; standalone CLI install and `zendesk upgrade`.
