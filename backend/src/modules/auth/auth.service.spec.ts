import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersRepository } from '../users/users.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { OtpTokenRepository } from './repositories/otp-token.repository';
import { EmailService } from '../email/email.service';
import { REDIS_CLIENT } from '../../cache/redis.provider';
import { UserStatus, UserRole } from '../users/schemas/user.schema';
import { OtpTokenType } from './schemas/otp-token.schema';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { Types } from 'mongoose';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../common/utils/crypto.util', () => ({
  generateToken: jest.fn().mockReturnValue('mock-token-uuid'),
  hashToken: jest.fn().mockResolvedValue('mock-token-hash'),
  verifyToken: jest.fn().mockResolvedValue(true),
}));

const mockUserId = new Types.ObjectId().toString();
const makeUser = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(mockUserId),
  email: 'test@example.com',
  fullName: 'Test User',
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
  isEmailVerified: true,
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;

  const usersRepo = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updateById: jest.fn(),
    updateLastLogin: jest.fn().mockResolvedValue(undefined),
    updatePassword: jest.fn(),
  };

  const refreshTokenRepo = {
    create: jest.fn(),
    findAndVerify: jest.fn(),
    revoke: jest.fn(),
    revokeAllByUser: jest.fn(),
  };

  const otpTokenRepo = {
    create: jest.fn(),
    findValid: jest.fn(),
    markUsed: jest.fn(),
    deleteByUserAndType: jest.fn(),
  };

  const jwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
    decode: jest.fn().mockReturnValue({ exp: 9999999999, iat: 0 }),
    verify: jest.fn(),
  };

  const configService = {
    get: jest.fn().mockReturnValue('secret'),
  };

  const emailService = {
    sendVerifyEmail: jest.fn().mockResolvedValue(undefined),
    sendResetPassword: jest.fn().mockResolvedValue(undefined),
    sendPasswordChanged: jest.fn().mockResolvedValue(undefined),
  };

  const redisMock = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersRepository, useValue: usersRepo },
        { provide: RefreshTokenRepository, useValue: refreshTokenRepo },
        { provide: OtpTokenRepository, useValue: otpTokenRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: EmailService, useValue: emailService },
        { provide: REDIS_CLIENT, useValue: redisMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    // restore common mocks
    jwtService.sign.mockReturnValue('mock-jwt-token');
    jwtService.decode.mockReturnValue({ exp: 9999999999, iat: 0 });
    refreshTokenRepo.create.mockResolvedValue({ _id: new Types.ObjectId() });
    otpTokenRepo.deleteByUserAndType.mockResolvedValue(undefined);
    otpTokenRepo.create.mockResolvedValue({ _id: new Types.ObjectId() });
    emailService.sendVerifyEmail.mockResolvedValue(undefined);
    emailService.sendResetPassword.mockResolvedValue(undefined);
    emailService.sendPasswordChanged.mockResolvedValue(undefined);
    usersRepo.updateLastLogin.mockResolvedValue(undefined);
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates user and sends verify email on happy path', async () => {
      usersRepo.findByEmail.mockResolvedValue(null);
      const user = makeUser({
        status: UserStatus.INACTIVE,
        isEmailVerified: false,
      });
      usersRepo.create.mockResolvedValue(user);

      const result = await service.register({
        fullName: 'Test',
        email: 'test@example.com',
        password: 'pass123',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('pass123', expect.any(Number));
      expect(usersRepo.create).toHaveBeenCalled();
      expect(emailService.sendVerifyEmail).toHaveBeenCalled();
      expect(result).toBe(user);
    });

    it('throws CONFLICT when email already taken', async () => {
      usersRepo.findByEmail.mockResolvedValue(makeUser());

      await expect(
        service.register({
          fullName: 'X',
          email: 'test@example.com',
          password: 'p',
        }),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.USER_EMAIL_TAKEN,
      });
      expect(usersRepo.create).not.toHaveBeenCalled();
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns tokens + user on success', async () => {
      const user = makeUser();

      const result = await service.login(user as never);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.refreshToken).toBe('mock-jwt-token');
      expect(result.user).toBe(user);
    });

    it('throws AUTH_EMAIL_NOT_VERIFIED when status is inactive', async () => {
      const user = makeUser({ status: UserStatus.INACTIVE });
      await expect(service.login(user as never)).rejects.toMatchObject({
        errorCode: ErrorCodes.AUTH_EMAIL_NOT_VERIFIED,
      });
    });

    it('throws AUTH_ACCOUNT_LOCKED when status is locked', async () => {
      const user = makeUser({ status: UserStatus.LOCKED });
      await expect(service.login(user as never)).rejects.toMatchObject({
        errorCode: ErrorCodes.AUTH_ACCOUNT_LOCKED,
      });
    });
  });

  // ── refresh ───────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('issues new token pair on valid refresh token', async () => {
      const user = makeUser();
      const record = {
        _id: new Types.ObjectId(),
        revokedAt: undefined,
        expiresAt: new Date(Date.now() + 60000),
        userId: user._id,
      };
      refreshTokenRepo.findAndVerify.mockResolvedValue(record);
      usersRepo.findById.mockResolvedValue(user);
      refreshTokenRepo.revoke.mockResolvedValue(undefined);

      const result = await service.refresh('valid-refresh', mockUserId);

      expect(refreshTokenRepo.revoke).toHaveBeenCalledWith(record._id);
      expect(result.accessToken).toBe('mock-jwt-token');
    });

    it('throws AUTH_REFRESH_TOKEN_INVALID when record not found', async () => {
      refreshTokenRepo.findAndVerify.mockResolvedValue(null);

      await expect(
        service.refresh('bad-token', mockUserId),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.AUTH_REFRESH_TOKEN_INVALID,
      });
    });

    it('revokes all tokens and throws on reuse attack (revokedAt set)', async () => {
      const record = {
        _id: new Types.ObjectId(),
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      };
      refreshTokenRepo.findAndVerify.mockResolvedValue(record);
      refreshTokenRepo.revokeAllByUser.mockResolvedValue(undefined);

      await expect(
        service.refresh('reused-token', mockUserId),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.AUTH_TOKEN_REVOKED,
      });
      expect(refreshTokenRepo.revokeAllByUser).toHaveBeenCalledWith(mockUserId);
    });

    it('throws AUTH_REFRESH_TOKEN_INVALID when token is expired', async () => {
      const record = {
        _id: new Types.ObjectId(),
        revokedAt: undefined,
        expiresAt: new Date(Date.now() - 1000), // in the past
      };
      refreshTokenRepo.findAndVerify.mockResolvedValue(record);

      await expect(
        service.refresh('expired-token', mockUserId),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.AUTH_REFRESH_TOKEN_INVALID,
      });
    });
  });

  // ── resetPassword ─────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('resets password and revokes all refresh tokens on success', async () => {
      const user = makeUser();
      const otp = { _id: new Types.ObjectId(), userId: user._id };
      otpTokenRepo.findValid.mockResolvedValue(otp);
      otpTokenRepo.markUsed.mockResolvedValue(undefined);
      usersRepo.updatePassword.mockResolvedValue(undefined);
      refreshTokenRepo.revokeAllByUser.mockResolvedValue(undefined);
      usersRepo.findById.mockResolvedValue(user);

      await service.resetPassword('valid-otp', 'NewPass@123');

      expect(otpTokenRepo.markUsed).toHaveBeenCalledWith(otp._id);
      expect(usersRepo.updatePassword).toHaveBeenCalled();
      expect(refreshTokenRepo.revokeAllByUser).toHaveBeenCalled();
      expect(emailService.sendPasswordChanged).toHaveBeenCalled();
    });

    it('throws AUTH_OTP_INVALID when OTP not found or expired', async () => {
      otpTokenRepo.findValid.mockResolvedValue(null);

      await expect(
        service.resetPassword('bad-otp', 'NewPass'),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.AUTH_OTP_INVALID,
      });
      expect(usersRepo.updatePassword).not.toHaveBeenCalled();
    });
  });

  // ── verifyEmail ───────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('marks OTP used and activates user on valid token', async () => {
      const otp = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        type: OtpTokenType.VERIFY_EMAIL,
      };
      otpTokenRepo.findValid.mockResolvedValue(otp);
      otpTokenRepo.markUsed.mockResolvedValue(undefined);
      usersRepo.updateById.mockResolvedValue(undefined);

      await service.verifyEmail('valid-token');

      expect(otpTokenRepo.markUsed).toHaveBeenCalledWith(otp._id);
      expect(usersRepo.updateById).toHaveBeenCalledWith(
        otp.userId,
        expect.objectContaining({
          isEmailVerified: true,
          status: UserStatus.ACTIVE,
        }),
      );
    });

    it('throws AUTH_OTP_INVALID when token not found', async () => {
      otpTokenRepo.findValid.mockResolvedValue(null);

      await expect(service.verifyEmail('invalid-token')).rejects.toMatchObject({
        errorCode: ErrorCodes.AUTH_OTP_INVALID,
      });
    });
  });
});

// Suppress 'unused' warning — BusinessException is used via rejects.toMatchObject
void BusinessException;
void HttpStatus;
