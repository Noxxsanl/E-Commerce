import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProductsService, ProductWithVariants } from './products.service';
import { Public } from '../../common/decorators/public.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { QueryProductDto } from './dto/query-product.dto';
import { Product } from './schemas/product.schema';
import type { ProductDocument } from './schemas/product.schema';
import type { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import type { Types } from 'mongoose';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Danh sách sản phẩm (filter, search, sort, pagination)',
  })
  @ApiPaginatedResponse(Product)
  async findMany(
    @Query() queryDto: QueryProductDto,
  ): Promise<PaginatedResultDto<ProductDocument>> {
    return this.productsService.findMany(queryDto);
  }

  @Public()
  @Get('flash-sale')
  @ApiOperation({ summary: 'Sản phẩm đang flash sale' })
  async findFlashSale(): Promise<ProductDocument[]> {
    return this.productsService.findFlashSale();
  }

  @Public()
  @Get('featured')
  @ApiOperation({ summary: 'Sản phẩm nổi bật' })
  async findFeatured(
    @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number,
  ): Promise<ProductDocument[]> {
    return this.productsService.findFeatured(limit);
  }

  @Public()
  @Get('best-sellers')
  @ApiOperation({ summary: 'Sản phẩm bán chạy' })
  async findBestSellers(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<ProductDocument[]> {
    return this.productsService.findBestSellers(limit);
  }

  @Public()
  @Get('newest')
  @ApiOperation({ summary: 'Sản phẩm mới nhất' })
  async findNewest(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<ProductDocument[]> {
    return this.productsService.findNewest(limit);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Chi tiết sản phẩm theo slug' })
  @ApiResponse({ status: 404, description: 'Sản phẩm không tồn tại' })
  async findBySlug(@Param('slug') slug: string): Promise<ProductWithVariants> {
    return this.productsService.findBySlug(slug);
  }

  @Public()
  @Get(':id/related')
  @ApiOperation({ summary: 'Sản phẩm liên quan (cùng danh mục)' })
  async findRelated(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number,
  ): Promise<ProductDocument[]> {
    return this.productsService.findRelated(id.toString(), limit);
  }

  @Public()
  @Post(':id/view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ghi nhận lượt xem sản phẩm' })
  async trackView(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Query('sessionId') sessionId?: string,
  ): Promise<{ message: string }> {
    await this.productsService.trackView(id, sessionId);
    return { message: 'Đã ghi nhận lượt xem' };
  }
}
