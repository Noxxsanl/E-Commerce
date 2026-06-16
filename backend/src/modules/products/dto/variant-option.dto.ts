import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class VariantOptionDto {
  @ApiProperty({ example: 'Màu sắc' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Đỏ' })
  @IsString()
  @IsNotEmpty()
  value!: string;
}
