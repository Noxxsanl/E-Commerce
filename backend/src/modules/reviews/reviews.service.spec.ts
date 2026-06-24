import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getQueueToken } from '@nestjs/bullmq';
import { ReviewsService } from './reviews.service';
import { ReviewsRepository } from './reviews.repository';
import { OrderItemsRepository } from '../orders/order-items.repository';
import { OrdersRepository } from '../orders/orders.repository';
import { ProductsRepository } from '../products/products.repository';
import { AuditLogsRepository } from '../audit-logs/audit-logs.repository';
import { OrderStatus } from '../orders/schemas/order.schema';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { QUEUE_NAMES } from '../../common/constants/queue.constant';
import { Types } from 'mongoose';

const uid = new Types.ObjectId().toString();
const pid = new Types.ObjectId();
const oid = new Types.ObjectId();
const riid = new Types.ObjectId(); // review id
const oiid = new Types.ObjectId(); // order item id

const makeOrderItem = (overrides: Record<string, unknown> = {}) => ({
  _id: oiid,
  orderId: oid,
  productId: pid,
  isReviewed: false,
  ...overrides,
});

const makeOrder = (overrides: Record<string, unknown> = {}) => ({
  _id: oid,
  userId: new Types.ObjectId(uid),
  status: OrderStatus.DELIVERED,
  deliveredAt: new Date(Date.now() - 86400000), // 1 day ago
  ...overrides,
});

const makeReview = (overrides: Record<string, unknown> = {}) => ({
  _id: riid,
  userId: new Types.ObjectId(uid),
  productId: pid,
  orderId: oid,
  orderItemId: oiid,
  rating: 5,
  content: 'Great product!',
  images: [],
  isApproved: false,
  isHidden: false,
  helpfulCount: 0,
  helpfulVoters: [],
  ...overrides,
});

const makeProduct = () => ({
  _id: pid,
  slug: 'test-product',
  averageRating: 0,
  reviewCount: 0,
});

