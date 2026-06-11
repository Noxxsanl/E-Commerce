import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum PaymentMethod {
  COD = 'cod',
  BANK_TRANSFER = 'bank_transfer',
  MOMO = 'momo',
  VNPAY = 'vnpay',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  SHIPPING = 'shipping',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
}

@Schema({ _id: false })
class ShippingAddressSnapshot {
  @Prop({ required: true })
  fullName!: string;

  @Prop({ required: true })
  phone!: string;

  @Prop({ required: true })
  province!: string;

  @Prop({ required: true })
  district!: string;

  @Prop({ required: true })
  ward!: string;

  @Prop({ required: true })
  streetAddress!: string;
}

@Schema({ _id: false })
class StatusHistoryEntry {
  @Prop({ type: String, enum: OrderStatus, required: true })
  status!: OrderStatus;

  @Prop({ required: true })
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy!: Types.ObjectId;

  @Prop()
  note!: string;
}

const ShippingAddressSnapshotSchema = SchemaFactory.createForClass(
  ShippingAddressSnapshot,
);
const StatusHistoryEntrySchema =
  SchemaFactory.createForClass(StatusHistoryEntry);

export type OrderDocument = HydratedDocument<Order>;

@Schema({ timestamps: true, versionKey: false })
export class Order {
  @Prop({ required: true, unique: true })
  orderCode!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: ShippingAddressSnapshotSchema, required: true })
  shippingAddress!: ShippingAddressSnapshot;

  @Prop({ required: true, min: 0 })
  subtotal!: number;

  @Prop({ default: 0, min: 0 })
  shippingFee!: number;

  @Prop({ default: 0, min: 0 })
  discountAmount!: number;

  @Prop()
  couponCode!: string;

  @Prop({ required: true, min: 0 })
  totalAmount!: number;

  @Prop({ type: String, enum: PaymentMethod, required: true })
  paymentMethod!: PaymentMethod;

  @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus!: PaymentStatus;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.PENDING })
  status!: OrderStatus;

  @Prop({ type: [StatusHistoryEntrySchema], default: [] })
  statusHistory!: StatusHistoryEntry[];

  @Prop()
  notes!: string;

  @Prop()
  cancelReason!: string;

  @Prop()
  expectedDeliveryAt!: Date;

  @Prop()
  deliveredAt!: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ orderCode: 1 }, { unique: true });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
