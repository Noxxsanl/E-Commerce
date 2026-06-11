export interface SendVerifyEmailData {
  to: string;
  fullName: string;
  token: string;
}

export interface SendResetPasswordData {
  to: string;
  fullName: string;
  token: string;
}

export interface OrderItemData {
  productName: string;
  variantOptions?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ShippingAddressData {
  fullName: string;
  phone: string;
  address: string;
}

export interface SendOrderConfirmationData {
  to: string;
  fullName: string;
  orderCode: string;
  orderUrl: string;
  items: OrderItemData[];
  subtotal: number;
  shippingFee: number;
  total: number;
  shippingAddress: ShippingAddressData;
}

export interface SendOrderStatusUpdateData {
  to: string;
  fullName: string;
  orderCode: string;
  orderUrl: string;
  newStatus: string;
  statusMessage: string;
  note?: string;
}

export interface SendPasswordChangedData {
  to: string;
  fullName: string;
  changedAt: string;
}
