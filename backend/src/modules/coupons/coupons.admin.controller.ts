import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { QueryCouponDto } from './dto/query-coupon.dto';
import { UserRole } from '../users/schemas/user.schema';
import type { CouponDocument } from './schemas/coupon.schema';
import type { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import type { Types } from 'mongoose';

@ApiTags('Admin - Coupons')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/coupons')
export class CouponsAdminController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách coupon (admin, phân trang)' })
  async findMany(
    @Query() queryDto: QueryCouponDto,
  ): Promise<PaginatedResultDto<CouponDocument>> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const filter: Record<string, unknown> = {};
    if (queryDto.isActive !== undefined) filter.isActive = queryDto.isActive;
    if (queryDto.search) {
      filter.code = { $regex: queryDto.search.toUpperCase(), $options: 'i' };
    }
    return this.couponsService.findMany(filter, { page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết coupon' })
  async findById(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<CouponDocument> {
    return this.couponsService.findById(id.toString());
  }

  @Post()
  @Audit({ action: 'create', resource: 'coupon' })
  @ApiOperation({ summary: 'Tạo coupon mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  async create(@Body() dto: CreateCouponDto): Promise<CouponDocument> {
    return this.couponsService.create(dto);
  }

  @Patch(':id')
  @Audit({ action: 'update', resource: 'coupon' })
  @ApiOperation({ summary: 'Cập nhật coupon' })
  async update(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: UpdateCouponDto,
  ): Promise<CouponDocument> {
    return this.couponsService.update(id.toString(), dto);
  }

  @Delete(':id')
  @Audit({ action: 'delete', resource: 'coupon' })
  @ApiOperation({ summary: 'Xóa coupon' })
  async delete(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<{ message: string }> {
    await this.couponsService.delete(id.toString());
    return { message: 'Xóa coupon thành công' };
  }
}
