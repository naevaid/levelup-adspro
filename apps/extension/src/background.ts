import {
  createExtensionSession,
  createIngestionBatch,
  getSubscriptionOverview,
  listMarketplaceCategoryFees,
  listOrganizations,
  listShops,
  login,
  sendHeartbeat,
  switchOrganization,
} from './api';
import {
  DEFAULT_API_BASE_URL,
  EXTENSION_VERSION,
  HEARTBEAT_ALARM_NAME,
  HEARTBEAT_PERIOD_MINUTES,
  INITIAL_STATE,
} from './constants';
import {
  getExtensionState,
  patchExtensionState,
  resetExtensionState,
} from './storage';
import type {
  AuthSession,
  BackgroundMessage,
  DetectionMessage,
  MarketplaceCategoryFeeFilters,
  PageSnapshot,
  SearchResultEnrichment,
  SearchResultPreview,
  ShopSummary,
} from './types';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  return tab;
}

function getDeviceLabel() {
  return `Chrome ${navigator.platform}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeComparableUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

const pendingSnapshotResolvers = new Map<
  number,
  {
    resolve: (snapshot: PageSnapshot) => void;
    reject: (error: Error) => void;
    timeoutId: number;
  }
>();

const SEARCH_RESULT_ENRICHMENT_TTL_MS = 1000 * 60 * 60 * 6;
const SEARCH_ENRICHMENT_CONCURRENCY = 2;
const SEARCH_ENRICHMENT_DELAY_MS = 180;
const shopeeSearchEnrichmentCache = new Map<
  string,
  {
    cachedAt: number;
    enrichment: SearchResultEnrichment;
  }
>();

function normalizeText(rawValue?: string | null) {
  return rawValue?.replace(/\s+/g, ' ').trim() ?? '';
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

function formatCompactCount(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  if (value >= 1_000_000) {
    const compact = value / 1_000_000;
    return `${Number.isInteger(compact) ? compact.toFixed(0) : compact.toFixed(1).replace(/\.0$/, '')}JT`;
  }

  if (value >= 1_000) {
    const compact = value / 1_000;
    return `${Number.isInteger(compact) ? compact.toFixed(0) : compact.toFixed(1).replace(/\.0$/, '')}RB`;
  }

  return value.toLocaleString('id-ID');
}

function normalizeShopeeApiPrice(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.round(value / 100_000);
}

function formatCompactCurrencyLabel(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  if (value >= 1_000_000_000) {
    return `Rp${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }

  if (value >= 1_000_000) {
    return `Rp${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}JT`;
  }

  return `Rp${value.toLocaleString('id-ID')}`;
}

function formatListingAgeHint(timestampSeconds?: number | null) {
  if (
    typeof timestampSeconds !== 'number' ||
    !Number.isFinite(timestampSeconds) ||
    timestampSeconds <= 0
  ) {
    return undefined;
  }

  const ageMs = Date.now() - timestampSeconds * 1000;
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return undefined;
  }

  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  if (ageDays <= 0) {
    return 'Hari ini';
  }

  if (ageDays < 30) {
    if (ageDays < 7) {
      return `${ageDays} hari`;
    }

    const ageWeeks = Math.floor(ageDays / 7);
    const remainingDays = ageDays % 7;
    return remainingDays > 0
      ? `${ageWeeks} minggu ${remainingDays} hari`
      : `${ageWeeks} minggu`;
  }

  const ageMonths = Math.floor(ageDays / 30.4375);
  if (ageMonths < 12) {
    return `${ageMonths} bulan`;
  }

  const years = Math.floor(ageMonths / 12);
  const remainingMonths = ageMonths % 12;
  return remainingMonths > 0 ? `${years} tahun ${remainingMonths} bulan` : `${years} tahun`;
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

function getSearchResultCacheKey(result: Pick<SearchResultPreview, 'productUrl' | 'shopId' | 'itemId'>) {
  const ids =
    result.shopId && result.itemId
      ? { shopId: result.shopId, itemId: result.itemId }
      : extractShopeeIdsFromUrl(result.productUrl);

  if (!ids) {
    return null;
  }

  return `${ids.shopId}:${ids.itemId}`;
}

