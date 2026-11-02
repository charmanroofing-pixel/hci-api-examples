# HobbyCardIndex prices in Google Sheets

A custom function that pulls a card's price into a cell, using your API key from the `X-API-Key` header.

1. In your sheet, open Extensions, Apps Script.
2. Project Settings, Script Properties: add `HCI_API_KEY` with your key (so the key never sits in the sheet).
3. Paste this into `Code.gs` and save:

```js
function HCI_PRICE(cardId, grade) {
  const key = PropertiesService.getScriptProperties().getProperty('HCI_API_KEY');
  const url = 'https://hobbycardindex.com/api/v1/prices/' + encodeURIComponent(cardId);
  const res = UrlFetchApp.fetch(url, { headers: { 'X-API-Key': key }, muteHttpExceptions: true });
  const body = JSON.parse(res.getContentText());
  if (!body.success) throw new Error(body.error.code + ': ' + body.error.message);
  const prices = body.data.prices || {};
  const value = prices[grade || 'loose'];
  return value == null ? '' : value;
}
```

4. In a cell: `=HCI_PRICE(12345)` for the raw price, or `=HCI_PRICE(12345, "psa10")`. Grades: `loose`, `psa10`, `psa9`, `psa8`, `psa7`, `bgs10` (BGS 9.5), `cgc10`, `sgc10`. `cardId` is the `id` from a search or scan, or `ext-<externalId>`.

## Notes

- Keys are limited per second (1 on Enterprise, 10 to 50 on the commercial sizes). A sheet recalculates every cell at once, so a column of `HCI_PRICE` formulas will hit `RATE_LIMITED` on a 1-a-second key. For more than a handful of cards, use a menu function instead: loop the rows, call the API once a row with `Utilities.sleep(1100)` between calls, and write the values with `setValues`. Values written that way do not recalculate on every open.
- Wherever the prices are shown, the Terms need a visible "Prices from Hobby Card Index" link to https://hobbycardindex.com (a cell with `=HYPERLINK("https://hobbycardindex.com", "Prices from Hobby Card Index")` does it).
- Showing the data to customers or the public needs a Commercial plan; the Enterprise plan covers your own business's internal sheets. Plans and a free setup month by application: https://hobbycardindex.com/developers
