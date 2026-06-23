import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';

@Injectable()
export class NotificationsRepository {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {}

  async findByUserId(
    userId: string | Types.ObjectId,
    filter: Record<string, unknown>,
    pagination: { page: number; limit: number },
  ): Promise<{ items: NotificationDocument[]; total: number }> {
    const query = { userId, ...filter };
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      this.notificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .exec(),
      this.notificationModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  async countUnread(userId: string | Types.ObjectId): Promise<number> {
    return this.notificationModel
      .countDocuments({ userId, isRead: false })
      .exec();
  }

  async create(data: Partial<Notification>): Promise<NotificationDocument> {
    return this.notificationModel.create(data);
  }

  async markRead(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<NotificationDocument | null> {
    return this.notificationModel
      .findOneAndUpdate({ _id: id, userId }, { isRead: true }, { new: true })
      .exec();
  }

  async markAllRead(userId: string | Types.ObjectId): Promise<void> {
    await this.notificationModel
      .updateMany({ userId, isRead: false }, { isRead: true })
      .exec();
  }

  async delete(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.notificationModel
      .deleteOne({ _id: id, userId })
      .exec();
    return result.deletedCount > 0;
  }
}
