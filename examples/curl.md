# Every endpoint, in curl

```sh
export HCI_API_KEY=hci_live_...
export HCI=https://hobbycardindex.com/api/v1
```

Every request carries the key in the `X-API-Key` header (`Authorization: Bearer` works too). Every successful answer is wrapped as `{"success": true, "data": {...}}`; the excerpts below are trimmed and show the whole body. Prices are US dollars; `bgs10` holds the BGS 9.5 price; a grade with no price is `null`. An error answers `{"success": false, "error": {"code": "...", "message": "...", "details": {...}}}`. JSON responses also carry an `attribution` object and an `X-Attribution` header with the credit to show (CSV and file downloads do not).

## Catalog and prices (every plan)

### Search cards

```sh
curl -s "$HCI/prices/search?q=2011%20Topps%20Update%20Mike%20Trout%20US175" -H "X-API-Key: $HCI_API_KEY"
```

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": 12345,
        "externalId": "67890",
        "name": "Mike Trout #US175",
        "year": 2011,
        "setName": "Topps Update",
        "setId": "topps-update-2011",
        "cardNumber": "US175",
        "printRun": null,
        "category": "baseball",
        "playerName": "Mike Trout",
        "imageUrl": "https://hobbycardindex.com/api/v1/images/proxy?i=...",
        "addedAt": "2025-02-11T03:14:09.000Z",
        "prices": { "loose": 293.00, "psa10": 4500.00, "psa9": 1250.00, "psa8": 610.00, "psa7": null, "bgs10": 2900.00, "cgc10": null, "sgc10": 3100.00, "volume": 1400 },
        "hciUrl": "https://hobbycardindex.com/cards/12345"
      }
    ],
    "count": 1
  }
}
```

With any filter (`category`, `set`, `language`, `year`, `added_since`, `min_price`, `max_price`, `sort`, `limit`, `offset`) the answer also carries `limit`, `offset` and `hasMore`. A whole set, 100 at a time:

```sh
curl -s "$HCI/prices/search?category=pokemon&set=pokemon-scarlet-violet-151&limit=100&offset=0" -H "X-API-Key: $HCI_API_KEY"
```

### Sets in a category

```sh
curl -s "$HCI/sets?category=pokemon&language=english&q=151" -H "X-API-Key: $HCI_API_KEY"
```

```json
{
  "success": true,
  "data": {
    "category": "pokemon",
    "language": "english",
    "sets": [ { "id": "pokemon-scarlet-violet-151", "name": "Pokemon Scarlet & Violet 151", "language": "english", "year": 2023, "cards": 409 } ],
    "total": 1,
    "limit": 1000,
    "offset": 0
  }
}
```

### One card's prices

`cardId` is the `id` from search or scan. `ext-<externalId>` looks a card up by its `externalId`.

```sh
curl -s "$HCI/prices/12345" -H "X-API-Key: $HCI_API_KEY"
```

```json
{
  "success": true,
  "data": {
    "card": {
      "id": 12345, "externalId": "67890", "name": "Mike Trout #US175", "year": 2011, "setName": "Topps Update",
      "cardNumber": "US175", "printRun": null, "category": "baseball", "playerName": "Mike Trout",
      "imageUrl": "https://hobbycardindex.com/api/v1/images/proxy?i=...", "hciUrl": "https://hobbycardindex.com/cards/12345"
    },
    "prices": {
      "loose": 293.00, "psa10": 4500.00, "psa9": 1250.00, "psa8": 610.00, "psa7": null,
      "bgs10": 2900.00, "cgc10": null, "sgc10": 3100.00, "volume": 1400, "updated": "2026-10-31T09:12:44.000Z"
    }
  }
}
```

### Sold sales (commercial plans)

```sh
curl -s "$HCI/prices/12345/sales?days=90" -H "X-API-Key: $HCI_API_KEY"
```

```json
{
  "success": true,
  "data": {
    "card": { "id": 12345, "externalId": "67890", "name": "Mike Trout #US175", "year": 2011, "setName": "Topps Update", "category": "baseball", "playerName": "Mike Trout" },
    "periodDays": 90,
    "summary": { "count": 14, "average": 2350.75, "low": 1900.00, "high": 2800.00 },
    "sales": [
      {
        "soldAt": "2026-10-28T17:04:00.000Z", "price": 2500.00, "grade": "PSA 10", "gradingCompany": "PSA",
        "title": "2011 Topps Update Mike Trout RC #US175 PSA 10", "auction": true, "saleType": "auction",
        "askingPrice": null, "bids": 23, "source": "ebay", "url": "https://www.ebay.com/itm/...", "imageUrl": "https://i.ebayimg.com/..."
      }
    ]
  }
}
```

Each call returns the newest 100 sales in the window and counts as one sale lookup. Without a commercial plan: `403 REQUIRES_COMMERCIAL_LICENSE`.

### Price history (commercial plans)

```sh
curl -s "$HCI/prices/12345/history?days=365" -H "X-API-Key: $HCI_API_KEY"
```

```json
{
  "success": true,
  "data": {
    "card": { "id": 12345, "externalId": "67890", "name": "Mike Trout #US175", "year": 2011, "setName": "Topps Update", "category": "baseball", "playerName": "Mike Trout" },
    "days": 365,
    "history": [
      { "date": "2026-10-30", "loose": 290.00, "psa10": 4450.00, "psa9": 1250.00, "psa8": null, "psa7": null, "bgs10": 2900.00, "cgc10": null, "sgc10": null, "volume": 1398 },
      { "date": "2026-10-31", "loose": 293.00, "psa10": 4500.00, "psa9": 1250.00, "psa8": 610.00, "psa7": null, "bgs10": 2900.00, "cgc10": null, "sgc10": 3100.00, "volume": 1400 }
    ],
    "count": 2
  }
}
```

### Population report (Platform, or the pop + cert add-on)

```sh
curl -s "$HCI/prices/12345/population" -H "X-API-Key: $HCI_API_KEY"
```

```json
{
  "success": true,
  "data": {
    "card": { "id": 12345, "externalId": "67890", "name": "Mike Trout #US175", "year": 2011, "setName": "Topps Update", "category": "baseball", "playerName": "Mike Trout" },
    "population": {
      "totalPopulation": 41000, "totalGems": 9800, "asOf": "2026-10-30", "lastChange": null,
      "graders": { "PSA": { "totalGraded": 35000, "gems": 8200, "gemGrade": 10, "gemRate": 23.4, "ladder": { "10": 8200, "9": 14100, "8": 6900 }, "autoTotal": 0, "nonAutoTotal": 35000, "lastChange": null } }
    }
  }
}
```

`population` is `null` when no report is held for the card yet. Pop reports have their own monthly number (`429 POP_LIMIT_REACHED`).

### Active listings (enabled per account)

```sh
curl -s "$HCI/prices/12345/listings?limit=10&grade=psa10" -H "X-API-Key: $HCI_API_KEY"
```

```json
{
  "success": true,
  "data": {
    "card": { "id": 12345, "externalId": "67890", "name": "Mike Trout #US175", "year": 2011, "setName": "Topps Update", "category": "baseball", "playerName": "Mike Trout" },
    "status": "ok",
    "checkedAt": "2026-11-01T18:02:11.000Z",
    "count": 1,
    "listings": [
      {
        "itemId": "1234567890", "title": "2011 Topps Update Mike Trout RC US175 PSA 10", "price": 4100.00, "shipping": 0, "total": 4100.00, "currency": "USD",
        "grade": "PSA 10", "condition": "Graded", "marketValue": 4500.00, "belowMarketPct": 8.9,
        "seller": { "username": "cardshop", "feedbackPercent": 99.8, "feedbackScore": 12400, "topRated": true },
        "imageUrl": "https://i.ebayimg.com/...", "url": "https://www.ebay.com/itm/..."
      }
    ],
    "usage": { "usedToday": 3, "limitPerDay": 100 }
  }
}
```

`status` is `ok`, `no-listings`, `parallel`, `no-price` or `budget`. Accounts without it get `403 LISTINGS_NOT_ENABLED`.

### Cert lookup (commercial plans)

`grader` is `psa`, `bgs`, `cgc` or `sgc`. One lookup a second per key; each plan has a monthly number.

```sh
curl -s "$HCI/certs/psa/12345678" -H "X-API-Key: $HCI_API_KEY"
```

```json
{
  "success": true,
  "data": {
    "cert": { "grader": "PSA", "certNumber": "12345678", "grade": "10", "player": "Mike Trout", "year": "2011", "cardNumber": "US175" },
    "card": { "id": 12345, "name": "Mike Trout #US175", "hciUrl": "https://hobbycardindex.com/cards/12345", "prices": { "loose": 293.00, "psa10": 4500.00, "psa9": 1250.00 } },
    "slab": {
      "grader": "PSA", "grade": 10, "autoGrade": null, "certNumber": "12345678", "certVerified": true, "priceAtGrade": 4500.00,
      "verifyUrl": "https://www.psacard.com/cert/12345678", "frontImageUrl": "https://hobbycardindex.com/api/v1/images/proxy?i=...", "backImageUrl": null
    }
  }
}
```

### Scan a photo (commercial plans)

`image` is the photo as base64 (JPEG, PNG or WebP under 10 MB; a `data:` prefix is fine). Optional `category` narrows the match; optional `slab` (`true` or `false`) says whether it is a graded slab.

```sh
IMG=$(base64 -w0 card.jpg)
curl -s "$HCI/scan" -H "X-API-Key: $HCI_API_KEY" -H 'Content-Type: application/json' \
  -d "{\"image\":\"$IMG\",\"mimeType\":\"image/jpeg\",\"category\":\"baseball\"}"
