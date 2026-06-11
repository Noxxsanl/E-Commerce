import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderItemDocument = HydratedDocument<OrderItem>;

@Schema({ timestamps: true, versionKey: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ProductVariant' })
  variantId!: Types.ObjectId;

  @Prop({ required: true })
  productName!: string;

  @Prop()
  productImage!: string;

  @Prop({ type: [{ name: String, value: String }], default: [] })
  variantOptions!: { name: string; value: string }[];

  @Prop({ required: true, min: 0 })
  unitPrice!: number;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ required: true, min: 0 })
  totalPrice!: number;

  @Prop({ default: false })
  isReviewed!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Review' })
  reviewId!: Types.ObjectId;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

OrderItemSchema.index({ orderId: 1 });
OrderItemSchema.index({ productId: 1 });
