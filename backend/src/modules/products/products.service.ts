import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from '@nestjs/cache-manager';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Types } from 'mongoose';
import { createHash } from 'crypto';
import sanitizeHtml from 'sanitize-html';
import type Redis from 'ioredis';
import { InjectRedis } from '../../cache/redis.provider';
import { ProductsRepository } from './products.repository';
import { ProductVariantsRepository } from './product-variants.repository';
import { CategoriesRepository } from '../categories/categories.repository';
import { AuditLogsRepository } from '../audit-logs/audit-logs.repository';
import { Product, ProductDocument } from './schemas/product.schema';
import { ProductVariantDocument } from './schemas/product-variant.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto, ProductSortOption } from './dto/query-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { CacheKeys } from '../../common/constants/cache-keys.constant';
import {
  QUEUE_NAMES,
  ANALYTICS_JOBS,
} from '../../common/constants/queue.constant';
import { generateUniqueSlug } from '../../common/utils/slug.util';

const PRODUCT_LIST_TTL_MS = 5 * 60 * 1000; // 5 phút
const PRODUCT_SLUG_TTL_MS = 10 * 60 * 1000; // 10 phút
const FLASH_SALE_TTL_MS = 60 * 1000; // 1 phút
const FEATURED_TTL_MS = 30 * 60 * 1000; // 30 phút
const BEST_SELLERS_TTL_MS = 30 * 60 * 1000; // 30 phút
const DEFAULT_FEATURED_LIMIT = 8;
const DEFAULT_BEST_SELLERS_LIMIT = 10;

export interface ProductWithVariants extends Record<string, unknown> {
  variants: ProductVariantDocument[];
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly productVariantsRepository: ProductVariantsRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectQueue(QUEUE_NAMES.ANALYTICS) private readonly analyticsQueue: Queue,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ==================== PUBLIC METHODS ====================

  async findMany(
    queryDto: QueryProductDto,
  ): Promise<PaginatedResultDto<ProductDocument>> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;

    const filter: Record<string, unknown> = { isActive: true };

    if (queryDto.category) {
      const category = await this.categoriesRepository.findBySlug(
        queryDto.category,
      );
      if (!category) {
        // Slug không tồn tại -> trả về danh sách rỗng, không throw lỗi
        return { items: [], total: 0, page, limit, totalPages: 0 };
      }
      filter.categories = category._id;
    }

    if (queryDto.brand) {
      filter.brand = queryDto.brand;
    }

    if (queryDto.minPrice !== undefined || queryDto.maxPrice !== undefined) {
      const priceFilter: Record<string, number> = {};
      if (queryDto.minPrice !== undefined) priceFilter.$gte = queryDto.minPrice;
      if (queryDto.maxPrice !== undefined) priceFilter.$lte = queryDto.maxPrice;
      filter.price = priceFilter;
    }

    if (queryDto.minRating !== undefined) {
      filter.averageRating = { $gte: queryDto.minRating };
    }

    if (queryDto.inStock) {
      filter.stock = { $gt: 0 };
    }

    if (queryDto.search) {
      filter.$text = { $search: queryDto.search };
    }

    const sort = this.resolveSort(queryDto.sort);

    const hash = createHash('md5')
      .update(JSON.stringify({ filter, sort, page, limit }))
      .digest('hex');
    const cacheKey = CacheKeys.PRODUCTS_LIST(hash);

    const cached =
      await this.cache.get<PaginatedResultDto<ProductDocument>>(cacheKey);
    if (cached) {
      this.logger.log(`[Cache] HIT ${cacheKey}`);
      return cached;
    }
    this.logger.log(`[Cache] MISS ${cacheKey}`);

    const { items, total } = await this.productsRepository.findMany(
      filter,
      sort,
      { page, limit },
    );

    const result: PaginatedResultDto<ProductDocument> = {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.cache.set(cacheKey, result, PRODUCT_LIST_TTL_MS);
    return result;
  }