```

```json
{
  "success": true,
  "data": {
    "match": {
      "id": 12345, "externalId": "67890", "name": "Mike Trout #US175", "playerName": "Mike Trout", "year": 2011, "setName": "Topps Update",
      "cardNumber": "US175", "printRun": null, "parallel": "Base", "category": "baseball",
      "imageUrl": "https://hobbycardindex.com/api/v1/images/proxy?i=...", "confidence": 0.972,
      "prices": { "loose": 293.00, "psa10": 4500.00, "psa9": 1250.00, "psa8": 610.00, "psa7": null, "bgs10": 2900.00, "cgc10": null, "sgc10": 3100.00, "volume": 1400, "updated": "2026-10-31T09:12:44.000Z" }
    },
    "alternatives": [
      { "id": 12346, "externalId": "67891", "name": "Mike Trout [Gold] #US175", "playerName": "Mike Trout", "year": 2011, "setName": "Topps Update", "cardNumber": "US175", "printRun": 2011, "parallel": "Gold", "category": "baseball", "imageUrl": "https://hobbycardindex.com/api/v1/images/proxy?i=...", "confidence": 0.911 }
    ],
    "engine": "image",
    "slab": null,
    "scanId": 88123,
    "usage": { "scans": { "used": 12, "allowance": 25000 } }
  }
}
```

`match` is `null` when nothing is close enough; `alternatives` holds up to 7 more cards. On a graded card `slab` carries `grader`, `grade`, `certNumber`, `certVerified`, `priceAtGrade` and `verifyUrl`. Errors: `400 NO_IMAGE` or `INVALID_IMAGE`, `413 IMAGE_TOO_LARGE`, `403 REQUIRES_PARTNER_PLAN`, `429 SCAN_ENGINE_BUSY` (wait the `Retry-After` seconds), `503 SCAN_ENGINE_UNAVAILABLE`.

## Market and account

### Market movers

```sh
curl -s "$HCI/market/movers?category=baseball&period=7" -H "X-API-Key: $HCI_API_KEY"
```

```json
{
  "success": true,
  "data": {
    "movers": [
      {
        "id": 54321, "externalId": "11223", "name": "Ken Griffey Jr #1", "playerName": "Ken Griffey Jr", "year": 1989, "setName": "Upper Deck", "cardNumber": "1",
        "parallel": "Base", "category": "baseball", "imageUrl": "https://hobbycardindex.com/api/v1/images/proxy?i=...",
        "direction": "up", "priceChangePct": 12.5, "price": 95.00, "averagePrice": 90.00,
        "prices": { "loose": 95.00, "psa10": 2300.00, "psa9": 310.00 }, "hciUrl": "https://hobbycardindex.com/cards/54321"
      }
    ],
    "category": "baseball",
    "period": "7 days",
    "updatedAt": "2026-11-01T12:09:57.982Z"
  }
}
```

### Categories

```sh
curl -s "$HCI/market/categories" -H "X-API-Key: $HCI_API_KEY"
```

```json
{
  "success": true,
  "data": {
    "categories": [ { "category": "baseball", "cardCount": 2100000, "averagePriceLoose": 45.50, "averagePricePsa10": 320.75, "lastSaleAt": "2026-11-01T14:32:00.000Z" } ],
    "total": 27
  }
}
```

### Usage

```sh
curl -s "$HCI/usage" -H "X-API-Key: $HCI_API_KEY"
```

```json
{
  "success": true,
  "data": {
    "plan": "lite", "label": "Lite", "month": "2026-11",
    "requests": { "used": 1842, "allowance": 25000 },
    "scans": { "used": 12, "allowance": 25000 },
    "saleLookups": { "used": 40, "allowance": 5000 },
    "certLookups": { "used": 3, "allowance": 150 },
    "features": { "soldSales": true, "certLookups": true, "priceHistory": true, "population": false, "bulkFiles": false },
    "perSecond": { "lookups": 10, "scans": 2, "certs": 1 },
    "overage": { "usdPer1000": 4, "price": "$1 per 250 extra calls", "stopsAt": "3x allowance", "billed": "charged to your card early next month" },
    "trialEndsAt": null,
    "bulkFiles": false
  }
}
```

An Enterprise key answers `{ "plan": "self-serve", "rateLimitPerSecond": 1, "dailyCeiling": 100000 }`.

### Your collection

```sh
curl -s "$HCI/collection" -H "X-API-Key: $HCI_API_KEY"
```

```json
{
  "success": true,
  "data": {
    "items": [
      { "id": 1, "cardId": 12345, "name": "Mike Trout #US175", "year": 2011, "setName": "Topps Update", "category": "baseball", "playerName": "Mike Trout",
        "imageUrl": "https://hobbycardindex.com/api/v1/images/proxy?i=...", "grade": "PSA 9", "quantity": 1, "purchasePrice": 1200.00, "purchaseDate": "2025-06-15", "notes": null, "addedAt": "2025-06-15T10:30:00.000Z" }
    ],
    "total": 1
  }
}
```

### Collection as CSV

```sh
curl -s "$HCI/export/csv?category=baseball" -H "X-API-Key: $HCI_API_KEY" -o collection.csv
```

```text
id,console-name,product-name,loose-price,cib-price,new-price,graded-price,box-only-price,manual-only-price
67890,Topps Update,Mike Trout #US175,293.00,,,4500.00,,
```

## Bulk price files (Platform, or the price files add-on)

### Manifest

```sh
curl -s "$HCI/bulk/prices" -H "X-API-Key: $HCI_API_KEY"
```

```json
{
  "success": true,
  "data": {
    "generatedAt": "2026-11-01T06:10:02.000Z",
    "totalRows": 16400000,
    "partSize": 500000,
    "categories": [
      { "category": "baseball", "slug": "baseball", "rows": 2050000, "parts": [ { "part": 1, "rows": 500000, "bytes": 18400000, "filename": "prices-baseball-1.csv.gz" } ] }
    ]
  }
}
```

### One category file

`?part=N` picks a part (default 1); `?format=gz` streams the gzipped file instead of plain CSV.

```sh
curl -s "$HCI/bulk/prices/baseball?part=1&format=gz" -H "X-API-Key: $HCI_API_KEY" -o prices-baseball-1.csv.gz
```

## Watch list and daily price webhook (commercial plans)

### Add cards, a whole set, or a whole category

```sh
curl -s "$HCI/watchlist" -H "X-API-Key: $HCI_API_KEY" -H 'Content-Type: application/json' -d '{"cardIds":[12345,54321]}'
curl -s "$HCI/watchlist" -H "X-API-Key: $HCI_API_KEY" -H 'Content-Type: application/json' -d '{"category":"pokemon","set":"pokemon-scarlet-violet-151","language":"english"}'
```

The answer says how many cards were added, how many were already on the list, any ids not found, and the new total.

```json
{ "success": true, "data": { "added": 2, "alreadyWatched": 0, "notFound": [], "total": 2, "limit": 5000 } }
```

### List the watched cards

```sh
curl -s "$HCI/watchlist?limit=1000&offset=0" -H "X-API-Key: $HCI_API_KEY"
```

```json
{ "success": true, "data": { "cards": [ { "id": 12345, "name": "Mike Trout #US175", "setName": "Topps Update", "cardNumber": "US175", "category": "baseball" } ], "following": [ { "category": "pokemon", "set": "pokemon-scarlet-violet-151", "language": "english" } ], "total": 411, "limit": 1000, "offset": 0, "watchLimit": 5000 } }
```

### Remove cards, a followed set, or everything

```sh
curl -s "$HCI/watchlist/remove" -H "X-API-Key: $HCI_API_KEY" -H 'Content-Type: application/json' -d '{"cardIds":[54321]}'
curl -s "$HCI/watchlist/remove" -H "X-API-Key: $HCI_API_KEY" -H 'Content-Type: application/json' -d '{"all":true}'
```

### Every watched card's current prices (one download a minute)

```sh
curl -s "$HCI/watchlist/prices" -H "X-API-Key: $HCI_API_KEY"
curl -s "$HCI/watchlist/prices?format=csv" -H "X-API-Key: $HCI_API_KEY" -o watchlist-prices.csv
```

```json
{
  "success": true,
  "data": {
    "generatedAt": "2026-11-01T18:20:03.000Z",
    "cards": [
      { "id": 12345, "externalId": "67890", "name": "Mike Trout #US175", "setName": "Topps Update", "cardNumber": "US175", "category": "baseball", "year": 2011,
        "prices": { "loose": 293.00, "psa10": 4500.00, "psa9": 1250.00, "psa8": 610.00, "psa7": null, "bgs10": 2900.00, "cgc10": null, "sgc10": 3100.00, "volume": 1400, "updated": "2026-10-31T09:12:44.000Z" },
        "lastSale": { "price": 2500.00, "soldAt": "2026-10-28T17:04:00.000Z", "grade": "PSA 10" }, "sales90d": 14,
        "lastSale_PSA10": { "price": 2500.00, "soldAt": "2026-10-28T17:04:00.000Z", "url": "https://www.ebay.com/itm/..." }, "lastSale_Raw": null }
    ],
    "count": 1
  }
}
```

### Set the daily webhook

`url` is an https address on your server; `hour` is the UTC hour (0 to 23). The signing `secret` is returned only when first set, or with `"rotateSecret": true`.

```sh
curl -s -X PUT "$HCI/webhook" -H "X-API-Key: $HCI_API_KEY" -H 'Content-Type: application/json' \
  -d '{"url":"https://your-server.example/hci-prices","hour":14}'
