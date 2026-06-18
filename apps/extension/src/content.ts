import { detectPageSnapshot } from './detection';
import type {
  BackgroundMessage,
  DetectionMessage,
  ExtensionState,
  MarketplaceCategoryFeeSummary,
  PageSnapshot,
  ProductDetailSnapshot,
  SearchResultEnrichment,
  SearchResultPreview,
} from './types';

let lastUrl = window.location.href;
let lastSnapshot: PageSnapshot | null = null;
let lastKnownState: ExtensionState | null = null;
let mutationObserver: MutationObserver | null = null;
let refreshTimeoutId: number | null = null;
let searchEnrichmentTimeoutId: number | null = null;
let productDetailEnrichmentTimeoutId: number | null = null;
let isRoasCalculatorOpen = false;
let lastRoasProductDetail: ProductDetailSnapshot | null = null;
let visibleResultCount = 10;
let lastResultsSignature = '';
let isOverlayInteractionLocked = false;
let hasDeferredRefresh = false;
let searchEnrichmentRequestId = 0;
let productDetailEnrichmentRequestId = 0;
let searchEnrichmentDebugLabel = '';
let lastAppliedRoasDefaultsShopId: string | null = null;

const OVERLAY_ID = 'levelup-adspro-market-overlay';
const OVERLAY_STYLE_ID = 'levelup-adspro-market-overlay-style';
const INITIAL_VISIBLE_RESULTS = 10;
const LOAD_MORE_STEP = 10;
const LOAD_MORE_FETCH_ATTEMPTS = 6;
const SEARCH_ENRICHMENT_BATCH_SIZE = 3;
const ENABLE_PAGE_BRIDGE_ENRICHMENT = true;
const SEARCH_ENRICHMENT_START_DELAY_MS = 1800;
const PAGE_BRIDGE_SCRIPT_ID = 'levelup-adspro-page-bridge';
const PAGE_BRIDGE_REQUEST_EVENT = 'levelup-adspro:enrich-request';
const PAGE_BRIDGE_RESPONSE_EVENT = 'levelup-adspro:enrich-response';
const PAGE_BRIDGE_TIMEOUT_MS = 5000;
const HEADER_LOGO_URL = chrome.runtime.getURL('header-logo.png');
const resolvedSearchResultEnrichmentCache = new Map<string, SearchResultEnrichment>();
const pendingPageBridgeRequests = new Map<
  string,
  {
    resolve: (entries: SearchResultEnrichment[]) => void;
    reject: (error: Error) => void;
    timeoutId: number;
  }
>();
let pageBridgeRequestSequence = 0;
let pageBridgeLoadPromise: Promise<void> | null = null;

type BackgroundResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type PageBridgeResponseMessage = {
  requestId: string;
  entries: SearchResultEnrichment[];
  error?: string;
};

type RoasCalculatorState = {
  hpp: number | null;
  price: number | null;
  operasional: number | null;
  storeType: 'non_star' | 'star' | 'mall';
  promoXtraEnabled: boolean;
  gratisOngkirXtraEnabled: boolean;
  categoryLabel: string | null;
  kategoriFeePct: number | null;
};

type RoasCategorySelection = {
  primary: string;
  secondary: string | null;
  name: string | null;
};

const roasCalculatorState: RoasCalculatorState = {
  hpp: null,
  price: null,
  operasional: null,
  storeType: 'non_star',
  promoXtraEnabled: false,
  gratisOngkirXtraEnabled: false,
  categoryLabel: null,
  kategoriFeePct: 0,
};

let lastSelectedRoasCategory: RoasCategorySelection | null = null;

const SHOPEE_ORDER_PROCESSING_FEE_IDR = 1250;
const SHOPEE_PROMO_XTRA_FEE_PCT = 4.5;
const SHOPEE_PROMO_XTRA_FEE_CAP_IDR = 60000;
const SHOPEE_GRATIS_ONGKIR_XTRA_FEE_PCT = 0.5;

type CategoryPickerCatalog = Record<
  RoasCalculatorState['storeType'],
  CategoryPickerGroup[]
>;

const EMPTY_CATEGORY_PICKER_CATALOG: CategoryPickerCatalog = {
  non_star: [],
  star: [],
  mall: [],
};

const roasCategoryCatalogState: {
  status: 'idle' | 'loading' | 'ready' | 'error';
  catalog: CategoryPickerCatalog;
  error: string | null;
  promise: Promise<CategoryPickerCatalog> | null;
} = {
  status: 'idle',
  catalog: EMPTY_CATEGORY_PICKER_CATALOG,
  error: null,
  promise: null,
};

function hasExtensionLogin(state?: ExtensionState | null) {
  return Boolean(state?.authSession && state?.extensionSession);
}

function getSelectedShopRoasDefaults(state: ExtensionState | null) {
  const selectedShopId = state?.selectedShopId ?? null;
  if (!selectedShopId) {
    return null;
  }

  const shop = state?.shops?.find((entry) => entry.id === selectedShopId) ?? null;
  const defaults = shop?.roasDefaults ?? null;
  if (!defaults) {
    return null;
  }

  const storeType =
    defaults.storeType === 'non_star' ||
    defaults.storeType === 'star' ||
    defaults.storeType === 'mall'
      ? defaults.storeType
      : null;

  return {
    shopId: selectedShopId,
    storeType,
    promoXtraEnabled: Boolean(defaults.promoXtraEnabled),
  };
}

function normalizeText(rawValue?: string | null) {
  return rawValue?.replace(/\s+/g, ' ').trim() ?? '';
}

function formatCurrency(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }

  return `Rp${value.toLocaleString('id-ID')}`;
}

function cleanProductTitle(title: string) {
  return normalizeText(title).replace(/^view product:\s*/i, '');
}

function parseCurrencyInput(rawValue: string) {
  const digits = rawValue.replace(/[^\d]/g, '');
  if (!digits) {
    return null;
  }

  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCompactCurrency(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }

  return `Rp${value.toLocaleString('id-ID')}`;
}

function formatPercent(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }

  return `${value.toFixed(2)}%`;
}

function getRepresentativeProductPrice(detail: ProductDetailSnapshot) {
  const { priceMin, priceMax } = detail;
  if (typeof priceMin === 'number' && typeof priceMax === 'number') {
    return Math.round((priceMin + priceMax) / 2);
  }

  if (typeof priceMin === 'number') {
    return priceMin;
  }

  if (typeof priceMax === 'number') {
    return priceMax;
  }

  return null;
}

function cleanSearchContextLabel(rawValue?: string | null) {
  const normalized = normalizeText(rawValue);
  if (!normalized) {
    return '';
  }

  const cleanedParts = normalized
    .split('|')
    .map((part) =>
      normalizeText(
        part
          .replace(/\blocation\b\s*[-: ]*/gi, '')
          .replace(/\s{2,}/g, ' '),
      ),
    )
    .filter((part) => part.length > 0);

  const uniqueParts = cleanedParts.filter(
    (part, index) =>
      cleanedParts.findIndex(
        (candidate) => candidate.toLowerCase() === part.toLowerCase(),
      ) === index,
  );

  return uniqueParts.join(' | ');
}

function parseCompactMetricNumber(rawValue?: string | null) {
  const normalized = normalizeText(rawValue).toUpperCase().replace(/\s+/g, '');
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(\d+(?:[.,]\d+)?)(RB|JT|K|M)?\+?$/i);
  if (!match) {
    const digits = normalized.replace(/[^\d]/g, '');
    return digits ? Number.parseInt(digits, 10) : null;
  }

  const base = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(base)) {
    return null;
  }

  switch (match[2]) {
    case 'RB':
    case 'K':
      return Math.round(base * 1_000);
    case 'JT':
    case 'M':
      return Math.round(base * 1_000_000);
    default:
      return Math.round(base);
  }
}

function parseSalesMetricValue(rawValue?: string | null) {
  const normalized = normalizeText(rawValue);
  if (!normalized) {
    return null;
  }

  const compactValue = normalized
    .replace(/terjual|sold/gi, '')
    .replace(/\s+/g, '')
    .trim();

  return parseCompactMetricNumber(compactValue);
}

function formatSearchPriceLabel(result: PageSnapshot['resultsPreview'][number]) {
  if (typeof result.priceMin === 'number' && typeof result.priceMax === 'number') {
    return result.priceMin === result.priceMax
      ? formatCurrency(result.priceMin)
      : `${formatCurrency(result.priceMin)} - ${formatCurrency(result.priceMax)}`;
  }

  if (typeof result.priceMin === 'number') {
    return formatCurrency(result.priceMin);
  }

  if (typeof result.priceMax === 'number') {
    return formatCurrency(result.priceMax);
  }

  return '-';
}

function formatSearchSalesLabel(result: PageSnapshot['resultsPreview'][number]) {
  return normalizeText(result.salesHint) || '-';
}

function formatSearchMonthlySoldLabel(
  result: PageSnapshot['resultsPreview'][number],
) {
  return normalizeText(result.monthlySoldHint) || '-';
}

function formatSearchRatingLabel(result: PageSnapshot['resultsPreview'][number]) {
  return result.ratingHint ? `★ ${result.ratingHint}` : '★ -';
}

function formatSearchReviewCountLabel(
  result: PageSnapshot['resultsPreview'][number],
) {
  return normalizeText(result.reviewCountHint) || '-';
}

function formatSearchShopLabel(result: PageSnapshot['resultsPreview'][number]) {
  const normalized = cleanSearchContextLabel(result.shopName);
  if (
    !normalized ||
    normalized.length < 3 ||
    /^rp$/i.test(normalized) ||
    /^rp[\d.,-]*$/i.test(normalized)
  ) {
    return 'Toko belum terbaca';
  }

  return normalized;
}

function formatSearchLocationLabel(result: PageSnapshot['resultsPreview'][number]) {
  return cleanSearchContextLabel(result.locationLabel) || '-';
}

function formatSearchMonthlyRevenueLabel(
  result: PageSnapshot['resultsPreview'][number],
) {
  return normalizeText(result.monthlyRevenueHint) || '-';
}

function isRatingDistributionHighlight(value: string) {
  return /^\d+\s*bintang\s*\(\d[\d.,]*\)$/i.test(normalizeText(value));
}

function formatRatingDistributionHighlight(value: string) {
  const normalized = normalizeText(value);
  const matched = normalized.match(/^(\d+)\s*bintang\s*(\(\d[\d.,]*\))$/i);
  if (!matched) {
    return normalized;
  }

  return `${matched[1]} ✮ ${matched[2]}`;
}

