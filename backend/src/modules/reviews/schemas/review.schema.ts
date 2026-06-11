import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

@Schema({ timestamps: true, versionKey: false })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'OrderItem',
    required: true,
    unique: true,
  })
  orderItemId!: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ required: true, trim: true })
  content!: string;

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop({ default: false })
  isApproved!: boolean;

  @Prop({ default: false })
  isHidden!: boolean;

  @Prop()
  adminNote!: string;

  @Prop({ default: 0, min: 0 })
  helpfulCount!: number;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  helpfulVoters!: Types.ObjectId[];
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

ReviewSchema.index({ orderItemId: 1 }, { unique: true });
ReviewSchema.index({ productId: 1, isApproved: 1, isHidden: 1 });
ReviewSchema.index({ userId: 1 });
