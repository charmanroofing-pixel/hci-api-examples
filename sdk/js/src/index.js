// hobbycardindex: a small client for the HobbyCardIndex Data API.
// Node 18 or newer (global fetch). No dependencies.
// Docs: https://hobbycardindex.com/developers   Keys: same page (free setup month by application).

export const DEFAULT_BASE_URL = 'https://hobbycardindex.com/api/v1';

/** The credit the Terms ask for wherever the data is shown. */
export const CREDIT_HTML = '<a href="https://hobbycardindex.com">Prices from Hobby Card Index</a>';

/** Thrown for every non-2xx answer, a timeout, or a network failure. */
export class HobbyCardIndexError extends Error {
  constructor({ status, code, message, details = null, retryAfter = null, body = null }) {
    super(message);
    this.name = 'HobbyCardIndexError';
    this.status = status;         // HTTP status, 0 for a timeout or network failure
    this.code = code;             // the API's error code, for example RATE_LIMITED
    this.details = details;       // the API's error.details when it sent any
    this.retryAfter = retryAfter; // seconds to wait, from the Retry-After header (429, 503)
    this.body = body;             // the raw error body
  }
}

/** Seconds from a Retry-After header (a number or an HTTP date), or null. */
function parseRetryAfter(value) {
  if (!value) return null;
  const n = Number(value);
  if (Number.isFinite(n)) return Math.max(0, n);
  const t = Date.parse(value);
  return Number.isFinite(t) ? Math.max(0, Math.ceil((t - Date.now()) / 1000)) : null;
}