function extractShopeeIdsFromUrl(rawUrl: string) {
  const matched = rawUrl.match(/-i\.(\d+)\.(\d+)(?:$|[/?#])/i);
  if (!matched) {
    return null;
  }

  return {
    shopId: matched[1],
    itemId: matched[2],
  };
}

function getSearchResultCacheKey(
  result: Pick<SearchResultPreview, 'productUrl' | 'shopId' | 'itemId'>,
) {
  const ids =
    result.shopId && result.itemId
      ? { shopId: result.shopId, itemId: result.itemId }
      : extractShopeeIdsFromUrl(result.productUrl);

  if (!ids) {
    return null;
  }

  return `${ids.shopId}:${ids.itemId}`;
}

function cacheResolvedSearchResultEnrichment(
  enrichment: SearchResultEnrichment | null | undefined,
) {
  if (!enrichment) {
    return;
  }

  const cacheKey = getSearchResultCacheKey(enrichment);
  if (!cacheKey) {
    return;
  }

  resolvedSearchResultEnrichmentCache.set(cacheKey, enrichment);
}

function applyResolvedEnrichmentToSnapshot(snapshot: PageSnapshot) {
  if (snapshot.pageType === 'shopee_public_product' && snapshot.productDetail) {
    const cacheKey = getSearchResultCacheKey({
      productUrl: snapshot.productDetail.productUrl,
      ...extractShopeeIdsFromUrl(snapshot.productDetail.productUrl),
    });
    const resolvedEnrichment = cacheKey
      ? resolvedSearchResultEnrichmentCache.get(cacheKey) ?? null
      : null;

    if (!resolvedEnrichment) {
      return snapshot;
    }

    return {
      ...snapshot,
      productDetail: mergeProductDetailEnrichment(
        snapshot.productDetail,
        resolvedEnrichment,
      ),
    };
  }

  if (snapshot.pageType !== 'shopee_public_search') {
    return snapshot;
  }

  let hasMerged = false;
  const mergedResults = snapshot.resultsPreview.map((result) => {
    const cacheKey = getSearchResultCacheKey(result);
    const resolvedEnrichment = cacheKey
      ? resolvedSearchResultEnrichmentCache.get(cacheKey) ?? null
      : null;

    if (!resolvedEnrichment) {
      return result;
    }

    hasMerged = true;
    return mergeSearchResultEnrichment(result, resolvedEnrichment);
  });

  if (!hasMerged) {
    return snapshot;
  }

  return {
    ...snapshot,
    resultsPreview: mergedResults,
  };
}

function mergeSearchResultEnrichment(
  result: SearchResultPreview,
  enrichment: SearchResultEnrichment | null,
) {
  if (!enrichment) {
    return result;
  }

  return {
    ...result,
    ...enrichment,
  };
}

function mergeProductDetailEnrichment(
  detail: ProductDetailSnapshot,
  enrichment: SearchResultEnrichment | null,
) {
  if (!enrichment) {
    return detail;
  }

  return {
    ...detail,
    shopName: normalizeText(enrichment.shopName) || detail.shopName,
    priceMin:
      typeof enrichment.priceMin === 'number' ? enrichment.priceMin : detail.priceMin,
    priceMax:
      typeof enrichment.priceMax === 'number' ? enrichment.priceMax : detail.priceMax,
    salesHint: normalizeText(enrichment.salesHint) || detail.salesHint,
    monthlySoldHint:
      normalizeText(enrichment.monthlySoldHint) || detail.monthlySoldHint,
    ratingHint: normalizeText(enrichment.ratingHint) || detail.ratingHint,
    reviewCountHint:
      normalizeText(enrichment.reviewCountHint) || detail.reviewCountHint,
  };
}

function toProductDetailEnrichmentPreview(
  snapshot: PageSnapshot,
): SearchResultPreview | null {
  if (snapshot.pageType !== 'shopee_public_product' || !snapshot.productDetail) {
    return null;
  }

  const ids = extractShopeeIdsFromUrl(snapshot.productDetail.productUrl);
  if (!ids) {
    return null;
  }

  return {
    position: 1,
    productTitle: snapshot.productDetail.productTitle,
    productUrl: snapshot.productDetail.productUrl,
    shopId: ids.shopId,
    itemId: ids.itemId,
    imageUrl: snapshot.productDetail.imageUrl,
    shopName: snapshot.productDetail.shopName,
    priceMin: snapshot.productDetail.priceMin,
    priceMax: snapshot.productDetail.priceMax,
    salesHint: snapshot.productDetail.salesHint,
    monthlySoldHint: snapshot.productDetail.monthlySoldHint,
    ratingHint: snapshot.productDetail.ratingHint,
    reviewCountHint: snapshot.productDetail.reviewCountHint,
  };
}

function ensurePageBridgeInjected() {
  const existingScript = document.getElementById(
    PAGE_BRIDGE_SCRIPT_ID,
  ) as HTMLScriptElement | null;

  if (existingScript?.dataset.ready === 'true') {
    return Promise.resolve();
  }

  if (pageBridgeLoadPromise) {
    return pageBridgeLoadPromise;
  }

  pageBridgeLoadPromise = new Promise<void>((resolve, reject) => {
    const bridgeScript = existingScript ?? document.createElement('script');
    bridgeScript.id = PAGE_BRIDGE_SCRIPT_ID;
    bridgeScript.src = chrome.runtime.getURL('pageBridge.js');
    bridgeScript.async = false;

    const handleLoad = () => {
      bridgeScript.dataset.ready = 'true';
      pageBridgeLoadPromise = null;
      resolve();
    };

    const handleError = () => {
      pageBridgeLoadPromise = null;
      reject(new Error('Gagal memuat page bridge LevelUP.'));
    };

    bridgeScript.addEventListener('load', handleLoad, { once: true });
    bridgeScript.addEventListener('error', handleError, { once: true });

    if (!existingScript) {
      (document.head ?? document.documentElement).appendChild(bridgeScript);
    }
  });

  return pageBridgeLoadPromise;
}

async function requestPageBridgeSearchEnrichment(results: SearchResultPreview[]) {
  await ensurePageBridgeInjected();

  return new Promise<SearchResultEnrichment[]>((resolve, reject) => {
    const requestId = `shopee-enrich-${Date.now()}-${++pageBridgeRequestSequence}`;
    const timeoutId = window.setTimeout(() => {
      pendingPageBridgeRequests.delete(requestId);
      reject(new Error('Bridge enrichment Shopee timeout.'));
    }, PAGE_BRIDGE_TIMEOUT_MS);

    pendingPageBridgeRequests.set(requestId, {
      resolve,
      reject,
      timeoutId,
    });

    document.dispatchEvent(
      new CustomEvent(PAGE_BRIDGE_REQUEST_EVENT, {
        detail: {
          requestId,
          results,
        },
      }),
    );
  });
}

function hasSalesSignal(result: PageSnapshot['resultsPreview'][number]) {
  return (
    normalizeText(result.monthlySoldHint).length > 0 ||
    normalizeText(result.salesHint).length > 0
  );
}

function orderResultsForResearch(results: PageSnapshot['resultsPreview']) {
  return [...results].sort((left, right) => {
    const salesPriority = Number(hasSalesSignal(right)) - Number(hasSalesSignal(left));
    if (salesPriority !== 0) {
      return salesPriority;
    }

    const salesDelta =
      (parseSalesMetricValue(right.monthlySoldHint) ??
        parseSalesMetricValue(right.salesHint) ??
        0) -
      (parseSalesMetricValue(left.monthlySoldHint) ??
        parseSalesMetricValue(left.salesHint) ??
        0);
    if (salesDelta !== 0) {
      return salesDelta;
    }

    const ratingDelta =
      (parseCompactMetricNumber(right.ratingHint) ?? 0) -
      (parseCompactMetricNumber(left.ratingHint) ?? 0);
    if (ratingDelta !== 0) {
      return ratingDelta;
    }

    return left.position - right.position;
  });
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getBadgeTone(label: string) {
  switch (label) {
    case 'Termurah':
      return 'murah';
    case 'Termahal':
      return 'mahal';
    case 'Di bawah median':
      return 'median';
    case 'Ada penjualan':
      return 'penjualan';
    default:
      return 'default';
  }
}

function getResultsSignature(snapshot: PageSnapshot) {
  return [
    snapshot.pageType,
    snapshot.keyword ?? '',
    snapshot.productDetail?.productUrl ?? '',
    ...snapshot.resultsPreview.map((result) => result.productUrl),
  ].join('|');
}

function getOverlayRenderKey(
  snapshot: PageSnapshot,
  statusLabel: string,
  visibleCount: number,
) {
  if (snapshot.pageType === 'shopee_public_search') {
    const orderedResults = orderResultsForResearch(snapshot.resultsPreview);
    const displayedResults = orderedResults.slice(0, visibleCount);

    return JSON.stringify({
      pageType: snapshot.pageType,
      keyword: snapshot.keyword ?? '',
      statusLabel,
      visibleCount,
      totalResults: orderedResults.length,
      results: displayedResults.map((result) => ({
        position: result.position,
        productUrl: result.productUrl,
        shopId: result.shopId ?? '',
        itemId: result.itemId ?? '',
        imageUrl: result.imageUrl ?? '',
        shopName: result.shopName ?? '',
        locationLabel: result.locationLabel ?? '',
        priceMin: result.priceMin ?? null,
        priceMax: result.priceMax ?? null,
        salesHint: result.salesHint ?? '',
        monthlySoldHint: result.monthlySoldHint ?? '',
        ratingHint: result.ratingHint ?? '',
        reviewCountHint: result.reviewCountHint ?? '',
        monthlyRevenueHint: result.monthlyRevenueHint ?? '',
      })),
    });
  }

  return JSON.stringify({
    pageType: snapshot.pageType,
    statusLabel,
    productTitle: snapshot.productDetail?.productTitle ?? snapshot.title,
    productUrl: snapshot.productDetail?.productUrl ?? snapshot.url,
    imageUrl: snapshot.productDetail?.imageUrl ?? '',
    shopName: snapshot.productDetail?.shopName ?? '',
    priceMin: snapshot.productDetail?.priceMin ?? null,
    priceMax: snapshot.productDetail?.priceMax ?? null,
    salesHint: snapshot.productDetail?.salesHint ?? '',
    monthlySoldHint: snapshot.productDetail?.monthlySoldHint ?? '',
    ratingHint: snapshot.productDetail?.ratingHint ?? '',
    reviewCountHint: snapshot.productDetail?.reviewCountHint ?? '',
    highlights: snapshot.productDetail?.highlights ?? [],
  });
}

function isIgnorableRuntimeError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('receiving end does not exist') ||
    message.includes('could not establish connection') ||
    message.includes('message port closed') ||
    message.includes('extension context invalidated')
  );
}

function collectPriceSummary(results: PageSnapshot['resultsPreview']) {
  const priceValues = results.flatMap((result) =>
    [result.priceMin, result.priceMax].filter(
      (value): value is number =>
        typeof value === 'number' && Number.isFinite(value),
    ),
  );

  if (priceValues.length === 0) {
    return '-';
  }

  const min = Math.min(...priceValues);
  const max = Math.max(...priceValues);

  if (min === max) {
    return formatCurrency(min);
  }

  return `${formatCurrency(min)} - ${formatCurrency(max)}`;
}

function getComparablePrice(result: PageSnapshot['resultsPreview'][number]) {
  if (
    typeof result.priceMin === 'number' &&
    typeof result.priceMax === 'number' &&
    Number.isFinite(result.priceMin) &&
    Number.isFinite(result.priceMax)
  ) {
    return Math.round((result.priceMin + result.priceMax) / 2);
  }

  if (typeof result.priceMin === 'number' && Number.isFinite(result.priceMin)) {
    return result.priceMin;
  }

  if (typeof result.priceMax === 'number' && Number.isFinite(result.priceMax)) {
    return result.priceMax;
  }

  return null;
}

function collectComparablePrices(results: PageSnapshot['resultsPreview']) {
  return results
    .map((result) => getComparablePrice(result))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
}

function collectMedianPriceValue(results: PageSnapshot['resultsPreview']) {
  const normalizedPrices = collectComparablePrices(results);

  if (normalizedPrices.length === 0) {
    return null;
  }

  const middleIndex = Math.floor(normalizedPrices.length / 2);
  return normalizedPrices.length % 2 === 0
    ? Math.round(
        (normalizedPrices[middleIndex - 1] + normalizedPrices[middleIndex]) / 2,
      )
    : normalizedPrices[middleIndex];
}

function collectMedianPrice(results: PageSnapshot['resultsPreview']) {
  const median = collectMedianPriceValue(results);

  if (median === null) {
    return '-';
  }

  return formatCurrency(median);
}

function getProductBadges(
  result: PageSnapshot['resultsPreview'][number],
  options: {
    minPriceValue: number | null;
    maxPriceValue: number | null;
    medianPriceValue: number | null;
  },
) {
  const badges: string[] = [];
  const comparablePrice = getComparablePrice(result);

  if (
    options.minPriceValue !== null &&
    comparablePrice !== null &&
    comparablePrice <= options.minPriceValue
  ) {
    badges.push('Termurah');
  }

  if (
    options.maxPriceValue !== null &&
    comparablePrice !== null &&
    comparablePrice >= options.maxPriceValue
  ) {
    badges.push('Termahal');
  }

  if (
    options.medianPriceValue !== null &&
    comparablePrice !== null &&
    comparablePrice < options.medianPriceValue
  ) {
    badges.push('Di bawah median');
  }

  if (normalizeText(result.salesHint).length > 0) {
    badges.push('Ada penjualan');
  }

  if (normalizeText(result.monthlySoldHint).length > 0) {
    badges.push('Ada penjualan bulanan');
  }

  return badges.slice(0, 2);
}

function getProductDetailBadges(
  detail: ProductDetailSnapshot,
  options: {
    minPriceValue: number | null;
    maxPriceValue: number | null;
    medianPriceValue: number | null;
  },
) {
  return getProductBadges(
    {
      position: 1,
      productTitle: detail.productTitle,
      productUrl: detail.productUrl,
      imageUrl: detail.imageUrl,
      shopName: detail.shopName,
      priceMin: detail.priceMin,
      priceMax: detail.priceMax,
      salesHint: detail.salesHint,
    },
    options,
  );
}

function countResultsWithSalesSignal(results: PageSnapshot['resultsPreview']) {
  return results.filter((result) => hasSalesSignal(result)).length;
}

function collectMinPrice(results: PageSnapshot['resultsPreview']) {
  const prices = results
    .flatMap((result) => [result.priceMin, result.priceMax])
    .filter(
      (value): value is number =>
        typeof value === 'number' && Number.isFinite(value),
    );

  if (prices.length === 0) {
    return '-';
  }

  return formatCurrency(Math.min(...prices));
}

function collectMaxPrice(results: PageSnapshot['resultsPreview']) {
  const prices = results
    .flatMap((result) => [result.priceMin, result.priceMax])
    .filter(
      (value): value is number =>
        typeof value === 'number' && Number.isFinite(value),
    );

  if (prices.length === 0) {
    return '-';
  }

  return formatCurrency(Math.max(...prices));
}

function getUniqueShopCount(results: PageSnapshot['resultsPreview']) {
  const shops = new Set(
    results
      .map((result) => normalizeText(result.shopName))
      .filter((shopName) => shopName.length > 0),
  );

  return shops.size;
}

function isProductLink(rawHref: string) {
  return rawHref.includes('/product/') || /-i\.\d+\.\d+/i.test(rawHref);
}

function findProductCardElement(anchor: HTMLAnchorElement) {
  return (
    anchor.closest(
      '[data-sqe="item"], [data-sqe="itemCard"], [data-sqe="link"], li, article',
    ) ??
    anchor.closest('div')
  );
}

function isPotentialProductGrid(element: Element) {
  const style = window.getComputedStyle(element);
  const isGridLike =
    style.display.includes('grid') || style.display.includes('flex');
  const productAnchors = element.querySelectorAll(
    'a[href*="/product/"], a[href*="-i."]',
  ).length;

  return isGridLike && productAnchors >= 4;
}

type ProductCardMatch = {
  anchor: HTMLAnchorElement;
  card: Element;
  rect: DOMRect;
};

type TextMarkerMatch = {
  element: Element;
  rect: DOMRect;
};

function getVisibleProductCards() {
  const matches: ProductCardMatch[] = [];
  const seenCards = new Set<Element>();

  for (const anchor of Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[href]'),
  )) {
    const href = anchor.getAttribute('href');
    if (!href || !isProductLink(href)) {
      continue;
    }

    const card = findProductCardElement(anchor);
    if (!card || seenCards.has(card)) {
      continue;
    }

    const rect = card.getBoundingClientRect();
    const text = normalizeText(card.textContent);

    if (
      rect.width < 120 ||
      rect.height < 180 ||
      rect.bottom <= 0 ||
      text.length < 20 ||
      !card.querySelector('img')
    ) {
      continue;
    }

    seenCards.add(card);
    matches.push({ anchor, card, rect });
  }

  return matches.sort((left, right) => {
    if (left.rect.top === right.rect.top) {
      return left.rect.left - right.rect.left;
    }

    return left.rect.top - right.rect.top;
  });
}

function countCardsInside(container: Element, cards: ProductCardMatch[]) {
  return cards.filter((candidate) => container.contains(candidate.card)).length;
}

function findTextMarker(pattern: RegExp, minTop = 120) {
  const matches = Array.from(document.querySelectorAll('div, section, span, h1, h2, h3'))
    .map((element) => {
      const text = normalizeText(element.textContent);
      if (!pattern.test(text)) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      if (rect.width < 160 || rect.height < 16 || rect.top < minTop) {
        return null;
      }

      return { element, rect } satisfies TextMarkerMatch;
    })
    .filter((match): match is TextMarkerMatch => match !== null)
    .sort((left, right) => {
      if (left.rect.top === right.rect.top) {
        return left.rect.height - right.rect.height;
      }

      return left.rect.top - right.rect.top;
    });

  return matches[0] ?? null;
}

function findShopeeProductSection() {
  return (
    document.querySelector(
      '.page-product__content, .product-briefing, [data-sqe="detail_product"]',
    ) ?? null
  );
}

function findShopeeShopSection() {
  return (
    document.querySelector(
      '.page-product__shop, [data-sqe="shop"], [class*="page-product__shop"], [class*="shop-page"]',
    ) ?? null
  );
}

function getShopeeSpecificHost(snapshot?: PageSnapshot) {
  if (snapshot?.pageType === 'shopee_public_product') {
    const productContent = findShopeeProductSection();
    const shopSection = findShopeeShopSection();

    if (
      productContent &&
      shopSection &&
      productContent.parentElement &&
      shopSection.parentElement &&
      productContent.parentElement === shopSection.parentElement
    ) {
      return {
        parent: shopSection.parentElement,
        before: shopSection,
        layoutMode: 'product' as const,
      };
    }

    if (shopSection?.parentElement) {
      return {
        parent: shopSection.parentElement,
        before: shopSection,
        layoutMode: 'product' as const,
      };
    }

    if (productContent?.parentElement) {
      return {
        parent: productContent.parentElement,
        before: productContent.nextSibling,
        layoutMode: 'product' as const,
      };
    }
  }

  const productGrid = document.querySelector(
    '.shopee-search-item-result__items',
  );
  const sortBar = document.querySelector('.shopee-sort-bar');
  const searchResultRoot =
    productGrid?.closest('.shopee-search-item-result') ??
    sortBar?.parentElement ??
    null;

  if (searchResultRoot && sortBar) {
    return {
      parent: searchResultRoot,
      before: sortBar,
      layoutMode: 'block' as const,
    };
  }

  if (searchResultRoot && productGrid) {
    return {
      parent: searchResultRoot,
      before: productGrid,
      layoutMode: 'block' as const,
    };
  }

  if (productGrid) {
    return {
      parent: productGrid,
      before: productGrid.firstChild,
      layoutMode: 'grid' as const,
    };
  }

  return null;
}

function getOverlayHost(snapshot?: PageSnapshot) {
  const shopeeHost = getShopeeSpecificHost(snapshot);
  if (shopeeHost) {
    return shopeeHost;
  }

  const resultsHeaderMarker = findTextMarker(/hasil pencarian untuk/i);
  const sortBarMarker =
    findTextMarker(/urutkan/i, 160) ??
    findTextMarker(/terkait.*terbaru.*terlaris.*harga/i, 160);

  const contentStartTop =
    sortBarMarker?.rect.top ??
    resultsHeaderMarker?.rect.top ??
    0;

  const productCards = getVisibleProductCards().filter(
    (candidate) => candidate.rect.top >= contentStartTop - 24,
  );
  if (productCards.length === 0) {
    const mainContent = document.querySelector('main') ?? document.body;

    return {
      parent: mainContent,
      before: mainContent.firstChild,
      layoutMode: 'block' as const,
    };
  }

  const containerCandidates = new Map<
    Element,
    { count: number; top: number; width: number }
  >();

  for (const match of productCards.slice(0, 20)) {
    let current: Element | null = match.card.parentElement;
    let depth = 0;

    while (current && current !== document.body && depth < 6) {
      const rect = current.getBoundingClientRect();
      const count = countCardsInside(current, productCards);

      if (
        count >= 6 &&
        rect.width >= 600 &&
        rect.height >= 250 &&
        isPotentialProductGrid(current)
      ) {
        const existing = containerCandidates.get(current);
        if (!existing || count > existing.count) {
          containerCandidates.set(current, {
            count,
            top: rect.top,
            width: rect.width,
          });
        }
      }

      current = current.parentElement;
      depth += 1;
    }
  }

  const bestContainer =
    Array.from(containerCandidates.entries())
      .sort((left, right) => {
        const topDelta = Math.abs(left[1].top - contentStartTop) - Math.abs(right[1].top - contentStartTop);

        if (topDelta !== 0) {
          return topDelta;
        }

        if (right[1].count !== left[1].count) {
          return right[1].count - left[1].count;
        }

        return left[1].top - right[1].top;
      })
      .at(0)?.[0] ?? null;

  const overlayParent =
    bestContainer ??
    productCards[0]?.card.parentElement ??
    document.querySelector('main') ??
    document.body;

  const insertAfterMarker =
    sortBarMarker?.element ??
    resultsHeaderMarker?.element ??
    null;

  const firstCardInContainer =
    productCards.find((candidate) => overlayParent.contains(candidate.card))?.card ??
    productCards[0]?.card ??
    null;

  if (
    insertAfterMarker &&
    overlayParent.contains(insertAfterMarker) &&
    insertAfterMarker.nextSibling
  ) {
    return {
      parent: overlayParent,
      before: insertAfterMarker.nextSibling,
      layoutMode: 'block' as const,
    };
  }

  return {
    parent: overlayParent,
    before: firstCardInContainer ?? overlayParent.firstChild,
    layoutMode: isPotentialProductGrid(overlayParent) ? ('grid' as const) : ('block' as const),
  };
}

function ensureOverlayStyle() {
  if (document.getElementById(OVERLAY_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = OVERLAY_STYLE_ID;
  style.textContent = `
    #${OVERLAY_ID} {
      margin: 0 0 16px;
      border: 2px solid #fb6a35;
      border-radius: 10px;
      background: linear-gradient(180deg, rgba(255, 243, 238, 0.96), rgba(255, 248, 245, 0.96));
      box-shadow: 0 18px 40px rgba(251, 106, 53, 0.14);
      color: #1f2937;
      font-family: Inter, Arial, sans-serif;
      overflow: hidden;
      width: 100%;
    }

    #${OVERLAY_ID}[data-layout-mode="grid"] {
      grid-column: 1 / -1;
    }

    #${OVERLAY_ID}[data-layout-mode="block"] {
      max-width: 1200px;
      margin-left: auto;
      margin-right: auto;
    }

    #${OVERLAY_ID}[data-layout-mode="product"] {
      max-width: 100%;
      margin-top: 14px;
      margin-left: 0;
      margin-right: 0;
      border-width: 1px;
      border-color: rgba(251, 106, 53, 0.28);
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
      background: linear-gradient(180deg, rgba(255, 247, 243, 0.98), rgba(255, 251, 249, 0.98));
    }

    #${OVERLAY_ID} * {
      box-sizing: border-box;
    }

    #${OVERLAY_ID} .levelup-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px 10px;
      border-bottom: 1px solid rgba(251, 106, 53, 0.18);
      background: rgba(255, 255, 255, 0.55);
    }

    #${OVERLAY_ID} .levelup-title {
      font-size: 15px;
      font-weight: 600;
      color: #111827;
    }

    #${OVERLAY_ID} .levelup-card-subchips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    #${OVERLAY_ID} .levelup-card-subchip {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 4px 9px;
      background: rgba(251, 106, 53, 0.08);
      color: #9a3412;
      font-size: 11px;
      line-height: 1.35;
      font-weight: 400;
    }

    #${OVERLAY_ID} .levelup-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(17, 24, 39, 0.46);
      z-index: 2147483646;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 18px 14px;
      overflow: auto;
    }

    #${OVERLAY_ID} .levelup-modal {
      width: min(980px, 100%);
      background: rgba(255, 250, 248, 0.98);
      border: 1px solid rgba(251, 106, 53, 0.2);
      border-radius: 18px;
      box-shadow: 0 26px 56px rgba(17, 24, 39, 0.25);
      overflow: hidden;
    }

    #${OVERLAY_ID} .levelup-modal.levelup-modal-roas {
      overflow: visible;
    }

    #${OVERLAY_ID} .levelup-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      background: rgba(251, 106, 53, 0.08);
      border-bottom: 1px solid rgba(251, 106, 53, 0.16);
    }

    #${OVERLAY_ID} .levelup-modal-title {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      line-height: 1.4;
    }

    #${OVERLAY_ID} .levelup-modal-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    #${OVERLAY_ID} .levelup-roas-bar {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      padding: 14px 16px 2px;
    }

    #${OVERLAY_ID} .levelup-roas-tier {
      border-radius: 14px;
      padding: 10px 12px;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: flex-start;
      position: relative;
      overflow: visible;
    }

    #${OVERLAY_ID} .levelup-roas-tier-main {
      display: inline-flex;
      align-items: center;
      min-width: 0;
    }

    #${OVERLAY_ID} .levelup-roas-tier-label {
      min-width: 0;
    }

    #${OVERLAY_ID} .levelup-tooltip {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    #${OVERLAY_ID} .levelup-tooltip-trigger {
      border: none;
      background: transparent;
      padding: 0;
      margin: 0;
      color: #dc2626;
      font-size: 13px;
      line-height: 1;
      font-weight: 700;
      cursor: help;
    }

    #${OVERLAY_ID} .levelup-tooltip-panel {
      position: absolute;
      left: 50%;
      bottom: calc(100% + 10px);
      transform: translateX(-50%) translateY(4px);
      min-width: 220px;
      max-width: 280px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(17, 24, 39, 0.96);
      color: #f8fafc;
      box-shadow: 0 18px 38px rgba(15, 23, 42, 0.28);
      border: 1px solid rgba(248, 113, 113, 0.18);
      font-size: 12px;
      line-height: 1.5;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition:
        opacity 140ms ease,
        transform 140ms ease,
        visibility 140ms ease;
      z-index: 35;
      white-space: normal;
    }

    #${OVERLAY_ID} .levelup-tooltip-panel::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 100%;
      width: 10px;
      height: 10px;
      transform: translateX(-50%) rotate(45deg);
      background: rgba(17, 24, 39, 0.96);
      border-right: 1px solid rgba(248, 113, 113, 0.18);
      border-bottom: 1px solid rgba(248, 113, 113, 0.18);
    }

    #${OVERLAY_ID} .levelup-tooltip:hover .levelup-tooltip-panel,
    #${OVERLAY_ID} .levelup-tooltip:focus-within .levelup-tooltip-panel {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(0);
    }

    #${OVERLAY_ID} .levelup-roas-tier:hover .levelup-tooltip-panel,
    #${OVERLAY_ID} .levelup-roas-tier:focus-within .levelup-tooltip-panel {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(0);
    }

    #${OVERLAY_ID} .levelup-roas-tier .levelup-tooltip-panel {
      top: calc(100% + 10px);
      bottom: auto;
      transform: translateX(-50%) translateY(-4px);
    }

    #${OVERLAY_ID} .levelup-roas-tier .levelup-tooltip-panel::after {
      top: auto;
      bottom: calc(100% - 5px);
      border-right: none;
      border-bottom: none;
      border-left: 1px solid rgba(248, 113, 113, 0.18);
      border-top: 1px solid rgba(248, 113, 113, 0.18);
    }

    #${OVERLAY_ID} .levelup-tooltip-lines {
      display: grid;
      gap: 4px;
    }

    #${OVERLAY_ID} .levelup-field-label-row {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    #${OVERLAY_ID} .levelup-roas-tier[data-tone="danger"] {
      background: rgba(239, 68, 68, 0.18);
      color: #7f1d1d;
    }

    #${OVERLAY_ID} .levelup-roas-tier[data-tone="warning"] {
      background: rgba(245, 158, 11, 0.18);
      color: #7c2d12;
    }

    #${OVERLAY_ID} .levelup-roas-tier[data-tone="safe"] {
      background: rgba(34, 197, 94, 0.18);
      color: #14532d;
    }

    #${OVERLAY_ID} .levelup-roas-tier[data-tone="prospect"] {
      background: rgba(14, 165, 233, 0.18);
      color: #0c4a6e;
    }

    #${OVERLAY_ID} .levelup-modal-body {
      padding: 12px 16px 16px;
      display: grid;
      gap: 12px;
    }

    #${OVERLAY_ID} .levelup-roas-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    #${OVERLAY_ID} .levelup-roas-field {
      border: 1px solid rgba(251, 106, 53, 0.16);
      background: rgba(255, 255, 255, 0.9);
      border-radius: 14px;
      padding: 10px 12px;
      display: grid;
      gap: 8px;
    }

    #${OVERLAY_ID} .levelup-roas-field-label {
      font-size: 12px;
      font-weight: 600;
      color: #9a3412;
    }

    #${OVERLAY_ID} .levelup-roas-field-row {
      display: grid;
      grid-template-columns: minmax(0, 10fr) minmax(84px, 2fr);
      gap: 10px;
      align-items: center;
    }

    #${OVERLAY_ID} .levelup-roas-store-type-group {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    #${OVERLAY_ID} .levelup-roas-radio {
      position: relative;
      display: flex;
      align-items: center;
    }

    #${OVERLAY_ID} .levelup-roas-radio input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    #${OVERLAY_ID} .levelup-roas-radio-label {
      width: 100%;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      min-height: 40px;
      padding: 0 10px;
      border-radius: 12px;
      border: 1px solid rgba(203, 213, 225, 0.85);
      background: rgba(255, 255, 255, 0.92);
      color: #111827;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.3;
      cursor: pointer;
      text-align: center;
      transition:
        border-color 140ms ease,
        background 140ms ease,
        color 140ms ease,
        box-shadow 140ms ease;
    }

    #${OVERLAY_ID} .levelup-roas-radio input:checked + .levelup-roas-radio-label {
      border-color: rgba(251, 106, 53, 0.38);
      background: rgba(251, 106, 53, 0.14);
      color: #9a3412;
      box-shadow: inset 0 0 0 1px rgba(251, 106, 53, 0.08);
    }

    #${OVERLAY_ID} .levelup-roas-program-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    #${OVERLAY_ID} .levelup-roas-program-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-height: 40px;
      padding: 0;
      border: 0;
      background: transparent;
    }

    #${OVERLAY_ID} .levelup-roas-program-card + .levelup-roas-program-card {
      border-left: 1px solid rgba(203, 213, 225, 0.85);
      padding-left: 12px;
    }

    #${OVERLAY_ID} .levelup-roas-program-card[data-align="right"] {
      text-align: right;
    }

    #${OVERLAY_ID} .levelup-roas-program-card[data-align="right"] .levelup-roas-program-copy {
      justify-items: end;
      text-align: right;
    }

    #${OVERLAY_ID} .levelup-roas-program-card[data-align="left"] {
      text-align: left;
    }

    #${OVERLAY_ID} .levelup-roas-program-card[data-align="left"] .levelup-roas-program-copy {
      justify-items: start;
      text-align: left;
    }

    #${OVERLAY_ID} .levelup-roas-program-copy {
      display: grid;
      min-width: 0;
    }

    #${OVERLAY_ID} .levelup-roas-program-title {
      font-size: 12px;
      font-weight: 600;
      color: #111827;
      line-height: 1.25;
    }

    #${OVERLAY_ID} .levelup-roas-program-title-button {
      appearance: none;
      border: 0;
      background: transparent;
      padding: 0;
      margin: 0;
      color: inherit;
      font: inherit;
      cursor: help;
      text-align: inherit;
    }

    #${OVERLAY_ID} .levelup-roas-summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    #${OVERLAY_ID} .levelup-roas-select {
      width: 100%;
      border: 1px solid rgba(203, 213, 225, 0.85);
      border-radius: 12px;
      padding: 9px 10px;
      font-size: 12px;
      line-height: 1.4;
      color: #111827;
      outline: none;
      background: rgba(255, 255, 255, 0.92);
    }

    #${OVERLAY_ID} .levelup-roas-input {
      width: 100%;
      border: 1px solid rgba(203, 213, 225, 0.85);
      border-radius: 12px;
      padding: 9px 10px;
      font-size: 12px;
      line-height: 1.4;
      color: #111827;
      outline: none;
      background: rgba(255, 255, 255, 0.92);
    }

    #${OVERLAY_ID} .levelup-roas-input[data-variant="pct"] {
      width: 100%;
      min-width: 0;
      text-align: right;
    }

    #${OVERLAY_ID} .levelup-roas-category-button {
      flex: 1;
      min-width: 0;
    }

    #${OVERLAY_ID} .levelup-roas-toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding-top: 2px;
      font-size: 12px;
      color: #111827;
      font-weight: 600;
    }

    #${OVERLAY_ID} .levelup-roas-toggle-inline {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #111827;
      font-weight: 600;
      white-space: nowrap;
      flex-shrink: 0;
    }

    #${OVERLAY_ID} .levelup-toggle {
      position: relative;
      width: 42px;
      height: 24px;
      flex-shrink: 0;
    }

    #${OVERLAY_ID} .levelup-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }

    #${OVERLAY_ID} .levelup-toggle-track {
      position: absolute;
      inset: 0;
      border-radius: 999px;
      background: rgba(203, 213, 225, 0.85);
      transition: background 160ms ease;
    }

    #${OVERLAY_ID} .levelup-toggle-track::after {
      content: "";
      position: absolute;
      top: 3px;
      left: 3px;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: #fff;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.14);
      transition: transform 160ms ease;
    }

    #${OVERLAY_ID} .levelup-toggle input:checked + .levelup-toggle-track {
      background: rgba(251, 106, 53, 0.75);
    }

    #${OVERLAY_ID} .levelup-toggle input:checked + .levelup-toggle-track::after {
      transform: translateX(18px);
    }

    #${OVERLAY_ID} .levelup-category-modal-layout {
      display: grid;
      grid-template-columns: 176px 196px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
    }

    #${OVERLAY_ID} .levelup-category-column {
      border: 1px solid rgba(251, 106, 53, 0.16);
      background: rgba(255, 255, 255, 0.94);
      border-radius: 16px;
      overflow: hidden;
      min-height: 404px;
      display: grid;
      grid-template-rows: auto 1fr;
    }

    #${OVERLAY_ID} .levelup-category-column-header {
      padding: 10px 12px;
      border-bottom: 1px solid rgba(251, 106, 53, 0.14);
      font-size: 12px;
      font-weight: 700;
      color: #9a3412;
      background: rgba(251, 106, 53, 0.07);
    }

    #${OVERLAY_ID} .levelup-category-list {
      overflow: auto;
      max-height: 520px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      align-content: flex-start;
      gap: 6px;
    }

    #${OVERLAY_ID} .levelup-category-item {
      width: 100%;
      text-align: left;
      border: 1px solid transparent;
      border-radius: 12px;
      padding: 10px 10px;
      background: rgba(255, 255, 255, 0.84);
      font-size: 12px;
      font-weight: 600;
      color: #111827;
      cursor: pointer;
    }

    #${OVERLAY_ID} .levelup-category-item[data-active="true"] {
      background: rgba(251, 106, 53, 0.14);
      border-color: rgba(251, 106, 53, 0.22);
      color: #9a3412;
    }

    #${OVERLAY_ID} .levelup-category-search {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(251, 106, 53, 0.14);
      background: rgba(255, 255, 255, 0.92);
    }

    #${OVERLAY_ID} .levelup-category-search input {
      width: 100%;
      border: 1px solid rgba(203, 213, 225, 0.85);
      border-radius: 12px;
      padding: 9px 10px;
      font-size: 12px;
      outline: none;
    }

    #${OVERLAY_ID} .levelup-category-cards {
      overflow: auto;
      max-height: 520px;
      padding: 10px;
      display: grid;
      gap: 10px;
    }

    #${OVERLAY_ID} .levelup-category-card {
      border: 1px solid rgba(251, 106, 53, 0.16);
      border-radius: 16px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.94);
      display: grid;
      gap: 10px;
    }

    #${OVERLAY_ID} .levelup-category-card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }

    #${OVERLAY_ID} .levelup-category-card-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      flex-shrink: 0;
    }

    #${OVERLAY_ID} .levelup-category-card-title {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
      line-height: 1.45;
    }

    #${OVERLAY_ID} .levelup-category-card-fee {
      font-size: 13px;
      font-weight: 800;
      color: #c2410c;
      white-space: nowrap;
    }

    #${OVERLAY_ID} .levelup-category-card-meta .levelup-button {
      min-width: 72px;
    }

    #${OVERLAY_ID} .levelup-auth-gate {
      display: grid;
      place-items: center;
      min-height: 280px;
      padding: 8px 0;
    }

    #${OVERLAY_ID} .levelup-auth-gate-card {
      width: min(100%, 440px);
      border: 1px solid rgba(251, 106, 53, 0.16);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.94);
      padding: 20px;
      display: grid;
      gap: 12px;
      text-align: center;
      box-shadow: 0 16px 38px rgba(15, 23, 42, 0.08);
    }

    #${OVERLAY_ID} .levelup-auth-gate-title {
      font-size: 18px;
      line-height: 1.3;
      font-weight: 800;
      color: #111827;
    }

    #${OVERLAY_ID} .levelup-auth-gate-text {
      font-size: 13px;
      line-height: 1.6;
      color: #4b5563;
    }

    #${OVERLAY_ID} .levelup-auth-gate-actions {
      display: flex;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    #${OVERLAY_ID} .levelup-category-card-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    #${OVERLAY_ID} .levelup-category-tag {
      border-radius: 999px;
      padding: 4px 10px;
      background: rgba(148, 163, 184, 0.18);
      color: #475569;
      font-size: 11px;
      font-weight: 600;
    }

    @media (max-width: 960px) {
      #${OVERLAY_ID} .levelup-category-modal-layout {
        grid-template-columns: 1fr;
      }
    }

    #${OVERLAY_ID} .levelup-roas-output {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      font-size: 12px;
      color: #111827;
      font-weight: 600;
    }

    #${OVERLAY_ID} .levelup-roas-output small {
      font-weight: 600;
      color: #16a34a;
      white-space: nowrap;
    }

    @media (max-width: 720px) {
      #${OVERLAY_ID} .levelup-roas-bar {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      #${OVERLAY_ID} .levelup-roas-grid {
        grid-template-columns: 1fr;
      }

      #${OVERLAY_ID} .levelup-roas-program-grid,
      #${OVERLAY_ID} .levelup-roas-store-type-group,
      #${OVERLAY_ID} .levelup-roas-summary-grid {
        grid-template-columns: 1fr;
      }

      #${OVERLAY_ID} .levelup-roas-program-card + .levelup-roas-program-card {
        border-left: 0;
        border-top: 1px solid rgba(203, 213, 225, 0.85);
        padding-left: 0;
        padding-top: 10px;
      }
    }

    #${OVERLAY_ID} .levelup-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    #${OVERLAY_ID} .levelup-brand-mark {
      width: 32px;
      height: 32px;
      object-fit: contain;
      flex-shrink: 0;
    }

    #${OVERLAY_ID} .levelup-brand-copy {
      min-width: 0;
    }

    #${OVERLAY_ID} .levelup-header-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
      align-items: center;
      flex-shrink: 0;
    }

    #${OVERLAY_ID} .levelup-subtitle,
    #${OVERLAY_ID} .levelup-note,
    #${OVERLAY_ID} .levelup-status {
      margin-top: 4px;
      font-size: 12px;
      line-height: 1.5;
      color: #6b7280;
    }

    #${OVERLAY_ID} .levelup-chip {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: rgba(251, 106, 53, 0.12);
      color: #c2410c;
      white-space: nowrap;
    }

    #${OVERLAY_ID} .levelup-body {
      padding: 12px 14px 14px;
      display: grid;
      gap: 12px;
    }

    #${OVERLAY_ID} .levelup-stats {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    #${OVERLAY_ID} .levelup-card {
      border: 1px solid rgba(251, 106, 53, 0.22);
      border-radius: 14px;
      background: #fff;
      padding: 12px;
    }

    #${OVERLAY_ID} .levelup-card-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #9a3412;
    }

    #${OVERLAY_ID} .levelup-card-value {
      margin-top: 6px;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.45;
      color: #111827;
      word-break: break-word;
    }

    #${OVERLAY_ID} .levelup-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    #${OVERLAY_ID} .levelup-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 12px;
      color: #6b7280;
    }

    #${OVERLAY_ID} .levelup-summary strong {
      color: #9a3412;
      font-weight: 700;
    }

    #${OVERLAY_ID} .levelup-button {
      border: none;
      border-radius: 999px;
      padding: 9px 14px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    #${OVERLAY_ID} .levelup-button-primary {
      background: #fb6a35;
      color: #fff;
    }

    #${OVERLAY_ID} .levelup-button-secondary {
      background: rgba(251, 106, 53, 0.12);
      color: #c2410c;
    }

    #${OVERLAY_ID} .levelup-button-ghost {
      background: #fff;
      color: #9a3412;
      border: 1px solid rgba(251, 106, 53, 0.22);
    }

    #${OVERLAY_ID} .levelup-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    #${OVERLAY_ID} .levelup-results {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    }

    #${OVERLAY_ID} .levelup-result {
      border: 1px solid rgba(251, 106, 53, 0.16);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.8);
      padding: 8px;
      display: grid;
      gap: 8px;
      min-height: 100%;
      position: relative;
    }

    #${OVERLAY_ID} .levelup-result-thumb {
      position: relative;
      width: 100%;
      aspect-ratio: 1 / 1;
      border-radius: 6px;
      background: linear-gradient(180deg, rgba(251, 106, 53, 0.08), rgba(251, 106, 53, 0.14));
      overflow: hidden;
    }

    #${OVERLAY_ID} .levelup-result-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    #${OVERLAY_ID} .levelup-result-badges {
      position: absolute;
      top: 6px;
      left: 6px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      max-width: calc(100% - 12px);
    }

    #${OVERLAY_ID} .levelup-result-badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 2px 6px;
      background: rgba(255, 255, 255, 0.9);
      color: #7c2d12;
      font-size: 10px;
      line-height: 1.2;
      font-weight: 400;
      border: 1px solid rgba(251, 106, 53, 0.16);
      backdrop-filter: blur(4px);
      white-space: nowrap;
    }

    #${OVERLAY_ID} .levelup-result-badge[data-badge-tone="murah"] {
      background: rgba(220, 252, 231, 0.92);
      color: #166534;
      border-color: rgba(34, 197, 94, 0.24);
    }

    #${OVERLAY_ID} .levelup-result-badge[data-badge-tone="mahal"] {
      background: rgba(254, 242, 242, 0.92);
      color: #b91c1c;
      border-color: rgba(239, 68, 68, 0.2);
    }

    #${OVERLAY_ID} .levelup-result-badge[data-badge-tone="median"] {
      background: rgba(239, 246, 255, 0.92);
      color: #1d4ed8;
      border-color: rgba(59, 130, 246, 0.2);
    }

    #${OVERLAY_ID} .levelup-result-badge[data-badge-tone="penjualan"] {
      background: rgba(255, 247, 237, 0.92);
      color: #c2410c;
      border-color: rgba(251, 146, 60, 0.24);
    }

    #${OVERLAY_ID} .levelup-result-action-layer {
      position: absolute;
      inset: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      border-radius: 12px;
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.72));
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.18s ease;
      z-index: 3;
    }

    #${OVERLAY_ID} .levelup-result[data-hover-active="true"] .levelup-result-action-layer,
    #${OVERLAY_ID} .levelup-result:focus-within .levelup-result-action-layer,
    #${OVERLAY_ID} .levelup-result-action-layer:focus-within {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }

    #${OVERLAY_ID} .levelup-result-action-layer .levelup-hover-button {
      border: none;
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.2;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
      width: 100%;
      max-width: 150px;
    }

    #${OVERLAY_ID} .levelup-result-action-layer .levelup-hover-button-primary {
      background: #fb6a35;
      color: #fff;
    }

    #${OVERLAY_ID} .levelup-result-action-layer .levelup-hover-button-secondary {
      background: rgba(255, 255, 255, 0.96);
      color: #9a3412;
    }

    #${OVERLAY_ID} .levelup-result-action-layer .levelup-hover-button:disabled {
      opacity: 0.65;
      cursor: wait;
    }

    #${OVERLAY_ID} .levelup-product-layout {
      display: grid;
      gap: 14px;
      grid-template-columns: minmax(180px, 220px) minmax(0, 1fr);
      align-items: start;
    }

    #${OVERLAY_ID} .levelup-product-panel {
      border: 1px solid rgba(251, 106, 53, 0.16);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.85);
      padding: 14px;
    }

    #${OVERLAY_ID}[data-layout-mode="product"] .levelup-header {
      padding: 14px 16px 12px;
    }

    #${OVERLAY_ID}[data-layout-mode="product"] .levelup-body {
      padding: 14px 16px 16px;
      gap: 14px;
    }

    #${OVERLAY_ID}[data-layout-mode="product"] .levelup-product-panel {
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.92);
    }

    #${OVERLAY_ID}[data-layout-mode="product"] .levelup-actions {
      margin-bottom: 2px;
    }

    #${OVERLAY_ID} .levelup-product-image {
      position: relative;
      width: 100%;
      aspect-ratio: 1 / 1;
      border-radius: 10px;
      overflow: hidden;
      background: linear-gradient(180deg, rgba(251, 106, 53, 0.08), rgba(251, 106, 53, 0.16));
    }

    #${OVERLAY_ID} .levelup-product-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    #${OVERLAY_ID} .levelup-product-title {
      font-size: 15px;
      font-weight: 500;
      line-height: 1.6;
      color: #111827;
    }

    #${OVERLAY_ID} .levelup-product-meta {
      display: grid;
      gap: 6px;
      margin-top: 12px;
      font-size: 12px;
      line-height: 1.55;
      color: #4b5563;
    }

    #${OVERLAY_ID} .levelup-product-stats {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 12px;
    }

    #${OVERLAY_ID} .levelup-product-insight {
      margin-top: 12px;
      padding: 10px 12px;
      border: 1px solid rgba(251, 106, 53, 0.16);
      border-radius: 14px;
      background: rgba(255, 247, 243, 0.72);
      font-size: 12px;
      line-height: 1.55;
      color: #4b5563;
    }

    #${OVERLAY_ID} .levelup-highlights {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    #${OVERLAY_ID} .levelup-highlight-chip {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 5px 10px;
      background: rgba(251, 106, 53, 0.08);
      color: #9a3412;
      font-size: 11px;
      line-height: 1.4;
      font-weight: 400;
    }

    #${OVERLAY_ID} .levelup-product-link {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #64748b;
    }

    #${OVERLAY_ID} .levelup-result-rank {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 4px 7px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      background: rgba(251, 106, 53, 0.12);
      color: #c2410c;
      width: fit-content;
    }

    #${OVERLAY_ID} .levelup-result-title {
      font-size: 12px;
      font-weight: 400;
      line-height: 1.5;
      color: #111827;
      min-height: 36px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    #${OVERLAY_ID} .levelup-result-shop {
      font-size: 11px;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #${OVERLAY_ID} .levelup-result-meta-grid {
      display: grid;
      gap: 6px;
      margin-top: 2px;
    }

    #${OVERLAY_ID} .levelup-result-meta-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 8px;
      align-items: center;
    }

    #${OVERLAY_ID} .levelup-result-meta-cell {
      font-size: 11px;
      line-height: 1.45;
      color: #4b5563;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #${OVERLAY_ID} .levelup-result-meta-cell[data-align="right"] {
      text-align: right;
    }

    #${OVERLAY_ID} .levelup-result-meta-cell[data-tone="primary"] {
      color: #111827;
      font-weight: 600;
    }

    #${OVERLAY_ID} .levelup-result-meta-cell[data-tone="accent"] {
      color: #c2410c;
      font-weight: 500;
    }

    @media (max-width: 960px) {
      #${OVERLAY_ID} .levelup-stats {
        grid-template-columns: 1fr;
      }

      #${OVERLAY_ID} .levelup-product-layout {
        grid-template-columns: 1fr;
      }

      #${OVERLAY_ID} .levelup-results {
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      }
    }
  `;

  document.head.appendChild(style);
}

function computeRoasMetrics() {
  const price = roasCalculatorState.price ?? null;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  const hpp = roasCalculatorState.hpp ?? 0;
  const operasional = roasCalculatorState.operasional ?? 0;
  const kategoriPct = roasCalculatorState.kategoriFeePct ?? 0;

  const feeKategori = price * (kategoriPct / 100);
  const feePromoXtra = roasCalculatorState.promoXtraEnabled
    ? Math.min(
        price * (SHOPEE_PROMO_XTRA_FEE_PCT / 100),
        SHOPEE_PROMO_XTRA_FEE_CAP_IDR,
      )
    : 0;
  const feeGratisOngkirXtra = roasCalculatorState.gratisOngkirXtraEnabled
    ? price * (SHOPEE_GRATIS_ONGKIR_XTRA_FEE_PCT / 100)
    : 0;
  const feeProsesPesanan = SHOPEE_ORDER_PROCESSING_FEE_IDR;
  const totalBiayaShopee =
    feeKategori + feePromoXtra + feeGratisOngkirXtra + feeProsesPesanan;
  const totalBiayaShopeePct = (totalBiayaShopee / price) * 100;

  const biayaPokok = hpp + operasional + totalBiayaShopee;
  const profitSebelumIklan = price - biayaPokok;
  const contributionMarginRatio = profitSebelumIklan / price;
  const breakEvenRoas =
    Number.isFinite(contributionMarginRatio) && contributionMarginRatio > 0
      ? 1 / contributionMarginRatio
      : null;

  const tiers = [
    {
      key: 'rugi',
      label: 'Rugi',
      tone: 'danger',
      resolveRoas: (base: number) => base,
    },
    {
      key: 'kompetitif',
      label: 'Kompetitif',
      tone: 'warning',
      resolveRoas: (base: number) => Math.max(base * 1.32, base + 0.8),
    },
    {
      key: 'konservatif',
      label: 'Konservatif',
      tone: 'safe',
      resolveRoas: (base: number) => Math.max(base * 1.75, base + 1.8),
    },
    {
      key: 'prospektif',
      label: 'Prospektif',
      tone: 'prospect',
      resolveRoas: (base: number) => Math.max(base * 2.5, base + 3.5),
    },
  ].map((tier) => {
    if (
      !Number.isFinite(profitSebelumIklan) ||
      profitSebelumIklan <= 0 ||
      typeof breakEvenRoas !== 'number' ||
      !Number.isFinite(breakEvenRoas)
    ) {
      return {
        ...tier,
        roas: null as number | null,
        biayaIklan: null as number | null,
        profit: profitSebelumIklan,
        marginPct: (profitSebelumIklan / price) * 100,
      };
    }

    const roas = tier.resolveRoas(breakEvenRoas);
    const biayaIklan = roas > 0 ? price / roas : null;
    const profit = profitSebelumIklan - biayaIklan;
    const marginPct = (profit / price) * 100;
    return { ...tier, roas, biayaIklan, profit, marginPct };
  });

  return {
    price,
    biayaPokok,
    profitSebelumIklan,
    breakEvenRoas,
    tiers,
    totalBiayaShopee,
    totalBiayaShopeePct,
    feeKategori,
    feePromoXtra,
    feeGratisOngkirXtra,
    feeProsesPesanan,
  };
}

function getRoasTierTooltipText(
  key: 'rugi' | 'kompetitif' | 'konservatif' | 'prospektif',
  roasValue: number | null,
  profitValue: number | null,
  breakEvenRoas?: number | null,
) {
  if (typeof roasValue !== 'number' || !Number.isFinite(roasValue) || roasValue <= 0) {
    return 'Nilai ROAS belum bisa dihitung karena profit sebelum iklan <= 0.';
  }

  const profitHint =
    typeof profitValue === 'number' && Number.isFinite(profitValue)
      ? ` ${formatCompactCurrency(Math.round(profitValue))} adalah estimasi profit setelah biaya iklan pada target ROAS ini.`
      : '';

  if (key === 'rugi') {
    return `Jika ROAS anda di bawah ${roasValue.toFixed(1)}, maka iklan anda boncos.${profitHint}`;
  }

  if (key === 'kompetitif') {
    return `Pakai target ROAS sekitar ${roasValue.toFixed(1)} untuk iklan dengan tujuan traffic, dengan jarak lebih tinggi di atas break-even${typeof breakEvenRoas === 'number' ? ` ${breakEvenRoas.toFixed(1)}` : ''}.${profitHint}`;
  }

  if (key === 'konservatif') {
    return `Pakai target ROAS sekitar ${roasValue.toFixed(1)} untuk iklan dengan tujuan profit, dengan jarak aman yang lebih lebar di atas break-even${typeof breakEvenRoas === 'number' ? ` ${breakEvenRoas.toFixed(1)}` : ''}.${profitHint}`;
  }

  return `Gunakan target ROAS sekitar ${roasValue.toFixed(1)} untuk tes pasar atau produk baru, dengan buffer yang lebih tinggi dari tier lain.${profitHint}`;
}

function closeRoasCalculator() {
  isRoasCalculatorOpen = false;
  isOverlayInteractionLocked = false;
  const overlay = document.getElementById(OVERLAY_ID);
  overlay?.querySelector<HTMLElement>('[data-role="roas-modal"]')?.remove();
  overlay?.querySelector<HTMLElement>('[data-role="roas-category-modal"]')?.remove();

  if (hasDeferredRefresh) {
    hasDeferredRefresh = false;
    queueRefresh();
  }
}

type CategoryPickerItem = {
  id: string;
  name: string;
  pct: number;
  notes: string | null;
};

type CategoryPickerSub = {
  name: string;
  items: CategoryPickerItem[];
};

type CategoryPickerGroup = {
  name: string;
  subs: CategoryPickerSub[];
};

function createEmptyCategoryPickerCatalog(): CategoryPickerCatalog {
  return {
    non_star: [],
    star: [],
    mall: [],
  };
}

function mapCategoryFeeStoreType(
  storeType: MarketplaceCategoryFeeSummary['storeType'],
): RoasCalculatorState['storeType'] {
  switch (storeType) {
    case 'STAR':
      return 'star';
    case 'MALL':
      return 'mall';
    case 'NON_STAR':
    default:
      return 'non_star';
  }
}

function buildCategoryPickerCatalog(
  fees: MarketplaceCategoryFeeSummary[],
): CategoryPickerCatalog {
  const grouped = {
    non_star: new Map<string, Map<string, CategoryPickerItem[]>>(),
    star: new Map<string, Map<string, CategoryPickerItem[]>>(),
    mall: new Map<string, Map<string, CategoryPickerItem[]>>(),
  };

  for (const fee of fees) {
    const storeType = mapCategoryFeeStoreType(fee.storeType);
    const primaryCategory = normalizeText(fee.primaryCategory) || 'Lainnya';
    const secondaryCategory = normalizeText(fee.secondaryCategory) || 'Tanpa Subkategori';
    const categoryName = normalizeText(fee.categoryName);

    if (!categoryName) {
      continue;
    }

    let secondaryMap = grouped[storeType].get(primaryCategory);
    if (!secondaryMap) {
      secondaryMap = new Map<string, CategoryPickerItem[]>();
      grouped[storeType].set(primaryCategory, secondaryMap);
    }

    let items = secondaryMap.get(secondaryCategory);
    if (!items) {
      items = [];
      secondaryMap.set(secondaryCategory, items);
    }

    items.push({
      id: fee.id,
      name: categoryName,
      pct: fee.feePercent,
      notes: normalizeText(fee.notes) || null,
    });
  }

  const toGroups = (
    groups: Map<string, Map<string, CategoryPickerItem[]>>,
  ): CategoryPickerGroup[] =>
    Array.from(groups.entries())
      .sort(([left], [right]) => left.localeCompare(right, 'id-ID'))
      .map(([groupName, subs]) => ({
        name: groupName,
        subs: Array.from(subs.entries())
          .sort(([left], [right]) => left.localeCompare(right, 'id-ID'))
          .map(([subName, items]) => ({
            name: subName,
            items: [...items].sort((left, right) => left.name.localeCompare(right.name, 'id-ID')),
          })),
      }));

  return {
    non_star: toGroups(grouped.non_star),
    star: toGroups(grouped.star),
    mall: toGroups(grouped.mall),
  };
}

function clearRoasCategorySelection() {
  roasCalculatorState.categoryLabel = null;
  roasCalculatorState.kategoriFeePct = 0;
  lastRoasCategorySelectionSource = null;
  lastSelectedRoasCategory = null;
}

function applyRoasCategorySelection(
  selection: {
    primary: string;
    secondary: string | null;
    name: string | null;
    pct: number | null;
  },
  source: 'auto' | 'manual',
) {
  roasCalculatorState.categoryLabel =
    normalizeText(selection.secondary) ||
    normalizeText(selection.primary) ||
    normalizeText(selection.name) ||
    null;
  roasCalculatorState.kategoriFeePct =
    typeof selection.pct === 'number' && Number.isFinite(selection.pct)
      ? selection.pct
      : 0;
  lastSelectedRoasCategory = {
    primary: normalizeText(selection.primary),
    secondary: normalizeText(selection.secondary) || null,
    name: normalizeText(selection.name) || null,
  };
  lastRoasCategorySelectionSource = source;
}

function findMatchingRoasCategoryForStoreType(
  catalog: CategoryPickerCatalog,
  storeType: RoasCalculatorState['storeType'],
  selection: RoasCategorySelection | null,
) {
  if (!selection) {
    return null;
  }

  const groups = catalog[storeType] ?? [];
  const primaryLabel = normalizeComparableLabel(selection.primary);
  const secondaryLabel = normalizeComparableLabel(selection.secondary ?? '');
  const itemLabel = normalizeComparableLabel(selection.name ?? '');

  let fallbackBySecondary: {
    primary: string;
    secondary: string | null;
    name: string | null;
    pct: number;
  } | null = null;

  for (const group of groups) {
    if (normalizeComparableLabel(group.name) !== primaryLabel) {
      continue;
    }

    for (const sub of group.subs) {
      if (normalizeComparableLabel(sub.name) !== secondaryLabel) {
        continue;
      }

      if (!fallbackBySecondary && sub.items[0]) {
        fallbackBySecondary = {
          primary: group.name,
          secondary: sub.name,
          name: sub.items[0].name,
          pct: sub.items[0].pct,
        };
      }

      for (const item of sub.items) {
        if (itemLabel && normalizeComparableLabel(item.name) === itemLabel) {
          return {
            primary: group.name,
            secondary: sub.name,
            name: item.name,
            pct: item.pct,
          };
        }
      }
    }
  }

  return fallbackBySecondary;
}

async function loadRoasCategoryCatalog(force = false) {
  if (!force && roasCategoryCatalogState.status === 'ready') {
    return roasCategoryCatalogState.catalog;
  }

  if (!force && roasCategoryCatalogState.promise) {
    return roasCategoryCatalogState.promise;
  }

  roasCategoryCatalogState.status = 'loading';
  roasCategoryCatalogState.error = null;

  const request = sendBackgroundMessage<MarketplaceCategoryFeeSummary[]>({
    type: 'GET_MARKETPLACE_CATEGORY_FEES',
  })
    .then((fees) => {
      const catalog = buildCategoryPickerCatalog(fees);
      roasCategoryCatalogState.catalog = catalog;
      roasCategoryCatalogState.status = 'ready';
      return catalog;
    })
    .catch((error: unknown) => {
      roasCategoryCatalogState.status = 'error';
      roasCategoryCatalogState.error =
        error instanceof Error
          ? error.message
          : 'Master fee kategori belum berhasil dimuat.';
      throw error;
    })
    .finally(() => {
      roasCategoryCatalogState.promise = null;
    });

  roasCategoryCatalogState.promise = request;
  return request;
}

type ShopeeBreadcrumbCategory = {
  primary: string | null;
  secondary: string | null;
  name: string | null;
  parts: string[];
};

type RoasCategorySuggestion = {
  storeType: RoasCalculatorState['storeType'];
  primary: string;
  secondary: string | null;
  name: string | null;
  pct: number | null;
};

let lastRoasCategorySuggestion: RoasCategorySuggestion | null = null;
let lastRoasCategorySuggestionKey: string | null = null;
let lastRoasCategorySelectionSource: 'auto' | 'manual' | null = null;

function normalizeComparableLabel(value: string) {
  return normalizeText(value).toLowerCase();
}

const SHOPEE_SEED_NOTE_PREFIX =
  /^Sumber:\s*Shopee artikel 15965,\s*berlaku 2025-01-01\.\s*/i;

function formatCategoryPickerNote(notes: string | null) {
  const normalized = normalizeText(notes);
  if (!normalized) {
    return null;
  }

  const cleaned = normalized.replace(SHOPEE_SEED_NOTE_PREFIX, '').trim();
  if (!cleaned) {
    return null;
  }

  return cleaned.replace(/^Cakupan produk:\s*/i, '').replace(/^Cakupan:\s*/i, '').trim();
}

type CategoryPickerSearchResult = {
  groupIndex: number;
  subIndex: number;
  groupName: string;
  subName: string;
  item: CategoryPickerItem;
};

function findCategoryPickerSearchResults(
  groups: CategoryPickerGroup[],
  query: string,
): CategoryPickerSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  return groups.flatMap((group, groupIndex) =>
    group.subs.flatMap((sub, subIndex) =>
      sub.items
        .filter((item) =>
          [
            normalizeText(group.name),
            normalizeText(sub.name),
            normalizeText(item.name),
            normalizeText(formatCategoryPickerNote(item.notes)),
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery),
        )
        .map((item) => ({
          groupIndex,
          subIndex,
          groupName: group.name,
          subName: sub.name,
          item,
        })),
    ),
  );
}

function extractShopeeBreadcrumbCategory(): ShopeeBreadcrumbCategory | null {
  const selectors = [
    '.page-product__breadcrumb a',
    '.shopee-breadcrumb a',
    '[aria-label="breadcrumb"] a',
    'nav[aria-label="breadcrumb"] a',
    'nav[aria-label="Breadcrumb"] a',
    '.breadcrumb a',
  ];

  let parts: string[] = [];
  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const labels = nodes
      .map((node) => normalizeText(node.textContent))
      .filter((label) => label.length > 0);
    if (labels.length >= 2) {
      parts = labels;
      break;
    }
  }

  if (parts.length < 2) {
    return null;
  }

  const cleaned = parts
    .map((part) => normalizeText(part))
    .filter((part) => part.length > 0)
    .filter((part) => normalizeComparableLabel(part) !== 'shopee');

  if (cleaned.length === 0) {
    return null;
  }

  return {
    parts: cleaned,
    primary: cleaned[0] ?? null,
    secondary: cleaned[1] ?? null,
    name: cleaned[2] ?? null,
  };
}

function findBestRoasCatalogMatch(
  catalog: CategoryPickerCatalog,
  storeType: RoasCalculatorState['storeType'],
  breadcrumb: ShopeeBreadcrumbCategory,
) {
  const groups = catalog[storeType] ?? [];
  if (groups.length === 0) {
    return null;
  }

  const primaryCandidate = breadcrumb.primary ? normalizeComparableLabel(breadcrumb.primary) : null;
  const secondaryCandidate = breadcrumb.secondary ? normalizeComparableLabel(breadcrumb.secondary) : null;
  const nameCandidate = breadcrumb.name ? normalizeComparableLabel(breadcrumb.name) : null;

  const groupIndex = primaryCandidate
    ? groups.findIndex((group) => normalizeComparableLabel(group.name) === primaryCandidate)
    : -1;
  const resolvedGroup = groupIndex >= 0 ? groups[groupIndex] : null;

  const fallbackGroupIndex =
    resolvedGroup || !primaryCandidate
      ? groupIndex
      : groups.findIndex((group) =>
          breadcrumb.parts.some(
            (part) => normalizeComparableLabel(group.name) === normalizeComparableLabel(part),
          ),
        );
  const finalGroupIndex = fallbackGroupIndex >= 0 ? fallbackGroupIndex : -1;
  const group = finalGroupIndex >= 0 ? groups[finalGroupIndex] : null;
  if (!group) {
    return null;
  }

  const subs = group.subs ?? [];
  const subIndex = secondaryCandidate
    ? subs.findIndex((sub) => normalizeComparableLabel(sub.name) === secondaryCandidate)
    : -1;
  const resolvedSub = subIndex >= 0 ? subs[subIndex] : null;
  const fallbackSubIndex =
    resolvedSub || !secondaryCandidate
      ? subIndex
      : subs.findIndex((sub) =>
          breadcrumb.parts.some(
            (part) => normalizeComparableLabel(sub.name) === normalizeComparableLabel(part),
          ),
        );
  const finalSubIndex = fallbackSubIndex >= 0 ? fallbackSubIndex : -1;
  const sub = finalSubIndex >= 0 ? subs[finalSubIndex] : null;

  const items = sub?.items ?? [];
  const item =
    nameCandidate && items.length
      ? items.find((candidate) => normalizeComparableLabel(candidate.name) === nameCandidate) ??
        items.find((candidate) =>
          breadcrumb.parts.some(
            (part) =>
              normalizeComparableLabel(candidate.name) === normalizeComparableLabel(part),
          ),
        ) ??
        null
      : null;

  return {
    groupIndex: finalGroupIndex,
    subIndex: finalSubIndex,
    primary: group.name,
    secondary: sub?.name ?? null,
    name: item?.name ?? null,
    pct: typeof item?.pct === 'number' ? item.pct : null,
  };
}

async function maybeAutoSuggestRoasCategory(detail: ProductDetailSnapshot) {
  const breadcrumb = extractShopeeBreadcrumbCategory();
  if (!breadcrumb) {
    return false;
  }

  const suggestionKey = `${detail.productUrl}|${roasCalculatorState.storeType}|${breadcrumb.parts.join('>')}`;
  if (suggestionKey === lastRoasCategorySuggestionKey) {
    return false;
  }

  const currentState = await sendBackgroundMessage<ExtensionState>({
    type: 'GET_STATE',
  }).catch(() => null);
  if (currentState) {
    lastKnownState = currentState;
  }

  if (!hasExtensionLogin(currentState ?? lastKnownState)) {
    return false;
  }

  const catalog = await loadRoasCategoryCatalog().catch(() => null);
  if (!catalog) {
    return false;
  }

  lastRoasCategorySuggestionKey = suggestionKey;

  const match = findBestRoasCatalogMatch(
    catalog,
    roasCalculatorState.storeType,
    breadcrumb,
  );
  if (!match) {
    lastRoasCategorySuggestion = {
      storeType: roasCalculatorState.storeType,
      primary: breadcrumb.primary ?? 'Lainnya',
      secondary: breadcrumb.secondary,
      name: breadcrumb.name,
      pct: null,
    };
    return false;
  }

  lastRoasCategorySuggestion = {
    storeType: roasCalculatorState.storeType,
    primary: match.primary,
    secondary: match.secondary,
    name: match.name,
    pct: match.pct,
  };

  const alreadyChosen =
    Boolean(roasCalculatorState.categoryLabel) ||
    (typeof roasCalculatorState.kategoriFeePct === 'number' &&
      roasCalculatorState.kategoriFeePct > 0);

  if (alreadyChosen) {
    return false;
  }

  if (typeof match.pct === 'number' && Number.isFinite(match.pct)) {
    const previousPct = roasCalculatorState.kategoriFeePct;
    applyRoasCategorySelection(match, 'auto');
    return previousPct !== match.pct;
  }

  return false;
}

function getRoasCategoryHelperText() {
  if (
    lastRoasCategorySelectionSource === 'auto' &&
    lastRoasCategorySuggestion &&
    lastRoasCategorySuggestion.storeType === roasCalculatorState.storeType &&
    typeof lastRoasCategorySuggestion.pct === 'number'
  ) {
    const parts = [
      lastRoasCategorySuggestion.primary,
      lastRoasCategorySuggestion.secondary,
      lastRoasCategorySuggestion.name,
    ].filter((part) => Boolean(normalizeText(part)));
    return `Fee kategori terisi otomatis dari kategori Shopee: ${parts.join(' > ')}.`;
  }

  return null;
}

function openRoasCategoryLoginGate(storeTypeLabel: string) {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    return;
  }

  const existing = overlay.querySelector<HTMLElement>('[data-role="roas-category-modal"]');
  if (existing) {
    existing.remove();
  }

  const modal = document.createElement('div');
  modal.className = 'levelup-modal-backdrop';
  modal.dataset.role = 'roas-category-modal';
  modal.innerHTML = `
    <div class="levelup-modal levelup-modal-roas" role="dialog" aria-modal="true">
      <div class="levelup-modal-header">
        <div class="levelup-modal-title">Pilih Fee Kategori Produk ${storeTypeLabel}</div>
        <div class="levelup-modal-actions">
          <button type="button" class="levelup-button levelup-button-primary" data-action="roas-category-close">Tutup</button>
        </div>
      </div>
      <div class="levelup-modal-body">
        <div class="levelup-auth-gate">
          <div class="levelup-auth-gate-card">
            <div class="levelup-auth-gate-title">Login diperlukan</div>
            <div class="levelup-auth-gate-text">Master fee kategori diambil dari dashboard LevelUP adsPRO. Untuk membuka daftar kategori Shopee, silakan login extension terlebih dahulu.</div>
            <div class="levelup-product-insight">Setelah login selesai, kembali ke halaman produk lalu klik tombol <strong>Pilih</strong> sekali lagi.</div>
            <div class="levelup-auth-gate-actions">
              <button type="button" class="levelup-button levelup-button-secondary" data-action="roas-category-close">Nanti Saja</button>
              <button type="button" class="levelup-button levelup-button-primary" data-action="roas-open-login">Login Sekarang</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.remove();
    }
  });

  modal.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (target.matches('[data-action="roas-category-close"]')) {
      modal.remove();
      return;
    }

    if (target.matches('[data-action="roas-open-login"]')) {
      void sendBackgroundMessage<{ success: true }>({
        type: 'OPEN_EXTENSION_LOGIN',
      }).finally(() => {
        modal.remove();
      });
    }
  });

  overlay.appendChild(modal);
}

async function openRoasCategoryPicker() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay || !lastRoasProductDetail) {
    return;
  }

  const existing = overlay.querySelector<HTMLElement>('[data-role="roas-category-modal"]');
  if (existing) {
    existing.remove();
  }

  const modal = document.createElement('div');
  modal.className = 'levelup-modal-backdrop';
  modal.dataset.role = 'roas-category-modal';

  const storeTypeLabel =
    roasCalculatorState.storeType === 'mall'
      ? 'Mall'
      : roasCalculatorState.storeType === 'star'
        ? 'Star/Star+'
        : 'Non-Star';

  const currentState = await sendBackgroundMessage<ExtensionState>({
    type: 'GET_STATE',
  }).catch(() => null);
  if (currentState) {
    lastKnownState = currentState;
  }

  if (!hasExtensionLogin(currentState ?? lastKnownState)) {
    openRoasCategoryLoginGate(storeTypeLabel);
    return;
  }

  modal.innerHTML = `
    <div class="levelup-modal levelup-modal-roas" role="dialog" aria-modal="true">
      <div class="levelup-modal-header">
        <div class="levelup-modal-title">Pilih Fee Kategori Produk ${storeTypeLabel}</div>
        <div class="levelup-modal-actions">
          <button type="button" class="levelup-button levelup-button-primary" data-action="roas-category-close">Tutup</button>
        </div>
      </div>
      <div class="levelup-modal-body">
        <div class="levelup-category-modal-layout">
          <div class="levelup-category-column" data-role="group-column">
            <div class="levelup-category-column-header">Kategori</div>
            <div class="levelup-category-list" data-role="group-list"></div>
          </div>
          <div class="levelup-category-column" data-role="sub-column">
            <div class="levelup-category-column-header">Sub Kategori</div>
            <div class="levelup-category-list" data-role="sub-list"></div>
          </div>
          <div class="levelup-category-column" data-role="item-column">
            <div class="levelup-category-search"><input type="search" placeholder="Cari di semua kategori..." data-role="search-input" /></div>
            <div class="levelup-category-cards" data-role="item-list"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  let activeGroupIndex = 0;
  let activeSubIndex = 0;
  let query = '';
  let catalog = roasCategoryCatalogState.catalog;
  let isLoading = true;
  let loadError: string | null = null;
  let activePrimaryCategoryLabel = '';
  let hasAppliedSuggestion = false;

  const groupList = modal.querySelector<HTMLElement>('[data-role="group-list"]');
  const subList = modal.querySelector<HTMLElement>('[data-role="sub-list"]');
  const itemList = modal.querySelector<HTMLElement>('[data-role="item-list"]');
  const searchInput = modal.querySelector<HTMLInputElement>('[data-role="search-input"]');
  const closeButton = modal.querySelector<HTMLButtonElement>('[data-action="roas-category-close"]');

  const render = () => {
    const groups = catalog[roasCalculatorState.storeType] ?? [];
    if (
      !hasAppliedSuggestion &&
      lastRoasCategorySuggestion &&
      lastRoasCategorySuggestion.storeType === roasCalculatorState.storeType &&
      groups.length > 0
    ) {
      const suggestedGroupIndex = groups.findIndex(
        (group) =>
          normalizeComparableLabel(group.name) ===
          normalizeComparableLabel(lastRoasCategorySuggestion.primary),
      );
      if (suggestedGroupIndex >= 0) {
        activeGroupIndex = suggestedGroupIndex;
        const subs = groups[suggestedGroupIndex]?.subs ?? [];
        if (lastRoasCategorySuggestion.secondary) {
          const suggestedSubIndex = subs.findIndex(
            (sub) =>
              normalizeComparableLabel(sub.name) ===
              normalizeComparableLabel(lastRoasCategorySuggestion.secondary ?? ''),
          );
          if (suggestedSubIndex >= 0) {
            activeSubIndex = suggestedSubIndex;
          }
        }
      }
      hasAppliedSuggestion = true;
    }
    const activeGroup = groups[activeGroupIndex] ?? groups[0] ?? null;
    const subs = activeGroup?.subs ?? [];
    const activeSub = subs[activeSubIndex] ?? subs[0] ?? null;
    activePrimaryCategoryLabel = activeGroup?.name ?? '';

    if (groupList) {
      groupList.innerHTML = '';
    }

    if (subList) {
      subList.innerHTML = '';
    }

    if (searchInput) {
      searchInput.disabled = isLoading || Boolean(loadError) || groups.length === 0;
    }

    if (isLoading) {
      if (itemList) {
        itemList.innerHTML =
          '<div class="levelup-product-insight">Memuat master fee kategori dari dashboard...</div>';
      }
      return;
    }

    if (loadError) {
      if (itemList) {
        itemList.innerHTML = `
          <div class="levelup-product-insight">${loadError}</div>
          <div><button type="button" class="levelup-button levelup-button-primary" data-action="roas-category-retry">Coba Lagi</button></div>
        `;
      }
      return;
    }

    if (groups.length === 0) {
      if (itemList) {
        itemList.innerHTML =
          '<div class="levelup-product-insight">Belum ada master fee kategori Shopee aktif untuk jenis toko ini. Tambahkan dari dashboard Settings atau isi persen manual di field kategori.</div>';
      }
      return;
    }

    if (groupList) {
      groupList.innerHTML = groups
        .map(
          (group, index) =>
            `<button type="button" class="levelup-category-item" data-role="group-item" data-index="${index}" data-active="${index === activeGroupIndex}">${group.name}</button>`,
        )
        .join('');
    }

    if (subList) {
      subList.innerHTML = subs
        .map(
          (sub, index) =>
            `<button type="button" class="levelup-category-item" data-role="sub-item" data-index="${index}" data-active="${index === activeSubIndex}">${sub.name}</button>`,
        )
        .join('');
    }

    const items = activeSub?.items ?? [];
    const searchResults = query
      ? findCategoryPickerSearchResults(groups, query)
      : [];

    if (itemList) {
      itemList.innerHTML =
        (query ? searchResults.length === 0 : items.length === 0)
          ? `<div class="levelup-product-insight">${
              query
                ? 'Kategori belum ditemukan untuk pencarian ini. Anda tetap bisa isi persen manual di field kategori.'
                : 'Belum ada kategori aktif di sub kategori ini.'
            }</div>`
          : (query ? searchResults : items)
              .map((entry) => {
                const item = 'item' in entry ? entry.item : entry;
                const primaryCategory = 'groupName' in entry ? entry.groupName : activeGroup?.name ?? '';
                const secondaryCategory = 'subName' in entry ? entry.subName : activeSub?.name ?? '';
                const note = formatCategoryPickerNote(item.notes);
                const pathLabel = [primaryCategory, secondaryCategory, item.name]
                  .filter((part) => Boolean(normalizeText(part)))
                  .join(' > ');

                return `
                  <div class="levelup-category-card">
                    <div class="levelup-category-card-header">
                      <div>
                        <div class="levelup-category-card-title">${item.name}</div>
                        ${
                          query
                            ? `<div class="levelup-product-insight">${pathLabel}</div>`
                            : ''
                        }
                      </div>
                      <div class="levelup-category-card-meta">
                        <div class="levelup-category-card-fee">${item.pct.toFixed(2)}%</div>
                        <button type="button" class="levelup-button levelup-button-primary" data-action="roas-pick-item" data-id="${item.id}" data-name="${encodeURIComponent(item.name)}" data-pct="${item.pct}" data-group-index="${
                          'groupIndex' in entry ? entry.groupIndex : activeGroupIndex
                        }" data-sub-index="${
                          'subIndex' in entry ? entry.subIndex : activeSubIndex
                        }" data-primary="${encodeURIComponent(primaryCategory)}" data-secondary="${encodeURIComponent(secondaryCategory)}">Pilih</button>
                      </div>
                    </div>
                    ${note ? `<div class="levelup-product-insight">${note}</div>` : ''}
                  </div>
                `;
              })
              .join('');
    }
  };

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.remove();
    }
  });

  closeButton?.addEventListener('click', () => {
    modal.remove();
  });

  searchInput?.addEventListener('input', () => {
    query = searchInput.value.trim();
    render();
  });

  modal.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (target.matches('[data-action="roas-category-retry"]')) {
      isLoading = true;
      loadError = null;
      render();
      void loadRoasCategoryCatalog(true)
        .then((nextCatalog) => {
          if (!modal.isConnected) {
            return;
          }
          catalog = nextCatalog;
          activeGroupIndex = 0;
          activeSubIndex = 0;
          query = '';
          if (searchInput) {
            searchInput.value = '';
          }
          isLoading = false;
          render();
        })
        .catch((error: unknown) => {
          if (!modal.isConnected) {
            return;
          }
          isLoading = false;
          loadError =
            error instanceof Error
              ? error.message
              : 'Master fee kategori belum berhasil dimuat.';
          render();
        });
      return;
    }

    const groupIndex = target.getAttribute('data-index');
    if (target.matches('[data-role="group-item"]') && groupIndex) {
      activeGroupIndex = Number.parseInt(groupIndex, 10);
      activeSubIndex = 0;
      render();
      return;
    }

    const subIndex = target.getAttribute('data-index');
    if (target.matches('[data-role="sub-item"]') && subIndex) {
      activeSubIndex = Number.parseInt(subIndex, 10);
      render();
      return;
    }

    if (target.matches('[data-action="roas-pick-item"]')) {
      const name = target.getAttribute('data-name');
      const pctRaw = target.getAttribute('data-pct');
      const groupIndexRaw = target.getAttribute('data-group-index');
      const subIndexRaw = target.getAttribute('data-sub-index');
      const primaryCategory = decodeURIComponent(target.getAttribute('data-primary') ?? '');
      const secondaryCategory = decodeURIComponent(target.getAttribute('data-secondary') ?? '');
      const pct = pctRaw ? Number.parseFloat(pctRaw) : null;
      if (!name || pct === null || !Number.isFinite(pct)) {
        return;
      }

      if (groupIndexRaw) {
        activeGroupIndex = Number.parseInt(groupIndexRaw, 10);
      }

      if (subIndexRaw) {
        activeSubIndex = Number.parseInt(subIndexRaw, 10);
      }

      applyRoasCategorySelection(
        {
          primary:
            normalizeText(primaryCategory) || normalizeText(activePrimaryCategoryLabel) || '',
          secondary: normalizeText(secondaryCategory) || null,
          name: decodeURIComponent(name),
          pct,
        },
        'manual',
      );
      modal.remove();
      openRoasCalculator(lastRoasProductDetail);
    }
  });

  overlay.appendChild(modal);
  render();

  try {
    catalog = await loadRoasCategoryCatalog();
    if (!modal.isConnected) {
      return;
    }
    isLoading = false;
    loadError = null;
    render();
  } catch (error) {
    if (!modal.isConnected) {
      return;
    }
    isLoading = false;
    loadError =
      error instanceof Error ? error.message : 'Master fee kategori belum berhasil dimuat.';
    render();
  }
}

