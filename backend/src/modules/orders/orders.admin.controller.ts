import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { OrdersService, OrderWithItems } from './orders.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { BulkUpdateStatusDto } from './dto/bulk-update-status.dto';
import { ExportOrderQueryDto } from './dto/export-order-query.dto';
import { QueryAdminOrderDto } from './dto/query-order.dto';
import { UserRole } from '../users/schemas/user.schema';
import type { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import type { OrderDocument } from './schemas/order.schema';
import type { Types } from 'mongoose';

@ApiTags('Admin - Orders')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/orders')
export class OrdersAdminController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách tất cả đơn hàng (admin)' })
  async findMany(
    @Query() queryDto: QueryAdminOrderDto,
  ): Promise<PaginatedResultDto<OrderDocument>> {
    return this.ordersService.getAdminOrders(queryDto);
  }

  @Get('export')
  @ApiOperation({ summary: 'Xuất đơn hàng ra file CSV' })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportOrders(
    @Query() queryDto: ExportOrderQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.ordersService.exportOrders(queryDto);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=orders-${date}.csv`,
    );
    res.send('﻿' + csv); // BOM for Excel UTF-8 compatibility
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đơn hàng (admin)' })
  async findById(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<OrderWithItems> {
    return this.ordersService.getAdminOrderById(id.toString());
  }

  @Patch(':id/status')
  @Audit({ action: 'update_status', resource: 'order' })
  @ApiOperation({ summary: 'Cập nhật trạng thái đơn hàng' })
  async updateStatus(
    @CurrentUser('_id') adminId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderWithItems> {
    return this.ordersService.updateStatus(id.toString(), dto, adminId);
  }

  @Patch('bulk-status')
  @Audit({ action: 'bulk_update_status', resource: 'order' })
  @ApiOperation({ summary: 'Cập nhật trạng thái nhiều đơn hàng cùng lúc' })
  async bulkUpdateStatus(
    @CurrentUser('_id') adminId: string,
    @Body() dto: BulkUpdateStatusDto,
  ): Promise<{ updated: number; failed: string[] }> {
    return this.ordersService.bulkUpdateStatus(dto, adminId);
  }
}
