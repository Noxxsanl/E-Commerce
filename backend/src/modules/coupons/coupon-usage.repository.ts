import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import {
  CouponUsage,
  CouponUsageDocument,
} from './schemas/coupon-usage.schema';

@Injectable()
export class CouponUsageRepository {
  constructor(
    @InjectModel(CouponUsage.name)
    private readonly couponUsageModel: Model<CouponUsage>,
  ) {}

  async create(
    data: Partial<CouponUsage>,
    session?: ClientSession,
  ): Promise<CouponUsageDocument> {
    const [usage] = await this.couponUsageModel.create([data], { session });
    return usage;
  }

  async countByUserAndCoupon(
    userId: string | Types.ObjectId,
    couponId: string | Types.ObjectId,
  ): Promise<number> {
    return this.couponUsageModel.countDocuments({ userId, couponId }).exec();
  }

  async findByOrderId(
    orderId: string | Types.ObjectId,
  ): Promise<CouponUsageDocument | null> {
    return this.couponUsageModel.findOne({ orderId }).exec();
  }

  async deleteByOrder(orderId: string | Types.ObjectId): Promise<void> {
    await this.couponUsageModel.deleteOne({ orderId }).exec();
  }
}
