import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Cron } from '@nestjs/schedule';
import { Job } from 'bullmq';
import {
  QUEUE_NAMES,
  ORDER_JOBS,
} from '../../../common/constants/queue.constant';
import { LIMITS } from '../../../common/constants/app.constant';
import { OrdersRepository } from '../orders.repository';
import { OrderItemsRepository } from '../order-items.repository';
import { ProductsRepository } from '../../products/products.repository';
import { ProductVariantsRepository } from '../../products/product-variants.repository';
import { OrderStatus } from '../schemas/order.schema';

interface SoldCountItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

interface UpdateSoldCountData {
  items: SoldCountItem[];
}

@Processor(QUEUE_NAMES.ORDER)
export class OrderProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderProcessor.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly orderItemsRepository: OrderItemsRepository,
    private readonly productsRepository: ProductsRepository,
    private readonly productVariantsRepository: ProductVariantsRepository,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case ORDER_JOBS.UPDATE_PRODUCT_SOLD_COUNT: {
        const data = job.data as UpdateSoldCountData;
        await this.handleUpdateSoldCount(data.items);
        break;
      }
      default:
        this.logger.warn(`[OrderProcessor] Unknown job: ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.error(
      `[OrderProcessor] Job "${job.name}" #${job.id} failed: ${err.message}`,
    );
  }

  @Cron('0 2 * * *', { name: 'auto-cancel-pending-orders' })
  async autoCancelPendingOrders(): Promise<void> {
    const cutoff = new Date(
      Date.now() - LIMITS.AUTO_CANCEL_PENDING_HOURS * 60 * 60 * 1000,
    );
    this.logger.log(
      `[OrderProcessor] Auto-cancel: checking orders pending since before ${cutoff.toISOString()}`,
    );

    const pendingOrders =
      await this.ordersRepository.findPendingOlderThan(cutoff);

    if (pendingOrders.length === 0) {
      this.logger.log('[OrderProcessor] No stale pending orders found');
      return;
    }

    let cancelled = 0;
    for (const order of pendingOrders) {
      try {
        // Restock items
        const items = await this.orderItemsRepository.findByOrderId(order._id);
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

        await this.ordersRepository.updateStatus(
          order._id,
          OrderStatus.CANCELLED,
          order.userId,
          `Tự động hủy — chờ xác nhận quá ${LIMITS.AUTO_CANCEL_PENDING_HOURS}h`,
        );

        cancelled++;
      } catch (err) {
        this.logger.error(
          `[OrderProcessor] Failed to auto-cancel order ${order.orderCode}`,
          err,
        );
      }
    }

    this.logger.log(
      `[OrderProcessor] Auto-cancel done: ${cancelled}/${pendingOrders.length} orders cancelled`,
    );
  }

  private async handleUpdateSoldCount(items: SoldCountItem[]): Promise<void> {
    for (const item of items) {
      const product = await this.productsRepository.findById(item.productId);
      if (product) {
        await this.productsRepository.updateStats(item.productId, {
          soldCount: (product.soldCount ?? 0) + item.quantity,
        });
      }
    }
    this.logger.log(
      `[OrderProcessor] Updated soldCount for ${items.length} products`,
    );
  }
}
