import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { OrderItem, OrderItemDocument } from './schemas/order-item.schema';

@Injectable()
export class OrderItemsRepository {
  constructor(
    @InjectModel(OrderItem.name)
    private readonly orderItemModel: Model<OrderItem>,
  ) {}

  async createMany(
    items: Partial<OrderItem>[],
    session?: ClientSession,
  ): Promise<OrderItemDocument[]> {
    return this.orderItemModel.create(items, { session });
  }

  async findById(
    id: string | Types.ObjectId,
  ): Promise<OrderItemDocument | null> {
    return this.orderItemModel.findById(id).exec();
  }

  async findByOrderId(
    orderId: string | Types.ObjectId,
  ): Promise<OrderItemDocument[]> {
    return this.orderItemModel.find({ orderId }).exec();
  }

  async markReviewed(
    itemId: string | Types.ObjectId,
    reviewId: string | Types.ObjectId,
  ): Promise<void> {
    await this.orderItemModel
      .updateOne(
        { _id: itemId },
        { isReviewed: true, reviewId: new Types.ObjectId(reviewId.toString()) },
      )
      .exec();
  }
}
