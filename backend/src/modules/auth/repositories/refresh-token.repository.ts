import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../schemas/refresh-token.schema';
import { verifyToken } from '../../../common/utils/crypto.util';

@Injectable()
export class RefreshTokenRepository {
  constructor(
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshToken>,
  ) {}

  async create(data: Partial<RefreshToken>): Promise<RefreshTokenDocument> {
    return this.refreshTokenModel.create(data);
  }

  async findActiveByUserId(
    userId: string | Types.ObjectId,
  ): Promise<RefreshTokenDocument[]> {
    return this.refreshTokenModel
      .find({ userId, revokedAt: { $exists: false } })
      .select('+tokenHash')
      .exec();
  }

  /**
   * Tìm refresh token record của user khớp với plainToken (bcrypt compare).
   * Trả về record bất kể đã revoke hay chưa — service sẽ tự kiểm tra
   * revokedAt để phát hiện reuse attack.
   */
  async findAndVerify(
    plainToken: string,
    userId: string | Types.ObjectId,
  ): Promise<RefreshTokenDocument | null> {
    const candidates = await this.refreshTokenModel
      .find({ userId })
      .select('+tokenHash')
      .exec();

    for (const candidate of candidates) {
      if (await verifyToken(plainToken, candidate.tokenHash)) {
        return candidate;
      }
    }
    return null;
  }

  async revoke(id: string | Types.ObjectId): Promise<void> {
    await this.refreshTokenModel
      .updateOne({ _id: id }, { revokedAt: new Date() })
      .exec();
  }

  async revokeAllByUser(userId: string | Types.ObjectId): Promise<void> {
    await this.refreshTokenModel
      .updateMany(
        { userId, revokedAt: { $exists: false } },
        { revokedAt: new Date() },
      )
      .exec();
  }
}
