# hobbycardindex

JavaScript client for the [HobbyCardIndex Data API](https://hobbycardindex.com/developers): raw and graded prices on a 16M+ card catalog across 25+ categories (baseball, basketball, football, hockey, soccer, Pokemon, Magic, Yu-Gi-Oh, One Piece and more), card ID from a photo, PSA, BGS, CGC and SGC cert lookups, real sold sales, price history and pop reports.

Node 18 or newer. No dependencies (uses the global `fetch`).

## Install

```sh
npm install hobbycardindex
# Publish pending: until the package lands, copy src/index.js into your project (no dependencies).
```

## Quick start

```js
import { HobbyCardIndex } from 'hobbycardindex';

const hci = new HobbyCardIndex({ apiKey: process.env.HCI_API_KEY });
const { results } = await hci.searchCards('2011 Topps Update Mike Trout US175');
const { card, prices } = await hci.getPrices(results[0].id);
console.log(card.name, prices.loose, prices.psa10);
```

Every method returns the `data` part of the API's `{ success: true, data }` envelope. Prices are US dollars. `bgs10` holds the BGS 9.5 price.

## Get a key

Keys come with a Commercial plan (apps and websites that show the data to their users) or the Enterprise plan (your own business's internal use). Sign in and go to Settings, API Access, Generate API Key. The key is shown once.

Commercial plans: Lite $99, Growth Lite $249, Growth $499, Platform $1,500 a month. A free setup month is available by application at [hobbycardindex.com/developers](https://hobbycardindex.com/developers).

## Credit requirement

The Terms ask for one visible credit to Hobby Card Index with a link, beside the prices or on your site:

```html
<a href="https://hobbycardindex.com">Prices from Hobby Card Index</a>
```

The same snippet is exported as `CREDIT_HTML`. The API's JSON responses also carry an `attribution` object and an `X-Attribution` header with the credit to show; the client keeps the most recent one on `hci.lastAttribution`.

## Methods

| Method | Endpoint | Plans |
|---|---|---|
| `searchCards(q or params)` | `GET /prices/search` | every plan |
| `listSets(category, opts)` | `GET /sets` | every plan |
| `getPrices(cardId)` (alias `getCard`) | `GET /prices/:cardId` | every plan |
| `getSales(cardId, { days })` | `GET /prices/:cardId/sales` | commercial |
| `getPriceHistory(cardId, { days })` | `GET /prices/:cardId/history` | commercial |
| `getPopulation(cardId)` | `GET /prices/:cardId/population` | Platform, or the pop + cert add-on |
| `getListings(cardId, opts)` | `GET /prices/:cardId/listings` | enabled per account |
| `lookupCert(grader, certNumber)` | `GET /certs/:grader/:certNumber` | commercial |
| `scanCard(image, { category, mimeType, slab })` | `POST /scan` | commercial |
| `getMarketMovers({ category, period })` | `GET /market/movers` | every plan |
| `getCategories()` | `GET /market/categories` | every plan |
| `getUsage()` | `GET /usage` | every plan |
| `getCollection()` | `GET /collection` | every plan |
| `exportCollectionCsv({ category })` | `GET /export/csv` | every plan |
| `listBulkFiles()` | `GET /bulk/prices` | Platform, or the price files add-on |
| `downloadBulkFile(category, { part, format })` | `GET /bulk/prices/:category` | Platform, or the price files add-on |
| `getWatchlist({ limit, offset })` | `GET /watchlist` | commercial |
| `addToWatchlist(body)` | `POST /watchlist` | commercial |
| `removeFromWatchlist(body)` | `POST /watchlist/remove` | commercial |
| `getWatchlistPrices({ format })` | `GET /watchlist/prices` | commercial |
| `getWebhook()` | `GET /webhook` | commercial |
| `setWebhook({ url, hour, rotateSecret })` | `PUT /webhook` | commercial |
| `deleteWebhook()` | `DELETE /webhook` | commercial |
| `testWebhook()` | `POST /webhook/test` | commercial |

`cardId` is the `id` from search or scan results. To look a card up by its `externalId`, pass `ext-<externalId>`.

### Scanning a photo

```js
import { readFile } from 'node:fs/promises';

const photo = await readFile('card.jpg');
const scan = await hci.scanCard(photo, { category: 'baseball' });
if (scan.match) console.log(scan.match.name, scan.match.confidence, scan.match.prices);
console.log(scan.alternatives.length, 'alternatives', scan.slab ? 'graded' : 'raw');
```

`image` can be a Buffer, Uint8Array, ArrayBuffer, Blob or a base64 string (a `data:` prefix is fine). JPEG, PNG or WebP under 10 MB.

## Errors

Every non-2xx answer throws `HobbyCardIndexError` with `status`, `code` and `message` from the API's error envelope, plus `details` when the API sent any. On a 429 (or a 503 that says when to retry) `retryAfter` is the number of seconds from the `Retry-After` header. A timeout or network failure has `status: 0` and code `TIMEOUT` or `NETWORK_ERROR`.

```js
import { HobbyCardIndexError } from 'hobbycardindex';

try {
  await hci.getSales(12345);
} catch (err) {
  if (err instanceof HobbyCardIndexError && err.code === 'RATE_LIMITED') {
    await new Promise((r) => setTimeout(r, (err.retryAfter ?? 1) * 1000));
  } else {
    throw err;
  }
}
```

Keys are limited per second (1 on Enterprise, 10 to 50 on the commercial sizes), so space calls out rather than firing them in parallel.

## Options

```js
new HobbyCardIndex({
  apiKey: 'hci_live_...',
  baseUrl: 'https://hobbycardindex.com/api/v1', // default
  fetch: globalThis.fetch,                        // default; pass your own for tests or proxies
  timeoutMs: 30000,                               // default
});
```

## More

- API reference: https://hobbycardindex.com/developers
- OpenAPI spec: https://hobbycardindex.com/openapi.json
- MCP server for AI assistants: https://hobbycardindex.com/api/v1/mcp (Streamable HTTP, same key as the `X-API-Key` header)
- Examples: https://github.com/charmanroofing-pixel/hci-api-examples
- Questions: sean@hobbycardindex.com

MIT licence.
