import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Cart, CartDocument } from './schemas/cart.schema';

@Injectable()
export class CartRepository {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<Cart>,
  ) {}

  async findByUserId(
    userId: string | Types.ObjectId,
  ): Promise<CartDocument | null> {
    return this.cartModel.findOne({ userId }).exec();
  }

  async findOrCreate(userId: string | Types.ObjectId): Promise<CartDocument> {
    const existing = await this.findByUserId(userId);
    if (existing) return existing;
    return this.cartModel.create({ userId, items: [] });
  }

  async save(cart: CartDocument): Promise<CartDocument> {
    return cart.save();
  }

  async clear(
    userId: string | Types.ObjectId,
    session?: ClientSession,
  ): Promise<void> {
    await this.cartModel
      .updateOne({ userId }, { items: [] }, { session })
      .exec();
  }
}
