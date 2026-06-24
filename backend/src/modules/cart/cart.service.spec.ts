import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { CartRepository } from './cart.repository';
import { ProductsRepository } from '../products/products.repository';
import { ProductVariantsRepository } from '../products/product-variants.repository';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { LIMITS } from '../../common/constants/app.constant';
import { Types } from 'mongoose';

const pid = new Types.ObjectId();
const iid = new Types.ObjectId();
const uid = new Types.ObjectId().toString();

const makeProduct = (overrides: Record<string, unknown> = {}) => ({
  _id: pid,
  name: 'Test Product',
  thumbnailUrl: 'http://img',
  price: 100000,
  discountPercent: 0,
  isActive: true,
  isFlashSale: false,
  stock: 10,
  ...overrides,
  toString: () => pid.toString(),
});

const makeCartItem = (overrides: Record<string, unknown> = {}) => ({
  _id: iid,
  productId: pid,
  variantId: undefined,
  productName: 'Test Product',
  productImage: 'http://img',
  variantOptions: [],
  price: 100000,
  quantity: 2,
  addedAt: new Date(),
  ...overrides,
  toString: () => iid.toString(),
});

const makeCart = (items: ReturnType<typeof makeCartItem>[] = []) => ({
  _id: new Types.ObjectId(),
  userId: new Types.ObjectId(uid),
  items,
  save: jest.fn().mockResolvedValue(undefined),
});

