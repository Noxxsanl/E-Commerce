import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from './schemas/category.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { CategoriesAdminController } from './categories.admin.controller';
import { ProductsRepository } from '../products/products.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [CategoriesController, CategoriesAdminController],
  providers: [CategoriesRepository, ProductsRepository, CategoriesService],
  exports: [MongooseModule, CategoriesRepository],
})
export class CategoriesModule {}
