import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserStatus } from './schemas/user.schema';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+password')
      .exec();
  }

  async findById(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async create(data: Partial<User>): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  async updateById(
    id: string | Types.ObjectId,
    data: Partial<User>,
  ): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async updateLastLogin(id: string | Types.ObjectId): Promise<void> {
    await this.userModel
      .updateOne({ _id: id }, { lastLoginAt: new Date() })
      .exec();
  }

  async updatePassword(
    id: string | Types.ObjectId,
    hashedPassword: string,
  ): Promise<void> {
    await this.userModel
      .updateOne({ _id: id }, { password: hashedPassword })
      .exec();
  }

  async updateStatus(
    id: string | Types.ObjectId,
    status: UserStatus,
    reason?: string,
  ): Promise<void> {
    const update: Partial<User> & { lockedAt?: Date } = { status };
    if (status === UserStatus.LOCKED) {
      update.lockedAt = new Date();
      update.lockedReason = reason ?? '';
    }
    await this.userModel.updateOne({ _id: id }, update).exec();
  }
}
