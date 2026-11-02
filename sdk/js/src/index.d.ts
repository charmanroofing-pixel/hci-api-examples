// Type definitions for hobbycardindex 0.1.0
// Payloads marked Record<string, unknown> are shapes we have not pinned down
// in this release (cert, webhook and watch-list bodies vary by plan and are
// documented at https://hobbycardindex.com/developers). The fields we do know
// are typed; anything else on the object is still there, just untyped.

export const DEFAULT_BASE_URL: string;
/** The credit the Terms ask for wherever the data is shown. */
export const CREDIT_HTML: string;

export interface ClientOptions {
  /** Your API key (starts with hci_live_). */
  apiKey: string;
  /** Defaults to https://hobbycardindex.com/api/v1 */
  baseUrl?: string;
  /** A fetch implementation; defaults to globalThis.fetch (Node 18+). */
  fetch?: typeof fetch;
  /** Per-request timeout in milliseconds, default 30000. */
  timeoutMs?: number;
}

/** The attribution carried by every response: the body's attribution object plus the X-Attribution header. */
export type Attribution = Record<string, unknown> & { header?: string | null };

export class HobbyCardIndexError extends Error {
  name: 'HobbyCardIndexError';
  /** HTTP status; 0 for a timeout or network failure. */
  status: number;
  /** The API's error code (MISSING_API_KEY, RATE_LIMITED, NOT_FOUND, REQUIRES_COMMERCIAL_LICENSE, ...), or HTTP_<status>, TIMEOUT, NETWORK_ERROR. */
  code: string;
  /** The API's error.details when it sent any (limits, plan names, plans_url). */
  details: Record<string, unknown> | null;
  /** Seconds to wait, from the Retry-After header on 429 and 503 answers. */
  retryAfter: number | null;
  /** The raw error body. */
  body: unknown;
}

/** Prices in US dollars at each grade. A grade with no price is null. bgs10 holds the BGS 9.5 price. */
export interface GradePrices {
  loose: number | null;
  psa10: number | null;
  psa9: number | null;
  psa8: number | null;
  psa7: number | null;
  bgs10: number | null;
  cgc10: number | null;
  sgc10: number | null;
  volume: number | null;
  updated?: string | null;
  /** Grades priced from our own sold sales when there is no other price. */
  fromSales?: string[];
}

export interface CardSummary {
  id: number;
  externalId: string | null;
  name: string;
  year: number | string | null;
  setName: string | null;
  cardNumber?: string | null;
  printRun?: number | null;
  category: string | null;
  playerName: string | null;
  imageUrl?: string | null;
  hciUrl?: string;
}

export interface SearchResult extends CardSummary {
  setId: string | null;
  addedAt: string | null;
  prices: GradePrices | null;
}

export interface SearchParams {
  /** 2 to 200 characters. Required unless set or added_since is given. */
  q?: string;
  category?: string;
  /** A set id from listSets; needs category. */
  set?: string;
  language?: string;
  year?: number | string;
  /** A date (2026-10-01) or time (2026-10-01T12:00:00Z), UTC. */
  added_since?: string;
  addedSince?: string;
  min_price?: number;
  minPrice?: number;
  max_price?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc' | 'volume_desc' | 'name_asc' | 'added_asc' | 'added_desc';
  /** 1 to 100, default 25 (a plain q search returns the top 10). */
  limit?: number;
  offset?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  count: number;
  limit?: number;
  offset?: number;
  hasMore?: boolean;
}

export interface SetInfo {
  id: string;
  name: string;
  language: string | null;
  year: number | null;
  cards: number;
}

export interface SetsResponse {
  category: string;
  language: string | null;
  sets: SetInfo[];
  total: number;
  limit: number;
  offset: number;
}

export interface PricesResponse {
  card: CardSummary;
  prices: GradePrices | null;
}

export interface Sale {
  soldAt: string | null;
  price: number;
  grade: string | null;
  gradingCompany: string | null;
  title: string | null;
  auction: boolean;
  saleType: 'auction' | 'buy_it_now' | 'best_offer' | null;
  askingPrice: number | null;
  bids: number | null;
  source: string;
  url: string | null;
  imageUrl: string | null;
}

