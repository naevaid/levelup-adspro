import type {
  AdsDashboardMetricSnapshot,
  CaptureMode,
  Marketplace,
  PageSnapshot,
  PageType,
  ProductDetailSnapshot,
  SearchResultPreview,
  ShopeeAdsDashboardSnapshot,
} from './types';

const MAX_SEARCH_RESULTS_PREVIEW = 120;

function normalizeText(rawValue?: string | null) {
  return rawValue?.replace(/\s+/g, ' ').trim() ?? '';
}

function isLevelupManagedElement(element: Element | null | undefined) {
  return Boolean(element?.closest('[data-levelup-ads-managed="true"]'));
}

function parsePriceRange(rawValue: string) {
  const matches = rawValue.match(/\d[\d.,]*/g);
  if (!matches || matches.length === 0) {
    return {};
  }

  const values = matches
    .map((value) => Number.parseInt(value.replace(/[^\d]/g, ''), 10))
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) {
    return {};
  }

  return {
    priceMin: Math.min(...values),
    priceMax: Math.max(...values),
  };
}

function uniqueResults(results: SearchResultPreview[]) {
  const seen = new Set<string>();

  return results.filter((result) => {
    if (seen.has(result.productUrl)) {
      return false;
    }

    seen.add(result.productUrl);
    return true;
  });
}

function isSearchResultPreview(
  result: SearchResultPreview | null,
): result is SearchResultPreview {
  return result !== null;
}

function isProductHref(rawHref: string) {
  const normalized = rawHref.toLowerCase();
  if (normalized.includes('/portal/product')) {
    return false;
  }

  return normalized.includes('/product/') || /-i\.\d+\.\d+/i.test(rawHref);
}

