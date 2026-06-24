import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { OrderItemsRepository } from './order-items.repository';
import { CartRepository } from '../cart/cart.repository';
import { AddressesRepository } from '../addresses/addresses.repository';
import { CouponsService } from '../coupons/coupons.service';
import { ProductsRepository } from '../products/products.repository';
import { ProductVariantsRepository } from '../products/product-variants.repository';
import { AuditLogsRepository } from '../audit-logs/audit-logs.repository';
import { EmailService } from '../email/email.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { REDIS_CLIENT } from '../../cache/redis.provider';
import { OrderStatus, PaymentStatus } from './schemas/order.schema';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { QUEUE_NAMES } from '../../common/constants/queue.constant';
import { getQueueToken } from '@nestjs/bullmq';
import { Types } from 'mongoose';

jest.mock('../../common/utils/order-code.util', () => ({
  generateOrderCode: jest.fn().mockResolvedValue('ORD-20260624-00001'),
}));

const uid = new Types.ObjectId().toString();
const oid = new Types.ObjectId();
const pid = new Types.ObjectId();

const makeOrder = (overrides: Record<string, unknown> = {}) => ({
  _id: oid,
  orderCode: 'ORD-TEST-001',
  userId: new Types.ObjectId(uid),
  status: OrderStatus.PENDING,
  totalAmount: 200000,
  couponCode: undefined,
  ...overrides,
});

const makeAddress = () => ({
  _id: new Types.ObjectId(),
  userId: new Types.ObjectId(uid),
  fullName: 'Test User',
  phone: '0901234567',
  province: { name: 'Hà Nội' },
  district: { name: 'Hoàn Kiếm' },
  ward: { name: 'Hàng Bài' },
  streetAddress: '12 Lý Thường Kiệt',
});

const makeCartItem = () => ({
  productId: pid,
  variantId: undefined,
  productName: 'Test Product',
  productImage: 'http://img',
  variantOptions: [],
  price: 100000,
  quantity: 2,
  addedAt: new Date(),
  toString: () => pid.toString(),
});

