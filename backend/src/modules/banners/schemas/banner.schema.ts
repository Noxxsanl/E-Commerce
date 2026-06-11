import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum BannerType {
  HERO = 'hero',
  FLASH_SALE = 'flash_sale',
  CATEGORY = 'category',
  PROMOTION = 'promotion',
}

export type BannerDocument = HydratedDocument<Banner>;

@Schema({ timestamps: true, versionKey: false })
export class Banner {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true })
  imageUrl!: string;

  @Prop()
  mobileImageUrl!: string;

  @Prop()
  linkUrl!: string;

  @Prop({ type: String, enum: BannerType, required: true })
  type!: BannerType;

  @Prop({ default: 0 })
  order!: number;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  startAt!: Date;

  @Prop()
  endAt!: Date;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);

BannerSchema.index({ type: 1, isActive: 1, order: 1 });