async function fetchShopeeJson<T>(url: string) {
  const response = await fetch(url, {
    credentials: 'omit',
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker()),
  );

  return results;
}

async function fetchSingleSearchResultEnrichment(result: SearchResultPreview) {
  const ids =
    result.shopId && result.itemId
      ? { shopId: result.shopId, itemId: result.itemId }
      : extractShopeeIdsFromUrl(result.productUrl);

  if (!ids) {
    return null;
  }

  const [itemResponse, shopResponse] = await Promise.all([
    fetchShopeeJson<{
      data?: {
        name?: string;
        price_min?: number;
        price_max?: number;
        historical_sold?: number;
        sold?: number;
        ctime?: number;
        cmt_count?: number;
        item_rating?: {
          rating_star?: number;
        };
        shop_location?: string;
      };
    }>(`https://shopee.co.id/api/v4/item/get?itemid=${ids.itemId}&shopid=${ids.shopId}`),
    fetchShopeeJson<{
      data?: {
        name?: string;
        shop_location?: string;
      };
    }>(`https://shopee.co.id/api/v4/product/get_shop_info?shopid=${ids.shopId}`),
  ]);

  const itemData = itemResponse.data;
  const shopData = shopResponse.data;
  const totalSold = formatCompactCount(itemData?.historical_sold);
  const monthlySold = formatCompactCount(itemData?.sold);
  const reviewCount = formatCompactCount(itemData?.cmt_count);
  const ratingStar =
    typeof itemData?.item_rating?.rating_star === 'number'
      ? itemData.item_rating.rating_star.toFixed(1)
      : undefined;
  const normalizedPriceMin =
    normalizeShopeeApiPrice(itemData?.price_min) ?? result.priceMin;
  const normalizedPriceMax =
    normalizeShopeeApiPrice(itemData?.price_max) ?? result.priceMax;
  const representativePrice =
    typeof normalizedPriceMin === 'number' && typeof normalizedPriceMax === 'number'
      ? Math.round((normalizedPriceMin + normalizedPriceMax) / 2)
      : normalizedPriceMin ?? normalizedPriceMax;
  const monthlyRevenue =
    typeof representativePrice === 'number' && typeof itemData?.sold === 'number'
      ? representativePrice * itemData.sold
      : null;
  const totalRevenue =
    typeof representativePrice === 'number' && typeof itemData?.historical_sold === 'number'
      ? representativePrice * itemData.historical_sold
      : null;
  const normalizedShopName = normalizeText(shopData?.name);
  const normalizedLocation = cleanSearchContextLabel(
    shopData?.shop_location ?? itemData?.shop_location ?? result.locationLabel,
  );

  return {
    productUrl: result.productUrl,
    shopId: ids.shopId,
    itemId: ids.itemId,
    shopName: normalizedShopName || result.shopName,
    locationLabel: normalizedLocation || result.locationLabel,
    priceMin: normalizedPriceMin,
    priceMax: normalizedPriceMax,
    salesHint: totalSold ? `${totalSold} Terjual` : result.salesHint,
    monthlySoldHint:
      monthlySold ? `${monthlySold} Terjual/30 Hari` : result.monthlySoldHint,
    ratingHint: ratingStar ?? result.ratingHint,
    reviewCountHint: reviewCount ? `${reviewCount} Ulasan` : result.reviewCountHint,
    totalRevenueHint: totalRevenue
      ? `± ${formatCompactCurrencyLabel(totalRevenue)} Total`
      : result.totalRevenueHint,
    monthlyRevenueHint: monthlyRevenue
      ? `± ${formatCompactCurrencyLabel(monthlyRevenue)} /30 Hari`
      : result.monthlyRevenueHint,
    listingAgeHint: formatListingAgeHint(itemData?.ctime) ?? result.listingAgeHint,
  } satisfies SearchResultEnrichment;
}

