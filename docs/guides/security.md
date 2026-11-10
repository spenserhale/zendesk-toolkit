---
title: "Security"
description: Read this before changing how credentials are read, stored, logged, or tested.
---

## Credentials

- **The keychain is the persistent no-plaintext store.** `zendesk auth set` writes `ZENDESK_API_KEY` to the OS credential store (service `zendesk-toolkit`) via `Bun.secrets`. There is no plaintext fallback store: when the keychain is unavailable, use env vars or `op run`.
- **Keys never go in argv.** `auth set` reads the value from a hidden TTY prompt or from stdin with `--stdin`. No command accepts a secret as a positional argument or flag, so keys stay out of shell history and `ps` output.
- **Values are never printed.** `auth list`, `auth set`, `auth migrate`, `config show`, and the MCP `get_config_status` tool report `set`/`missing` and sources only. Error messages never echo a secret.
- **`.env` beats the keychain.** Explicit per-process and per-project values win so `op run`, CI, and project overrides keep working. `auth set` flags a stored key that an env var or `.env` shadows, and `auth migrate` lists the files to clean up instead of editing them.
- **The MCP server has no write tools.** It reads the keychain through `loadConfig()` but cannot store, change, or delete credentials. Writes happen only through the CLI `auth` commands, which a person or an agent with shell access runs deliberately.
- **Threat model.** The keychain protects keys at rest (committed files, synced folders, backups, other tools reading `.env`). It does not protect against code already running as the user after keychain access is granted.

## Tests

- **Tests never touch the real keychain.** SDK and CLI unit tests inject an in-memory `SecretStore`. Every spawned CLI or MCP process in tests runs with `ZENDESK_KEYCHAIN=0`.
- SDK tests pass `searchModuleDir: false` and a temp `cwd`, so a developer's real `.env` never leaks into assertions.
- Manual keychain checks use dummy values only, start with `zendesk auth list` so a real entry is never overwritten, and delete the dummy entry afterwards.