function extractShopeeIdsFromProductUrl(rawUrl: string) {
  const matched = rawUrl.match(/-i\.(\d+)\.(\d+)(?:$|[/?#])/i);
  if (!matched) {
    return null;
  }

  return {
    shopId: matched[1],
    itemId: matched[2],
  };
}

function resolveSearchKeyword(document: Document, url: URL) {
  const candidates = [
    url.searchParams.get('keyword'),
    url.searchParams.get('q'),
    document.querySelector<HTMLInputElement>('input[name="keyword"]')?.value,
    document.querySelector<HTMLInputElement>('input[type="search"]')?.value,
    document.querySelector<HTMLInputElement>('input[aria-label*="Cari"]')?.value,
    document.querySelector<HTMLInputElement>('input[placeholder*="Cari"]')?.value,
  ];

  const keyword = candidates
    .map((candidate) => normalizeText(candidate))
    .find((candidate) => candidate.length >= 2);

  return keyword || undefined;
}

function findSearchCardElement(anchor: HTMLAnchorElement) {
  const prioritizedContainer = anchor.closest(
    '[data-sqe="item"], [data-sqe="itemCard"], li, article, section',
  );

  if (prioritizedContainer) {
    return prioritizedContainer;
  }

  let current: Element | null = anchor;
  let fallback: Element = anchor;

  while (current && current !== anchor.ownerDocument.body) {
    const text = normalizeText(current.textContent);
    if (text.length >= 40 && text.length <= 800) {
      fallback = current;
    }

    current = current.parentElement;
  }

  return fallback;
}

function collectTextCandidates(root: Element) {
  const rawCandidates = [
    root.getAttribute('aria-label'),
    root.getAttribute('title'),
    ...Array.from(
      root.querySelectorAll<HTMLElement>(
        'img[alt], h1, h2, h3, h4, [aria-label], [title], span, div, p',
      ),
    )
      .filter((element) => !isLevelupManagedElement(element))
      .flatMap((element) => {
      const imageAlt =
        element instanceof HTMLImageElement ? element.getAttribute('alt') : null;

      return [
        imageAlt,
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.textContent,
      ];
      }),
  ];

  const uniqueCandidates: string[] = [];
  const seen = new Set<string>();

  for (const candidate of rawCandidates) {
    const normalized = normalizeText(candidate);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    uniqueCandidates.push(normalized);
  }

  return uniqueCandidates;
}

function collectLeafTextCandidates(root: Element) {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>('span, div, p'))
    .filter((element) => !isLevelupManagedElement(element))
    .map((element) => normalizeText(element.textContent))
    .filter((value) => value.length > 0 && value.length <= 80);

  return Array.from(new Set(candidates));
}

function isLikelyPriceText(value: string) {
  return /^rp\s?[\d.,\s-]+$/i.test(value) || /^\d[\d.,\s-]+$/.test(value);
}

function isLikelySalesText(value: string) {
  return /(terjual|sold|rating|ulasan|reviews?|penilaian)/i.test(value);
}

function isLikelyUiMetaText(value: string) {
  return /^(iklan|ad|promo|diskon|voucher|chat|termurah|termurah di toko ini|gratis ongkir|star\+|mall)$/i.test(
    value,
  );
}

function isLikelyRatingValue(value: string) {
  const normalized = value.replace(',', '.').trim();
  if (!/^\d(?:\.\d)?$/.test(normalized)) {
    return false;
  }

  const parsed = Number.parseFloat(normalized);
  return parsed >= 1 && parsed <= 5;
}

function isLikelyDeliveryText(value: string) {
  return /(hari ini|besok|hari|jam|menit|detik|estimasi|pengiriman|preorder|siap kirim)/i.test(
    value,
  );
}

function isLikelyLocationText(value: string) {
  return (
    value.length >= 2 &&
    value.length <= 32 &&
    !/\d/.test(value) &&
    !isLikelyPriceText(value) &&
    !isLikelySalesText(value) &&
    !isLikelyUiMetaText(value) &&
    !isLikelyRatingValue(value) &&
    !isLikelyDeliveryText(value) &&
    !/produk serupa/i.test(value)
  );
}

function extractProductTitle(
  anchor: HTMLAnchorElement,
  cardElement: Element,
) {
  const candidates = [
    normalizeText(anchor.getAttribute('aria-label')),
    ...collectTextCandidates(anchor),
    ...collectTextCandidates(cardElement),
  ];

  return (
    candidates.find(
      (candidate) =>
        candidate.length >= 8 &&
        !isLikelyPriceText(candidate) &&
        !isLikelySalesText(candidate) &&
        !isLikelyUiMetaText(candidate),
    ) ?? ''
  );
}

function extractShopName(cardElement: Element, title: string) {
  const titleLower = title.toLowerCase();
  const candidates = collectTextCandidates(cardElement).filter((candidate) => {
    const normalized = candidate.toLowerCase();

    if (candidate.length < 2 || candidate.length > 60) {
      return false;
    }

    if (normalized === titleLower) {
      return false;
    }

    if (normalized.includes(titleLower) || titleLower.includes(normalized)) {
      return false;
    }

    if (isLikelyPriceText(candidate) || isLikelySalesText(candidate)) {
      return false;
    }

    if (isLikelyUiMetaText(candidate)) {
      return false;
    }

    if (/^[\d\s.,%+-]+$/.test(candidate)) {
      return false;
    }

    return true;
  });

  return candidates.at(-1) ?? null;
}

function extractPriceRangeFromSearchCard(cardElement: Element) {
  const textCandidates = collectLeafTextCandidates(cardElement);
  const exactPriceCandidate = textCandidates.find((candidate) =>
    /^rp\s?[\d.]+(?:\s*-\s*rp?\s?[\d.]+)?$/i.test(candidate),
  );

  if (exactPriceCandidate) {
    return parsePriceRange(exactPriceCandidate);
  }

  const fallbackMatch = normalizeText(cardElement.textContent).match(
    /(rp\s?[\d.]+(?:\s*-\s*rp?\s?[\d.]+)?)/i,
  );

  return fallbackMatch ? parsePriceRange(fallbackMatch[1]) : {};
}

function extractSalesHintFromSearchCard(cardElement: Element) {
  const textCandidates = collectLeafTextCandidates(cardElement);
  const exactCandidate = textCandidates.find((candidate) =>
    /^(\d[\d.,A-Za-z+ ]*)\s*(terjual|sold)$/i.test(candidate),
  );

  const matchedValue =
    exactCandidate?.match(/^(\d[\d.,A-Za-z+ ]*)\s*(terjual|sold)$/i)?.[1] ??
    normalizeText(cardElement.textContent).match(
      /(\d[\d.,A-Za-z+ ]*)\s*(terjual|sold)/i,
    )?.[1];

  if (!matchedValue) {
    return undefined;
  }

  return `${normalizeText(matchedValue)} Terjual`;
}

function extractRatingHintFromSearchCard(cardElement: Element) {
  const starElement = cardElement.querySelector(
    'img[alt*="rating" i], img[alt*="rating-star" i], img[alt*="star" i]',
  );
  const candidateRoots = [
    starElement?.closest('div')?.parentElement,
    starElement?.closest('div'),
    cardElement,
  ].filter((value): value is Element => Boolean(value));

  for (const root of candidateRoots) {
    const ratingText = collectLeafTextCandidates(root).find((candidate) =>
      isLikelyRatingValue(candidate),
    );

    if (ratingText) {
      return ratingText.replace(',', '.');
    }
  }

  return undefined;
}

function extractLocationLabelFromSearchCard(cardElement: Element, title: string) {
  const titleLower = title.toLowerCase();
  const textCandidates = collectLeafTextCandidates(cardElement)
    .filter((candidate) => {
      const normalized = candidate.toLowerCase();

      if (!isLikelyLocationText(candidate)) {
        return false;
      }

      if (normalized === titleLower) {
        return false;
      }

      if (normalized.includes(titleLower) || titleLower.includes(normalized)) {
        return false;
      }

      return true;
    })
    .reverse();

  return textCandidates[0] ?? undefined;
}

function extractDeliveryHintFromSearchCard(cardElement: Element) {
  const textCandidates = collectLeafTextCandidates(cardElement).filter((candidate) =>
    isLikelyDeliveryText(candidate),
  );

  return textCandidates[0] ?? undefined;
}

function extractProductImageUrl(
  anchor: HTMLAnchorElement,
  cardElement: Element,
  url: URL,
) {
  const image =
    anchor.querySelector<HTMLImageElement>('img[src], img[data-src]') ??
    cardElement.querySelector<HTMLImageElement>('img[src], img[data-src]');

  const rawUrl =
    image?.getAttribute('src') ??
    image?.getAttribute('data-src') ??
    image?.currentSrc;

  if (!rawUrl) {
    return undefined;
  }

  try {
    return new URL(rawUrl, url.origin).toString();
  } catch {
    return undefined;
  }
}

function getFirstText(
  document: Document | Element,
  selectors: string[],
): string | undefined {
  for (const selector of selectors) {
    const value = normalizeText(
      document.querySelector<HTMLElement>(selector)?.textContent,
    );
    if (value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function getFirstImageUrl(
  document: Document | Element,
  selectors: string[],
  url: URL,
) {
  for (const selector of selectors) {
    const image = document.querySelector<HTMLImageElement>(selector);
    const rawUrl =
      image?.getAttribute('src') ??
      image?.getAttribute('data-src') ??
      image?.currentSrc;

    if (
      !rawUrl ||
      rawUrl.startsWith('data:image/svg') ||
      rawUrl.includes('.svg') ||
      /icon|avatar|badge|sprite/i.test(rawUrl)
    ) {
      continue;
    }

    try {
      return new URL(rawUrl, url.origin).toString();
    } catch {
      continue;
    }
  }

  return undefined;
}

function getFirstMetaContent(
  document: Document | Element,
  selectors: string[],
) {
  for (const selector of selectors) {
    const value = normalizeText(
      document.querySelector<HTMLElement>(selector)?.getAttribute('content'),
    );
    if (value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function getSmallTextCandidates(
  root: Document | Element,
  selectors: string[],
  options?: {
    minLength?: number;
    maxLength?: number;
    limit?: number;
  },
) {
  const minLength = options?.minLength ?? 2;
  const maxLength = options?.maxLength ?? 40;
  const limit = options?.limit ?? 12;
  const seen = new Set<string>();
  const values: string[] = [];

  for (const selector of selectors) {
    for (const element of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
      const text = normalizeText(element.textContent);
      if (
        text.length < minLength ||
        text.length > maxLength ||
        seen.has(text) ||
        isLikelyPriceText(text)
      ) {
        continue;
      }

      seen.add(text);
      values.push(text);

      if (values.length >= limit) {
        return values;
      }
    }
  }

  return values;
}

function extractCompactHint(
  candidates: string[],
  pattern: RegExp,
): string | undefined {
  return candidates.find((candidate) => pattern.test(candidate));
}

function extractSalesHintFromText(rawValue?: string | null) {
  const normalized = normalizeText(rawValue);
  if (!normalized) {
    return undefined;
  }

  const match = normalized.match(
    /(\d[\d.,]*(?:\s?(?:rb|ribu|jt|juta|k|m))?\+?\s*(?:terjual|sold))/i,
  );

  return match?.[1];
}

type JsonLdNode = {
  '@type'?: string | string[];
  name?: string;
  image?: string | string[];
  offers?:
    | {
        price?: string | number;
        lowPrice?: string | number;
        highPrice?: string | number;
        seller?: { name?: string } | string;
      }
    | Array<{
        price?: string | number;
        lowPrice?: string | number;
        highPrice?: string | number;
        seller?: { name?: string } | string;
      }>;
  seller?: { name?: string } | string;
  aggregateRating?: {
    ratingValue?: string | number;
    reviewCount?: string | number;
    ratingCount?: string | number;
  };
  review?: Array<unknown>;
  brand?: { name?: string } | string;
};

function parseNumericLike(value?: string | number | null) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/[^\d.,]/g, '').replace(/\.(?=\d{3}\b)/g, '');
    const parsed = Number.parseFloat(normalized.replace(',', '.'));
    if (Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }

  return undefined;
}

const SHOPEE_ADS_METRIC_LABELS = {
  impressions: ['iklan dilihat'],
  clicks: ['jumlah klik'],
  ctr: ['persentase klik', 'ctr'],
  orders: ['pesanan'],
  unitsSold: ['produk terjual'],
  revenue: ['penjualan dari iklan'],
  adSpend: ['biaya iklan'],
  roas: ['roas'],
} as const;

type ShopeeAdsMetricKey = keyof typeof SHOPEE_ADS_METRIC_LABELS;

const SHOPEE_ADS_DASHBOARD_REQUIRED_METRIC_KEYS: ShopeeAdsMetricKey[] = [
  'impressions',
  'clicks',
  'orders',
  'revenue',
  'adSpend',
  'roas',
];

const SHOPEE_ADS_PRODUCT_DETAIL_REQUIRED_METRIC_KEYS: ShopeeAdsMetricKey[] = [
  'impressions',
  'clicks',
  'unitsSold',
  'revenue',
  'adSpend',
  'roas',
];

function parseCompactMetricNumber(rawValue: string) {
  const normalized = normalizeText(rawValue).toLowerCase();
  if (!/\d/.test(normalized)) {
    return undefined;
  }

  let multiplier = 1;
  if (/\bjt\b|\bjuta\b|\bmn\b|[\d.,]+m\b/.test(normalized)) {
    multiplier = 1_000_000;
  } else if (/\b(?:rb|ribu|k)\b/.test(normalized) || /[\d.,]+k\b/.test(normalized)) {
    multiplier = 1_000;
  }

  const numericPortion = normalized.replace(/[^\d.,-]/g, '');
  if (!numericPortion) {
    return undefined;
  }

  const separatorIndexes = [...numericPortion.matchAll(/[.,]/g)].map((match) => match.index ?? -1);
  if (separatorIndexes.length === 0) {
    const parsed = Number.parseFloat(numericPortion);
    return Number.isFinite(parsed) ? parsed * multiplier : undefined;
  }

  const lastSeparatorIndex = separatorIndexes[separatorIndexes.length - 1];
  const digitsAfterSeparator = numericPortion
    .slice(lastSeparatorIndex + 1)
    .replace(/[^\d]/g, '').length;

  const normalizedNumber =
    digitsAfterSeparator > 0 && digitsAfterSeparator <= 2
      ? `${numericPortion.slice(0, lastSeparatorIndex).replace(/[.,]/g, '')}.${numericPortion
          .slice(lastSeparatorIndex + 1)
          .replace(/[.,]/g, '')}`
      : numericPortion.replace(/[.,]/g, '');

  const parsed = Number.parseFloat(normalizedNumber);
  return Number.isFinite(parsed) ? parsed * multiplier : undefined;
}

function parseShopeeAdsMetricValue(key: ShopeeAdsMetricKey, rawValue: string) {
  const parsed = parseCompactMetricNumber(rawValue);
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
    return undefined;
  }

  if (key === 'ctr') {
    return parsed;
  }

  if (key === 'roas') {
    return Number.parseFloat(parsed.toFixed(2));
  }

  return Math.round(parsed);
}

function countShopeeAdsMetricMatches(rawValue?: string | null) {
  const normalized = normalizeText(rawValue).toLowerCase();
  if (!normalized) {
    return 0;
  }

  return Object.values(SHOPEE_ADS_METRIC_LABELS).reduce((total, aliases) => {
    return total + Number(aliases.some((alias) => normalized.includes(alias)));
  }, 0);
}

function hasShopeeAdsSummarySignature(
  rawValue: string | null | undefined,
  requiredKeys: readonly ShopeeAdsMetricKey[],
) {
  const normalized = normalizeText(rawValue).toLowerCase();
  if (!normalized) {
    return false;
  }

  return requiredKeys.every((key) =>
    SHOPEE_ADS_METRIC_LABELS[key].some((alias) => normalized.includes(alias)),
  );
}

function findShopeeAdsSummaryHeading(document: Document, pattern: RegExp) {
  const headingCandidates = Array.from(
    document.querySelectorAll<HTMLElement>('h1, h2, h3, h4'),
  ).filter(
    (element) =>
      !isLevelupManagedElement(element) &&
      pattern.test(normalizeText(element.textContent)),
  );

  if (headingCandidates[0]) {
    return headingCandidates[0];
  }

  return Array.from(document.querySelectorAll<HTMLElement>('div, span, p')).find(
    (element) =>
      !isLevelupManagedElement(element) &&
      pattern.test(normalizeText(element.textContent)),
  );
}

function findShopeeAdsSummaryRoot(
  document: Document,
  pattern: RegExp,
  requiredKeys: readonly ShopeeAdsMetricKey[],
) {
  const heading = findShopeeAdsSummaryHeading(document, pattern);
  if (heading) {
    let current: HTMLElement | null = heading.parentElement;
    while (current && current !== document.body) {
      const text = normalizeText(current.textContent);
      if (
        text.length >= 80 &&
        text.length <= 7000 &&
        hasShopeeAdsSummarySignature(text, requiredKeys)
      ) {
        return current;
      }

      current = current.parentElement;
    }
  }

  let bestCandidate: HTMLElement | null = null;
  let bestScore = -1;
  let bestTextLength = Number.POSITIVE_INFINITY;

  for (const candidate of Array.from(document.querySelectorAll<HTMLElement>('main, section, div'))) {
    if (isLevelupManagedElement(candidate)) {
      continue;
    }

    const text = normalizeText(candidate.textContent);
    if (text.length < 80 || text.length > 7000) {
      continue;
    }

    const score = countShopeeAdsMetricMatches(text);
    if (
      score > bestScore ||
      (score === bestScore &&
        hasShopeeAdsSummarySignature(text, requiredKeys) &&
        text.length < bestTextLength)
    ) {
      bestCandidate = candidate;
      bestScore = score;
      bestTextLength = text.length;
    }
  }

  return bestCandidate && hasShopeeAdsSummarySignature(bestCandidate.textContent, requiredKeys)
    ? bestCandidate
    : null;
}

function isAdsMetricValueText(value: string, aliases: readonly string[]) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized || aliases.includes(normalized)) {
    return false;
  }

  if (!/\d/.test(normalized) || normalized.length > 32) {
    return false;
  }

  if (/^\d{2}:\d{2}$/.test(normalized)) {
    return false;
  }

  return true;
}

function resolveAdsMetricCardElement(
  labelElement: HTMLElement,
  boundaryRoot: HTMLElement,
  aliases: readonly string[],
) {
  let current: HTMLElement | null = labelElement;

  while (current && current !== boundaryRoot) {
    const texts = collectLeafTextCandidates(current);
    const hasLabel = texts.some((text) => aliases.includes(text.toLowerCase()));
    const hasValue = texts.some((text) => isAdsMetricValueText(text, aliases));
    const textLength = normalizeText(current.textContent).length;

    if (hasLabel && hasValue && textLength >= 12 && textLength <= 240) {
      return current;
    }

    current = current.parentElement;
  }

  return labelElement.parentElement ?? labelElement;
}

function extractAdsMetricValueText(cardElement: HTMLElement, aliases: readonly string[]) {
  const candidates = collectLeafTextCandidates(cardElement).filter((text) =>
    isAdsMetricValueText(text, aliases),
  );

  return candidates.find((candidate) => /rp|%|k\b|m\b|jt\b|\d/i.test(candidate)) ?? candidates[0];
}

function detectShopeeAdsMetric(
  summaryRoot: HTMLElement,
  key: ShopeeAdsMetricKey,
): AdsDashboardMetricSnapshot | undefined {
  const aliases = SHOPEE_ADS_METRIC_LABELS[key];
  const labelCandidates = Array.from(
    summaryRoot.querySelectorAll<HTMLElement>('div, span, p, h1, h2, h3, h4, h5, h6'),
  )
    .filter((element) => !isLevelupManagedElement(element))
    .map((element) => ({
      element,
      text: normalizeText(element.textContent).toLowerCase(),
    }))
    .filter(({ text }) => aliases.some((alias) => text === alias))
    .sort((left, right) => left.text.length - right.text.length);

  for (const candidate of labelCandidates) {
    const cardElement = resolveAdsMetricCardElement(candidate.element, summaryRoot, aliases);
    const rawValue = extractAdsMetricValueText(cardElement, aliases);
    if (!rawValue) {
      continue;
    }

    return {
      label: normalizeText(candidate.element.textContent),
      rawValue,
      numericValue: parseShopeeAdsMetricValue(key, rawValue),
    };
  }

  return undefined;
}

function detectShopeeAdsSummary(
  document: Document,
  options: {
    headingPattern: RegExp;
    requiredKeys: readonly ShopeeAdsMetricKey[];
    metricKeys: readonly ShopeeAdsMetricKey[];
  },
): ShopeeAdsDashboardSnapshot | undefined {
  const summaryRoot = findShopeeAdsSummaryRoot(
    document,
    options.headingPattern,
    options.requiredKeys,
  );
  if (!summaryRoot) {
    return undefined;
  }

  const snapshot: ShopeeAdsDashboardSnapshot = {};
  for (const key of options.metricKeys) {
    const metric = detectShopeeAdsMetric(summaryRoot, key);
    if (metric) {
      snapshot[key] = metric;
    }
  }

  return Object.values(snapshot).some(Boolean) ? snapshot : undefined;
}

function detectShopeeAdsDashboard(document: Document): ShopeeAdsDashboardSnapshot | undefined {
  return detectShopeeAdsSummary(document, {
    headingPattern: /semua performa iklan produk|performa iklan/i,
    requiredKeys: SHOPEE_ADS_DASHBOARD_REQUIRED_METRIC_KEYS,
    metricKeys: ['impressions', 'clicks', 'orders', 'revenue', 'adSpend', 'roas'],
  });
}

function detectShopeeAdsProductTitle(document: Document) {
  const excludedPatterns = [
    /^rincian iklan produk$/i,
    /^riwayat pengaturan iklan$/i,
    /^performa$/i,
    /^rincian performa$/i,
    /^diagnosis$/i,
    /^proteksi roas$/i,
    /^modal$/i,
    /^mode bidding$/i,
    /^akselerasi performa$/i,
    /^hari ini/i,
    /^tidak terbatas$/i,
    /^tak terbatas$/i,
  ];

  const isValidCandidate = (text: string) =>
    text.length >= 8 &&
    text.length <= 160 &&
    !excludedPatterns.some((pattern) => pattern.test(text)) &&
    !/rp\d|%|\+\d|gmt\+7/i.test(text) &&
    !/(beranda|iklan shopee|rincian iklan produk)/i.test(text);

  const linkedProductTitle = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[href*="/portal/product/"]'),
  )
    .map((element) => normalizeText(element.textContent))
    .find(isValidCandidate);

  if (linkedProductTitle) {
    return linkedProductTitle;
  }

  const candidates = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3, div, span, p'))
    .filter((element) => !isLevelupManagedElement(element))
    .map((element) => normalizeText(element.textContent))
    .filter(isValidCandidate);

  return candidates[0];
}

function detectShopeeAdsProductDetail(
  document: Document,
  url: URL,
): {
  productDetail?: ProductDetailSnapshot;
  adsDashboard?: ShopeeAdsDashboardSnapshot;
} {
  const adsDashboard = detectShopeeAdsSummary(document, {
    headingPattern: /^performa$|performa/i,
    requiredKeys: SHOPEE_ADS_PRODUCT_DETAIL_REQUIRED_METRIC_KEYS,
    metricKeys: ['impressions', 'clicks', 'ctr', 'unitsSold', 'revenue', 'adSpend', 'roas'],
  });
  const productLink = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find((link) =>
    /\/portal\/product\//i.test(link.getAttribute('href') || ''),
  );
  const productUrl = productLink
    ? new URL(productLink.getAttribute('href') || '', url.origin).toString()
    : url.toString();
  const productTitle = detectShopeeAdsProductTitle(document) ?? 'Produk Shopee';

  return {
    productDetail: {
      productTitle,
      productUrl,
      shopName: null,
      highlights: [],
    },
    adsDashboard,
  };
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return undefined;
}

function normalizeShopeePriceValue(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  // Shopee payloads often store IDR prices in 1/100000 units.
  return value >= 10000000 ? Math.round(value / 100000) : Math.round(value);
}

function formatCountHint(value: number, suffix: string) {
  return `${value.toLocaleString('id-ID')} ${suffix}`;
}

function formatCompactCurrencyLabel(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  if (value >= 1_000_000_000) {
    return `Rp${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }

  if (value >= 1_000_000) {
    return `Rp${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}JT`;
  }

  return `Rp${Math.round(value).toLocaleString('id-ID')}`;
}

function formatListingAgeHint(timestampSeconds?: number) {
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

function decodeScriptString(rawValue: string) {
  try {
    return JSON.parse(`"${rawValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`) as string;
  } catch {
    return rawValue
      .replace(/\\u002F/gi, '/')
      .replace(/\\u0026/gi, '&')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
}

function matchScriptValue(scriptText: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = scriptText.match(pattern);
    const value = normalizeText(match?.[1]);
    if (value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function extractShopeeProductDataFromScripts(document: Document, url: URL) {
  const scriptText = Array.from(document.scripts)
    .map((script) => script.textContent ?? '')
    .filter((text) => text.length > 0)
    .join('\n');

  if (!scriptText) {
    return null;
  }

  const shopName = matchScriptValue(scriptText, [
    /"shop_name"\s*:\s*"([^"]+)"/i,
    /"username"\s*:\s*"([^"]+)"/i,
  ]);
  const priceMinRaw = matchScriptValue(scriptText, [
    /"price_min"\s*:\s*"?(\d+)"?/i,
    /"price"\s*:\s*"?(\d+)"?/i,
  ]);
  const priceMaxRaw = matchScriptValue(scriptText, [
    /"price_max"\s*:\s*"?(\d+)"?/i,
    /"price"\s*:\s*"?(\d+)"?/i,
  ]);
  const historicalSoldRaw = matchScriptValue(scriptText, [
    /"historical_sold"\s*:\s*(\d+)/i,
    /"item_sold"\s*:\s*(\d+)/i,
    /"sold_count"\s*:\s*(\d+)/i,
  ]);
  const monthlySoldRaw = matchScriptValue(scriptText, [
    /"sold"\s*:\s*(\d+)/i,
  ]);
  const reviewCountRaw = matchScriptValue(scriptText, [
    /"cmt_count"\s*:\s*(\d+)/i,
    /"review_count"\s*:\s*(\d+)/i,
  ]);
  const ratingRaw = matchScriptValue(scriptText, [
    /"rating_star"\s*:\s*([0-9.]+)/i,
    /"ratingValue"\s*:\s*"?([0-9.]+)"?/i,
  ]);
  const createdAtRaw = matchScriptValue(scriptText, [
    /"ctime"\s*:\s*(\d+)/i,
    /"create_time"\s*:\s*(\d+)/i,
  ]);
  const shippedFromRaw = matchScriptValue(scriptText, [
    /"shop_location"\s*:\s*"([^"]+)"/i,
    /"shopLocation"\s*:\s*"([^"]+)"/i,
  ]);
  const favoriteCountRaw = matchScriptValue(scriptText, [
    /"liked_count"\s*:\s*(\d+)/i,
    /"like_count"\s*:\s*(\d+)/i,
    /"likedCount"\s*:\s*(\d+)/i,
  ]);
  const fullImageUrl = matchScriptValue(scriptText, [
    /"image"\s*:\s*"(https?:[^"]+)"/i,
    /"image_url"\s*:\s*"(https?:[^"]+)"/i,
  ]);

  let imageUrl: string | undefined;
  const decodedImage = fullImageUrl ? decodeScriptString(fullImageUrl) : undefined;
  if (decodedImage) {
    try {
      imageUrl = new URL(decodedImage, url.origin).toString();
    } catch {
      imageUrl = undefined;
    }
  }

  const priceMin = normalizeShopeePriceValue(parseNumericLike(priceMinRaw));
  const priceMax = normalizeShopeePriceValue(parseNumericLike(priceMaxRaw));
  const soldValue = parseNumericLike(historicalSoldRaw);
  const monthlySoldValue = parseNumericLike(monthlySoldRaw);
  const reviewCount = parseNumericLike(reviewCountRaw);
  const ratingValue = ratingRaw ? Number.parseFloat(ratingRaw.replace(',', '.')) : undefined;
  const createdAt = parseNumericLike(createdAtRaw);
  const favoriteCountValue = parseNumericLike(favoriteCountRaw);
  const representativePrice =
    typeof priceMin === 'number' && typeof priceMax === 'number'
      ? Math.round((priceMin + priceMax) / 2)
      : priceMin ?? priceMax;
  const monthlyRevenue =
    typeof representativePrice === 'number' && typeof monthlySoldValue === 'number'
      ? representativePrice * monthlySoldValue
      : null;
  const totalRevenue =
    typeof representativePrice === 'number' && typeof soldValue === 'number'
      ? representativePrice * soldValue
      : null;

  return {
    shopName: shopName ? decodeScriptString(shopName) : undefined,
    imageUrl,
    priceMin,
    priceMax,
    salesHint:
      typeof soldValue === 'number' ? formatCountHint(soldValue, 'terjual') : undefined,
    monthlySoldHint:
      typeof monthlySoldValue === 'number'
        ? formatCountHint(monthlySoldValue, 'terjual/30 hari')
        : undefined,
    reviewCountHint:
      typeof reviewCount === 'number'
        ? formatCountHint(reviewCount, 'ulasan')
        : undefined,
    ratingHint:
      typeof ratingValue === 'number' && Number.isFinite(ratingValue)
        ? `${ratingValue.toString().replace('.', ',')} dari 5`
        : undefined,
    shippedFromHint: shippedFromRaw ? decodeScriptString(shippedFromRaw) : undefined,
    favoriteCountHint:
      typeof favoriteCountValue === 'number'
        ? favoriteCountValue.toLocaleString('id-ID')
        : undefined,
    totalRevenueHint: totalRevenue
      ? `± ${formatCompactCurrencyLabel(totalRevenue)} Total`
      : undefined,
    monthlyRevenueHint: monthlyRevenue
      ? `± ${formatCompactCurrencyLabel(monthlyRevenue)} /30 Hari`
      : undefined,
    listingAgeHint:
      typeof createdAt === 'number' ? formatListingAgeHint(createdAt) : undefined,
  };
}

