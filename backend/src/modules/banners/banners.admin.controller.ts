import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BannersService } from './banners.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { ReorderBannersDto } from './dto/reorder-banners.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UserRole } from '../users/schemas/user.schema';
import type { BannerDocument } from './schemas/banner.schema';
import type { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import type { Types } from 'mongoose';

@ApiTags('Admin - Banners')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/banners')
export class BannersAdminController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách tất cả banners (admin)' })
  async findMany(
    @Query() queryDto: PaginationDto,
  ): Promise<PaginatedResultDto<BannerDocument>> {
    return this.bannersService.findMany(queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết banner' })
  async findById(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<BannerDocument> {
    return this.bannersService.findById(id.toString());
  }

  @Post()
  @Audit({ action: 'create', resource: 'banner' })
  @ApiOperation({ summary: 'Tạo banner mới' })
  async create(@Body() dto: CreateBannerDto): Promise<BannerDocument> {
    return this.bannersService.create(dto);
  }

  @Patch(':id')
  @Audit({ action: 'update', resource: 'banner' })
  @ApiOperation({ summary: 'Cập nhật banner' })
  async update(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: UpdateBannerDto,
  ): Promise<BannerDocument> {
    return this.bannersService.update(id.toString(), dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'delete', resource: 'banner' })
  @ApiOperation({ summary: 'Xóa banner' })
  async delete(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<{ message: string }> {
    await this.bannersService.delete(id.toString());
    return { message: 'Đã xóa banner' };
  }

  @Patch('reorder')
  @Audit({ action: 'reorder', resource: 'banner' })
  @ApiOperation({ summary: 'Sắp xếp lại thứ tự banner' })
  async reorder(@Body() dto: ReorderBannersDto): Promise<{ message: string }> {
    await this.bannersService.reorder(dto);
    return { message: 'Đã cập nhật thứ tự banner' };
  }
}
