import { DEFAULT_API_BASE_URL } from './constants';
import type { BackgroundMessage, ExtensionState, ShopSummary } from './types';

type BackgroundResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

const loginPanel = document.querySelector<HTMLElement>('#login-panel');
const dashboardPanel = document.querySelector<HTMLElement>('#dashboard-panel');
const loginForm = document.querySelector<HTMLFormElement>('#login-form');
const apiBaseUrlInput = document.querySelector<HTMLInputElement>('#api-base-url');
const emailInput = document.querySelector<HTMLInputElement>('#email');
const passwordInput = document.querySelector<HTMLInputElement>('#password');
const togglePasswordButton = document.querySelector<HTMLButtonElement>(
  '#toggle-password-button',
);
const authSummary = document.querySelector<HTMLElement>('#auth-summary');
const organizationName = document.querySelector<HTMLElement>('#organization-name');
const userEmail = document.querySelector<HTMLElement>('#user-email');
const sessionStatus = document.querySelector<HTMLElement>('#session-status');
const lastSyncAt = document.querySelector<HTMLElement>('#last-sync-at');
const shopSelect = document.querySelector<HTMLSelectElement>('#shop-select');
const pageType = document.querySelector<HTMLElement>('#page-type');
const captureMode = document.querySelector<HTMLElement>('#capture-mode');
const marketplace = document.querySelector<HTMLElement>('#marketplace');
const keyword = document.querySelector<HTMLElement>('#keyword');
const pageStatus = document.querySelector<HTMLElement>('#page-status');
const pageUrl = document.querySelector<HTMLElement>('#page-url');
const resultsList = document.querySelector<HTMLUListElement>('#results-list');
const activityMessage = document.querySelector<HTMLElement>('#activity-message');
const logoutButton = document.querySelector<HTMLButtonElement>('#logout-button');
const refreshPageButton = document.querySelector<HTMLButtonElement>('#refresh-page-button');
const syncNowButton = document.querySelector<HTMLButtonElement>('#sync-now-button');

async function sendMessage<T>(message: BackgroundMessage) {
  const response = (await chrome.runtime.sendMessage(
    message,
  )) as BackgroundResponse<T>;

  if (!response.ok) {
    throw new Error(response.error ?? 'Extension request gagal.');
  }

  return response.data as T;
}

function setBusyState(busy: boolean) {
  for (const element of [
    loginForm,
    logoutButton,
    refreshPageButton,
    syncNowButton,
    shopSelect,
  ]) {
    if (!element) {
      continue;
    }

    if ('disabled' in element) {
      element.disabled = busy;
    }
  }
}

function renderShopOptions(shops: ShopSummary[], selectedShopId: string | null) {
  if (!shopSelect) {
    return;
  }

  shopSelect.innerHTML = '';

  const noneOption = document.createElement('option');
  noneOption.value = '';
  noneOption.textContent = 'Tanpa shop default';
  shopSelect.appendChild(noneOption);

  for (const shop of shops) {
    const option = document.createElement('option');
    option.value = shop.id;
    option.textContent = `${shop.marketplace.name} - ${shop.name ?? shop.externalId}`;
    shopSelect.appendChild(option);
  }

  shopSelect.value = selectedShopId ?? '';
}

function renderResultsList(state: ExtensionState) {
  if (!resultsList) {
    return;
  }

  resultsList.innerHTML = '';

  const results = state.lastPage?.resultsPreview ?? [];
  if (results.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'Belum ada preview hasil parser.';
    resultsList.appendChild(item);
    return;
  }

  for (const result of results) {
    const priceLabel =
      typeof result.priceMin === 'number' && typeof result.priceMax === 'number'
        ? result.priceMin === result.priceMax
          ? `Rp${result.priceMin.toLocaleString('id-ID')}`
          : `Rp${result.priceMin.toLocaleString('id-ID')} - Rp${result.priceMax.toLocaleString('id-ID')}`
        : typeof result.priceMin === 'number'
          ? `Rp${result.priceMin.toLocaleString('id-ID')}`
          : null;

    const meta = [result.shopName, priceLabel, result.salesHint].filter(Boolean);
    const item = document.createElement('li');
    item.textContent =
      meta.length > 0
        ? `${result.position}. ${result.productTitle} | ${meta.join(' | ')}`
        : `${result.position}. ${result.productTitle}`;
    resultsList.appendChild(item);
  }
}

