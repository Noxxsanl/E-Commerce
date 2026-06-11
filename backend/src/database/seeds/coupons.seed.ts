import { Connection } from 'mongoose';
import {
  CouponSchema,
  CouponType,
} from '../../modules/coupons/schemas/coupon.schema';

const couponsData = [
  {
    code: 'GIAM20',
    description: 'Giảm 20% cho đơn hàng từ 500.000đ, tối đa 100.000đ',
    type: CouponType.PERCENT,
    value: 20,
    minOrderAmount: 500000,
    maxDiscountAmount: 100000,
    usageLimit: 1000,
    usagePerUser: 1,
    usedCount: 0,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2026-12-31'),
    isActive: true,
  },
  {
    code: 'GIAM50K',
    description: 'Giảm 50.000đ cho đơn hàng từ 300.000đ',
    type: CouponType.FIXED_AMOUNT,
    value: 50000,
    minOrderAmount: 300000,
    usageLimit: 500,
    usagePerUser: 2,
    usedCount: 0,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2026-12-31'),
    isActive: true,
  },
  {
    code: 'FREESHIP',
    description: 'Miễn phí vận chuyển cho đơn hàng từ 200.000đ',
    type: CouponType.FREE_SHIPPING,
    value: 0,
    minOrderAmount: 200000,
    usageLimit: 2000,
    usagePerUser: 3,
    usedCount: 0,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2026-12-31'),
    isActive: true,
  },
];

export async function seedCoupons(connection: Connection): Promise<void> {
  const CouponModel = connection.model('Coupon', CouponSchema);

  for (const couponData of couponsData) {
    const existing = await CouponModel.findOne({ code: couponData.code });
    if (existing) {
      console.log(`[Seed] Coupon already exists: ${couponData.code}`);
      continue;
    }

    await CouponModel.create(couponData);
    console.log(`[Seed] Created coupon: ${couponData.code}`);
  }
}
