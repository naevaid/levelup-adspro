import type {
  CaptureMode,
  Marketplace,
  PageSnapshot,
  PageType,
  SearchResultPreview,
} from './types';

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

function detectShopeePublicSearch(document: Document, url: URL) {
  const keyword =
    url.searchParams.get('keyword') ??
    url.searchParams.get('q') ??
    undefined;
  const anchors = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[href*="/product/"]'),
  );

  const rawResults: Array<SearchResultPreview | null> = anchors.map(
    (anchor, index) => {
        const title =
          anchor.getAttribute('aria-label') ??
          anchor.textContent?.replace(/\s+/g, ' ').trim() ??
          '';

        if (!title || title.length < 8) {
          return null;
        }

        const cardText =
          anchor.closest('section, div')?.textContent?.replace(/\s+/g, ' ') ?? '';
        const { priceMin, priceMax } = parsePriceRange(cardText);
        const salesHintMatch =
          cardText.match(/(\d[\d.,A-Za-z+ ]*terjual)/i) ??
          cardText.match(/(\d[\d.,A-Za-z+ ]*sold)/i);

        return {
          position: index + 1,
          productTitle: title,
          productUrl: new URL(anchor.getAttribute('href') ?? '/', url.origin).toString(),
          shopName: null,
          priceMin,
          priceMax,
          salesHint: salesHintMatch?.[1],
        } satisfies SearchResultPreview;
      },
  );

  const results = uniqueResults(rawResults.filter(isSearchResultPreview)).slice(0, 8);

  return {
    pageType: 'shopee_public_search' as const,
    captureMode: 'public' as const,
    marketplace: 'shopee' as const,
    keyword,
    statusMessage: keyword
      ? `Shopee public search terdeteksi untuk keyword "${keyword}".`
      : 'Shopee public search terdeteksi.',
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
