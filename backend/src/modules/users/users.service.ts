import { HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from './users.repository';
import { UserDocument } from './schemas/user.schema';
import { RefreshTokenRepository } from '../auth/repositories/refresh-token.repository';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { LIMITS } from '../../common/constants/app.constant';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async getProfile(userId: string): Promise<UserDocument> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new BusinessException(
        ErrorCodes.USER_NOT_FOUND,
        'Người dùng không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }
    return user;
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserDocument> {
    const updated = await this.usersRepository.updateById(userId, dto);
    if (!updated) {
      throw new BusinessException(
        ErrorCodes.USER_NOT_FOUND,
        'Người dùng không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }
    return updated;
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const basicUser = await this.usersRepository.findById(userId);
    if (!basicUser) {
      throw new BusinessException(
        ErrorCodes.USER_NOT_FOUND,
        'Người dùng không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const user = await this.usersRepository.findByEmailWithPassword(
      basicUser.email,
    );
    if (!user) {
      throw new BusinessException(
        ErrorCodes.USER_NOT_FOUND,
        'Người dùng không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
      throw new BusinessException(
        ErrorCodes.USER_PASSWORD_WRONG,
        'Mật khẩu hiện tại không đúng',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BusinessException(
        ErrorCodes.VALIDATION_FAILED,
        'Xác nhận mật khẩu không khớp',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.newPassword === dto.currentPassword) {
      throw new BusinessException(
        ErrorCodes.USER_PASSWORD_SAME,
        'Mật khẩu mới phải khác mật khẩu hiện tại',
        HttpStatus.BAD_REQUEST,
      );
    }

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      LIMITS.BCRYPT_ROUNDS,
    );
    await this.usersRepository.updatePassword(userId, hashedPassword);
    await this.refreshTokenRepository.revokeAllByUser(userId);
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<UserDocument> {
    const updated = await this.usersRepository.updateById(userId, {
      avatar: avatarUrl,
    });
    if (!updated) {
      throw new BusinessException(
        ErrorCodes.USER_NOT_FOUND,
        'Người dùng không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }
    return updated;
  }
}
