import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
class ProductDimensions {
  @Prop()
  length!: number;

  @Prop()
  width!: number;

  @Prop()
  height!: number;
}

export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true, versionKey: false })
export class Product {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true })
  slug!: string;

  @Prop()
  description!: string;

  @Prop()
  shortDescription!: string;

  @Prop({ type: [Types.ObjectId], ref: 'Category', default: [] })
  categories!: Types.ObjectId[];

  @Prop({ trim: true })
  brand!: string;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ default: 0, min: 0, max: 100 })
  discountPercent!: number;

  @Prop({ default: false })
  isFlashSale!: boolean;

  @Prop({ min: 0 })
  flashSalePrice!: number;

  @Prop({ min: 0 })
  flashSaleStock!: number;

  @Prop()
  flashSaleEndAt!: Date;

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop()
  video!: string;

  @Prop()
  thumbnailUrl!: string;

  @Prop({ required: true, default: 0, min: 0 })
  stock!: number;

  @Prop({ trim: true })
  sku!: string;

  @Prop({ min: 0 })
  weight!: number;

  @Prop({ type: ProductDimensions })
  dimensions!: ProductDimensions;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ default: false })
  isFeatured!: boolean;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0, min: 0 })
  soldCount!: number;

  @Prop({ default: 0, min: 0 })
  viewCount!: number;

  @Prop({ default: 0, min: 0, max: 5 })
  averageRating!: number;

  @Prop({ default: 0, min: 0 })
  reviewCount!: number;

  @Prop()
  metaTitle!: string;

  @Prop()
  metaDescription!: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ categories: 1, isActive: 1 });
ProductSchema.index({ isActive: 1, createdAt: -1 });
ProductSchema.index({ isActive: 1, soldCount: -1 });
ProductSchema.index({ isActive: 1, averageRating: -1 });
ProductSchema.index({ isActive: 1, price: 1 });
ProductSchema.index({ isFlashSale: 1, flashSaleEndAt: 1, isActive: 1 });
ProductSchema.index({ isFeatured: 1, isActive: 1 });
ProductSchema.index({ brand: 1, isActive: 1 });
ProductSchema.index(
  { name: 'text', description: 'text', tags: 'text' },
  { weights: { name: 10, tags: 5, description: 1 } },
);
