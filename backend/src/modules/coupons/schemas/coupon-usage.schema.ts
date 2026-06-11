import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CouponUsageDocument = HydratedDocument<CouponUsage>;

@Schema({ timestamps: true, versionKey: false })
export class CouponUsage {
  @Prop({ type: Types.ObjectId, ref: 'Coupon', required: true })
  couponId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  discountAmount!: number;
}

export const CouponUsageSchema = SchemaFactory.createForClass(CouponUsage);

CouponUsageSchema.index({ couponId: 1, userId: 1 });
CouponUsageSchema.index({ orderId: 1 });