async function handleEnrichSearchResults(
  message: Extract<BackgroundMessage, { type: 'ENRICH_SEARCH_RESULTS' }>,
) {
  const now = Date.now();
  const results = await mapWithConcurrency(
    message.payload.results,
    SEARCH_ENRICHMENT_CONCURRENCY,
    async (result, index) => {
      if (index > 0) {
        await sleep(SEARCH_ENRICHMENT_DELAY_MS);
      }

      const cacheKey = getSearchResultCacheKey(result);
      if (!cacheKey) {
        return null;
      }

      const cached = shopeeSearchEnrichmentCache.get(cacheKey);
      if (cached && now - cached.cachedAt <= SEARCH_RESULT_ENRICHMENT_TTL_MS) {
        return cached.enrichment;
      }

      const enrichment = await fetchSingleSearchResultEnrichment(result).catch(() => null);
      if (enrichment) {
        shopeeSearchEnrichmentCache.set(cacheKey, {
          cachedAt: now,
          enrichment,
        });
      }

      return enrichment;
    },
  );

  return results.filter((entry): entry is SearchResultEnrichment => Boolean(entry));
}

async function createSessionBundle(
  apiBaseUrl: string,
  authSession: AuthSession,
  shopId?: string | null,
) {
  let nextAuthSession = authSession;
  const organizations = await listOrganizations(apiBaseUrl, authSession.accessToken);
  const preferredOrganization =
    organizations.data.find((organization) => !organization.isInternal) ??
    organizations.data.find((organization) => organization.isActive) ??
    organizations.data[0];

  if (
    preferredOrganization &&
    preferredOrganization.id !== authSession.activeOrganization.id
  ) {
    const switched = await switchOrganization(
      apiBaseUrl,
      authSession.accessToken,
      preferredOrganization.id,
    );

    nextAuthSession = {
      ...authSession,
      activeOrganization: {
        id: switched.data.id,
        name: switched.data.name,
        slug: switched.data.slug,
        isInternal: switched.data.isInternal,
        status: switched.data.status,
      },
      membership: {
        id: switched.data.currentMembership.id,
        role: switched.data.currentMembership.role,
        status: switched.data.currentMembership.status,
      },
    };
  }

  const [shops, subscriptionResponse] = await Promise.all([
    listShops(apiBaseUrl, nextAuthSession.accessToken),
    getSubscriptionOverview(apiBaseUrl, nextAuthSession.accessToken).catch(() => null),
  ]);
  const selectedShop =
    shopId && shops.some((shop) => shop.id === shopId) ? shopId : null;
  const extensionSession = await createExtensionSession(
    apiBaseUrl,
    nextAuthSession.accessToken,
    {
      deviceLabel: getDeviceLabel(),
      extensionVersion: EXTENSION_VERSION,
      ...(selectedShop ? { shopId: selectedShop } : {}),
    },
  );

  await patchExtensionState({
    apiBaseUrl,
    authSession: nextAuthSession,
    shops,
    subscriptionOverview: subscriptionResponse?.data ?? null,
    selectedShopId: selectedShop,
    extensionSession,
    lastSync: {
      status: 'idle',
      message:
        preferredOrganization && preferredOrganization.id !== authSession.activeOrganization.id
          ? `Login extension berhasil. Workspace aktif dialihkan ke ${preferredOrganization.name}.`
          : 'Login extension berhasil. Siap untuk sync.',
      at: new Date().toISOString(),
    },
  });
}

function isExtensionSessionExpired(
  session: Awaited<ReturnType<typeof getExtensionState>>['extensionSession'],
) {
  if (!session) {
    return true;
  }

  const expiresAt = new Date(session.expiresAt).getTime();
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
}

function isAuthSessionExpiredError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('session sudah kedaluwarsa') ||
    normalized.includes('session tidak ditemukan') ||
    normalized.includes('session token tidak valid') ||
    normalized.includes('bearer token diperlukan')
  );
}

async function clearExtensionLoginState(message: string) {
  await patchExtensionState((current) => ({
    authSession: null,
    extensionSession: null,
    subscriptionOverview: null,
    shops: [],
    selectedShopId: null,
    lastPage: current.lastPage,
    lastSync: {
      status: 'error',
      message,
      at: new Date().toISOString(),
    },
  }));

  return getExtensionState();
}