function openRoasCalculator(detail: ProductDetailSnapshot | null | undefined) {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay || !detail) {
    return;
  }

  lastRoasProductDetail = detail;
  isRoasCalculatorOpen = true;
  isOverlayInteractionLocked = true;

  const defaults = getSelectedShopRoasDefaults(lastKnownState);
  if (defaults) {
    if (defaults.shopId !== lastAppliedRoasDefaultsShopId) {
      const previousStoreType = roasCalculatorState.storeType;
      if (defaults.storeType) {
        roasCalculatorState.storeType = defaults.storeType;
      }
      roasCalculatorState.promoXtraEnabled = defaults.promoXtraEnabled;
      lastAppliedRoasDefaultsShopId = defaults.shopId;

      if (roasCalculatorState.storeType !== previousStoreType) {
        clearRoasCategorySelection();
        lastRoasCategorySuggestion = null;
        lastRoasCategorySuggestionKey = null;
      }
    }
  } else {
    lastAppliedRoasDefaultsShopId = null;
  }

  if (roasCalculatorState.price === null) {
    roasCalculatorState.price = getRepresentativeProductPrice(detail);
  }

  void maybeAutoSuggestRoasCategory(detail).then((didUpdate) => {
    if (!didUpdate) {
      return;
    }
    if (!isRoasCalculatorOpen || lastRoasProductDetail?.productUrl !== detail.productUrl) {
      return;
    }
    openRoasCalculator(detail);
  });

  const existing = overlay.querySelector<HTMLElement>('[data-role="roas-modal"]');
  if (existing) {
    existing.remove();
  }

  const metrics = computeRoasMetrics();
  const tiers = metrics?.tiers ?? [];
  const profitSebelumIklan = metrics?.profitSebelumIklan ?? null;
  const profitSebelumIklanPct =
    metrics && typeof metrics.price === 'number' && metrics.price > 0
      ? (metrics.profitSebelumIklan / metrics.price) * 100
      : null;
  const categoryHelperText = getRoasCategoryHelperText();

  const modal = document.createElement('div');
  modal.className = 'levelup-modal-backdrop';
  modal.dataset.role = 'roas-modal';
  modal.innerHTML = `
    <div class="levelup-modal levelup-modal-roas" role="dialog" aria-modal="true">
      <div class="levelup-modal-header">
        <div class="levelup-modal-title">Kalkulator ROAS | LevelUP adsPRO</div>
        <div class="levelup-modal-actions">
          <button type="button" class="levelup-button levelup-button-secondary" data-action="roas-reset">Reset Data</button>
          <button type="button" class="levelup-button levelup-button-primary" data-action="roas-close">Sembunyikan Detail</button>
        </div>
      </div>
      <div class="levelup-roas-bar">
        ${tiers
          .map(
            (tier) => `
              <div class="levelup-roas-tier" data-tone="${tier.tone}" data-key="${tier.key}">
                <div class="levelup-roas-tier-main">
                  <span class="levelup-roas-tier-label" data-role="roas-tier-label">${tier.label} ROAS ${typeof tier.roas === 'number' ? tier.roas.toFixed(1) : '-'}</span>
                </div>
                <span data-role="roas-tier-profit">${formatCompactCurrency(Math.round(tier.profit))}</span>
                <span class="levelup-tooltip-panel" data-role="roas-tier-tooltip">${getRoasTierTooltipText(tier.key, tier.roas, tier.profit, metrics?.breakEvenRoas ?? null)}</span>
              </div>
            `,
          )
          .join('')}
      </div>
      <div class="levelup-modal-body">
        <div class="levelup-roas-grid">
          <div class="levelup-roas-field">
            <div class="levelup-roas-field-label">HPP Produk</div>
            <input class="levelup-roas-input" data-field="hpp" inputmode="numeric" placeholder="Rp 0" value="${roasCalculatorState.hpp ? formatCompactCurrency(roasCalculatorState.hpp) : ''}" />
          </div>
          <div class="levelup-roas-field">
            <div class="levelup-roas-field-label">Harga Jual</div>
            <input class="levelup-roas-input" data-field="price" inputmode="numeric" placeholder="Rp 0" value="${roasCalculatorState.price ? formatCompactCurrency(roasCalculatorState.price) : ''}" />
          </div>
          <div class="levelup-roas-field">
            <div class="levelup-roas-field-label">Jenis Toko</div>
            <div class="levelup-roas-store-type-group">
              <label class="levelup-roas-radio">
                <input type="radio" name="levelup-roas-store-type" value="non_star" ${roasCalculatorState.storeType === 'non_star' ? 'checked' : ''} />
                <span class="levelup-roas-radio-label">Non-Star</span>
              </label>
              <label class="levelup-roas-radio">
                <input type="radio" name="levelup-roas-store-type" value="star" ${roasCalculatorState.storeType === 'star' ? 'checked' : ''} />
                <span class="levelup-roas-radio-label">Star/Star+</span>
              </label>
              <label class="levelup-roas-radio">
                <input type="radio" name="levelup-roas-store-type" value="mall" ${roasCalculatorState.storeType === 'mall' ? 'checked' : ''} />
                <span class="levelup-roas-radio-label">Mall</span>
              </label>
            </div>
          </div>
          <div class="levelup-roas-field">
            <div class="levelup-roas-field-label">Kategori Produk</div>
            <div class="levelup-roas-field-row">
              <button type="button" class="levelup-button levelup-button-secondary levelup-roas-category-button" data-action="roas-pick-category">${roasCalculatorState.categoryLabel ? roasCalculatorState.categoryLabel : 'Pilih Kategori'}</button>
              <input class="levelup-roas-input" data-variant="pct" data-field="kategoriFeePct" inputmode="decimal" placeholder="0.00" value="${roasCalculatorState.kategoriFeePct ?? 0}" />
            </div>
            ${categoryHelperText ? `<div class="levelup-note">${categoryHelperText}</div>` : ''}
          </div>
          <div class="levelup-roas-field">
            <div class="levelup-roas-field-label">Operasional</div>
            <input class="levelup-roas-input" data-field="operasional" inputmode="numeric" placeholder="Rp 0" value="${roasCalculatorState.operasional ? formatCompactCurrency(roasCalculatorState.operasional) : ''}" />
          </div>
          <div class="levelup-roas-field">
            <div class="levelup-roas-program-grid">
              <div class="levelup-roas-program-card" data-align="right">
                <div class="levelup-roas-program-copy">
                  <span class="levelup-tooltip">
                    <button
                      type="button"
                      class="levelup-roas-program-title levelup-roas-program-title-button"
                      aria-label="Info Promo Extra"
                    >
                      Promo Extra
                    </button>
                    <span class="levelup-tooltip-panel">
                      ${SHOPEE_PROMO_XTRA_FEE_PCT.toFixed(1)}% maks Rp${SHOPEE_PROMO_XTRA_FEE_CAP_IDR.toLocaleString('id-ID')}
                    </span>
                  </span>
                </div>
                <label class="levelup-toggle">
                  <input type="checkbox" data-field="promoXtraEnabled" ${roasCalculatorState.promoXtraEnabled ? 'checked' : ''} />
                  <span class="levelup-toggle-track"></span>
                </label>
              </div>
              <div class="levelup-roas-program-card" data-align="left">
                <div class="levelup-roas-program-copy">
                  <span class="levelup-tooltip">
                    <button
                      type="button"
                      class="levelup-roas-program-title levelup-roas-program-title-button"
                      aria-label="Info Ongkir Extra"
                    >
                      Ongkir Extra
                    </button>
                    <span class="levelup-tooltip-panel">
                      Gratis Ongkir XTRA ${SHOPEE_GRATIS_ONGKIR_XTRA_FEE_PCT.toFixed(1)}%
                    </span>
                  </span>
                </div>
                <label class="levelup-toggle">
                  <input type="checkbox" data-field="gratisOngkirXtraEnabled" ${roasCalculatorState.gratisOngkirXtraEnabled ? 'checked' : ''} />
                  <span class="levelup-toggle-track"></span>
                </label>
              </div>
            </div>
          </div>
        </div>
        <div class="levelup-roas-summary-grid">
          <div class="levelup-roas-field">
            <div class="levelup-roas-field-label levelup-field-label-row">
              <span>Biaya Shopee (Total)</span>
              <span class="levelup-tooltip">
                <button type="button" class="levelup-tooltip-trigger" data-role="tooltip-trigger" aria-label="Info Biaya Shopee">ⓘ</button>
                <span class="levelup-tooltip-panel">
                  <span class="levelup-tooltip-lines" data-role="roas-shopee-tooltip-content"></span>
                </span>
              </span>
            </div>
            <div class="levelup-roas-output">
              <span data-role="roas-shopee-fee">-</span>
            </div>
          </div>
          <div class="levelup-roas-field">
            <div class="levelup-roas-field-label">Profit Sebelum Iklan</div>
            <div class="levelup-roas-output">
              <span data-role="roas-profit-label">${typeof profitSebelumIklan === 'number' ? formatCompactCurrency(Math.round(profitSebelumIklan)) : '-'}</span>
              <small data-role="roas-profit-pct">${typeof profitSebelumIklanPct === 'number' ? formatPercent(profitSebelumIklanPct) : '-'}</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const closeButton = modal.querySelector<HTMLButtonElement>('[data-action="roas-close"]');
  const resetButton = modal.querySelector<HTMLButtonElement>('[data-action="roas-reset"]');
  const pickCategoryButton = modal.querySelector<HTMLButtonElement>('[data-action="roas-pick-category"]');
  const inputs = Array.from(modal.querySelectorAll<HTMLInputElement>('.levelup-roas-input'));
  const storeTypeRadios = Array.from(
    modal.querySelectorAll<HTMLInputElement>('input[name="levelup-roas-store-type"]'),
  );
  const promoToggle = modal.querySelector<HTMLInputElement>('[data-field="promoXtraEnabled"]');
  const gratisOngkirToggle = modal.querySelector<HTMLInputElement>(
    '[data-field="gratisOngkirXtraEnabled"]',
  );
  const profitLabel = modal.querySelector<HTMLElement>('[data-role="roas-profit-label"]');
  const profitPct = modal.querySelector<HTMLElement>('[data-role="roas-profit-pct"]');
  const shopeeFeeLabel = modal.querySelector<HTMLElement>('[data-role="roas-shopee-fee"]');
  const shopeeFeeTooltipContent = modal.querySelector<HTMLElement>(
    '[data-role="roas-shopee-tooltip-content"]',
  );

  const refreshComputed = () => {
    const computed = computeRoasMetrics();
    if (profitLabel) {
      profitLabel.textContent =
        computed && typeof computed.profitSebelumIklan === 'number'
          ? formatCompactCurrency(Math.round(computed.profitSebelumIklan))
          : '-';
    }
    if (profitPct) {
      profitPct.textContent =
        computed &&
        typeof computed.price === 'number' &&
        computed.price > 0 &&
        typeof computed.profitSebelumIklan === 'number'
          ? formatPercent((computed.profitSebelumIklan / computed.price) * 100)
          : '-';
    }
    if (shopeeFeeLabel) {
      shopeeFeeLabel.textContent = computed
        ? `${formatCompactCurrency(Math.round(computed.totalBiayaShopee))} (${formatPercent(computed.totalBiayaShopeePct)})`
        : '-';
    }
    if (shopeeFeeTooltipContent) {
      if (!computed) {
        shopeeFeeTooltipContent.innerHTML = '';
      } else {
        const parts = [
          `Fee kategori: ${formatCompactCurrency(Math.round(computed.feeKategori))} (${formatPercent(roasCalculatorState.kategoriFeePct ?? 0)})`,
          `Biaya proses pesanan: Rp${SHOPEE_ORDER_PROCESSING_FEE_IDR.toLocaleString('id-ID')}`,
        ];
        if (roasCalculatorState.promoXtraEnabled) {
          parts.push(
            `Promo Xtra: ${formatCompactCurrency(Math.round(computed.feePromoXtra))} (${SHOPEE_PROMO_XTRA_FEE_PCT.toFixed(1)}%, maks Rp${SHOPEE_PROMO_XTRA_FEE_CAP_IDR.toLocaleString('id-ID')})`,
          );
        }
        if (roasCalculatorState.gratisOngkirXtraEnabled) {
          parts.push(
            `Gratis Ongkir XTRA: ${formatCompactCurrency(Math.round(computed.feeGratisOngkirXtra))} (${SHOPEE_GRATIS_ONGKIR_XTRA_FEE_PCT.toFixed(1)}%)`,
          );
        }
        shopeeFeeTooltipContent.innerHTML = parts
          .map((part) => `<span>${part}</span>`)
          .join('');
      }
    }

    const tierElements = Array.from(modal.querySelectorAll<HTMLElement>('.levelup-roas-tier'));
    for (const element of tierElements) {
      const key = element.dataset.key as
        | 'rugi'
        | 'kompetitif'
        | 'konservatif'
        | 'prospektif'
        | undefined;
      const tier = key && computed ? computed.tiers.find((entry) => entry.key === key) ?? null : null;
      const labelNode = element.querySelector<HTMLElement>('[data-role="roas-tier-label"]');
      const profitNode = element.querySelector<HTMLElement>('[data-role="roas-tier-profit"]');
      const tooltipNode = element.querySelector<HTMLElement>('[data-role="roas-tier-tooltip"]');

      if (labelNode) {
        labelNode.textContent = tier
          ? `${tier.label} ROAS ${typeof tier.roas === 'number' ? tier.roas.toFixed(1) : '-'}`
          : normalizeText(labelNode.textContent);
      }
      if (profitNode) {
        profitNode.textContent = tier ? formatCompactCurrency(Math.round(tier.profit)) : '-';
      }
      if (tooltipNode && key) {
        tooltipNode.textContent = getRoasTierTooltipText(
          key,
          tier?.roas ?? null,
          tier?.profit ?? null,
          computed?.breakEvenRoas ?? null,
        );
      }
    }
  };

  closeButton?.addEventListener('click', () => {
    closeRoasCalculator();
  });

  resetButton?.addEventListener('click', () => {
    const resetDefaults = getSelectedShopRoasDefaults(lastKnownState);
    roasCalculatorState.hpp = null;
    roasCalculatorState.operasional = null;
    roasCalculatorState.storeType = resetDefaults?.storeType ?? 'non_star';
    roasCalculatorState.promoXtraEnabled = resetDefaults?.promoXtraEnabled ?? false;
    roasCalculatorState.gratisOngkirXtraEnabled = false;
    clearRoasCategorySelection();
    roasCalculatorState.price = getRepresentativeProductPrice(detail);

    for (const input of inputs) {
      const field = input.dataset.field as keyof RoasCalculatorState | undefined;
      if (!field) {
        continue;
      }

      if (field === 'price') {
        input.value = roasCalculatorState.price ? formatCompactCurrency(roasCalculatorState.price) : '';
        continue;
      }

      if (field.endsWith('Pct')) {
        input.value = '0';
        continue;
      }

      input.value = '';
    }

    for (const radio of storeTypeRadios) {
      radio.checked = radio.value === roasCalculatorState.storeType;
    }
    if (promoToggle) {
      promoToggle.checked = roasCalculatorState.promoXtraEnabled;
    }
    if (gratisOngkirToggle) {
      gratisOngkirToggle.checked = false;
    }
    if (pickCategoryButton) {
      pickCategoryButton.textContent = 'Pilih Kategori';
    }
    refreshComputed();
  });

  pickCategoryButton?.addEventListener('click', () => {
    void openRoasCategoryPicker();
  });

  for (const radio of storeTypeRadios) {
    radio.addEventListener('change', () => {
      const nextValue = normalizeText(radio.value) as RoasCalculatorState['storeType'];
      if (!(nextValue === 'non_star' || nextValue === 'star' || nextValue === 'mall')) {
        return;
      }

      roasCalculatorState.storeType = nextValue;

      void loadRoasCategoryCatalog()
        .then((catalog) => {
          const nextMatch = findMatchingRoasCategoryForStoreType(
            catalog,
            nextValue,
            lastSelectedRoasCategory,
          );

          if (nextMatch) {
            applyRoasCategorySelection(nextMatch, 'manual');
          } else {
            clearRoasCategorySelection();
          }
        })
        .catch(() => {
          clearRoasCategorySelection();
        })
        .finally(() => {
          refreshComputed();
          openRoasCalculator(detail);
        });
    });
  }

  promoToggle?.addEventListener('change', () => {
    roasCalculatorState.promoXtraEnabled = Boolean(promoToggle.checked);
    refreshComputed();
  });

  gratisOngkirToggle?.addEventListener('change', () => {
    roasCalculatorState.gratisOngkirXtraEnabled = Boolean(gratisOngkirToggle.checked);
    refreshComputed();
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeRoasCalculator();
    }
  });

  for (const input of inputs) {
    input.addEventListener('input', () => {
      const field = input.dataset.field as keyof RoasCalculatorState | undefined;
      if (!field) {
        return;
      }

      if (field.endsWith('Pct')) {
        const normalized = normalizeText(input.value).replace(',', '.');
        const parsed = Number.parseFloat(normalized);
        roasCalculatorState[field] = Number.isFinite(parsed) ? parsed : 0;
        if (field === 'kategoriFeePct') {
          lastRoasCategorySelectionSource = Number.isFinite(parsed) && parsed > 0 ? 'manual' : null;
        }
        refreshComputed();
        return;
      }

      const parsedValue = parseCurrencyInput(input.value);
      roasCalculatorState[field] = parsedValue;
      if (parsedValue !== null) {
        input.value = formatCompactCurrency(parsedValue);
      }
      refreshComputed();
    });
  }

  overlay.appendChild(modal);
  refreshComputed();
}

function removeOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
}

function isManagedOverlayNode(node: Node) {
  if (node instanceof HTMLStyleElement) {
    return node.id === OVERLAY_STYLE_ID;
  }

  if (node instanceof HTMLElement) {
    return (
      node.id === OVERLAY_ID ||
      node.id === OVERLAY_STYLE_ID ||
      Boolean(node.closest?.(`#${OVERLAY_ID}`))
    );
  }

  return false;
}

