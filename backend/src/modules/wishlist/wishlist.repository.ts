import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Wishlist, WishlistDocument } from './schemas/wishlist.schema';

@Injectable()
export class WishlistRepository {
  constructor(
    @InjectModel(Wishlist.name)
    private readonly wishlistModel: Model<Wishlist>,
  ) {}

  async findByUserId(
    userId: string | Types.ObjectId,
  ): Promise<WishlistDocument | null> {
    return this.wishlistModel.findOne({ userId }).exec();
  }

  async findOrCreate(
    userId: string | Types.ObjectId,
  ): Promise<WishlistDocument> {
    const existing = await this.findByUserId(userId);
    if (existing) return existing;
    return this.wishlistModel.create({ userId, items: [] });
  }

  /**
   * Push productId vào items nếu chưa tồn tại — atomic, idempotent.
   * Trả về true nếu vừa thêm mới, false nếu đã tồn tại từ trước.
   */
  async addItemIfNotExists(
    userId: string | Types.ObjectId,
    productId: string | Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.wishlistModel
      .updateOne(
        { userId, 'items.productId': { $ne: new Types.ObjectId(productId) } },
        { $push: { items: { productId, addedAt: new Date() } } },
      )
      .exec();
    return result.modifiedCount > 0;
  }

  async removeItem(
    userId: string | Types.ObjectId,
    productId: string | Types.ObjectId,
  ): Promise<void> {
    await this.wishlistModel
      .updateOne({ userId }, { $pull: { items: { productId } } })
      .exec();
  }

  async existsItem(
    userId: string | Types.ObjectId,
    productId: string | Types.ObjectId,
  ): Promise<boolean> {
    const count = await this.wishlistModel
      .countDocuments({ userId, 'items.productId': productId })
      .exec();
    return count > 0;
  }
}
