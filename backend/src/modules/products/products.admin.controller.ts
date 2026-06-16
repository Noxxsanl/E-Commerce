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
import { ProductsService } from './products.service';
import { ProductsRepository } from './products.repository';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { UserRole } from '../users/schemas/user.schema';
import type { ProductDocument } from './schemas/product.schema';
import type { ProductVariantDocument } from './schemas/product-variant.schema';
import type { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import type { Types } from 'mongoose';

@ApiTags('Admin - Products')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/products')
export class ProductsAdminController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productsRepository: ProductsRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách sản phẩm (admin, có filter)' })
  async findMany(
    @Query() queryDto: QueryProductDto,
  ): Promise<PaginatedResultDto<ProductDocument>> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const { items, total } = await this.productsRepository.findMany(
      {},
      { createdAt: -1 },
      { page, limit },
    );
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết sản phẩm theo ID (admin)' })
  async findById(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<ProductDocument | null> {
    return this.productsRepository.findById(id.toString());
  }

  @Post()
  @Audit({ action: 'create', resource: 'product' })
  @ApiOperation({ summary: 'Tạo sản phẩm mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  async create(
    @CurrentUser('_id') adminId: string,
    @Body() dto: CreateProductDto,
  ): Promise<ProductDocument> {
    return this.productsService.create(dto, adminId);
  }

  @Patch(':id')
  @Audit({ action: 'update', resource: 'product' })
  @ApiOperation({ summary: 'Cập nhật sản phẩm' })
  async update(
    @CurrentUser('_id') adminId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductDocument> {
    return this.productsService.update(id.toString(), dto, adminId);
  }

  @Delete(':id')
  @Audit({ action: 'delete', resource: 'product' })
  @ApiOperation({ summary: 'Xóa (soft delete) sản phẩm' })
  async delete(
    @CurrentUser('_id') adminId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<{ message: string }> {
    await this.productsService.delete(id.toString(), adminId);
    return { message: 'Xóa sản phẩm thành công' };
  }

  @Patch(':id/toggle-active')
  @Audit({ action: 'toggle-active', resource: 'product' })
  @ApiOperation({ summary: 'Bật/tắt trạng thái active' })
  async toggleActive(
    @CurrentUser('_id') adminId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<ProductDocument> {
    return this.productsService.toggleActive(id.toString(), adminId);
  }

  @Post(':id/variants')
  @Audit({ action: 'create', resource: 'product-variant' })
  @ApiOperation({ summary: 'Thêm biến thể sản phẩm' })
  async addVariant(
    @CurrentUser('_id') adminId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: CreateVariantDto,
  ): Promise<ProductVariantDocument> {
    return this.productsService.addVariant(id.toString(), dto, adminId);
  }

  @Patch(':id/variants/:variantId')
  @Audit({ action: 'update', resource: 'product-variant' })
  @ApiOperation({ summary: 'Cập nhật biến thể sản phẩm' })
  async updateVariant(
    @CurrentUser('_id') adminId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Param('variantId', ParseObjectIdPipe) variantId: Types.ObjectId,
    @Body() dto: UpdateVariantDto,
  ): Promise<ProductVariantDocument> {
    return this.productsService.updateVariant(
      id.toString(),
      variantId.toString(),
      dto,
      adminId,
    );
  }

  @Delete(':id/variants/:variantId')
  @Audit({ action: 'delete', resource: 'product-variant' })
  @ApiOperation({ summary: 'Xóa biến thể sản phẩm' })
  async deleteVariant(
    @CurrentUser('_id') adminId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Param('variantId', ParseObjectIdPipe) variantId: Types.ObjectId,
  ): Promise<{ message: string }> {
    await this.productsService.deleteVariant(
      id.toString(),
      variantId.toString(),
      adminId,
    );
    return { message: 'Xóa biến thể thành công' };
  }
}