async function sendBackgroundMessage<T>(message: BackgroundMessage): Promise<T> {
  const response = (await chrome.runtime.sendMessage(
    message,
  )) as BackgroundResponse<T>;

  if (!response.ok) {
    throw new Error(response.error ?? 'Permintaan extension gagal.');
  }

  return response.data as T;
}

async function refreshKnownState() {
  try {
    lastKnownState = await sendBackgroundMessage<ExtensionState>({
      type: 'GET_STATE',
    });
  } catch {
    // Ignore state refresh errors in content script overlay.
  }
}

document.addEventListener(PAGE_BRIDGE_RESPONSE_EVENT, (event: Event) => {
  const message = (event as CustomEvent<PageBridgeResponseMessage>).detail;
  if (!message || typeof message.requestId !== 'string') {
    return;
  }

  const pending = pendingPageBridgeRequests.get(message.requestId);
  if (!pending) {
    return;
  }

  window.clearTimeout(pending.timeoutId);
  pendingPageBridgeRequests.delete(message.requestId);

  if (message.error) {
    pending.reject(new Error(message.error));
    return;
  }

  pending.resolve(Array.isArray(message.entries) ? message.entries : []);
});

async function enrichSearchSnapshot(snapshot: PageSnapshot) {
  if (snapshot.pageType !== 'shopee_public_search') {
    return;
  }

  const orderedResults = orderResultsForResearch(snapshot.resultsPreview);
  const targetCount = Math.min(
    orderedResults.length,
    Math.min(visibleResultCount, SEARCH_ENRICHMENT_BATCH_SIZE),
  );
  const resultsToEnrich = orderedResults.slice(0, targetCount);

  if (
    resultsToEnrich.every(
      (result) =>
        normalizeText(result.shopName).length > 0 &&
        normalizeText(result.ratingHint).length > 0 &&
        normalizeText(result.reviewCountHint).length > 0 &&
        normalizeText(result.salesHint).length > 0 &&
        normalizeText(result.monthlySoldHint).length > 0 &&
        normalizeText(result.monthlyRevenueHint).length > 0,
    )
  ) {
    return;
  }

  const requestId = ++searchEnrichmentRequestId;
  let enrichedEntries: SearchResultEnrichment[] = [];
  try {
    if (!ENABLE_PAGE_BRIDGE_ENRICHMENT) {
      throw new Error('Page bridge enrichment dinonaktifkan.');
    }

    enrichedEntries = await requestPageBridgeSearchEnrichment(resultsToEnrich);
  } catch {
    try {
      enrichedEntries = await sendBackgroundMessage<SearchResultEnrichment[]>({
        type: 'ENRICH_SEARCH_RESULTS',
        payload: {
          results: resultsToEnrich,
        },
      });
    } catch {
      searchEnrichmentDebugLabel = `Enrichment gagal untuk ${resultsToEnrich.length} kartu.`;
      if (lastSnapshot) {
        renderOverlay(lastSnapshot);
      }
      return;
    }
  }

  if (requestId !== searchEnrichmentRequestId) {
    return;
  }

  enrichedEntries.forEach((entry) => {
    cacheResolvedSearchResultEnrichment(entry);
  });
  searchEnrichmentDebugLabel = `Enrichment ${enrichedEntries.length}/${resultsToEnrich.length} kartu diterima.`;

  let hasChanged = false;
  const enrichmentMap = new Map(
    enrichedEntries
      .map((entry) => {
        const cacheKey = getSearchResultCacheKey(entry);
        return cacheKey ? ([cacheKey, entry] as const) : null;
      })
      .filter(
        (
          entry,
        ): entry is readonly [string, SearchResultEnrichment] => entry !== null,
      ),
  );

  const mergedResults = snapshot.resultsPreview.map((result) => {
    const cacheKey = getSearchResultCacheKey(result);
    const enrichment = cacheKey ? enrichmentMap.get(cacheKey) ?? null : null;
    if (!enrichment) {
      return result;
    }

    const merged = mergeSearchResultEnrichment(result, enrichment);
    if (JSON.stringify(merged) !== JSON.stringify(result)) {
      hasChanged = true;
    }

    return merged;
  });

  if (!hasChanged) {
    searchEnrichmentDebugLabel = `Enrichment ${enrichedEntries.length}/${resultsToEnrich.length} kartu diterima, tetapi belum masuk ke tampilan.`;
    if (lastSnapshot) {
      renderOverlay(lastSnapshot);
    }
    return;
  }

  await publishSnapshot({
    ...snapshot,
    resultsPreview: mergedResults,
  });
}