function renderState(state: ExtensionState) {
  if (apiBaseUrlInput) {
    apiBaseUrlInput.value = state.apiBaseUrl || DEFAULT_API_BASE_URL;
  }

  const isLoggedIn = Boolean(state.authSession && state.extensionSession);
  loginPanel?.classList.toggle('hidden', isLoggedIn);
  dashboardPanel?.classList.toggle('hidden', !isLoggedIn);

  if (authSummary) {
    authSummary.textContent = isLoggedIn
      ? 'Login extension aktif dan siap sync.'
      : 'Login dengan akun LevelUP adsPRO untuk membuat extension session.';
  }

  organizationName!.textContent = state.authSession?.activeOrganization.name ?? '-';
  userEmail!.textContent = state.authSession?.user.email ?? '-';
  sessionStatus!.textContent = state.extensionSession
    ? `Aktif hingga ${new Date(state.extensionSession.expiresAt).toLocaleString()}`
    : '-';
  lastSyncAt!.textContent = state.lastSync.at
    ? new Date(state.lastSync.at).toLocaleString()
    : '-';

  pageType!.textContent = state.lastPage?.pageType ?? 'unknown';
  captureMode!.textContent = state.lastPage?.captureMode ?? '-';
  marketplace!.textContent = state.lastPage?.marketplace ?? '-';
  keyword!.textContent = state.lastPage?.keyword ?? '-';
  pageStatus!.textContent = state.lastPage?.statusMessage ?? 'Belum ada snapshot halaman.';
  pageUrl!.textContent = state.lastPage?.url ?? '-';
  activityMessage!.textContent = state.lastSync.message;

  renderShopOptions(state.shops, state.selectedShopId);
  renderResultsList(state);
}

async function refreshState() {
  const state = await sendMessage<ExtensionState>({ type: 'GET_STATE' });
  renderState(state);
}

function getEyeIconMarkup(visible: boolean) {
  return visible
    ? `
      <svg
        class="icon-eye"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 3l18 18" />
        <path d="M10.58 10.58A2 2 0 0 0 12 16c.49 0 .94-.18 1.28-.49" />
        <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-4.24 5.19" />
        <path d="M6.71 6.7A17.7 17.7 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.29-1.52" />
      </svg>
    `
    : `
      <svg
        class="icon-eye"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    `;
}

function setPasswordVisibility(visible: boolean) {
  if (!passwordInput || !togglePasswordButton) {
    return;
  }

  passwordInput.type = visible ? 'text' : 'password';
  togglePasswordButton.setAttribute('aria-pressed', visible ? 'true' : 'false');
  togglePasswordButton.setAttribute(
    'aria-label',
    visible ? 'Sembunyikan password' : 'Lihat password',
  );
  togglePasswordButton.title = visible
    ? 'Sembunyikan password'
    : 'Lihat password';
  togglePasswordButton.innerHTML = getEyeIconMarkup(visible);
}

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setBusyState(true);

  try {
    const state = await sendMessage<ExtensionState>({
      type: 'LOGIN',
      payload: {
        apiBaseUrl: apiBaseUrlInput?.value.trim() || DEFAULT_API_BASE_URL,
        email: emailInput?.value.trim() ?? '',
        password: passwordInput?.value ?? '',
      },
    });
    passwordInput!.value = '';
    setPasswordVisibility(false);
    renderState(state);
  } catch (error) {
    activityMessage!.textContent =
      error instanceof Error ? error.message : 'Login extension gagal.';
  } finally {
    setBusyState(false);
  }
});

togglePasswordButton?.addEventListener('click', () => {
  if (!passwordInput) {
    return;
  }

  setPasswordVisibility(passwordInput.type === 'password');
});

logoutButton?.addEventListener('click', async () => {
  setBusyState(true);
  try {
    const state = await sendMessage<ExtensionState>({ type: 'LOGOUT' });
    renderState(state);
  } finally {
    setBusyState(false);
  }
});

refreshPageButton?.addEventListener('click', async () => {
  setBusyState(true);
  try {
    const state = await sendMessage<ExtensionState>({
      type: 'REFRESH_ACTIVE_TAB',
    });
    renderState(state);
  } catch (error) {
    activityMessage!.textContent =
      error instanceof Error ? error.message : 'Gagal refresh page state.';
  } finally {
    setBusyState(false);
  }
});

syncNowButton?.addEventListener('click', async () => {
  setBusyState(true);
  try {
    const response = await sendMessage<{ batchId: string; state: ExtensionState }>({
      type: 'SYNC_NOW',
    });
    renderState(response.state);
  } catch (error) {
    activityMessage!.textContent =
      error instanceof Error ? error.message : 'Sync gagal.';
  } finally {
    setBusyState(false);
  }
});

shopSelect?.addEventListener('change', async () => {
  try {
    const state = await sendMessage<ExtensionState>({
      type: 'SET_SELECTED_SHOP',
      payload: {
        shopId: shopSelect.value || null,
      },
    });
    renderState(state);
  } catch (error) {
    activityMessage!.textContent =
      error instanceof Error ? error.message : 'Gagal mengubah shop default.';
  }
});

void refreshState();
setPasswordVisibility(false);
