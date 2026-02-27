# Zendesk Toolkit

Zendesk integration tools

A monorepo containing the SDK, CLI, and MCP server for the Zendesk API.

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
```

Ticket CLI commands:

```bash
# Print main ticket details
bun run dev:cli -- tickets get 12345

# Print full ticket thread (all comments)
bun run dev:cli -- tickets thread 12345
```

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
