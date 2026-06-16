import {
  createExtensionSession,
  createIngestionBatch,
  listShops,
  login,
  sendHeartbeat,
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
  PageSnapshot,
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

async function createSessionBundle(
  apiBaseUrl: string,
  authSession: AuthSession,
  shopId?: string | null,
) {
  const shops = await listShops(apiBaseUrl, authSession.accessToken);
  const selectedShop =
    shopId && shops.some((shop) => shop.id === shopId) ? shopId : null;
  const extensionSession = await createExtensionSession(
    apiBaseUrl,
    authSession.accessToken,
    {
      deviceLabel: getDeviceLabel(),
      extensionVersion: EXTENSION_VERSION,
      ...(selectedShop ? { shopId: selectedShop } : {}),
    },
  );

  await patchExtensionState({
    apiBaseUrl,
    authSession,
    shops,
    selectedShopId: selectedShop,
    extensionSession,
    lastSync: {
      status: 'idle',
      message: 'Login extension berhasil. Siap untuk sync.',
      at: new Date().toISOString(),
    },
  });
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
              ratingHint: snapshot.productDetail?.ratingHint,
              reviewCountHint: snapshot.productDetail?.reviewCountHint,
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
              imageUrl: result.imageUrl,
              shopName: result.shopName,
              priceMin: result.priceMin,
              priceMax: result.priceMax,
              salesHint: result.salesHint,
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
  const state = await getExtensionState();
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

async function handleHeartbeat() {
  const state = await getExtensionState();
  if (!state.extensionSession) {
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

chrome.runtime.onMessage.addListener((message: BackgroundMessage | DetectionMessage) => {
  if (message.type === 'PAGE_SNAPSHOT_UPDATED') {
    void patchExtensionState({
      lastPage: message.payload,
    });
    return false;
  }

  return true;
});

chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
  const run = async () => {
    switch (message.type) {
      case 'GET_STATE':
        return getExtensionState();
      case 'LOGIN':
        return handleLogin(message);
      case 'LOGOUT':
        return handleLogout();
      case 'SET_SELECTED_SHOP':
        return handleSetSelectedShop(message);
      case 'REFRESH_ACTIVE_TAB':
        await refreshActiveTabSnapshot();
        return getExtensionState();
      case 'SYNC_NOW':
        return handleSyncNow();
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
