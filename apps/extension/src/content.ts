import { detectPageSnapshot } from './detection';
import type {
  BackgroundMessage,
  DetectionMessage,
  ExtensionState,
  PageSnapshot,
} from './types';

let lastUrl = window.location.href;
let lastSnapshot: PageSnapshot | null = null;
let lastKnownState: ExtensionState | null = null;
let mutationObserver: MutationObserver | null = null;
let refreshTimeoutId: number | null = null;
let visibleResultCount = 10;
let lastResultsSignature = '';
let isCompactMode = true;

const OVERLAY_ID = 'levelup-adspro-market-overlay';
const OVERLAY_STYLE_ID = 'levelup-adspro-market-overlay-style';
const INITIAL_VISIBLE_RESULTS = 10;
const LOAD_MORE_STEP = 10;

type BackgroundResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

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

function getResultsSignature(snapshot: PageSnapshot) {
  return [
    snapshot.pageType,
    snapshot.keyword ?? '',
    ...snapshot.resultsPreview.map((result) => result.productUrl),
  ].join('|');
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

function collectMedianPrice(results: PageSnapshot['resultsPreview']) {
  const normalizedPrices = results
    .map((result) => {
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
    })
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);

  if (normalizedPrices.length === 0) {
    return '-';
  }

  const middleIndex = Math.floor(normalizedPrices.length / 2);
  const median =
    normalizedPrices.length % 2 === 0
      ? Math.round(
          (normalizedPrices[middleIndex - 1] + normalizedPrices[middleIndex]) /
            2,
        )
      : normalizedPrices[middleIndex];

  return formatCurrency(median);
}