export interface SalesResponse {
  card: CardSummary;
  periodDays: number;
  summary: { count: number; average: number | null; low: number | null; high: number | null };
  sales: Sale[];
}

export interface HistoryPoint extends Omit<GradePrices, 'updated' | 'fromSales'> {
  date: string;
}

export interface HistoryResponse {
  card: CardSummary;
  days: number;
  history: HistoryPoint[];
  count: number;
}

export interface PopulationResponse {
  card: CardSummary;
  /** null when we hold no report for the card yet. Grader keys are PSA, BGS, SGC, CGC. */
  population: {
    totalPopulation: number | null;
    totalGems: number | null;
    asOf: string | null;
    lastChange: unknown;
    graders: Record<string, Record<string, unknown>>;
  } | null;
}

export interface Listing {
  itemId: string | null;
  title: string;
  price: number;
  shipping: number | null;
  total: number | null;
  currency: 'USD';
  grade: string;
  condition: string | null;
  marketValue: number | null;
  belowMarketPct: number | null;
  seller: { username: string | null; feedbackPercent: number | null; feedbackScore: number | null; topRated: boolean };
  imageUrl: string | null;
  url: string | null;
}

export interface ListingsResponse {
  card: CardSummary;
  status: 'ok' | 'no-listings' | 'parallel' | 'no-price' | 'budget' | string;
  checkedAt: string | null;
  count: number;
  listings: Listing[];
  usage: { usedToday: number; limitPerDay: number };
}

/** The slab block of a scan or cert answer. null on a raw card. */
export interface SlabInfo {
  grader: string | null;
  grade: number | 'Authentic' | null;
  autoGrade: string | null;
  certNumber: string | null;
  certVerified: boolean;
  priceAtGrade: number | null;
  verifyUrl: string | null;
  frontImageUrl: string | null;
  backImageUrl: string | null;
}

export interface ScanCard extends CardSummary {
  parallel: string;
  /** 0 to 1 */
  confidence: number | null;
}

export interface ScanResponse {
  /** The best card with its prices, or null when nothing was close enough. */
  match: (ScanCard & { prices: GradePrices | null }) | null;
  /** Up to 7 more cards, without prices. */
  alternatives: ScanCard[];
  engine: 'image' | 'vision' | 'cert' | string;
  slab: SlabInfo | null;
  scanId: string | number | null;
  usage: { scans: { used: number | null; allowance: number } };
}

export interface ScanOptions {
  /** image/jpeg (default), image/png or image/webp */
  mimeType?: string;
  /** Narrow the match: baseball, football, pokemon, ... */
  category?: string;
  /** true for a graded slab (full label read), false for a raw card; leave unset to let the scan decide. */
  slab?: boolean;
}

/** cert, card (with prices) and slab blocks; the exact cert record varies by grader. */
export interface CertResponse {
  cert: Record<string, unknown>;
  card: (CardSummary & { prices?: GradePrices | null }) | null;
  slab: SlabInfo | null;
  [key: string]: unknown;
}

export interface Mover extends CardSummary {
  parallel: string;
  direction: 'up' | 'down';
  priceChangePct: number;
  price: number | null;
  averagePrice: number | null;
  prices: { loose: number | null; psa10: number | null; psa9: number | null };
}

export interface MoversResponse {
  movers: Mover[];
  category: string;
  period: string;
  updatedAt: string | null;
}

export interface CategoryStat {
  category: string;
  cardCount: number;
  averagePriceLoose: number;
  averagePricePsa10: number;
  lastSaleAt: string | null;
}

export interface CategoriesResponse {
  categories: CategoryStat[];
  total: number;
}

/** Plan allowances and usage; the keys present depend on the plan (self-serve keys get plan, rateLimitPerSecond, dailyCeiling). */
export type UsageResponse = Record<string, unknown>;

export interface CollectionItem {
  id: number;
  cardId: number;
  name: string;
  year: number | string | null;
  setName: string | null;
  category: string | null;
  playerName: string | null;
  imageUrl: string | null;
  grade: string | null;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string | null;
  notes: string | null;
  addedAt: string | null;
}

export interface CollectionResponse {
  items: CollectionItem[];
  total: number;
}

