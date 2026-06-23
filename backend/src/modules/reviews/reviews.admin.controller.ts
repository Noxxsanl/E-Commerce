import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { HideReviewDto } from './dto/hide-review.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UserRole } from '../users/schemas/user.schema';
import type { ReviewDocument } from './schemas/review.schema';
import type { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import type { Types } from 'mongoose';

@ApiTags('Admin - Reviews')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
@Controller('admin/reviews')
export class ReviewsAdminController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách tất cả đánh giá (admin)' })
  async findMany(
    @Query() queryDto: PaginationDto,
  ): Promise<PaginatedResultDto<ReviewDocument>> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    return this.reviewsService.getAdminReviews({}, { page, limit });
  }

  @Patch(':id/approve')
  @Audit({ action: 'approve', resource: 'review' })
  @ApiOperation({ summary: 'Duyệt đánh giá' })
  @ApiResponse({
    status: 200,
    description: 'Duyệt thành công, rating được cập nhật',
  })
  async approve(
    @CurrentUser('_id') adminId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<ReviewDocument> {
    return this.reviewsService.approveReview(id.toString(), adminId);
  }

  @Patch(':id/hide')
  @Audit({ action: 'hide', resource: 'review' })
  @ApiOperation({ summary: 'Ẩn đánh giá' })
  async hide(
    @CurrentUser('_id') adminId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: HideReviewDto,
  ): Promise<ReviewDocument> {
    return this.reviewsService.hideReview(id.toString(), dto, adminId);
  }

  @Patch(':id/unhide')
  @Audit({ action: 'unhide', resource: 'review' })
  @ApiOperation({ summary: 'Bỏ ẩn đánh giá' })
  async unhide(
    @CurrentUser('_id') adminId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<ReviewDocument> {
    return this.reviewsService.unhideReview(id.toString(), adminId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'delete', resource: 'review' })
  @ApiOperation({ summary: 'Xóa đánh giá (cứng)' })
  async delete(
    @CurrentUser('_id') adminId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<{ message: string }> {
    await this.reviewsService.deleteReview(id.toString(), adminId);
    return { message: 'Đã xóa đánh giá' };
  }
}
