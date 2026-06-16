import type {
  CaptureMode,
  Marketplace,
  PageSnapshot,
  PageType,
  SearchResultPreview,
} from './types';

function normalizeText(rawValue?: string | null) {
  return rawValue?.replace(/\s+/g, ' ').trim() ?? '';
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
  return rawHref.includes('/product/') || /-i\.\d+\.\d+/i.test(rawHref);
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
    ).flatMap((element) => {
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
    const cardText = normalizeText(cardElement.textContent);
    const { priceMin, priceMax } = parsePriceRange(cardText);
    const salesHintMatch =
      cardText.match(/(\d[\d.,A-Za-z+ ]*terjual)/i) ??
      cardText.match(/(\d[\d.,A-Za-z+ ]*sold)/i);

    return {
      position: 0,
      productTitle: title,
      productUrl,
      imageUrl: extractProductImageUrl(anchor, cardElement, url),
      shopName: extractShopName(cardElement, title),
      priceMin,
      priceMax,
      salesHint: salesHintMatch?.[1],
    } satisfies SearchResultPreview;
  });

  const results = uniqueResults(rawResults.filter(isSearchResultPreview))
    .slice(0, 10)
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

    if (hostname.includes('seller') && (pathname.includes('ads') || pathname.includes('marketing'))) {
      return {
        pageType: 'shopee_ads_dashboard',
        captureMode: 'owned',
        marketplace: 'shopee',
        statusMessage: 'Shopee ads dashboard terdeteksi.',
      };
    }

    if (hostname.includes('seller') && pathname.includes('product')) {
      return {
        pageType: 'shopee_seller_product_page',
        captureMode: 'owned',
        marketplace: 'shopee',
        statusMessage: 'Shopee seller product page terdeteksi.',
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

  return snapshot;
}
