import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Address, AddressDocument } from './schemas/address.schema';

@Injectable()
export class AddressesRepository {
  constructor(
    @InjectModel(Address.name) private readonly addressModel: Model<Address>,
  ) {}

  async findByUserId(
    userId: string | Types.ObjectId,
  ): Promise<AddressDocument[]> {
    return this.addressModel.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  async findByIdAndUser(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<AddressDocument | null> {
    return this.addressModel.findOne({ _id: id, userId }).exec();
  }

  async create(data: Partial<Address>): Promise<AddressDocument> {
    return this.addressModel.create(data);
  }

  async update(
    id: string | Types.ObjectId,
    data: Partial<Address>,
  ): Promise<AddressDocument | null> {
    return this.addressModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string | Types.ObjectId): Promise<void> {
    await this.addressModel.deleteOne({ _id: id }).exec();
  }

  async countByUser(userId: string | Types.ObjectId): Promise<number> {
    return this.addressModel.countDocuments({ userId }).exec();
  }

  async unsetDefault(userId: string | Types.ObjectId): Promise<void> {
    await this.addressModel
      .updateMany({ userId, isDefault: true }, { isDefault: false })
      .exec();
  }

  async setDefault(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<void> {
    await this.addressModel
      .updateOne({ _id: id, userId }, { isDefault: true })
      .exec();
  }
}
