export function buildRegisterDto(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Test User',
    email: `test-${Date.now()}@example.com`,
    password: 'Test@1234',
    ...overrides,
  };
}

export function buildCreateCategoryDto(
  overrides: Record<string, unknown> = {},
) {
  return {
    name: `Category-${Date.now()}`,
    slug: `cat-${Date.now()}`,
    description: 'A test category',
    isActive: true,
    ...overrides,
  };
}

export function buildCreateProductDto(
  categoryId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    name: `Product-${Date.now()}`,
    description: 'A test product',
    price: 150000,
    stock: 20,
    categories: [categoryId],
    thumbnailUrl: 'https://example.com/img.jpg',
    isActive: true,
    isFeatured: false,
    isFlashSale: false,
    brand: 'TestBrand',
    ...overrides,
  };
}

export function buildCreateAddressDto(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Test Recipient',
    phone: '0901234567',
    province: { code: '01', name: 'Hà Nội' },
    district: { code: '001', name: 'Ba Đình' },
    ward: { code: '00001', name: 'Phúc Xá' },
    streetAddress: '123 Đường Test',
    isDefault: true,
    ...overrides,
  };
}

export function buildCreateOrderDto(
  addressId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    addressId,
    paymentMethod: 'cod',
    note: 'Test order note',
    ...overrides,
  };
}

export function buildAddCartItemDto(productId: string, quantity = 2) {
  return { productId, quantity };
}
