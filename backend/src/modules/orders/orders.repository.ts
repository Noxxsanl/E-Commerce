import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';

@Injectable()
export class OrdersRepository {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
  ) {}

  async create(
    data: Partial<Order>,
    session?: ClientSession,
  ): Promise<OrderDocument> {
    const [order] = await this.orderModel.create([data], { session });
    return order;
  }

  async findById(id: string | Types.ObjectId): Promise<OrderDocument | null> {
    return this.orderModel.findById(id).exec();
  }

  async findByIdAndUser(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<OrderDocument | null> {
    return this.orderModel.findOne({ _id: id, userId }).exec();
  }

  async findManyByUser(
    userId: string | Types.ObjectId,
    filter: Record<string, unknown>,
    pagination: { page: number; limit: number },
  ): Promise<{ items: OrderDocument[]; total: number }> {
    const query = { userId, ...filter };
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      this.orderModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .exec(),
      this.orderModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  async findMany(
    filter: Record<string, unknown>,
    sort: Record<string, 1 | -1>,
    pagination: { page: number; limit: number },
  ): Promise<{ items: OrderDocument[]; total: number }> {
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(pagination.limit)
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  findForExport(filter: Record<string, unknown>): Promise<OrderDocument[]> {
    return this.orderModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean()
      .exec() as unknown as Promise<OrderDocument[]>;
  }

  async updateStatus(
    id: string | Types.ObjectId,
    status: OrderStatus,
    updatedBy: string | Types.ObjectId,
    note?: string,
    session?: ClientSession,
  ): Promise<OrderDocument | null> {
    const historyEntry = {
      status,
      updatedAt: new Date(),
      updatedBy: new Types.ObjectId(updatedBy.toString()),
      ...(note ? { note } : {}),
    };

    return this.orderModel
      .findByIdAndUpdate(
        id,
        {
          $set: { status },
          $push: { statusHistory: historyEntry },
        },
        { new: true, session },
      )
      .exec();
  }

  async update(
    id: string | Types.ObjectId,
    data: Partial<Order>,
    session?: ClientSession,
  ): Promise<OrderDocument | null> {
    return this.orderModel
      .findByIdAndUpdate(id, data, { new: true, session })
      .exec();
  }

  async count(filter: Record<string, unknown>): Promise<number> {
    return this.orderModel.countDocuments(filter).exec();
  }

  async findPendingOlderThan(cutoffDate: Date): Promise<OrderDocument[]> {
    return this.orderModel
      .find({
        status: OrderStatus.PENDING,
        createdAt: { $lt: cutoffDate },
      })
      .exec();
  }
}