function extractShopeeFavoriteCountHint(compactCandidates: string[]) {
  const favoriteCandidate =
    extractCompactHint(compactCandidates, /^favorit\s*\(\s*[^)]+\s*\)$/i) ??
    compactCandidates.find((candidate) => /^favorit/i.test(candidate)) ??
    null;
  if (!favoriteCandidate) {
    return undefined;
  }

  const match = favoriteCandidate.match(/\(\s*([^)]+)\s*\)/);
  return normalizeText(match?.[1]) || undefined;
}

function extractShopeeShippedFromHint(productRoot: Element) {
  const candidates = getSmallTextCandidates(
    productRoot,
    ['span', 'div', 'a'],
    { minLength: 2, maxLength: 48, limit: 80 },
  );

  const markerIndex = candidates.findIndex((candidate) =>
    /^dikirim dari$/i.test(candidate),
  );
  if (markerIndex >= 0) {
    const next = normalizeText(candidates[markerIndex + 1]);
    if (next && !/^dikirim dari$/i.test(next) && next.length >= 3) {
      return next;
    }
  }

  return undefined;
}

function extractShopeeCompetitorProducts(
  productRoot: Element,
  currentUrl: URL,
) {
  const headingCandidates = Array.from(
    productRoot.querySelectorAll<HTMLElement>('h2,h3,[role="heading"]'),
  )
    .map((element) => ({
      element,
      text: normalizeText(element.textContent),
    }))
    .filter((candidate) => candidate.text.length > 0)
    .filter((candidate) =>
      /^(produk pilihan toko|produk serupa|produk lainnya|rekomendasi|produk terkait)$/i.test(
        candidate.text,
      ),
    )
    .slice(0, 4);

  if (headingCandidates.length === 0) {
    return [];
  }

  const productLinks = new Map<string, { title: string; productUrl: string }>();
  const normalizedCurrent = currentUrl.toString();

  for (const heading of headingCandidates) {
    const container =
      heading.element.closest('section') ??
      heading.element.parentElement ??
      productRoot;
    const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'));

    for (const anchor of anchors) {
      const href = anchor.getAttribute('href');
      if (!href || !isProductHref(href)) {
        continue;
      }

      let productUrl: string;
      try {
        productUrl = new URL(href, currentUrl.origin).toString();
      } catch {
        continue;
      }

      if (productUrl === normalizedCurrent) {
        continue;
      }

      const title =
        normalizeText(anchor.getAttribute('aria-label')) ||
        normalizeText(anchor.textContent) ||
        '';
      if (title.length < 6) {
        continue;
      }

      if (!productLinks.has(productUrl)) {
        productLinks.set(productUrl, { title, productUrl });
      }
    }
  }

  return Array.from(productLinks.values()).slice(0, 6);
}

