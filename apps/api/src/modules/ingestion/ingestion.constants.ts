export const ALLOWED_CAPTURE_MODES = ['owned', 'public'] as const;

export const ALLOWED_PAGE_TYPES = [
  'shopee_ads_dashboard',
  'shopee_seller_product_page',
  'shopee_public_search',
  'shopee_public_product',
  'shopee_public_shop',
  'tiktok_ads_dashboard',
  'tiktok_public_search',
] as const;

export const ALLOWED_MARKETPLACES = ['shopee', 'tiktok_shop'] as const;

export const ALLOWED_CAPTURE_REASONS = [
  'manual_sync',
  'auto_sync',
  'page_change',
  'background_retry',
  'save_research',
] as const;
