import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { Product, ProductSchema } from './schemas/product.schema';
import {
  ProductVariant,
  ProductVariantSchema,
} from './schemas/product-variant.schema';
import { ProductsRepository } from './products.repository';
import { ProductVariantsRepository } from './product-variants.repository';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductsAdminController } from './products.admin.controller';
import { AnalyticsProcessor } from './analytics.processor';
import { CategoriesModule } from '../categories/categories.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { QUEUE_NAMES } from '../../common/constants/queue.constant';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: ProductVariant.name, schema: ProductVariantSchema },
    ]),
    BullModule.registerQueue({ name: QUEUE_NAMES.ANALYTICS }),
    CategoriesModule,
    AuditLogsModule,
  ],
  controllers: [ProductsController, ProductsAdminController],
  providers: [
    ProductsRepository,
    ProductVariantsRepository,
    ProductsService,
    AnalyticsProcessor,
  ],
  exports: [MongooseModule, ProductsRepository, ProductVariantsRepository],
})
export class ProductsModule {}
