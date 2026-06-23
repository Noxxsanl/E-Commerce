import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  NotificationsService,
  NotificationsListResult,
} from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { QueryNotificationDto } from './dto/query-notification.dto';
import type { NotificationDocument } from './schemas/notification.schema';
import type { Types } from 'mongoose';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách thông báo của tôi' })
  async getNotifications(
    @CurrentUser('_id') userId: string,
    @Query() queryDto: QueryNotificationDto,
  ): Promise<NotificationsListResult> {
    return this.notificationsService.getNotifications(userId, queryDto);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu đã đọc một thông báo' })
  async markRead(
    @CurrentUser('_id') userId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<NotificationDocument> {
    return this.notificationsService.markRead(userId, id.toString());
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu tất cả đã đọc' })
  async markAllRead(
    @CurrentUser('_id') userId: string,
  ): Promise<{ message: string }> {
    await this.notificationsService.markAllRead(userId);
    return { message: 'Đã đánh dấu tất cả là đã đọc' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa thông báo' })
  async delete(
    @CurrentUser('_id') userId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<{ message: string }> {
    await this.notificationsService.delete(userId, id.toString());
    return { message: 'Đã xóa thông báo' };
  }
}
