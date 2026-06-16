import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductDimensionsDto } from './product-dimensions.dto';

export class CreateProductDto {
  @ApiProperty({ example: 'Áo thun nam basic' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Áo thun cotton 100% thoáng mát' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Áo thun nam chất liệu cotton' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  shortDescription?: string;

  @ApiProperty({ type: [String], example: ['64f1a2b3c4d5e6f7a8b9c0d1'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  categories!: string[];

  @ApiPropertyOptional({ example: 'Uniqlo' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiProperty({ example: 199000 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isFlashSale?: boolean;

  @ApiPropertyOptional({ example: 149000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  flashSalePrice?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  flashSaleStock?: number;

  @ApiPropertyOptional({ example: '2025-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  flashSaleEndAt?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  video?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiProperty({ example: 200 })
  @IsNumber()
  @Min(0)
  stock!: number;

  @ApiPropertyOptional({ example: 'SKU-AO-001' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ example: 0.3 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ type: ProductDimensionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDimensionsDto)
  dimensions?: ProductDimensionsDto;

  @ApiPropertyOptional({ type: [String], example: ['áo nam', 'basic'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(70)
  metaTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  metaDescription?: string;
}
