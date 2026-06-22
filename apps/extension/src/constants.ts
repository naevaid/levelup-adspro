import type { ExtensionState } from './types';

export const EXTENSION_VERSION = '0.1.7';
export const DEFAULT_API_BASE_URL = 'https://adspro.naeva.id';
export const HEARTBEAT_ALARM_NAME = 'levelup-extension-heartbeat';
export const HEARTBEAT_PERIOD_MINUTES = 5;

export const INITIAL_STATE: ExtensionState = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  authSession: null,
  extensionSession: null,
  subscriptionOverview: null,
  shops: [],
  selectedShopId: null,
  lastPage: null,
  lastSync: {
    status: 'idle',
    message: 'Belum ada sinkronisasi.',
  },
};
