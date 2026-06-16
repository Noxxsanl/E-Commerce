import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  OtpToken,
  OtpTokenDocument,
  OtpTokenType,
} from '../schemas/otp-token.schema';

@Injectable()
export class OtpTokenRepository {
  constructor(
    @InjectModel(OtpToken.name)
    private readonly otpTokenModel: Model<OtpToken>,
  ) {}

  async create(data: Partial<OtpToken>): Promise<OtpTokenDocument> {
    return this.otpTokenModel.create(data);
  }

  async findValid({
    token,
    type,
  }: {
    token: string;
    type: OtpTokenType;
  }): Promise<OtpTokenDocument | null> {
    return this.otpTokenModel
      .findOne({
        token,
        type,
        used: false,
        expiresAt: { $gt: new Date() },
      })
      .exec();
  }

  async markUsed(id: string | Types.ObjectId): Promise<void> {
    await this.otpTokenModel.updateOne({ _id: id }, { used: true }).exec();
  }

  async deleteByUserAndType(
    userId: string | Types.ObjectId,
    type: OtpTokenType,
  ): Promise<void> {
    await this.otpTokenModel.deleteMany({ userId, type }).exec();
  }
}
