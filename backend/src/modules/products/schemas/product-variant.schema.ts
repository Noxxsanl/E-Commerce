import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
class VariantOption {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  value!: string;
}

const VariantOptionSchema = SchemaFactory.createForClass(VariantOption);

export type ProductVariantDocument = HydratedDocument<ProductVariant>;

@Schema({ timestamps: true, versionKey: false })
export class ProductVariant {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ type: [VariantOptionSchema], default: [] })
  options!: VariantOption[];

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ default: 0, min: 0, max: 100 })
  discountPercent!: number;

  @Prop({ required: true, default: 0, min: 0 })
  stock!: number;

  @Prop({ trim: true })
  sku!: string;

  @Prop()
  image!: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export const ProductVariantSchema =
  SchemaFactory.createForClass(ProductVariant);

ProductVariantSchema.index({ productId: 1 });
ProductVariantSchema.index({ productId: 1, isActive: 1 });