async function enrichProductDetailSnapshot(snapshot: PageSnapshot) {
  const detailPreview = toProductDetailEnrichmentPreview(snapshot);
  if (!detailPreview || !snapshot.productDetail) {
    return;
  }

  if (
    normalizeText(snapshot.productDetail.shopName).length > 0 &&
    normalizeText(snapshot.productDetail.ratingHint).length > 0 &&
    normalizeText(snapshot.productDetail.reviewCountHint).length > 0 &&
    normalizeText(snapshot.productDetail.salesHint).length > 0 &&
    normalizeText(snapshot.productDetail.monthlySoldHint).length > 0
  ) {
    return;
  }

  const requestId = ++productDetailEnrichmentRequestId;
  let enrichedEntries: SearchResultEnrichment[] = [];
  try {
    if (!ENABLE_PAGE_BRIDGE_ENRICHMENT) {
      throw new Error('Page bridge enrichment dinonaktifkan.');
    }

    enrichedEntries = await requestPageBridgeSearchEnrichment([detailPreview]);
  } catch {
    try {
      enrichedEntries = await sendBackgroundMessage<SearchResultEnrichment[]>({
        type: 'ENRICH_SEARCH_RESULTS',
        payload: {
          results: [detailPreview],
        },
      });
    } catch {
      return;
    }
  }

  if (requestId !== productDetailEnrichmentRequestId) {
    return;
  }

  const enrichment = enrichedEntries[0] ?? null;
  if (!enrichment) {
    return;
  }

  cacheResolvedSearchResultEnrichment(enrichment);
  const mergedDetail = mergeProductDetailEnrichment(snapshot.productDetail, enrichment);
  if (JSON.stringify(mergedDetail) === JSON.stringify(snapshot.productDetail)) {
    return;
  }

  await publishSnapshot({
    ...snapshot,
    productDetail: mergedDetail,
  });
}

