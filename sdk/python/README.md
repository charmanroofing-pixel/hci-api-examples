# hobbycardindex

Python client for the [HobbyCardIndex Data API](https://hobbycardindex.com/developers): raw and graded prices on a 16M+ card catalog across 25+ categories (baseball, basketball, football, hockey, soccer, Pokemon, Magic, Yu-Gi-Oh, One Piece and more), card ID from a photo, PSA, BGS, CGC and SGC cert lookups, real sold sales, price history and pop reports.

Python 3.9 or newer. Standard library only (urllib), no dependencies.

## Install

```sh
pip install hobbycardindex
# Publish pending: until the package lands, copy src/hobbycardindex/ into your project (standard library only).
```

## Quick start

```python
import os
from hobbycardindex import HobbyCardIndex

hci = HobbyCardIndex(os.environ["HCI_API_KEY"])
results = hci.search_cards("2011 Topps Update Mike Trout US175")["results"]
out = hci.get_prices(results[0]["id"])
print(out["card"]["name"], out["prices"]["loose"], out["prices"]["psa10"])
```

Every method returns the `data` part of the API's `{"success": true, "data": ...}` envelope. Prices are US dollars. `bgs10` holds the BGS 9.5 price.

## Get a key

Keys come with a Commercial plan (apps and websites that show the data to their users) or the Enterprise plan (your own business's internal use). Sign in and go to Settings, API Access, Generate API Key. The key is shown once.

Commercial plans: Lite $99, Growth Lite $249, Growth $499, Platform $1,500 a month. A free setup month is available by application at [hobbycardindex.com/developers](https://hobbycardindex.com/developers).

## Credit requirement

The Terms ask for one visible credit to Hobby Card Index with a link, beside the prices or on your site:

```html
<a href="https://hobbycardindex.com">Prices from Hobby Card Index</a>
```

The same snippet is exported as `CREDIT_HTML`. The API's JSON responses also carry an `attribution` object and an `X-Attribution` header with the credit to show; the client keeps the most recent one on `hci.last_attribution`.

## Methods

| Method | Endpoint | Plans |
|---|---|---|
| `search_cards(q, category=, set_id=, language=, year=, added_since=, min_price=, max_price=, sort=, limit=, offset=)` | `GET /prices/search` | every plan |
| `list_sets(category, language=, q=, limit=, offset=)` | `GET /sets` | every plan |
| `get_prices(card_id)` (alias `get_card`) | `GET /prices/:cardId` | every plan |
| `get_sales(card_id, days=)` | `GET /prices/:cardId/sales` | commercial |
| `get_price_history(card_id, days=)` | `GET /prices/:cardId/history` | commercial |
| `get_population(card_id)` | `GET /prices/:cardId/population` | Platform, or the pop + cert add-on |
| `get_listings(card_id, limit=, grade=, min_feedback_percent=, min_feedback_score=)` | `GET /prices/:cardId/listings` | enabled per account |
| `lookup_cert(grader, cert_number)` | `GET /certs/:grader/:certNumber` | commercial |
| `scan_card(path_or_bytes, category=, mime_type=, slab=)` | `POST /scan` | commercial |
| `get_market_movers(category=, period=)` | `GET /market/movers` | every plan |
| `get_categories()` | `GET /market/categories` | every plan |
| `get_usage()` | `GET /usage` | every plan |
| `get_collection()` | `GET /collection` | every plan |
| `export_collection_csv(category=)` | `GET /export/csv` | every plan |
| `list_bulk_files()` | `GET /bulk/prices` | Platform, or the price files add-on |
| `download_bulk_file(category, part=, gzip=False)` | `GET /bulk/prices/:category` | Platform, or the price files add-on |
| `get_watchlist(limit=, offset=)` | `GET /watchlist` | commercial |
| `add_to_watchlist(card_ids=, category=, set_id=, language=)` | `POST /watchlist` | commercial |
| `remove_from_watchlist(card_ids=, category=, set_id=, language=, remove_all=False)` | `POST /watchlist/remove` | commercial |
| `get_watchlist_prices(csv=False)` | `GET /watchlist/prices` | commercial |
| `get_webhook()` | `GET /webhook` | commercial |
| `set_webhook(url, hour=, rotate_secret=False)` | `PUT /webhook` | commercial |
| `delete_webhook()` | `DELETE /webhook` | commercial |
| `test_webhook()` | `POST /webhook/test` | commercial |

`card_id` is the `id` from search or scan results. To look a card up by its `externalId`, pass `"ext-<externalId>"`.

### Scanning a photo

```python
scan = hci.scan_card("card.jpg", category="baseball")   # a path, bytes, or a base64 string
if scan["match"]:
    print(scan["match"]["name"], scan["match"]["confidence"], scan["match"]["prices"])
print(len(scan["alternatives"]), "alternatives", "graded" if scan["slab"] else "raw")
```

JPEG, PNG or WebP under 10 MB. The MIME type is guessed from a path's extension; pass `mime_type=` for bytes.

## Errors

Every non-2xx answer raises `HobbyCardIndexError` with `status`, `code` and `message` from the API's error envelope, plus `details` when the API sent any. On a 429 (or a 503 that says when to retry) `retry_after` is the number of seconds from the `Retry-After` header. A timeout or network failure has `status == 0` and code `TIMEOUT` or `NETWORK_ERROR`.

```python
import time
from hobbycardindex import HobbyCardIndexError

try:
    hci.get_sales(12345)
except HobbyCardIndexError as err:
    if err.code == "RATE_LIMITED":
        time.sleep(err.retry_after or 1)
    else:
        raise
```

Keys are limited per second (1 on Enterprise, 10 to 50 on the commercial sizes), so space calls out rather than running them in parallel.

## Options

```python
HobbyCardIndex(
    api_key="hci_live_...",
    base_url="https://hobbycardindex.com/api/v1",  # default
    timeout=30.0,                                   # seconds, default
)
```

## More

- API reference: https://hobbycardindex.com/developers
- OpenAPI spec: https://hobbycardindex.com/openapi.json
- MCP server for AI assistants: https://hobbycardindex.com/api/v1/mcp (Streamable HTTP, same key as the `X-API-Key` header)
- Examples: https://github.com/charmanroofing-pixel/hci-api-examples
- Questions: sean@hobbycardindex.com

MIT licence.
