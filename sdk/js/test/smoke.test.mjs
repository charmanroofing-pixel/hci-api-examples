// Smoke tests with a mocked fetch. No network. Run: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { HobbyCardIndex, HobbyCardIndexError, CREDIT_HTML } from '../src/index.js';

const KEY = 'hci_live_test_key_0000';

/** A fetch stub that records the call and answers with the given body, status and headers. */
function fakeFetch({ status = 200, body = {}, headers = {} } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return new Response(text, {
      status,
      headers: { 'content-type': typeof body === 'string' ? 'text/csv' : 'application/json', ...headers },
    });
  };
  fn.calls = calls;
  return fn;
}

test('constructor needs an API key', () => {
  assert.throws(() => new HobbyCardIndex({}), TypeError);
});

test('sends the X-API-Key header, builds the URL, and returns data from the envelope', async () => {
  const fetch = fakeFetch({ body: { success: true, data: { results: [{ id: 12345, name: 'Mike Trout #US175' }], count: 1 } } });
  const hci = new HobbyCardIndex({ apiKey: KEY, fetch });
  const out = await hci.searchCards({ q: 'Mike Trout 2011', category: 'baseball', limit: 5, minPrice: 10 });
  assert.equal(out.count, 1);
  assert.equal(out.results[0].id, 12345);
  const { url, init } = fetch.calls[0];
  assert.equal(init.method, 'GET');
  assert.equal(init.headers['X-API-Key'], KEY);
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, 'https://hobbycardindex.com/api/v1/prices/search');
  assert.equal(u.searchParams.get('q'), 'Mike Trout 2011');
  assert.equal(u.searchParams.get('category'), 'baseball');
  assert.equal(u.searchParams.get('limit'), '5');
  assert.equal(u.searchParams.get('min_price'), '10');
  assert.equal(u.searchParams.has('minPrice'), false);
});

test('maps the error envelope to HobbyCardIndexError with status, code, message and details', async () => {
  const fetch = fakeFetch({
    status: 403,
    body: { success: false, error: { code: 'REQUIRES_COMMERCIAL_LICENSE', message: 'Individual sold-sale records need a Commercial plan.', details: { plans_url: 'https://hobbycardindex.com/developers' } } },
  });
  const hci = new HobbyCardIndex({ apiKey: KEY, fetch });
  await assert.rejects(hci.getSales(12345, { days: 30 }), (err) => {
    assert.ok(err instanceof HobbyCardIndexError);
    assert.equal(err.status, 403);
    assert.equal(err.code, 'REQUIRES_COMMERCIAL_LICENSE');
    assert.match(err.message, /Commercial plan/);
    assert.equal(err.details.plans_url, 'https://hobbycardindex.com/developers');
    assert.equal(err.retryAfter, null);
    return true;
  });
  assert.equal(new URL(fetch.calls[0].url).searchParams.get('days'), '30');
});

test('a 404 with the shortcut envelope maps to NOT_FOUND', async () => {
  const fetch = fakeFetch({ status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'Card not found' } } });
  const hci = new HobbyCardIndex({ apiKey: KEY, fetch });
  await assert.rejects(hci.getPrices('999999999'), { code: 'NOT_FOUND', status: 404 });
});

test('429 exposes Retry-After, including the rate limiter body with no success field', async () => {
  const fetch = fakeFetch({
    status: 429,
    body: { error: { code: 'RATE_LIMITED', message: 'Rate limit: 1 request per second per key. Please slow down and retry.' } },
    headers: { 'retry-after': '7' },
  });
  const hci = new HobbyCardIndex({ apiKey: KEY, fetch });
  await assert.rejects(hci.getUsage(), (err) => {
    assert.equal(err.status, 429);
    assert.equal(err.code, 'RATE_LIMITED');
    assert.equal(err.retryAfter, 7);
    return true;
  });
});

