import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Coupon, CouponSchema } from './schemas/coupon.schema';
import { CouponUsage, CouponUsageSchema } from './schemas/coupon-usage.schema';
import { CouponsRepository } from './coupons.repository';
import { CouponUsageRepository } from './coupon-usage.repository';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';
import { CouponsAdminController } from './coupons.admin.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Coupon.name, schema: CouponSchema },
      { name: CouponUsage.name, schema: CouponUsageSchema },
    ]),
  ],
  controllers: [CouponsController, CouponsAdminController],
  providers: [CouponsRepository, CouponUsageRepository, CouponsService],
  exports: [
    MongooseModule,
    CouponsRepository,
    CouponUsageRepository,
    CouponsService,
  ],
})
export class CouponsModule {}
