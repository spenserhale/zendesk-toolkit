# @zendesk-toolkit/mcp

MCP server for Zendesk, built with [FastMCP](https://github.com/punkpeye/fastmcp).

## Tools

| Tool | Description |
|------|-------------|
| `list_resources` | List resources with pagination |
| `get_resource` | Get a resource by ID |
| `create_resource` | Create a new resource |
| `delete_resource` | Delete a resource |
| `get_ticket` | Get main ticket details by ticket ID (`format`: `json`/`toon`) |
| `get_ticket_comments` | Get full ticket comments (`format`: `json`/`toon`, default `toon`) |
| `list_tickets` | List tickets newest-updated-first, one bounded page (`limit`, `cursor`, `sort_by`, `sort_order`) |
| `search_tickets` | Search tickets with Zendesk search syntax (`query`, `limit`, `page`, `sort_by`, `sort_order`) |

## Setup with Claude Desktop

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "zendesk-toolkit": {
      "command": "bun",
      "args": ["run", "/Users/spenser/Code/Toolkits/zendesk-toolkit/packages/mcp/src/index.ts"],
      "env": {
        "ZENDESK_API_KEY": "you@example.com/token:your_api_token",
        "ZENDESK_BASE_URL": "https://your-subdomain.zendesk.com",
        "ZENDESK_DOTENV_PATH": "/Users/spenser/Code/Toolkits/zendesk-toolkit/.env"
      }
    }
  }
}
```

## Development

```bash
# Run in stdio mode
bun run dev

# Inspect with FastMCP inspector
bun run inspect
```
