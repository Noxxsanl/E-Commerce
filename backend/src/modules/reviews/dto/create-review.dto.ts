import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LIMITS } from '../../../common/constants/app.constant';

export class CreateReviewDto {
  @ApiProperty({ example: '6655c1234abc1234abc12345' })
  @IsMongoId()
  orderItemId!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiProperty({ example: 'Sản phẩm rất tốt, đúng mô tả' })
  @IsString()
  @MaxLength(2000)
  content!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIMITS.REVIEW_MAX_IMAGES)
  @IsUrl({}, { each: true })
  images?: string[];
}
