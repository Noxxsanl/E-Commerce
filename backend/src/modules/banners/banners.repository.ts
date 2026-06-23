import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Banner, BannerDocument, BannerType } from './schemas/banner.schema';

@Injectable()
export class BannersRepository {
  constructor(
    @InjectModel(Banner.name) private readonly bannerModel: Model<Banner>,
  ) {}

  async findActive(type?: BannerType): Promise<BannerDocument[]> {
    const now = new Date();
    const query: Record<string, unknown> = {
      isActive: true,
      $or: [{ startAt: null }, { startAt: { $lte: now } }],
      $and: [{ $or: [{ endAt: null }, { endAt: { $gte: now } }] }],
    };
    if (type) query.type = type;
    return this.bannerModel.find(query).sort({ order: 1 }).exec();
  }

  async findMany(
    filter: Record<string, unknown>,
    pagination: { page: number; limit: number },
  ): Promise<{ items: BannerDocument[]; total: number }> {
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      this.bannerModel
        .find(filter)
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .exec(),
      this.bannerModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async findById(id: string | Types.ObjectId): Promise<BannerDocument | null> {
    return this.bannerModel.findById(id).exec();
  }

  async create(data: Partial<Banner>): Promise<BannerDocument> {
    return this.bannerModel.create(data);
  }

  async update(
    id: string | Types.ObjectId,
    data: Partial<Banner>,
  ): Promise<BannerDocument | null> {
    return this.bannerModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string | Types.ObjectId): Promise<void> {
    await this.bannerModel.deleteOne({ _id: id }).exec();
  }

  async reorder(orderedIds: string[]): Promise<void> {
    const ops = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(id) },
        update: { $set: { order: index } },
      },
    }));
    await this.bannerModel.bulkWrite(ops);
  }
}
