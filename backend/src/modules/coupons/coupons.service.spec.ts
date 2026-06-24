import { Test, TestingModule } from '@nestjs/testing';
import { CouponsService } from './coupons.service';
import { CouponsRepository } from './coupons.repository';
import { CouponUsageRepository } from './coupon-usage.repository';
import { CouponType } from './schemas/coupon.schema';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { LIMITS } from '../../common/constants/app.constant';
import { Types } from 'mongoose';

const makeCoupon = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(),
  code: 'SAVE10',
  isActive: true,
  type: CouponType.PERCENT,
  value: 10,
  minOrderAmount: 100000,
  maxDiscountAmount: 50000,
  usageLimit: 100,
  usedCount: 0,
  usagePerUser: 1,
  startDate: null,
  endDate: null,
  applicableProducts: [],
  applicableCategories: [],
  ...overrides,
  toString: () => 'coupon-id',
});

describe('CouponsService', () => {
  let service: CouponsService;

  const couponsRepo = {
    findByCode: jest.fn(),
    findById: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    atomicIncrementUsed: jest.fn(),
    decrementUsed: jest.fn(),
  };

  const couponUsageRepo = {
    countByUserAndCoupon: jest.fn(),
    create: jest.fn(),
    findByOrderId: jest.fn(),
    deleteByOrder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: CouponsRepository, useValue: couponsRepo },
        { provide: CouponUsageRepository, useValue: couponUsageRepo },
      ],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
    jest.clearAllMocks();
    couponUsageRepo.countByUserAndCoupon.mockResolvedValue(0);
  });

  // ── validateCoupon ────────────────────────────────────────────────────────

  describe('validateCoupon', () => {
    const userId = new Types.ObjectId().toString();

    it('returns discount on valid PERCENT coupon', async () => {
      const coupon = makeCoupon();
      couponsRepo.findByCode.mockResolvedValue(coupon);

      const result = await service.validateCoupon('SAVE10', userId, 200000);

      expect(result.isValid).toBe(true);
      expect(result.discountAmount).toBe(20000); // 10% of 200000, capped at 50000
    });

    it('throws COUPON_NOT_FOUND when code does not exist', async () => {
      couponsRepo.findByCode.mockResolvedValue(null);

      await expect(
        service.validateCoupon('NOPE', userId, 200000),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.COUPON_NOT_FOUND });
    });

    it('throws COUPON_INACTIVE when coupon is disabled', async () => {
      couponsRepo.findByCode.mockResolvedValue(makeCoupon({ isActive: false }));

      await expect(
        service.validateCoupon('SAVE10', userId, 200000),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.COUPON_INACTIVE });
    });

    it('throws COUPON_NOT_YET_ACTIVE when before startDate', async () => {
      const future = new Date(Date.now() + 86400000);
      couponsRepo.findByCode.mockResolvedValue(
        makeCoupon({ startDate: future }),
      );

      await expect(
        service.validateCoupon('SAVE10', userId, 200000),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.COUPON_NOT_YET_ACTIVE });
    });

    it('throws COUPON_EXPIRED when past endDate', async () => {
      const past = new Date(Date.now() - 86400000);
      couponsRepo.findByCode.mockResolvedValue(makeCoupon({ endDate: past }));

      await expect(
        service.validateCoupon('SAVE10', userId, 200000),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.COUPON_EXPIRED });
    });

    it('throws COUPON_USAGE_LIMIT_REACHED when global limit hit', async () => {
      couponsRepo.findByCode.mockResolvedValue(
        makeCoupon({ usageLimit: 10, usedCount: 10 }),
      );

      await expect(
        service.validateCoupon('SAVE10', userId, 200000),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.COUPON_USAGE_LIMIT_REACHED,
      });
    });

    it('throws COUPON_USER_LIMIT_REACHED when user already used all slots', async () => {
      couponsRepo.findByCode.mockResolvedValue(makeCoupon({ usagePerUser: 1 }));
      couponUsageRepo.countByUserAndCoupon.mockResolvedValue(1);

      await expect(
        service.validateCoupon('SAVE10', userId, 200000),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.COUPON_USER_LIMIT_REACHED,
      });
    });

    it('throws COUPON_MIN_ORDER_NOT_MET when subtotal too small', async () => {
      couponsRepo.findByCode.mockResolvedValue(
        makeCoupon({ minOrderAmount: 500000 }),
      );

      await expect(
        service.validateCoupon('SAVE10', userId, 100000),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.COUPON_MIN_ORDER_NOT_MET,
      });
    });

    it('throws COUPON_NOT_APPLICABLE when cart items do not match restriction', async () => {
      const productId = new Types.ObjectId();
      couponsRepo.findByCode.mockResolvedValue(
        makeCoupon({ applicableProducts: [productId] }),
      );

      await expect(
        service.validateCoupon('SAVE10', userId, 200000, [
          { productId: new Types.ObjectId().toString() },
        ]),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.COUPON_NOT_APPLICABLE });
    });
  });

  // ── calculateDiscount ─────────────────────────────────────────────────────

  describe('discount calculation (via validateCoupon)', () => {
    const userId = new Types.ObjectId().toString();

    it('PERCENT — applies cap when raw > maxDiscountAmount', async () => {
      // 20% of 1,000,000 = 200,000 > cap 50,000 → should return 50,000
      couponsRepo.findByCode.mockResolvedValue(
        makeCoupon({
          type: CouponType.PERCENT,
          value: 20,
          maxDiscountAmount: 50000,
        }),
      );

      const { discountAmount } = await service.validateCoupon(
        'X',
        userId,
        1000000,
      );
      expect(discountAmount).toBe(50000);
    });

    it('FIXED_AMOUNT — caps at subtotal', async () => {
      couponsRepo.findByCode.mockResolvedValue(
        makeCoupon({
          type: CouponType.FIXED_AMOUNT,
          value: 500000,
          maxDiscountAmount: 0,
        }),
      );

      const { discountAmount } = await service.validateCoupon(
        'X',
        userId,
        200000,
      );
      expect(discountAmount).toBe(200000); // capped at subtotal
    });

    it('FREE_SHIPPING — returns standard shipping fee when subtotal < threshold', async () => {
      couponsRepo.findByCode.mockResolvedValue(
        makeCoupon({
          type: CouponType.FREE_SHIPPING,
          value: 0,
          maxDiscountAmount: 0,
        }),
      );

      const { discountAmount } = await service.validateCoupon(
        'X',
        userId,
        200000,
      );
      expect(discountAmount).toBe(LIMITS.STANDARD_SHIPPING_FEE);
    });

    it('FREE_SHIPPING — returns 0 when already free shipping', async () => {
      couponsRepo.findByCode.mockResolvedValue(
        makeCoupon({
          type: CouponType.FREE_SHIPPING,
          value: 0,
          maxDiscountAmount: 0,
        }),
      );

      // subtotal >= FREE_SHIPPING_THRESHOLD → no shipping fee → discount = 0
      const { discountAmount } = await service.validateCoupon(
        'X',
        userId,
        LIMITS.FREE_SHIPPING_THRESHOLD,
      );
      expect(discountAmount).toBe(0);
    });
  });
});
