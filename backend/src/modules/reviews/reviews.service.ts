import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from '@nestjs/cache-manager';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Types } from 'mongoose';
import { ReviewsRepository, RatingSummary } from './reviews.repository';
import { ReviewDocument } from './schemas/review.schema';
import { OrderItemsRepository } from '../orders/order-items.repository';
import { OrdersRepository } from '../orders/orders.repository';
import { ProductsRepository } from '../products/products.repository';
import { AuditLogsRepository } from '../audit-logs/audit-logs.repository';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { HideReviewDto } from './dto/hide-review.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { LIMITS } from '../../common/constants/app.constant';
import { CacheKeys } from '../../common/constants/cache-keys.constant';
import {
  QUEUE_NAMES,
  NOTIFICATION_JOBS,
} from '../../common/constants/queue.constant';
import { OrderStatus } from '../orders/schemas/order.schema';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';

export interface ReviewWithMeta {
  review: ReviewDocument;
  isMyReview?: boolean;
  isHelpful?: boolean;
}

export interface ProductReviewsResult {
  items: ReviewWithMeta[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  ratingSummary: RatingSummary;
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION)
    private readonly notificationQueue: Queue,
    private readonly reviewsRepository: ReviewsRepository,
    private readonly orderItemsRepository: OrderItemsRepository,
    private readonly ordersRepository: OrdersRepository,
    private readonly productsRepository: ProductsRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
  ) {}

  // ==================== USER METHODS ====================

  async createReview(
    userId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewDocument> {
    // 1. Find orderItem
    const orderItem = await this.orderItemsRepository.findById(dto.orderItemId);
    if (!orderItem) {
      throw new BusinessException(
        ErrorCodes.REVIEW_ORDER_ITEM_NOT_FOUND,
        'Sản phẩm trong đơn hàng không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Check order ownership
    const order = await this.ordersRepository.findById(
      orderItem.orderId.toString(),
    );
    if (!order || order.userId.toString() !== userId) {
      throw new BusinessException(
        ErrorCodes.REVIEW_NOT_OWNER,
        'Bạn không có quyền đánh giá đơn hàng này',
        HttpStatus.FORBIDDEN,
      );
    }

    // 3. Check order delivered
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BusinessException(
        ErrorCodes.REVIEW_ORDER_NOT_DELIVERED,
        'Chỉ có thể đánh giá sau khi đơn hàng đã được giao',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // 4. Check not already reviewed
    if (orderItem.isReviewed) {
      throw new BusinessException(
        ErrorCodes.REVIEW_ALREADY_EXISTS,
        'Bạn đã đánh giá sản phẩm này rồi',
        HttpStatus.CONFLICT,
      );
    }

    // 5. Check review period (90 days after delivery)
    if (order.deliveredAt) {
      const deadlineMs =
        order.deliveredAt.getTime() +
        LIMITS.REVIEW_PERIOD_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() > deadlineMs) {
        throw new BusinessException(
          ErrorCodes.REVIEW_PERIOD_EXPIRED,
          `Chỉ có thể đánh giá trong ${LIMITS.REVIEW_PERIOD_DAYS} ngày sau khi nhận hàng`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    // 6. Create review (pending approval)
    const review = await this.reviewsRepository.create({
      userId: new Types.ObjectId(userId),
      productId: orderItem.productId,
      orderId: orderItem.orderId,
      orderItemId: new Types.ObjectId(dto.orderItemId),
      rating: dto.rating,
      content: dto.content,
      images: dto.images ?? [],
      isApproved: false,
      isHidden: false,
      helpfulCount: 0,
      helpfulVoters: [],
    });

    // 7. Mark order item as reviewed
    await this.orderItemsRepository.markReviewed(
      dto.orderItemId,
      review._id.toString(),
    );

    // 8. Notify admins
    await this.notificationQueue
      .add(NOTIFICATION_JOBS.CREATE_NOTIFICATION, {
        type: 'review_pending',
        title: 'Có đánh giá mới cần duyệt',
        message: `Người dùng vừa gửi đánh giá cho đơn hàng ${order.orderCode}`,
        data: { reviewId: review._id.toString() },
      })
      .catch((err) =>
        this.logger.warn(
          '[ReviewsService] Notification queue unavailable',
          err,
        ),
      );

    return review;
  }

  async getProductReviews(
    productId: string,
    queryDto: QueryReviewDto,
    currentUserId?: string,
  ): Promise<ProductReviewsResult> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 10;
    const filter: Record<string, unknown> = {};
    if (queryDto.rating) filter.rating = queryDto.rating;

    const [{ items, total }, ratingSummary] = await Promise.all([
      this.reviewsRepository.findByProductId(productId, filter, {
        page,
        limit,
      }),
      this.reviewsRepository.getRatingSummary(productId),
    ]);

    const enriched: ReviewWithMeta[] = items.map((review) => {
      const result: ReviewWithMeta = { review };
      if (currentUserId) {
        result.isMyReview = review.userId.toString() === currentUserId;
        result.isHelpful = review.helpfulVoters.some(
          (v) => v.toString() === currentUserId,
        );
      }
      return result;
    });

    return {
      items: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      ratingSummary,
    };
  }

  async voteHelpful(
    userId: string,
    reviewId: string,
  ): Promise<{ helpfulCount: number; isHelpful: boolean }> {
    const review = await this.reviewsRepository.findById(reviewId);
    if (!review) {
      throw new BusinessException(
        ErrorCodes.REVIEW_NOT_FOUND,
        'Đánh giá không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const userObjId = new Types.ObjectId(userId);
    const alreadyVoted = review.helpfulVoters.some(
      (v) => v.toString() === userId,
    );

    let updated: ReviewDocument | null;
    if (alreadyVoted) {
      updated = await this.reviewsRepository.update(reviewId, {
        $pull: { helpfulVoters: userObjId },
        $inc: { helpfulCount: -1 },
      } as unknown as Partial<ReviewDocument>);
    } else {
      updated = await this.reviewsRepository.update(reviewId, {
        $push: { helpfulVoters: userObjId },
        $inc: { helpfulCount: 1 },
      } as unknown as Partial<ReviewDocument>);
    }

    const final = updated ?? review;
    return {
      helpfulCount: final.helpfulCount,
      isHelpful: !alreadyVoted,
    };
  }

  // ==================== ADMIN METHODS ====================

  async getAdminReviews(
    filter: Record<string, unknown>,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResultDto<ReviewDocument>> {
    const { items, total } = await this.reviewsRepository.findMany(
      filter,
      pagination,
    );
    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async approveReview(id: string, adminId: string): Promise<ReviewDocument> {
    const review = await this.reviewsRepository.findById(id);
    if (!review) {
      throw new BusinessException(
        ErrorCodes.REVIEW_NOT_FOUND,
        'Đánh giá không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const updated = await this.reviewsRepository.update(id, {
      isApproved: true,
    });

    await this.reviewsRepository.recalculateProductRating(review.productId);
    await this.invalidateProductCache(review.productId.toString());

    // Notify reviewer
    await this.notificationQueue
      .add(NOTIFICATION_JOBS.CREATE_NOTIFICATION, {
        userId: review.userId.toString(),
        type: 'review_approved',
        title: 'Đánh giá của bạn đã được duyệt',
        message: 'Đánh giá của bạn hiện đã hiển thị công khai',
        data: { reviewId: id },
      })
      .catch((err) =>
        this.logger.warn(
          '[ReviewsService] Notification queue unavailable',
          err,
        ),
      );

    await this.auditLogsRepository
      .create({
        userId: adminId,
        action: 'approve',
        resource: 'review',
        resourceId: id,
        after: { isApproved: true },
      })
      .catch((err) =>
        this.logger.warn('[ReviewsService] AuditLog write failed', err),
      );

    return updated ?? review;
  }

  async hideReview(
    id: string,
    dto: HideReviewDto,
    adminId: string,
  ): Promise<ReviewDocument> {
    const review = await this.reviewsRepository.findById(id);
    if (!review) {
      throw new BusinessException(
        ErrorCodes.REVIEW_NOT_FOUND,
        'Đánh giá không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const updated = await this.reviewsRepository.update(id, {
      isHidden: true,
      adminNote: dto.adminNote ?? '',
    });

    await this.reviewsRepository.recalculateProductRating(review.productId);
    await this.invalidateProductCache(review.productId.toString());

    await this.auditLogsRepository
      .create({
        userId: adminId,
        action: 'hide',
        resource: 'review',
        resourceId: id,
        after: { isHidden: true, adminNote: dto.adminNote },
      })
      .catch((err) =>
        this.logger.warn('[ReviewsService] AuditLog write failed', err),
      );

    return updated ?? review;
  }

  async unhideReview(id: string, adminId: string): Promise<ReviewDocument> {
    const review = await this.reviewsRepository.findById(id);
    if (!review) {
      throw new BusinessException(
        ErrorCodes.REVIEW_NOT_FOUND,
        'Đánh giá không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const updated = await this.reviewsRepository.update(id, {
      isHidden: false,
    });

    await this.reviewsRepository.recalculateProductRating(review.productId);
    await this.invalidateProductCache(review.productId.toString());

    await this.auditLogsRepository
      .create({
        userId: adminId,
        action: 'unhide',
        resource: 'review',
        resourceId: id,
        after: { isHidden: false },
      })
      .catch((err) =>
        this.logger.warn('[ReviewsService] AuditLog write failed', err),
      );

    return updated ?? review;
  }

  async deleteReview(id: string, adminId: string): Promise<void> {
    const review = await this.reviewsRepository.findById(id);
    if (!review) {
      throw new BusinessException(
        ErrorCodes.REVIEW_NOT_FOUND,
        'Đánh giá không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const productId = review.productId;
    await this.reviewsRepository.delete(id);
    await this.reviewsRepository.recalculateProductRating(productId);
    await this.invalidateProductCache(productId.toString());

    await this.auditLogsRepository
      .create({
        userId: adminId,
        action: 'delete',
        resource: 'review',
        resourceId: id,
        before: { rating: review.rating, content: review.content },
      })
      .catch((err) =>
        this.logger.warn('[ReviewsService] AuditLog write failed', err),
      );
  }

  // ==================== PRIVATE ====================

  private async invalidateProductCache(productId: string): Promise<void> {
    const product = await this.productsRepository.findById(productId);
    if (product?.slug) {
      await this.cacheManager
        .del(CacheKeys.PRODUCT_BY_SLUG(product.slug))
        .catch(() => void 0);
    }
  }
}
