# HobbyCardIndex API examples

The HobbyCardIndex Data API returns raw and graded prices, based on real sold prices, for a 16M+ card catalog across 25+ categories: baseball, basketball, football, hockey, soccer, Pokemon, Magic: The Gathering, Yu-Gi-Oh, One Piece and more. It also identifies a card from a photo, looks up PSA, BGS, CGC and SGC certs, and returns sold sales, price history, pop reports and market movers.

Used by card apps and marketplaces, graders, dealers and shop software, and AI agents (through the MCP server).

- Docs and keys: https://hobbycardindex.com/developers
- OpenAPI spec: https://hobbycardindex.com/openapi.json
- MCP server: https://hobbycardindex.com/api/v1/mcp (manifest: https://hobbycardindex.com/.well-known/mcp.json)
- Support: sean@hobbycardindex.com

## Quick start

Every request carries your key in the `X-API-Key` header (or `Authorization: Bearer`). Every successful response is `{"success": true, "data": {...}}`; the SDKs return `data`.

### curl

```sh
export HCI_API_KEY=hci_live_...
curl -s 'https://hobbycardindex.com/api/v1/prices/search?q=2011%20Topps%20Update%20Mike%20Trout%20US175' \
  -H "X-API-Key: $HCI_API_KEY"
```

### JavaScript (Node 18+)

```sh
npm install hobbycardindex
# The npm package is being published. Until it lands, copy sdk/js/src/index.js into your project; it has no dependencies.
```

```js
import { HobbyCardIndex } from 'hobbycardindex';

const hci = new HobbyCardIndex({ apiKey: process.env.HCI_API_KEY });
const { results } = await hci.searchCards('2011 Topps Update Mike Trout US175');
const { card, prices } = await hci.getPrices(results[0].id);
console.log(card.name, prices.loose, prices.psa10);
```

### Python (3.9+)

```sh
pip install hobbycardindex
# The PyPI package is being published. Until it lands, copy sdk/python/src/hobbycardindex/ into your project; standard library only.
```

```python
import os
from hobbycardindex import HobbyCardIndex

hci = HobbyCardIndex(os.environ["HCI_API_KEY"])
results = hci.search_cards("2011 Topps Update Mike Trout US175")["results"]
out = hci.get_prices(results[0]["id"])
print(out["card"]["name"], out["prices"]["loose"], out["prices"]["psa10"])
```

More in [`examples/`](examples/): [curl for every endpoint](examples/curl.md), [Node](examples/node/), [Python](examples/python/), [MCP client config](examples/mcp/), [Google Sheets](examples/sheets/README.md).

## Endpoints

Base URL: `https://hobbycardindex.com/api/v1`

| Endpoint | What it returns |
|---|---|
| `GET /prices/search` | Cards matching `q` with prices at every grade; filter by `category`, `set`, `language`, `year`, `added_since`, `min_price`, `max_price`, `sort`, page with `limit` and `offset`. |
| `GET /sets?category=` | Every set in a category with the set id search and the watch list take. |
| `GET /prices/:cardId` | One card and its prices: `loose` (raw), `psa10`, `psa9`, `psa8`, `psa7`, `bgs10` (BGS 9.5), `cgc10`, `sgc10`, `volume`, `updated`. |
| `GET /prices/:cardId/sales?days=90` | Verified sold sales for the card, newest first, with price, date, grade, marketplace and listing link, plus a summary. Commercial plans. |
| `GET /prices/:cardId/history?days=365` | The daily price at every grade, for charts. Commercial plans. |
| `GET /prices/:cardId/population` | How many copies each grader has graded, grade by grade, with gem counts. Platform, or the pop + cert add-on. |
| `GET /prices/:cardId/listings` | Active listings for the card, deals first. Enabled per account. |
| `GET /certs/:grader/:certNumber` | A PSA, BGS, CGC or SGC cert as the card, grade, price at that grade and a link to the grader's page. Commercial plans. |
| `POST /scan` | Identify a card from a photo (base64 JPEG, PNG or WebP): the best match with prices, up to 7 alternatives, and the slab label on a graded card. Commercial plans. |
| `GET /market/movers?category=&period=` | The biggest risers and fallers in a category over 1, 7 or 30 days. |
| `GET /market/categories` | Every category with card counts and average prices. |
| `GET /usage` | Your plan, limits and month-to-date usage. |
| `GET /collection` | Your own collection on HobbyCardIndex. |
| `GET /export/csv` | Your collection as CSV. |
| `GET /bulk/prices` and `GET /bulk/prices/:category` | The daily full-category price files. Platform, or the price files add-on. |
| `GET`, `POST /watchlist`, `POST /watchlist/remove`, `GET /watchlist/prices` | Cards (or whole sets) to follow; one download of all their current prices. Commercial plans. |
| `GET`, `PUT`, `DELETE /webhook`, `POST /webhook/test` | A signed POST to your server once a day with every watched card whose price changed. Commercial plans. |

`cardId` is the `id` from search or scan results; `ext-<externalId>` looks a card up by its `externalId`. Rate limits are per key and per second (1 on Enterprise, 10 to 50 on the commercial sizes); a 429 carries a `Retry-After` header.

Errors are `{"success": false, "error": {"code", "message", "details"?}}`. Codes you will meet: `MISSING_API_KEY`, `INVALID_API_KEY`, `RATE_LIMITED`, `VALIDATION_ERROR`, `NOT_FOUND`, `REQUIRES_COMMERCIAL_LICENSE`, `MONTHLY_LIMIT_REACHED`.

## Attribution

The Terms ask for one visible credit to Hobby Card Index with a link, beside the prices or on your site. The API's JSON responses carry an `attribution` object and an `X-Attribution` header with the exact text and link to show.

HTML:

```html
<a href="https://hobbycardindex.com">Prices from Hobby Card Index</a>
```

Markdown badge (for a README or docs page):

```md
[![Prices from Hobby Card Index](https://img.shields.io/badge/Prices%20from-Hobby%20Card%20Index-4a8ff0)](https://hobbycardindex.com)
```

## Plans

For apps and websites whose users see the data: Lite $99, Growth Lite $249, Growth $499 and Platform $1,500 a month, billed monthly, cancel any time. A free setup month is available by application at https://hobbycardindex.com/developers. Your own business's internal use is covered by the Enterprise plan ($49.99 a month). Full terms: https://hobbycardindex.com/terms/ section 8.

## MCP (AI assistants)

AI assistants that speak the Model Context Protocol connect to `https://hobbycardindex.com/api/v1/mcp` (Streamable HTTP, JSON responses, no session) with the same key as the `X-API-Key` header. Tools: `search_cards`, `get_card_prices`, and, without a key, `list_plans` and `start_checkout`. Client configs for Claude Desktop, Claude Code, Cursor and VS Code are in [`examples/mcp/`](examples/mcp/).

## Questions

sean@hobbycardindex.com, or open an issue here. Please do not post API keys in issues.
