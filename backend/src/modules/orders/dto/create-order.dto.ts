import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from '../schemas/order.schema';

export class CreateOrderDto {
  @ApiProperty({ example: '6655c1234abc1234abc12345' })
  @IsMongoId()
  addressId!: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.COD })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ example: 'SALE20' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ example: 'Giao giờ hành chính' })
  @IsOptional()
  @IsString()
  notes?: string;
}
