import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
  MODERATOR = 'moderator',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  LOCKED = 'locked',
}

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, versionKey: false })
export class User {
  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ select: false })
  password!: string;

  @Prop({ trim: true })
  phone!: string;

  @Prop()
  avatar!: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Prop({ type: String, enum: UserStatus, default: UserStatus.INACTIVE })
  status!: UserStatus;

  @Prop({ default: false })
  isEmailVerified!: boolean;

  @Prop()
  lastLoginAt!: Date;

  @Prop()
  lockedAt!: Date;

  @Prop()
  lockedReason!: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ createdAt: -1 });

UserSchema.set('toJSON', {
  transform: function (_doc, ret) {
    Reflect.deleteProperty(ret, 'password');
    return ret;
  },
});
