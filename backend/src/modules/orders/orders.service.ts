import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Connection, Types } from 'mongoose';
import { Queue } from 'bullmq';
import { InjectRedis } from '../../cache/redis.provider';
import { Redis } from 'ioredis';
import { OrdersRepository } from './orders.repository';
import { OrderItemsRepository } from './order-items.repository';
import {
  OrderDocument,
  OrderStatus,
  PaymentStatus,
} from './schemas/order.schema';
import { OrderItemDocument } from './schemas/order-item.schema';
import { CartRepository } from '../cart/cart.repository';
import { AddressesRepository } from '../addresses/addresses.repository';
import { CouponsService } from '../coupons/coupons.service';
import { ProductsRepository } from '../products/products.repository';
import { ProductVariantsRepository } from '../products/product-variants.repository';
import { AuditLogsRepository } from '../audit-logs/audit-logs.repository';
import { EmailService } from '../email/email.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryOrderDto, QueryAdminOrderDto } from './dto/query-order.dto';
import { BulkUpdateStatusDto } from './dto/bulk-update-status.dto';
import { ExportOrderQueryDto } from './dto/export-order-query.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { LIMITS } from '../../common/constants/app.constant';
import {
  QUEUE_NAMES,
  NOTIFICATION_JOBS,
  ORDER_JOBS,
} from '../../common/constants/queue.constant';
import { generateOrderCode } from '../../common/utils/order-code.util';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';

const VALID_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.SHIPPING],
  [OrderStatus.SHIPPING]: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
};

