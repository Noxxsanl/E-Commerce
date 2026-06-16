import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AdminDivisionDto {
  @ApiProperty({ example: '01' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Hà Nội' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
