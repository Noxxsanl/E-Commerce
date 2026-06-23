import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class HideReviewDto {
  @ApiPropertyOptional({ example: 'Vi phạm tiêu chuẩn cộng đồng' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}
