---
title: "Configuration and credentials"
description: Read this when setting up the Zendesk API key for the CLI or an MCP host, storing it in the OS keychain, or when the CLI works but the MCP server cannot see the same credentials.
---

## Settings

| Variable | Secret | Meaning |
|---|---|---|
| `ZENDESK_API_KEY` | Yes | An OAuth access token, or the API-token form `you@example.com/token:<api_token>`. The client sends the first as `Bearer` and the second as `Basic`. |
| `ZENDESK_BASE_URL` | No | `https://<subdomain>.zendesk.com` (default `https://example.zendesk.com`). |
| `ZENDESK_DOTENV_PATH` | No | An explicit dotenv file, checked before `.env.local` / `.env` discovery. |
| `ZENDESK_KEYCHAIN` | No | `0`, `false`, `no`, or `off` skips the OS keychain lookup. Honored from the process environment or any dotenv file, including the one named by `ZENDESK_DOTENV_PATH`. |

Only `ZENDESK_API_KEY` is a credential and goes in the keychain. The subdomain/base URL (and the email inside the API-token form) is not secret on its own, but the API-token form is stored as one value because Zendesk needs both halves.

## The shared resolver

The CLI and the MCP server both call `loadConfig()` from `packages/sdk/src/config.ts`. The precedence is:

```
process environment
  > ZENDESK_DOTENV_PATH, then .env.local / .env walking up from the cwd,
    then walking up from the SDK's own directory
  > OS keychain (credentials only; service "zendesk-toolkit")
  > built-in default
```

The keychain is asked only for credentials that the environment and dotenv files did not supply, so an explicit key never triggers a keychain prompt. If the keychain is unavailable (no Secret Service on Linux, a locked keychain, a non-Bun runtime), the lookup is skipped, `keychain.status` reads `unavailable`, and the rest of the chain works as before. See [decision 0001](../decisions/0001-os-keychain-credential-store.md).

Bun loads a `.env` in the current directory into `process.env` automatically. When a process-env value equals a dotenv value, the resolver reports the dotenv file as the source, so `auth list`, `auth migrate`, and `shadowed_by` still recognize it as plaintext.

`zendesk config show` prints the resolved configuration with the key reduced to `set`/`missing`, each value's source (`env`, `envfile:<path>`, `keychain`, `default`), and `keychain.status` (`ok`, `disabled`, or `unavailable`).

## OS keychain setup

`zendesk auth` stores the key with `Bun.secrets`: macOS Keychain Services, Linux libsecret (GNOME Keyring, KWallet), or Windows Credential Manager. The entry uses service `zendesk-toolkit` and account `ZENDESK_API_KEY`. On macOS you can see it in Keychain Access.app or with:

```bash
security find-generic-password -s zendesk-toolkit -a ZENDESK_API_KEY
```

### Interactive: hidden prompt

On a terminal, `auth set` prompts without echoing what you type or paste:

```bash
zendesk auth set zendesk
# ZENDESK_API_KEY:            (nothing is shown)
# stored ZENDESK_API_KEY in os-keychain:zendesk-toolkit
```

Ctrl-C cancels without storing anything.

### Non-interactive: `--stdin`

Scripts and agents pipe the value with `--stdin`:

```bash
pbpaste | zendesk auth set zendesk --stdin                               # macOS clipboard
op read 'op://Private/Zendesk/credential' | zendesk auth set zendesk --stdin
printf '%s' 'you@example.com/token:<api_token>' | zendesk auth set zendesk --stdin
```

Without a terminal and without `--stdin`, `auth set` exits 2 instead of hanging; it never reads stdin implicitly. The key is never accepted as an argument or flag value, because arguments land in shell history and `ps` output. Add `--dry-run` to validate without writing.

### Commands

| Command | What it does |
|---|---|
| `zendesk auth set <resource> [--key NAME] [--stdin] [--dry-run]` | Store a credential (`resource` is `zendesk`). Output reports `stored`/`would_store` and flags a key that an env var or `.env` still overrides (`shadowed_by`). |
| `zendesk auth list` | Every credential key with keychain `set`/`missing`/`unknown` and the active source. Never prints values. Supports `--csv` and `--text`. |
| `zendesk auth delete <resource> [--key NAME] --yes [--dry-run]` | Remove keychain entries. Refuses without `--yes` (exit 2). Reports `deleted`/`not_found`. |
| `zendesk auth migrate [--dry-run] [--overwrite]` | Copy credentials whose active source is a dotenv file into the keychain. Skips keys already stored unless `--overwrite`. Leaves process-environment keys (op run, CI) alone. Does not edit files; it lists them under `clean_up`. |
| `zendesk config show` | Resolved config with secrets redacted and keychain status. |
| `zendesk agent-context` | Machine-readable schema of every command, flag, exit code, and env var. |

All `auth` commands take `--toon` (default), `--json`, `--csv` (list only), or `--text`. Exit codes: validation 2, config/keychain 3.

### Migrating off a plaintext `.env`

```bash
zendesk auth migrate --dry-run   # see what would move
zendesk auth migrate             # store it
# delete ZENDESK_API_KEY from each clean_up file: a .env value keeps overriding the keychain
zendesk auth list                # active source should now read "keychain"
```

### Caveats

- **Access prompts (macOS).** The binary that created an entry reads it silently. A different binary may trigger a "wants to use your confidential information" dialog the first time, for example after a Bun upgrade, from the standalone `zendesk` binary versus `bun run`, or from a GUI MCP host. Choose **Always Allow**.
- **Linux** needs a running Secret Service daemon. Headless servers and CI often have none; there, `keychain.status` is `unavailable`. Use env vars or `op run`, and set `ZENDESK_KEYCHAIN=0` to skip the lookup.
- **Runtime.** The lookup needs Bun (the CLI and MCP server already run on Bun). SDK consumers on Node skip it; `resolveConfig()` never touches the keychain.
- **Threat model.** The keychain keeps the key out of files that get committed, synced, backed up, or read by other tools. It does not protect against code already running as your user once access is granted.

## MCP setup

Recommended: store the key in the keychain and use a host config with no `env` block:

```json
{
  "mcpServers": {
    "zendesk-toolkit": {
      "command": "bun",
      "args": ["run", "/abs/path/zendesk-toolkit/packages/mcp/src/index.ts"]
    }
  }
}
```

The server calls `loadConfig()` on every tool call, so a rotated key applies without a restart. `ZENDESK_BASE_URL` can come from the repo `.env` (found by walking up from the server's own directory) or from a dotenv file named by `ZENDESK_DOTENV_PATH`. Use the read-only `get_config_status` tool to see where each value resolved from. The server has no tool that writes or deletes credentials.