function collectJsonLdNodes(document: Document) {
  const nodes: JsonLdNode[] = [];

  for (const script of Array.from(
    document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'),
  )) {
    const raw = script.textContent?.trim();
    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const candidates = Array.isArray(parsed) ? parsed : [parsed];

      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'object') {
          continue;
        }

        if ('@graph' in candidate && Array.isArray(candidate['@graph'])) {
          for (const graphNode of candidate['@graph']) {
            if (graphNode && typeof graphNode === 'object') {
              nodes.push(graphNode as JsonLdNode);
            }
          }
          continue;
        }

        nodes.push(candidate as JsonLdNode);
      }
    } catch {
      continue;
    }
  }

  return nodes;
}

function isProductJsonLdNode(node: JsonLdNode) {
  const type = node['@type'];
  const types = Array.isArray(type) ? type : type ? [type] : [];
  return types.some((item) => /product/i.test(item));
}

function extractStructuredProductData(document: Document, url: URL) {
  const productNode = collectJsonLdNodes(document).find(isProductJsonLdNode);

  if (!productNode) {
    return null;
  }

  const offers = Array.isArray(productNode.offers)
    ? productNode.offers[0]
    : productNode.offers;
  const imageCandidate = Array.isArray(productNode.image)
    ? productNode.image[0]
    : productNode.image;
  const sellerName =
    typeof offers?.seller === 'string'
      ? offers.seller
      : offers?.seller?.name ??
        (typeof productNode.seller === 'string'
          ? productNode.seller
          : productNode.seller?.name);
  const reviewCountValue =
    productNode.aggregateRating?.reviewCount ??
    productNode.aggregateRating?.ratingCount ??
    (Array.isArray(productNode.review) ? productNode.review.length : undefined);
  const ratingValue = productNode.aggregateRating?.ratingValue;

  let imageUrl: string | undefined;
  if (typeof imageCandidate === 'string' && imageCandidate.length > 0) {
    try {
      imageUrl = new URL(imageCandidate, url.origin).toString();
    } catch {
      imageUrl = undefined;
    }
  }

  return {
    productTitle: normalizeText(productNode.name),
    imageUrl,
    shopName: normalizeText(sellerName) || null,
    priceMin:
      parseNumericLike(offers?.lowPrice) ?? parseNumericLike(offers?.price),
    priceMax:
      parseNumericLike(offers?.highPrice) ?? parseNumericLike(offers?.price),
    ratingHint:
      ratingValue !== undefined && ratingValue !== null
        ? `${String(ratingValue).replace('.', ',')} dari 5`
        : undefined,
    reviewCountHint:
      reviewCountValue !== undefined && reviewCountValue !== null
        ? `${String(reviewCountValue)} ulasan`
        : undefined,
  };
}

