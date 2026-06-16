export type MembershipRole = 'OWNER' | 'MANAGER' | 'STAFF' | 'AGENCY_ADMIN';

export type AuthSession = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    status: string;
  };
  activeOrganization: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  membership: {
    id: string;
    role: MembershipRole;
    status: string;
  };
};

export type ShopSummary = {
  id: string;
  name: string | null;
  status: string;
  externalId: string;
  createdAt?: string;
  marketplace: {
    id: string;
    code: string;
    name: string;
  };
};

export type ExtensionSession = {
  id: string;
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  deviceLabel: string;
  extensionVersion: string;
  shop: {
    id: string;
    name: string | null;
    status: string;
    externalId: string;
  } | null;
};

export type CaptureMode = 'owned' | 'public';

export type PageType =
  | 'unknown'
  | 'shopee_public_search'
  | 'shopee_public_product'
  | 'shopee_ads_dashboard'
  | 'shopee_seller_product_page'
  | 'tiktok_ads_dashboard'
  | 'tiktok_public_search';

export type Marketplace = 'shopee' | 'tiktok_shop' | 'unknown';

export type SearchResultPreview = {
  position: number;
  productTitle: string;
  productUrl: string;
  imageUrl?: string;
  shopName: string | null;
  priceMin?: number;
  priceMax?: number;
  salesHint?: string;
};

export type ProductDetailSnapshot = {
  productTitle: string;
  productUrl: string;
  imageUrl?: string;
  shopName: string | null;
  priceMin?: number;
  priceMax?: number;
  salesHint?: string;
  ratingHint?: string;
  reviewCountHint?: string;
  highlights: string[];
};

export type PageSnapshot = {
  url: string;
  title: string;
  detectedAt: string;
  pageType: PageType;
  captureMode: CaptureMode | null;
  marketplace: Marketplace;
  keyword?: string;
  statusMessage: string;
  shopIdentifier?: string;
  resultsPreview: SearchResultPreview[];
  productDetail?: ProductDetailSnapshot;
};

export type LastSyncStatus = {
  status: 'idle' | 'success' | 'error';
  message: string;
  at?: string;
};

export type ExtensionState = {
  apiBaseUrl: string;
  authSession: AuthSession | null;
  extensionSession: ExtensionSession | null;
  shops: ShopSummary[];
  selectedShopId: string | null;
  lastPage: PageSnapshot | null;
  lastSync: LastSyncStatus;
};

export type DetectionMessage =
  | { type: 'PAGE_SNAPSHOT_UPDATED'; payload: PageSnapshot }
  | { type: 'REQUEST_PAGE_SNAPSHOT' };

export type BackgroundMessage =
  | { type: 'GET_STATE' }
  | {
      type: 'LOGIN';
      payload: { apiBaseUrl: string; email: string; password: string };
    }
  | { type: 'LOGOUT' }
  | { type: 'SET_SELECTED_SHOP'; payload: { shopId: string | null } }
  | { type: 'REFRESH_ACTIVE_TAB' }
  | { type: 'SYNC_NOW' };
