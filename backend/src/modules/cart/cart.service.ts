import { HttpStatus, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { CartRepository } from './cart.repository';
import { ProductsRepository } from '../products/products.repository';
import { ProductVariantsRepository } from '../products/product-variants.repository';
import { ProductDocument } from '../products/schemas/product.schema';
import { ProductVariantDocument } from '../products/schemas/product-variant.schema';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { LIMITS } from '../../common/constants/app.constant';

export interface EnrichedCartItem {
  _id: string;
  productId: string;
  variantId?: string;
  productName: string;
  productImage: string;
  variantOptions: { name: string; value: string }[];
  price: number;
  quantity: number;
  addedAt: Date;
  isUnavailable: boolean;
  isQuantityExceeded: boolean;
  currentPrice: number;
  isPriceChanged: boolean;
  maxQuantity: number;
}

export interface CartSummary {
  subtotal: number;
  shippingFee: number;
  total: number;
  canCheckout: boolean;
}

export interface EnrichedCart {
  items: EnrichedCartItem[];
  summary: CartSummary;
}

@Injectable()
export class CartService {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly productsRepository: ProductsRepository,
    private readonly productVariantsRepository: ProductVariantsRepository,
  ) {}

  async getCart(userId: string): Promise<EnrichedCart> {
    const cart = await this.cartRepository.findOrCreate(userId);

    const productIds = [
      ...new Set(cart.items.map((item) => item.productId.toString())),
    ];
    const variantIds = cart.items
      .filter((item) => item.variantId)
      .map((item) => item.variantId.toString());

    const [products, variants] = await Promise.all([
      this.productsRepository.findByIds(productIds),
      variantIds.length
        ? this.productVariantsRepository.findByIds(variantIds)
        : Promise.resolve([]),
    ]);

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

    const items: EnrichedCartItem[] = cart.items.map((item) => {
      const product = productMap.get(item.productId.toString());
      const variant = item.variantId
        ? variantMap.get(item.variantId.toString())
        : undefined;

      const isUnavailable =
        !product ||
        !product.isActive ||
        (!!item.variantId && (!variant || !variant.isActive));

      const currentStock = isUnavailable
        ? 0
        : variant
          ? variant.stock
          : (product?.stock ?? 0);

      const isQuantityExceeded = !isUnavailable && item.quantity > currentStock;
      const currentPrice =
        !isUnavailable && product
          ? this.computeCurrentPrice(product, variant ?? null)
          : item.price;
      const isPriceChanged = !isUnavailable && currentPrice !== item.price;

      return {
        _id: item._id.toString(),
        productId: item.productId.toString(),
        variantId: item.variantId?.toString(),
        productName: item.productName,
        productImage: item.productImage,
        variantOptions: item.variantOptions,
        price: item.price,
        quantity: item.quantity,
        addedAt: item.addedAt,
        isUnavailable,
        isQuantityExceeded,
        currentPrice,
        isPriceChanged,
        maxQuantity: currentStock,
      };
    });

    return { items, summary: this.calculateSummary(items) };
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<EnrichedCart> {
    const product = await this.productsRepository.findById(dto.productId);
    if (!product || !product.isActive) {
      throw new BusinessException(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh',
        HttpStatus.NOT_FOUND,
      );
    }

    let variant: ProductVariantDocument | null = null;
    if (dto.variantId) {
      variant = await this.productVariantsRepository.findById(dto.variantId);
      if (
        !variant ||
        variant.productId.toString() !== dto.productId ||
        !variant.isActive
      ) {
        throw new BusinessException(
          ErrorCodes.PRODUCT_VARIANT_NOT_FOUND,
          'Biến thể sản phẩm không tồn tại',
          HttpStatus.NOT_FOUND,
        );
      }
    }

    const currentStock = variant ? variant.stock : product.stock;
    if (currentStock <= 0) {
      throw new BusinessException(
        ErrorCodes.PRODUCT_OUT_OF_STOCK,
        'Sản phẩm đã hết hàng',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const cart = await this.cartRepository.findOrCreate(userId);

    const existingIndex = cart.items.findIndex(
      (item) =>
        item.productId.toString() === dto.productId &&
        (item.variantId?.toString() ?? null) === (dto.variantId ?? null),
    );

    if (existingIndex >= 0) {
      const newQty = cart.items[existingIndex].quantity + dto.quantity;
      if (newQty > currentStock) {
        throw new BusinessException(
          ErrorCodes.PRODUCT_INSUFFICIENT_STOCK,
          `Chỉ còn ${currentStock} sản phẩm trong kho`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      cart.items[existingIndex].quantity = newQty;
    } else {
      if (cart.items.length >= LIMITS.CART_MAX_ITEMS) {
        throw new BusinessException(
          ErrorCodes.CART_MAX_ITEMS_REACHED,
          `Giỏ hàng chỉ chứa tối đa ${LIMITS.CART_MAX_ITEMS} sản phẩm`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (dto.quantity > currentStock) {
        throw new BusinessException(
          ErrorCodes.PRODUCT_INSUFFICIENT_STOCK,
          `Chỉ còn ${currentStock} sản phẩm trong kho`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const currentPrice = this.computeCurrentPrice(product, variant);
      cart.items.push({
        productId: new Types.ObjectId(dto.productId),
        variantId: variant ? new Types.ObjectId(dto.variantId) : undefined,
        productName: product.name,
        productImage: product.thumbnailUrl,
        variantOptions: variant ? variant.options : [],
        price: currentPrice,
        quantity: dto.quantity,
        addedAt: new Date(),
      } as never);
    }

    await cart.save();
    return this.getCart(userId);
  }

  async updateItem(
    userId: string,
    itemId: string,
    quantity: number,
  ): Promise<EnrichedCart> {
    const cart = await this.cartRepository.findByUserId(userId);
    const item = cart?.items.find((i) => i._id.toString() === itemId);
    if (!cart || !item) {
      throw new BusinessException(
        ErrorCodes.CART_ITEM_NOT_FOUND,
        'Sản phẩm trong giỏ hàng không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    if (quantity === 0) {
      cart.items = cart.items.filter((i) => i._id.toString() !== itemId);
    } else {
      const variant = item.variantId
        ? await this.productVariantsRepository.findById(item.variantId)
        : null;
      const product = await this.productsRepository.findById(item.productId);
      const currentStock = variant ? variant.stock : (product?.stock ?? 0);

      if (quantity > currentStock) {
        throw new BusinessException(
          ErrorCodes.PRODUCT_INSUFFICIENT_STOCK,
          `Chỉ còn ${currentStock} sản phẩm trong kho`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      item.quantity = quantity;
    }

    await cart.save();
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<EnrichedCart> {
    const cart = await this.cartRepository.findByUserId(userId);
    const exists = cart?.items.some((i) => i._id.toString() === itemId);
    if (!cart || !exists) {
      throw new BusinessException(
        ErrorCodes.CART_ITEM_NOT_FOUND,
        'Sản phẩm trong giỏ hàng không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    cart.items = cart.items.filter((i) => i._id.toString() !== itemId);
    await cart.save();
    return this.getCart(userId);
  }

  async clearCart(userId: string): Promise<void> {
    await this.cartRepository.clear(userId);
  }

  private computeCurrentPrice(
    product: ProductDocument,
    variant: ProductVariantDocument | null,
  ): number {
    if (variant) {
      return Math.round(
        variant.price * (1 - (variant.discountPercent ?? 0) / 100),
      );
    }

    const now = new Date();
    if (
      product.isFlashSale &&
      product.flashSaleEndAt &&
      product.flashSaleEndAt > now &&
      product.flashSalePrice
    ) {
      return product.flashSalePrice;
    }

    return Math.round(
      product.price * (1 - (product.discountPercent ?? 0) / 100),
    );
  }

  private calculateSummary(items: EnrichedCartItem[]): CartSummary {
    const subtotal = items
      .filter((i) => !i.isUnavailable)
      .reduce((sum, i) => sum + i.currentPrice * i.quantity, 0);

    const shippingFee =
      subtotal >= LIMITS.FREE_SHIPPING_THRESHOLD
        ? 0
        : LIMITS.STANDARD_SHIPPING_FEE;

    const total = subtotal + shippingFee;
    const canCheckout = items.length > 0 && !items.some((i) => i.isUnavailable);

    return { subtotal, shippingFee, total, canCheckout };
  }
}