export interface OrderWithItems {
  order: OrderDocument;
  items: OrderItemDocument[];
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION)
    private readonly notificationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ORDER) private readonly orderQueue: Queue,
    private readonly ordersRepository: OrdersRepository,
    private readonly orderItemsRepository: OrderItemsRepository,
    private readonly cartRepository: CartRepository,
    private readonly addressesRepository: AddressesRepository,
    private readonly couponsService: CouponsService,
    private readonly productsRepository: ProductsRepository,
    private readonly productVariantsRepository: ProductVariantsRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
    private readonly emailService: EmailService,
  ) {}

  // ==================== USER ENDPOINTS ====================

  async create(userId: string, dto: CreateOrderDto): Promise<OrderWithItems> {
    // 1. Validate address ownership
    const address = await this.addressesRepository.findByIdAndUser(
      dto.addressId,
      userId,
    );
    if (!address) {
      throw new BusinessException(
        ErrorCodes.ADDRESS_NOT_FOUND,
        'Địa chỉ không tồn tại hoặc không thuộc về bạn',
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Get cart and validate not empty
    const cart = await this.cartRepository.findByUserId(userId);
    if (!cart || cart.items.length === 0) {
      throw new BusinessException(
        ErrorCodes.CART_EMPTY,
        'Giỏ hàng trống',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // 3. Validate stock and collect product info (outside transaction — read-only)
    const productIds = cart.items.map((item) => item.productId);
    const variantIds = cart.items
      .filter((item) => item.variantId)
      .map((item) => item.variantId);

    const [products, variants] = await Promise.all([
      this.productsRepository.findByIds(productIds),
      variantIds.length
        ? this.productVariantsRepository.findByIds(variantIds)
        : Promise.resolve([]),
    ]);

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

    // Validate each cart item
    for (const item of cart.items) {
      const product = productMap.get(item.productId.toString());
      if (!product || !product.isActive) {
        throw new BusinessException(
          ErrorCodes.PRODUCT_INACTIVE,
          `Sản phẩm "${item.productName}" không còn tồn tại hoặc đã ngừng bán`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const stock = item.variantId
        ? (variantMap.get(item.variantId.toString())?.stock ?? 0)
        : product.stock;

      if (stock <= 0) {
        throw new BusinessException(
          ErrorCodes.PRODUCT_OUT_OF_STOCK,
          `Sản phẩm "${item.productName}" đã hết hàng`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (stock < item.quantity) {
        throw new BusinessException(
          ErrorCodes.PRODUCT_INSUFFICIENT_STOCK,
          `Sản phẩm "${item.productName}" chỉ còn ${stock} sản phẩm`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    // 4. Calculate pricing
    const subtotal = cart.items.reduce((sum, item) => {
      const product = productMap.get(item.productId.toString());
      const variant = item.variantId
        ? variantMap.get(item.variantId.toString())
        : undefined;
      const unitPrice = variant?.price ?? product?.price ?? item.price;
      return sum + unitPrice * item.quantity;
    }, 0);

    const shippingFee =
      subtotal >= LIMITS.FREE_SHIPPING_THRESHOLD
        ? 0
        : LIMITS.STANDARD_SHIPPING_FEE;

    // 5. Validate coupon if provided
    let discountAmount = 0;
    let couponId: string | undefined;

    if (dto.couponCode) {
      const cartItemsForValidation = cart.items.map((item) => ({
        productId: item.productId.toString(),
        categoryIds: productMap
          .get(item.productId.toString())
          ?.categories?.map((c) => c.toString()),
      }));

      const result = await this.couponsService.validateCoupon(
        dto.couponCode,
        userId,
        subtotal,
        cartItemsForValidation,
      );
      discountAmount = result.discountAmount;
      couponId = result.coupon._id.toString();
    }

    const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);

    // Sort cart items by productId ascending — prevents deadlock in concurrent transactions
    const sortedItems = [...cart.items].sort((a, b) =>
      a.productId.toString().localeCompare(b.productId.toString()),
    );

    // 6. MongoDB Transaction
    // NOTE: Requires MongoDB replica set (rs0). Standalone mongod does NOT support multi-doc transactions.
    const session = await this.connection.startSession();
    let createdOrder: OrderDocument | undefined;

    try {
      await session.withTransaction(async () => {
        // Decrement stock — sorted by productId to prevent deadlock
        for (const item of sortedItems) {
          if (item.variantId) {
            await this.productVariantsRepository.decrementStock(
              item.variantId,
              item.quantity,
              session,
            );
          } else {
            await this.productsRepository.decrementStock(
              item.productId,
              item.quantity,
              session,
            );
          }
        }

        // Generate order code (Redis INCR — outside document scope but cheap)
        const orderCode = await generateOrderCode(this.redis);

        // Snapshot shipping address
        const shippingAddress = {
          fullName: address.fullName,
          phone: address.phone,
          province: address.province.name,
          district: address.district.name,
          ward: address.ward.name,
          streetAddress: address.streetAddress,
        };

        // Create Order
        createdOrder = await this.ordersRepository.create(
          {
            orderCode,
            userId: new Types.ObjectId(userId),
            shippingAddress,
            subtotal,
            shippingFee,
            discountAmount,
            couponCode: dto.couponCode,
            totalAmount,
            paymentMethod: dto.paymentMethod,
            paymentStatus: PaymentStatus.PENDING,
            status: OrderStatus.PENDING,
            statusHistory: [
              {
                status: OrderStatus.PENDING,
                updatedAt: new Date(),
                updatedBy: new Types.ObjectId(userId),
                note: '',
              },
            ],
            notes: dto.notes,
          },
          session,
        );

        // Create OrderItems (snapshot)
        const orderItemDocs = sortedItems.map((item) => {
          const product = productMap.get(item.productId.toString());
          const variant = item.variantId
            ? variantMap.get(item.variantId.toString())
            : undefined;
          const unitPrice = variant?.price ?? product?.price ?? item.price;
          return {
            orderId: createdOrder!._id,
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            productImage: item.productImage,
            variantOptions: item.variantOptions,
            unitPrice,
            quantity: item.quantity,
            totalPrice: unitPrice * item.quantity,
            isReviewed: false,
          };
        });

        await this.orderItemsRepository.createMany(orderItemDocs, session);

        // Apply coupon atomically in transaction
        if (couponId && dto.couponCode) {
          await this.couponsService.applyCoupon(
            couponId,
            userId,
            createdOrder._id.toString(),
            discountAmount,
            session,
          );
        }

        // Clear cart
        await this.cartRepository.clear(userId, session);
      });
    } finally {
      await session.endSession();
    }

    if (!createdOrder) {
      throw new BusinessException(
        ErrorCodes.SYS_INTERNAL_ERROR,
        'Tạo đơn hàng thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const orderItems = await this.orderItemsRepository.findByOrderId(
      createdOrder._id,
    );

    // 7. Post-transaction side effects
    this.enqueueOrderConfirmation(createdOrder, orderItems);

    await this.notificationQueue
      .add(NOTIFICATION_JOBS.CREATE_NOTIFICATION, {
        userId,
        type: 'order_placed',
        title: 'Đặt hàng thành công',
        message: `Đơn hàng ${createdOrder.orderCode} đã được tạo`,
        link: `/orders/${createdOrder._id.toString()}`,
        data: { orderId: createdOrder._id.toString() },
      })
      .catch((err) =>
        this.logger.warn('[OrdersService] Notification queue unavailable', err),
      );

    // TODO(T-13): emit socket `order:new` to admin room

    return { order: createdOrder, items: orderItems };
  }

  async getOrders(
    userId: string,
    queryDto: QueryOrderDto,
  ): Promise<PaginatedResultDto<OrderDocument>> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 10;
    const filter: Record<string, unknown> = {};
    if (queryDto.status) filter.status = queryDto.status;

    const { items, total } = await this.ordersRepository.findManyByUser(
      userId,
      filter,
      { page, limit },
    );
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getOrderById(userId: string, orderId: string): Promise<OrderWithItems> {
    const order = await this.ordersRepository.findByIdAndUser(orderId, userId);
    if (!order) {
      throw new BusinessException(
        ErrorCodes.ORDER_NOT_FOUND,
        'Đơn hàng không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }
    const items = await this.orderItemsRepository.findByOrderId(orderId);
    return { order, items };
  }

  async cancelByUser(
    userId: string,
    orderId: string,
    reason?: string,
  ): Promise<OrderWithItems> {
    const order = await this.ordersRepository.findByIdAndUser(orderId, userId);
    if (!order) {
      throw new BusinessException(
        ErrorCodes.ORDER_NOT_FOUND,
        'Đơn hàng không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BusinessException(
        ErrorCodes.ORDER_CANNOT_CANCEL,
        'Chỉ có thể hủy đơn hàng ở trạng thái chờ xác nhận',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return this.applyStatusTransition(
      order,
      OrderStatus.CANCELLED,
      userId,
      reason,
    );
  }

  async confirmReceived(
    userId: string,
    orderId: string,
  ): Promise<OrderWithItems> {
    const order = await this.ordersRepository.findByIdAndUser(orderId, userId);
    if (!order) {
      throw new BusinessException(
        ErrorCodes.ORDER_NOT_FOUND,
        'Đơn hàng không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }
    if (order.status !== OrderStatus.SHIPPING) {
      throw new BusinessException(
        ErrorCodes.ORDER_CANNOT_CONFIRM_RECEIVED,
        'Chỉ có thể xác nhận đã nhận hàng khi đơn đang giao',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return this.applyStatusTransition(order, OrderStatus.DELIVERED, userId);
  }

  // ==================== ADMIN ENDPOINTS ====================

  async getAdminOrders(
    queryDto: QueryAdminOrderDto,
  ): Promise<PaginatedResultDto<OrderDocument>> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const filter: Record<string, unknown> = {};

    if (queryDto.status) filter.status = queryDto.status;
    if (queryDto.orderCode)
      filter.orderCode = new RegExp(queryDto.orderCode, 'i');
    if (queryDto.userId) filter.userId = new Types.ObjectId(queryDto.userId);

    const { items, total } = await this.ordersRepository.findMany(
      filter,
      { createdAt: -1 },
      { page, limit },
    );
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getAdminOrderById(orderId: string): Promise<OrderWithItems> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new BusinessException(
        ErrorCodes.ORDER_NOT_FOUND,
        'Đơn hàng không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }
    const items = await this.orderItemsRepository.findByOrderId(orderId);
    return { order, items };
  }

  async updateStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    adminId: string,
  ): Promise<OrderWithItems> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new BusinessException(
        ErrorCodes.ORDER_NOT_FOUND,
        'Đơn hàng không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed || !allowed.includes(dto.status)) {
      throw new BusinessException(
        ErrorCodes.ORDER_INVALID_STATUS_TRANSITION,
        `Không thể chuyển từ "${order.status}" sang "${dto.status}"`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return this.applyStatusTransition(order, dto.status, adminId, dto.note);
  }

  async bulkUpdateStatus(
    dto: BulkUpdateStatusDto,
    adminId: string,
  ): Promise<{ updated: number; failed: string[] }> {
    let updated = 0;
    const failed: string[] = [];

    for (const orderId of dto.orderIds) {
      try {
        await this.updateStatus(
          orderId,
          { status: dto.status, note: dto.note },
          adminId,
        );
        updated++;
      } catch {
        failed.push(orderId);
      }
    }

    return { updated, failed };
  }

  async exportOrders(queryDto: ExportOrderQueryDto): Promise<string> {
    const filter: Record<string, unknown> = {};
    if (queryDto.status) filter.status = queryDto.status;
    if (queryDto.from || queryDto.to) {
      const dateFilter: Record<string, Date> = {};
      if (queryDto.from) dateFilter.$gte = new Date(queryDto.from);
      if (queryDto.to) dateFilter.$lte = new Date(queryDto.to);
      filter.createdAt = dateFilter;
    }

    const orders = await this.ordersRepository.findForExport(filter);

    const headers = [
      'Order Code',
      'Status',
      'Payment Method',
      'Payment Status',
      'Subtotal',
      'Shipping Fee',
      'Discount',
      'Total',
      'Coupon Code',
      'Customer Name',
      'Phone',
      'Province',
      'District',
      'Ward',
      'Street Address',
      'Notes',
      'Created At',
      'Delivered At',
    ];

    type OrderWithTimestamps = OrderDocument & { createdAt?: Date };
    const rows = (orders as OrderWithTimestamps[]).map((o) => [
      o.orderCode,
      o.status,
      o.paymentMethod,
      o.paymentStatus,
      o.subtotal,
      o.shippingFee,
      o.discountAmount,
      o.totalAmount,
      o.couponCode ?? '',
      o.shippingAddress.fullName,
      o.shippingAddress.phone,
      o.shippingAddress.province,
      o.shippingAddress.district,
      o.shippingAddress.ward,
      o.shippingAddress.streetAddress,
      o.notes ?? '',
      o.createdAt ? new Date(o.createdAt).toISOString() : '',
      o.deliveredAt ? new Date(o.deliveredAt).toISOString() : '',
    ]);

    const escape = (
      v: string | number | boolean | null | undefined,
    ): string => {
      const str = v != null ? String(v) : '';
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    const lines = [
      headers.join(','),
      ...rows.map((row) => row.map(escape).join(',')),
    ];

    return lines.join('\r\n');
  }

  // ==================== PRIVATE ====================

  private async applyStatusTransition(
    order: OrderDocument,
    newStatus: OrderStatus,
    actorId: string,
    note?: string,
  ): Promise<OrderWithItems> {
    const orderId = order._id.toString();
    const userId = order.userId.toString();

    // Side effects per new status
    if (
      newStatus === OrderStatus.CANCELLED ||
      newStatus === OrderStatus.RETURNED
    ) {
      await this.restockOrderItems(orderId);
      if (order.couponCode) {
        await this.couponsService
          .revertCoupon(orderId)
          .catch((err) =>
            this.logger.warn('[OrdersService] revertCoupon failed', err),
          );
      }
    }

    const updateData: Partial<OrderDocument> = {};
    if (newStatus === OrderStatus.CANCELLED) {
      updateData.cancelReason = note;
    }
    if (newStatus === OrderStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
      updateData.paymentStatus = PaymentStatus.PAID;
    }

    // Persist status and optional fields
    await this.ordersRepository.update(order._id, updateData);
    const updated = await this.ordersRepository.updateStatus(
      order._id,
      newStatus,
      actorId,
      note,
    );

    if (!updated) {
      throw new BusinessException(
        ErrorCodes.ORDER_NOT_FOUND,
        'Đơn hàng không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const items = await this.orderItemsRepository.findByOrderId(orderId);

    // After-transition side effects
    if (newStatus === OrderStatus.DELIVERED) {
      await this.orderQueue
        .add(
          ORDER_JOBS.UPDATE_PRODUCT_SOLD_COUNT,
          {
            items: items.map((i) => ({
              productId: i.productId.toString(),
              variantId: i.variantId?.toString(),
              quantity: i.quantity,
            })),
          },
          { delay: 5000 },
        )
        .catch((err) =>
          this.logger.warn('[OrdersService] order queue unavailable', err),
        );
    }

    // Enqueue notification
    await this.notificationQueue
      .add(NOTIFICATION_JOBS.CREATE_NOTIFICATION, {
        userId,
        type: `order_${newStatus}`,
        title: `Đơn hàng ${updated.orderCode}`,
        message: `Đơn hàng của bạn đã được cập nhật: ${newStatus}`,
        link: `/orders/${orderId}`,
        data: { orderId },
      })
      .catch((err) =>
        this.logger.warn('[OrdersService] Notification queue unavailable', err),
      );

    // Audit log
    await this.auditLogsRepository
      .create({
        userId: actorId,
        action: 'update_status',
        resource: 'order',
        resourceId: orderId,
        before: { status: order.status },
        after: { status: newStatus },
      })
      .catch((err) =>
        this.logger.warn('[OrdersService] AuditLog write failed', err),
      );

    // TODO(T-13): emit socket `order:status-updated` to `user:{userId}` room

    return { order: updated, items };
  }

  private async restockOrderItems(orderId: string): Promise<void> {
    const items = await this.orderItemsRepository.findByOrderId(orderId);
    await Promise.all(
      items.map((item) =>
        item.variantId
          ? this.productVariantsRepository.incrementStock(
              item.variantId,
              item.quantity,
            )
          : this.productsRepository.incrementStock(
              item.productId,
              item.quantity,
            ),
      ),
    );
  }

  private enqueueOrderConfirmation(
    order: OrderDocument,
    items: OrderItemDocument[],
  ): void {
    // Without UsersModule in OrdersModule, email is deferred to the notification processor (T-13).
    // TODO(T-13): fetch user email and call emailService.sendOrderConfirmation()
    this.logger.log(
      `[OrdersService] Order ${order.orderCode} created — email enqueue deferred to notification processor`,
    );
    void items;
  }
}
