import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { Order, OrderSchema } from './schemas/order.schema';
import { OrderItem, OrderItemSchema } from './schemas/order-item.schema';
import { OrdersRepository } from './orders.repository';
import { OrderItemsRepository } from './order-items.repository';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersAdminController } from './orders.admin.controller';
import { OrderProcessor } from './processors/order.processor';
import { CartModule } from '../cart/cart.module';
import { AddressesModule } from '../addresses/addresses.module';
import { CouponsModule } from '../coupons/coupons.module';
import { ProductsModule } from '../products/products.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EmailModule } from '../email/email.module';
import { QUEUE_NAMES } from '../../common/constants/queue.constant';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: OrderItem.name, schema: OrderItemSchema },
    ]),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.ORDER },
      { name: QUEUE_NAMES.NOTIFICATION },
    ),
    CartModule,
    AddressesModule,
    CouponsModule,
    ProductsModule,
    AuditLogsModule,
    EmailModule,
  ],
  controllers: [OrdersController, OrdersAdminController],
  providers: [
    OrdersRepository,
    OrderItemsRepository,
    OrdersService,
    OrderProcessor,
  ],
  exports: [
    MongooseModule,
    OrdersRepository,
    OrderItemsRepository,
    OrdersService,
  ],
})
export class OrdersModule {}