/** ?a=1&b=2 from an object, skipping null, undefined and empty values. */
function queryString(params) {
  if (!params) return '';
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** Base64 for POST /scan from a base64 string (data: prefix allowed), Buffer, Uint8Array, ArrayBuffer or Blob. */
async function toBase64(image) {
  if (typeof image === 'string') return image;
  let bytes = image;
  if (typeof Blob !== 'undefined' && image instanceof Blob) bytes = new Uint8Array(await image.arrayBuffer());
  else if (image instanceof ArrayBuffer) bytes = new Uint8Array(image);
  if (!(bytes instanceof Uint8Array)) throw new TypeError('image must be a base64 string, Buffer, Uint8Array, ArrayBuffer or Blob');
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// camelCase spellings accepted by searchCards, mapped to the query names the API takes.
const SEARCH_ALIASES = { addedSince: 'added_since', minPrice: 'min_price', maxPrice: 'max_price' };

export class HobbyCardIndex {
  /**
   * @param {object} options
   * @param {string} options.apiKey      your key (starts with hci_live_)
   * @param {string} [options.baseUrl]   defaults to https://hobbycardindex.com/api/v1
   * @param {Function} [options.fetch]   a fetch implementation (defaults to the global one)
   * @param {number} [options.timeoutMs] per-request timeout, default 30000
   */
  constructor({ apiKey, baseUrl = DEFAULT_BASE_URL, fetch = globalThis.fetch, timeoutMs = 30000 } = {}) {
    if (!apiKey || typeof apiKey !== 'string') throw new TypeError('apiKey is required (it starts with hci_live_)');
    if (typeof fetch !== 'function') throw new TypeError('No fetch available: pass one in options.fetch');
    this.apiKey = apiKey;
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.fetchImpl = fetch;
    this.timeoutMs = timeoutMs;
    /** The attribution from the most recent response: the body's attribution object plus the X-Attribution header. */
    this.lastAttribution = null;
  }

  /**
   * One HTTP call. Returns the envelope's `data` for JSON answers (the whole
   * body when there is no success/data envelope, the text for CSV), or the
   * Response itself when raw is true.
   */
  async request(method, path, { query, body, raw = false } = {}) {
    const url = `${this.baseUrl}${path}${queryString(query)}`;
    const headers = { 'X-API-Key': this.apiKey, Accept: raw ? '*/*' : 'application/json' };
    const init = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
    if (controller) init.signal = controller.signal;
    let res;
    try {
      res = await this.fetchImpl(url, init);
    } catch (err) {
      const timedOut = err?.name === 'AbortError';
      throw new HobbyCardIndexError({
        status: 0,
        code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: timedOut ? `Request timed out after ${this.timeoutMs} ms` : (err?.message || 'Network error'),
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
    const headerCredit = res.headers?.get?.('x-attribution') || null;
    if (!res.ok) throw await this.toError(res);
    if (raw) {
      if (headerCredit) this.lastAttribution = { header: headerCredit };
      return res;
    }
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (json === null && text) return text; // a CSV or other non-JSON body
    const bodyCredit = json?.attribution ?? json?.data?.attribution ?? null;
    if (bodyCredit || headerCredit) this.lastAttribution = { ...(bodyCredit || {}), header: headerCredit };
    return json && typeof json === 'object' && json.success === true && 'data' in json ? json.data : json;
  }

  /** Map a non-2xx Response to a HobbyCardIndexError using the API's error envelope. */
  async toError(res) {
    let body = null;
    let text = '';
    try { text = await res.text(); body = text ? JSON.parse(text) : null; } catch { body = null; }
    const e = body?.error && typeof body.error === 'object' ? body.error : null;
    return new HobbyCardIndexError({
      status: res.status,
      code: e?.code || `HTTP_${res.status}`,
      message: e?.message || (text && !body ? text.slice(0, 200) : res.statusText) || `HTTP ${res.status}`,
      details: e?.details ?? null,
      retryAfter: parseRetryAfter(res.headers?.get?.('retry-after')),
      body: body ?? (text || null),
    });
  }

  // Catalog and prices (every plan)

  /** GET /prices/search. A string is a plain q search; an object takes q plus the filters (category, set, language, year, added_since, min_price, max_price, sort, limit, offset). */
  searchCards(params) {
    const p = typeof params === 'string' ? { q: params } : { ...(params || {}) };
    for (const [from, to] of Object.entries(SEARCH_ALIASES)) if (from in p) { p[to] = p[from]; delete p[from]; }
    return this.request('GET', '/prices/search', { query: p });
  }

  /** GET /sets?category=...: the sets in a category with the ids that search and the watch list take. */
  listSets(category, { language, q, limit, offset } = {}) {
    return this.request('GET', '/sets', { query: { category, language, q, limit, offset } });
  }

  /** GET /prices/:cardId: the card and its prices at every grade. cardId is the id from search or scan, or ext-<externalId>. */
  getPrices(cardId) {
    return this.request('GET', `/prices/${encodeURIComponent(cardId)}`);
  }

  /** Same endpoint as getPrices, for readers who think of it as the card. */
  getCard(cardId) { return this.getPrices(cardId); }

  /** GET /prices/:cardId/sales?days=90: verified sold sales, newest first, with a summary. Commercial plans. */
  getSales(cardId, { days } = {}) {
    return this.request('GET', `/prices/${encodeURIComponent(cardId)}/sales`, { query: { days } });
  }

  /** GET /prices/:cardId/history?days=365: the daily price at every grade. Commercial plans. */
  getPriceHistory(cardId, { days } = {}) {
    return this.request('GET', `/prices/${encodeURIComponent(cardId)}/history`, { query: { days } });
  }

  /** GET /prices/:cardId/population: graded counts by grader. Platform, or the pop + cert add-on. */
  getPopulation(cardId) {
    return this.request('GET', `/prices/${encodeURIComponent(cardId)}/population`);
  }

  /** GET /prices/:cardId/listings: active listings for one card. Enabled per account; ask sean@hobbycardindex.com. */
  getListings(cardId, { limit, grade, minFeedbackPercent, minFeedbackScore } = {}) {
    return this.request('GET', `/prices/${encodeURIComponent(cardId)}/listings`, { query: { limit, grade, minFeedbackPercent, minFeedbackScore } });
  }

  /** GET /certs/:grader/:certNumber: a PSA, BGS, CGC or SGC cert as the card, grade and price at that grade. */
  lookupCert(grader, certNumber) {
    return this.request('GET', `/certs/${encodeURIComponent(String(grader).toLowerCase())}/${encodeURIComponent(certNumber)}`);
  }

  /** POST /scan: identify a card from a photo. image: base64 string, Buffer, Uint8Array, ArrayBuffer or Blob (JPEG, PNG or WebP under 10 MB). */
  async scanCard(image, { mimeType, category, slab } = {}) {
    const body = { image: await toBase64(image) };
    if (mimeType) body.mimeType = mimeType;
    if (category) body.category = category;
    if (typeof slab === 'boolean') body.slab = slab;
    return this.request('POST', '/scan', { body });
  }

  // Market and account

  /** GET /market/movers?category=baseball&period=7: the biggest risers and fallers in a category. */
  getMarketMovers({ category, period } = {}) {
    return this.request('GET', '/market/movers', { query: { category, period } });
  }

  /** GET /market/categories: every category with card counts and average prices. */
  getCategories() { return this.request('GET', '/market/categories'); }

  /** GET /usage: this key's plan, limits and month-to-date usage. */
  getUsage() { return this.request('GET', '/usage'); }

  /** GET /collection: the account's own collection. */
  getCollection() { return this.request('GET', '/collection'); }

  /** GET /export/csv?category=: the account's collection as CSV text. */
  exportCollectionCsv({ category } = {}) {
    return this.request('GET', '/export/csv', { query: { category } });
  }

  // Bulk price files (Platform, or the price files add-on)

  /** GET /bulk/prices: the categories available as daily files and when each was built. */
  listBulkFiles() { return this.request('GET', '/bulk/prices'); }

  /** GET /bulk/prices/:category?part=1&format=gz: returns the fetch Response so the file can be streamed (CSV, or gzip with format 'gz'). */
  downloadBulkFile(category, { part, format } = {}) {
    return this.request('GET', `/bulk/prices/${encodeURIComponent(category)}`, { query: { part, format }, raw: true });
  }

  // Watch list and daily price webhook (commercial plans)

  /** GET /watchlist?limit=&offset=: the watched cards and the sets being followed. */
  getWatchlist({ limit, offset } = {}) {
    return this.request('GET', '/watchlist', { query: { limit, offset } });
  }

  /** POST /watchlist with { cardIds } (up to 1,000 a call), { category, set, language } for a whole set, or { category, language } for a whole category. */
  addToWatchlist(body) { return this.request('POST', '/watchlist', { body }); }

  /** POST /watchlist/remove with { cardIds }, { category, set, language } or { all: true }. */
  removeFromWatchlist(body) { return this.request('POST', '/watchlist/remove', { body }); }

  /** GET /watchlist/prices: current prices for every watched card (JSON, or CSV text with format 'csv'). One download a minute. */
  getWatchlistPrices({ format } = {}) {
    return this.request('GET', '/watchlist/prices', { query: { format } });
  }

  /** GET /webhook: the endpoint, its hour (UTC) and last delivery. */
  getWebhook() { return this.request('GET', '/webhook'); }

  /** PUT /webhook { url, hour, rotateSecret }: set the daily price webhook. The signing secret is returned once. */
  setWebhook({ url, hour, rotateSecret } = {}) {
    const body = { url };
    if (hour !== undefined) body.hour = hour;
    if (rotateSecret) body.rotateSecret = true;
    return this.request('PUT', '/webhook', { body });
  }

  /** DELETE /webhook: stop deliveries (the watch list stays). */
  deleteWebhook() { return this.request('DELETE', '/webhook'); }

  /** POST /webhook/test: send a signed ping to the endpoint now. */
  testWebhook() { return this.request('POST', '/webhook/test', { body: {} }); }
}

export default HobbyCardIndex;
