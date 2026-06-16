import { HttpStatus, Injectable } from '@nestjs/common';
import { ClientSession, Types } from 'mongoose';
import { CouponsRepository } from './coupons.repository';
import { CouponUsageRepository } from './coupon-usage.repository';
import { CouponDocument, CouponType } from './schemas/coupon.schema';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { LIMITS } from '../../common/constants/app.constant';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';

export interface CartItemForValidation {
  productId: string;
  categoryIds?: string[];
}

export interface CouponValidationResult {
  coupon: CouponDocument;
  discountAmount: number;
  isValid: true;
}

@Injectable()
export class CouponsService {
  constructor(
    private readonly couponsRepository: CouponsRepository,
    private readonly couponUsageRepository: CouponUsageRepository,
  ) {}

  async validateCoupon(
    code: string,
    userId: string,
    subtotal: number,
    cartItems?: CartItemForValidation[],
  ): Promise<CouponValidationResult> {
    const coupon = await this.couponsRepository.findByCode(code);
    if (!coupon) {
      throw new BusinessException(
        ErrorCodes.COUPON_NOT_FOUND,
        'Mã giảm giá không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!coupon.isActive) {
      throw new BusinessException(
        ErrorCodes.COUPON_INACTIVE,
        'Mã giảm giá đã bị tạm ngừng',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const now = new Date();
    if (coupon.startDate && now < coupon.startDate) {
      throw new BusinessException(
        ErrorCodes.COUPON_NOT_YET_ACTIVE,
        'Mã giảm giá chưa đến thời gian áp dụng',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (coupon.endDate && now > coupon.endDate) {
      throw new BusinessException(
        ErrorCodes.COUPON_EXPIRED,
        'Mã giảm giá đã hết hạn',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      throw new BusinessException(
        ErrorCodes.COUPON_USAGE_LIMIT_REACHED,
        'Mã giảm giá đã hết lượt sử dụng',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const userUsageCount =
      await this.couponUsageRepository.countByUserAndCoupon(
        userId,
        coupon._id.toString(),
      );
    if (userUsageCount >= coupon.usagePerUser) {
      throw new BusinessException(
        ErrorCodes.COUPON_USER_LIMIT_REACHED,
        'Bạn đã sử dụng hết số lượt cho mã giảm giá này',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (subtotal < coupon.minOrderAmount) {
      throw new BusinessException(
        ErrorCodes.COUPON_MIN_ORDER_NOT_MET,
        `Đơn hàng phải tối thiểu ${coupon.minOrderAmount.toLocaleString('vi-VN')}đ để áp dụng mã này`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (
      cartItems &&
      (coupon.applicableProducts.length > 0 ||
        coupon.applicableCategories.length > 0)
    ) {
      const applicableProductIds = coupon.applicableProducts.map((id) =>
        id.toString(),
      );
      const applicableCategoryIds = coupon.applicableCategories.map((id) =>
        id.toString(),
      );

      const hasMatch = cartItems.some(
        (item) =>
          applicableProductIds.includes(item.productId) ||
          (item.categoryIds ?? []).some((cid) =>
            applicableCategoryIds.includes(cid),
          ),
      );

      if (!hasMatch) {
        throw new BusinessException(
          ErrorCodes.COUPON_NOT_APPLICABLE,
          'Mã giảm giá không áp dụng cho các sản phẩm trong giỏ hàng',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    const discountAmount = this.calculateDiscount(coupon, subtotal);

    return { coupon, discountAmount, isValid: true };
  }

  async applyCoupon(
    couponId: string,
    userId: string,
    orderId: string,
    discountAmount: number,
    session?: ClientSession,
  ): Promise<void> {
    const updated = await this.couponsRepository.atomicIncrementUsed(
      couponId,
      session,
    );
    if (!updated) {
      throw new BusinessException(
        ErrorCodes.COUPON_USAGE_LIMIT_REACHED,
        'Mã giảm giá đã hết lượt sử dụng',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    await this.couponUsageRepository.create(
      {
        couponId: new Types.ObjectId(couponId),
        userId: new Types.ObjectId(userId),
        orderId: new Types.ObjectId(orderId),
        discountAmount,
      },
      session,
    );
  }

  async revertCoupon(orderId: string): Promise<void> {
    const usage = await this.couponUsageRepository.findByOrderId(orderId);
    if (!usage) return;

    await this.couponsRepository.decrementUsed(usage.couponId);
    await this.couponUsageRepository.deleteByOrder(orderId);
  }

  // ==================== ADMIN CRUD ====================

  async findMany(
    filter: Record<string, unknown>,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResultDto<CouponDocument>> {
    const { items, total } = await this.couponsRepository.findMany(
      filter,
      pagination,
    );
    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async findById(id: string): Promise<CouponDocument> {
    const coupon = await this.couponsRepository.findById(id);
    if (!coupon) {
      throw new BusinessException(
        ErrorCodes.COUPON_NOT_FOUND,
        'Mã giảm giá không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }
    return coupon;
  }

  async create(dto: CreateCouponDto): Promise<CouponDocument> {
    const existing = await this.couponsRepository.findByCode(dto.code);
    if (existing) {
      throw new BusinessException(
        ErrorCodes.VALIDATION_FAILED,
        'Mã giảm giá đã tồn tại',
        HttpStatus.CONFLICT,
      );
    }

    return this.couponsRepository.create({
      ...dto,
      code: dto.code.toUpperCase(),
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    } as unknown as Partial<CouponDocument>);
  }

  async update(id: string, dto: UpdateCouponDto): Promise<CouponDocument> {
    const updateData: Record<string, unknown> = {
      ...dto,
      ...(dto.code && { code: dto.code.toUpperCase() }),
      ...(dto.startDate && { startDate: new Date(dto.startDate) }),
      ...(dto.endDate && { endDate: new Date(dto.endDate) }),
    };

    const updated = await this.couponsRepository.update(id, updateData);
    if (!updated) {
      throw new BusinessException(
        ErrorCodes.COUPON_NOT_FOUND,
        'Mã giảm giá không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    const coupon = await this.couponsRepository.findById(id);
    if (!coupon) {
      throw new BusinessException(
        ErrorCodes.COUPON_NOT_FOUND,
        'Mã giảm giá không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.couponsRepository.delete(id);
  }

  private calculateDiscount(coupon: CouponDocument, subtotal: number): number {
    switch (coupon.type) {
      case CouponType.PERCENT: {
        const raw = subtotal * (coupon.value / 100);
        const capped = coupon.maxDiscountAmount
          ? Math.min(raw, coupon.maxDiscountAmount)
          : raw;
        return Math.round(capped);
      }
      case CouponType.FIXED_AMOUNT:
        return Math.round(Math.min(coupon.value, subtotal));
      case CouponType.FREE_SHIPPING: {
        // discountAmount = giá trị phí ship được miễn (tính theo cùng
        // công thức free-shipping threshold đã dùng ở Cart — T-09)
        const shippingFee =
          subtotal >= LIMITS.FREE_SHIPPING_THRESHOLD
            ? 0
            : LIMITS.STANDARD_SHIPPING_FEE;
        return shippingFee;
      }
      default:
        return 0;
    }
  }
}