async function recoverExtensionSession(message: string) {
  const state = await getExtensionState();
  if (!state.authSession) {
    return state;
  }

  try {
    await createSessionBundle(
      state.apiBaseUrl,
      state.authSession,
      state.selectedShopId,
    );

    return patchExtensionState({
      lastSync: {
        status: 'idle',
        message,
        at: new Date().toISOString(),
      },
    });
  } catch (error) {
    const recoveryError =
      error instanceof Error
        ? error.message
        : 'Gagal memulihkan session extension.';

    if (isAuthSessionExpiredError(recoveryError)) {
      return clearExtensionLoginState(
        'Session login berakhir. Silakan login kembali.',
      );
    }

    return patchExtensionState((current) => ({
      authSession: current.authSession,
      extensionSession: null,
      shops: current.shops,
      selectedShopId: current.selectedShopId,
      lastPage: current.lastPage,
      lastSync: {
        status: 'error',
        message: recoveryError,
        at: new Date().toISOString(),
      },
    }));
  }
}

async function ensureExtensionSessionState() {
  const state = await getExtensionState();

  if (state.extensionSession && !isExtensionSessionExpired(state.extensionSession)) {
    return state;
  }

  if (!state.authSession) {
    return state.extensionSession
      ? clearExtensionLoginState(
          'Session extension sudah kedaluwarsa. Silakan login kembali.',
        )
      : state;
  }

  return recoverExtensionSession(
    state.extensionSession
      ? 'Session extension diperbarui otomatis.'
      : 'Session extension dipulihkan otomatis.',
  );
}

async function refreshSubscriptionOverviewState() {
  const state = await getExtensionState();
  if (!state.authSession) {
    return state;
  }

  try {
    const subscriptionResponse = await getSubscriptionOverview(
      state.apiBaseUrl,
      state.authSession.accessToken,
    );

    return patchExtensionState({
      subscriptionOverview: subscriptionResponse.data,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Gagal memuat subscription.';

    if (isAuthSessionExpiredError(message)) {
      return clearExtensionLoginState(
        'Session login berakhir. Silakan login kembali.',
      );
    }

    return patchExtensionState((current) => ({
      subscriptionOverview: current.subscriptionOverview,
      authSession: current.authSession,
      extensionSession: current.extensionSession,
      shops: current.shops,
      selectedShopId: current.selectedShopId,
      lastPage: current.lastPage,
      lastSync: current.lastSync,
    }));
  }
}

async function ensurePopupState() {
  const state = await ensureExtensionSessionState();
  if (!state.authSession) {
    return state;
  }

  return refreshSubscriptionOverviewState();
}

async function refreshActiveTabSnapshot() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return null;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'REQUEST_PAGE_SNAPSHOT',
    } satisfies DetectionMessage);
  } catch {
    // Ignore tabs that do not have the content script.
  }

  const state = await getExtensionState();
  return state.lastPage;
}

async function waitForTabComplete(tabId: number, timeoutMs = 15000) {
  const tab = await chrome.tabs.get(tabId);
  if (tab.status === 'complete') {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      reject(new Error('Tab produk timeout saat menunggu halaman selesai dimuat.'));
    }, timeoutMs);

    const handleUpdated = (
      updatedTabId: number,
      changeInfo: { status?: string },
    ) => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') {
        return;
      }

      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      resolve();
    };

    chrome.tabs.onUpdated.addListener(handleUpdated);
  });
}

async function requestSnapshotFromTab(tabId: number) {
  const existingPending = pendingSnapshotResolvers.get(tabId);
  if (existingPending) {
    clearTimeout(existingPending.timeoutId);
    pendingSnapshotResolvers.delete(tabId);
    existingPending.reject(new Error('Permintaan snapshot sebelumnya dibatalkan.'));
  }

  const snapshotPromise = new Promise<PageSnapshot>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingSnapshotResolvers.delete(tabId);
      reject(new Error('Snapshot produk tidak diterima dari tab target.'));
    }, 10000);

    pendingSnapshotResolvers.set(tabId, { resolve, reject, timeoutId });
  });

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'REQUEST_PAGE_SNAPSHOT',
    } satisfies DetectionMessage);
  } catch (error) {
    const pending = pendingSnapshotResolvers.get(tabId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      pendingSnapshotResolvers.delete(tabId);
    }

    throw new Error(
      error instanceof Error
        ? `Gagal meminta snapshot produk: ${error.message}`
        : 'Gagal meminta snapshot produk.',
    );
  }

  return snapshotPromise;
}

