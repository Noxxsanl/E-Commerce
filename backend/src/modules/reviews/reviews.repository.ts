import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';
import { ProductsRepository } from '../products/products.repository';

export interface RatingSummary {
  averageRating: number;
  reviewCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

@Injectable()
export class ReviewsRepository {
  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
    private readonly productsRepository: ProductsRepository,
  ) {}

  async findByProductId(
    productId: string | Types.ObjectId,
    filter: Record<string, unknown>,
    pagination: { page: number; limit: number },
  ): Promise<{ items: ReviewDocument[]; total: number }> {
    const query = {
      productId,
      isApproved: true,
      isHidden: false,
      ...filter,
    };
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      this.reviewModel
        .find(query)
        .populate('userId', 'fullName avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .exec(),
      this.reviewModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  async findByProductIdAdmin(
    productId: string | Types.ObjectId,
    filter: Record<string, unknown>,
    pagination: { page: number; limit: number },
  ): Promise<{ items: ReviewDocument[]; total: number }> {
    const query = { productId, ...filter };
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      this.reviewModel
        .find(query)
        .populate('userId', 'fullName avatar email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .exec(),
      this.reviewModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  async findMany(
    filter: Record<string, unknown>,
    pagination: { page: number; limit: number },
  ): Promise<{ items: ReviewDocument[]; total: number }> {
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .populate('userId', 'fullName avatar')
        .populate('productId', 'name thumbnailUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .exec(),
      this.reviewModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async findById(id: string | Types.ObjectId): Promise<ReviewDocument | null> {
    return this.reviewModel.findById(id).exec();
  }

  async findByOrderItemId(
    orderItemId: string | Types.ObjectId,
  ): Promise<ReviewDocument | null> {
    return this.reviewModel.findOne({ orderItemId }).exec();
  }

  async create(data: Partial<Review>): Promise<ReviewDocument> {
    return this.reviewModel.create(data);
  }

  async update(
    id: string | Types.ObjectId,
    data: Partial<Review>,
  ): Promise<ReviewDocument | null> {
    return this.reviewModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string | Types.ObjectId): Promise<void> {
    await this.reviewModel.deleteOne({ _id: id }).exec();
  }

  async getRatingSummary(
    productId: string | Types.ObjectId,
  ): Promise<RatingSummary> {
    const result = await this.reviewModel
      .aggregate<{
        averageRating: number;
        reviewCount: number;
        dist: { _id: number; count: number }[];
      }>([
        {
          $match: {
            productId: new Types.ObjectId(productId.toString()),
            isApproved: true,
            isHidden: false,
          },
        },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  averageRating: { $avg: '$rating' },
                  reviewCount: { $sum: 1 },
                },
              },
            ],
            distribution: [{ $group: { _id: '$rating', count: { $sum: 1 } } }],
          },
        },
        {
          $project: {
            averageRating: {
              $ifNull: [{ $arrayElemAt: ['$summary.averageRating', 0] }, 0],
            },
            reviewCount: {
              $ifNull: [{ $arrayElemAt: ['$summary.reviewCount', 0] }, 0],
            },
            dist: '$distribution',
          },
        },
      ])
      .exec();

    const row = result[0] ?? { averageRating: 0, reviewCount: 0, dist: [] };
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<
      1 | 2 | 3 | 4 | 5,
      number
    >;
    for (const d of row.dist ?? []) {
      if (d._id >= 1 && d._id <= 5) {
        distribution[d._id as 1 | 2 | 3 | 4 | 5] = d.count;
      }
    }

    return {
      averageRating: Math.round((row.averageRating ?? 0) * 10) / 10,
      reviewCount: row.reviewCount ?? 0,
      distribution,
    };
  }

  async recalculateProductRating(
    productId: string | Types.ObjectId,
  ): Promise<void> {
    const summary = await this.getRatingSummary(productId);
    await this.productsRepository.updateStats(productId.toString(), {
      averageRating: summary.averageRating,
      reviewCount: summary.reviewCount,
    });
  }
}
