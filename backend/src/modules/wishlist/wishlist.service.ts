import { HttpStatus, Injectable } from '@nestjs/common';
import { WishlistRepository } from './wishlist.repository';
import { ProductsRepository } from '../products/products.repository';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';

export interface WishlistItemView {
  productId: string;
  addedAt: Date;
  product: {
    name: string;
    slug: string;
    thumbnailUrl: string;
    price: number;
    isActive: boolean;
  } | null;
}

@Injectable()
export class WishlistService {
  constructor(
    private readonly wishlistRepository: WishlistRepository,
    private readonly productsRepository: ProductsRepository,
  ) {}

  async getWishlist(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResultDto<WishlistItemView>> {
    const wishlist = await this.wishlistRepository.findOrCreate(userId);

    const total = wishlist.items.length;
    const start = (page - 1) * limit;
    const pageItems = wishlist.items
      .slice()
      .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
      .slice(start, start + limit);

    const productIds = pageItems.map((item) => item.productId);
    const products = await this.productsRepository.findByIds(productIds);
    const productMap = new Map(
      products.map((p) => [(p._id as { toString(): string }).toString(), p]),
    );

    const items: WishlistItemView[] = pageItems.map((item) => {
      const product = productMap.get(item.productId.toString());
      return {
        productId: item.productId.toString(),
        addedAt: item.addedAt,
        product: product
          ? {
              name: product.name,
              slug: product.slug,
              thumbnailUrl: product.thumbnailUrl,
              price: product.price,
              isActive: product.isActive,
            }
          : null,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async addToWishlist(userId: string, productId: string): Promise<void> {
    const product = await this.productsRepository.findById(productId);
    if (!product || !product.isActive) {
      throw new BusinessException(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.wishlistRepository.findOrCreate(userId);
    // Idempotent: nếu đã có trong wishlist thì bỏ qua, không báo lỗi
    await this.wishlistRepository.addItemIfNotExists(userId, productId);
  }

  async removeFromWishlist(userId: string, productId: string): Promise<void> {
    await this.wishlistRepository.removeItem(userId, productId);
  }

  async checkWishlisted(
    userId: string,
    productId: string,
  ): Promise<{ isWishlisted: boolean }> {
    const isWishlisted = await this.wishlistRepository.existsItem(
      userId,
      productId,
    );
    return { isWishlisted };
  }
}
