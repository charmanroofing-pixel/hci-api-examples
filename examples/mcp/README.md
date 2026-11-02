# MCP client configs

The HobbyCardIndex MCP server is `https://hobbycardindex.com/api/v1/mcp`.

- Transport: Streamable HTTP, stateless. POST JSON-RPC 2.0 to that URL and the answer comes back as JSON. There is no SSE stream (a GET answers 405) and no session id to keep.
- Auth: your API key in the `X-API-Key` header (or `Authorization: Bearer`). It is the same key as the REST API, with the same plan and limits; every lookup counts toward your usage.
- Tools: `search_cards` (query, optional category, up to 5 matches with raw and PSA 10 prices) and `get_card_prices` (card_id, every grade). Without a key a client can still run `initialize` and `tools/list`, and the `list_plans` and `start_checkout` tools work keyless so an assistant can buy a plan for its user.

## Claude Desktop

Claude Desktop's config file runs stdio servers, so the remote endpoint is bridged with [mcp-remote](https://www.npmjs.com/package/mcp-remote) (needs Node 18+). Copy [`claude-desktop-config.json`](claude-desktop-config.json) into `claude_desktop_config.json` (Settings, Developer, Edit Config) and put your key in `env.HCI_API_KEY`. `--transport http-only` matches this server: it speaks Streamable HTTP only. On Windows, if `npx` is not found, use `"command": "cmd"` with `"args": ["/c", "npx", ...]`.

## Claude Code

```sh
claude mcp add --transport http hobbycardindex https://hobbycardindex.com/api/v1/mcp --header "X-API-Key: hci_live_..."
```

## Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "hobbycardindex": {
      "url": "https://hobbycardindex.com/api/v1/mcp",
      "headers": { "X-API-Key": "hci_live_..." }
    }
  }
}
```

## VS Code (`.vscode/mcp.json`)

```json
{
  "servers": {
    "hobbycardindex": {
      "type": "http",
      "url": "https://hobbycardindex.com/api/v1/mcp",
      "headers": { "X-API-Key": "hci_live_..." }
    }
  }
}
```

## Raw JSON-RPC, for your own client

```sh
curl -s https://hobbycardindex.com/api/v1/mcp \
  -H 'Content-Type: application/json' -H "X-API-Key: $HCI_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_cards","arguments":{"query":"1989 Upper Deck Ken Griffey Jr 1"}}}'
```

The result carries `content` (text for the assistant) and `structuredContent` (the cards with `card_id`, prices and the card page URL). Share the card page link with the user; the Terms' credit to Hobby Card Index applies to anything you display.
