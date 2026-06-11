import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ timestamps: true, versionKey: false })
export class Category {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true })
  slug!: string;

  @Prop()
  description!: string;

  @Prop()
  image!: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null })
  parentId!: Types.ObjectId | null;

  @Prop({ default: 0 })
  order!: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ parentId: 1, isActive: 1 });
