import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BannersService } from './banners.service';
import { Public } from '../../common/decorators/public.decorator';
import { BannerDocument, BannerType } from './schemas/banner.schema';
import { IsEnum, IsOptional } from 'class-validator';

class BannersQueryDto {
  @IsOptional()
  @IsEnum(BannerType)
  type?: BannerType;
}

@ApiTags('Banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Danh sách banners đang active' })
  @ApiQuery({ name: 'type', enum: BannerType, required: false })
  async getActiveBanners(
    @Query() query: BannersQueryDto,
  ): Promise<BannerDocument[]> {
    return this.bannersService.getActiveBanners(query.type);
  }
}