function queueSearchEnrichment(snapshot: PageSnapshot) {
  if (searchEnrichmentTimeoutId) {
    window.clearTimeout(searchEnrichmentTimeoutId);
    searchEnrichmentTimeoutId = null;
  }

  if (snapshot.pageType !== 'shopee_public_search') {
    return;
  }

  searchEnrichmentTimeoutId = window.setTimeout(() => {
    searchEnrichmentTimeoutId = null;
    void enrichSearchSnapshot(snapshot);
  }, SEARCH_ENRICHMENT_START_DELAY_MS);
}

function queueProductDetailEnrichment(snapshot: PageSnapshot) {
  if (productDetailEnrichmentTimeoutId) {
    window.clearTimeout(productDetailEnrichmentTimeoutId);
    productDetailEnrichmentTimeoutId = null;
  }

  if (snapshot.pageType !== 'shopee_public_product') {
    return;
  }

  productDetailEnrichmentTimeoutId = window.setTimeout(() => {
    productDetailEnrichmentTimeoutId = null;
    void enrichProductDetailSnapshot(snapshot);
  }, 900);
}

async function publishSnapshot(payload: PageSnapshot) {
  const snapshotWithResolvedEnrichment = applyResolvedEnrichmentToSnapshot(payload);
  lastSnapshot = snapshotWithResolvedEnrichment;
  renderOverlay(snapshotWithResolvedEnrichment);

  try {
    await chrome.runtime.sendMessage({
      type: 'PAGE_SNAPSHOT_UPDATED',
      payload: snapshotWithResolvedEnrichment,
    } satisfies DetectionMessage);
  } catch (error) {
    if (!isIgnorableRuntimeError(error)) {
      throw error;
    }
  }

  queueSearchEnrichment(snapshotWithResolvedEnrichment);
  queueProductDetailEnrichment(snapshotWithResolvedEnrichment);
}

