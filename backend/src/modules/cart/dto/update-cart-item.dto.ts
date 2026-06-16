import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({ example: 2, minimum: 0, description: '0 = xóa item khỏi giỏ' })
  @IsInt()
  @Min(0)
  quantity!: number;
}
