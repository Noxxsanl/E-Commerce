import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { BannerType } from '../schemas/banner.schema';

export class CreateBannerDto {
  @ApiProperty({ example: 'Flash Sale Hè 2024' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 'https://res.cloudinary.com/.../banner.jpg' })
  @IsUrl()
  imageUrl!: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/.../mobile.jpg' })
  @IsOptional()
  @IsUrl()
  mobileImageUrl?: string;

  @ApiPropertyOptional({ example: '/flash-sale' })
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiProperty({ enum: BannerType, example: BannerType.HERO })
  @IsEnum(BannerType)
  type!: BannerType;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2024-06-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ example: '2024-06-30T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endAt?: string;
}