function buildSyncPayload(
  snapshot: PageSnapshot,
  state: Awaited<ReturnType<typeof getExtensionState>>,
) {
  if (!state.authSession || !state.extensionSession) {
    throw new Error('Login extension belum aktif.');
  }

  if (!snapshot.captureMode || snapshot.pageType === 'unknown') {
    throw new Error('Halaman aktif belum didukung untuk sync.');
  }

  const shopId =
    snapshot.captureMode === 'owned' ? state.selectedShopId ?? undefined : undefined;

  if (snapshot.captureMode === 'owned' && !shopId) {
    throw new Error('Pilih shop default terlebih dahulu untuk owned sync.');
  }

  const publicKeyword = snapshot.keyword?.trim();
  if (snapshot.pageType === 'shopee_public_search' && !publicKeyword) {
    throw new Error('Keyword pencarian belum berhasil dibaca dari halaman Shopee.');
  }

  if (
    snapshot.pageType === 'shopee_public_product' &&
    !snapshot.productDetail?.productTitle
  ) {
    throw new Error('Detail produk Shopee belum berhasil dibaca dari halaman.');
  }

  return {
    captureMode: snapshot.captureMode,
    pageType: snapshot.pageType,
    marketplace: snapshot.marketplace,
    payloadSchemaVersion: '1.0',
    capturedAt: snapshot.detectedAt,
    sourceUrl: snapshot.url,
    sessionId: state.extensionSession.id,
    organizationId: state.authSession.activeOrganization.id,
    ...(shopId ? { shopId } : {}),
    device: {
      extensionVersion: EXTENSION_VERSION,
      browserName: 'chrome',
    },
    captureReason: 'manual_sync',
    content:
      snapshot.captureMode === 'public' &&
      snapshot.pageType === 'shopee_public_product'
        ? {
            pageTitle: snapshot.title,
            product: {
              productTitle: snapshot.productDetail?.productTitle ?? '',
              productUrl: snapshot.productDetail?.productUrl ?? snapshot.url,
              imageUrl: snapshot.productDetail?.imageUrl,
              shopName: snapshot.productDetail?.shopName,
              priceMin: snapshot.productDetail?.priceMin,
              priceMax: snapshot.productDetail?.priceMax,
              salesHint: snapshot.productDetail?.salesHint,
              monthlySoldHint: snapshot.productDetail?.monthlySoldHint,
              ratingHint: snapshot.productDetail?.ratingHint,
              reviewCountHint: snapshot.productDetail?.reviewCountHint,
              favoriteCountHint: snapshot.productDetail?.favoriteCountHint,
              shippedFromHint: snapshot.productDetail?.shippedFromHint,
              positiveKeywords: snapshot.productDetail?.positiveKeywords,
              negativeKeywords: snapshot.productDetail?.negativeKeywords,
              competitorProducts: snapshot.productDetail?.competitorProducts,
              totalRevenueHint: snapshot.productDetail?.totalRevenueHint,
              monthlyRevenueHint: snapshot.productDetail?.monthlyRevenueHint,
              listingAgeHint: snapshot.productDetail?.listingAgeHint,
            },
            highlights: snapshot.productDetail?.highlights ?? [],
          }
        : snapshot.captureMode === 'public'
        ? {
            keyword: publicKeyword ?? '',
            resultCount: snapshot.resultsPreview.length,
            pageTitle: snapshot.title,
            results: snapshot.resultsPreview.map((result) => ({
              position: result.position,
              productTitle: result.productTitle,
              productUrl: result.productUrl,
              shopId: result.shopId,
              itemId: result.itemId,
              imageUrl: result.imageUrl,
              shopName: result.shopName,
              locationLabel: result.locationLabel,
              priceMin: result.priceMin,
              priceMax: result.priceMax,
              salesHint: result.salesHint,
              monthlySoldHint: result.monthlySoldHint,
              ratingHint: result.ratingHint,
              reviewCountHint: result.reviewCountHint,
              monthlyRevenueHint: result.monthlyRevenueHint,
              listingAgeHint: result.listingAgeHint,
            })),
          }
        : {
            shopIdentifier: snapshot.shopIdentifier ?? state.selectedShopId ?? '',
            metrics: [],
          },
  };
}

