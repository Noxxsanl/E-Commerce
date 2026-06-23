import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrdersService, OrderWithItems } from './orders.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CreateOrderDto } from './dto/create-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import type { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import type { OrderDocument } from './schemas/order.schema';
import type { Types } from 'mongoose';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Lịch sử đơn hàng của tôi' })
  async getOrders(
    @CurrentUser('_id') userId: string,
    @Query() queryDto: QueryOrderDto,
  ): Promise<PaginatedResultDto<OrderDocument>> {
    return this.ordersService.getOrders(userId, queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đơn hàng' })
  async getOrderById(
    @CurrentUser('_id') userId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<OrderWithItems> {
    return this.ordersService.getOrderById(userId, id.toString());
  }

  @Post()
  @ApiOperation({ summary: 'Tạo đơn hàng mới từ giỏ hàng' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 422, description: 'Hết hàng hoặc giỏ hàng trống' })
  async createOrder(
    @CurrentUser('_id') userId: string,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderWithItems> {
    return this.ordersService.create(userId, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hủy đơn hàng (chỉ khi pending)' })
  async cancelOrder(
    @CurrentUser('_id') userId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: CancelOrderDto,
  ): Promise<OrderWithItems> {
    return this.ordersService.cancelByUser(userId, id.toString(), dto.reason);
  }

  @Post(':id/confirm-received')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác nhận đã nhận hàng (chỉ khi shipping)' })
  async confirmReceived(
    @CurrentUser('_id') userId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<OrderWithItems> {
    return this.ordersService.confirmReceived(userId, id.toString());
  }
}
