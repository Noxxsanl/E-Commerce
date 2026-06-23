import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  QUEUE_NAMES,
  NOTIFICATION_JOBS,
} from '../../../common/constants/queue.constant';
import {
  NotificationsService,
  CreateNotificationData,
} from '../notifications.service';

interface BulkNotificationData {
  userIds: string[];
  type?: string;
  title: string;
  message: string;
  link?: string;
  data?: Record<string, unknown>;
}

@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case NOTIFICATION_JOBS.CREATE_NOTIFICATION: {
        const data = job.data as CreateNotificationData;
        await this.notificationsService.createNotification(data);
        break;
      }
      case NOTIFICATION_JOBS.CREATE_BULK_NOTIFICATIONS: {
        const data = job.data as BulkNotificationData;
        for (const userId of data.userIds) {
          await this.notificationsService.createNotification({
            userId,
            type: data.type,
            title: data.title,
            message: data.message,
            link: data.link,
            data: data.data,
          });
        }
        this.logger.log(
          `[NotificationsProcessor] Bulk sent to ${data.userIds.length} users`,
        );
        break;
      }
      default:
        this.logger.warn(`[NotificationsProcessor] Unknown job: ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.error(
      `[NotificationsProcessor] Job "${job.name}" #${job.id} failed: ${err.message}`,
    );
  }
}
