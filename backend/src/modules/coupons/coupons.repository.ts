import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Coupon, CouponDocument } from './schemas/coupon.schema';

@Injectable()
export class CouponsRepository {
  constructor(
    @InjectModel(Coupon.name) private readonly couponModel: Model<Coupon>,
  ) {}

  async findByCode(code: string): Promise<CouponDocument | null> {
    return this.couponModel.findOne({ code: code.toUpperCase() }).exec();
  }

  async findById(id: string | Types.ObjectId): Promise<CouponDocument | null> {
    return this.couponModel.findById(id).exec();
  }

  async findMany(
    filter: Record<string, unknown>,
    pagination: { page: number; limit: number },
  ): Promise<{ items: CouponDocument[]; total: number }> {
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      this.couponModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .exec(),
      this.couponModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async create(data: Partial<Coupon>): Promise<CouponDocument> {
    return this.couponModel.create(data);
  }

  async update(
    id: string | Types.ObjectId,
    data: Partial<Coupon>,
  ): Promise<CouponDocument | null> {
    return this.couponModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string | Types.ObjectId): Promise<void> {
    await this.couponModel.deleteOne({ _id: id }).exec();
  }

  /**
   * Tăng usedCount atomic — chỉ thành công nếu chưa đạt usageLimit
   * (usageLimit = 0 nghĩa là không giới hạn). Trả về null nếu đã hết lượt
   * (race lost), giúp caller phát hiện và rollback transaction.
   */
  async atomicIncrementUsed(
    couponId: string | Types.ObjectId,
    session?: ClientSession,
  ): Promise<CouponDocument | null> {
    return this.couponModel
      .findOneAndUpdate(
        {
          _id: couponId,
          $expr: {
            $or: [
              { $eq: ['$usageLimit', 0] },
              { $lt: ['$usedCount', '$usageLimit'] },
            ],
          },
        },
        { $inc: { usedCount: 1 } },
        { new: true, session },
      )
      .exec();
  }

  async decrementUsed(couponId: string | Types.ObjectId): Promise<void> {
    await this.couponModel
      .updateOne(
        { _id: couponId, usedCount: { $gt: 0 } },
        { $inc: { usedCount: -1 } },
      )
      .exec();
  }
}
