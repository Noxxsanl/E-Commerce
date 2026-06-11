export const QUEUE_NAMES = {
  EMAIL: 'email',
  NOTIFICATION: 'notification',
  ORDER: 'order',
  ANALYTICS: 'analytics',
} as const;

export const EMAIL_JOBS = {
  SEND_VERIFY_EMAIL: 'send-verify-email',
  SEND_RESET_PASSWORD: 'send-reset-password',
  SEND_ORDER_CONFIRMATION: 'send-order-confirmation',
  SEND_ORDER_STATUS_UPDATE: 'send-order-status-update',
  SEND_PASSWORD_CHANGED: 'send-password-changed',
} as const;

export const NOTIFICATION_JOBS = {
  CREATE_NOTIFICATION: 'create-notification',
  CREATE_BULK_NOTIFICATIONS: 'create-bulk-notifications',
} as const;

export const ORDER_JOBS = {
  UPDATE_PRODUCT_SOLD_COUNT: 'update-product-sold-count',
  AUTO_CANCEL_PENDING_ORDERS: 'auto-cancel-pending-orders',
} as const;

export const ANALYTICS_JOBS = {
  TRACK_VIEW: 'track-view',
} as const;
