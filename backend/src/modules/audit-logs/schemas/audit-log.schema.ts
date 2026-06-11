import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ versionKey: false })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  action!: string;

  @Prop({ required: true })
  resource!: string;

  @Prop()
  resourceId!: string;

  @Prop({ type: Object })
  before!: Record<string, unknown>;

  @Prop({ type: Object })
  after!: Record<string, unknown>;

  @Prop()
  ipAddress!: string;

  @Prop({ default: () => new Date() })
  createdAt!: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ resource: 1, resourceId: 1 });
AuditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 15552000 }, // 180 days
);