test('captures attribution from the body and the X-Attribution header', async () => {
  const attribution = { text: 'Prices from Hobby Card Index', url: 'https://hobbycardindex.com' };
  const fetch = fakeFetch({
    body: { success: true, data: { card: { id: 1 }, prices: { loose: 12.5 } }, attribution },
    headers: { 'x-attribution': 'Prices from Hobby Card Index <https://hobbycardindex.com>' },
  });
  const hci = new HobbyCardIndex({ apiKey: KEY, fetch });
  assert.equal(hci.lastAttribution, null);
  const out = await hci.getPrices(1);
  assert.equal(out.prices.loose, 12.5);
  assert.equal(hci.lastAttribution.text, attribution.text);
  assert.equal(hci.lastAttribution.url, attribution.url);
  assert.equal(hci.lastAttribution.header, 'Prices from Hobby Card Index <https://hobbycardindex.com>');
  assert.match(CREDIT_HTML, /href="https:\/\/hobbycardindex\.com"/);
});

test('attribution inside data is picked up too', async () => {
  const fetch = fakeFetch({ body: { success: true, data: { results: [], count: 0, attribution: { text: 'Prices from Hobby Card Index' } } } });
  const hci = new HobbyCardIndex({ apiKey: KEY, fetch });
  await hci.searchCards('Charizard');
  assert.equal(hci.lastAttribution.text, 'Prices from Hobby Card Index');
  assert.equal(hci.lastAttribution.header, null);
});

test('scanCard posts JSON with a base64 image and the options the route takes', async () => {
  const fetch = fakeFetch({ body: { success: true, data: { match: null, alternatives: [], engine: 'image', slab: null } } });
  const hci = new HobbyCardIndex({ apiKey: KEY, fetch });
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const out = await hci.scanCard(bytes, { category: 'pokemon', slab: false, mimeType: 'image/jpeg' });
  assert.equal(out.engine, 'image');
  const { url, init } = fetch.calls[0];
  assert.equal(url, 'https://hobbycardindex.com/api/v1/scan');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['Content-Type'], 'application/json');
  const sent = JSON.parse(init.body);
  assert.equal(sent.image, bytes.toString('base64'));
  assert.equal(sent.category, 'pokemon');
  assert.equal(sent.slab, false);
  assert.equal(sent.mimeType, 'image/jpeg');
});

test('scanCard passes a base64 string through untouched', async () => {
  const fetch = fakeFetch({ body: { success: true, data: { match: null, alternatives: [], engine: 'image', slab: null } } });
  const hci = new HobbyCardIndex({ apiKey: KEY, fetch });
  await hci.scanCard('data:image/png;base64,iVBORw0KGgo=');
  assert.equal(JSON.parse(fetch.calls[0].init.body).image, 'data:image/png;base64,iVBORw0KGgo=');
});

test('CSV endpoints return the text body', async () => {
  const fetch = fakeFetch({ body: 'id,name\n1,Card\n' });
  const hci = new HobbyCardIndex({ apiKey: KEY, fetch });
  const csv = await hci.getWatchlistPrices({ format: 'csv' });
  assert.equal(csv, 'id,name\n1,Card\n');
  assert.equal(new URL(fetch.calls[0].url).searchParams.get('format'), 'csv');
});

test('lookupCert lower-cases the grader and encodes the path', async () => {
  const fetch = fakeFetch({ body: { success: true, data: { cert: {}, card: null, slab: null } } });
  const hci = new HobbyCardIndex({ apiKey: KEY, fetch });
  await hci.lookupCert('PSA', '12345678');
  assert.equal(fetch.calls[0].url, 'https://hobbycardindex.com/api/v1/certs/psa/12345678');
});

test('a network failure becomes a HobbyCardIndexError with status 0', async () => {
  const fetch = async () => { throw new Error('socket hang up'); };
  const hci = new HobbyCardIndex({ apiKey: KEY, fetch });
  await assert.rejects(hci.getCategories(), { status: 0, code: 'NETWORK_ERROR' });
});

test('a timeout aborts the request', async () => {
  const fetch = (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
  });
  const hci = new HobbyCardIndex({ apiKey: KEY, fetch, timeoutMs: 20 });
  await assert.rejects(hci.getCategories(), { status: 0, code: 'TIMEOUT' });
});
