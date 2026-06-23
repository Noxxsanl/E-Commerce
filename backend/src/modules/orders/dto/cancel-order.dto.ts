import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelOrderDto {
  @ApiPropertyOptional({ example: 'Tôi muốn đổi địa chỉ giao hàng' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