describe('ReviewsService', () => {
  let service: ReviewsService;

  const reviewsRepo = {
    findByProductId: jest.fn(),
    findById: jest.fn(),
    findByOrderItemId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getRatingSummary: jest.fn(),
    recalculateProductRating: jest.fn(),
    findMany: jest.fn(),
  };

  const orderItemsRepo = {
    findById: jest.fn(),
    markReviewed: jest.fn(),
  };

  const ordersRepo = {
    findById: jest.fn(),
  };

  const productsRepo = {
    findById: jest.fn(),
    updateStats: jest.fn(),
  };

  const auditLogsRepo = {
    create: jest.fn().mockResolvedValue(undefined),
  };

  const cacheMock = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };

  const notificationQueue = {
    add: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: ReviewsRepository, useValue: reviewsRepo },
        { provide: OrderItemsRepository, useValue: orderItemsRepo },
        { provide: OrdersRepository, useValue: ordersRepo },
        { provide: ProductsRepository, useValue: productsRepo },
        { provide: AuditLogsRepository, useValue: auditLogsRepo },
        { provide: CACHE_MANAGER, useValue: cacheMock },
        {
          provide: getQueueToken(QUEUE_NAMES.NOTIFICATION),
          useValue: notificationQueue,
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    jest.clearAllMocks();
    auditLogsRepo.create.mockResolvedValue(undefined);
    notificationQueue.add.mockResolvedValue({});
  });

  // ── createReview ──────────────────────────────────────────────────────────

  describe('createReview', () => {
    const dto = {
      orderItemId: oiid.toString(),
      productId: pid.toString(),
      rating: 5,
      content: 'Great!',
      images: [] as string[],
    };

    it('creates review successfully for delivered order', async () => {
      const orderItem = makeOrderItem();
      const order = makeOrder();
      const review = makeReview();

      orderItemsRepo.findById.mockResolvedValue(orderItem);
      ordersRepo.findById.mockResolvedValue(order);
      reviewsRepo.create.mockResolvedValue(review);
      orderItemsRepo.markReviewed.mockResolvedValue(undefined);

      const result = await service.createReview(uid, dto);

      expect(reviewsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isApproved: false }),
      );
      expect(orderItemsRepo.markReviewed).toHaveBeenCalledWith(
        oiid.toString(),
        riid.toString(),
      );
      expect(result).toBe(review);
    });

    it('throws REVIEW_ORDER_ITEM_NOT_FOUND when orderItem does not exist', async () => {
      orderItemsRepo.findById.mockResolvedValue(null);

      await expect(service.createReview(uid, dto)).rejects.toMatchObject({
        errorCode: ErrorCodes.REVIEW_ORDER_ITEM_NOT_FOUND,
      });
    });

    it('throws REVIEW_NOT_OWNER when order belongs to different user', async () => {
      orderItemsRepo.findById.mockResolvedValue(makeOrderItem());
      ordersRepo.findById.mockResolvedValue(
        makeOrder({ userId: new Types.ObjectId() }), // different user
      );

      await expect(service.createReview(uid, dto)).rejects.toMatchObject({
        errorCode: ErrorCodes.REVIEW_NOT_OWNER,
      });
    });

    it('throws REVIEW_ORDER_NOT_DELIVERED when order status is not delivered', async () => {
      orderItemsRepo.findById.mockResolvedValue(makeOrderItem());
      ordersRepo.findById.mockResolvedValue(
        makeOrder({ status: OrderStatus.SHIPPING }),
      );

      await expect(service.createReview(uid, dto)).rejects.toMatchObject({
        errorCode: ErrorCodes.REVIEW_ORDER_NOT_DELIVERED,
      });
    });

    it('throws REVIEW_ALREADY_EXISTS when orderItem already has review', async () => {
      orderItemsRepo.findById.mockResolvedValue(
        makeOrderItem({ isReviewed: true }),
      );
      ordersRepo.findById.mockResolvedValue(makeOrder());

      await expect(service.createReview(uid, dto)).rejects.toMatchObject({
        errorCode: ErrorCodes.REVIEW_ALREADY_EXISTS,
      });
    });
  });

  // ── voteHelpful ───────────────────────────────────────────────────────────

  describe('voteHelpful', () => {
    it('adds vote when user has not voted yet', async () => {
      const review = makeReview({ helpfulVoters: [] });
      reviewsRepo.findById.mockResolvedValue(review);
      reviewsRepo.update.mockResolvedValue({ ...review, helpfulCount: 1 });

      const result = await service.voteHelpful(uid, riid.toString());

      expect(result.helpfulCount).toBe(1);
      expect(result.isHelpful).toBe(true);
    });

    it('removes vote when user has already voted (toggle off)', async () => {
      const review = makeReview({
        helpfulVoters: [new Types.ObjectId(uid)],
        helpfulCount: 1,
      });
      reviewsRepo.findById.mockResolvedValue(review);
      reviewsRepo.update.mockResolvedValue({ ...review, helpfulCount: 0 });

      const result = await service.voteHelpful(uid, riid.toString());

      expect(result.helpfulCount).toBe(0);
      expect(result.isHelpful).toBe(false);
    });

    it('throws REVIEW_NOT_FOUND when review does not exist', async () => {
      reviewsRepo.findById.mockResolvedValue(null);

      await expect(
        service.voteHelpful(uid, riid.toString()),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.REVIEW_NOT_FOUND,
      });
    });
  });

  // ── approveReview ─────────────────────────────────────────────────────────

  describe('approveReview', () => {
    it('approves review, recalculates rating, and notifies user', async () => {
      const review = makeReview();
      const product = makeProduct();

      reviewsRepo.findById.mockResolvedValue(review);
      reviewsRepo.update.mockResolvedValue({ ...review, isApproved: true });
      productsRepo.findById.mockResolvedValue(product);
      reviewsRepo.recalculateProductRating.mockResolvedValue(undefined);
      cacheMock.del.mockResolvedValue(undefined);

      await service.approveReview(riid.toString(), 'admin-id');

      expect(reviewsRepo.update).toHaveBeenCalledWith(
        riid.toString(),
        expect.objectContaining({ isApproved: true }),
      );
      expect(reviewsRepo.recalculateProductRating).toHaveBeenCalledWith(pid);
      expect(notificationQueue.add).toHaveBeenCalled();
    });

    it('throws REVIEW_NOT_FOUND when review does not exist', async () => {
      reviewsRepo.findById.mockResolvedValue(null);

      await expect(
        service.approveReview(riid.toString(), 'admin-id'),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.REVIEW_NOT_FOUND });
    });
  });
});
