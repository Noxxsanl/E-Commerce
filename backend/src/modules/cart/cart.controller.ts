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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CartService, EnrichedCart } from './cart.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiTags('Cart')
@ApiBearerAuth()
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy giỏ hàng (đã enrich tình trạng tồn kho/giá)' })
  async getCart(@CurrentUser('_id') userId: string): Promise<EnrichedCart> {
    return this.cartService.getCart(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Thêm sản phẩm vào giỏ hàng' })
  @ApiResponse({ status: 200, description: 'Thêm thành công' })
  @ApiResponse({
    status: 422,
    description: 'Vượt tồn kho hoặc giỏ hàng đã đầy',
  })
  async addItem(
    @CurrentUser('_id') userId: string,
    @Body() dto: AddCartItemDto,
  ): Promise<EnrichedCart> {
    return this.cartService.addItem(userId, dto);
  }

  @Patch(':itemId')
  @ApiOperation({ summary: 'Cập nhật số lượng (quantity=0 sẽ xóa item)' })
  async updateItem(
    @CurrentUser('_id') userId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<EnrichedCart> {
    return this.cartService.updateItem(userId, itemId, dto.quantity);
  }

  @Delete(':itemId')
  @ApiOperation({ summary: 'Xóa 1 sản phẩm khỏi giỏ hàng' })
  async removeItem(
    @CurrentUser('_id') userId: string,
    @Param('itemId') itemId: string,
  ): Promise<EnrichedCart> {
    return this.cartService.removeItem(userId, itemId);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa toàn bộ giỏ hàng' })
  async clearCart(
    @CurrentUser('_id') userId: string,
  ): Promise<{ message: string }> {
    await this.cartService.clearCart(userId);
    return { message: 'Đã xóa toàn bộ giỏ hàng' };
  }
}
