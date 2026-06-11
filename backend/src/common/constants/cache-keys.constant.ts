export const CacheKeys = {
  CATEGORIES_TREE: 'categories:tree',
  CATEGORY_BY_SLUG: (slug: string) => `category:${slug}`,

  PRODUCT_BY_SLUG: (slug: string) => `product:${slug}`,
  PRODUCTS_FLASH_SALE: 'products:flash-sale',
  PRODUCTS_FEATURED: 'products:featured',
  PRODUCTS_BEST_SELLERS: 'products:best-sellers',
  PRODUCTS_LIST: (hash: string) => `products:list:${hash}`,

  BANNERS_ACTIVE: 'banners:active',

  DASHBOARD_STATS: 'dashboard:stats',
  DASHBOARD_REVENUE_DAY: (year: number, month: number) =>
    `dashboard:revenue:day:${year}-${month}`,
  DASHBOARD_REVENUE_MONTH: (year: number) => `dashboard:revenue:month:${year}`,
  DASHBOARD_BEST_SELLERS: (period: string) =>
    `dashboard:best-sellers:${period}`,

  USER_SESSION: (userId: string) => `user:session:${userId}`,
  RATE_LIMIT_RESEND_EMAIL: (userId: string) => `rate:resend-email:${userId}`,

  ORDER_COUNTER: (dateStr: string) => `order-counter:${dateStr}`,
} as const;
