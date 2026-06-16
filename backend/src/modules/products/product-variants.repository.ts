import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import {
  ProductVariant,
  ProductVariantDocument,
} from './schemas/product-variant.schema';

@Injectable()
export class ProductVariantsRepository {
  constructor(
    @InjectModel(ProductVariant.name)
    private readonly variantModel: Model<ProductVariant>,
  ) {}

  async findByProductId(
    productId: string | Types.ObjectId,
  ): Promise<ProductVariantDocument[]> {
    return this.variantModel.find({ productId }).exec();
  }

  async findById(
    id: string | Types.ObjectId,
  ): Promise<ProductVariantDocument | null> {
    return this.variantModel.findById(id).exec();
  }

  async create(data: Partial<ProductVariant>): Promise<ProductVariantDocument> {
    return this.variantModel.create(data);
  }

  async update(
    id: string | Types.ObjectId,
    data: Partial<ProductVariant>,
  ): Promise<ProductVariantDocument | null> {
    return this.variantModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string | Types.ObjectId): Promise<void> {
    await this.variantModel.deleteOne({ _id: id }).exec();
  }

  async incrementStock(
    id: string | Types.ObjectId,
    qty: number,
  ): Promise<void> {
    await this.variantModel
      .updateOne({ _id: id }, { $inc: { stock: qty } })
      .exec();
  }

  async decrementStock(
    id: string | Types.ObjectId,
    qty: number,
    session?: ClientSession,
  ): Promise<void> {
    await this.variantModel
      .updateOne({ _id: id }, { $inc: { stock: -qty } }, { session })
      .exec();
  }
}