function detectShopeePublicProduct(
  document: Document,
  url: URL,
): ProductDetailSnapshot | null {
  const productRoot =
    document.querySelector('.page-product__content') ??
    document.querySelector('.product-briefing') ??
    document.body;

  const structuredData = extractStructuredProductData(document, url);
  const scriptedData = extractShopeeProductDataFromScripts(document, url);

  const productTitle = firstNonEmpty(
    structuredData?.productTitle,
    getFirstMetaContent(document, ['meta[property="og:title"]']),
    getFirstText(productRoot, ['h1', '[data-sqe="name"]']),
    normalizeText(document.title.replace(/\s*\|\s*Shopee.*$/i, '')),
  );

  if (!productTitle || productTitle.length < 8) {
    return null;
  }

  const shopName = firstNonEmpty(
    structuredData?.shopName,
    scriptedData?.shopName,
    getFirstText(productRoot, [
      'a[href*="/shop/"]',
      '[data-sqe="shop_name"]',
      'button[data-sqe="shop_link"]',
      '.page-product__shop a[href*="/shop/"]',
    ]),
  ) ?? null;

  const metaImage = getFirstMetaContent(document, ['meta[property="og:image"]']);
  const imageUrl =
    (() => {
      if (!metaImage) {
        return undefined;
      }

      try {
        return new URL(metaImage, url.origin).toString();
      } catch {
        return undefined;
      }
    })() ??
    structuredData?.imageUrl ??
    scriptedData?.imageUrl ??
    getFirstImageUrl(
      productRoot,
      [
        '.product-briefing img[src], .product-briefing img[data-src]',
        '.page-product__content img[src], .page-product__content img[data-src]',
        'img[src*="down-"], img[data-src*="down-"]',
        '.product-briefing img',
        '.page-product__content img',
      ],
      url,
    );

  const pricingText =
    getFirstMetaContent(document, ['meta[property="product:price:amount"]']) ??
    getFirstText(productRoot, [
      '[class*="product-price"]',
      '.pqTWkA',
      '.IZPeQz',
    ]) ??
    collectTextCandidates(productRoot).find(isLikelyPriceText);
  const domPriceRange = parsePriceRange(pricingText ?? '');
  const priceMin =
    structuredData?.priceMin ?? scriptedData?.priceMin ?? domPriceRange.priceMin;
  const priceMax =
    structuredData?.priceMax ?? scriptedData?.priceMax ?? domPriceRange.priceMax;

  const compactCandidates = getSmallTextCandidates(
    productRoot,
    ['span', 'button', 'div', 'a'],
    { minLength: 2, maxLength: 36, limit: 40 },
  );
  const salesHint =
    extractCompactHint(
      compactCandidates,
      /^\d[\d.,A-Za-z+ ]{0,18}\s*(?:terjual|sold)$/i,
    ) ??
    extractSalesHintFromText(productRoot.textContent) ??
    extractSalesHintFromText(document.body.textContent);
  const reviewCountHint =
    structuredData?.reviewCountHint ??
    scriptedData?.reviewCountHint ??
    extractCompactHint(
      compactCandidates,
      /^\d[\d.,A-Za-z+ ]{0,18}\s*(?:penilaian|ulasan|reviews?)$/i,
    );
  const ratingHint =
    structuredData?.ratingHint ??
    scriptedData?.ratingHint ??
    extractCompactHint(
      compactCandidates,
      /^\d(?:[.,]\d)?\s*(?:dari 5|\/5|bintang)$/i,
    ) ??
    compactCandidates.find((candidate) => /^\d(?:[.,]\d)?$/.test(candidate));
  const normalizedSalesHint = scriptedData?.salesHint ?? salesHint;
  const monthlySoldHint = scriptedData?.monthlySoldHint;
  const monthlyRevenueHint = scriptedData?.monthlyRevenueHint;
  const listingAgeHint = scriptedData?.listingAgeHint;
  const favoriteCountHint =
    extractShopeeFavoriteCountHint(compactCandidates) ?? scriptedData?.favoriteCountHint;
  const shippedFromHint =
    scriptedData?.shippedFromHint ?? extractShopeeShippedFromHint(productRoot);
  const competitorProducts = extractShopeeCompetitorProducts(productRoot, url);

  const highlights = compactCandidates
    .filter(
      (value) =>
        !/^(chat|beli sekarang|masukkan keranjang|voucher|garansi|laporkan|share|favorit.*|tersedia)$/i.test(
          value,
        ) &&
        !/^dengan komentar/i.test(value) &&
        !/^(dari 5|semua)$/i.test(value) &&
        !isLikelySalesText(value) &&
        !/^\d(?:[.,]\d)?$/.test(value) &&
        !/(penilaian|ulasan|reviews?)/i.test(value),
    )
    .slice(0, 6);

  return {
    productTitle,
    productUrl: url.toString(),
    imageUrl,
    shopName,
    priceMin,
    priceMax,
    salesHint: normalizedSalesHint,
    monthlySoldHint,
    ratingHint,
    reviewCountHint,
    favoriteCountHint,
    shippedFromHint,
    competitorProducts: competitorProducts.length ? competitorProducts : undefined,
    monthlyRevenueHint,
    listingAgeHint,
    highlights,
  };
}

