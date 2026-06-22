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
  ShopResearchSnapshot,
} from './types';

let lastUrl = window.location.href;
let lastSnapshot: PageSnapshot | null = null;
let lastKnownState: ExtensionState | null = null;
let mutationObserver: MutationObserver | null = null;
let refreshTimeoutId: number | null = null;
let searchEnrichmentTimeoutId: number | null = null;
let productDetailEnrichmentTimeoutId: number | null = null;
let shopResearchEnrichmentTimeoutId: number | null = null;
let queuedShopResearchKey: string | null = null;
let isRoasCalculatorOpen = false;
let lastRoasProductDetail: ProductDetailSnapshot | null = null;
let visibleResultCount = 10;
let lastResultsSignature = '';
let isOverlayInteractionLocked = false;
let hasDeferredRefresh = false;
let searchEnrichmentRequestId = 0;
let productDetailEnrichmentRequestId = 0;
let shopResearchRequestId = 0;
let searchEnrichmentDebugLabel = '';
let shopResearchSortKey: 'revenue30d' | 'sold30d' | 'reviews' | 'newest' = 'revenue30d';
let lastAppliedRoasDefaultsShopId: string | null = null;
let lastStableShopeeAdsDashboard: NonNullable<PageSnapshot['adsDashboard']> | null = null;
let adsDashboardRefreshTimeoutId: number | null = null;
let adsDashboardFollowupRefreshTimeoutId: number | null = null;
let adsDashboardBootstrapRetryTimeoutId: number | null = null;
let adsDashboardBootstrapRetryCount = 0;
let isDomObserverActive = false;
let roasProductSurfaceRenderNonce = 0;
let toastDismissTimeoutId: number | null = null;

const OVERLAY_ID = 'levelup-adspro-market-overlay';
const OVERLAY_STYLE_ID = 'levelup-adspro-market-overlay-style';
const SHOP_OVERLAY_ID = 'levelup-adspro-shop-overlay';
const SHOP_OVERLAY_STYLE_ID = 'levelup-adspro-shop-overlay-style';
const TOAST_STYLE_ID = 'levelup-adspro-toast-style';
const TOAST_ROOT_ID = 'levelup-adspro-toast-root';
const ADS_DASHBOARD_ENHANCEMENT_ID = 'levelup-adspro-shopee-ads-enhancement';
const ADS_DASHBOARD_BOOTSTRAP_RETRY_DELAYS_MS = [500, 1200, 2200, 3600] as const;
const INITIAL_VISIBLE_RESULTS = 10;
const LOAD_MORE_STEP = 10;
const LOAD_MORE_FETCH_ATTEMPTS = 6;
const SEARCH_ENRICHMENT_BATCH_SIZE = 3;
const ENABLE_PAGE_BRIDGE_ENRICHMENT = true;
const SEARCH_ENRICHMENT_START_DELAY_MS = 1800;
const PAGE_BRIDGE_SCRIPT_ID = 'levelup-adspro-page-bridge';
const PAGE_BRIDGE_REQUEST_EVENT = 'levelup-adspro:enrich-request';
const PAGE_BRIDGE_RESPONSE_EVENT = 'levelup-adspro:enrich-response';
const PAGE_BRIDGE_SHOP_REQUEST_EVENT = 'levelup-adspro:shop-request';
const PAGE_BRIDGE_SHOP_RESPONSE_EVENT = 'levelup-adspro:shop-response';
const PAGE_BRIDGE_TIMEOUT_MS = 5000;
const HEADER_LOGO_URL = chrome.runtime.getURL('header-logo.png');
const POWERED_BY_LOGO_URL = chrome.runtime.getURL('powered-by.png');
const resolvedSearchResultEnrichmentCache = new Map<string, SearchResultEnrichment>();
const shopeeShopResearchCache = new Map<string, ShopResearchSnapshot>();
const shopeeShopResearchMeta = new Map<
  string,
  { totalCount: number; nextOffset: number; hasMore: boolean; isLoading: boolean }
>();
const resolvedProductKeywordCache = new Map<
  string,
  { positive: string[]; negative: string[] }
>();
const pendingPageBridgeRequests = new Map<
  string,
  {
    resolve: (entries: SearchResultEnrichment[]) => void;
    reject: (error: Error) => void;
    timeoutId: number;
  }
