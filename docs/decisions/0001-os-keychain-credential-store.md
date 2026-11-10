---
title: "0001: Store the Zendesk API key in the OS keychain with Bun.secrets"
description: "ZENDESK_API_KEY can live in the OS credential store via Bun.secrets, resolved after env and .env and before the default."
status: accepted
date: 2026-11-10
decision-makers: "Spenser Hale"
---

## Context

Before this change, every persistent way to give the toolkit its Zendesk credential was plaintext at rest: a project `.env`, a file named by `ZENDESK_DOTENV_PATH`, or literal values in an MCP host `env` block. GUI MCP hosts do not inherit the shell, so the usual fix was pasting the key into the host config.

Bun 1.3+ ships `Bun.secrets`, which wraps macOS Keychain Services, Linux libsecret, and Windows Credential Manager with no native dependency. The CLI and MCP server already run on Bun. The sibling toolkits (wide-search, sendgrid, ynab, atlassian-ai, rollbar) adopted the same design.

## Options considered

1. **`Bun.secrets`**: built in, cross-platform, no install step, async only, Bun only.
2. **`@napi-rs/keyring` or `keytar`**: also work on Node but add a native dependency; `keytar` is archived.
3. **Shell out to `security`**: macOS only, and `-w <value>` leaks the secret to `ps`.
4. **Document `op run` only**: no code, but leaves non-1Password users with plaintext.

## Decision

Store credentials with `Bun.secrets` under service `zendesk-toolkit`, one entry per env-var name. Today that is only `ZENDESK_API_KEY` (an OAuth token or `email/token:<api_token>`); `ZENDESK_BASE_URL` stays ordinary config.

Resolution order:

```
process environment > ZENDESK_DOTENV_PATH / nearest .env.local, .env > OS keychain > default
```

The resolver reads the keychain only for credentials that env and dotenv files did not supply, and treats any store error as "keychain unavailable" rather than fatal. `ZENDESK_KEYCHAIN=0` (from env or any dotenv file, including `ZENDESK_DOTENV_PATH`) turns the lookup off. Writes happen only through CLI `auth` commands; the MCP server reads but exposes no write tool. There is no plaintext fallback store and no multi-profile support. `auth migrate` copies keys but never edits files.

## Consequences

- MCP host configs no longer need an `env` block with literal keys.
- `resolveConfig()` stays synchronous and never touches the keychain; the new async `loadConfig()` adds the lookup, and every CLI command and MCP tool uses it.
- The CLI gained the supporting pieces it lacked: typed `ZendeskConfigError` (exit 3) and `ZendeskValidationError` (exit 2), structured `--toon/--json/--csv/--text` output for new commands, `config show`, and `agent-context`.
- macOS may prompt the first time a different binary (for example the standalone `zendesk` binary versus `bun run`) reads the entry.
- The keychain protects the key at rest, not from code already running as the user.

## Revisit when

- Users need several Zendesk accounts (separate keychain profiles).
- The CLI or MCP server needs to run on Node.

## Links

- Guide: [Configuration](../guides/configuration.md)
- Guide: [Security](../guides/security.md)