describe('CartService', () => {
  let service: CartService;

  const cartRepo = {
    findByUserId: jest.fn(),
    findOrCreate: jest.fn(),
    clear: jest.fn(),
  };

  const productsRepo = {
    findById: jest.fn(),
    findByIds: jest.fn(),
  };

  const variantsRepo = {
    findById: jest.fn(),
    findByIds: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: CartRepository, useValue: cartRepo },
        { provide: ProductsRepository, useValue: productsRepo },
        { provide: ProductVariantsRepository, useValue: variantsRepo },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    jest.clearAllMocks();
    variantsRepo.findByIds.mockResolvedValue([]);
  });

  // ── getCart ───────────────────────────────────────────────────────────────

  describe('getCart', () => {
    it('enriches item as unavailable when product is inactive', async () => {
      const item = makeCartItem();
      cartRepo.findOrCreate.mockResolvedValue(makeCart([item]));
      productsRepo.findByIds.mockResolvedValue([
        makeProduct({ isActive: false }),
      ]);

      const result = await service.getCart(uid);

      expect(result.items[0].isUnavailable).toBe(true);
      expect(result.summary.canCheckout).toBe(false);
    });

    it('marks isQuantityExceeded when quantity > currentStock', async () => {
      const item = makeCartItem({ quantity: 15 }); // stock is 10
      cartRepo.findOrCreate.mockResolvedValue(makeCart([item]));
      productsRepo.findByIds.mockResolvedValue([makeProduct({ stock: 10 })]);

      const result = await service.getCart(uid);

      expect(result.items[0].isQuantityExceeded).toBe(true);
      expect(result.items[0].maxQuantity).toBe(10);
    });

    it('marks isPriceChanged when current price differs from snapshot', async () => {
      const item = makeCartItem({ price: 80000 }); // snapshot price
      cartRepo.findOrCreate.mockResolvedValue(makeCart([item]));
      productsRepo.findByIds.mockResolvedValue([
        makeProduct({ price: 100000 }),
      ]); // new price

      const result = await service.getCart(uid);

      expect(result.items[0].isPriceChanged).toBe(true);
      expect(result.items[0].currentPrice).toBe(100000);
    });

    it('calculates free shipping above threshold', async () => {
      const item = makeCartItem({
        price: LIMITS.FREE_SHIPPING_THRESHOLD,
        quantity: 1,
      });
      cartRepo.findOrCreate.mockResolvedValue(makeCart([item]));
      productsRepo.findByIds.mockResolvedValue([
        makeProduct({ price: LIMITS.FREE_SHIPPING_THRESHOLD }),
      ]);

      const result = await service.getCart(uid);

      expect(result.summary.shippingFee).toBe(0);
    });
  });

  // ── addItem ───────────────────────────────────────────────────────────────

  describe('addItem', () => {
    const dto = {
      productId: pid.toString(),
      quantity: 2,
    };

    it('adds new item to empty cart', async () => {
      const product = makeProduct();
      productsRepo.findById.mockResolvedValue(product);

      const emptyCart = makeCart([]);
      cartRepo.findOrCreate.mockResolvedValue(emptyCart);

      // for the getCart call after save
      cartRepo.findOrCreate
        .mockResolvedValueOnce(emptyCart)
        .mockResolvedValue(makeCart([makeCartItem()]));
      productsRepo.findByIds.mockResolvedValue([product]);

      await service.addItem(uid, dto);

      expect(emptyCart.save).toHaveBeenCalled();
    });

    it('merges quantity when item already exists in cart', async () => {
      const product = makeProduct({ stock: 20 });
      productsRepo.findById.mockResolvedValue(product);

      const existingItem = makeCartItem({ quantity: 3 });
      const cart = makeCart([existingItem]);
      cartRepo.findOrCreate
        .mockResolvedValueOnce(cart)
        .mockResolvedValue(makeCart([makeCartItem({ quantity: 5 })]));
      productsRepo.findByIds.mockResolvedValue([product]);

      await service.addItem(uid, { productId: pid.toString(), quantity: 2 });

      // quantity should be merged: 3 + 2 = 5
      expect(cart.items[0].quantity).toBe(5);
    });

    it('throws PRODUCT_NOT_FOUND when product is inactive', async () => {
      productsRepo.findById.mockResolvedValue(makeProduct({ isActive: false }));

      await expect(service.addItem(uid, dto)).rejects.toMatchObject({
        errorCode: ErrorCodes.PRODUCT_NOT_FOUND,
      });
    });

    it('throws PRODUCT_OUT_OF_STOCK when stock is 0', async () => {
      productsRepo.findById.mockResolvedValue(makeProduct({ stock: 0 }));

      await expect(service.addItem(uid, dto)).rejects.toMatchObject({
        errorCode: ErrorCodes.PRODUCT_OUT_OF_STOCK,
      });
    });

    it('throws PRODUCT_INSUFFICIENT_STOCK when merge would exceed stock', async () => {
      productsRepo.findById.mockResolvedValue(makeProduct({ stock: 4 }));
      const existingItem = makeCartItem({ quantity: 3 });
      cartRepo.findOrCreate.mockResolvedValue(makeCart([existingItem]));

      // 3 existing + 2 requested = 5 > stock 4
      await expect(
        service.addItem(uid, { productId: pid.toString(), quantity: 2 }),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.PRODUCT_INSUFFICIENT_STOCK,
      });
    });

    it('throws CART_MAX_ITEMS_REACHED when cart is full', async () => {
      productsRepo.findById.mockResolvedValue(makeProduct());

      // Create a full cart with 50 different items
      const fullItems = Array.from(
        { length: LIMITS.CART_MAX_ITEMS },
        (_, i) => ({
          ...makeCartItem(),
          productId: new Types.ObjectId(),
          _id: new Types.ObjectId(),
          toString: () => String(i),
        }),
      );
      cartRepo.findOrCreate.mockResolvedValue(makeCart(fullItems));

      await expect(service.addItem(uid, dto)).rejects.toMatchObject({
        errorCode: ErrorCodes.CART_MAX_ITEMS_REACHED,
      });
    });
  });

  // ── updateItem ────────────────────────────────────────────────────────────

  describe('updateItem', () => {
    it('removes item when quantity is 0', async () => {
      const item = makeCartItem();
      const cart = makeCart([item]);
      cartRepo.findByUserId.mockResolvedValue(cart);
      cartRepo.findOrCreate.mockResolvedValue(makeCart([]));
      productsRepo.findByIds.mockResolvedValue([]);

      await service.updateItem(uid, iid.toString(), 0);

      expect(cart.items).toHaveLength(0);
      expect(cart.save).toHaveBeenCalled();
    });

    it('updates quantity when stock allows', async () => {
      const item = makeCartItem({ quantity: 2 });
      const cart = makeCart([item]);
      cartRepo.findByUserId.mockResolvedValue(cart);

      const product = makeProduct({ stock: 10 });
      productsRepo.findById.mockResolvedValue(product);
      variantsRepo.findById.mockResolvedValue(null);
      cartRepo.findOrCreate.mockResolvedValue(makeCart([item]));
      productsRepo.findByIds.mockResolvedValue([product]);

      await service.updateItem(uid, iid.toString(), 5);

      expect(cart.items[0].quantity).toBe(5);
    });

    it('throws CART_ITEM_NOT_FOUND when item id does not match', async () => {
      cartRepo.findByUserId.mockResolvedValue(makeCart([]));

      await expect(
        service.updateItem(uid, new Types.ObjectId().toString(), 1),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.CART_ITEM_NOT_FOUND });
    });
  });
});