function detectShopeePublicSearch(document: Document, url: URL) {
  const keyword = resolveSearchKeyword(document, url);
  const anchors = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[href]'),
  ).filter((anchor) => {
    const href = anchor.getAttribute('href');
    return Boolean(href && isProductHref(href));
  });

  const rawResults: Array<SearchResultPreview | null> = anchors.map((anchor) => {
    const href = anchor.getAttribute('href');
    if (!href) {
      return null;
    }

    const cardElement = findSearchCardElement(anchor);
    const title = extractProductTitle(anchor, cardElement);

    if (!title || title.length < 8) {
      return null;
    }

    const productUrl = new URL(href, url.origin).toString();
    const productIds = extractShopeeIdsFromProductUrl(productUrl);
    const { priceMin, priceMax } = extractPriceRangeFromSearchCard(cardElement);
    const ratingHint = extractRatingHintFromSearchCard(cardElement);
    const salesHint = extractSalesHintFromSearchCard(cardElement);
    const locationLabel = extractLocationLabelFromSearchCard(cardElement, title);
    const deliveryHint = extractDeliveryHintFromSearchCard(cardElement);
    const shopName = extractShopName(cardElement, title) ?? locationLabel ?? null;

    return {
      position: 0,
      productTitle: title,
      productUrl,
      shopId: productIds?.shopId,
      itemId: productIds?.itemId,
      imageUrl: extractProductImageUrl(anchor, cardElement, url),
      shopName,
      locationLabel,
      priceMin,
      priceMax,
      salesHint,
      ratingHint,
      deliveryHint,
    } satisfies SearchResultPreview;
  });

  const results = uniqueResults(rawResults.filter(isSearchResultPreview))
    .slice(0, MAX_SEARCH_RESULTS_PREVIEW)
    .map((result, index) => ({
      ...result,
      position: index + 1,
    }));

  return {
    pageType: 'shopee_public_search' as const,
    captureMode: 'public' as const,
    marketplace: 'shopee' as const,
    keyword,
    statusMessage: keyword
      ? `Shopee public search terdeteksi untuk keyword "${keyword}" dengan ${results.length} hasil preview.`
      : `Shopee public search terdeteksi dengan ${results.length} hasil preview.`,
    resultsPreview: results,
  };
}

