# Zendesk Toolkit

Zendesk integration tools

A monorepo containing the SDK, CLI, and MCP server for the Zendesk API.

## Install the CLI

Install the latest standalone binary for macOS or Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/spenserhale/zendesk-toolkit/main/scripts/install.sh | sh
```

The installer verifies the SHA256 checksum and installs `zendesk` to
`$HOME/.local/bin`. Set `ZENDESK_TOOLKIT_VERSION=v0.1.0` to pin a release or
`ZENDESK_TOOLKIT_INSTALL=$HOME/bin` to use another directory.

Update a standalone install at any time:

```sh
zendesk upgrade
zendesk upgrade --check
```

## Packages

| Package | Description |
|---------|-------------|
| [`@zendesk-toolkit/sdk`](./packages/sdk) | Core SDK with types, API client, and business logic |
| [`@zendesk-toolkit/cli`](./packages/cli) | Command-line interface (Stricli) |
| [`@zendesk-toolkit/mcp`](./packages/mcp) | MCP server for AI assistants (FastMCP) |

## Getting Started

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run the CLI
bun run dev:cli -- --help

# Run the MCP server (stdio mode for Claude Desktop)
bun run dev:mcp
```

Set these environment variables before running ticket commands:

```bash
# Either OAuth token OR Zendesk API token credentials:
# OAuth: "your-oauth-access-token"
# API token: "you@example.com/token:your_api_token"
export ZENDESK_API_KEY=you@example.com/token:your_api_token
export ZENDESK_BASE_URL=https://your-subdomain.zendesk.com
# Optional when running from a different working directory:
export ZENDESK_DOTENV_PATH=/Users/spenser/Code/Toolkits/zendesk-toolkit/.env
```

Ticket CLI commands:

```bash
# List tickets, most recently updated first (bounded page, cursor to continue)
bun run dev:cli -- tickets list --limit 25
bun run dev:cli -- tickets list --cursor "<next_cursor from the previous page>"

# Search with Zendesk search syntax (scoped to type:ticket automatically)
bun run dev:cli -- tickets search "status:open priority:urgent"
bun run dev:cli -- tickets search "printer jam" --sort created_at --page 2

# Print main ticket details
bun run dev:cli -- tickets get 12345

# Print all ticket comments
bun run dev:cli -- tickets comments 12345

# Optional: output JSON instead of TOON
bun run dev:cli -- tickets comments --json 12345
```

`list` and `search` return bounded pages (default 25, max `--limit 100`) of ticket
summaries. When more results exist, the output carries `has_more` plus a `hint`
naming the flag to use next — `--cursor` for `list`, `--page` for `search`.

## Architecture

```
packages/sdk/     <-- Types, API client, business logic (foundation)
    ^       ^
    |       |
packages/cli/   packages/mcp/
    (Stricli)    (FastMCP)
```

Both the CLI and MCP server are thin wrappers over the SDK. If the REST API
changes, you update the SDK and both consumers get the fix automatically.

## Development

```bash
# Run tests across all packages
bun test

# Build a specific package
cd packages/sdk && bun run build
```

## Adding a New API Operation

1. Add types to `packages/sdk/src/types.ts`
2. Add the client method to `packages/sdk/src/client.ts`
3. Add a CLI command in `packages/cli/src/commands/`
4. Add an MCP tool in `packages/mcp/src/tools/`