async function handleLogin(message: Extract<BackgroundMessage, { type: 'LOGIN' }>) {
  const apiBaseUrl = message.payload.apiBaseUrl.trim() || DEFAULT_API_BASE_URL;
  const authSession = await login(
    apiBaseUrl,
    message.payload.email,
    message.payload.password,
  );

  await createSessionBundle(apiBaseUrl, authSession);
  return getExtensionState();
}

async function handleLogout() {
  await resetExtensionState();
  return INITIAL_STATE;
}

async function handleSetSelectedShop(
  message: Extract<BackgroundMessage, { type: 'SET_SELECTED_SHOP' }>,
) {
  const nextState = await patchExtensionState((current) => ({
    selectedShopId: message.payload.shopId,
    lastSync: {
      ...current.lastSync,
      message: message.payload.shopId
        ? 'Shop default diperbarui.'
        : 'Shop default dibersihkan.',
      at: new Date().toISOString(),
    },
  }));

  return nextState;
}

async function handleSyncNow() {
  const state = await ensureExtensionSessionState();
  const snapshot = (await refreshActiveTabSnapshot()) ?? state.lastPage;

  if (!snapshot) {
    throw new Error('Belum ada page snapshot yang dapat disinkronkan.');
  }

  if (!state.extensionSession) {
    throw new Error('Extension session belum aktif.');
  }

  const payload = buildSyncPayload(snapshot, state);
  const response = await createIngestionBatch(
    state.apiBaseUrl,
    state.extensionSession.accessToken,
    payload,
  );

  await patchExtensionState({
    lastSync: {
      status: 'success',
      message: `Sync berhasil. Batch ${response.id} diterima.`,
      at: new Date().toISOString(),
    },
  });

  return {
    batchId: response.id,
    state: await getExtensionState(),
  };
}

async function handleSyncProductUrl(
  message: Extract<BackgroundMessage, { type: 'SYNC_PRODUCT_URL' }>,
) {
  const state = await ensureExtensionSessionState();

  if (!state.extensionSession) {
    throw new Error('Extension session belum aktif.');
  }

  let tabId: number | null = null;

  try {
    const createdTab = await chrome.tabs.create({
      url: message.payload.productUrl,
      active: false,
    });

    if (!createdTab.id) {
      throw new Error('Tab produk gagal dibuat.');
    }

    tabId = createdTab.id;
    await waitForTabComplete(tabId);
    await sleep(1200);

    const snapshot = await requestSnapshotFromTab(tabId);
    const comparableSnapshotUrl = normalizeComparableUrl(snapshot.url);
    const comparableRequestedUrl = normalizeComparableUrl(message.payload.productUrl);

    if (
      snapshot.pageType !== 'shopee_public_product' ||
      comparableSnapshotUrl !== comparableRequestedUrl
    ) {
      throw new Error('Halaman target belum terbaca sebagai detail produk Shopee.');
    }

    const payload = buildSyncPayload(snapshot, state);
    const response = await createIngestionBatch(
      state.apiBaseUrl,
      state.extensionSession.accessToken,
      payload,
    );

    await patchExtensionState({
      lastSync: {
        status: 'success',
        message: `Sync produk berhasil. Batch ${response.id} diterima.`,
        at: new Date().toISOString(),
      },
    });

    return {
      batchId: response.id,
      state: await getExtensionState(),
    };
  } finally {
    if (tabId !== null) {
      pendingSnapshotResolvers.delete(tabId);
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        // Ignore tab cleanup error.
      }
    }
  }
}

async function handleGetMarketplaceCategoryFees(
  filters?: MarketplaceCategoryFeeFilters,
) {
  const state = await getExtensionState();
  if (!state.authSession) {
    throw new Error('Login dashboard diperlukan untuk memuat master fee kategori.');
  }

  const fees = await listMarketplaceCategoryFees(
    state.apiBaseUrl,
    state.authSession.accessToken,
    filters,
  );

  return fees;
}