function detectPageType(url: URL): {
  pageType: PageType;
  captureMode: CaptureMode | null;
  marketplace: Marketplace;
  statusMessage: string;
} {
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();

  if (hostname.endsWith('shopee.co.id')) {
    if (pathname === '/search' || url.searchParams.has('keyword') || url.searchParams.has('q')) {
      return {
        pageType: 'shopee_public_search',
        captureMode: 'public',
        marketplace: 'shopee',
        statusMessage: 'Shopee public search page terdeteksi.',
      };
    }

    if (hostname.includes('seller') && pathname.includes('/portal/marketing/pas/product/')) {
      return {
        pageType: 'shopee_ads_product_detail',
        captureMode: 'owned',
        marketplace: 'shopee',
        statusMessage: 'Shopee ads product detail terdeteksi.',
      };
    }

    if (
      hostname.includes('seller') &&
      (pathname.startsWith('/portal/product') || pathname.startsWith('/product'))
    ) {
      return {
        pageType: 'shopee_seller_product_page',
        captureMode: 'owned',
        marketplace: 'shopee',
        statusMessage: 'Shopee seller product page terdeteksi.',
      };
    }

    if (isProductHref(pathname)) {
      return {
        pageType: 'shopee_public_product',
        captureMode: 'public',
        marketplace: 'shopee',
        statusMessage: 'Shopee public product page terdeteksi.',
      };
    }

    if (hostname.includes('seller') && (pathname.includes('ads') || pathname.includes('marketing'))) {
      return {
        pageType: 'shopee_ads_dashboard',
        captureMode: 'owned',
        marketplace: 'shopee',
        statusMessage: 'Shopee ads dashboard terdeteksi.',
      };
    }
  }

  if (hostname.includes('tiktok.com')) {
    if (hostname.includes('ads') || pathname.includes('ads')) {
      return {
        pageType: 'tiktok_ads_dashboard',
        captureMode: 'owned',
        marketplace: 'tiktok_shop',
        statusMessage: 'TikTok ads dashboard terdeteksi.',
      };
    }

    if (pathname.includes('search') || url.searchParams.has('q')) {
      return {
        pageType: 'tiktok_public_search',
        captureMode: 'public',
        marketplace: 'tiktok_shop',
        statusMessage: 'TikTok public search terdeteksi.',
      };
    }
  }

  return {
    pageType: 'unknown',
    captureMode: null,
    marketplace: 'unknown',
    statusMessage: 'Halaman belum didukung parser v1.',
  };
}

