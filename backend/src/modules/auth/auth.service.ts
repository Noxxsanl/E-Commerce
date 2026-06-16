import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import type Redis from 'ioredis';
import { InjectRedis } from '../../cache/redis.provider';
import { UsersRepository } from '../users/users.repository';
import { UserDocument, UserStatus } from '../users/schemas/user.schema';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { OtpTokenRepository } from './repositories/otp-token.repository';
import { OtpTokenType } from './schemas/otp-token.schema';
import { EmailService } from '../email/email.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { LIMITS } from '../../common/constants/app.constant';
import { CacheKeys } from '../../common/constants/cache-keys.constant';
import { generateToken, hashToken } from '../../common/utils/crypto.util';
import { RegisterDto } from './dto/register.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthLoginResult extends AuthTokens {
  user: UserDocument;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly otpTokenRepository: OtpTokenRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDto): Promise<UserDocument> {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new BusinessException(
        ErrorCodes.USER_EMAIL_TAKEN,
        'Email đã được sử dụng',
        HttpStatus.CONFLICT,
      );
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      LIMITS.BCRYPT_ROUNDS,
    );

    const user = await this.usersRepository.create({
      fullName: dto.fullName,
      email: dto.email.toLowerCase(),
      password: hashedPassword,
    });

    await this.issueVerifyEmailOtp(user);

    return user;
  }

  async login(user: UserDocument): Promise<AuthLoginResult> {
    if (user.status === UserStatus.INACTIVE) {
      throw new BusinessException(
        ErrorCodes.AUTH_EMAIL_NOT_VERIFIED,
        'Vui lòng xác thực email trước khi đăng nhập',
        HttpStatus.FORBIDDEN,
      );
    }

    if (user.status === UserStatus.LOCKED) {
      throw new BusinessException(
        ErrorCodes.AUTH_ACCOUNT_LOCKED,
        'Tài khoản đã bị khóa',
        HttpStatus.FORBIDDEN,
      );
    }

    const tokens = await this.issueTokenPair(user);

    this.usersRepository
      .updateLastLogin(user._id)
      .catch((err: Error) =>
        this.logger.error(`Failed to update lastLoginAt: ${err.message}`),
      );

    return { ...tokens, user };
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const record = await this.refreshTokenRepository.findAndVerify(
      refreshToken,
      userId,
    );
    if (record && !record.revokedAt) {
      await this.refreshTokenRepository.revoke(record._id);
    }
  }

  async refresh(refreshToken: string, userId: string): Promise<AuthTokens> {
    const record = await this.refreshTokenRepository.findAndVerify(
      refreshToken,
      userId,
    );

    if (!record) {
      throw new BusinessException(
        ErrorCodes.AUTH_REFRESH_TOKEN_INVALID,
        'Refresh token không hợp lệ',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (record.revokedAt) {
      // Reuse attack: token cũ đã bị revoke nhưng vẫn được dùng lại
      await this.refreshTokenRepository.revokeAllByUser(userId);
      throw new BusinessException(
        ErrorCodes.AUTH_TOKEN_REVOKED,
        'Phát hiện refresh token bị tái sử dụng. Vui lòng đăng nhập lại.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (record.expiresAt < new Date()) {
      throw new BusinessException(
        ErrorCodes.AUTH_REFRESH_TOKEN_INVALID,
        'Refresh token đã hết hạn',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.refreshTokenRepository.revoke(record._id);

    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new BusinessException(
        ErrorCodes.USER_NOT_FOUND,
        'Người dùng không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.issueTokenPair(user);
  }

  async verifyEmail(token: string): Promise<void> {
    const otp = await this.otpTokenRepository.findValid({
      token,
      type: OtpTokenType.VERIFY_EMAIL,
    });

    if (!otp) {
      throw new BusinessException(
        ErrorCodes.AUTH_OTP_INVALID,
        'Token xác thực không hợp lệ hoặc đã hết hạn',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.otpTokenRepository.markUsed(otp._id);
    await this.usersRepository.updateById(otp.userId, {
      isEmailVerified: true,
      status: UserStatus.ACTIVE,
    });
  }

  async resendVerifyEmail(email: string): Promise<void> {
    const user = await this.usersRepository.findByEmail(email);
    // Không tiết lộ email có tồn tại hay không, và bỏ qua nếu đã verified
    if (!user || user.isEmailVerified) {
      return;
    }

    const cooldownKey = CacheKeys.RATE_LIMIT_RESEND_EMAIL(user._id.toString());
    const acquired = await this.redis.set(
      cooldownKey,
      '1',
      'EX',
      LIMITS.RESEND_EMAIL_COOLDOWN_SECONDS,
      'NX',
    );
    if (!acquired) {
      return;
    }

    await this.issueVerifyEmailOtp(user);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      return; // luôn return 200, không tiết lộ email có tồn tại không
    }

    await this.otpTokenRepository.deleteByUserAndType(
      user._id,
      OtpTokenType.RESET_PASSWORD,
    );

    const token = generateToken();
    await this.otpTokenRepository.create({
      userId: user._id,
      token,
      type: OtpTokenType.RESET_PASSWORD,
      expiresAt: new Date(Date.now() + LIMITS.OTP_TTL_MINUTES * 60 * 1000),
    });

    await this.emailService.sendResetPassword(user.email, user.fullName, token);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const otp = await this.otpTokenRepository.findValid({
      token,
      type: OtpTokenType.RESET_PASSWORD,
    });

    if (!otp) {
      throw new BusinessException(
        ErrorCodes.AUTH_OTP_INVALID,
        'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.otpTokenRepository.markUsed(otp._id);

    const hashedPassword = await bcrypt.hash(newPassword, LIMITS.BCRYPT_ROUNDS);
    await this.usersRepository.updatePassword(otp.userId, hashedPassword);
    await this.refreshTokenRepository.revokeAllByUser(otp.userId);

    const user = await this.usersRepository.findById(otp.userId);
    if (user) {
      await this.emailService.sendPasswordChanged(
        user.email,
        user.fullName,
        new Date().toLocaleString('vi-VN'),
      );
    }
  }

  private async issueVerifyEmailOtp(user: UserDocument): Promise<void> {
    await this.otpTokenRepository.deleteByUserAndType(
      user._id,
      OtpTokenType.VERIFY_EMAIL,
    );

    const token = generateToken();
    await this.otpTokenRepository.create({
      userId: user._id,
      token,
      type: OtpTokenType.VERIFY_EMAIL,
      expiresAt: new Date(Date.now() + LIMITS.OTP_TTL_MINUTES * 60 * 1000),
    });

    await this.emailService.sendVerifyEmail(user.email, user.fullName, token);
  }

  private async issueTokenPair(user: UserDocument): Promise<AuthTokens> {
    const userId = user._id.toString();

    const accessExpiresIn = this.configService.get<string>(
      'jwt.accessExpiresIn',
    ) as NonNullable<JwtSignOptions['expiresIn']>;
    const refreshExpiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
    ) as NonNullable<JwtSignOptions['expiresIn']>;

    const accessToken = this.jwtService.sign(
      { sub: userId, email: user.email, role: user.role },
      {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: accessExpiresIn,
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, jti: generateToken() },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
      },
    );

    const accessDecoded = this.jwtService.decode<{
      exp: number;
      iat: number;
    }>(accessToken);
    const refreshDecoded = this.jwtService.decode<{ exp: number }>(
      refreshToken,
    );

    const tokenHash = await hashToken(refreshToken);
    await this.refreshTokenRepository.create({
      userId: new Types.ObjectId(userId),
      tokenHash,
      expiresAt: new Date(refreshDecoded.exp * 1000),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessDecoded.exp - accessDecoded.iat,
    };
  }
}
