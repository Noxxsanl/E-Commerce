import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
class WishlistItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ default: () => new Date() })
  addedAt!: Date;
}

const WishlistItemSchema = SchemaFactory.createForClass(WishlistItem);

export type WishlistDocument = HydratedDocument<Wishlist>;

@Schema({ timestamps: true, versionKey: false })
export class Wishlist {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ type: [WishlistItemSchema], default: [] })
  items!: WishlistItem[];
}

export const WishlistSchema = SchemaFactory.createForClass(Wishlist);

WishlistSchema.index({ userId: 1 }, { unique: true });
WishlistSchema.index({ 'items.productId': 1 });