function countResultsWithSalesSignal(results: PageSnapshot['resultsPreview']) {
  return results.filter((result) => normalizeText(result.salesHint).length > 0)
    .length;
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
    anchor.closest('[data-sqe="item"], [data-sqe="itemCard"], li, article') ??
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

function getShopeeSpecificHost() {
  const productGrid = document.querySelector(
    '.shopee-search-item-result__items',
  );
  const sortBar = document.querySelector('.shopee-sort-bar');
  const searchResultRoot =
    productGrid?.closest('.shopee-search-item-result') ??
    sortBar?.parentElement ??
    null;

  if (productGrid) {
    return {
      parent: productGrid,
      before: productGrid.firstChild,
      layoutMode: 'grid' as const,
    };
  }

  if (searchResultRoot && sortBar) {
    return {
      parent: searchResultRoot,
      before: sortBar.nextSibling ?? searchResultRoot.firstChild,
      layoutMode: 'block' as const,
    };
  }

  return null;
}

function getOverlayHost() {
  const shopeeHost = getShopeeSpecificHost();
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
      font-size: 16px;
      font-weight: 700;
      color: #111827;
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
      font-weight: 700;
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
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #9a3412;
    }

    #${OVERLAY_ID} .levelup-card-value {
      margin-top: 8px;
      font-size: 18px;
      font-weight: 800;
      color: #111827;
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

    #${OVERLAY_ID} .levelup-preview-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    #${OVERLAY_ID} .levelup-preview-pill {
      display: inline-flex;
      max-width: 100%;
      align-items: center;
      border-radius: 999px;
      padding: 6px 10px;
      background: rgba(251, 106, 53, 0.08);
      color: #7c2d12;
      font-size: 11px;
      line-height: 1.4;
    }

    #${OVERLAY_ID} .levelup-preview-pill span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #${OVERLAY_ID} .levelup-button {
      border: none;
      border-radius: 999px;
      padding: 9px 14px;
      font-size: 12px;
      font-weight: 700;
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
    }

    #${OVERLAY_ID} .levelup-result-thumb {
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

    #${OVERLAY_ID} .levelup-result-meta {
      font-size: 11px;
      line-height: 1.5;
      color: #6b7280;
    }

    @media (max-width: 960px) {
      #${OVERLAY_ID} .levelup-stats {
        grid-template-columns: 1fr;
      }

      #${OVERLAY_ID} .levelup-results {
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      }
    }
  `;

  document.head.appendChild(style);
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

function renderOverlay(snapshot: PageSnapshot) {
  if (
    snapshot.pageType !== 'shopee_public_search' ||
    snapshot.captureMode !== 'public'
  ) {
    removeOverlay();
    return;
  }

  ensureOverlayStyle();

  const currentSignature = getResultsSignature(snapshot);
  if (currentSignature !== lastResultsSignature) {
    visibleResultCount = INITIAL_VISIBLE_RESULTS;
    lastResultsSignature = currentSignature;
  }

  const totalResults = snapshot.resultsPreview.length;
  const displayedResults = snapshot.resultsPreview.slice(0, visibleResultCount);
  const compactPreviewResults = snapshot.resultsPreview.slice(0, 3);
  const canLoadMore = displayedResults.length < totalResults;
  const uniqueShops = getUniqueShopCount(snapshot.resultsPreview);
  const priceSummary = collectPriceSummary(snapshot.resultsPreview);
  const medianPrice = collectMedianPrice(snapshot.resultsPreview);
  const salesSignalCount = countResultsWithSalesSignal(snapshot.resultsPreview);
  const minPrice = collectMinPrice(snapshot.resultsPreview);
  const maxPrice = collectMaxPrice(snapshot.resultsPreview);
  const statusLabel = lastKnownState?.lastSync.message ?? snapshot.statusMessage;
  const keywordLabel = snapshot.keyword?.trim() || '(keyword belum terbaca)';
  const overlay = document.getElementById(OVERLAY_ID) ?? document.createElement('section');

  overlay.id = OVERLAY_ID;
  overlay.innerHTML = `
    <div class="levelup-header">
      <div>
        <div class="levelup-title">Riset Market | LevelUP adsPRO</div>
        <div class="levelup-subtitle">Kata kunci: ${keywordLabel}</div>
        <div class="levelup-status">${statusLabel}</div>
      </div>
      <div class="levelup-chip">Pencarian Shopee</div>
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
          <div class="levelup-card-label">Toko Terdeteksi</div>
          <div class="levelup-card-value">${uniqueShops}</div>
        </div>
        <div class="levelup-card">
          <div class="levelup-card-label">Ada Sinyal Terjual</div>
          <div class="levelup-card-value">${salesSignalCount}</div>
        </div>
      </div>
      <div class="levelup-actions">
        <button type="button" class="levelup-button levelup-button-primary" data-action="sync">Sinkronkan Sekarang</button>
        <button type="button" class="levelup-button levelup-button-secondary" data-action="refresh">Muat Ulang Parser</button>
        <button type="button" class="levelup-button levelup-button-secondary" data-action="toggle-mode">${isCompactMode ? 'Buka Mode Penuh' : 'Kembali ke Mode Ringkas'}</button>
        ${
          !isCompactMode && canLoadMore
            ? `<button type="button" class="levelup-button levelup-button-ghost" data-action="load-more">Muat Lebih Banyak</button>`
            : ''
        }
      </div>
      <div class="levelup-summary">
        <span><strong>Median harga:</strong> ${medianPrice}</span>
        <span><strong>Harga termurah:</strong> ${minPrice}</span>
        <span><strong>Harga tertinggi:</strong> ${maxPrice}</span>
        <span><strong>Insight:</strong> ${salesSignalCount > 0 ? `${salesSignalCount} produk punya sinyal terjual.` : 'Belum ada sinyal terjual yang terbaca.'}</span>
      </div>
      <div class="levelup-note">Mode public research aktif. Shop default tidak dipakai untuk sync halaman pencarian publik.</div>
      ${
        isCompactMode
          ? `<div class="levelup-preview-strip">
              ${compactPreviewResults
                .map((result) => {
                  const cleanTitle = cleanProductTitle(result.productTitle);
                  return `<div class="levelup-preview-pill"><span>${result.position}. ${cleanTitle}</span></div>`;
                })
                .join('')}
            </div>`
          : `<div class="levelup-results">
        ${displayedResults
          .map((result) => {
            const cleanTitle = cleanProductTitle(result.productTitle);
            const meta = [
              result.shopName,
              typeof result.priceMin === 'number'
                ? result.priceMin === result.priceMax
                  ? formatCurrency(result.priceMin)
                  : `${formatCurrency(result.priceMin)} - ${formatCurrency(result.priceMax)}`
                : null,
              result.salesHint,
            ]
              .filter(Boolean)
              .join(' | ');

            return `
              <div class="levelup-result">
                <div class="levelup-result-thumb">
                  ${
                    result.imageUrl
                      ? `<img src="${result.imageUrl}" alt="${cleanTitle}" loading="lazy" referrerpolicy="no-referrer" />`
                      : ''
                  }
                </div>
                <div class="levelup-result-rank">Urutan ${result.position}</div>
                <div class="levelup-result-title">${cleanTitle}</div>
                <div class="levelup-result-shop">${result.shopName || 'Toko belum terbaca'}</div>
                <div class="levelup-result-meta">${meta || 'Belum ada metadata tambahan.'}</div>
              </div>
            `;
          })
          .join('')}
      </div>`
      }
    </div>
  `;

  const { parent, before, layoutMode } = getOverlayHost();
  overlay.dataset.layoutMode = layoutMode;
  const shouldMoveOverlay =
    !overlay.isConnected ||
    overlay.parentElement !== parent ||
    (before instanceof Node && overlay.nextSibling !== before);

  if (shouldMoveOverlay) {
    parent.insertBefore(overlay, before);
  }

  const syncButton = overlay.querySelector<HTMLButtonElement>(
    '[data-action="sync"]',
  );
  const refreshButton = overlay.querySelector<HTMLButtonElement>(
    '[data-action="refresh"]',
  );
  const toggleModeButton = overlay.querySelector<HTMLButtonElement>(
    '[data-action="toggle-mode"]',
  );
  const loadMoreButton = overlay.querySelector<HTMLButtonElement>(
    '[data-action="load-more"]',
  );

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

  toggleModeButton?.addEventListener('click', () => {
    isCompactMode = !isCompactMode;

    if (lastSnapshot) {
      renderOverlay(lastSnapshot);
    }
  });

  loadMoreButton?.addEventListener('click', () => {
    visibleResultCount = Math.min(
      totalResults,
      visibleResultCount + LOAD_MORE_STEP,
    );

    if (lastSnapshot) {
      renderOverlay(lastSnapshot);
    }
  });
}

async function sendSnapshot() {
  const payload = detectPageSnapshot(document);
  lastSnapshot = payload;
  renderOverlay(payload);

  try {
    await chrome.runtime.sendMessage({
      type: 'PAGE_SNAPSHOT_UPDATED',
      payload,
    } satisfies DetectionMessage);
  } catch (error) {
    if (!isIgnorableRuntimeError(error)) {
      throw error;
    }
  }
}

function queueRefresh() {
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
