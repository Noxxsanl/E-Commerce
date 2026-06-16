import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';

export class ValidateCouponDto {
  @ApiProperty({ example: 'GIAM20' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 500000 })
  @IsNumber()
  @Min(0)
  subtotal!: number;
}
