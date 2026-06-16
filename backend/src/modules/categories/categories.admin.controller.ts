import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from './categories.repository';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UserRole } from '../users/schemas/user.schema';
import type { CategoryDocument } from './schemas/category.schema';
import type { Types } from 'mongoose';

@ApiTags('Admin - Categories')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/categories')
export class CategoriesAdminController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly categoriesRepository: CategoriesRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách tất cả danh mục (admin)' })
  async findAll(): Promise<CategoryDocument[]> {
    return this.categoriesRepository.findAll();
  }

  @Post()
  @Audit({ action: 'create', resource: 'category' })
  @ApiOperation({ summary: 'Tạo danh mục mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  async create(@Body() dto: CreateCategoryDto): Promise<CategoryDocument> {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @Audit({ action: 'update', resource: 'category' })
  @ApiOperation({ summary: 'Cập nhật danh mục' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  async update(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryDocument> {
    return this.categoriesService.update(id.toString(), dto);
  }

  @Delete(':id')
  @Audit({ action: 'delete', resource: 'category' })
  @ApiOperation({ summary: 'Xóa danh mục' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({
    status: 422,
    description: 'Danh mục còn sản phẩm hoặc danh mục con',
  })
  async delete(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<{ message: string }> {
    await this.categoriesService.delete(id.toString());
    return { message: 'Xóa danh mục thành công' };
  }
}