/** The daily files manifest (generatedAt, categories with part counts); pending: true while the first build runs. */
export type BulkManifest = Record<string, unknown>;

export type WatchlistAddBody =
  | { cardIds: Array<number | string> }
  | { category: string; set: string; language?: string }
  | { category: string; language?: string };

export type WatchlistRemoveBody =
  | { cardIds: Array<number | string> }
  | { category: string; set?: string; language?: string }
  | { all: true };

/** Watched cards (cards), the sets being followed (following), total and watchLimit; see the developers page. */
export type WatchlistResponse = Record<string, unknown> & { watchLimit?: number };
/** Counts of what was added, what was already watched, ids not found, and the new total. */
export type WatchlistChangeResponse = Record<string, unknown>;
export interface WatchlistPricesResponse {
  generatedAt: string;
  cards: Array<Record<string, unknown>>;
  count: number;
}

export interface WebhookOptions {
  /** An https address on your server. */
  url: string;
  /** Hour of the day to deliver, UTC, 0 to 23. */
  hour?: number;
  /** Issue a new signing secret (shown once). */
  rotateSecret?: boolean;
}
/** webhook: { url, hour, secret (only when first set or rotated), lastDelivery, ... }. */
export type WebhookResponse = Record<string, unknown>;

export class HobbyCardIndex {
  constructor(options: ClientOptions);
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  /** The attribution from the most recent response, or null before the first call. */
  lastAttribution: Attribution | null;

  /** Low-level call. Returns the envelope's data, the text for CSV bodies, or the Response when raw is true. */
  request(method: string, path: string, options?: { query?: Record<string, unknown>; body?: unknown; raw?: false }): Promise<unknown>;
  request(method: string, path: string, options: { query?: Record<string, unknown>; body?: unknown; raw: true }): Promise<Response>;

  searchCards(params: string | SearchParams): Promise<SearchResponse>;
  listSets(category: string, options?: { language?: string; q?: string; limit?: number; offset?: number }): Promise<SetsResponse>;
  getPrices(cardId: number | string): Promise<PricesResponse>;
  getCard(cardId: number | string): Promise<PricesResponse>;
  getSales(cardId: number | string, options?: { days?: number }): Promise<SalesResponse>;
  getPriceHistory(cardId: number | string, options?: { days?: number }): Promise<HistoryResponse>;
  getPopulation(cardId: number | string): Promise<PopulationResponse>;
  getListings(cardId: number | string, options?: { limit?: number; grade?: string; minFeedbackPercent?: number; minFeedbackScore?: number }): Promise<ListingsResponse>;
  lookupCert(grader: 'psa' | 'bgs' | 'cgc' | 'sgc' | string, certNumber: string | number): Promise<CertResponse>;
  scanCard(image: string | Uint8Array | ArrayBuffer | Blob, options?: ScanOptions): Promise<ScanResponse>;

  getMarketMovers(options?: { category?: string; period?: number }): Promise<MoversResponse>;
  getCategories(): Promise<CategoriesResponse>;
  getUsage(): Promise<UsageResponse>;
  getCollection(): Promise<CollectionResponse>;
  exportCollectionCsv(options?: { category?: string }): Promise<string>;

  listBulkFiles(): Promise<BulkManifest>;
  downloadBulkFile(category: string, options?: { part?: number; format?: 'gz' }): Promise<Response>;

  getWatchlist(options?: { limit?: number; offset?: number }): Promise<WatchlistResponse>;
  addToWatchlist(body: WatchlistAddBody): Promise<WatchlistChangeResponse>;
  removeFromWatchlist(body: WatchlistRemoveBody): Promise<WatchlistChangeResponse>;
  getWatchlistPrices(options?: { format?: undefined }): Promise<WatchlistPricesResponse>;
  getWatchlistPrices(options: { format: 'csv' }): Promise<string>;

  getWebhook(): Promise<WebhookResponse>;
  setWebhook(options: WebhookOptions): Promise<WebhookResponse>;
  deleteWebhook(): Promise<Record<string, unknown>>;
  testWebhook(): Promise<Record<string, unknown>>;
}

export default HobbyCardIndex;
