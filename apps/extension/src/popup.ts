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
const emailInput = document.querySelector<HTMLInputElement>('#email');
const passwordInput = document.querySelector<HTMLInputElement>('#password');
const togglePasswordButton = document.querySelector<HTMLButtonElement>(
  '#toggle-password-button',
);
const forgotPasswordButton = document.querySelector<HTMLButtonElement>(
  '#forgot-password-button',
);
const registerButton = document.querySelector<HTMLButtonElement>('#register-button');
const authSummary = document.querySelector<HTMLElement>('#auth-summary');
const organizationName = document.querySelector<HTMLElement>('#organization-name');
const userEmail = document.querySelector<HTMLElement>('#user-email');
const sessionStatus = document.querySelector<HTMLElement>('#session-status');
const lastSyncAt = document.querySelector<HTMLElement>('#last-sync-at');
const shopSelect = document.querySelector<HTMLSelectElement>('#shop-select');
const subscriptionPlan = document.querySelector<HTMLElement>('#subscription-plan');
const subscriptionStatusBadge = document.querySelector<HTMLElement>('#subscription-status-badge');
const subscriptionHelper = document.querySelector<HTMLElement>('#subscription-helper');
const subscriptionPeriod = document.querySelector<HTMLElement>('#subscription-period');
const subscriptionPeriodEnd = document.querySelector<HTMLElement>('#subscription-period-end');
const subscriptionShops = document.querySelector<HTMLElement>('#subscription-shops');
const subscriptionMembers = document.querySelector<HTMLElement>('#subscription-members');
const openDashboardButton = document.querySelector<HTMLButtonElement>('#open-dashboard-button');
const upgradeSubscriptionButton = document.querySelector<HTMLButtonElement>(
  '#upgrade-subscription-button',
);
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
let currentAppBaseUrl = DEFAULT_API_BASE_URL;

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
    openDashboardButton,
    upgradeSubscriptionButton,
    forgotPasswordButton,
    registerButton,
  ]) {
    if (!element) {
      continue;
    }

    if ('disabled' in element) {
      element.disabled = busy;
    }
  }
}

function getAppBaseUrl(apiBaseUrl: string) {
  const normalized = apiBaseUrl.trim().replace(/\/+$/, '');

  if (normalized.endsWith('/api')) {
    return normalized.slice(0, -4);
  }

  return normalized || DEFAULT_API_BASE_URL;
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

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatInterval(interval: string | null | undefined) {
  switch (interval) {
    case 'MONTHLY':
      return 'Bulanan';
    case 'YEARLY':
      return 'Tahunan';
    default:
      return interval ?? '-';
  }
}

function formatStatusLabel(status: string | null | undefined) {
  if (!status) {
    return '-';
  }

  return status
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function getStatusTone(status: string | null | undefined) {
  switch (status) {
    case 'ACTIVE':
    case 'PAID':
    case 'SUCCESS':
      return 'success';
    case 'PENDING':
    case 'PENDING_ACTIVATION':
    case 'TRIALING':
      return 'warning';
    case 'EXPIRED':
    case 'CANCELED':
    case 'PAST_DUE':
      return 'danger';
    default:
      return '';
  }
}

function formatPlanCode(planCode: string | null | undefined) {
  if (!planCode) {
    return 'Belum ada plan aktif';
  }

  return planCode
    .split(/[-_]/g)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function readNumericQuota(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatUsageLabel(used: number, limit: unknown, unit: string) {
  const numericLimit = readNumericQuota(limit);
  if (numericLimit === null || numericLimit <= 0) {
    return `${used.toLocaleString('id-ID')} ${unit}`;
  }

  return `${used.toLocaleString('id-ID')} / ${numericLimit.toLocaleString('id-ID')} ${unit}`;
}

function renderSubscriptionCard(state: ExtensionState) {
  const overview = state.subscriptionOverview;
  const subscription = overview?.subscription ?? null;
  const quotas = overview?.entitlements.quotas ?? {};
  const isInternalWorkspace = Boolean(state.authSession?.activeOrganization.isInternal);
  const statusLabel = formatStatusLabel(subscription?.status);
  const statusTone = getStatusTone(subscription?.status);

  subscriptionPlan!.textContent = formatPlanCode(subscription?.plan_code);
  subscriptionStatusBadge!.textContent = statusLabel;
  subscriptionStatusBadge!.className = `status-pill${statusTone ? ` ${statusTone}` : ''}`;
  subscriptionPeriod!.textContent = formatInterval(subscription?.billing_interval);
  subscriptionPeriodEnd!.textContent = formatDateTime(subscription?.current_period_end);
  subscriptionShops!.textContent = formatUsageLabel(
    overview?.usage.active_shops ?? 0,
    quotas.max_shops,
    'shop',
  );
  subscriptionMembers!.textContent = formatUsageLabel(
    overview?.usage.active_members ?? 0,
    quotas.max_members,
    'member',
  );

  if (isInternalWorkspace) {
    subscriptionHelper!.textContent =
      'Workspace internal tidak memakai upgrade billing tenant. Gunakan dashboard untuk pengelolaan internal.';
    upgradeSubscriptionButton?.classList.add('hidden');
    return;
  }

  upgradeSubscriptionButton?.classList.remove('hidden');

  if (!overview || !subscription) {
    subscriptionHelper!.textContent =
      'Buka dashboard untuk melihat pilihan paket dan aktifkan subscription yang paling sesuai untuk workspace Anda.';
    if (upgradeSubscriptionButton) {
      upgradeSubscriptionButton.textContent = 'Lihat Paket';
    }
    return;
  }

  if (upgradeSubscriptionButton) {
    upgradeSubscriptionButton.textContent =
      subscription.status === 'ACTIVE' ? 'Upgrade Subscription' : 'Aktifkan Subscription';
  }

  subscriptionHelper!.textContent =
    subscription.status === 'ACTIVE'
      ? 'Workspace sudah aktif. Upgrade subscription untuk menambah kuota shop, member, dan membuka peluang pertumbuhan yang lebih besar.'
      : 'Subscription workspace belum aktif penuh. Buka halaman subscription untuk melanjutkan aktivasi atau upgrade paket.';
}

function renderState(state: ExtensionState) {
  currentAppBaseUrl = getAppBaseUrl(state.apiBaseUrl || DEFAULT_API_BASE_URL);

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

  renderSubscriptionCard(state);
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
        apiBaseUrl: DEFAULT_API_BASE_URL,
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

forgotPasswordButton?.addEventListener('click', async () => {
  await chrome.tabs.create({
    url: `${currentAppBaseUrl}/forgot-password`,
    active: true,
  });
});

registerButton?.addEventListener('click', async () => {
  await chrome.tabs.create({
    url: `${currentAppBaseUrl}/signup`,
    active: true,
  });
});

openDashboardButton?.addEventListener('click', async () => {
  await chrome.tabs.create({
    url: `${currentAppBaseUrl}/app/dashboard`,
    active: true,
  });
});

upgradeSubscriptionButton?.addEventListener('click', async () => {
  await chrome.tabs.create({
    url: `${currentAppBaseUrl}/app/subscription`,
    active: true,
  });
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
