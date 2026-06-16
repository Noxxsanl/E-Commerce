import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';

export interface ProductStatsUpdate {
  soldCount?: number;
  viewCount?: number;
  averageRating?: number;
  reviewCount?: number;
}

@Injectable()
export class ProductsRepository {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
  ) {}

  async findBySlug(
    slug: string,
    filter: Record<string, unknown> = {},
  ): Promise<ProductDocument | null> {
    return this.productModel
      .findOne({ slug, ...filter })
      .populate('categories')
      .exec();
  }

  async findById(id: string | Types.ObjectId): Promise<ProductDocument | null> {
    return this.productModel.findById(id).exec();
  }

  async findMany(
    filter: Record<string, unknown>,
    sort: Record<string, 1 | -1>,
    pagination: { page: number; limit: number },
  ): Promise<{ items: ProductDocument[]; total: number }> {
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      this.productModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(pagination.limit)
        .exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async findByIds(
    ids: (string | Types.ObjectId)[],
  ): Promise<ProductDocument[]> {
    return this.productModel.find({ _id: { $in: ids } }).exec();
  }

  async findFlashSale(): Promise<ProductDocument[]> {
    return this.productModel
      .find({
        isFlashSale: true,
        isActive: true,
        flashSaleEndAt: { $gt: new Date() },
      })
      .exec();
  }

  async findFeatured(limit: number): Promise<ProductDocument[]> {
    return this.productModel
      .find({ isFeatured: true, isActive: true })
      .limit(limit)
      .exec();
  }

  async findBestSellers(limit: number): Promise<ProductDocument[]> {
    return this.productModel
      .find({ isActive: true })
      .sort({ soldCount: -1 })
      .limit(limit)
      .exec();
  }

  async findNewest(limit: number): Promise<ProductDocument[]> {
    return this.productModel
      .find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async findRelated(
    productId: string | Types.ObjectId,
    categoryIds: (string | Types.ObjectId)[],
    limit: number,
  ): Promise<ProductDocument[]> {
    return this.productModel
      .find({
        _id: { $ne: productId },
        categories: { $in: categoryIds },
        isActive: true,
      })
      .limit(limit)
      .exec();
  }

  async create(data: Partial<Product>): Promise<ProductDocument> {
    return this.productModel.create(data);
  }

  async update(
    id: string | Types.ObjectId,
    data: Partial<Product>,
  ): Promise<ProductDocument | null> {
    return this.productModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async softDelete(id: string | Types.ObjectId): Promise<void> {
    await this.productModel.updateOne({ _id: id }, { isActive: false }).exec();
  }

  async decrementStock(
    id: string | Types.ObjectId,
    qty: number,
    session?: ClientSession,
  ): Promise<void> {
    await this.productModel
      .updateOne({ _id: id }, { $inc: { stock: -qty } }, { session })
      .exec();
  }

  async incrementStock(
    id: string | Types.ObjectId,
    qty: number,
  ): Promise<void> {
    await this.productModel
      .updateOne({ _id: id }, { $inc: { stock: qty } })
      .exec();
  }

  async updateStats(
    id: string | Types.ObjectId,
    stats: ProductStatsUpdate,
  ): Promise<void> {
    await this.productModel.updateOne({ _id: id }, stats).exec();
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const count = await this.productModel.countDocuments({ slug }).exec();
    return count > 0;
  }

  async countActiveByCategory(
    categoryId: string | Types.ObjectId,
  ): Promise<number> {
    return this.productModel
      .countDocuments({ categories: categoryId, isActive: true })
      .exec();
  }
}
