import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import { OrderStatus } from '../schemas/order.schema';

export class BulkUpdateStatusDto {
  @ApiProperty({ type: [String], example: ['id1', 'id2'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  orderIds!: string[];

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.CONFIRMED })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
