import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum AddressLabel {
  HOME = 'home',
  OFFICE = 'office',
  OTHER = 'other',
}

@Schema({ _id: false })
class AdminDivision {
  @Prop({ required: true })
  code!: string;

  @Prop({ required: true })
  name!: string;
}

const AdminDivisionSchema = SchemaFactory.createForClass(AdminDivision);

export type AddressDocument = HydratedDocument<Address>;

@Schema({ timestamps: true, versionKey: false })
export class Address {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ required: true, trim: true })
  phone!: string;

  @Prop({ type: AdminDivisionSchema, required: true })
  province!: AdminDivision;

  @Prop({ type: AdminDivisionSchema, required: true })
  district!: AdminDivision;

  @Prop({ type: AdminDivisionSchema, required: true })
  ward!: AdminDivision;

  @Prop({ required: true, trim: true })
  streetAddress!: string;

  @Prop({ default: false })
  isDefault!: boolean;

  @Prop({ type: String, enum: AddressLabel, default: AddressLabel.HOME })
  label!: AddressLabel;
}

export const AddressSchema = SchemaFactory.createForClass(Address);

AddressSchema.index({ userId: 1 });
AddressSchema.index({ userId: 1, isDefault: 1 });
