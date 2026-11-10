# @zendesk-toolkit/mcp

MCP server for Zendesk, built with [FastMCP](https://github.com/punkpeye/fastmcp).

## Tools

| Tool | Description |
|------|-------------|
| `get_config_status` | Where the credentials and base URL resolve from (env, envfile, keychain); secrets redacted |
| `list_resources` | List resources with pagination |
| `get_resource` | Get a resource by ID |
| `create_resource` | Create a new resource |
| `delete_resource` | Delete a resource |
| `get_ticket` | Get main ticket details by ticket ID (`format`: `json`/`toon`) |
| `get_ticket_comments` | Get full ticket comments (`format`: `json`/`toon`, default `toon`) |
| `list_tickets` | List tickets newest-updated-first, one bounded page (`limit`, `cursor`, `sort_by`, `sort_order`) |
| `search_tickets` | Search tickets with Zendesk search syntax (`query`, `limit`, `page`, `sort_by`, `sort_order`) |

## Setup with Claude Desktop

Store the API key in the OS keychain first (`zendesk auth set zendesk`, or
`bun run dev:cli -- auth set zendesk` from the repo). The server reads it on every tool
call, so no `env` block is needed and a rotated key applies without a restart:

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

Set `ZENDESK_BASE_URL` in the repo `.env` (found by walking up from the server's own
directory) or point `ZENDESK_DOTENV_PATH` at a dotenv file with no secrets in it. The server
exposes no tool that writes or deletes credentials. On macOS the first keychain read from a
GUI host may show an access dialog; choose **Always Allow**.

## Development

```bash
# Run in stdio mode
bun run dev

# Inspect with FastMCP inspector
bun run inspect
```
