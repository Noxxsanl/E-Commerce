import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WishlistService, WishlistItemView } from './wishlist.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import type { Types } from 'mongoose';

@ApiTags('Wishlist')
@ApiBearerAuth()
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách yêu thích của tôi (phân trang)' })
  async getWishlist(
    @CurrentUser('_id') userId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResultDto<WishlistItemView>> {
    return this.wishlistService.getWishlist(
      userId,
      pagination.page ?? 1,
      pagination.limit ?? 20,
    );
  }

  @Post(':productId')
  @ApiOperation({ summary: 'Thêm sản phẩm vào wishlist (idempotent)' })
  @ApiResponse({ status: 200, description: 'Đã thêm (hoặc đã có từ trước)' })
  @ApiResponse({ status: 404, description: 'Sản phẩm không tồn tại' })
  async addToWishlist(
    @CurrentUser('_id') userId: string,
    @Param('productId', ParseObjectIdPipe) productId: Types.ObjectId,
  ): Promise<{ message: string }> {
    await this.wishlistService.addToWishlist(userId, productId.toString());
    return { message: 'Đã thêm vào danh sách yêu thích' };
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa sản phẩm khỏi wishlist' })
  async removeFromWishlist(
    @CurrentUser('_id') userId: string,
    @Param('productId', ParseObjectIdPipe) productId: Types.ObjectId,
  ): Promise<{ message: string }> {
    await this.wishlistService.removeFromWishlist(userId, productId.toString());
    return { message: 'Đã xóa khỏi danh sách yêu thích' };
  }

  @Get('check/:productId')
  @ApiOperation({ summary: 'Kiểm tra sản phẩm đã có trong wishlist chưa' })
  async checkWishlisted(
    @CurrentUser('_id') userId: string,
    @Param('productId', ParseObjectIdPipe) productId: Types.ObjectId,
  ): Promise<{ isWishlisted: boolean }> {
    return this.wishlistService.checkWishlisted(userId, productId.toString());
  }
}
