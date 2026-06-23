import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsProcessor } from './processors/notifications.processor';
import { UsersModule } from '../users/users.module';
import { QUEUE_NAMES } from '../../common/constants/queue.constant';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    UsersModule,
    JwtModule.register({}),
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATION }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsRepository,
    NotificationsGateway,
    NotificationsService,
    NotificationsProcessor,
  ],
  exports: [MongooseModule, NotificationsGateway, NotificationsService],
})
export class NotificationsModule {}
