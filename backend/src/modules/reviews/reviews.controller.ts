import {
  Body,
  Controller,
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
import { ReviewsService, ProductReviewsResult } from './reviews.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import type { ReviewDocument } from './schemas/review.schema';
import type { Types } from 'mongoose';

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('product/:productId')
  @Public()
  @ApiOperation({ summary: 'Danh sách đánh giá sản phẩm (public)' })
  async getProductReviews(
    @Param('productId', ParseObjectIdPipe) productId: Types.ObjectId,
    @Query() queryDto: QueryReviewDto,
    @CurrentUser('_id') currentUserId: string,
  ): Promise<ProductReviewsResult> {
    return this.reviewsService.getProductReviews(
      productId.toString(),
      queryDto,
      currentUserId,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Gửi đánh giá sản phẩm (sau khi nhận hàng)' })
  @ApiResponse({ status: 201, description: 'Tạo thành công, chờ duyệt' })
  @ApiResponse({
    status: 409,
    description: 'Đã đánh giá sản phẩm này rồi',
  })
  @ApiResponse({
    status: 422,
    description: 'Đơn hàng chưa delivered hoặc hết hạn review',
  })
  async createReview(
    @CurrentUser('_id') userId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewDocument> {
    return this.reviewsService.createReview(userId, dto);
  }

  @Post(':id/helpful')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle vote hữu ích cho đánh giá' })
  async voteHelpful(
    @CurrentUser('_id') userId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<{ helpfulCount: number; isHelpful: boolean }> {
    return this.reviewsService.voteHelpful(userId, id.toString());
  }
}
