import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';

@Injectable()
export class CategoriesRepository {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<Category>,
  ) {}

  async findAll(
    filter: Record<string, unknown> = {},
  ): Promise<CategoryDocument[]> {
    return this.categoryModel.find(filter).sort({ order: 1 }).exec();
  }

  async findBySlug(slug: string): Promise<CategoryDocument | null> {
    return this.categoryModel.findOne({ slug }).populate('parentId').exec();
  }

  async findById(
    id: string | Types.ObjectId,
  ): Promise<CategoryDocument | null> {
    return this.categoryModel.findById(id).exec();
  }

  async findByIds(
    ids: (string | Types.ObjectId)[],
  ): Promise<CategoryDocument[]> {
    return this.categoryModel.find({ _id: { $in: ids } }).exec();
  }

  async create(data: Partial<Category>): Promise<CategoryDocument> {
    return this.categoryModel.create(data);
  }

  async update(
    id: string | Types.ObjectId,
    data: Partial<Category>,
  ): Promise<CategoryDocument | null> {
    return this.categoryModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string | Types.ObjectId): Promise<void> {
    await this.categoryModel.deleteOne({ _id: id }).exec();
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const count = await this.categoryModel.countDocuments({ slug }).exec();
    return count > 0;
  }

  async countChildren(id: string | Types.ObjectId): Promise<number> {
    return this.categoryModel.countDocuments({ parentId: id }).exec();
  }
}