describe('OrdersService', () => {
  let service: OrdersService;

  const ordersRepo = {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUser: jest.fn(),
    findManyByUser: jest.fn(),
    findMany: jest.fn(),
    updateStatus: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    findForExport: jest.fn(),
    findPendingOlderThan: jest.fn(),
  };

  const orderItemsRepo = {
    createMany: jest.fn(),
    findByOrderId: jest.fn(),
    markReviewed: jest.fn(),
    findById: jest.fn(),
  };

  const cartRepo = {
    findByUserId: jest.fn(),
    findOrCreate: jest.fn(),
    clear: jest.fn(),
  };

  const addressesRepo = {
    findByIdAndUser: jest.fn(),
  };

  const couponsService = {
    validateCoupon: jest.fn(),
    applyCoupon: jest.fn(),
    revertCoupon: jest.fn(),
  };

  const productsRepo = {
    findByIds: jest.fn(),
    decrementStock: jest.fn(),
    incrementStock: jest.fn(),
    findById: jest.fn(),
  };

  const variantsRepo = {
    findByIds: jest.fn().mockResolvedValue([]),
    decrementStock: jest.fn(),
    incrementStock: jest.fn(),
    findById: jest.fn(),
  };

  const auditLogsRepo = {
    create: jest.fn().mockResolvedValue(undefined),
  };

  const emailService = {
    sendOrderConfirmation: jest.fn(),
  };

  const notificationsGateway = {
    emitToUser: jest.fn(),
    emitToAdmin: jest.fn(),
  };

  const notificationQueue = {
    add: jest.fn().mockResolvedValue({}),
  };

  const orderQueue = {
    add: jest.fn().mockResolvedValue({}),
  };

  const redisMock = {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  };

  const connectionMock = {
    startSession: jest.fn(),
  };

  const mockSession = {
    withTransaction: jest
      .fn()
      .mockImplementation(async (fn: () => Promise<void>) => {
        await fn();
      }),
    endSession: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: OrdersRepository, useValue: ordersRepo },
        { provide: OrderItemsRepository, useValue: orderItemsRepo },
        { provide: CartRepository, useValue: cartRepo },
        { provide: AddressesRepository, useValue: addressesRepo },
        { provide: CouponsService, useValue: couponsService },
        { provide: ProductsRepository, useValue: productsRepo },
        { provide: ProductVariantsRepository, useValue: variantsRepo },
        { provide: AuditLogsRepository, useValue: auditLogsRepo },
        { provide: EmailService, useValue: emailService },
        { provide: NotificationsGateway, useValue: notificationsGateway },
        { provide: REDIS_CLIENT, useValue: redisMock },
        { provide: getConnectionToken(), useValue: connectionMock },
        {
          provide: getQueueToken(QUEUE_NAMES.NOTIFICATION),
          useValue: notificationQueue,
        },
        { provide: getQueueToken(QUEUE_NAMES.ORDER), useValue: orderQueue },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();

    connectionMock.startSession.mockResolvedValue(mockSession);
    mockSession.withTransaction.mockImplementation(
      async (fn: () => Promise<void>) => {
        await fn();
      },
    );
    mockSession.endSession.mockResolvedValue(undefined);
    notificationQueue.add.mockResolvedValue({});
    orderQueue.add.mockResolvedValue({});
    auditLogsRepo.create.mockResolvedValue(undefined);
    variantsRepo.findByIds.mockResolvedValue([]);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      addressId: new Types.ObjectId().toString(),
      paymentMethod: 'cod' as never,
    };

    it('creates order successfully with valid cart and address', async () => {
      const cartItem = makeCartItem();
      const product = {
        _id: pid,
        name: 'Test Product',
        price: 100000,
        stock: 10,
        isActive: true,
        categories: [],
        thumbnailUrl: 'http://img',
        toString: () => pid.toString(),
      };
      const address = makeAddress();
      const createdOrder = makeOrder();

      addressesRepo.findByIdAndUser.mockResolvedValue(address);
      cartRepo.findByUserId.mockResolvedValue({ items: [cartItem] });
      productsRepo.findByIds.mockResolvedValue([product]);
      productsRepo.decrementStock.mockResolvedValue(undefined);
      cartRepo.clear.mockResolvedValue(undefined);
      ordersRepo.create.mockResolvedValue(createdOrder);
      orderItemsRepo.createMany.mockResolvedValue(undefined);
      orderItemsRepo.findByOrderId.mockResolvedValue([]);

      const result = await service.create(uid, dto);

      expect(ordersRepo.create).toHaveBeenCalled();
      expect(result.order).toBe(createdOrder);
      expect(notificationsGateway.emitToAdmin).toHaveBeenCalledWith(
        'order:new',
        expect.any(Object),
      );
    });

    it('throws ADDRESS_NOT_FOUND when address does not belong to user', async () => {
      addressesRepo.findByIdAndUser.mockResolvedValue(null);

      await expect(service.create(uid, dto)).rejects.toMatchObject({
        errorCode: ErrorCodes.ADDRESS_NOT_FOUND,
      });
    });

    it('throws CART_EMPTY when cart is empty', async () => {
      addressesRepo.findByIdAndUser.mockResolvedValue(makeAddress());
      cartRepo.findByUserId.mockResolvedValue({ items: [] });

      await expect(service.create(uid, dto)).rejects.toMatchObject({
        errorCode: ErrorCodes.CART_EMPTY,
      });
    });

    it('throws PRODUCT_INACTIVE when a cart product is inactive', async () => {
      const cartItem = makeCartItem();
      addressesRepo.findByIdAndUser.mockResolvedValue(makeAddress());
      cartRepo.findByUserId.mockResolvedValue({ items: [cartItem] });
      productsRepo.findByIds.mockResolvedValue([
        {
          _id: pid,
          isActive: false,
          productName: 'X',
          toString: () => pid.toString(),
        },
      ]);

      await expect(service.create(uid, dto)).rejects.toMatchObject({
        errorCode: ErrorCodes.PRODUCT_INACTIVE,
      });
    });

    it('throws PRODUCT_INSUFFICIENT_STOCK when quantity exceeds stock', async () => {
      const cartItem = makeCartItem(); // quantity: 2
      const product = {
        _id: pid,
        name: 'X',
        price: 100000,
        stock: 1, // only 1 in stock
        isActive: true,
        categories: [],
        toString: () => pid.toString(),
      };
      addressesRepo.findByIdAndUser.mockResolvedValue(makeAddress());
      cartRepo.findByUserId.mockResolvedValue({ items: [cartItem] });
      productsRepo.findByIds.mockResolvedValue([product]);

      await expect(service.create(uid, dto)).rejects.toMatchObject({
        errorCode: ErrorCodes.PRODUCT_INSUFFICIENT_STOCK,
      });
    });
  });

  // ── updateStatus ──────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('updates from PENDING to CONFIRMED successfully', async () => {
      const order = makeOrder({ status: OrderStatus.PENDING });
      const updatedOrder = makeOrder({ status: OrderStatus.CONFIRMED });
      ordersRepo.findById.mockResolvedValue(order);
      ordersRepo.update.mockResolvedValue(undefined);
      ordersRepo.updateStatus.mockResolvedValue(updatedOrder);
      orderItemsRepo.findByOrderId.mockResolvedValue([]);

      const result = await service.updateStatus(
        oid.toString(),
        { status: OrderStatus.CONFIRMED },
        'admin-id',
      );

      expect(ordersRepo.updateStatus).toHaveBeenCalledWith(
        oid,
        OrderStatus.CONFIRMED,
        'admin-id',
        undefined,
      );
      expect(result.order).toBe(updatedOrder);
    });

    it('throws ORDER_NOT_FOUND when order does not exist', async () => {
      ordersRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          oid.toString(),
          { status: OrderStatus.CONFIRMED },
          'admin',
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.ORDER_NOT_FOUND });
    });

    it('throws ORDER_INVALID_STATUS_TRANSITION for invalid transitions', async () => {
      // PENDING → SHIPPING is not in VALID_TRANSITIONS
      const order = makeOrder({ status: OrderStatus.PENDING });
      ordersRepo.findById.mockResolvedValue(order);

      await expect(
        service.updateStatus(
          oid.toString(),
          { status: OrderStatus.SHIPPING },
          'admin',
        ),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.ORDER_INVALID_STATUS_TRANSITION,
      });
    });

    it('restocks and reverts coupon when transitioning to CANCELLED', async () => {
      const order = makeOrder({
        status: OrderStatus.CONFIRMED,
        couponCode: 'SAVE10',
      });
      const updatedOrder = makeOrder({ status: OrderStatus.CANCELLED });
      ordersRepo.findById.mockResolvedValue(order);
      ordersRepo.update.mockResolvedValue(undefined);
      ordersRepo.updateStatus.mockResolvedValue(updatedOrder);
      orderItemsRepo.findByOrderId.mockResolvedValue([
        { productId: pid, variantId: undefined, quantity: 2 },
      ]);
      productsRepo.incrementStock.mockResolvedValue(undefined);
      couponsService.revertCoupon.mockResolvedValue(undefined);

      await service.updateStatus(
        oid.toString(),
        { status: OrderStatus.CANCELLED },
        'admin',
      );

      expect(productsRepo.incrementStock).toHaveBeenCalled();
      expect(couponsService.revertCoupon).toHaveBeenCalled();
    });

    it('emits socket notification to user on status update', async () => {
      const order = makeOrder({ status: OrderStatus.PENDING });
      const updatedOrder = makeOrder({ status: OrderStatus.CONFIRMED });
      ordersRepo.findById.mockResolvedValue(order);
      ordersRepo.update.mockResolvedValue(undefined);
      ordersRepo.updateStatus.mockResolvedValue(updatedOrder);
      orderItemsRepo.findByOrderId.mockResolvedValue([]);

      await service.updateStatus(
        oid.toString(),
        { status: OrderStatus.CONFIRMED },
        'admin',
      );

      expect(notificationsGateway.emitToUser).toHaveBeenCalledWith(
        uid,
        'order:status-updated',
        expect.objectContaining({ status: OrderStatus.CONFIRMED }),
      );
    });
  });

  // ── cancelByUser ──────────────────────────────────────────────────────────

  describe('cancelByUser', () => {
    it('cancels a PENDING order successfully', async () => {
      const order = makeOrder({ status: OrderStatus.PENDING });
      const cancelledOrder = makeOrder({ status: OrderStatus.CANCELLED });
      ordersRepo.findByIdAndUser.mockResolvedValue(order);
      ordersRepo.findById.mockResolvedValue(order);
      ordersRepo.update.mockResolvedValue(undefined);
      ordersRepo.updateStatus.mockResolvedValue(cancelledOrder);
      orderItemsRepo.findByOrderId.mockResolvedValue([]);

      const result = await service.cancelByUser(
        uid,
        oid.toString(),
        'Changed mind',
      );

      expect(result.order.status).toBe(OrderStatus.CANCELLED);
    });

    it('throws ORDER_NOT_FOUND when order not owned by user', async () => {
      ordersRepo.findByIdAndUser.mockResolvedValue(null);

      await expect(
        service.cancelByUser(uid, oid.toString()),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.ORDER_NOT_FOUND });
    });

    it('throws ORDER_CANNOT_CANCEL when order is not PENDING', async () => {
      ordersRepo.findByIdAndUser.mockResolvedValue(
        makeOrder({ status: OrderStatus.CONFIRMED }),
      );

      await expect(
        service.cancelByUser(uid, oid.toString()),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.ORDER_CANNOT_CANCEL });
    });
  });

  // ── getOrderById ──────────────────────────────────────────────────────────

  describe('getOrderById', () => {
    it('returns order with items when user owns it', async () => {
      const order = makeOrder();
      ordersRepo.findByIdAndUser.mockResolvedValue(order);
      orderItemsRepo.findByOrderId.mockResolvedValue([]);

      const result = await service.getOrderById(uid, oid.toString());

      expect(result.order).toBe(order);
    });

    it('throws ORDER_NOT_FOUND when order not found', async () => {
      ordersRepo.findByIdAndUser.mockResolvedValue(null);

      await expect(
        service.getOrderById(uid, oid.toString()),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.ORDER_NOT_FOUND });
    });
  });
});

void PaymentStatus; // suppress unused import warning