async function loadMoreSearchResults(targetCount: number) {
  const initialSnapshot = detectPageSnapshot(document);
  if (initialSnapshot.pageType !== 'shopee_public_search') {
    return initialSnapshot;
  }

  let bestSnapshot = initialSnapshot;
  let bestCount = initialSnapshot.resultsPreview.length;
  const initialScrollY = window.scrollY;

  for (
    let attempt = 0;
    attempt < LOAD_MORE_FETCH_ATTEMPTS && bestCount < targetCount;
    attempt += 1
  ) {
    const nextScrollY =
      initialScrollY + Math.round(window.innerHeight * (1.2 + attempt * 0.95));
    window.scrollTo({
      top: nextScrollY,
      behavior: 'auto',
    });
    await wait(450);

    const nextSnapshot = detectPageSnapshot(document);
    if (nextSnapshot.pageType !== 'shopee_public_search') {
      break;
    }

    if (nextSnapshot.resultsPreview.length > bestCount) {
      bestSnapshot = nextSnapshot;
      bestCount = nextSnapshot.resultsPreview.length;
    }
  }

  window.scrollTo({
    top: initialScrollY,
    behavior: 'auto',
  });
  await wait(100);

  return bestSnapshot;
}

function renderOverlay(snapshot: PageSnapshot) {
  if (
    (snapshot.pageType !== 'shopee_public_search' &&
      snapshot.pageType !== 'shopee_public_product') ||
    snapshot.captureMode !== 'public'
  ) {
    removeOverlay();
    return;
  }

  ensureOverlayStyle();
  const isSearchPage = snapshot.pageType === 'shopee_public_search';

  const currentSignature = getResultsSignature(snapshot);
  if (currentSignature !== lastResultsSignature) {
    visibleResultCount = INITIAL_VISIBLE_RESULTS;
    lastResultsSignature = currentSignature;
    searchEnrichmentDebugLabel = '';
  }

  const statusLabel = lastKnownState?.lastSync.message ?? snapshot.statusMessage;
  const combinedStatusLabel =
    snapshot.pageType === 'shopee_public_search' && searchEnrichmentDebugLabel
      ? `${statusLabel} ${searchEnrichmentDebugLabel}`
      : statusLabel;
  const orderedResults = isSearchPage
    ? orderResultsForResearch(snapshot.resultsPreview)
    : snapshot.resultsPreview;
  const totalResults = orderedResults.length;
  const overlay = document.getElementById(OVERLAY_ID) ?? document.createElement('section');
  const nextRenderKey = getOverlayRenderKey(
    snapshot,
    combinedStatusLabel,
    visibleResultCount,
  );
  const shouldRefreshMarkup = overlay.dataset.renderKey !== nextRenderKey;

  overlay.id = OVERLAY_ID;
  overlay.dataset.pageKind = isSearchPage ? 'search' : 'product';

  if (isSearchPage && shouldRefreshMarkup) {
    const displayedResults = orderedResults.slice(0, visibleResultCount);
    const uniqueShops = getUniqueShopCount(snapshot.resultsPreview);
    const priceSummary = collectPriceSummary(snapshot.resultsPreview);
    const comparablePrices = collectComparablePrices(snapshot.resultsPreview);
    const medianPrice = collectMedianPrice(snapshot.resultsPreview);
    const medianPriceValue = collectMedianPriceValue(snapshot.resultsPreview);
    const salesSignalCount = countResultsWithSalesSignal(snapshot.resultsPreview);
    const minPriceValue =
      comparablePrices.length > 0 ? comparablePrices[0] : null;
    const maxPriceValue =
      comparablePrices.length > 0
        ? comparablePrices[comparablePrices.length - 1]
        : null;
    const minPrice = collectMinPrice(snapshot.resultsPreview);
    const maxPrice = collectMaxPrice(snapshot.resultsPreview);
    const keywordLabel = snapshot.keyword?.trim() || '(keyword belum terbaca)';

    overlay.innerHTML = `
      <div class="levelup-header">
        <div class="levelup-brand">
          <img class="levelup-brand-mark" src="${HEADER_LOGO_URL}" alt="LevelUP adsPRO" />
          <div class="levelup-brand-copy">
            <div class="levelup-title">Riset Market | LevelUP adsPRO</div>
            <div class="levelup-subtitle">Kata kunci: ${keywordLabel}</div>
            <div class="levelup-status">${combinedStatusLabel}</div>
          </div>
        </div>
        <div class="levelup-header-actions">
          <button type="button" class="levelup-button levelup-button-primary" data-action="sync">Sinkronkan Sekarang</button>
          <button type="button" class="levelup-button levelup-button-secondary" data-action="refresh">Muat Ulang Parser</button>
          <button type="button" class="levelup-button levelup-button-ghost" data-action="load-more">Muat Lebih Banyak</button>
        </div>
      </div>
      <div class="levelup-body">
        <div class="levelup-stats">
          <div class="levelup-card">
            <div class="levelup-card-label">Hasil Ditampilkan</div>
            <div class="levelup-card-value">${displayedResults.length} / ${totalResults}</div>
          </div>
          <div class="levelup-card">
            <div class="levelup-card-label">Rentang Harga</div>
            <div class="levelup-card-value">${priceSummary}</div>
          </div>
          <div class="levelup-card">
            <div class="levelup-card-label">Lokasi Terdeteksi</div>
            <div class="levelup-card-value">${uniqueShops}</div>
          </div>
          <div class="levelup-card">
            <div class="levelup-card-label">Ada Sinyal Terjual</div>
            <div class="levelup-card-value">${salesSignalCount}</div>
          </div>
        </div>
        <div class="levelup-summary">
          <span><strong>Median harga:</strong> ${medianPrice}</span>
          <span><strong>Harga termurah:</strong> ${minPrice}</span>
          <span><strong>Harga tertinggi:</strong> ${maxPrice}</span>
          <span><strong>Insight:</strong> ${salesSignalCount > 0 ? `${salesSignalCount} produk punya sinyal terjual dan diprioritaskan di urutan atas.` : 'Belum ada sinyal terjual yang terbaca.'}</span>
        </div>
        <div class="levelup-note">Mode public research aktif. Shop default tidak dipakai untuk sync halaman pencarian publik.</div>
        <div class="levelup-results">
          ${displayedResults
            .map((result) => {
              const cleanTitle = cleanProductTitle(result.productTitle);
              const shopLabel = formatSearchShopLabel(result);
              const priceLabel = formatSearchPriceLabel(result);
              const monthlySoldLabel = formatSearchMonthlySoldLabel(result);
              const ratingLabel = formatSearchRatingLabel(result);
              const reviewCountLabel = formatSearchReviewCountLabel(result);
              const monthlyRevenueLabel = formatSearchMonthlyRevenueLabel(result);
              const badges = getProductBadges(result, {
                minPriceValue,
                maxPriceValue,
                medianPriceValue,
              });

              return `
                <div class="levelup-result">
                  <div class="levelup-result-thumb">
                    ${
                      badges.length > 0
                        ? `<div class="levelup-result-badges">${badges
                            .map(
                              (badge) =>
                                `<span class="levelup-result-badge" data-badge-tone="${getBadgeTone(
                                  badge,
                                )}">${badge}</span>`,
                            )
                            .join('')}</div>`
                        : ''
                    }
                    ${
                      result.imageUrl
                        ? `<img src="${result.imageUrl}" alt="${cleanTitle}" loading="lazy" referrerpolicy="no-referrer" />`
                        : ''
                    }
                    <div class="levelup-result-action-layer">
                      <button
                        type="button"
                        class="levelup-hover-button levelup-hover-button-secondary"
                        data-action="open-result-product"
                        data-product-url="${encodeURIComponent(result.productUrl)}"
                      >
                        Lihat Produk
                      </button>
                      <button
                        type="button"
                        class="levelup-hover-button levelup-hover-button-primary"
                        data-action="sync-result-product"
                        data-product-url="${encodeURIComponent(result.productUrl)}"
                      >
                        Simpan Produk
                      </button>
                    </div>
                  </div>
                  <div class="levelup-result-title">${cleanTitle}</div>
                  <div class="levelup-result-meta-grid">
                    <div class="levelup-result-meta-row">
                      <div class="levelup-result-meta-cell" data-tone="primary">${priceLabel}</div>
                      <div class="levelup-result-meta-cell" data-tone="accent" data-align="right">${monthlySoldLabel}</div>
                    </div>
                    <div class="levelup-result-meta-row">
                      <div class="levelup-result-meta-cell">${ratingLabel}</div>
                      <div class="levelup-result-meta-cell" data-align="right">${reviewCountLabel}</div>
                    </div>
                    <div class="levelup-result-meta-row">
                      <div class="levelup-result-meta-cell">${shopLabel}</div>
                      <div class="levelup-result-meta-cell" data-align="right">${monthlyRevenueLabel}</div>
                    </div>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  } else if (shouldRefreshMarkup) {
    const detail = snapshot.productDetail;
    const detailResults =
      detail
        ? [
            {
              position: 1,
              productTitle: detail.productTitle,
              productUrl: detail.productUrl,
              imageUrl: detail.imageUrl,
              shopName: detail.shopName,
              priceMin: detail.priceMin,
              priceMax: detail.priceMax,
              salesHint: detail.salesHint,
            },
          ]
        : [];
    const medianPriceValue = collectMedianPriceValue(detailResults);
    const comparablePrices = collectComparablePrices(detailResults);
    const minPriceValue =
      comparablePrices.length > 0 ? comparablePrices[0] : null;
    const maxPriceValue =
      comparablePrices.length > 0
        ? comparablePrices[comparablePrices.length - 1]
        : null;
    const badges = detail
      ? getProductDetailBadges(detail, {
          minPriceValue,
          maxPriceValue,
          medianPriceValue,
        })
      : [];
    const priceLabel =
      detail && (typeof detail.priceMin === 'number' || typeof detail.priceMax === 'number')
        ? typeof detail.priceMin === 'number' &&
          typeof detail.priceMax === 'number' &&
          detail.priceMin !== detail.priceMax
          ? `${formatCurrency(detail.priceMin)} - ${formatCurrency(detail.priceMax)}`
          : formatCurrency(detail.priceMin ?? detail.priceMax)
        : '-';
    const ratingLabel = detail?.ratingHint ? `★ ${detail.ratingHint}` : '★ -';
    const reviewLabel = normalizeText(detail?.reviewCountHint) || '-';
    const salesLabel = normalizeText(detail?.salesHint) || '-';
    const monthlySoldLabel = normalizeText(detail?.monthlySoldHint) || '';
    const combinedSalesLabel = monthlySoldLabel
      ? `${salesLabel} | ${monthlySoldLabel}`
      : salesLabel;
    const shopLabel = normalizeText(detail?.shopName) || 'Toko belum terbaca';
    const productHighlights = detail?.highlights ?? [];
    const ratingHighlights = productHighlights.filter(isRatingDistributionHighlight);
    const nonRatingHighlights = productHighlights.filter(
      (highlight) => !isRatingDistributionHighlight(highlight),
    );
    const productInsightLabel =
      badges.length > 0 ? badges.join(' | ') : 'Belum ada insight pembanding harga.';

    overlay.innerHTML = `
      <div class="levelup-header">
        <div class="levelup-brand">
          <img class="levelup-brand-mark" src="${HEADER_LOGO_URL}" alt="LevelUP adsPRO" />
          <div class="levelup-brand-copy">
            <div class="levelup-title">Riset Produk | LevelUP adsPRO</div>
            <div class="levelup-subtitle">${cleanProductTitle(detail?.productTitle ?? snapshot.title)}</div>
            <div class="levelup-status">${statusLabel}</div>
          </div>
        </div>
        <div class="levelup-header-actions">
          <button type="button" class="levelup-button levelup-button-primary" data-action="sync">Sinkronkan Sekarang</button>
          <button type="button" class="levelup-button levelup-button-secondary" data-action="roas">Kalkulator ROAS</button>
        </div>
      </div>
      <div class="levelup-body">
        <div class="levelup-product-layout">
          <div class="levelup-product-panel">
            <div class="levelup-product-image">
              ${
                badges.length > 0
                  ? `<div class="levelup-result-badges">${badges
                      .map(
                        (badge) =>
                          `<span class="levelup-result-badge" data-badge-tone="${getBadgeTone(
                            badge,
                          )}">${badge}</span>`,
                      )
                      .join('')}</div>`
                  : ''
              }
              ${
                detail?.imageUrl
                  ? `<img src="${detail.imageUrl}" alt="${cleanProductTitle(detail.productTitle)}" loading="lazy" referrerpolicy="no-referrer" />`
                  : ''
              }
            </div>
          </div>
          <div class="levelup-product-panel">
            <div class="levelup-product-title">${cleanProductTitle(detail?.productTitle ?? snapshot.title)}</div>
            <div class="levelup-product-stats">
              <div class="levelup-card">
                <div class="levelup-card-label">Harga</div>
                <div class="levelup-card-value">${priceLabel}</div>
              </div>
              <div class="levelup-card">
                <div class="levelup-card-label">Penjualan</div>
                <div class="levelup-card-value">${combinedSalesLabel}</div>
              </div>
              <div class="levelup-card">
                <div class="levelup-card-label">Rating</div>
                <div class="levelup-card-value">${detail?.ratingHint ?? "-"}</div>
              </div>
              <div class="levelup-card">
                <div class="levelup-card-label">Ulasan</div>
                <div class="levelup-card-value">${detail?.reviewCountHint ?? "-"}</div>
                ${
                  ratingHighlights.length
                    ? `<div class="levelup-card-subchips">${ratingHighlights
                        .map(
                          (highlight) =>
                            `<span class="levelup-card-subchip">${formatRatingDistributionHighlight(
                              highlight,
                            )}</span>`,
                        )
                        .join('')}</div>`
                    : ''
                }
              </div>
            </div>
            <div class="levelup-product-insight">Insight pembanding: ${productInsightLabel}</div>
            <div class="levelup-product-meta">
              <div>Toko: ${shopLabel}</div>
              <div>Sorotan terbaca: ${nonRatingHighlights.length}</div>
              <div>URL produk:</div>
              <div class="levelup-product-link">${detail?.productUrl ?? snapshot.url}</div>
            </div>
            ${
              nonRatingHighlights.length
                ? `<div class="levelup-highlights">${nonRatingHighlights
                    .map(
                      (highlight) =>
                        `<span class="levelup-highlight-chip">${highlight}</span>`,
                    )
                    .join('')}</div>`
                : ''
            }
          </div>
        </div>
        <div class="levelup-note">Mode public research aktif. Sinkronisasi halaman produk akan menyimpan konteks produk yang sedang dibuka.</div>
      </div>
    `;
  }

  overlay.dataset.renderKey = nextRenderKey;

  const { parent, before, layoutMode } = getOverlayHost(snapshot);
  overlay.dataset.layoutMode = layoutMode;
  const shouldMoveOverlay =
    !overlay.isConnected ||
    overlay.parentElement !== parent ||
    (before instanceof Node && overlay.nextSibling !== before);

  if (shouldMoveOverlay) {
    parent.insertBefore(overlay, before);
  }

  if (!shouldRefreshMarkup) {
    return;
  }

  const syncButton = overlay.querySelector<HTMLButtonElement>('[data-action="sync"]');
  const refreshButton = overlay.querySelector<HTMLButtonElement>('[data-action="refresh"]');
  const roasButton = overlay.querySelector<HTMLButtonElement>('[data-action="roas"]');
  const loadMoreButton = overlay.querySelector<HTMLButtonElement>('[data-action="load-more"]');
  const openProductButtons = Array.from(
    overlay.querySelectorAll<HTMLButtonElement>('[data-action="open-result-product"]'),
  );
  const syncProductButtons = Array.from(
    overlay.querySelectorAll<HTMLButtonElement>('[data-action="sync-result-product"]'),
  );
  const resultCards = Array.from(overlay.querySelectorAll<HTMLElement>('.levelup-result'));

  syncButton?.addEventListener('click', async () => {
    if (!syncButton) {
      return;
    }

    syncButton.disabled = true;
    const previousLabel = syncButton.textContent;
    syncButton.textContent = 'Menyinkronkan...';

    try {
      await sendBackgroundMessage<{ batchId: string; state: ExtensionState }>({
        type: 'SYNC_NOW',
      });
      await refreshKnownState();
      if (lastSnapshot) {
        renderOverlay(lastSnapshot);
      }
    } catch (error) {
      const statusElement = overlay.querySelector<HTMLElement>('.levelup-status');
      statusElement!.textContent =
        error instanceof Error ? error.message : 'Sync gagal dari overlay.';
    } finally {
      syncButton.disabled = false;
      syncButton.textContent = previousLabel ?? 'Sinkronkan Sekarang';
    }
  });

  refreshButton?.addEventListener('click', () => {
    queueRefresh();
  });

  roasButton?.addEventListener('click', () => {
    openRoasCalculator(snapshot.pageType === 'shopee_public_product' ? snapshot.productDetail : null);
  });

  loadMoreButton?.addEventListener('click', async () => {
    if (!isSearchPage) {
      return;
    }

    loadMoreButton.disabled = true;
    const previousLabel = loadMoreButton.textContent;
    loadMoreButton.textContent = 'Memuat...';

    try {
      const requestedVisibleCount = visibleResultCount + LOAD_MORE_STEP;
      const targetFetchCount = Math.max(
        totalResults + LOAD_MORE_STEP,
        requestedVisibleCount,
      );
      const nextSnapshot = await loadMoreSearchResults(targetFetchCount);

      if (nextSnapshot.pageType === 'shopee_public_search') {
        visibleResultCount = Math.min(
          nextSnapshot.resultsPreview.length,
          requestedVisibleCount,
        );
      }

      await publishSnapshot(nextSnapshot);
    } catch (error) {
      const statusElement = overlay.querySelector<HTMLElement>('.levelup-status');
      statusElement!.textContent =
        error instanceof Error ? error.message : 'Gagal memuat produk tambahan.';
    } finally {
      if (loadMoreButton.isConnected) {
        loadMoreButton.disabled = false;
        loadMoreButton.textContent = previousLabel ?? 'Muat Lebih Banyak';
      }
    }
  });

  overlay.onmouseenter = () => {
    if (refreshTimeoutId) {
      window.clearTimeout(refreshTimeoutId);
      refreshTimeoutId = null;
    }

    isOverlayInteractionLocked = true;
  };

  overlay.onmouseleave = () => {
    if (isRoasCalculatorOpen) {
      return;
    }

    isOverlayInteractionLocked = false;

    if (hasDeferredRefresh) {
      hasDeferredRefresh = false;
      queueRefresh();
    }
  };

  for (const button of openProductButtons) {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const productUrl = button.dataset.productUrl
        ? decodeURIComponent(button.dataset.productUrl)
        : '';
      if (!productUrl) {
        return;
      }

      window.open(productUrl, '_blank', 'noopener,noreferrer');
    });
  }

  for (const button of syncProductButtons) {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const productUrl = button.dataset.productUrl
        ? decodeURIComponent(button.dataset.productUrl)
        : '';
      if (!productUrl) {
        return;
      }

      button.disabled = true;
      const previousLabel = button.textContent;
      button.textContent = 'Menyinkronkan...';

      try {
        await sendBackgroundMessage<{ batchId: string; state: ExtensionState }>({
          type: 'SYNC_PRODUCT_URL',
          payload: { productUrl },
        });
        await refreshKnownState();
        if (lastSnapshot) {
          renderOverlay(lastSnapshot);
        }
      } catch (error) {
        const statusElement = overlay.querySelector<HTMLElement>('.levelup-status');
        if (statusElement) {
          statusElement.textContent =
            error instanceof Error
              ? error.message
              : 'Sync produk dari kartu riset gagal.';
        }
      } finally {
        button.disabled = false;
        button.textContent = previousLabel ?? 'Simpan Produk';
      }
    });
  }

  for (const card of resultCards) {
    let leaveTimeoutId: number | null = null;

    const activateHover = () => {
      if (leaveTimeoutId !== null) {
        window.clearTimeout(leaveTimeoutId);
        leaveTimeoutId = null;
      }

      card.dataset.hoverActive = 'true';
    };

    const deactivateHover = () => {
      if (leaveTimeoutId !== null) {
        window.clearTimeout(leaveTimeoutId);
      }

      leaveTimeoutId = window.setTimeout(() => {
        delete card.dataset.hoverActive;
        leaveTimeoutId = null;
      }, 90);
    };

    card.addEventListener('mouseenter', activateHover);
    card.addEventListener('mouseleave', deactivateHover);
    card.addEventListener('focusin', activateHover);
    card.addEventListener('focusout', deactivateHover);
  }
}