export function detectPageSnapshot(document: Document) {
  const url = new URL(window.location.href);
  const baseDetection = detectPageType(url);
  const snapshot: PageSnapshot = {
    url: url.toString(),
    title: document.title,
    detectedAt: new Date().toISOString(),
    pageType: baseDetection.pageType,
    captureMode: baseDetection.captureMode,
    marketplace: baseDetection.marketplace,
    statusMessage: baseDetection.statusMessage,
    resultsPreview: [],
  };

  if (baseDetection.pageType === 'shopee_public_search') {
    const detail = detectShopeePublicSearch(document, url);
    snapshot.keyword = detail.keyword;
    snapshot.resultsPreview = detail.resultsPreview;
    snapshot.statusMessage = detail.statusMessage;
  }

  if (baseDetection.pageType === 'shopee_public_product') {
    const detail = detectShopeePublicProduct(document, url);
    if (detail) {
      snapshot.productDetail = detail;
      snapshot.statusMessage = detail.shopName
        ? `Produk Shopee terdeteksi dari toko ${detail.shopName}.`
        : 'Produk Shopee publik terdeteksi.';
    }
  }

  if (baseDetection.pageType === 'shopee_ads_dashboard') {
    const adsDashboard = detectShopeeAdsDashboard(document);
    if (adsDashboard) {
      const detectedMetricCount = Object.values(adsDashboard).filter(Boolean).length;
      snapshot.adsDashboard = adsDashboard;
      snapshot.statusMessage = `Shopee ads dashboard terdeteksi dengan ${detectedMetricCount} metrik ringkasan.`;
    }
  }

  if (baseDetection.pageType === 'shopee_ads_product_detail') {
    const detail = detectShopeeAdsProductDetail(document, url);
    if (detail.productDetail) {
      snapshot.productDetail = detail.productDetail;
    }
    if (detail.adsDashboard) {
      const detectedMetricCount = Object.values(detail.adsDashboard).filter(Boolean).length;
      snapshot.adsDashboard = detail.adsDashboard;
      snapshot.statusMessage = `Shopee ads product detail terdeteksi dengan ${detectedMetricCount} metrik performa.`;
    }
  }

  return snapshot;
}