```

```json
{ "success": true, "data": { "webhook": { "url": "https://your-server.example/hci-prices", "hour": 14, "secret": "whsec_...", "active": true, "lastDelivery": null } } }
```

Deliveries are a POST with `HCI-Event-Type: prices.changed` (or `cards.added`) and `HCI-Signature: t=<unix time>,v1=<hex>`, where the hex is the HMAC-SHA256 of `<t>.<raw body>` with your secret. The body lists every watched card whose price changed, with the previous and new price per grade.

### Check, test, or stop the webhook

```sh
curl -s "$HCI/webhook" -H "X-API-Key: $HCI_API_KEY"
curl -s -X POST "$HCI/webhook/test" -H "X-API-Key: $HCI_API_KEY"
curl -s -X DELETE "$HCI/webhook" -H "X-API-Key: $HCI_API_KEY"
```

```json
{ "success": true, "data": { "webhook": { "url": "https://your-server.example/hci-prices", "hour": 14, "active": true, "lastDelivery": { "at": "2026-11-01T14:00:12.000Z", "status": 200, "cards": 37 } }, "watched": 411, "watchLimit": 5000 } }
```

## Errors and limits

```json
{ "success": false, "error": { "code": "RATE_LIMITED", "message": "Rate limit: 1 request per second per key. Please slow down and retry." } }
```

| Code | Status | Meaning |
|---|---|---|
| `MISSING_API_KEY`, `INVALID_API_KEY`, `KEY_REVOKED` | 401 | No key, a malformed or unknown key, or a revoked one |
| `PLAN_REQUIRED` | 403 | The account's plan has ended |
| `REQUIRES_COMMERCIAL_LICENSE`, `REQUIRES_PARTNER_PLAN`, `REQUIRES_GROWTH` | 403 | The endpoint needs a commercial plan (sales, scan, history, certs, watch list) |
| `VALIDATION_ERROR` | 400 | A missing or invalid parameter |
| `NOT_FOUND` | 404 | No card with that id |
| `RATE_LIMITED` | 429 | Over the per-second limit; wait and retry |
| `MONTHLY_LIMIT_REACHED`, `DAILY_LIMIT_REACHED`, `SALES_LIMIT_REACHED`, `CERT_LIMIT_REACHED`, `POP_LIMIT_REACHED` | 429 | A plan allowance is used up; `details` carries the limit and the plans page |
| `SERVER_ERROR` | 500 or 503 | Try again later |

A 429 or a 503 that knows when to retry carries a `Retry-After` header in seconds.
