import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { OrderStatus } from '../schemas/order.schema';

export class QueryOrderDto extends PaginationDto {
  @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.PENDING })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

export class QueryAdminOrderDto extends PaginationDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ example: 'ORD-20240101-00001' })
  @IsOptional()
  @IsString()
  orderCode?: string;

  @ApiPropertyOptional({ example: '6655c1234abc1234abc12345' })
  @IsOptional()
  @IsString()
  userId?: string;
}
