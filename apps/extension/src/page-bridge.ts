import type { SearchResultEnrichment, SearchResultPreview } from './types';

type PageBridgeRequestMessage = {
  requestId: string;
  results: SearchResultPreview[];
};

type PageBridgeResponseMessage = {
  requestId: string;
  entries: SearchResultEnrichment[];
  error?: string;
};

const PAGE_BRIDGE_REQUEST_EVENT = 'levelup-adspro:enrich-request';
const PAGE_BRIDGE_RESPONSE_EVENT = 'levelup-adspro:enrich-response';
const PAGE_ENRICHMENT_CONCURRENCY = 1;
const PAGE_ENRICHMENT_DELAY_MS = 900;

const itemEnrichmentCache = new Map<string, SearchResultEnrichment>();
const shopInfoCache = new Map<
  string,
  {
    name?: string;
    shop_location?: string;
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

async function fetchShopeeJson<T>(url: string) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

function getResultCacheKey(result: SearchResultPreview) {
  const ids =
    result.shopId && result.itemId
      ? { shopId: result.shopId, itemId: result.itemId }
      : extractShopeeIdsFromUrl(result.productUrl);

  if (!ids) {
    return null;
  }

  return `${ids.shopId}:${ids.itemId}`;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
  const cacheKey = getResultCacheKey(result);
  if (cacheKey) {
    const cachedEnrichment = itemEnrichmentCache.get(cacheKey);
    if (cachedEnrichment) {
      return cachedEnrichment;
    }
  }

  const ids =
    result.shopId && result.itemId
      ? { shopId: result.shopId, itemId: result.itemId }
      : extractShopeeIdsFromUrl(result.productUrl);

  if (!ids) {
    return null;
  }

  const itemResponse = await fetchShopeeJson<{
    data?: {
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
  }>(`/api/v4/item/get?itemid=${ids.itemId}&shopid=${ids.shopId}`);

  let shopData = shopInfoCache.get(ids.shopId);
  const needsShopInfo =
    !shopData ||
    !normalizeText(shopData.name) ||
    !normalizeText(result.shopName) ||
    /^toko belum/i.test(normalizeText(result.shopName));

  if (needsShopInfo) {
    const shopResponse = await fetchShopeeJson<{
      data?: {
        name?: string;
        shop_location?: string;
      };
    }>(`/api/v4/product/get_shop_info?shopid=${ids.shopId}`);
    shopData = shopResponse.data;
    if (shopData) {
      shopInfoCache.set(ids.shopId, shopData);
    }
  }

  const itemData = itemResponse.data;
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

  const enrichment = {
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

  if (cacheKey) {
    itemEnrichmentCache.set(cacheKey, enrichment);
  }

  return enrichment;
}

async function handleEnrichmentRequest(message: PageBridgeRequestMessage) {
  const results = await mapWithConcurrency(
    message.results,
    PAGE_ENRICHMENT_CONCURRENCY,
    async (result, index) => {
      if (index > 0) {
        await sleep(PAGE_ENRICHMENT_DELAY_MS);
      }

      return fetchSingleSearchResultEnrichment(result).catch(() => null);
    },
  );

  const response: PageBridgeResponseMessage = {
    requestId: message.requestId,
    entries: results.filter(
      (entry): entry is SearchResultEnrichment => Boolean(entry),
    ),
  };

  document.dispatchEvent(
    new CustomEvent<PageBridgeResponseMessage>(PAGE_BRIDGE_RESPONSE_EVENT, {
      detail: response,
    }),
  );
}

document.addEventListener(PAGE_BRIDGE_REQUEST_EVENT, (event: Event) => {
  const message = (event as CustomEvent<PageBridgeRequestMessage>).detail;
  if (
    !message ||
    typeof message.requestId !== 'string' ||
    !Array.isArray(message.results)
  ) {
    return;
  }

  void handleEnrichmentRequest(message).catch((error: unknown) => {
    const response: PageBridgeResponseMessage = {
      requestId: message.requestId,
      entries: [],
      error:
        error instanceof Error
          ? error.message
          : 'Gagal mengambil enrichment Shopee dari halaman.',
    };

    document.dispatchEvent(
      new CustomEvent<PageBridgeResponseMessage>(PAGE_BRIDGE_RESPONSE_EVENT, {
        detail: response,
      }),
    );
  });
});
