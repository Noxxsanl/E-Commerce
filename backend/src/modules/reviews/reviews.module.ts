import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { Review, ReviewSchema } from './schemas/review.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import {
  OrderItem,
  OrderItemSchema,
} from '../orders/schemas/order-item.schema';
import { ReviewsRepository } from './reviews.repository';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsAdminController } from './reviews.admin.controller';
import { OrdersRepository } from '../orders/orders.repository';
import { OrderItemsRepository } from '../orders/order-items.repository';
import { ProductsModule } from '../products/products.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { QUEUE_NAMES } from '../../common/constants/queue.constant';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: Order.name, schema: OrderSchema },
      { name: OrderItem.name, schema: OrderItemSchema },
    ]),
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATION }),
    ProductsModule,
    AuditLogsModule,
  ],
  controllers: [ReviewsController, ReviewsAdminController],
  providers: [
    ReviewsRepository,
    ReviewsService,
    OrdersRepository,
    OrderItemsRepository,
  ],
  exports: [MongooseModule, ReviewsRepository],
})
export class ReviewsModule {}
