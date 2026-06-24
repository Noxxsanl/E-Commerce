// uuid v14 ships ESM-only; mock the slug util to avoid Jest transform issues
jest.mock('../../common/utils/slug.util', () => ({
  generateUniqueSlug: jest.fn().mockResolvedValue('test-product-slug'),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getQueueToken } from '@nestjs/bullmq';
import { ProductsService } from './products.service';
import { ProductsRepository } from './products.repository';
import { ProductVariantsRepository } from './product-variants.repository';
import { CategoriesRepository } from '../categories/categories.repository';
import { AuditLogsRepository } from '../audit-logs/audit-logs.repository';
import { REDIS_CLIENT } from '../../cache/redis.provider';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { QUEUE_NAMES } from '../../common/constants/queue.constant';
import { Types } from 'mongoose';

const pid = new Types.ObjectId();
const cid = new Types.ObjectId();

const makeProduct = (overrides: Record<string, unknown> = {}) => ({
  _id: pid,
  name: 'Test Product',
  slug: 'test-product',
  price: 200000,
  stock: 10,
  isActive: true,
  isFlashSale: false,
  flashSalePrice: undefined,
  flashSaleStock: undefined,
  flashSaleEndAt: undefined,
  categories: [cid],
  toObject: jest.fn().mockReturnThis(),
  ...overrides,
});

describe('ProductsService', () => {
  let service: ProductsService;

  const productsRepo = {
    findBySlug: jest.fn(),
    findById: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    existsBySlug: jest.fn().mockResolvedValue(false),
    findFlashSale: jest.fn(),
    findFeatured: jest.fn(),
    findBestSellers: jest.fn(),
    findNewest: jest.fn(),
    findRelated: jest.fn(),
  };

  const variantsRepo = {
    findByProductId: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const categoriesRepo = {
    findBySlug: jest.fn(),
    findByIds: jest.fn(),
    findById: jest.fn(),
  };

  const auditLogsRepo = {
    create: jest.fn().mockResolvedValue(undefined),
  };

  const cacheMock = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };

  const analyticsQueue = {
    add: jest.fn().mockResolvedValue({}),
  };

  const redisMock = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: ProductsRepository, useValue: productsRepo },
        { provide: ProductVariantsRepository, useValue: variantsRepo },
        { provide: CategoriesRepository, useValue: categoriesRepo },
        { provide: AuditLogsRepository, useValue: auditLogsRepo },
        { provide: CACHE_MANAGER, useValue: cacheMock },
        {
          provide: getQueueToken(QUEUE_NAMES.ANALYTICS),
          useValue: analyticsQueue,
        },
        { provide: REDIS_CLIENT, useValue: redisMock },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
    auditLogsRepo.create.mockResolvedValue(undefined);
    productsRepo.existsBySlug.mockResolvedValue(false);
    variantsRepo.findByProductId.mockResolvedValue([]);
    cacheMock.get.mockResolvedValue(null);
    cacheMock.set.mockResolvedValue(undefined);
    cacheMock.del.mockResolvedValue(undefined);
    redisMock.keys.mockResolvedValue([]);
    analyticsQueue.add.mockResolvedValue({});
  });

  // ── findBySlug ────────────────────────────────────────────────────────────

  describe('findBySlug', () => {
    it('returns cached product without hitting DB (cache hit)', async () => {
      const cached = { ...makeProduct(), variants: [] };
      cacheMock.get.mockResolvedValue(cached);

      const result = await service.findBySlug('test-product');

      expect(productsRepo.findBySlug).not.toHaveBeenCalled();
      expect(result).toBe(cached);
    });

    it('fetches from DB, enriches with variants, and caches (cache miss)', async () => {
      const product = makeProduct();
      const variants = [{ _id: new Types.ObjectId(), sku: 'SKU-001' }];

      cacheMock.get.mockResolvedValue(null);
      productsRepo.findBySlug.mockResolvedValue(product);
      variantsRepo.findByProductId.mockResolvedValue(variants);

      const result = await service.findBySlug('test-product');

      expect(productsRepo.findBySlug).toHaveBeenCalledWith('test-product', {
        isActive: true,
      });
      expect(variantsRepo.findByProductId).toHaveBeenCalledWith(pid);
      expect(cacheMock.set).toHaveBeenCalled();
      expect(result.variants).toBe(variants);
    });

    it('throws PRODUCT_NOT_FOUND when slug does not exist', async () => {
      cacheMock.get.mockResolvedValue(null);
      productsRepo.findBySlug.mockResolvedValue(null);

      await expect(service.findBySlug('no-such-slug')).rejects.toMatchObject({
        errorCode: ErrorCodes.PRODUCT_NOT_FOUND,
      });
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create (admin)', () => {
    const dto = {
      name: 'New Product',
      price: 150000,
      stock: 20,
      categories: [cid.toString()],
      description: 'A product',
      thumbnailUrl: 'http://img',
      isActive: true,
    };

    it('creates product after validating all categories exist', async () => {
      const product = makeProduct({ name: 'New Product' });
      categoriesRepo.findByIds.mockResolvedValue([{ _id: cid }]);
      productsRepo.create.mockResolvedValue(product);

      const result = await service.create(dto, 'admin-id');

      expect(categoriesRepo.findByIds).toHaveBeenCalledWith([cid.toString()]);
      expect(productsRepo.create).toHaveBeenCalled();
      expect(auditLogsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', resource: 'product' }),
      );
      expect(result).toBe(product);
    });

    it('throws CATEGORY_NOT_FOUND when a category id is invalid', async () => {
      // Only 0 out of 1 categories found
      categoriesRepo.findByIds.mockResolvedValue([]);

      await expect(
        service.create(dto as never, 'admin-id'),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.CATEGORY_NOT_FOUND,
      });
      expect(productsRepo.create).not.toHaveBeenCalled();
    });
  });

  // ── update (flash sale validation) ───────────────────────────────────────

  describe('update (admin) — flash sale validation', () => {
    const adminId = 'admin-id';

    it('throws VALIDATION_FAILED when isFlashSale=true but flashSalePrice >= price', async () => {
      const product = makeProduct({ price: 200000, isFlashSale: false });
      productsRepo.findById.mockResolvedValue(product);

      await expect(
        service.update(
          pid.toString(),
          {
            isFlashSale: true,
            flashSalePrice: 200000,
            flashSaleStock: 5,
            flashSaleEndAt: new Date(Date.now() + 86400000).toISOString(),
          },
          adminId,
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.VALIDATION_FAILED });
    });

    it('throws VALIDATION_FAILED when flashSaleStock > product stock', async () => {
      const product = makeProduct({
        price: 200000,
        stock: 5,
        isFlashSale: false,
      });
      productsRepo.findById.mockResolvedValue(product);

      await expect(
        service.update(
          pid.toString(),
          {
            isFlashSale: true,
            flashSalePrice: 100000,
            flashSaleStock: 10,
            flashSaleEndAt: new Date(Date.now() + 86400000).toISOString(),
          },
          adminId,
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.VALIDATION_FAILED });
    });

    it('throws VALIDATION_FAILED when flashSaleEndAt is in the past', async () => {
      const product = makeProduct({
        price: 200000,
        stock: 10,
        isFlashSale: false,
      });
      productsRepo.findById.mockResolvedValue(product);

      await expect(
        service.update(
          pid.toString(),
          {
            isFlashSale: true,
            flashSalePrice: 100000,
            flashSaleStock: 5,
            flashSaleEndAt: new Date(Date.now() - 1000).toISOString(), // past
          },
          adminId,
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.VALIDATION_FAILED });
    });

    it('enables flash sale successfully and sets Redis stock counter', async () => {
      const product = makeProduct({
        price: 200000,
        stock: 10,
        isFlashSale: false,
      });
      const updated = makeProduct({
        price: 200000,
        stock: 10,
        isFlashSale: true,
      });
      productsRepo.findById.mockResolvedValue(product);
      productsRepo.update.mockResolvedValue(updated);

      await service.update(
        pid.toString(),
        {
          isFlashSale: true,
          flashSalePrice: 100000,
          flashSaleStock: 5,
          flashSaleEndAt: new Date(Date.now() + 86400000).toISOString(),
        },
        adminId,
      );

      expect(redisMock.set).toHaveBeenCalledWith(
        `flash-sale-stock:${pid.toString()}`,
        5,
      );
    });

    it('throws PRODUCT_NOT_FOUND when product does not exist', async () => {
      productsRepo.findById.mockResolvedValue(null);

      await expect(
        service.update(pid.toString(), {}, adminId),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.PRODUCT_NOT_FOUND });
    });
  });
});