>();
const pendingPageBridgeShopRequests = new Map<
  string,
  {
    resolve: (data: {
      base: Record<string, unknown>;
      detail: Record<string, unknown>;
      categories: Record<string, unknown> | null;
      itemsPayload: {
        total_count?: number;
        items?: Array<{ item_basic?: Record<string, unknown> }>;
      };
    }) => void;
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

type PageBridgeShopResponsePayload = {
  base: Record<string, unknown>;
  detail: Record<string, unknown>;
  categories: Record<string, unknown> | null;
  itemsPayload: {
    total_count?: number;
    items?: Array<{ item_basic?: Record<string, unknown> }>;
  };
};

type PageBridgeShopResponseMessage = {
  requestId: string;
  data?: PageBridgeShopResponsePayload;
  error?: string;
};

type RoasCalculatorState = {
  hpp: number | null;
  price: number | null;
  operasional: number | null;
  storeType: 'non_star' | 'star' | 'mall';
  promoXtraEnabled: boolean;
  gratisOngkirXtraEnabled: boolean;
  gratisOngkirProductSize: 'regular' | 'special';
  categoryLabel: string | null;
  kategoriFeePct: number | null;
  gratisOngkirPctRegular: number | null;
  gratisOngkirCapRegular: number | null;
  gratisOngkirPctSpecial: number | null;
  gratisOngkirCapSpecial: number | null;
};

type RoasTierKey = 'rugi' | 'kompetitif' | 'konservatif' | 'prospektif';

type RoasTierTone = 'danger' | 'warning' | 'safe' | 'prospect';

type RoasTierDefinition = {
  key: RoasTierKey;
  label: string;
  tone: RoasTierTone;
  resolveRoas: (base: number) => number;
};

type RoasComputedTier = RoasTierDefinition & {
  roas: number | null;
  biayaIklan: number | null;
  profit: number;
  marginPct: number;
};

type RoasMetrics = {
  price: number;
  biayaPokok: number;
  profitSebelumIklan: number;
  breakEvenRoas: number | null;
  tiers: RoasComputedTier[];
  totalBiayaShopee: number;
  totalBiayaShopeePct: number;
  feeKategori: number;
  feePromoXtra: number;
  feeGratisOngkirXtra: number;
  gratisOngkirPct: number;
  gratisOngkirCap: number;
  feeProsesPesanan: number;
};

type RoasPercentField =
  | 'kategoriFeePct'
  | 'gratisOngkirPctRegular'
  | 'gratisOngkirPctSpecial';

type RoasCurrencyField =
  | 'hpp'
  | 'price'
  | 'operasional'
  | 'gratisOngkirCapRegular'
  | 'gratisOngkirCapSpecial';

type RoasCategorySelection = {
  primary: string;
  secondary: string | null;
  name: string | null;
  gratisOngkirPctRegular?: number | null;
  gratisOngkirCapRegular?: number | null;
  gratisOngkirPctSpecial?: number | null;
  gratisOngkirCapSpecial?: number | null;
};

const roasCalculatorState: RoasCalculatorState = {
  hpp: null,
  price: null,
  operasional: null,
  storeType: 'non_star',
  promoXtraEnabled: false,
  gratisOngkirXtraEnabled: false,
  gratisOngkirProductSize: 'regular',
  categoryLabel: null,
  kategoriFeePct: 0,
  gratisOngkirPctRegular: 0,
  gratisOngkirCapRegular: 0,
  gratisOngkirPctSpecial: 0,
  gratisOngkirCapSpecial: 0,
};

let lastSelectedRoasCategory: RoasCategorySelection | null = null;

function isRoasPercentField(
  field: keyof RoasCalculatorState,
): field is RoasPercentField {
  return (
    field === 'kategoriFeePct' ||
    field === 'gratisOngkirPctRegular' ||
    field === 'gratisOngkirPctSpecial'
  );
}

function isRoasCurrencyField(
  field: keyof RoasCalculatorState,
): field is RoasCurrencyField {
  return (
    field === 'hpp' ||
    field === 'price' ||
    field === 'operasional' ||
    field === 'gratisOngkirCapRegular' ||
    field === 'gratisOngkirCapSpecial'
  );
}

const SHOPEE_ORDER_PROCESSING_FEE_IDR = 1250;
const SHOPEE_PROMO_XTRA_FEE_PCT = 4.5;
const SHOPEE_PROMO_XTRA_FEE_CAP_IDR = 60000;
const SHOPEE_AD_TAX_RATE = 0.11;

const SHOPEE_ADS_DASHBOARD_LABELS = {
  impressions: 'Iklan Dilihat',
  clicks: 'Jumlah Klik',
  ctr: 'Persentase Klik',
  orders: 'Pesanan',
  unitsSold: 'Produk Terjual',
  revenue: 'Penjualan dari Iklan',
  adSpend: 'Biaya Iklan',
  roas: 'ROAS',
} as const;

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

function buildShopeeProductUrl(input: {
  shopId: string;
  itemId: string;
  productTitle: string;
}) {
  const slug = cleanProductTitle(input.productTitle)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  const baseSlug = slug || 'produk-shopee';

  return `${window.location.origin}/${baseSlug}-i.${input.shopId}.${input.itemId}`;
}

function sortShopResearchProducts(
  products: ShopResearchSnapshot['products'],
  sortKey: 'revenue30d' | 'sold30d' | 'reviews' | 'newest',
) {
  return [...products].sort((a, b) => {
    const revenueDiff = (b.revenue30dEstimate ?? 0) - (a.revenue30dEstimate ?? 0);
    const soldDiff = (b.sold30d ?? 0) - (a.sold30d ?? 0);
    const reviewDiff = (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
    const newestDiff = (b.listingCtime ?? 0) - (a.listingCtime ?? 0);

    switch (sortKey) {
      case 'sold30d':
        return soldDiff || revenueDiff || reviewDiff || newestDiff;
      case 'reviews':
        return reviewDiff || revenueDiff || soldDiff || newestDiff;
      case 'newest':
        return newestDiff || revenueDiff || soldDiff || reviewDiff;
      case 'revenue30d':
      default:
        return revenueDiff || soldDiff || reviewDiff || newestDiff;
    }
  });
}

function ensureToastStyle() {
  if (document.getElementById(TOAST_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = TOAST_STYLE_ID;
  style.textContent = `
    #${TOAST_ROOT_ID} {
      position: fixed;
      right: 20px;
      bottom: 20px;
      display: grid;
      gap: 10px;
      z-index: 2147483647;
      pointer-events: none;
    }

    #${TOAST_ROOT_ID} .levelup-toast {
      min-width: 240px;
      max-width: min(360px, calc(100vw - 32px));
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 14px 34px rgba(15, 23, 42, 0.18);
      background: rgba(255, 255, 255, 0.98);
      color: #0f172a;
      font-family: Inter, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      pointer-events: auto;
    }

    #${TOAST_ROOT_ID} .levelup-toast[data-tone="success"] {
      border-left: 4px solid #16a34a;
    }

    #${TOAST_ROOT_ID} .levelup-toast[data-tone="error"] {
      border-left: 4px solid #dc2626;
    }
  `;

  document.head.appendChild(style);
}

function showToast(message: string, tone: 'success' | 'error' = 'success') {
  if (!message) {
    return;
  }

  ensureToastStyle();
  const root =
    document.getElementById(TOAST_ROOT_ID) ??
    (() => {
      const element = document.createElement('div');
      element.id = TOAST_ROOT_ID;
      document.body.appendChild(element);
      return element;
    })();

  root.replaceChildren();
  const toast = document.createElement('div');
  toast.className = 'levelup-toast';
  toast.dataset.tone = tone;
  toast.textContent = message;
  root.appendChild(toast);

  if (toastDismissTimeoutId) {
    window.clearTimeout(toastDismissTimeoutId);
  }

  toastDismissTimeoutId = window.setTimeout(() => {
    toastDismissTimeoutId = null;
    if (root.childElementCount === 1 && root.firstElementChild === toast) {
      root.replaceChildren();
    }
  }, 3200);
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

function formatDecimal(value: number | null, fractionDigits = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }

  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function normalizeShopeePriceValue(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value >= 10_000_000 ? Math.round(value / 100_000) : Math.round(value);
}

function formatCompactCurrencyLabel(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return '-';
  }

  if (value >= 1_000_000_000) {
    return `Rp${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }

  if (value >= 1_000_000) {
    return `Rp${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}JT`;
  }

  return `Rp${Math.round(value).toLocaleString('id-ID')}`;
}

function formatCompactCount(value: number | null, suffix: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return '-';
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}JT ${suffix}`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}RB ${suffix}`;
  }

  return `${Math.round(value).toLocaleString('id-ID')} ${suffix}`;
}

function formatListingAgeDays(days: number) {
  if (!Number.isFinite(days) || days < 0) {
    return '-';
  }

  if (days < 30) {
    return `${Math.max(1, Math.round(days))} hari`;
  }

  if (days < 365) {
    return `${Math.max(1, Math.round(days / 30))} bln`;
  }

  return `${(days / 365).toFixed(1).replace(/\.0$/, '')} thn`;
}

function formatListingAgeRange(minDays: number | null, maxDays: number | null) {
  if (typeof minDays !== 'number' || typeof maxDays !== 'number') {
    return '-';
  }

  return `${formatListingAgeDays(minDays)} - ${formatListingAgeDays(maxDays)}`;
}

function normalizeElementText(element: Element | null | undefined) {
  return normalizeText(element?.textContent);
}

function isLevelupManagedElement(element: Element | null | undefined) {
  return Boolean(element?.closest('[data-levelup-ads-managed="true"]'));
}

function isAdsDashboardMetricLabel(text: string, label: string) {
  return normalizeText(text).toLowerCase() === normalizeText(label).toLowerCase();
}

function isAdsDashboardMetricValue(text: string, label: string) {
  const normalized = normalizeText(text);
  if (!normalized || isAdsDashboardMetricLabel(normalized, label)) {
    return false;
  }

  if (!/\d/.test(normalized) || normalized.length > 32) {
    return false;
  }

  return !/^\d{2}:\d{2}$/.test(normalized);
}

function collectLeafTexts(root: Element) {
  return Array.from(root.querySelectorAll<HTMLElement>('span, div, p, strong, h1, h2, h3, h4, h5, h6'))
    .filter((element) => !isLevelupManagedElement(element))
    .map((element) => normalizeElementText(element))
    .filter((text) => text.length > 0 && text.length <= 80);
}

function findShopeeAdsMetricCard(label: string) {
  const labelLower = label.toLowerCase();
  const labelElements = Array.from(
    document.querySelectorAll<HTMLElement>('div, span, p, h1, h2, h3, h4, h5, h6'),
  ).filter(
    (element) =>
      !isLevelupManagedElement(element) &&
      normalizeElementText(element).toLowerCase() === labelLower,
  );

  for (const labelElement of labelElements) {
    let current: HTMLElement | null = labelElement;
    while (current && current !== document.body) {
      const texts = collectLeafTexts(current);
      const hasLabel = texts.some((text) => text.toLowerCase() === labelLower);
      const hasValue = texts.some((text) => isAdsDashboardMetricValue(text, label));
      const textLength = normalizeElementText(current).length;

      if (hasLabel && hasValue && textLength >= 12 && textLength <= 240) {
        return {
          cardElement: current,
          labelElement,
        };
      }

      current = current.parentElement;
    }
  }

  return null;
}

function mergeAdsMetricSnapshot(
  currentMetric?: NonNullable<PageSnapshot['adsDashboard']>[keyof NonNullable<PageSnapshot['adsDashboard']>] | null,
  previousMetric?: NonNullable<PageSnapshot['adsDashboard']>[keyof NonNullable<PageSnapshot['adsDashboard']>] | null,
) {
  const currentHasValue = Boolean(
    currentMetric &&
      (typeof currentMetric.numericValue === 'number' ||
        normalizeText(currentMetric.rawValue).length > 0),
  );

  return currentHasValue ? currentMetric ?? undefined : previousMetric ?? undefined;
}

function getStableShopeeAdsDashboard(snapshot: PageSnapshot) {
  const current = snapshot.adsDashboard ?? null;
  if (!current && lastStableShopeeAdsDashboard) {
    return lastStableShopeeAdsDashboard;
  }

  if (!current) {
    return null;
  }

  const merged: NonNullable<PageSnapshot['adsDashboard']> = {
    impressions: mergeAdsMetricSnapshot(current.impressions, lastStableShopeeAdsDashboard?.impressions),
    clicks: mergeAdsMetricSnapshot(current.clicks, lastStableShopeeAdsDashboard?.clicks),
    ctr: mergeAdsMetricSnapshot(current.ctr, lastStableShopeeAdsDashboard?.ctr),
    orders: mergeAdsMetricSnapshot(current.orders, lastStableShopeeAdsDashboard?.orders),
    unitsSold: mergeAdsMetricSnapshot(current.unitsSold, lastStableShopeeAdsDashboard?.unitsSold),
    revenue: mergeAdsMetricSnapshot(current.revenue, lastStableShopeeAdsDashboard?.revenue),
    adSpend: mergeAdsMetricSnapshot(current.adSpend, lastStableShopeeAdsDashboard?.adSpend),
    roas: mergeAdsMetricSnapshot(current.roas, lastStableShopeeAdsDashboard?.roas),
  };

  lastStableShopeeAdsDashboard = merged;
  return merged;
}

function findShopeeAdsMetricValueElement(
  cardElement: HTMLElement,
  label: string,
  rawValue?: string | null,
) {
  const normalizedRawValue = normalizeText(rawValue);
  const candidates = Array.from(
    cardElement.querySelectorAll<HTMLElement>('span, div, p, strong, h1, h2, h3, h4, h5, h6'),
  )
    .filter((element) => !isLevelupManagedElement(element))
    .map((element) => ({
      element,
      text: normalizeElementText(element),
    }))
    .filter(({ text }) => isAdsDashboardMetricValue(text, label))
    .sort((left, right) => {
      const leftExact = Number(normalizeText(left.text) === normalizedRawValue);
      const rightExact = Number(normalizeText(right.text) === normalizedRawValue);
      if (leftExact !== rightExact) {
        return rightExact - leftExact;
      }

      return normalizeText(left.text).length - normalizeText(right.text).length;
    });

  return candidates[0]?.element ?? null;
}

function findLowestCommonAncestor(elements: HTMLElement[]) {
  const [first, ...rest] = elements;
  if (!first) {
    return null;
  }

  let current: HTMLElement | null = first;
  while (current) {
    if (rest.every((element) => current?.contains(element))) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function findShopeeAdsSummaryAnchor() {
  const anchorCards = [
    findShopeeAdsMetricCard(SHOPEE_ADS_DASHBOARD_LABELS.impressions)?.cardElement,
    findShopeeAdsMetricCard(SHOPEE_ADS_DASHBOARD_LABELS.clicks)?.cardElement,
    findShopeeAdsMetricCard(SHOPEE_ADS_DASHBOARD_LABELS.adSpend)?.cardElement,
    findShopeeAdsMetricCard(SHOPEE_ADS_DASHBOARD_LABELS.roas)?.cardElement,
  ].filter((value): value is HTMLElement => Boolean(value));

  if (anchorCards.length === 0) {
    return null;
  }

  const anchorContainer =
    findLowestCommonAncestor(anchorCards) ?? anchorCards[0]?.parentElement ?? null;
  const anchorParent = anchorContainer?.parentElement ?? null;

  if (!anchorContainer || !anchorParent) {
    return null;
  }

  return {
    anchorCards,
    anchorContainer,
    anchorParent,
  };
}

function findShopeeAdsDashboardWatchRoot() {
  const anchor = findShopeeAdsSummaryAnchor();
  const anchorContainer = anchor?.anchorContainer ?? null;
  return anchorContainer?.parentElement ?? anchorContainer;
}

function toRelevantElement(node: Node | null | undefined) {
  if (!node) {
    return null;
  }

  if (node instanceof HTMLElement) {
    return node;
  }

  if (node instanceof Text) {
    return node.parentElement;
  }

  return null;
}

function mutationTouchesElement(mutation: MutationRecord, rootElement: HTMLElement) {
  const targetElement = toRelevantElement(mutation.target);
  if (
    targetElement &&
    !isLevelupManagedElement(targetElement) &&
    (rootElement.contains(targetElement) || targetElement.contains(rootElement))
  ) {
    return true;
  }

  const changedElements = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)]
    .map((node) => toRelevantElement(node))
    .filter((element): element is HTMLElement => Boolean(element));

  return changedElements.some(
    (element) =>
      !isLevelupManagedElement(element) &&
      (rootElement.contains(element) || element.contains(rootElement)),
  );
}

function removeShopeeAdsDashboardEnhancement() {
  document.getElementById(ADS_DASHBOARD_ENHANCEMENT_ID)?.remove();
  document
    .querySelectorAll<HTMLElement>('[data-levelup-ads-managed="true"]')
    .forEach((element) => element.remove());
}

function clearAdsDashboardBootstrapRetry() {
  if (adsDashboardBootstrapRetryTimeoutId) {
    window.clearTimeout(adsDashboardBootstrapRetryTimeoutId);
    adsDashboardBootstrapRetryTimeoutId = null;
  }
  adsDashboardBootstrapRetryCount = 0;
}

function scheduleAdsDashboardBootstrapRetry() {
  if (!isOwnedShopeeAdsPageSnapshot(lastSnapshot)) {
    clearAdsDashboardBootstrapRetry();
    return;
  }

  if (adsDashboardBootstrapRetryTimeoutId) {
    return;
  }

  const delay =
    ADS_DASHBOARD_BOOTSTRAP_RETRY_DELAYS_MS[adsDashboardBootstrapRetryCount] ??
    ADS_DASHBOARD_BOOTSTRAP_RETRY_DELAYS_MS[ADS_DASHBOARD_BOOTSTRAP_RETRY_DELAYS_MS.length - 1];

  adsDashboardBootstrapRetryTimeoutId = window.setTimeout(() => {
    adsDashboardBootstrapRetryTimeoutId = null;
    adsDashboardBootstrapRetryCount += 1;
    void sendSnapshot();
  }, delay);
}

function renderShopeeAdsDashboardEnhancement(snapshot: PageSnapshot) {
  const adsDashboard = getStableShopeeAdsDashboard(snapshot);
  if (!adsDashboard) {
    removeShopeeAdsDashboardEnhancement();
    return false;
  }

  const impressions = adsDashboard.impressions?.numericValue ?? null;
  const clicks = adsDashboard.clicks?.numericValue ?? null;
  const conversionSourceCount =
    snapshot.pageType === 'shopee_ads_product_detail'
      ? adsDashboard.unitsSold?.numericValue ?? null
      : adsDashboard.orders?.numericValue ?? null;
  const revenue = adsDashboard.revenue?.numericValue ?? null;
  const baseAdSpend = adsDashboard.adSpend?.numericValue ?? null;
  const actualAdSpend =
    typeof baseAdSpend === 'number' && Number.isFinite(baseAdSpend)
      ? Math.round(baseAdSpend * (1 + SHOPEE_AD_TAX_RATE))
      : null;

  const conversionRate =
    typeof clicks === 'number' && clicks > 0 && typeof conversionSourceCount === 'number'
      ? (conversionSourceCount / clicks) * 100
      : null;
  const costPerClick =
    typeof clicks === 'number' && clicks > 0 && typeof baseAdSpend === 'number'
      ? baseAdSpend / clicks
      : null;
  const acos =
    typeof revenue === 'number' && revenue > 0 && typeof baseAdSpend === 'number'
      ? (baseAdSpend / revenue) * 100
      : null;
  const rpm =
    typeof impressions === 'number' && impressions > 0 && typeof revenue === 'number'
      ? (revenue / impressions) * 1000
      : null;
  const actualRoas =
    typeof actualAdSpend === 'number' && actualAdSpend > 0 && typeof revenue === 'number'
      ? revenue / actualAdSpend
      : null;

  const anchor = findShopeeAdsSummaryAnchor();
  if (!anchor) {
    removeShopeeAdsDashboardEnhancement();
    return false;
  }
  const { anchorContainer, anchorParent } = anchor;
  if (!anchorContainer || !anchorParent) {
    removeShopeeAdsDashboardEnhancement();
    return false;
  }

  let enhancement = document.getElementById(ADS_DASHBOARD_ENHANCEMENT_ID);
  if (!enhancement) {
    enhancement = document.createElement('div');
    enhancement.id = ADS_DASHBOARD_ENHANCEMENT_ID;
    enhancement.setAttribute('data-levelup-ads-managed', 'true');
  }

  enhancement.innerHTML = `
    <div class="levelup-adspro-dashboard-grid">
      <div class="levelup-adspro-dashboard-card">
        <div class="levelup-adspro-dashboard-label">Tingkat Konversi</div>
        <div class="levelup-adspro-dashboard-value">${formatPercent(conversionRate)}</div>
      </div>
      <div class="levelup-adspro-dashboard-card">
        <div class="levelup-adspro-dashboard-label">Biaya Per-Klik</div>
        <div class="levelup-adspro-dashboard-value">${formatCurrency(typeof costPerClick === 'number' ? Math.round(costPerClick) : undefined)}</div>
      </div>
      <div class="levelup-adspro-dashboard-card">
        <div class="levelup-adspro-dashboard-label">ACOS</div>
        <div class="levelup-adspro-dashboard-value">${formatPercent(acos)}</div>
      </div>
      <div class="levelup-adspro-dashboard-card">
        <div class="levelup-adspro-dashboard-label">RPM</div>
        <div class="levelup-adspro-dashboard-value">${formatCurrency(typeof rpm === 'number' ? Math.round(rpm) : undefined)}</div>
      </div>
    </div>
    <div class="levelup-adspro-dashboard-footer">
      <img
        class="levelup-adspro-powered-by"
        src="${POWERED_BY_LOGO_URL}"
        alt="Powered by LevelUP adsPRO"
      />
    </div>
  `;

  if (anchorContainer.nextSibling !== enhancement) {
    anchorParent.insertBefore(enhancement, anchorContainer.nextSibling);
  }

  const adSpendCard = findShopeeAdsMetricCard(SHOPEE_ADS_DASHBOARD_LABELS.adSpend);
  if (adSpendCard) {
    const { cardElement, labelElement } = adSpendCard;
    cardElement.classList.add('levelup-adspro-native-card-enhanced');
    labelElement
      .querySelector<HTMLElement>('[data-role="levelup-ads-actual-badge"]')
      ?.remove();

    let actualInline = cardElement.querySelector<HTMLElement>('[data-role="levelup-ads-actual-inline"]');
    if (!actualInline) {
      actualInline = document.createElement('div');
      actualInline.setAttribute('data-role', 'levelup-ads-actual-inline');
      actualInline.setAttribute('data-levelup-ads-managed', 'true');
      actualInline.className = 'levelup-adspro-actual-inline';
      cardElement.appendChild(actualInline);
    }

    actualInline.innerHTML =
      typeof actualAdSpend === 'number'
        ? `Aktual ${formatCurrency(actualAdSpend)}<span class="levelup-adspro-actual-tooltip">Hasil biaya iklan setelah ditambah pajak iklan 11%</span>`
        : `Aktual -<span class="levelup-adspro-actual-tooltip">Hasil biaya iklan setelah ditambah pajak iklan 11%</span>`;

    const adSpendValueElement = findShopeeAdsMetricValueElement(
      cardElement,
      SHOPEE_ADS_DASHBOARD_LABELS.adSpend,
      adsDashboard.adSpend?.rawValue,
    );

    if (adSpendValueElement) {
      const valueRect = adSpendValueElement.getBoundingClientRect();
      const cardRect = cardElement.getBoundingClientRect();
      actualInline.style.top = `${Math.max(30, Math.round(valueRect.top - cardRect.top + 1))}px`;
    }
  }

  const roasCard = findShopeeAdsMetricCard(SHOPEE_ADS_DASHBOARD_LABELS.roas);
  if (roasCard) {
    const { cardElement } = roasCard;
    cardElement.classList.add('levelup-adspro-native-card-enhanced');

    let actualInline = cardElement.querySelector<HTMLElement>('[data-role="levelup-roas-actual-inline"]');
    if (!actualInline) {
      actualInline = document.createElement('div');
      actualInline.setAttribute('data-role', 'levelup-roas-actual-inline');
      actualInline.setAttribute('data-levelup-ads-managed', 'true');
      actualInline.className = 'levelup-adspro-actual-inline';
      cardElement.appendChild(actualInline);
    }

    actualInline.innerHTML =
      typeof actualRoas === 'number'
        ? `Aktual ${formatDecimal(actualRoas, 2)}<span class="levelup-adspro-actual-tooltip">ROAS aktual setelah biaya iklan ditambah pajak iklan 11%</span>`
        : `Aktual -<span class="levelup-adspro-actual-tooltip">ROAS aktual setelah biaya iklan ditambah pajak iklan 11%</span>`;

    const roasValueElement = findShopeeAdsMetricValueElement(
      cardElement,
      SHOPEE_ADS_DASHBOARD_LABELS.roas,
      adsDashboard.roas?.rawValue,
    );

    if (roasValueElement) {
      const valueRect = roasValueElement.getBoundingClientRect();
      const cardRect = cardElement.getBoundingClientRect();
      actualInline.style.top = `${Math.max(30, Math.round(valueRect.top - cardRect.top + 1))}px`;
    }
  }

  return true;
}

function rerenderCurrentRoasSurface() {
  if (
    lastSnapshot?.pageType === 'shopee_ads_product_detail' &&
    lastSnapshot.captureMode === 'owned'
  ) {
    roasProductSurfaceRenderNonce += 1;
    renderOverlay(lastSnapshot);
    return;
  }

  if (isRoasCalculatorOpen && lastRoasProductDetail) {
    openRoasCalculator(lastRoasProductDetail);
  }
}

function renderShopeeAdsProductDetailOverlay(snapshot: PageSnapshot) {
  const anchor = findShopeeAdsSummaryAnchor();
  if (!anchor) {
    removeOverlay();
    return false;
  }

  const detail =
    snapshot.productDetail ??
    ({
      productTitle: 'Produk Shopee',
      productUrl: snapshot.url,
      shopName: null,
      highlights: [],
    } satisfies ProductDetailSnapshot);

  lastRoasProductDetail = detail;

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
    if (
      lastSnapshot?.pageType !== 'shopee_ads_product_detail' ||
      lastRoasProductDetail?.productUrl !== detail.productUrl
    ) {
      return;
    }
    renderOverlay(lastSnapshot);
  });

  const metrics = computeRoasMetrics();
  const tiers = metrics?.tiers ?? [];
  const profitSebelumIklan = metrics?.profitSebelumIklan ?? null;
  const profitSebelumIklanPct =
    metrics && typeof metrics.price === 'number' && metrics.price > 0
      ? (metrics.profitSebelumIklan / metrics.price) * 100
      : null;
  const categoryHelperText = getRoasCategoryHelperText();

  const overlay = document.getElementById(OVERLAY_ID) ?? document.createElement('section');
  overlay.id = OVERLAY_ID;
  overlay.dataset.layoutMode = 'product';
  overlay.dataset.pageKind = 'owned-ads-product';
  overlay.setAttribute('data-levelup-ads-managed', 'true');
  const nextRenderKey = `${detail.productUrl}|${cleanProductTitle(detail.productTitle)}|${roasProductSurfaceRenderNonce}`;
  const shouldRefreshMarkup = overlay.dataset.renderKey !== nextRenderKey;

  if (!overlay.isConnected || overlay.parentElement !== anchor.anchorParent) {
    anchor.anchorParent.insertBefore(overlay, anchor.anchorContainer);
  } else if (overlay.nextSibling !== anchor.anchorContainer) {
    anchor.anchorParent.insertBefore(overlay, anchor.anchorContainer);
  }

  if (!shouldRefreshMarkup) {
    return true;
  }

  overlay.dataset.renderKey = nextRenderKey;
  overlay.innerHTML = `
    <div class="levelup-product-inline-shell">
      <div class="levelup-header">
        <div class="levelup-brand-copy">
          <div class="levelup-title levelup-product-roas-title">
            <span>Kalkulator ROAS |</span>
            <img
              class="levelup-product-roas-title-logo"
              src="${POWERED_BY_LOGO_URL}"
              alt="LevelUP adsPRO"
            />
          </div>
        </div>
        <div class="levelup-header-actions">
          <button type="button" class="levelup-button levelup-button-secondary" data-action="roas-reset">Reset Data</button>
        </div>
      </div>
      <div class="levelup-body">
        <div class="levelup-product-inline-body">
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
          <div class="levelup-product-inline-form">
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
                  <input type="radio" name="levelup-roas-store-type-inline" value="non_star" ${roasCalculatorState.storeType === 'non_star' ? 'checked' : ''} />
                  <span class="levelup-roas-radio-label">Non-Star</span>
                </label>
                <label class="levelup-roas-radio">
                  <input type="radio" name="levelup-roas-store-type-inline" value="star" ${roasCalculatorState.storeType === 'star' ? 'checked' : ''} />
                  <span class="levelup-roas-radio-label">Star/Star+</span>
                </label>
                <label class="levelup-roas-radio">
                  <input type="radio" name="levelup-roas-store-type-inline" value="mall" ${roasCalculatorState.storeType === 'mall' ? 'checked' : ''} />
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
              <div class="levelup-note" data-role="roas-category-helper"${categoryHelperText ? '' : ' hidden'}>${categoryHelperText}</div>
            </div>
            <div class="levelup-roas-field">
              <div class="levelup-roas-field-label">Operasional</div>
              <input class="levelup-roas-input" data-field="operasional" inputmode="numeric" placeholder="Rp 0" value="${roasCalculatorState.operasional ? formatCompactCurrency(roasCalculatorState.operasional) : ''}" />
            </div>
            <div class="levelup-roas-field">
              <div class="levelup-roas-program-grid">
                <div class="levelup-roas-program-card" data-align="right">
                  <div class="levelup-roas-program-copy">
                    <div class="levelup-roas-field-label levelup-field-label-row">
                      <span>Promo Extra</span>
                      <span class="levelup-tooltip">
                        <button type="button" class="levelup-roas-program-title levelup-roas-program-title-button" aria-label="Info Promo Extra">ⓘ</button>
                        <span class="levelup-tooltip-panel">${SHOPEE_PROMO_XTRA_FEE_PCT.toFixed(1)}% maks Rp${SHOPEE_PROMO_XTRA_FEE_CAP_IDR.toLocaleString('id-ID')}</span>
                      </span>
                    </div>
                  </div>
                  <div class="levelup-roas-program-actions">
                    <label class="levelup-toggle">
                      <input type="checkbox" data-field="promoXtraEnabled" ${roasCalculatorState.promoXtraEnabled ? 'checked' : ''} />
                      <span class="levelup-toggle-track"></span>
                    </label>
                  </div>
                </div>
                <div class="levelup-roas-program-card" data-align="left">
                  <div class="levelup-roas-program-copy">
                    <div class="levelup-roas-field-label levelup-field-label-row">
                      <span>Ongkir Extra</span>
                      <span class="levelup-tooltip">
                        <button type="button" class="levelup-roas-program-title levelup-roas-program-title-button" aria-label="Info Ongkir Extra">ⓘ</button>
                        <span class="levelup-tooltip-panel" data-role="gratis-ongkir-tooltip">Pilih kategori produk untuk memuat persen dan cap Ongkir Extra.</span>
                      </span>
                    </div>
                  </div>
                  <div class="levelup-roas-program-actions">
                    <label class="levelup-toggle">
                      <input type="checkbox" data-field="gratisOngkirXtraEnabled" ${roasCalculatorState.gratisOngkirXtraEnabled ? 'checked' : ''} />
                      <span class="levelup-toggle-track"></span>
                    </label>
                    <button type="button" class="levelup-button levelup-button-secondary" data-action="gratis-ongkir-open-popup" data-role="gratis-ongkir-size-field" ${roasCalculatorState.gratisOngkirXtraEnabled ? '' : 'hidden'}>Ukuran</button>
                  </div>
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
            <div class="levelup-roas-popup-backdrop" data-role="gratis-ongkir-size-popup" hidden>
              <div class="levelup-roas-popup-card" role="dialog" aria-modal="false" aria-label="Pilih ukuran Ongkir Extra">
                <div class="levelup-roas-popup-title">Pilih Ukuran Ongkir Extra</div>
                <div class="levelup-roas-popup-note">Pilih ukuran produk agar persen dan cap Ongkir Extra mengikuti kategori yang sesuai.</div>
                <div class="levelup-roas-size-group" role="group" aria-label="Pilih ukuran produk untuk Ongkir Extra">
                  <label class="levelup-roas-radio">
                    <input type="radio" name="levelup-gratis-ongkir-size-inline" value="regular" ${roasCalculatorState.gratisOngkirProductSize === 'regular' ? 'checked' : ''} />
                    <span class="levelup-roas-radio-label">Ukuran Biasa</span>
                  </label>
                  <label class="levelup-roas-radio">
                    <input type="radio" name="levelup-gratis-ongkir-size-inline" value="special" ${roasCalculatorState.gratisOngkirProductSize === 'special' ? 'checked' : ''} />
                    <span class="levelup-roas-radio-label">Ukuran Khusus</span>
                  </label>
                </div>
                <div class="levelup-roas-popup-actions">
                  <button type="button" class="levelup-button levelup-button-secondary" data-action="gratis-ongkir-close-popup">Tutup</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  let isGratisOngkirPopupOpen = false;
  const resetButton = overlay.querySelector<HTMLButtonElement>('[data-action="roas-reset"]');
  const pickCategoryButton = overlay.querySelector<HTMLButtonElement>('[data-action="roas-pick-category"]');
  const inputs = Array.from(overlay.querySelectorAll<HTMLInputElement>('.levelup-roas-input'));
  const storeTypeRadios = Array.from(
    overlay.querySelectorAll<HTMLInputElement>('input[name="levelup-roas-store-type-inline"]'),
  );
  const promoToggle = overlay.querySelector<HTMLInputElement>('[data-field="promoXtraEnabled"]');
  const gratisOngkirToggle = overlay.querySelector<HTMLInputElement>(
    '[data-field="gratisOngkirXtraEnabled"]',
  );
  const gratisOngkirOpenPopupButton = overlay.querySelector<HTMLButtonElement>(
    '[data-action="gratis-ongkir-open-popup"]',
  );
  const gratisOngkirClosePopupButton = overlay.querySelector<HTMLButtonElement>(
    '[data-action="gratis-ongkir-close-popup"]',
  );
  const gratisOngkirSizeField = overlay.querySelector<HTMLElement>(
    '[data-role="gratis-ongkir-size-field"]',
  );
  const gratisOngkirSizePopup = overlay.querySelector<HTMLElement>(
    '[data-role="gratis-ongkir-size-popup"]',
  );
  const gratisOngkirSizePopupCard = overlay.querySelector<HTMLElement>('.levelup-roas-popup-card');
  const gratisOngkirSizeRadios = Array.from(
    overlay.querySelectorAll<HTMLInputElement>('input[name="levelup-gratis-ongkir-size-inline"]'),
  );
  const gratisOngkirTooltip = overlay.querySelector<HTMLElement>('[data-role="gratis-ongkir-tooltip"]');
  const categoryHelperNote = overlay.querySelector<HTMLElement>('[data-role="roas-category-helper"]');
  const profitLabel = overlay.querySelector<HTMLElement>('[data-role="roas-profit-label"]');
  const profitPct = overlay.querySelector<HTMLElement>('[data-role="roas-profit-pct"]');
  const shopeeFeeLabel = overlay.querySelector<HTMLElement>('[data-role="roas-shopee-fee"]');
  const shopeeFeeTooltipContent = overlay.querySelector<HTMLElement>(
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
    if (pickCategoryButton) {
      pickCategoryButton.textContent = roasCalculatorState.categoryLabel || 'Pilih Kategori';
    }
    if (categoryHelperNote) {
      const nextHelperText = getRoasCategoryHelperText();
      categoryHelperNote.textContent = nextHelperText;
      categoryHelperNote.hidden = !nextHelperText;
    }
    if (gratisOngkirSizeField) {
      gratisOngkirSizeField.hidden = !roasCalculatorState.gratisOngkirXtraEnabled;
    }
    if (gratisOngkirOpenPopupButton) {
      gratisOngkirOpenPopupButton.disabled = !roasCalculatorState.gratisOngkirXtraEnabled;
    }
    if (gratisOngkirSizePopup) {
      gratisOngkirSizePopup.hidden =
        !roasCalculatorState.gratisOngkirXtraEnabled || !isGratisOngkirPopupOpen;
    }
    for (const radio of gratisOngkirSizeRadios) {
      radio.checked = radio.value === roasCalculatorState.gratisOngkirProductSize;
    }
    if (gratisOngkirTooltip) {
      gratisOngkirTooltip.textContent =
        'Pilih kategori produk untuk memuat persen dan cap Ongkir Extra.';
    }
    if (shopeeFeeTooltipContent) {
      if (!computed) {
        shopeeFeeTooltipContent.innerHTML = '';
      } else {
        const parts = [
          `Fee kategori: ${formatCompactCurrency(Math.round(computed.feeKategori))} (${formatPercent(roasCalculatorState.kategoriFeePct ?? 0)})`,
          `Biaya proses pesanan: Rp${SHOPEE_ORDER_PROCESSING_FEE_IDR.toLocaleString('id-ID')}`,
          getGratisOngkirTooltipLine(computed),
        ];
        if (roasCalculatorState.promoXtraEnabled) {
          parts.push(
            `Promo Xtra: ${formatCompactCurrency(Math.round(computed.feePromoXtra))} (${SHOPEE_PROMO_XTRA_FEE_PCT.toFixed(1)}%, maks Rp${SHOPEE_PROMO_XTRA_FEE_CAP_IDR.toLocaleString('id-ID')})`,
          );
        }
        shopeeFeeTooltipContent.innerHTML = parts.map((part) => `<span>${part}</span>`).join('');
      }
    }

    const tierElements = Array.from(overlay.querySelectorAll<HTMLElement>('.levelup-roas-tier'));
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

  resetButton?.addEventListener('click', () => {
    const resetDefaults = getSelectedShopRoasDefaults(lastKnownState);
    roasCalculatorState.hpp = null;
    roasCalculatorState.operasional = null;
    roasCalculatorState.storeType = resetDefaults?.storeType ?? 'non_star';
    roasCalculatorState.promoXtraEnabled = resetDefaults?.promoXtraEnabled ?? false;
    roasCalculatorState.gratisOngkirXtraEnabled = false;
    roasCalculatorState.gratisOngkirProductSize = 'regular';
    isGratisOngkirPopupOpen = false;
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
        });
    });
  }

  promoToggle?.addEventListener('change', () => {
    roasCalculatorState.promoXtraEnabled = Boolean(promoToggle.checked);
    refreshComputed();
  });

  gratisOngkirToggle?.addEventListener('change', () => {
    const previousEnabled = roasCalculatorState.gratisOngkirXtraEnabled;
    const nextEnabled = Boolean(gratisOngkirToggle.checked);
    roasCalculatorState.gratisOngkirXtraEnabled = nextEnabled;
    isGratisOngkirPopupOpen = !previousEnabled && nextEnabled;
    refreshComputed();
  });

  gratisOngkirOpenPopupButton?.addEventListener('click', () => {
    if (!roasCalculatorState.gratisOngkirXtraEnabled) {
      return;
    }

    isGratisOngkirPopupOpen = true;
    refreshComputed();
  });

  gratisOngkirClosePopupButton?.addEventListener('click', () => {
    isGratisOngkirPopupOpen = false;
    refreshComputed();
  });

  gratisOngkirSizePopupCard?.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  for (const radio of gratisOngkirSizeRadios) {
    radio.addEventListener('change', () => {
      const nextValue = normalizeText(radio.value);
      if (!(nextValue === 'regular' || nextValue === 'special')) {
        return;
      }

      roasCalculatorState.gratisOngkirProductSize = nextValue;
      isGratisOngkirPopupOpen = false;
      refreshComputed();
    });
  }

  gratisOngkirSizePopup?.addEventListener('click', (event) => {
    if (event.target === gratisOngkirSizePopup) {
      isGratisOngkirPopupOpen = false;
      refreshComputed();
    }
  });

  for (const input of inputs) {
    input.addEventListener('input', () => {
      const field = input.dataset.field as keyof RoasCalculatorState | undefined;
      if (!field) {
        return;
      }

      if (isRoasPercentField(field)) {
        const normalized = normalizeText(input.value).replace(',', '.');
        const parsed = Number.parseFloat(normalized);
        roasCalculatorState[field] = Number.isFinite(parsed) ? parsed : 0;
        if (field === 'kategoriFeePct') {
          lastRoasCategorySelectionSource = Number.isFinite(parsed) && parsed > 0 ? 'manual' : null;
        }
        refreshComputed();
        return;
      }

      if (!isRoasCurrencyField(field)) {
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

  refreshComputed();
  return true;
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
  return /^\d+\s*bintang\s*\([\d.,A-Za-z+]+\)$/i.test(normalizeText(value));
}

function formatRatingDistributionHighlight(value: string) {
  const normalized = normalizeText(value);
  const matched = normalized.match(/^(\d+)\s*bintang\s*(\([\d.,A-Za-z+]+\))$/i);
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

const PRODUCT_KEYWORD_STOPWORDS = new Set([
  'yang',
  'dan',
  'atau',
  'dengan',
  'untuk',
  'dari',
  'di',
  'ke',
  'ini',
  'itu',
  'saya',
  'aku',
  'kamu',
  'dia',
  'kami',
  'kita',
  'mereka',
  'the',
  'a',
  'an',
  'of',
  'to',
  'in',
  'on',
  'is',
  'are',
  'was',
  'were',
  'very',
  'banget',
  'bgt',
  'nya',
  'jg',
  'juga',
  'ga',
  'gak',
  'nggak',
  'tdk',
  'tidak',
  'udah',
  'sudah',
  'belum',
  'lagi',
  'jadi',
  'karena',
  'pas',
  'sih',
  'kok',
  'lah',
  'deh',
  'nya',
]);

function tokenizeKeywordText(input: string) {
  return normalizeText(input)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !PRODUCT_KEYWORD_STOPWORDS.has(token))
    .filter((token) => !/^\d+$/.test(token));
}

function pickTopKeywords(tokens: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

async function fetchShopeeKeywordInsights(ids: { shopId: string; itemId: string }) {
  const cacheKey = `${ids.shopId}:${ids.itemId}`;
  const cached = resolvedProductKeywordCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const endpoint = new URL('/api/v2/item/get_ratings', window.location.origin);
  endpoint.searchParams.set('filter', '0');
  endpoint.searchParams.set('flag', '1');
  endpoint.searchParams.set('limit', '8');
  endpoint.searchParams.set('offset', '0');
  endpoint.searchParams.set('type', '0');
  endpoint.searchParams.set('exclude_filter', '1');
  endpoint.searchParams.set('filter_size', '0');
  endpoint.searchParams.set('fold_filter', '0');
  endpoint.searchParams.set('relevant_reviews', 'false');
  endpoint.searchParams.set('request_source', '2');
  endpoint.searchParams.set('tag_filter', '');
  endpoint.searchParams.set('variation_filters', '');
  endpoint.searchParams.set('need_translation', '1');
  endpoint.searchParams.set('shopid', ids.shopId);
  endpoint.searchParams.set('itemid', ids.itemId);

  const response = await fetch(endpoint.toString(), {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Gagal mengambil ulasan untuk keyword insight.');
  }

  const payload = (await response.json()) as any;
  const ratings =
    payload?.data?.ratings ??
    payload?.data?.items ??
    payload?.ratings ??
    payload?.items ??
    [];

  const positiveTokens: string[] = [];
  const negativeTokens: string[] = [];

  for (const rating of Array.isArray(ratings) ? ratings : []) {
    const comment =
      normalizeText(rating?.comment) ||
      normalizeText(rating?.comment_text) ||
      normalizeText(rating?.commentText) ||
      '';
    if (!comment || comment.length < 6) {
      continue;
    }

    const score =
      typeof rating?.rating_star === 'number'
        ? rating.rating_star
        : typeof rating?.ratingStar === 'number'
        ? rating.ratingStar
        : typeof rating?.rating === 'number'
        ? rating.rating
        : null;

    const tokens = tokenizeKeywordText(comment);
    if (tokens.length === 0) {
      continue;
    }

    if (score !== null && score <= 2) {
      negativeTokens.push(...tokens);
      continue;
    }

    if (score !== null && score >= 4) {
      positiveTokens.push(...tokens);
      continue;
    }

    positiveTokens.push(...tokens.slice(0, 6));
  }

  const result = {
    positive: pickTopKeywords(positiveTokens, 6),
    negative: pickTopKeywords(negativeTokens, 6),
  };

  resolvedProductKeywordCache.set(cacheKey, result);
  return result;
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
  if (snapshot.pageType === 'shopee_public_shop') {
    if (snapshot.shopResearch) {
      return snapshot;
    }

    const shopId =
      snapshot.shopIdentifier && /^\d+$/.test(snapshot.shopIdentifier)
        ? snapshot.shopIdentifier
        : null;
    const cached = shopId ? shopeeShopResearchCache.get(shopId) ?? null : null;
    return cached
      ? {
          ...snapshot,
          shopResearch: cached,
        }
      : snapshot;
  }

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
    totalRevenueHint:
      normalizeText(enrichment.totalRevenueHint) || detail.totalRevenueHint,
    monthlyRevenueHint:
      normalizeText(enrichment.monthlyRevenueHint) || detail.monthlyRevenueHint,
    listingAgeHint:
      normalizeText(enrichment.listingAgeHint) || detail.listingAgeHint,
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
    totalRevenueHint: snapshot.productDetail.totalRevenueHint,
    monthlyRevenueHint: snapshot.productDetail.monthlyRevenueHint,
    listingAgeHint: snapshot.productDetail.listingAgeHint,
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

async function requestPageBridgeShopResearch(input: {
  shopId: string;
  limit: number;
  offset: number;
}) {
  await ensurePageBridgeInjected();

  return new Promise<PageBridgeShopResponsePayload>((resolve, reject) => {
    const requestId = `shopee-shop-${Date.now()}-${++pageBridgeRequestSequence}`;
    const timeoutId = window.setTimeout(() => {
      pendingPageBridgeShopRequests.delete(requestId);
      reject(new Error('Bridge riset toko Shopee timeout.'));
    }, PAGE_BRIDGE_TIMEOUT_MS);

    pendingPageBridgeShopRequests.set(requestId, {
      resolve,
      reject,
      timeoutId,
    });

    document.dispatchEvent(
      new CustomEvent(PAGE_BRIDGE_SHOP_REQUEST_EVENT, {
        detail: {
          requestId,
          shopId: input.shopId,
          limit: input.limit,
          offset: input.offset,
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

  if (snapshot.pageType === 'shopee_public_shop') {
    return JSON.stringify({
      pageType: snapshot.pageType,
      statusLabel,
      shopIdentifier: snapshot.shopIdentifier ?? '',
      sortKey: shopResearchSortKey,
      shopUpdatedAt: snapshot.shopResearch?.updatedAt ?? '',
      productCount: snapshot.shopResearch?.products.length ?? 0,
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

function getShopOverlayHost() {
  const mainContent = document.querySelector('main') ?? document.body;
  const allProductsSection = document.querySelector('.shop-page__all-products-section');
  if (allProductsSection?.parentElement) {
    return {
      parent: allProductsSection.parentElement,
      before: allProductsSection,
      layoutMode: 'block' as const,
    };
  }

  const productCards = getVisibleProductCards();
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

      if (count >= 4 && rect.width >= 600 && rect.height >= 180) {
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
        if (right[1].count !== left[1].count) {
          return right[1].count - left[1].count;
        }

        return left[1].top - right[1].top;
      })
      .at(0)?.[0] ?? null;

  if (bestContainer?.parentElement) {
    const outerSection =
      bestContainer.closest('section') ??
      bestContainer.closest('div[class]') ??
      bestContainer;
    const anchorElement =
      outerSection.parentElement && outerSection !== mainContent ? outerSection : bestContainer;

    return {
      parent: anchorElement.parentElement ?? bestContainer.parentElement,
      before: anchorElement,
      layoutMode: 'block' as const,
    };
  }

  const titleHeading = document.querySelector('h1');
  const searchInput =
    Array.from(document.querySelectorAll<HTMLInputElement>('input')).find((input) =>
      /cari di toko ini/i.test(
        input.getAttribute('placeholder') ?? input.getAttribute('aria-label') ?? '',
      ),
    ) ?? null;
  const preferredAnchor =
    titleHeading?.closest('section, div') ?? searchInput?.closest('section, div') ?? null;

  if (preferredAnchor?.parentElement) {
    return {
      parent: preferredAnchor.parentElement,
      before: preferredAnchor.nextSibling,
      layoutMode: 'block' as const,
    };
  }

  return {
    parent: mainContent,
    before: mainContent.firstChild,
    layoutMode: 'block' as const,
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

    #${OVERLAY_ID}[data-page-kind="product"] {
      margin-top: 20px;
    }

    #${OVERLAY_ID}[data-page-kind="owned-ads-product"] {
      max-width: 100%;
      margin-top: 12px;
      margin-left: 0;
      margin-right: 0;
      border: 0;
      box-shadow: none;
      background: transparent;
      overflow: visible;
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

    #${OVERLAY_ID}[data-page-kind="owned-ads-product"] .levelup-product-roas-title {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    #${OVERLAY_ID}[data-page-kind="owned-ads-product"] .levelup-product-roas-title-logo {
      width: 88px;
      height: auto;
      object-fit: contain;
      opacity: 0.96;
    }

    #${OVERLAY_ID}[data-page-kind="product"] .levelup-product-header-title {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    #${OVERLAY_ID}[data-page-kind="product"] .levelup-product-header-title-logo {
      width: 88px;
      height: auto;
      object-fit: contain;
      opacity: 0.96;
    }

    #${OVERLAY_ID}[data-page-kind="search"] .levelup-search-header-title {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    #${OVERLAY_ID}[data-page-kind="search"] .levelup-search-header-title-logo {
      width: 88px;
      height: auto;
      object-fit: contain;
      opacity: 0.96;
    }

    #${OVERLAY_ID}[data-page-kind="shop"] .levelup-shop-header-title {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    #${OVERLAY_ID}[data-page-kind="shop"] .levelup-shop-header-title-logo {
      width: 88px;
      height: auto;
      object-fit: contain;
      opacity: 0.96;
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

    #${OVERLAY_ID} .levelup-product-inline-shell {
      border: 1px solid rgba(251, 106, 53, 0.2);
      border-radius: 16px;
      background: rgba(255, 252, 250, 0.98);
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
      overflow: hidden;
    }

    #${OVERLAY_ID} .levelup-product-inline-body {
      padding: 12px 14px 14px;
      display: grid;
      gap: 12px;
    }

    #${OVERLAY_ID} .levelup-product-inline-form {
      position: relative;
      border: 1px solid rgba(251, 106, 53, 0.14);
      border-radius: 16px;
      background: rgba(255, 247, 243, 0.7);
      padding: 12px;
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

    #${OVERLAY_ID} .levelup-roas-size-group {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 10px;
    }

    #${OVERLAY_ID} .levelup-roas-submodal-trigger-row[hidden],
    #${OVERLAY_ID} .levelup-roas-popup-backdrop[hidden] {
      display: none !important;
    }

    #${OVERLAY_ID} .levelup-roas-popup-backdrop {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgba(17, 24, 39, 0.18);
      z-index: 3;
    }

    #${OVERLAY_ID} .levelup-roas-popup-card {
      width: min(360px, 100%);
      padding: 14px;
      border-radius: 16px;
      border: 1px solid rgba(251, 191, 36, 0.28);
      background:
        linear-gradient(180deg, rgba(255, 247, 237, 0.98), rgba(255, 255, 255, 0.98));
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.16);
    }

    #${OVERLAY_ID} .levelup-roas-popup-title {
      font-size: 13px;
      font-weight: 700;
      color: #9a3412;
      line-height: 1.35;
    }

    #${OVERLAY_ID} .levelup-roas-popup-note {
      margin-top: 4px;
      font-size: 11px;
      line-height: 1.45;
      color: #7c2d12;
    }

    #${OVERLAY_ID} .levelup-roas-popup-actions {
      margin-top: 12px;
      display: flex;
      justify-content: flex-end;
    }

    #${OVERLAY_ID} .levelup-roas-program-card {
      display: grid;
      gap: 10px;
      align-content: start;
      min-height: 72px;
      padding: 0;
      border: 0;
      background: transparent;
    }

    #${OVERLAY_ID} .levelup-roas-program-card + .levelup-roas-program-card {
      border-left: 1px solid rgba(203, 213, 225, 0.85);
      padding-left: 12px;
    }

    #${OVERLAY_ID} .levelup-roas-program-card[data-align="right"] {
      text-align: left;
    }

    #${OVERLAY_ID} .levelup-roas-program-card[data-align="right"] .levelup-roas-program-copy {
      justify-items: start;
      text-align: left;
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

    #${OVERLAY_ID} .levelup-roas-program-actions {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      flex-wrap: wrap;
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

      #${OVERLAY_ID} .levelup-product-inline-body,
      #${OVERLAY_ID} .levelup-product-inline-form {
        padding: 12px;
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

    #${OVERLAY_ID} .levelup-inline-select {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      line-height: 1.4;
      font-weight: 600;
      color: #6b7280;
    }

    #${OVERLAY_ID} .levelup-inline-select select {
      border: 1px solid rgba(251, 106, 53, 0.22);
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 12px;
      line-height: 1.4;
      color: #111827;
      outline: none;
      background: rgba(255, 255, 255, 0.92);
      cursor: pointer;
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

    #${OVERLAY_ID} .levelup-shop-categories {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
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

    #${OVERLAY_ID} .levelup-card-detail {
      margin-top: 6px;
      display: grid;
      gap: 4px;
      font-size: 12px;
      line-height: 1.5;
      color: #4b5563;
    }

    #${OVERLAY_ID} .levelup-card-detail-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: baseline;
    }

    #${OVERLAY_ID} .levelup-card-detail-label {
      color: #6b7280;
    }

    #${OVERLAY_ID} .levelup-card-detail-value {
      color: #111827;
      font-weight: 600;
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

    #${OVERLAY_ID}[data-page-kind="owned-ads-product"] .levelup-header {
      padding: 14px 16px 12px;
      background: rgba(255, 255, 255, 0.86);
    }

    #${OVERLAY_ID}[data-page-kind="owned-ads-product"] .levelup-body {
      padding: 0;
      gap: 0;
    }

    #${OVERLAY_ID}[data-page-kind="owned-ads-product"] .levelup-product-panel {
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.92);
    }

    #${OVERLAY_ID}[data-page-kind="owned-ads-product"] .levelup-actions {
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

    #${OVERLAY_ID} .levelup-product-image-foot {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 12px;
    }

    #${OVERLAY_ID} .levelup-product-roas-panel {
      padding: 10px 12px;
      border: 1px solid rgba(251, 106, 53, 0.16);
      border-radius: 14px;
      background: rgba(255, 247, 243, 0.72);
      font-size: 12px;
      line-height: 1.55;
      color: #4b5563;
    }

    #${OVERLAY_ID} .levelup-product-roas-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      font-weight: 700;
      color: #7c2d12;
    }

    #${OVERLAY_ID} .levelup-product-roas-grid {
      margin-top: 10px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    #${OVERLAY_ID} .levelup-product-roas-item {
      padding: 8px 10px;
      border-radius: 12px;
      border: 1px solid rgba(251, 106, 53, 0.12);
      background: rgba(255, 255, 255, 0.72);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    #${OVERLAY_ID} .levelup-product-roas-item-label {
      font-size: 11px;
      color: #6b7280;
    }

    #${OVERLAY_ID} .levelup-product-roas-item-value {
      font-weight: 700;
      color: #111827;
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

    #${OVERLAY_ID} .levelup-chip-groups {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 12px;
    }

    #${OVERLAY_ID} .levelup-chip-group-title {
      font-size: 11px;
      font-weight: 700;
      color: #7c2d12;
      letter-spacing: 0.02em;
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

    #${OVERLAY_ID} .levelup-highlight-link {
      text-decoration: none;
      cursor: pointer;
    }

    #${OVERLAY_ID} .levelup-highlight-link:hover {
      background: rgba(251, 106, 53, 0.14);
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

    #${ADS_DASHBOARD_ENHANCEMENT_ID} {
      margin: 18px 0 0;
    }

    #${ADS_DASHBOARD_ENHANCEMENT_ID}[data-levelup-ads-managed="true"],
    #${ADS_DASHBOARD_ENHANCEMENT_ID} * {
      box-sizing: border-box;
      font-family: Inter, Arial, sans-serif;
    }

    #${ADS_DASHBOARD_ENHANCEMENT_ID} .levelup-adspro-dashboard-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }

    #${ADS_DASHBOARD_ENHANCEMENT_ID} .levelup-adspro-dashboard-card {
      min-height: 82px;
      padding: 12px 14px;
      border-radius: 6px;
      border: 1px solid rgba(251, 106, 53, 0.26);
      border-top: 3px solid rgba(251, 106, 53, 0.88);
      background: linear-gradient(180deg, rgba(255, 245, 240, 0.98), rgba(255, 255, 255, 0.98));
      box-shadow: 0 8px 18px rgba(251, 106, 53, 0.08);
    }

    #${ADS_DASHBOARD_ENHANCEMENT_ID} .levelup-adspro-dashboard-label {
      font-size: 12px;
      font-weight: 600;
      color: #000000ff;
      line-height: 1.4;
    }

    #${ADS_DASHBOARD_ENHANCEMENT_ID} .levelup-adspro-dashboard-value {
      margin-top: 8px;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.35;
      color: #1f2937;
      word-break: break-word;
    }

    #${ADS_DASHBOARD_ENHANCEMENT_ID} .levelup-adspro-dashboard-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
      padding-right: 2px;
    }

    #${ADS_DASHBOARD_ENHANCEMENT_ID} .levelup-adspro-powered-by {
      width: min(180px, 42%);
      height: auto;
      opacity: 0.9;
      object-fit: contain;
      pointer-events: none;
      user-select: none;
    }

    .levelup-adspro-actual-tooltip {
      position: absolute;
      left: 50%;
      bottom: calc(100% + 8px);
      transform: translateX(-50%) translateY(4px);
      min-width: 220px;
      max-width: 260px;
      padding: 8px 10px;
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.96);
      color: #f8fafc;
      font-size: 11px;
      line-height: 1.5;
      font-weight: 400;
      letter-spacing: normal;
      white-space: normal;
      opacity: 0;
      pointer-events: none;
      box-shadow: 0 16px 32px rgba(15, 23, 42, 0.22);
      transition: opacity 140ms ease, transform 140ms ease;
      z-index: 30;
    }

    .levelup-adspro-actual-tooltip::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 100%;
      width: 10px;
      height: 10px;
      background: rgba(15, 23, 42, 0.96);
      transform: translateX(-50%) rotate(45deg);
    }

    .levelup-adspro-actual-inline:hover .levelup-adspro-actual-tooltip,
    .levelup-adspro-actual-inline:focus-within .levelup-adspro-actual-tooltip {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    .levelup-adspro-native-card-enhanced {
      position: relative;
    }

    .levelup-adspro-actual-inline {
      position: absolute;
      right: 14px;
      display: inline-flex;
      align-items: center;
      padding: 4px 9px;
      border-radius: 999px;
      background: rgba(249, 115, 22, 0.14);
      border: 1px solid rgba(249, 115, 22, 0.22);
      color: #c2410c;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.2;
      white-space: nowrap;
      cursor: help;
      pointer-events: auto;
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

      #${ADS_DASHBOARD_ENHANCEMENT_ID} .levelup-adspro-dashboard-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      #${ADS_DASHBOARD_ENHANCEMENT_ID} .levelup-adspro-powered-by {
        width: min(160px, 60%);
      }
    }
  `;

  document.head.appendChild(style);
}

function ensureShopOverlayStyle() {
  if (document.getElementById(SHOP_OVERLAY_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = SHOP_OVERLAY_STYLE_ID;
  style.textContent = `
    #${SHOP_OVERLAY_ID} {
      margin: 20px auto 16px;
      max-width: 1200px;
      border: 2px solid #fb6a35;
      border-radius: 10px;
      background: linear-gradient(180deg, rgba(255, 243, 238, 0.96), rgba(255, 248, 245, 0.96));
      box-shadow: 0 8px 20px rgba(251, 106, 53, 0.1);
      color: #1f2937;
      font-family: Inter, Arial, sans-serif;
      overflow: hidden;
      width: 100%;
    }

    #${SHOP_OVERLAY_ID} * {
      box-sizing: border-box;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px 10px;
      border-bottom: 1px solid rgba(251, 106, 53, 0.18);
      background: rgba(255, 255, 255, 0.55);
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-header-title {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 15px;
      font-weight: 600;
      color: #111827;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-header-title-logo {
      width: 88px;
      height: auto;
      object-fit: contain;
      opacity: 0.96;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-subtitle,
    #${SHOP_OVERLAY_ID} .levelup-shop-status,
    #${SHOP_OVERLAY_ID} .levelup-shop-note {
      margin-top: 4px;
      font-size: 12px;
      line-height: 1.5;
      color: #6b7280;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-header-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-inline-select {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      line-height: 1.4;
      font-weight: 600;
      color: #6b7280;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-inline-select select {
      border: 1px solid rgba(251, 106, 53, 0.22);
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 12px;
      line-height: 1.4;
      color: #111827;
      outline: none;
      background: rgba(255, 255, 255, 0.92);
      cursor: pointer;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-body {
      padding: 12px 14px 14px;
      display: grid;
      gap: 12px;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-stats {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-card {
      border: 1px solid rgba(251, 106, 53, 0.22);
      border-radius: 14px;
      background: #fff;
      padding: 12px;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-card-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #9a3412;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-card-value {
      margin-top: 6px;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.45;
      color: #111827;
      word-break: break-word;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-chip {
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

    #${SHOP_OVERLAY_ID} .levelup-shop-results {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-result {
      border: 1px solid rgba(251, 106, 53, 0.16);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.8);
      padding: 8px;
      display: grid;
      gap: 8px;
      min-height: 100%;
      position: relative;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-result-thumb {
      position: relative;
      width: 100%;
      aspect-ratio: 1 / 1;
      border-radius: 6px;
      background: linear-gradient(180deg, rgba(251, 106, 53, 0.08), rgba(251, 106, 53, 0.14));
      overflow: hidden;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-result-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-result-action-layer {
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

    #${SHOP_OVERLAY_ID} .levelup-shop-result[data-hover-active="true"] .levelup-shop-result-action-layer,
    #${SHOP_OVERLAY_ID} .levelup-shop-result:focus-within .levelup-shop-result-action-layer,
    #${SHOP_OVERLAY_ID} .levelup-shop-result-action-layer:focus-within {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-hover-button {
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

    #${SHOP_OVERLAY_ID} .levelup-shop-hover-button-primary {
      background: #fb6a35;
      color: #fff;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-hover-button-secondary {
      background: rgba(255, 255, 255, 0.96);
      color: #9a3412;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-result-title {
      font-size: 12px;
      font-weight: 400;
      line-height: 1.5;
      color: #111827;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 36px;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-result-meta-grid {
      display: grid;
      gap: 6px;
      font-size: 11px;
      color: #4b5563;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-result-meta-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-result-meta-label {
      color: #6b7280;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-result-meta-value {
      color: #111827;
      font-weight: 600;
      text-align: right;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-button {
      border: none;
      border-radius: 999px;
      padding: 9px 14px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-button-primary {
      background: #fb6a35;
      color: #fff;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-button-secondary {
      background: rgba(251, 106, 53, 0.12);
      color: #c2410c;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-button-ghost {
      background: #fff;
      color: #9a3412;
      border: 1px solid rgba(251, 106, 53, 0.22);
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-button:disabled,
    #${SHOP_OVERLAY_ID} .levelup-shop-hover-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    #${SHOP_OVERLAY_ID} .levelup-shop-empty {
      padding: 16px;
      border: 1px dashed rgba(251, 106, 53, 0.22);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.72);
      color: #6b7280;
      font-size: 12px;
      line-height: 1.6;
      text-align: center;
      grid-column: 1 / -1;
    }

    @media (max-width: 960px) {
      #${SHOP_OVERLAY_ID} .levelup-shop-stats {
        grid-template-columns: 1fr;
      }

      #${SHOP_OVERLAY_ID} .levelup-shop-results {
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      }
    }
  `;

  document.head.appendChild(style);
}

function computeRoasMetrics(): RoasMetrics | null {
  const price = roasCalculatorState.price ?? null;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  const hpp = roasCalculatorState.hpp ?? 0;
  const operasional = roasCalculatorState.operasional ?? 0;
  const kategoriPct = roasCalculatorState.kategoriFeePct ?? 0;
  const gratisOngkirPct =
    roasCalculatorState.gratisOngkirProductSize === 'special'
      ? roasCalculatorState.gratisOngkirPctSpecial ?? 0
      : roasCalculatorState.gratisOngkirPctRegular ?? 0;
  const gratisOngkirCap =
    roasCalculatorState.gratisOngkirProductSize === 'special'
      ? roasCalculatorState.gratisOngkirCapSpecial ?? 0
      : roasCalculatorState.gratisOngkirCapRegular ?? 0;

  const feeKategori = price * (kategoriPct / 100);
  const feePromoXtra = roasCalculatorState.promoXtraEnabled
    ? Math.min(
        price * (SHOPEE_PROMO_XTRA_FEE_PCT / 100),
        SHOPEE_PROMO_XTRA_FEE_CAP_IDR,
      )
    : 0;
  const feeGratisOngkirXtra = roasCalculatorState.gratisOngkirXtraEnabled
    ? Math.min(
        price * (gratisOngkirPct / 100),
        gratisOngkirCap > 0 ? gratisOngkirCap : Number.POSITIVE_INFINITY,
      )
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

  const tierDefinitions: RoasTierDefinition[] = [
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
      resolveRoas: (base: number) => Math.max(base * 1.64, base + 1.6),
    },
    {
      key: 'konservatif',
      label: 'Konservatif',
      tone: 'safe',
      resolveRoas: (base: number) => Math.max(base * 2.5, base + 3.6),
    },
    {
      key: 'prospektif',
      label: 'Prospektif',
      tone: 'prospect',
      resolveRoas: (base: number) => Math.max(base * 4, base + 7),
    },
  ];

  const tiers: RoasComputedTier[] = tierDefinitions.map((tier) => {
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
    const biayaIklan = price / roas;
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
    gratisOngkirPct,
    gratisOngkirCap,
    feeProsesPesanan,
  };
}

function getActiveGratisOngkirConfig() {
  const isSpecial = roasCalculatorState.gratisOngkirProductSize === 'special';
  return {
    pct: isSpecial
      ? roasCalculatorState.gratisOngkirPctSpecial ?? 0
      : roasCalculatorState.gratisOngkirPctRegular ?? 0,
    cap: isSpecial
      ? roasCalculatorState.gratisOngkirCapSpecial ?? 0
      : roasCalculatorState.gratisOngkirCapRegular ?? 0,
    sizeLabel: isSpecial ? 'Ukuran Khusus' : 'Ukuran Biasa',
  };
}

function getGratisOngkirTooltipLine(computed: ReturnType<typeof computeRoasMetrics>) {
  const { pct, cap, sizeLabel } = getActiveGratisOngkirConfig();
  if (!roasCalculatorState.gratisOngkirXtraEnabled) {
    return 'Gratis Ongkir XTRA: nonaktif.';
  }

  if (pct <= 0) {
    return `Gratis Ongkir XTRA ${sizeLabel}: aktif, tetapi kategori terpilih belum memiliki persen/cap yang berlaku.`;
  }

  const feeValue =
    computed && typeof computed.feeGratisOngkirXtra === 'number'
      ? formatCompactCurrency(Math.round(computed.feeGratisOngkirXtra))
      : '-';

  return `Gratis Ongkir XTRA ${sizeLabel}: ${feeValue} (${pct.toFixed(2)}%${cap > 0 ? `, maks ${formatCompactCurrency(Math.round(cap))}` : ''})`;
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

  if (lastSnapshot) {
    renderOverlay(lastSnapshot);
  }
}

type CategoryPickerItem = {
  id: string;
  name: string;
  pct: number;
  gratisOngkirPctRegular: number;
  gratisOngkirCapRegular: number;
  gratisOngkirPctSpecial: number;
  gratisOngkirCapSpecial: number;
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
      gratisOngkirPctRegular: fee.gratisOngkirPctRegular,
      gratisOngkirCapRegular: fee.gratisOngkirCapRegular,
      gratisOngkirPctSpecial: fee.gratisOngkirPctSpecial,
      gratisOngkirCapSpecial: fee.gratisOngkirCapSpecial,
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
  roasCalculatorState.gratisOngkirPctRegular = 0;
  roasCalculatorState.gratisOngkirCapRegular = 0;
  roasCalculatorState.gratisOngkirPctSpecial = 0;
  roasCalculatorState.gratisOngkirCapSpecial = 0;
  lastRoasCategorySelectionSource = null;
  lastSelectedRoasCategory = null;
}

function applyRoasCategorySelection(
  selection: {
    primary: string;
    secondary: string | null;
    name: string | null;
    pct: number | null;
    gratisOngkirPctRegular?: number | null;
    gratisOngkirCapRegular?: number | null;
    gratisOngkirPctSpecial?: number | null;
    gratisOngkirCapSpecial?: number | null;
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
  roasCalculatorState.gratisOngkirPctRegular =
    typeof selection.gratisOngkirPctRegular === 'number' &&
    Number.isFinite(selection.gratisOngkirPctRegular)
      ? selection.gratisOngkirPctRegular
      : 0;
  roasCalculatorState.gratisOngkirCapRegular =
    typeof selection.gratisOngkirCapRegular === 'number' &&
    Number.isFinite(selection.gratisOngkirCapRegular)
      ? selection.gratisOngkirCapRegular
      : 0;
  roasCalculatorState.gratisOngkirPctSpecial =
    typeof selection.gratisOngkirPctSpecial === 'number' &&
    Number.isFinite(selection.gratisOngkirPctSpecial)
      ? selection.gratisOngkirPctSpecial
      : 0;
  roasCalculatorState.gratisOngkirCapSpecial =
    typeof selection.gratisOngkirCapSpecial === 'number' &&
    Number.isFinite(selection.gratisOngkirCapSpecial)
      ? selection.gratisOngkirCapSpecial
      : 0;
  lastSelectedRoasCategory = {
    primary: normalizeText(selection.primary),
    secondary: normalizeText(selection.secondary) || null,
    name: normalizeText(selection.name) || null,
    gratisOngkirPctRegular: roasCalculatorState.gratisOngkirPctRegular,
    gratisOngkirCapRegular: roasCalculatorState.gratisOngkirCapRegular,
    gratisOngkirPctSpecial: roasCalculatorState.gratisOngkirPctSpecial,
    gratisOngkirCapSpecial: roasCalculatorState.gratisOngkirCapSpecial,
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
        gratisOngkirPctRegular: number;
        gratisOngkirCapRegular: number;
        gratisOngkirPctSpecial: number;
        gratisOngkirCapSpecial: number;
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
          gratisOngkirPctRegular: sub.items[0].gratisOngkirPctRegular,
          gratisOngkirCapRegular: sub.items[0].gratisOngkirCapRegular,
          gratisOngkirPctSpecial: sub.items[0].gratisOngkirPctSpecial,
          gratisOngkirCapSpecial: sub.items[0].gratisOngkirCapSpecial,
        };
      }

      for (const item of sub.items) {
        if (itemLabel && normalizeComparableLabel(item.name) === itemLabel) {
          return {
            primary: group.name,
            secondary: sub.name,
            name: item.name,
            pct: item.pct,
            gratisOngkirPctRegular: item.gratisOngkirPctRegular,
            gratisOngkirCapRegular: item.gratisOngkirCapRegular,
            gratisOngkirPctSpecial: item.gratisOngkirPctSpecial,
            gratisOngkirCapSpecial: item.gratisOngkirCapSpecial,
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
    payload: {
      marketplaceCode: 'SHOPEE',
      isActive: true,
    },
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
  gratisOngkirPctRegular?: number | null;
  gratisOngkirCapRegular?: number | null;
  gratisOngkirPctSpecial?: number | null;
  gratisOngkirCapSpecial?: number | null;
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
    gratisOngkirPctRegular:
      typeof item?.gratisOngkirPctRegular === 'number'
        ? item.gratisOngkirPctRegular
        : null,
    gratisOngkirCapRegular:
      typeof item?.gratisOngkirCapRegular === 'number'
        ? item.gratisOngkirCapRegular
        : null,
    gratisOngkirPctSpecial:
      typeof item?.gratisOngkirPctSpecial === 'number'
        ? item.gratisOngkirPctSpecial
        : null,
    gratisOngkirCapSpecial:
      typeof item?.gratisOngkirCapSpecial === 'number'
        ? item.gratisOngkirCapSpecial
        : null,
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
    gratisOngkirPctRegular: match.gratisOngkirPctRegular,
    gratisOngkirCapRegular: match.gratisOngkirCapRegular,
    gratisOngkirPctSpecial: match.gratisOngkirPctSpecial,
    gratisOngkirCapSpecial: match.gratisOngkirCapSpecial,
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
    const suggestedCategory = lastRoasCategorySuggestion;
    if (
      !hasAppliedSuggestion &&
      suggestedCategory &&
      suggestedCategory.storeType === roasCalculatorState.storeType &&
      groups.length > 0
    ) {
      const suggestedGroupIndex = groups.findIndex(
        (group) =>
          normalizeComparableLabel(group.name) ===
          normalizeComparableLabel(suggestedCategory.primary),
      );
      if (suggestedGroupIndex >= 0) {
        activeGroupIndex = suggestedGroupIndex;
        const subs = groups[suggestedGroupIndex]?.subs ?? [];
        if (suggestedCategory.secondary) {
          const suggestedSubIndex = subs.findIndex(
            (sub) =>
              normalizeComparableLabel(sub.name) ===
              normalizeComparableLabel(suggestedCategory.secondary ?? ''),
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
                        <button type="button" class="levelup-button levelup-button-primary" data-action="roas-pick-item" data-id="${item.id}" data-name="${encodeURIComponent(item.name)}" data-pct="${item.pct}" data-gratis-ongkir-pct-regular="${item.gratisOngkirPctRegular}" data-gratis-ongkir-cap-regular="${item.gratisOngkirCapRegular}" data-gratis-ongkir-pct-special="${item.gratisOngkirPctSpecial}" data-gratis-ongkir-cap-special="${item.gratisOngkirCapSpecial}" data-group-index="${
                          'groupIndex' in entry ? entry.groupIndex : activeGroupIndex
                        }" data-sub-index="${
                          'subIndex' in entry ? entry.subIndex : activeSubIndex
                        }" data-primary="${encodeURIComponent(primaryCategory)}" data-secondary="${encodeURIComponent(secondaryCategory)}">Pilih</button>
                      </div>
                    </div>
                    ${note ? `<div class="levelup-product-insight">${note}</div>` : ''}
                    <div class="levelup-product-insight">Ongkir Extra Biasa ${item.gratisOngkirPctRegular.toFixed(2)}% maks ${formatCompactCurrency(Math.round(item.gratisOngkirCapRegular))} | Khusus ${item.gratisOngkirPctSpecial.toFixed(2)}% maks ${formatCompactCurrency(Math.round(item.gratisOngkirCapSpecial))}</div>
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
      const gratisOngkirPctRegularRaw = target.getAttribute('data-gratis-ongkir-pct-regular');
      const gratisOngkirCapRegularRaw = target.getAttribute('data-gratis-ongkir-cap-regular');
      const gratisOngkirPctSpecialRaw = target.getAttribute('data-gratis-ongkir-pct-special');
      const gratisOngkirCapSpecialRaw = target.getAttribute('data-gratis-ongkir-cap-special');
      const groupIndexRaw = target.getAttribute('data-group-index');
      const subIndexRaw = target.getAttribute('data-sub-index');
      const primaryCategory = decodeURIComponent(target.getAttribute('data-primary') ?? '');
      const secondaryCategory = decodeURIComponent(target.getAttribute('data-secondary') ?? '');
      const pct = pctRaw ? Number.parseFloat(pctRaw) : null;
      const gratisOngkirPctRegular = gratisOngkirPctRegularRaw
        ? Number.parseFloat(gratisOngkirPctRegularRaw)
        : 0;
      const gratisOngkirCapRegular = gratisOngkirCapRegularRaw
        ? Number.parseFloat(gratisOngkirCapRegularRaw)
        : 0;
      const gratisOngkirPctSpecial = gratisOngkirPctSpecialRaw
        ? Number.parseFloat(gratisOngkirPctSpecialRaw)
        : 0;
      const gratisOngkirCapSpecial = gratisOngkirCapSpecialRaw
        ? Number.parseFloat(gratisOngkirCapSpecialRaw)
        : 0;
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
          gratisOngkirPctRegular,
          gratisOngkirCapRegular,
          gratisOngkirPctSpecial,
          gratisOngkirCapSpecial,
        },
        'manual',
      );
      modal.remove();
      rerenderCurrentRoasSurface();
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
            <div class="levelup-note" data-role="roas-category-helper"${categoryHelperText ? '' : ' hidden'}>${categoryHelperText}</div>
          </div>
          <div class="levelup-roas-field">
            <div class="levelup-roas-field-label">Operasional</div>
            <input class="levelup-roas-input" data-field="operasional" inputmode="numeric" placeholder="Rp 0" value="${roasCalculatorState.operasional ? formatCompactCurrency(roasCalculatorState.operasional) : ''}" />
          </div>
          <div class="levelup-roas-field">
            <div class="levelup-roas-program-grid">
              <div class="levelup-roas-program-card" data-align="right">
                <div class="levelup-roas-program-copy">
                  <div class="levelup-roas-field-label levelup-field-label-row">
                    <span>Promo Extra</span>
                    <span class="levelup-tooltip">
                      <button
                        type="button"
                        class="levelup-roas-program-title levelup-roas-program-title-button"
                        aria-label="Info Promo Extra"
                      >
                        ⓘ
                      </button>
                      <span class="levelup-tooltip-panel">
                        ${SHOPEE_PROMO_XTRA_FEE_PCT.toFixed(1)}% maks Rp${SHOPEE_PROMO_XTRA_FEE_CAP_IDR.toLocaleString('id-ID')}
                      </span>
                    </span>
                  </div>
                </div>
                <div class="levelup-roas-program-actions">
                  <label class="levelup-toggle">
                    <input type="checkbox" data-field="promoXtraEnabled" ${roasCalculatorState.promoXtraEnabled ? 'checked' : ''} />
                    <span class="levelup-toggle-track"></span>
                  </label>
                </div>
              </div>
              <div class="levelup-roas-program-card" data-align="left">
                <div class="levelup-roas-program-copy">
                  <div class="levelup-roas-field-label levelup-field-label-row">
                    <span>Ongkir Extra</span>
                    <span class="levelup-tooltip">
                      <button
                        type="button"
                        class="levelup-roas-program-title levelup-roas-program-title-button"
                        aria-label="Info Ongkir Extra"
                      >
                        ⓘ
                      </button>
                      <span class="levelup-tooltip-panel" data-role="gratis-ongkir-tooltip">
                        Pilih kategori produk untuk memuat persen dan cap Ongkir Extra.
                      </span>
                    </span>
                  </div>
                </div>
                <div class="levelup-roas-program-actions">
                  <label class="levelup-toggle">
                    <input type="checkbox" data-field="gratisOngkirXtraEnabled" ${roasCalculatorState.gratisOngkirXtraEnabled ? 'checked' : ''} />
                    <span class="levelup-toggle-track"></span>
                  </label>
                  <button
                    type="button"
                    class="levelup-button levelup-button-secondary"
                    data-action="gratis-ongkir-open-popup"
                    data-role="gratis-ongkir-size-field"
                    ${roasCalculatorState.gratisOngkirXtraEnabled ? '' : 'hidden'}
                  >
                    Ukuran
                  </button>
                </div>
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
      <div class="levelup-roas-popup-backdrop" data-role="gratis-ongkir-size-popup" hidden>
        <div class="levelup-roas-popup-card" role="dialog" aria-modal="false" aria-label="Pilih ukuran Ongkir Extra">
          <div class="levelup-roas-popup-title">Pilih Ukuran Ongkir Extra</div>
          <div class="levelup-roas-popup-note">
            Pilih ukuran produk agar persen dan cap Ongkir Extra mengikuti kategori yang sesuai.
          </div>
          <div class="levelup-roas-size-group" role="group" aria-label="Pilih ukuran produk untuk Ongkir Extra">
            <label class="levelup-roas-radio">
              <input type="radio" name="levelup-gratis-ongkir-size" value="regular" ${roasCalculatorState.gratisOngkirProductSize === 'regular' ? 'checked' : ''} />
              <span class="levelup-roas-radio-label">Ukuran Biasa</span>
            </label>
            <label class="levelup-roas-radio">
              <input type="radio" name="levelup-gratis-ongkir-size" value="special" ${roasCalculatorState.gratisOngkirProductSize === 'special' ? 'checked' : ''} />
              <span class="levelup-roas-radio-label">Ukuran Khusus</span>
            </label>
          </div>
          <div class="levelup-roas-popup-actions">
            <button type="button" class="levelup-button levelup-button-secondary" data-action="gratis-ongkir-close-popup">Tutup</button>
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
  const gratisOngkirOpenPopupButton = modal.querySelector<HTMLButtonElement>(
    '[data-action="gratis-ongkir-open-popup"]',
  );
  const gratisOngkirClosePopupButton = modal.querySelector<HTMLButtonElement>(
    '[data-action="gratis-ongkir-close-popup"]',
  );
  const gratisOngkirSizeField = modal.querySelector<HTMLElement>(
    '[data-role="gratis-ongkir-size-field"]',
  );
  const gratisOngkirSizePopup = modal.querySelector<HTMLElement>(
    '[data-role="gratis-ongkir-size-popup"]',
  );
  const gratisOngkirSizePopupCard = modal.querySelector<HTMLElement>('.levelup-roas-popup-card');
  const gratisOngkirSizeRadios = Array.from(
    modal.querySelectorAll<HTMLInputElement>('input[name="levelup-gratis-ongkir-size"]'),
  );
  const gratisOngkirTooltip = modal.querySelector<HTMLElement>('[data-role="gratis-ongkir-tooltip"]');
  const categoryHelperNote = modal.querySelector<HTMLElement>('[data-role="roas-category-helper"]');
  const profitLabel = modal.querySelector<HTMLElement>('[data-role="roas-profit-label"]');
  const profitPct = modal.querySelector<HTMLElement>('[data-role="roas-profit-pct"]');
  const shopeeFeeLabel = modal.querySelector<HTMLElement>('[data-role="roas-shopee-fee"]');
  const shopeeFeeTooltipContent = modal.querySelector<HTMLElement>(
    '[data-role="roas-shopee-tooltip-content"]',
  );
  let isGratisOngkirPopupOpen = false;

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
    if (pickCategoryButton) {
      pickCategoryButton.textContent = roasCalculatorState.categoryLabel || 'Pilih Kategori';
    }
    if (categoryHelperNote) {
      const nextHelperText = getRoasCategoryHelperText();
      categoryHelperNote.textContent = nextHelperText;
      categoryHelperNote.hidden = !nextHelperText;
    }
    if (gratisOngkirSizeField) {
      gratisOngkirSizeField.hidden = !roasCalculatorState.gratisOngkirXtraEnabled;
    }
    if (gratisOngkirOpenPopupButton) {
      gratisOngkirOpenPopupButton.disabled = !roasCalculatorState.gratisOngkirXtraEnabled;
    }
    if (gratisOngkirSizePopup) {
      gratisOngkirSizePopup.hidden =
        !roasCalculatorState.gratisOngkirXtraEnabled || !isGratisOngkirPopupOpen;
    }
    for (const radio of gratisOngkirSizeRadios) {
      radio.checked = radio.value === roasCalculatorState.gratisOngkirProductSize;
    }
    if (gratisOngkirTooltip) {
      gratisOngkirTooltip.textContent =
        'Pilih kategori produk untuk memuat persen dan cap Ongkir Extra.';
    }
    if (shopeeFeeTooltipContent) {
      if (!computed) {
        shopeeFeeTooltipContent.innerHTML = '';
      } else {
        const parts = [
          `Fee kategori: ${formatCompactCurrency(Math.round(computed.feeKategori))} (${formatPercent(roasCalculatorState.kategoriFeePct ?? 0)})`,
          `Biaya proses pesanan: Rp${SHOPEE_ORDER_PROCESSING_FEE_IDR.toLocaleString('id-ID')}`,
          getGratisOngkirTooltipLine(computed),
        ];
        if (roasCalculatorState.promoXtraEnabled) {
          parts.push(
            `Promo Xtra: ${formatCompactCurrency(Math.round(computed.feePromoXtra))} (${SHOPEE_PROMO_XTRA_FEE_PCT.toFixed(1)}%, maks Rp${SHOPEE_PROMO_XTRA_FEE_CAP_IDR.toLocaleString('id-ID')})`,
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
    roasCalculatorState.gratisOngkirProductSize = 'regular';
    isGratisOngkirPopupOpen = false;
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
        });
    });
  }

  promoToggle?.addEventListener('change', () => {
    roasCalculatorState.promoXtraEnabled = Boolean(promoToggle.checked);
    refreshComputed();
  });

  gratisOngkirToggle?.addEventListener('change', () => {
    const previousEnabled = roasCalculatorState.gratisOngkirXtraEnabled;
    const nextEnabled = Boolean(gratisOngkirToggle.checked);
    roasCalculatorState.gratisOngkirXtraEnabled = nextEnabled;
    isGratisOngkirPopupOpen = !previousEnabled && nextEnabled;
    refreshComputed();
  });

  gratisOngkirOpenPopupButton?.addEventListener('click', () => {
    if (!roasCalculatorState.gratisOngkirXtraEnabled) {
      return;
    }

    isGratisOngkirPopupOpen = true;
    refreshComputed();
  });

  gratisOngkirClosePopupButton?.addEventListener('click', () => {
    isGratisOngkirPopupOpen = false;
    refreshComputed();
  });

  gratisOngkirSizePopupCard?.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  for (const radio of gratisOngkirSizeRadios) {
    radio.addEventListener('change', () => {
      const nextValue = normalizeText(radio.value);
      if (!(nextValue === 'regular' || nextValue === 'special')) {
        return;
      }

      roasCalculatorState.gratisOngkirProductSize = nextValue;
      isGratisOngkirPopupOpen = false;
      refreshComputed();
    });
  }

  modal.addEventListener('click', (event) => {
    if (event.target === gratisOngkirSizePopup) {
      isGratisOngkirPopupOpen = false;
      refreshComputed();
      return;
    }
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

      if (isRoasPercentField(field)) {
        const normalized = normalizeText(input.value).replace(',', '.');
        const parsed = Number.parseFloat(normalized);
        roasCalculatorState[field] = Number.isFinite(parsed) ? parsed : 0;
        if (field === 'kategoriFeePct') {
          lastRoasCategorySelectionSource = Number.isFinite(parsed) && parsed > 0 ? 'manual' : null;
        }
        refreshComputed();
        return;
      }

      if (!isRoasCurrencyField(field)) {
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

function removeSharedOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
}

function removeShopOverlay() {
  document.getElementById(SHOP_OVERLAY_ID)?.remove();
}

function removeOverlay() {
  removeSharedOverlay();
  removeShopOverlay();
}

function isManagedOverlayNode(node: Node) {
  if (node instanceof HTMLStyleElement) {
    return node.id === OVERLAY_STYLE_ID || node.id === SHOP_OVERLAY_STYLE_ID;
  }

  if (node instanceof HTMLElement) {
    return (
      node.id === OVERLAY_ID ||
      node.id === SHOP_OVERLAY_ID ||
      node.id === ADS_DASHBOARD_ENHANCEMENT_ID ||
      node.id === OVERLAY_STYLE_ID ||
      node.id === SHOP_OVERLAY_STYLE_ID ||
      node.getAttribute('data-levelup-ads-managed') === 'true' ||
      Boolean(
        node.closest?.(
          `#${OVERLAY_ID}, #${SHOP_OVERLAY_ID}, #${ADS_DASHBOARD_ENHANCEMENT_ID}, [data-levelup-ads-managed="true"]`,
        ),
      )
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

document.addEventListener(PAGE_BRIDGE_SHOP_RESPONSE_EVENT, (event: Event) => {
  const message = (event as CustomEvent<PageBridgeShopResponseMessage>).detail;
  if (!message || typeof message.requestId !== 'string') {
    return;
  }

  const pending = pendingPageBridgeShopRequests.get(message.requestId);
  if (!pending) {
    return;
  }

  window.clearTimeout(pending.timeoutId);
  pendingPageBridgeShopRequests.delete(message.requestId);

  if (message.error) {
    pending.reject(new Error(message.error));
    return;
  }

  if (!message.data) {
    pending.reject(new Error('Bridge riset toko Shopee tidak mengembalikan data.'));
    return;
  }

  pending.resolve(message.data);
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

  const detail = snapshot.productDetail;
  const shouldFetchBaseEnrichment = !(
    normalizeText(detail.shopName).length > 0 &&
    normalizeText(detail.ratingHint).length > 0 &&
    normalizeText(detail.reviewCountHint).length > 0 &&
    normalizeText(detail.salesHint).length > 0 &&
    normalizeText(detail.monthlySoldHint).length > 0 &&
    normalizeText(detail.totalRevenueHint).length > 0 &&
    normalizeText(detail.monthlyRevenueHint).length > 0 &&
    normalizeText(detail.listingAgeHint).length > 0
  );
  const shouldFetchKeywords =
    (detail.positiveKeywords?.length ?? 0) === 0 &&
    (detail.negativeKeywords?.length ?? 0) === 0;

  if (!shouldFetchBaseEnrichment && !shouldFetchKeywords) {
    return;
  }

  const requestId = ++productDetailEnrichmentRequestId;
  let mergedDetail = detail;

  if (shouldFetchBaseEnrichment) {
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
        enrichedEntries = [];
      }
    }

    if (requestId !== productDetailEnrichmentRequestId) {
      return;
    }

    const enrichment = enrichedEntries[0] ?? null;
    if (enrichment) {
      cacheResolvedSearchResultEnrichment(enrichment);
      mergedDetail = mergeProductDetailEnrichment(mergedDetail, enrichment);
    }
  }

  if (shouldFetchKeywords) {
    const ids = extractShopeeIdsFromUrl(detailPreview.productUrl);
    if (ids) {
      try {
        const keywordInsights = await fetchShopeeKeywordInsights(ids);
        mergedDetail = {
          ...mergedDetail,
          positiveKeywords: keywordInsights.positive,
          negativeKeywords: keywordInsights.negative,
        };
      } catch {
        mergedDetail = {
          ...mergedDetail,
          positiveKeywords: mergedDetail.positiveKeywords ?? [],
          negativeKeywords: mergedDetail.negativeKeywords ?? [],
        };
      }
    }
  }

  if (JSON.stringify(mergedDetail) === JSON.stringify(detail)) {
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

async function fetchShopeeShopBase(shopId: string) {
  const endpoint = new URL('/api/v4/shop/get_shop_base', window.location.origin);
  endpoint.searchParams.set('shopid', shopId);
  const response = await fetch(endpoint.toString(), {
    credentials: 'include',
  });
  const json = await response.json();
  if (!response.ok || json?.error) {
    throw new Error(json?.error_msg || 'Gagal memuat profil toko.');
  }

  return json.data as Record<string, unknown>;
}

async function fetchShopeeShopDetail(shopId: string) {
  const endpoint = new URL('/api/v4/shop/get_shop_detail', window.location.origin);
  endpoint.searchParams.set('shopid', shopId);
  const response = await fetch(endpoint.toString(), {
    credentials: 'include',
  });
  const json = await response.json();
  if (!response.ok || json?.error) {
    throw new Error(json?.error_msg || 'Gagal memuat detail toko.');
  }

  return json.data as Record<string, unknown>;
}

function extractShopeeShopIdFromProductLinks(document: Document) {
  const productLink = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find(
    (anchor) => /-i\.(\d+)\.(\d+)(?:$|[/?#])/i.test(anchor.getAttribute('href') ?? ''),
  );
  const href = productLink?.getAttribute('href') ?? '';
  const matched = href.match(/-i\.(\d+)\.(\d+)(?:$|[/?#])/i);
  return matched?.[1] ?? null;
}

async function fetchShopeeShopCategories(shopId: string) {
  const endpoint = new URL('/api/v4/shop/get_categories', window.location.origin);
  endpoint.searchParams.set('limit', '20');
  endpoint.searchParams.set('offset', '0');
  endpoint.searchParams.set('shopid', shopId);
  endpoint.searchParams.set('two_tier_cate', '1');
  const response = await fetch(endpoint.toString(), {
    credentials: 'include',
  });
  const json = await response.json();
  if (!response.ok || json?.error) {
    throw new Error(json?.error_msg || 'Gagal memuat kategori toko.');
  }

  return json.data as Record<string, unknown>;
}

async function fetchShopeeShopItems(input: {
  shopId: string;
  offset: number;
  limit: number;
}) {
  const params = new URLSearchParams({
    by: 'sales',
    limit: String(input.limit),
    match_id: input.shopId,
    newest: String(input.offset),
    order: 'desc',
    page_type: 'shop',
    scenario: 'PAGE_SHOP_SEARCH',
    version: '2',
  });
  const endpoint = new URL('/api/v4/search/search_items', window.location.origin);
  endpoint.search = params.toString();
  const response = await fetch(endpoint.toString(), {
    credentials: 'include',
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error('Gagal memuat produk toko.');
  }

  return json as {
    total_count?: number;
    items?: Array<{ item_basic?: Record<string, unknown> }>;
  };
}

function resolveShopeeShopIdFromDocument(document: Document) {
  const fromProductLinks = extractShopeeShopIdFromProductLinks(document);
  if (fromProductLinks) {
    return fromProductLinks;
  }

  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script'));
  for (const script of scripts) {
    const text = script.textContent;
    if (!text || text.length < 20) {
      continue;
    }

    const matched =
      text.match(/"shopid"\s*:\s*(\d{5,})/i) ??
      text.match(/"shop_id"\s*:\s*(\d{5,})/i) ??
      text.match(/\bshopid\s*=\s*(\d{5,})/i);
    if (matched) {
      return matched[1];
    }
  }

  return null;
}

function buildShopResearchSnapshot(input: {
  shopId: string;
  shopName: string;
  base: Record<string, unknown>;
  detail: Record<string, unknown>;
  categories: Record<string, unknown> | null;
  items: Array<Record<string, unknown>>;
  totalCount: number;
}) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const products = input.items
    .map((item, index) => {
      const itemId = String(item.itemid ?? '');
      if (!itemId) {
        return null;
      }

      const rawPriceMin = normalizeShopeePriceValue(item.price_min as number | null);
      const rawPriceMax = normalizeShopeePriceValue(item.price_max as number | null);
      const priceMin = rawPriceMin ?? undefined;
      const priceMax = rawPriceMax ?? undefined;
      const sold30d =
        typeof item.sold === 'number' && Number.isFinite(item.sold) ? item.sold : undefined;
      const ratingStar =
        typeof (item.item_rating as any)?.rating_star === 'number'
          ? (item.item_rating as any).rating_star
          : undefined;
      const ratingCount = Array.isArray((item.item_rating as any)?.rating_count)
        ? Number((item.item_rating as any).rating_count[0])
        : null;
      const reviewCount =
        typeof item.cmt_count === 'number'
          ? item.cmt_count
          : ratingCount && Number.isFinite(ratingCount)
          ? ratingCount
          : undefined;
      const listingCtime =
        typeof item.ctime === 'number' && Number.isFinite(item.ctime) ? item.ctime : undefined;
      const ageDays =
        listingCtime && listingCtime > 0 ? (nowSeconds - listingCtime) / 86400 : null;

      const representativePrice =
        typeof priceMin === 'number' && typeof priceMax === 'number'
          ? Math.round((priceMin + priceMax) / 2)
          : typeof priceMin === 'number'
          ? priceMin
          : typeof priceMax === 'number'
          ? priceMax
          : null;
      const revenue30dEstimate =
        typeof sold30d === 'number' && typeof representativePrice === 'number'
          ? sold30d * representativePrice
          : undefined;

      return {
        position: index + 1,
        itemId,
        productTitle: String(item.name ?? 'Produk Shopee'),
        productUrl: buildShopeeProductUrl({
          shopId: input.shopId,
          itemId,
          productTitle: String(item.name ?? 'Produk Shopee'),
        }),
        imageUrl: typeof item.image === 'string' ? `https://down-id.img.susercontent.com/file/${item.image}` : undefined,
        priceMin,
        priceMax,
        sold30d,
        ratingStar,
        reviewCount,
        revenue30dEstimate,
        listingCtime,
        _ageDays: typeof ageDays === 'number' && Number.isFinite(ageDays) ? ageDays : null,
      } as const;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const priceCandidates = products
    .flatMap((product) => [product.priceMin, product.priceMax])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const priceMin = priceCandidates.length ? Math.min(...priceCandidates) : undefined;
  const priceMax = priceCandidates.length ? Math.max(...priceCandidates) : undefined;

  const ageCandidates = products
    .map((product) => (product as any)._ageDays as number | null)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const listingAgeMinDays = ageCandidates.length ? Math.min(...ageCandidates) : undefined;
  const listingAgeMaxDays = ageCandidates.length ? Math.max(...ageCandidates) : undefined;

  const sold30dTotal = products.reduce((total, product) => total + (product.sold30d ?? 0), 0);
  const revenue30dEstimate = products.reduce(
    (total, product) => total + (product.revenue30dEstimate ?? 0),
    0,
  );

  const categories = Array.isArray((input.categories as any)?.shop_categories)
    ? ((input.categories as any).shop_categories as Array<any>)
        .map((category) => ({
          id: Number(category.shop_category_id),
          name: String(category.display_name ?? ''),
          total: Number(category.total ?? 0),
        }))
        .filter((category) => category.id && category.name)
    : undefined;

  const followerCount =
    typeof input.base.follower_count === 'number' ? input.base.follower_count : undefined;
  const ratingStar =
    typeof input.base.rating_star === 'number' ? input.base.rating_star : undefined;
  const responseRate =
    typeof input.base.response_rate === 'number' ? input.base.response_rate : undefined;
  const itemCount =
    typeof input.base.item_count === 'number' ? input.base.item_count : undefined;
  const preparationTime =
    typeof input.detail.preparation_time === 'number'
      ? input.detail.preparation_time
      : undefined;
  const cancellationRate =
    typeof input.detail.cancellation_rate === 'number'
      ? input.detail.cancellation_rate
      : undefined;

  const sanitizedProducts = products.map((product) => {
    const { _ageDays, ...rest } = product as any;
    return rest;
  });

  return {
    shopId: input.shopId,
    shopName: input.shopName,
    followerCount,
    ratingStar,
    responseRate,
    itemCount,
    preparationTime,
    cancellationRate,
    priceMin,
    priceMax,
    listingAgeMinDays,
    listingAgeMaxDays,
    sold30dTotal,
    revenue30dEstimate,
    products: sanitizedProducts,
    categories,
    updatedAt: new Date().toISOString(),
  } satisfies ShopResearchSnapshot;
}

async function enrichShopSnapshot(snapshot: PageSnapshot) {
  if (snapshot.pageType !== 'shopee_public_shop') {
    return;
  }

  const requestId = ++shopResearchRequestId;
  const shopId =
    snapshot.shopIdentifier && /^\d+$/.test(snapshot.shopIdentifier)
      ? snapshot.shopIdentifier
      : resolveShopeeShopIdFromDocument(document);
  const shopName = normalizeText(document.querySelector('h1')?.textContent)
    ? normalizeText(document.querySelector('h1')?.textContent)
    : normalizeText(document.title.replace(/^Toko Online\s*/i, '').replace(/\s*\|\s*Shopee.*$/i, '')) ||
      'Toko Shopee';

  if (!shopId) {
    if (lastSnapshot) {
      renderOverlay({
        ...snapshot,
        statusMessage: 'Toko Shopee terdeteksi, tetapi shopId belum terbaca.',
      });
    }
    return;
  }

  const existing = shopeeShopResearchCache.get(shopId) ?? null;
  if (existing && existing.products.length >= 20) {
    return;
  }

  shopeeShopResearchMeta.set(shopId, {
    totalCount: existing ? shopeeShopResearchMeta.get(shopId)?.totalCount ?? 0 : 0,
    nextOffset: existing ? existing.products.length : 0,
    hasMore: true,
    isLoading: true,
  });

  let base: Record<string, unknown>;
  let detail: Record<string, unknown>;
  let categories: Record<string, unknown> | null = null;
  let itemsPayload: {
    total_count?: number;
    items?: Array<{ item_basic?: Record<string, unknown> }>;
  };
  try {
    const bridgeData = await requestPageBridgeShopResearch({
      shopId,
      offset: 0,
      limit: 60,
    });
    base = bridgeData.base;
    detail = bridgeData.detail;
    categories = bridgeData.categories;
    itemsPayload = bridgeData.itemsPayload;
  } catch {
    shopeeShopResearchMeta.set(shopId, {
      totalCount: 0,
      nextOffset: 0,
      hasMore: false,
      isLoading: false,
    });
    await publishSnapshot({
      ...snapshot,
      shopIdentifier: shopId,
      statusMessage: `Riset Toko gagal dimuat untuk ${shopName}. Coba Muat Ulang Parser.`,
    });
    return;
  }

  if (requestId !== shopResearchRequestId) {
    return;
  }

  const itemBasics = (itemsPayload.items ?? [])
    .map((entry) => entry.item_basic ?? null)
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  const totalCount = typeof itemsPayload.total_count === 'number' ? itemsPayload.total_count : 0;
  const nextShopResearch = buildShopResearchSnapshot({
    shopId,
    shopName,
    base,
    detail,
    categories,
    items: itemBasics,
    totalCount,
  });

  shopeeShopResearchCache.set(shopId, nextShopResearch);
  shopeeShopResearchMeta.set(shopId, {
    totalCount,
    nextOffset: nextShopResearch.products.length,
    hasMore: totalCount > nextShopResearch.products.length,
    isLoading: false,
  });

  await publishSnapshot({
    ...snapshot,
    shopIdentifier: shopId,
    shopResearch: nextShopResearch,
    statusMessage: `Toko Shopee terdeteksi: ${shopName}.`,
  });
}

async function loadMoreShopProducts(snapshot: PageSnapshot) {
  if (snapshot.pageType !== 'shopee_public_shop') {
    return;
  }

  const shopId =
    snapshot.shopIdentifier && /^\d+$/.test(snapshot.shopIdentifier)
      ? snapshot.shopIdentifier
      : null;
  if (!shopId) {
    return;
  }

  const existing = shopeeShopResearchCache.get(shopId) ?? null;
  const meta = shopeeShopResearchMeta.get(shopId) ?? null;
  if (!existing || !meta || meta.isLoading || !meta.hasMore) {
    return;
  }

  shopeeShopResearchMeta.set(shopId, { ...meta, isLoading: true });

  const bridgeData = await requestPageBridgeShopResearch({
    shopId,
    offset: meta.nextOffset,
    limit: 40,
  }).catch(() => null);
  const itemsPayload = bridgeData?.itemsPayload ?? null;

  if (!itemsPayload) {
    shopeeShopResearchMeta.set(shopId, { ...meta, isLoading: false });
    return;
  }

  const itemBasics = (itemsPayload.items ?? [])
    .map((entry) => entry.item_basic ?? null)
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));

  const mergedBasics = [
    ...existing.products.map((product) => ({
      itemid: product.itemId,
      shopid: shopId,
      name: product.productTitle,
      image: product.imageUrl ? product.imageUrl.split('/').pop() : undefined,
      price_min: product.priceMin,
      price_max: product.priceMax,
      sold: product.sold30d,
      cmt_count: product.reviewCount,
      ctime: product.listingCtime,
      item_rating: {
        rating_star: product.ratingStar,
        rating_count: [product.reviewCount],
      },
    })),
    ...itemBasics,
  ];

  const base = bridgeData?.base ?? {};
  const detail = bridgeData?.detail ?? {};

  const nextShopResearch = buildShopResearchSnapshot({
    shopId,
    shopName: existing.shopName,
    base,
    detail,
    categories:
      bridgeData?.categories ??
      (existing.categories
        ? {
            shop_categories: existing.categories.map((c) => ({
              shop_category_id: c.id,
              display_name: c.name,
              total: c.total,
            })),
          }
        : null),
    items: mergedBasics,
    totalCount: typeof itemsPayload.total_count === 'number' ? itemsPayload.total_count : meta.totalCount,
  });

  shopeeShopResearchCache.set(shopId, nextShopResearch);
  const totalCount =
    typeof itemsPayload.total_count === 'number' ? itemsPayload.total_count : meta.totalCount;
  shopeeShopResearchMeta.set(shopId, {
    totalCount,
    nextOffset: nextShopResearch.products.length,
    hasMore: totalCount > nextShopResearch.products.length,
    isLoading: false,
  });

  await publishSnapshot({
    ...snapshot,
    shopResearch: nextShopResearch,
  });
}

function queueShopResearchEnrichment(snapshot: PageSnapshot) {
  if (snapshot.pageType !== 'shopee_public_shop') {
    if (shopResearchEnrichmentTimeoutId) {
      window.clearTimeout(shopResearchEnrichmentTimeoutId);
      shopResearchEnrichmentTimeoutId = null;
    }
    queuedShopResearchKey = null;
    return;
  }

  if (/Riset Toko gagal dimuat/i.test(snapshot.statusMessage)) {
    return;
  }

  const queueKey = snapshot.shopIdentifier ?? snapshot.url;
  if (shopResearchEnrichmentTimeoutId && queuedShopResearchKey === queueKey) {
    return;
  }

  if (shopResearchEnrichmentTimeoutId) {
    window.clearTimeout(shopResearchEnrichmentTimeoutId);
    shopResearchEnrichmentTimeoutId = null;
  }

  queuedShopResearchKey = queueKey;

  shopResearchEnrichmentTimeoutId = window.setTimeout(() => {
    shopResearchEnrichmentTimeoutId = null;
    queuedShopResearchKey = null;
    void enrichShopSnapshot(snapshot);
  }, 900);
}

async function publishSnapshot(payload: PageSnapshot) {
  const snapshotWithResolvedEnrichment = applyResolvedEnrichmentToSnapshot(payload);
  if (lastSnapshot && lastSnapshot.pageType !== snapshotWithResolvedEnrichment.pageType) {
    removeOverlay();
  }
  lastSnapshot = snapshotWithResolvedEnrichment;
  syncDomObservationMode(snapshotWithResolvedEnrichment);
  renderOverlay(snapshotWithResolvedEnrichment);
  queueShopResearchEnrichment(snapshotWithResolvedEnrichment);

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

function renderShopOverlay(snapshot: PageSnapshot, statusLabel: string) {
  if (snapshot.pageType !== 'shopee_public_shop') {
    removeShopOverlay();
    return;
  }

  ensureShopOverlayStyle();
  removeSharedOverlay();

  const shopId =
    snapshot.shopIdentifier && /^\d+$/.test(snapshot.shopIdentifier)
      ? snapshot.shopIdentifier
      : null;
  const meta = shopId ? shopeeShopResearchMeta.get(shopId) ?? null : null;
  const shop =
    snapshot.shopResearch ?? (shopId ? shopeeShopResearchCache.get(shopId) ?? null : null);
  const isLoading = meta?.isLoading ?? !shop;
  const products = shop?.products ?? [];
  const totalCount = meta?.totalCount ?? products.length;
  const hasMore = meta?.hasMore ?? false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const shopLabel =
    shop?.shopName ?? normalizeText(document.querySelector('h1')?.textContent) ?? 'Toko Shopee';
  const revenueLabel = shop?.revenue30dEstimate
    ? formatCompactCurrencyLabel(shop.revenue30dEstimate)
    : isLoading
      ? '-'
      : formatCompactCurrencyLabel(0);
  const soldTotalLabel =
    typeof shop?.sold30dTotal === 'number' ? formatCompactCount(shop.sold30dTotal, 'Pcs') : '-';
  const priceRangeLabel =
    typeof shop?.priceMin === 'number' || typeof shop?.priceMax === 'number'
      ? `${formatCompactCurrencyLabel(shop?.priceMin ?? null)} - ${formatCompactCurrencyLabel(
          shop?.priceMax ?? null,
        )}`
      : '-';
  const listingAgeLabel = formatListingAgeRange(
    shop?.listingAgeMinDays ?? null,
    shop?.listingAgeMaxDays ?? null,
  );
  const followerLabel =
    typeof shop?.followerCount === 'number'
      ? formatCompactCount(shop.followerCount, 'Pengikut')
      : '-';
  const responseRateLabel =
    typeof shop?.responseRate === 'number' ? `${Math.round(shop.responseRate)}%` : '-';
  const ratingStarLabel =
    typeof shop?.ratingStar === 'number' ? formatDecimal(shop.ratingStar, 1) : '-';
  const cancelRateLabel =
    typeof shop?.cancellationRate === 'number'
      ? `${(shop.cancellationRate * 100).toFixed(1).replace(/\.0$/, '')}%`
      : '-';

  const sortedProducts = sortShopResearchProducts(products, shopResearchSortKey);

  const overlay = document.getElementById(SHOP_OVERLAY_ID) ?? document.createElement('section');
  overlay.id = SHOP_OVERLAY_ID;
  overlay.setAttribute('data-levelup-ads-managed', 'true');
  const renderKey = JSON.stringify({
    pageType: snapshot.pageType,
    statusLabel,
    shopIdentifier: snapshot.shopIdentifier ?? '',
    sortKey: shopResearchSortKey,
    shopUpdatedAt: shop?.updatedAt ?? '',
    productCount: products.length,
    totalCount,
    hasMore,
  });
  const shouldRefreshMarkup = overlay.dataset.renderKey !== renderKey;

  if (shouldRefreshMarkup) {
    overlay.innerHTML = `
      <div class="levelup-shop-header">
        <div>
          <div class="levelup-shop-header-title">
            <span>Riset Toko |</span>
            <img class="levelup-shop-header-title-logo" src="${POWERED_BY_LOGO_URL}" alt="LevelUP adsPRO" />
          </div>
          <div class="levelup-shop-subtitle">Toko: ${shopLabel}</div>
          <div class="levelup-shop-status">${statusLabel}</div>
        </div>
        <div class="levelup-shop-header-actions">
          <label class="levelup-shop-inline-select">
            <span>Urutkan</span>
            <select data-role="shop-sort-isolated">
              <option value="revenue30d">Omset 30 hari</option>
              <option value="sold30d">Pcs Terjual</option>
              <option value="reviews">Ulasan</option>
              <option value="newest">Terbaru</option>
            </select>
          </label>
          <button type="button" class="levelup-shop-button levelup-shop-button-primary" data-action="shop-sync">Sinkronkan Sekarang</button>
          <button type="button" class="levelup-shop-button levelup-shop-button-secondary" data-action="shop-refresh">Muat Ulang Parser</button>
          <button type="button" class="levelup-shop-button levelup-shop-button-ghost" data-action="shop-load-more-isolated" ${hasMore ? '' : 'disabled'}>${meta?.isLoading ? 'Memuat...' : 'Muat Lebih Banyak'}</button>
        </div>
      </div>
      <div class="levelup-shop-body">
        <div class="levelup-shop-stats">
          <div class="levelup-shop-card"><div class="levelup-shop-card-label">Pendapatan Kotor 30 Hari</div><div class="levelup-shop-card-value">${revenueLabel}</div></div>
          <div class="levelup-shop-card"><div class="levelup-shop-card-label">Terjual 30 Hari</div><div class="levelup-shop-card-value">${soldTotalLabel}</div></div>
          <div class="levelup-shop-card"><div class="levelup-shop-card-label">Rentang Harga</div><div class="levelup-shop-card-value">${priceRangeLabel}</div></div>
          <div class="levelup-shop-card"><div class="levelup-shop-card-label">Rentang Umur Listing</div><div class="levelup-shop-card-value">${listingAgeLabel}</div></div>
          <div class="levelup-shop-card"><div class="levelup-shop-card-label">Produk Terdata</div><div class="levelup-shop-card-value">${products.length} / ${totalCount || '-'}</div></div>
          <div class="levelup-shop-card"><div class="levelup-shop-card-label">Pengikut</div><div class="levelup-shop-card-value">${followerLabel}</div></div>
          <div class="levelup-shop-card"><div class="levelup-shop-card-label">Rating / Chat</div><div class="levelup-shop-card-value">${ratingStarLabel} • ${responseRateLabel}</div></div>
          <div class="levelup-shop-card"><div class="levelup-shop-card-label">Cancel Rate</div><div class="levelup-shop-card-value">${cancelRateLabel}</div></div>
        </div>
        <div class="levelup-shop-note">Pendapatan Kotor 30 Hari adalah estimasi dari data publik (sold 30 hari x harga). Gunakan sebagai insight riset, bukan angka resmi.</div>
        ${
          shop?.categories?.length
            ? `<div class="levelup-shop-chip-list">
                ${shop.categories
                  .slice(0, 8)
                  .map((category) => `<span class="levelup-shop-chip">${category.name} (${category.total})</span>`)
                  .join('')}
              </div>`
            : ''
        }
        <div class="levelup-shop-results">
          ${
            isLoading && products.length === 0
              ? `<div class="levelup-shop-empty">Memuat data toko...</div>`
              : sortedProducts
                  .map((product) => {
                    const cleanTitle = cleanProductTitle(product.productTitle);
                    const priceLabel =
                      typeof product.priceMin === 'number' || typeof product.priceMax === 'number'
                        ? typeof product.priceMin === 'number' &&
                          typeof product.priceMax === 'number' &&
                          product.priceMin !== product.priceMax
                          ? `${formatCompactCurrencyLabel(product.priceMin)} - ${formatCompactCurrencyLabel(product.priceMax)}`
                          : formatCompactCurrencyLabel(product.priceMin ?? product.priceMax ?? null)
                        : '-';
                    const soldLabel = formatCompactCount(product.sold30d ?? null, 'Pcs');
                    const ratingLabel =
                      typeof product.ratingStar === 'number' ? formatDecimal(product.ratingStar, 1) : '-';
                    const reviewLabel = formatCompactCount(product.reviewCount ?? null, '');
                    const revenueItemLabel = formatCompactCurrencyLabel(product.revenue30dEstimate ?? null);
                    const ageLabel =
                      typeof product.listingCtime === 'number'
                        ? formatListingAgeDays((nowSeconds - product.listingCtime) / 86400)
                        : '-';

                    return `
                      <div class="levelup-shop-result" data-product-url="${encodeURIComponent(product.productUrl)}">
                        <div class="levelup-shop-result-thumb">
                          ${
                            product.imageUrl
                              ? `<img src="${product.imageUrl}" alt="${cleanTitle}" loading="lazy" referrerpolicy="no-referrer" />`
                              : ''
                          }
                          <div class="levelup-shop-result-action-layer">
                            <button type="button" class="levelup-shop-hover-button levelup-shop-hover-button-secondary" data-action="shop-open-product" data-product-url="${encodeURIComponent(product.productUrl)}">Lihat Produk</button>
                            <button type="button" class="levelup-shop-hover-button levelup-shop-hover-button-primary" data-action="shop-sync-product" data-product-url="${encodeURIComponent(product.productUrl)}">Simpan Produk</button>
                          </div>
                        </div>
                        <div class="levelup-shop-result-title">${cleanTitle}</div>
                        <div class="levelup-shop-result-meta-grid">
                          <div class="levelup-shop-result-meta-row"><span class="levelup-shop-result-meta-label">Harga</span><span class="levelup-shop-result-meta-value">${priceLabel}</span></div>
                          <div class="levelup-shop-result-meta-row"><span class="levelup-shop-result-meta-label">Terjual 30 Hari</span><span class="levelup-shop-result-meta-value">${soldLabel}</span></div>
                          <div class="levelup-shop-result-meta-row"><span class="levelup-shop-result-meta-label">Rating Ulasan</span><span class="levelup-shop-result-meta-value">${ratingLabel} / ${reviewLabel}</span></div>
                          <div class="levelup-shop-result-meta-row"><span class="levelup-shop-result-meta-label">Umur Listing</span><span class="levelup-shop-result-meta-value">${ageLabel}</span></div>
                          <div class="levelup-shop-result-meta-row"><span class="levelup-shop-result-meta-label">Omset Kotor</span><span class="levelup-shop-result-meta-value">${revenueItemLabel}</span></div>
                        </div>
                      </div>
                    `;
                  })
                  .join('')
          }
        </div>
      </div>
    `;
  }

  overlay.dataset.renderKey = renderKey;
  const { parent, before } = getShopOverlayHost();
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

  const shopSyncButton = overlay.querySelector<HTMLButtonElement>('[data-action="shop-sync"]');
  const shopRefreshButton = overlay.querySelector<HTMLButtonElement>('[data-action="shop-refresh"]');
  const shopLoadMoreButton = overlay.querySelector<HTMLButtonElement>(
    '[data-action="shop-load-more-isolated"]',
  );
  const shopSortSelect = overlay.querySelector<HTMLSelectElement>('[data-role="shop-sort-isolated"]');
  const openProductButtons = Array.from(
    overlay.querySelectorAll<HTMLButtonElement>('[data-action="shop-open-product"]'),
  );
  const syncProductButtons = Array.from(
    overlay.querySelectorAll<HTMLButtonElement>('[data-action="shop-sync-product"]'),
  );
  const resultCards = Array.from(overlay.querySelectorAll<HTMLElement>('.levelup-shop-result'));

  if (shopSortSelect) {
    shopSortSelect.value = shopResearchSortKey;
  }

  shopSyncButton?.addEventListener('click', async () => {
    if (!shopSyncButton) {
      return;
    }

    shopSyncButton.disabled = true;
    const previousLabel = shopSyncButton.textContent;
    shopSyncButton.textContent = 'Menyinkronkan...';

    try {
      await sendBackgroundMessage<{ batchId: string; state: ExtensionState }>({
        type: 'SYNC_NOW',
      });
      await refreshKnownState();
      if (lastSnapshot) {
        renderShopOverlay(lastSnapshot, lastKnownState?.lastSync.message ?? lastSnapshot.statusMessage);
      }
    } catch (error) {
      const statusElement = overlay.querySelector<HTMLElement>('.levelup-shop-status');
      if (statusElement) {
        statusElement.textContent =
          error instanceof Error ? error.message : 'Sync gagal dari overlay toko.';
      }
    } finally {
      shopSyncButton.disabled = false;
      shopSyncButton.textContent = previousLabel ?? 'Sinkronkan Sekarang';
    }
  });

  shopRefreshButton?.addEventListener('click', () => {
    queueRefresh();
  });

  shopLoadMoreButton?.addEventListener('click', async () => {
    shopLoadMoreButton.disabled = true;
    const previousLabel = shopLoadMoreButton.textContent;
    shopLoadMoreButton.textContent = 'Memuat...';

    try {
      await loadMoreShopProducts(snapshot);
      await refreshKnownState();
      if (lastSnapshot) {
        renderShopOverlay(lastSnapshot, lastKnownState?.lastSync.message ?? lastSnapshot.statusMessage);
      }
    } catch (error) {
      const statusElement = overlay.querySelector<HTMLElement>('.levelup-shop-status');
      if (statusElement) {
        statusElement.textContent =
          error instanceof Error ? error.message : 'Gagal memuat produk toko tambahan.';
      }
    } finally {
      if (shopLoadMoreButton.isConnected) {
        shopLoadMoreButton.disabled = false;
        shopLoadMoreButton.textContent = previousLabel ?? 'Muat Lebih Banyak';
      }
    }
  });

  shopSortSelect?.addEventListener('change', () => {
    const nextValue = shopSortSelect.value;
    if (
      nextValue === 'revenue30d' ||
      nextValue === 'sold30d' ||
      nextValue === 'reviews' ||
      nextValue === 'newest'
    ) {
      shopResearchSortKey = nextValue;
      if (lastSnapshot) {
        renderShopOverlay(lastSnapshot, lastKnownState?.lastSync.message ?? lastSnapshot.statusMessage);
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

  for (const card of resultCards) {
    card.addEventListener('mouseenter', () => {
      card.dataset.hoverActive = 'true';
    });

    card.addEventListener('mouseleave', () => {
      delete card.dataset.hoverActive;
    });
  }

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
        const response = await sendBackgroundMessage<{ batchId: string; state: ExtensionState }>({
          type: 'SYNC_PRODUCT_URL',
          payload: { productUrl },
        });
        await refreshKnownState();
        showToast(`Produk berhasil disimpan. Batch ${response.batchId} diterima.`, 'success');
        if (lastSnapshot) {
          renderShopOverlay(lastSnapshot, lastKnownState?.lastSync.message ?? lastSnapshot.statusMessage);
        }
      } catch (error) {
        const statusElement = overlay.querySelector<HTMLElement>('.levelup-shop-status');
        const message =
          error instanceof Error ? error.message : 'Sync produk dari kartu riset toko gagal.';
        if (statusElement) {
          statusElement.textContent = message;
        }
        showToast(message, 'error');
      } finally {
        if (button.isConnected) {
          button.disabled = false;
          button.textContent = previousLabel ?? 'Simpan Produk';
        }
      }
    });
  }
}

function renderOverlay(snapshot: PageSnapshot) {
  if (
    (snapshot.pageType === 'shopee_ads_dashboard' ||
      snapshot.pageType === 'shopee_ads_product_detail') &&
    snapshot.captureMode === 'owned'
  ) {
    ensureOverlayStyle();
    const dashboardRendered = renderShopeeAdsDashboardEnhancement(snapshot);
    const detailRendered =
      snapshot.pageType === 'shopee_ads_product_detail'
        ? renderShopeeAdsProductDetailOverlay(snapshot)
        : true;
    if (dashboardRendered && detailRendered) {
      clearAdsDashboardBootstrapRetry();
    } else if (
      adsDashboardBootstrapRetryCount < ADS_DASHBOARD_BOOTSTRAP_RETRY_DELAYS_MS.length
    ) {
      scheduleAdsDashboardBootstrapRetry();
    }
    if (snapshot.pageType === 'shopee_ads_dashboard') {
      removeOverlay();
    }
    return;
  }

  clearAdsDashboardBootstrapRetry();
  lastStableShopeeAdsDashboard = null;
  removeShopeeAdsDashboardEnhancement();

  if (
    (snapshot.pageType !== 'shopee_public_search' &&
      snapshot.pageType !== 'shopee_public_product' &&
      snapshot.pageType !== 'shopee_public_shop') ||
    snapshot.captureMode !== 'public'
  ) {
    removeOverlay();
    return;
  }

  const isSearchPage = snapshot.pageType === 'shopee_public_search';
  const isShopPage = snapshot.pageType === 'shopee_public_shop';
  const statusLabel = lastKnownState?.lastSync.message ?? snapshot.statusMessage;
  const combinedStatusLabel =
    snapshot.pageType === 'shopee_public_search' && searchEnrichmentDebugLabel
      ? `${statusLabel} ${searchEnrichmentDebugLabel}`
      : statusLabel;

  if (isShopPage) {
    renderShopOverlay(snapshot, combinedStatusLabel);
    return;
  }

  removeShopOverlay();
  ensureOverlayStyle();

  const currentSignature = getResultsSignature(snapshot);
  if (currentSignature !== lastResultsSignature) {
    visibleResultCount = INITIAL_VISIBLE_RESULTS;
    lastResultsSignature = currentSignature;
    searchEnrichmentDebugLabel = '';
  }
  const orderedResults = isSearchPage
    ? orderResultsForResearch(snapshot.resultsPreview)
    : snapshot.resultsPreview;
  const totalResults = orderedResults.length;
  const existingOverlay = document.getElementById(OVERLAY_ID);
  const overlay =
    isShopPage && existingOverlay
      ? (() => {
          existingOverlay.remove();
          return document.createElement('section');
        })()
      : existingOverlay ?? document.createElement('section');
  const nextRenderKey = getOverlayRenderKey(
    snapshot,
    combinedStatusLabel,
    visibleResultCount,
  );
  const shouldRefreshMarkup = overlay.dataset.renderKey !== nextRenderKey;

  overlay.id = OVERLAY_ID;
  overlay.dataset.pageKind = isSearchPage ? 'search' : isShopPage ? 'shop' : 'product';
  overlay.setAttribute('data-levelup-ads-managed', 'true');

  if (isShopPage && shouldRefreshMarkup) {
    const shopId =
      snapshot.shopIdentifier && /^\d+$/.test(snapshot.shopIdentifier)
        ? snapshot.shopIdentifier
        : null;
    const meta = shopId ? shopeeShopResearchMeta.get(shopId) ?? null : null;
    const shop = snapshot.shopResearch ?? (shopId ? shopeeShopResearchCache.get(shopId) ?? null : null);
    const isLoading = meta?.isLoading ?? !shop;
    const products = shop?.products ?? [];
    const totalCount = meta?.totalCount ?? products.length;
    const hasMore = meta?.hasMore ?? false;
    const nowSeconds = Math.floor(Date.now() / 1000);

    const sortedProducts = sortShopResearchProducts(products, shopResearchSortKey);

    const statusLabel = lastKnownState?.lastSync.message ?? snapshot.statusMessage;
    const shopLabel = shop?.shopName ?? normalizeText(document.querySelector('h1')?.textContent) ?? 'Toko Shopee';
    const revenueLabel = shop?.revenue30dEstimate
      ? formatCompactCurrencyLabel(shop.revenue30dEstimate)
      : isLoading
      ? '-'
      : formatCompactCurrencyLabel(0);
    const soldTotalLabel =
      typeof shop?.sold30dTotal === 'number'
        ? formatCompactCount(shop.sold30dTotal, 'Pcs')
        : '-';
    const priceRangeLabel =
      typeof shop?.priceMin === 'number' || typeof shop?.priceMax === 'number'
        ? `${formatCompactCurrencyLabel(shop?.priceMin ?? null)} - ${formatCompactCurrencyLabel(
            shop?.priceMax ?? null,
          )}`
        : '-';
    const listingAgeLabel = formatListingAgeRange(
      shop?.listingAgeMinDays ?? null,
      shop?.listingAgeMaxDays ?? null,
    );
    const followerLabel =
      typeof shop?.followerCount === 'number'
        ? formatCompactCount(shop.followerCount, 'Pengikut')
        : '-';
    const responseRateLabel =
      typeof shop?.responseRate === 'number'
        ? `${Math.round(shop.responseRate)}%`
        : '-';
    const ratingStarLabel =
      typeof shop?.ratingStar === 'number' ? formatDecimal(shop.ratingStar, 1) : '-';
    const cancelRateLabel =
      typeof shop?.cancellationRate === 'number'
        ? `${(shop.cancellationRate * 100).toFixed(1).replace(/\.0$/, '')}%`
        : '-';

    overlay.innerHTML = `
      <div class="levelup-header">
        <div class="levelup-brand">
          <div class="levelup-brand-copy">
            <div class="levelup-title levelup-shop-header-title">
              <span>Riset Toko |</span>
              <img
                class="levelup-shop-header-title-logo"
                src="${POWERED_BY_LOGO_URL}"
                alt="LevelUP adsPRO"
              />
            </div>
            <div class="levelup-subtitle">Toko: ${shopLabel}</div>
            <div class="levelup-status">${statusLabel}</div>
          </div>
        </div>
        <div class="levelup-header-actions">
          <label class="levelup-inline-select">
            <span>Urutkan</span>
            <select data-role="shop-sort">
              <option value="revenue30d">Omset 30 hari</option>
              <option value="sold30d">Pcs Terjual</option>
              <option value="reviews">Ulasan</option>
              <option value="newest">Terbaru</option>
            </select>
          </label>
          <button type="button" class="levelup-button levelup-button-primary" data-action="sync">Sinkronkan Sekarang</button>
          <button type="button" class="levelup-button levelup-button-secondary" data-action="refresh">Muat Ulang Parser</button>
          <button type="button" class="levelup-button levelup-button-ghost" data-action="shop-load-more" ${hasMore ? '' : 'disabled'}>${meta?.isLoading ? 'Memuat...' : 'Muat Lebih Banyak'}</button>
        </div>
      </div>
      <div class="levelup-body">
        <div class="levelup-stats">
          <div class="levelup-card">
            <div class="levelup-card-label">Pendapatan Kotor 30 Hari</div>
            <div class="levelup-card-value">${revenueLabel}</div>
          </div>
          <div class="levelup-card">
              <div class="levelup-card-label">Terjual 30 Hari</div>
              <div class="levelup-card-value">${soldTotalLabel}</div>
            </div>
            <div class="levelup-card">
            <div class="levelup-card-label">Rentang Harga</div>
            <div class="levelup-card-value">${priceRangeLabel}</div>
          </div>
          <div class="levelup-card">
            <div class="levelup-card-label">Rentang Umur Listing</div>
            <div class="levelup-card-value">${listingAgeLabel}</div>
          </div>
          <div class="levelup-card">
            <div class="levelup-card-label">Produk Terdata</div>
            <div class="levelup-card-value">${products.length} / ${totalCount || '-'}</div>
          </div>
          <div class="levelup-card">
            <div class="levelup-card-label">Pengikut</div>
            <div class="levelup-card-value">${followerLabel}</div>
          </div>
          <div class="levelup-card">
            <div class="levelup-card-label">Rating / Chat</div>
            <div class="levelup-card-value">${ratingStarLabel} • ${responseRateLabel}</div>
          </div>
          <div class="levelup-card">
            <div class="levelup-card-label">Cancel Rate</div>
            <div class="levelup-card-value">${cancelRateLabel}</div>
          </div>
        </div>
        <div class="levelup-note">Pendapatan Kotor 30 Hari adalah estimasi dari data publik (sold 30 hari x harga). Gunakan sebagai insight riset, bukan angka resmi.</div>
        ${
          shop?.categories?.length
            ? `<div class="levelup-shop-categories">
                ${shop.categories
                  .slice(0, 8)
                  .map((category) => `<span class="levelup-chip">${category.name} (${category.total})</span>`)
                  .join('')}
              </div>`
            : ''
        }
        <div class="levelup-results">
          ${
            isLoading && products.length === 0
              ? `<div class="levelup-empty">Memuat data toko...</div>`
              : sortedProducts
                  .map((product) => {
                    const cleanTitle = cleanProductTitle(product.productTitle);
                    const priceLabel =
                      typeof product.priceMin === 'number' || typeof product.priceMax === 'number'
                        ? typeof product.priceMin === 'number' && typeof product.priceMax === 'number' && product.priceMin !== product.priceMax
                          ? `${formatCompactCurrencyLabel(product.priceMin)} - ${formatCompactCurrencyLabel(product.priceMax)}`
                          : formatCompactCurrencyLabel(product.priceMin ?? product.priceMax ?? null)
                        : '-';
                    const soldLabel = formatCompactCount(product.sold30d ?? null, 'Pcs');
                    const ratingLabel =
                      typeof product.ratingStar === 'number' ? formatDecimal(product.ratingStar, 1) : '-';
                    const reviewLabel = formatCompactCount(product.reviewCount ?? null, 'Ulasan');
                    const revenueItemLabel = formatCompactCurrencyLabel(product.revenue30dEstimate ?? null);
                    const ageLabel =
                      typeof product.listingCtime === 'number'
                        ? formatListingAgeDays((nowSeconds - product.listingCtime) / 86400)
                        : '-';

                    return `
                      <div class="levelup-result" data-product-url="${encodeURIComponent(product.productUrl)}">
                        <div class="levelup-result-thumb">
                          ${
                            product.imageUrl
                              ? `<img src="${product.imageUrl}" alt="${cleanTitle}" loading="lazy" referrerpolicy="no-referrer" />`
                              : ''
                          }
                          <div class="levelup-result-action-layer">
                            <button
                              type="button"
                              class="levelup-hover-button levelup-hover-button-secondary"
                              data-action="open-result-product"
                              data-product-url="${encodeURIComponent(product.productUrl)}"
                            >
                              Lihat Produk
                            </button>
                            <button
                              type="button"
                              class="levelup-hover-button levelup-hover-button-primary"
                              data-action="sync-result-product"
                              data-product-url="${encodeURIComponent(product.productUrl)}"
                            >
                              Simpan Produk
                            </button>
                          </div>
                        </div>
                        <div class="levelup-result-title">${cleanTitle}</div>
                        <div class="levelup-result-meta-grid">
                          <div class="levelup-result-meta-row">
                            <div class="levelup-result-meta-cell" data-tone="primary">${priceLabel}</div>
                            <div class="levelup-result-meta-cell" data-tone="accent" data-align="right">${soldLabel}</div>
                          </div>
                          <div class="levelup-result-meta-row">
                            <div class="levelup-result-meta-cell">${ratingLabel}</div>
                            <div class="levelup-result-meta-cell" data-align="right">${reviewLabel}</div>
                          </div>
                          <div class="levelup-result-meta-row">
                            <div class="levelup-result-meta-cell">${ageLabel}</div>
                            <div class="levelup-result-meta-cell" data-align="right">${revenueItemLabel}</div>
                          </div>
                        </div>
                      </div>
                    `;
                  })
                  .join('')
          }
        </div>
      </div>
    `;
  }

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
          <div class="levelup-brand-copy">
            <div class="levelup-title levelup-search-header-title">
              <span>Riset Market |</span>
              <img
                class="levelup-search-header-title-logo"
                src="${POWERED_BY_LOGO_URL}"
                alt="LevelUP adsPRO"
              />
            </div>
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
    const hasComparableRange =
      comparablePrices.length >= 3 &&
      typeof minPriceValue === 'number' &&
      typeof maxPriceValue === 'number' &&
      Number.isFinite(minPriceValue) &&
      Number.isFinite(maxPriceValue) &&
      minPriceValue !== maxPriceValue;
    const badges =
      detail && hasComparableRange
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
    const ratingValueLabel =
      normalizeText(detail?.ratingHint).match(/\d(?:[.,]\d)?/)?.[0] ?? '-';
    const reviewCountToken =
      normalizeText(detail?.reviewCountHint).match(/^[^A-Za-z]{0,2}([\d.,A-Za-z+]+)\b/)?.[1] ??
      normalizeText(detail?.reviewCountHint).split(/\s+/).filter(Boolean)[0] ??
      '-';
    const ratingReviewValue =
      ratingValueLabel === '-' && reviewCountToken === '-'
        ? '-'
        : `${ratingValueLabel} Dari ${reviewCountToken === '-' ? '-' : `${reviewCountToken} Ulasan`}`;
    const salesLabel = normalizeText(detail?.salesHint) || '-';
    const monthlySoldLabel = normalizeText(detail?.monthlySoldHint) || '-';
    const monthlySoldPiecesLabel =
      monthlySoldLabel === '-'
        ? '-'
        : monthlySoldLabel.replace(/\s*terjual\s*\/\s*30\s*hari/i, ' Pcs');
    const totalRevenueLabel = normalizeText(detail?.totalRevenueHint) || '-';
    const monthlyRevenueLabel = normalizeText(detail?.monthlyRevenueHint) || '-';
    const listingAgeLabel = normalizeText(detail?.listingAgeHint) || '-';
    const favoriteLabel = normalizeText(detail?.favoriteCountHint) || '-';
    const shippedFromLabel = normalizeText(detail?.shippedFromHint) || '-';
    const productHighlights = detail?.highlights ?? [];
    const ratingHighlights = productHighlights.filter(isRatingDistributionHighlight);
    const nonRatingHighlights = productHighlights
      .filter((highlight) => !isRatingDistributionHighlight(highlight))
      .filter((highlight) => !/^dengan komentar/i.test(normalizeText(highlight)));
    const positiveKeywords = detail?.positiveKeywords ?? [];
    const negativeKeywords = detail?.negativeKeywords ?? [];
    const competitorProducts = detail?.competitorProducts ?? [];
    const productInsightLabel = badges.length > 0 ? badges.join(' | ') : '';

    if (detail && roasCalculatorState.price === null) {
      roasCalculatorState.price = getRepresentativeProductPrice(detail);
    }
    const hasRoasInput =
      roasCalculatorState.hpp !== null ||
      roasCalculatorState.operasional !== null ||
      Boolean(normalizeText(roasCalculatorState.categoryLabel)) ||
      (roasCalculatorState.kategoriFeePct ?? 0) > 0 ||
      roasCalculatorState.promoXtraEnabled ||
      roasCalculatorState.gratisOngkirXtraEnabled;
    const roasMetrics = hasRoasInput ? computeRoasMetrics() : null;
    const roasFootMarkup = !detail
      ? ''
      : roasMetrics
      ? `<div class="levelup-product-roas-panel">
          <div class="levelup-product-roas-title">
            <span>Ringkasan ROAS</span>
            <button type="button" class="levelup-button levelup-button-secondary" data-action="roas">Edit</button>
          </div>
          <div class="levelup-product-roas-grid">
            <div class="levelup-product-roas-item">
              <span class="levelup-product-roas-item-label">Profit Sebelum Iklan</span>
              <span class="levelup-product-roas-item-value">${formatCompactCurrency(Math.round(roasMetrics.profitSebelumIklan))}</span>
            </div>
            <div class="levelup-product-roas-item">
              <span class="levelup-product-roas-item-label">Break-even ROAS</span>
              <span class="levelup-product-roas-item-value">${typeof roasMetrics.breakEvenRoas === 'number' ? roasMetrics.breakEvenRoas.toFixed(1) : '-'}</span>
            </div>
            <div class="levelup-product-roas-item">
              <span class="levelup-product-roas-item-label">ROAS Kompetitif</span>
              <span class="levelup-product-roas-item-value">${typeof roasMetrics.tiers.find((tier) => tier.key === 'kompetitif')?.roas === 'number' ? roasMetrics.tiers.find((tier) => tier.key === 'kompetitif')!.roas!.toFixed(1) : '-'}</span>
            </div>
            <div class="levelup-product-roas-item">
              <span class="levelup-product-roas-item-label">ROAS Konservatif</span>
              <span class="levelup-product-roas-item-value">${typeof roasMetrics.tiers.find((tier) => tier.key === 'konservatif')?.roas === 'number' ? roasMetrics.tiers.find((tier) => tier.key === 'konservatif')!.roas!.toFixed(1) : '-'}</span>
            </div>
          </div>
        </div>`
      : `<div class="levelup-product-roas-panel">
          <div class="levelup-product-roas-title">
            <span>ROAS & Rekomendasi</span>
            <button type="button" class="levelup-button levelup-button-secondary" data-action="roas">Isi Kalkulator</button>
          </div>
          <div class="levelup-note">Untuk mendapatkan rekomendasi ROAS dan profit, silakan isi detail dari Kalkulator ROAS.</div>
        </div>`;

    overlay.innerHTML = `
      <div class="levelup-header">
        <div class="levelup-brand">
          <div class="levelup-brand-copy">
            <div class="levelup-title levelup-product-header-title">
              <span>Riset Produk |</span>
              <img
                class="levelup-product-header-title-logo"
                src="${POWERED_BY_LOGO_URL}"
                alt="LevelUP adsPRO"
              />
            </div>
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
            ${detail ? `<div class="levelup-product-image-foot">${roasFootMarkup}</div>` : ''}
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
                <div class="levelup-card-detail">
                  <div class="levelup-card-detail-row">
                    <span class="levelup-card-detail-label">Total</span>
                    <span class="levelup-card-detail-value">${salesLabel}</span>
                  </div>
                  <div class="levelup-card-detail-row">
                    <span class="levelup-card-detail-label">Terjual 30 Hari</span>
                    <span class="levelup-card-detail-value">${monthlySoldPiecesLabel}</span>
                  </div>
                </div>
              </div>
              <div class="levelup-card">
                <div class="levelup-card-label">Perolehan Omzet</div>
                <div class="levelup-card-detail">
                  <div class="levelup-card-detail-row">
                    <span class="levelup-card-detail-label">Total Omset</span>
                    <span class="levelup-card-detail-value">${totalRevenueLabel}</span>
                  </div>
                  <div class="levelup-card-detail-row">
                    <span class="levelup-card-detail-label">30 Hari</span>
                    <span class="levelup-card-detail-value">${monthlyRevenueLabel}</span>
                  </div>
                </div>
              </div>
              <div class="levelup-card">
                <div class="levelup-card-label">Umur Listing</div>
                <div class="levelup-card-value">${listingAgeLabel}</div>
              </div>
              <div class="levelup-card">
                <div class="levelup-card-label">Rating Ulasan</div>
                <div class="levelup-card-value">${ratingReviewValue}</div>
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
              <div class="levelup-card">
                <div class="levelup-card-label">Favorit</div>
                <div class="levelup-card-value">${favoriteLabel}</div>
              </div>
              <div class="levelup-card">
                <div class="levelup-card-label">Dikirim Dari</div>
                <div class="levelup-card-value">${shippedFromLabel}</div>
              </div>
            </div>
            ${
              productInsightLabel
                ? `<div class="levelup-product-insight">Insight pembanding: ${productInsightLabel}</div>`
                : ''
            }
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
            ${
              positiveKeywords.length || negativeKeywords.length || competitorProducts.length
                ? `<div class="levelup-chip-groups">
                  ${
                    positiveKeywords.length
                      ? `<div class="levelup-chip-group">
                        <div class="levelup-chip-group-title">Keyword Positif</div>
                        <div class="levelup-highlights">${positiveKeywords
                          .map((keyword) => `<span class="levelup-highlight-chip">${keyword}</span>`)
                          .join('')}</div>
                      </div>`
                      : ''
                  }
                  ${
                    negativeKeywords.length
                      ? `<div class="levelup-chip-group">
                        <div class="levelup-chip-group-title">Keyword Negatif</div>
                        <div class="levelup-highlights">${negativeKeywords
                          .map((keyword) => `<span class="levelup-highlight-chip">${keyword}</span>`)
                          .join('')}</div>
                      </div>`
                      : ''
                  }
                  ${
                    competitorProducts.length
                      ? `<div class="levelup-chip-group">
                        <div class="levelup-chip-group-title">Rekomendasi / Kompetitor</div>
                        <div class="levelup-highlights">${competitorProducts
                          .map(
                            (product) =>
                              `<a class="levelup-highlight-chip levelup-highlight-link" href="${product.productUrl}" target="_blank" rel="noreferrer">${cleanProductTitle(product.title)}</a>`,
                          )
                          .join('')}</div>
                      </div>`
                      : ''
                  }
                </div>`
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
  const roasButtons = Array.from(
    overlay.querySelectorAll<HTMLButtonElement>('[data-action="roas"]'),
  );
  const loadMoreButton = overlay.querySelector<HTMLButtonElement>('[data-action="load-more"]');
  const shopLoadMoreButton = overlay.querySelector<HTMLButtonElement>(
    '[data-action="shop-load-more"]',
  );
  const shopSortSelect = overlay.querySelector<HTMLSelectElement>('[data-role="shop-sort"]');
  if (shopSortSelect) {
    shopSortSelect.value = shopResearchSortKey;
  }
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

  roasButtons.forEach((button) => {
    button.addEventListener('click', () => {
      openRoasCalculator(
        snapshot.pageType === 'shopee_public_product' ? snapshot.productDetail : null,
      );
    });
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

  shopLoadMoreButton?.addEventListener('click', async () => {
    if (!isShopPage) {
      return;
    }

    shopLoadMoreButton.disabled = true;
    const previousLabel = shopLoadMoreButton.textContent;
    shopLoadMoreButton.textContent = 'Memuat...';

    try {
      await loadMoreShopProducts(snapshot);
      await refreshKnownState();
      if (lastSnapshot) {
        renderOverlay(lastSnapshot);
      }
    } catch (error) {
      const statusElement = overlay.querySelector<HTMLElement>('.levelup-status');
      if (statusElement) {
        statusElement.textContent =
          error instanceof Error ? error.message : 'Gagal memuat produk toko tambahan.';
      }
    } finally {
      if (shopLoadMoreButton.isConnected) {
        shopLoadMoreButton.disabled = false;
        shopLoadMoreButton.textContent = previousLabel ?? 'Muat Lebih Banyak';
      }
    }
  });

  shopSortSelect?.addEventListener('change', () => {
    const nextValue = shopSortSelect.value;
    if (
      nextValue === 'revenue30d' ||
      nextValue === 'sold30d' ||
      nextValue === 'reviews' ||
      nextValue === 'newest'
    ) {
      shopResearchSortKey = nextValue;
      if (lastSnapshot) {
        renderOverlay(lastSnapshot);
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
        const response = await sendBackgroundMessage<{ batchId: string; state: ExtensionState }>({
          type: 'SYNC_PRODUCT_URL',
          payload: { productUrl },
        });
        await refreshKnownState();
        showToast(`Produk berhasil disimpan. Batch ${response.batchId} diterima.`, 'success');
        if (lastSnapshot) {
          renderOverlay(lastSnapshot);
        }
      } catch (error) {
        const statusElement = overlay.querySelector<HTMLElement>('.levelup-status');
        const message =
          error instanceof Error ? error.message : 'Sync produk dari kartu riset gagal.';
        if (statusElement) {
          statusElement.textContent = message;
        }
        showToast(message, 'error');
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

async function forceSendSnapshot() {
  hasDeferredRefresh = false;
  isOverlayInteractionLocked = false;
  const payload = detectPageSnapshot(document);
  await publishSnapshot(payload);
}

function isOwnedShopeeAdsPageSnapshot(snapshot?: PageSnapshot | null) {
  return (
    snapshot?.captureMode === 'owned' &&
    (snapshot.pageType === 'shopee_ads_dashboard' ||
      snapshot.pageType === 'shopee_ads_product_detail')
  );
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

function queueAdsDashboardManualRefresh() {
  if (!isOwnedShopeeAdsPageSnapshot(lastSnapshot)) {
    return;
  }

  if (adsDashboardRefreshTimeoutId) {
    window.clearTimeout(adsDashboardRefreshTimeoutId);
  }

  if (adsDashboardFollowupRefreshTimeoutId) {
    window.clearTimeout(adsDashboardFollowupRefreshTimeoutId);
  }

  adsDashboardRefreshTimeoutId = window.setTimeout(() => {
    adsDashboardRefreshTimeoutId = null;
    void sendSnapshot();
  }, 450);

  adsDashboardFollowupRefreshTimeoutId = window.setTimeout(() => {
    adsDashboardFollowupRefreshTimeoutId = null;
    void sendSnapshot();
  }, 1400);
}

function isAdsDashboardRefreshTriggerTarget(target: EventTarget | null) {
  if (
    !(target instanceof Element) ||
    isLevelupManagedElement(target) ||
    isManagedOverlayNode(target)
  ) {
    return false;
  }

  return Boolean(
    target.closest(
      'button, [role="button"], input, select, textarea, [role="combobox"], [role="option"], [role="checkbox"], [aria-haspopup="listbox"], [aria-haspopup="menu"], [aria-expanded]',
    ),
  );
}

function watchAdsDashboardUserInteractions() {
  const handlePotentialRefresh = (event: Event) => {
    if (!isOwnedShopeeAdsPageSnapshot(lastSnapshot)) {
      return;
    }

    if (!isAdsDashboardRefreshTriggerTarget(event.target)) {
      return;
    }

    queueAdsDashboardManualRefresh();
  };

  document.addEventListener('click', handlePotentialRefresh, true);
  document.addEventListener('change', handlePotentialRefresh, true);
}

function stopWatchingDomChanges() {
  mutationObserver?.disconnect();
  isDomObserverActive = false;
}

function startWatchingDomChanges() {
  if (!mutationObserver || isDomObserverActive) {
    return;
  }

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
  isDomObserverActive = true;
}

function syncDomObservationMode(snapshot?: PageSnapshot | null) {
  if (isOwnedShopeeAdsPageSnapshot(snapshot)) {
    stopWatchingDomChanges();
    return;
  }

  startWatchingDomChanges();
}

function watchRouteChanges() {
  window.setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      void forceSendSnapshot();
    }
  }, 1000);
}

function watchDomChanges() {
  stopWatchingDomChanges();
  mutationObserver = new MutationObserver((mutations) => {
    if (isOwnedShopeeAdsPageSnapshot(lastSnapshot)) {
      return;
    }

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
  startWatchingDomChanges();
}

chrome.runtime.onMessage.addListener((message: DetectionMessage) => {
  if (message.type === 'REQUEST_PAGE_SNAPSHOT') {
    void forceSendSnapshot();
  }
});

void refreshKnownState().then(() => forceSendSnapshot());
watchRouteChanges();
watchAdsDashboardUserInteractions();
watchDomChanges();