async function sendSnapshot() {
  if (isOverlayInteractionLocked) {
    hasDeferredRefresh = true;
    return;
  }

  const payload = detectPageSnapshot(document);
  await publishSnapshot(payload);
}

function queueRefresh() {
  if (isOverlayInteractionLocked) {
    hasDeferredRefresh = true;
    return;
  }

  if (refreshTimeoutId) {
    window.clearTimeout(refreshTimeoutId);
  }

  refreshTimeoutId = window.setTimeout(() => {
    void sendSnapshot();
  }, 300);
}

function watchRouteChanges() {
  window.setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      queueRefresh();
    }
  }, 1000);
}

function watchDomChanges() {
  mutationObserver?.disconnect();
  mutationObserver = new MutationObserver((mutations) => {
    const shouldRefresh = mutations.some((mutation) => {
      const changedNodes = [
        ...Array.from(mutation.addedNodes),
        ...Array.from(mutation.removedNodes),
      ];

      if (changedNodes.length === 0) {
        return !isManagedOverlayNode(mutation.target);
      }

      return changedNodes.some((node) => !isManagedOverlayNode(node));
    });

    if (!shouldRefresh) {
      return;
    }

    queueRefresh();
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

chrome.runtime.onMessage.addListener((message: DetectionMessage) => {
  if (message.type === 'REQUEST_PAGE_SNAPSHOT') {
    void sendSnapshot();
  }
});

void refreshKnownState().then(() => sendSnapshot());
watchRouteChanges();
watchDomChanges();
