import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class QueryRevenueDto {
  @ApiProperty({ enum: ['day', 'month'], description: 'Granularity' })
  @IsEnum(['day', 'month'])
  period!: 'day' | 'month';

  @ApiPropertyOptional({ example: 2025 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Type(() => Number)
  year?: number;

  @ApiPropertyOptional({ example: 12, description: 'Required when period=day' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month?: number;
}

export class QueryOrderStatsDto {
  @ApiPropertyOptional({ example: '2025-11-15' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-12-15' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;
}

export class QueryBestSellersDto {
  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ enum: ['7d', '30d', '90d'], default: '30d' })
  @IsOptional()
  @IsEnum(['7d', '30d', '90d'])
  period?: '7d' | '30d' | '90d';
}

export class QueryRecentUsersDto {
  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  limit?: number;
}

export class QueryPendingReviewsDto {
  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;
}
