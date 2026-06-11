import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum CouponType {
  PERCENT = 'percent',
  FIXED_AMOUNT = 'fixed_amount',
  FREE_SHIPPING = 'free_shipping',
}

export type CouponDocument = HydratedDocument<Coupon>;

@Schema({ timestamps: true, versionKey: false })
export class Coupon {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code!: string;

  @Prop()
  description!: string;

  @Prop({ type: String, enum: CouponType, required: true })
  type!: CouponType;

  @Prop({ required: true, min: 0 })
  value!: number;

  @Prop({ default: 0, min: 0 })
  minOrderAmount!: number;

  @Prop({ min: 0 })
  maxDiscountAmount!: number;

  @Prop({ default: 0, min: 0 })
  usageLimit!: number;

  @Prop({ default: 1, min: 1 })
  usagePerUser!: number;

  @Prop({ default: 0, min: 0 })
  usedCount!: number;

  @Prop({ type: [Types.ObjectId], ref: 'Product', default: [] })
  applicableProducts!: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'Category', default: [] })
  applicableCategories!: Types.ObjectId[];

  @Prop()
  startDate!: Date;

  @Prop()
  endDate!: Date;

  @Prop({ default: true })
  isActive!: boolean;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);

CouponSchema.index({ code: 1 }, { unique: true });
CouponSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