async function handleOpenExtensionLogin() {
  await chrome.tabs.create({
    url: chrome.runtime.getURL('popup.html'),
    active: true,
  });

  return { success: true };
}

async function handleHeartbeat() {
  const state = await getExtensionState();
  if (!state.extensionSession) {
    if (state.authSession) {
      await recoverExtensionSession('Session extension dipulihkan otomatis.');
    }
    return;
  }

  try {
    const heartbeat = await sendHeartbeat(
      state.apiBaseUrl,
      state.extensionSession.accessToken,
    );

    await patchExtensionState((current) => ({
      extensionSession: current.extensionSession
        ? {
            ...current.extensionSession,
            expiresAt: heartbeat.expiresAt,
            shop: heartbeat.shop,
          }
        : null,
      lastSync:
        current.lastSync.status === 'error'
          ? current.lastSync
          : {
              ...current.lastSync,
              message: 'Heartbeat extension berhasil diperbarui.',
              at: new Date().toISOString(),
            },
    }));
  } catch (error) {
    if (state.authSession) {
      const recovered = await recoverExtensionSession(
        'Session extension dipulihkan otomatis setelah heartbeat gagal.',
      );

      if (recovered.extensionSession) {
        return;
      }
    }

    await patchExtensionState((current) => ({
      lastSync: {
        status: 'error',
        message:
          error instanceof Error
            ? `Heartbeat gagal: ${error.message}`
            : 'Heartbeat gagal.',
        at: new Date().toISOString(),
      },
      extensionSession: null,
      authSession: current.authSession,
      shops: current.shops,
      selectedShopId: current.selectedShopId,
    }));
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(HEARTBEAT_ALARM_NAME, {
    periodInMinutes: HEARTBEAT_PERIOD_MINUTES,
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(HEARTBEAT_ALARM_NAME, {
    periodInMinutes: HEARTBEAT_PERIOD_MINUTES,
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEARTBEAT_ALARM_NAME) {
    void handleHeartbeat();
  }
});

chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage | DetectionMessage, sender) => {
    if (message.type !== 'PAGE_SNAPSHOT_UPDATED') {
      return false;
    }

    void patchExtensionState({
      lastPage: message.payload,
    });

    const senderTabId = sender.tab?.id;
    if (typeof senderTabId === 'number') {
      const pending = pendingSnapshotResolvers.get(senderTabId);
      if (pending) {
        clearTimeout(pending.timeoutId);
        pendingSnapshotResolvers.delete(senderTabId);
        pending.resolve(message.payload);
      }
    }

    return false;
  },
);

chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
  const run = async () => {
    switch (message.type) {
      case 'GET_STATE':
        return ensurePopupState();
      case 'OPEN_EXTENSION_LOGIN':
        return handleOpenExtensionLogin();
      case 'GET_MARKETPLACE_CATEGORY_FEES':
        return handleGetMarketplaceCategoryFees(message.payload);
      case 'LOGIN':
        return handleLogin(message);
      case 'LOGOUT':
        return handleLogout();
      case 'SET_SELECTED_SHOP':
        return handleSetSelectedShop(message);
      case 'REFRESH_ACTIVE_TAB':
        await refreshActiveTabSnapshot();
        return getExtensionState();
      case 'ENRICH_SEARCH_RESULTS':
        return handleEnrichSearchResults(message);
      case 'SYNC_NOW':
        return handleSyncNow();
      case 'SYNC_PRODUCT_URL':
        return handleSyncProductUrl(message);
      default:
        return getExtensionState();
    }
  };

  void run()
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Terjadi error extension.';
      void patchExtensionState((current) => ({
        lastSync: {
          status: 'error',
          message,
          at: new Date().toISOString(),
        },
        authSession: current.authSession,
        extensionSession: current.extensionSession,
        shops: current.shops,
        selectedShopId: current.selectedShopId,
        lastPage: current.lastPage,
      }));
      sendResponse({ ok: false, error: message });
    });

  return true;
});
