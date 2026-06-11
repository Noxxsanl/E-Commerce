import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum OtpTokenType {
  VERIFY_EMAIL = 'verify_email',
  RESET_PASSWORD = 'reset_password',
}

export type OtpTokenDocument = HydratedDocument<OtpToken>;

@Schema({ timestamps: true, versionKey: false })
export class OtpToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  token!: string;

  @Prop({ type: String, enum: OtpTokenType, required: true })
  type!: OtpTokenType;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: false })
  used!: boolean;
}

export const OtpTokenSchema = SchemaFactory.createForClass(OtpToken);

OtpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
OtpTokenSchema.index({ userId: 1, type: 1 });
