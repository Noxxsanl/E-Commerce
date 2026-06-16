import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CategoriesService, CategoryTreeNode } from './categories.service';
import { Public } from '../../common/decorators/public.decorator';
import type { CategoryDocument } from './schemas/category.schema';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy cây danh mục (2 cấp)' })
  @ApiResponse({ status: 200, description: 'Danh sách danh mục dạng cây' })
  async getTree(): Promise<CategoryTreeNode[]> {
    return this.categoriesService.getCategoryTree();
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Lấy danh mục theo slug' })
  @ApiResponse({ status: 200, description: 'Thông tin danh mục' })
  @ApiResponse({ status: 404, description: 'Danh mục không tồn tại' })
  async getBySlug(@Param('slug') slug: string): Promise<CategoryDocument> {
    return this.categoriesService.getCategoryBySlug(slug);
  }
}
