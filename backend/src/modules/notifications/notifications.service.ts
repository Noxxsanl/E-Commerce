import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsGateway } from './notifications.gateway';
import {
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';

export interface CreateNotificationData {
  userId?: string;
  type?: string;
  title: string;
  message: string;
  link?: string;
  data?: Record<string, unknown>;
}

export interface NotificationsListResult extends PaginatedResultDto<NotificationDocument> {
  unreadCount: number;
}

const TYPE_MAP: Record<string, NotificationType> = {
  order_confirmed: NotificationType.ORDER_CONFIRMED,
  order_shipping: NotificationType.ORDER_SHIPPING,
  order_delivered: NotificationType.ORDER_DELIVERED,
  order_cancelled: NotificationType.ORDER_CANCELLED,
  review_approved: NotificationType.REVIEW_APPROVED,
  flash_sale: NotificationType.FLASH_SALE,
  promotion: NotificationType.PROMOTION,
};

function toNotificationType(raw?: string): NotificationType {
  if (!raw) return NotificationType.SYSTEM;
  return TYPE_MAP[raw] ?? NotificationType.SYSTEM;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly gateway: NotificationsGateway,
  ) {}

  async getNotifications(
    userId: string,
    queryDto: QueryNotificationDto,
  ): Promise<NotificationsListResult> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const filter: Record<string, unknown> = {};
    if (queryDto.isRead !== undefined) filter.isRead = queryDto.isRead;

    const [{ items, total }, unreadCount] = await Promise.all([
      this.notificationsRepository.findByUserId(userId, filter, {
        page,
        limit,
      }),
      this.notificationsRepository.countUnread(userId),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    };
  }

  async markRead(userId: string, id: string): Promise<NotificationDocument> {
    const updated = await this.notificationsRepository.markRead(id, userId);
    if (!updated) {
      throw new BusinessException(
        ErrorCodes.NOTIFICATION_NOT_FOUND,
        'Thông báo không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }
    return updated;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationsRepository.markAllRead(userId);
  }

  async delete(userId: string, id: string): Promise<void> {
    const deleted = await this.notificationsRepository.delete(id, userId);
    if (!deleted) {
      throw new BusinessException(
        ErrorCodes.NOTIFICATION_NOT_FOUND,
        'Thông báo không tồn tại hoặc không thuộc về bạn',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async createNotification(
    data: CreateNotificationData,
  ): Promise<NotificationDocument | null> {
    if (!data.userId) {
      this.logger.warn(
        '[NotificationsService] createNotification called without userId — skip',
      );
      return null;
    }

    const notification = await this.notificationsRepository.create({
      userId: new Types.ObjectId(data.userId),
      type: toNotificationType(data.type),
      title: data.title,
      message: data.message,
      link: data.link ?? '',
      data: data.data ?? {},
      isRead: false,
    });

    // Emit realtime via socket
    this.gateway.emitToUser(data.userId, 'notification:new', {
      _id: notification._id.toString(),
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      data: notification.data,
      isRead: notification.isRead,
      createdAt: (notification as NotificationDocument & { createdAt?: Date })
        .createdAt,
    });

    return notification;
  }
}