  async findBySlug(slug: string): Promise<ProductWithVariants> {
    const cacheKey = CacheKeys.PRODUCT_BY_SLUG(slug);
    const cached = await this.cache.get<ProductWithVariants>(cacheKey);
    if (cached) {
      this.logger.log(`[Cache] HIT ${cacheKey}`);
      return cached;
    }
    this.logger.log(`[Cache] MISS ${cacheKey}`);

    const product = await this.productsRepository.findBySlug(slug, {
      isActive: true,
    });
    if (!product) {
      throw new BusinessException(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Sản phẩm không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const variants = await this.productVariantsRepository.findByProductId(
      product._id,
    );

    const result: ProductWithVariants = {
      ...product.toObject(),
      variants,
    };

    this.trackView(product._id).catch((err: Error) =>
      this.logger.error(`Failed to track view: ${err.message}`),
    );

    await this.cache.set(cacheKey, result, PRODUCT_SLUG_TTL_MS);
    return result;
  }

  async findFlashSale(): Promise<ProductDocument[]> {
    const cached = await this.cache.get<ProductDocument[]>(
      CacheKeys.PRODUCTS_FLASH_SALE,
    );
    if (cached) {
      this.logger.log('[Cache] HIT products:flash-sale');
      return cached;
    }
    this.logger.log('[Cache] MISS products:flash-sale');

    const items = await this.productsRepository.findFlashSale();
    await this.cache.set(
      CacheKeys.PRODUCTS_FLASH_SALE,
      items,
      FLASH_SALE_TTL_MS,
    );
    return items;
  }

  async findFeatured(
    limit = DEFAULT_FEATURED_LIMIT,
  ): Promise<ProductDocument[]> {
    const cached = await this.cache.get<ProductDocument[]>(
      CacheKeys.PRODUCTS_FEATURED,
    );
    if (cached) {
      this.logger.log('[Cache] HIT products:featured');
      return cached;
    }
    this.logger.log('[Cache] MISS products:featured');

    const items = await this.productsRepository.findFeatured(limit);
    await this.cache.set(CacheKeys.PRODUCTS_FEATURED, items, FEATURED_TTL_MS);
    return items;
  }

  async findBestSellers(
    limit = DEFAULT_BEST_SELLERS_LIMIT,
  ): Promise<ProductDocument[]> {
    const cached = await this.cache.get<ProductDocument[]>(
      CacheKeys.PRODUCTS_BEST_SELLERS,
    );
    if (cached) {
      this.logger.log('[Cache] HIT products:best-sellers');
      return cached;
    }
    this.logger.log('[Cache] MISS products:best-sellers');

    const items = await this.productsRepository.findBestSellers(limit);
    await this.cache.set(
      CacheKeys.PRODUCTS_BEST_SELLERS,
      items,
      BEST_SELLERS_TTL_MS,
    );
    return items;
  }

  async findNewest(limit: number): Promise<ProductDocument[]> {
    return this.productsRepository.findNewest(limit);
  }

  async findRelated(
    productId: string,
    limit: number,
  ): Promise<ProductDocument[]> {
    const product = await this.productsRepository.findById(productId);
    if (!product) {
      throw new BusinessException(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Sản phẩm không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.productsRepository.findRelated(
      productId,
      product.categories,
      limit,
    );
  }

  async trackView(
    productId: string | Types.ObjectId,
    sessionId?: string,
  ): Promise<void> {
    await this.analyticsQueue.add(ANALYTICS_JOBS.TRACK_VIEW, {
      productId: productId.toString(),
      sessionId,
    });
  }

  // ==================== ADMIN METHODS ====================

  async create(
    dto: CreateProductDto,
    adminId: string,
  ): Promise<ProductDocument> {
    const categories = await this.categoriesRepository.findByIds(
      dto.categories,
    );
    if (categories.length !== dto.categories.length) {
      throw new BusinessException(
        ErrorCodes.CATEGORY_NOT_FOUND,
        'Một hoặc nhiều danh mục không tồn tại',
        HttpStatus.BAD_REQUEST,
      );
    }

    const slug = await generateUniqueSlug(dto.name, (s) =>
      this.productsRepository.existsBySlug(s),
    );

    const product = await this.productsRepository.create({
      ...dto,
      description: dto.description ? sanitizeHtml(dto.description) : undefined,
      slug,
      categories: dto.categories.map((id) => new Types.ObjectId(id)),
      flashSaleEndAt: dto.flashSaleEndAt
        ? new Date(dto.flashSaleEndAt)
        : undefined,
    } as unknown as Partial<Product>);

    await this.invalidateListCaches();
    await this.auditLogsRepository.create({
      userId: adminId,
      action: 'create',
      resource: 'product',
      resourceId: product._id.toString(),
      after: { name: product.name, slug: product.slug, price: product.price },
    });

    return product;
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    adminId: string,
  ): Promise<ProductDocument> {
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new BusinessException(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Sản phẩm không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    if (dto.categories) {
      const categories = await this.categoriesRepository.findByIds(
        dto.categories,
      );
      if (categories.length !== dto.categories.length) {
        throw new BusinessException(
          ErrorCodes.CATEGORY_NOT_FOUND,
          'Một hoặc nhiều danh mục không tồn tại',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const effectivePrice = dto.price ?? product.price;
    const effectiveStock = dto.stock ?? product.stock;
    const effectiveIsFlashSale = dto.isFlashSale ?? product.isFlashSale;
    const effectiveFlashSalePrice =
      dto.flashSalePrice ?? product.flashSalePrice;
    const effectiveFlashSaleStock =
      dto.flashSaleStock ?? product.flashSaleStock;
    const effectiveFlashSaleEndAt = dto.flashSaleEndAt
      ? new Date(dto.flashSaleEndAt)
      : product.flashSaleEndAt;

    if (effectiveIsFlashSale) {
      if (
        effectiveFlashSalePrice === undefined ||
        effectiveFlashSalePrice >= effectivePrice
      ) {
        throw new BusinessException(
          ErrorCodes.VALIDATION_FAILED,
          'Giá flash sale phải nhỏ hơn giá gốc',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (
        effectiveFlashSaleStock === undefined ||
        effectiveFlashSaleStock > effectiveStock
      ) {
        throw new BusinessException(
          ErrorCodes.VALIDATION_FAILED,
          'Số lượng flash sale không được vượt quá tồn kho',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (!effectiveFlashSaleEndAt || effectiveFlashSaleEndAt <= new Date()) {
        throw new BusinessException(
          ErrorCodes.VALIDATION_FAILED,
          'Thời gian kết thúc flash sale phải ở tương lai',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const updateData: Record<string, unknown> = {
      ...dto,
      ...(dto.description !== undefined && {
        description: sanitizeHtml(dto.description),
      }),
      ...(dto.categories && {
        categories: dto.categories.map((cid) => new Types.ObjectId(cid)),
      }),
      ...(dto.flashSaleEndAt && {
        flashSaleEndAt: new Date(dto.flashSaleEndAt),
      }),
    };

    const updated = await this.productsRepository.update(id, updateData);
    if (!updated) {
      throw new BusinessException(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Sản phẩm không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const flashSaleJustEnabled = !product.isFlashSale && effectiveIsFlashSale;
    if (flashSaleJustEnabled) {
      // Init Redis stock counter cho flash sale
      await this.redis.set(
        `flash-sale-stock:${id}`,
        effectiveFlashSaleStock ?? 0,
      );
      // TODO(T-13): schedule BullMQ job kết thúc flash sale + broadcast
      // socket 'flash-sale:started' khi NotificationsGateway có sẵn.
    }

    await this.invalidateListCaches();
    await this.cache.del(CacheKeys.PRODUCT_BY_SLUG(product.slug));

    await this.auditLogsRepository.create({
      userId: adminId,
      action: 'update',
      resource: 'product',
      resourceId: id,
      before: { price: product.price, stock: product.stock },
      after: { price: updated.price, stock: updated.stock },
    });

    return updated;
  }

  async delete(id: string, adminId: string): Promise<void> {
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new BusinessException(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Sản phẩm không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.productsRepository.softDelete(id);
    await this.invalidateListCaches();
    await this.cache.del(CacheKeys.PRODUCT_BY_SLUG(product.slug));

    await this.auditLogsRepository.create({
      userId: adminId,
      action: 'delete',
      resource: 'product',
      resourceId: id,
    });
  }

  async toggleActive(id: string, adminId: string): Promise<ProductDocument> {
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new BusinessException(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Sản phẩm không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const updated = await this.productsRepository.update(id, {
      isActive: !product.isActive,
    });

    await this.invalidateListCaches();
    await this.cache.del(CacheKeys.PRODUCT_BY_SLUG(product.slug));

    await this.auditLogsRepository.create({
      userId: adminId,
      action: 'toggle-active',
      resource: 'product',
      resourceId: id,
      before: { isActive: product.isActive },
      after: { isActive: updated?.isActive },
    });

    return updated as ProductDocument;
  }

  async addVariant(
    productId: string,
    dto: CreateVariantDto,
    adminId: string,
  ): Promise<ProductVariantDocument> {
    const product = await this.productsRepository.findById(productId);
    if (!product) {
      throw new BusinessException(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Sản phẩm không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const variant = await this.productVariantsRepository.create({
      ...dto,
      productId: new Types.ObjectId(productId),
    });

    await this.cache.del(CacheKeys.PRODUCT_BY_SLUG(product.slug));
    await this.auditLogsRepository.create({
      userId: adminId,
      action: 'create',
      resource: 'product-variant',
      resourceId: variant._id.toString(),
    });

    return variant;
  }

  async updateVariant(
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
    adminId: string,
  ): Promise<ProductVariantDocument> {
    const product = await this.productsRepository.findById(productId);
    if (!product) {
      throw new BusinessException(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Sản phẩm không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const variant = await this.productVariantsRepository.findById(variantId);
    if (!variant || variant.productId.toString() !== productId) {
      throw new BusinessException(
        ErrorCodes.PRODUCT_VARIANT_NOT_FOUND,
        'Biến thể sản phẩm không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const updated = await this.productVariantsRepository.update(variantId, dto);

    await this.cache.del(CacheKeys.PRODUCT_BY_SLUG(product.slug));
    await this.auditLogsRepository.create({
      userId: adminId,
      action: 'update',
      resource: 'product-variant',
      resourceId: variantId,
    });

    return updated as ProductVariantDocument;
  }

  async deleteVariant(
    productId: string,
    variantId: string,
    adminId: string,
  ): Promise<void> {
    const product = await this.productsRepository.findById(productId);
    if (!product) {
      throw new BusinessException(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Sản phẩm không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const variant = await this.productVariantsRepository.findById(variantId);
    if (!variant || variant.productId.toString() !== productId) {
      throw new BusinessException(
        ErrorCodes.PRODUCT_VARIANT_NOT_FOUND,
        'Biến thể sản phẩm không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.productVariantsRepository.delete(variantId);
    await this.cache.del(CacheKeys.PRODUCT_BY_SLUG(product.slug));
    await this.auditLogsRepository.create({
      userId: adminId,
      action: 'delete',
      resource: 'product-variant',
      resourceId: variantId,
    });
  }

  private resolveSort(sort?: ProductSortOption): Record<string, 1 | -1> {
    switch (sort) {
      case ProductSortOption.PRICE_ASC:
        return { price: 1 };
      case ProductSortOption.PRICE_DESC:
        return { price: -1 };
      case ProductSortOption.BEST_SELLING:
        return { soldCount: -1 };
      case ProductSortOption.RATING:
        return { averageRating: -1 };
      case ProductSortOption.NEWEST:
      default:
        return { createdAt: -1 };
    }
  }

  private async invalidateListCaches(): Promise<void> {
    await Promise.all([
      this.cache.del(CacheKeys.PRODUCTS_FLASH_SALE),
      this.cache.del(CacheKeys.PRODUCTS_FEATURED),
      this.cache.del(CacheKeys.PRODUCTS_BEST_SELLERS),
    ]);
    // Lưu ý: các key `products:list:*` (theo MD5 hash query) không bị xóa
    // tường minh ở đây vì store hiện tại không hỗ trợ xóa theo pattern;
    // chúng sẽ tự hết hạn sau TTL 5 phút.
  }
}
