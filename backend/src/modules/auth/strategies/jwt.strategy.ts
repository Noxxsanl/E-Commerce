import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersRepository } from '../../users/users.repository';
import { UserStatus } from '../../users/schemas/user.schema';
import { InjectRedis } from '../../../cache/redis.provider';
import type Redis from 'ioredis';
import { CacheKeys } from '../../../common/constants/cache-keys.constant';
import { LIMITS } from '../../../common/constants/app.constant';
import { ErrorCodes } from '../../../common/constants/error-codes.constant';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: string;
}

interface CachedUser {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  status: UserStatus;
  isEmailVerified: boolean;
  [key: string]: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersRepository: UsersRepository,
    @InjectRedis() private readonly redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret') ?? '',
    });
  }

  async validate(payload: JwtAccessPayload): Promise<CachedUser> {
    const cacheKey = CacheKeys.USER_SESSION(payload.sub);
    const cached = await this.redis.get(cacheKey);

    let user: CachedUser | null = null;

    if (cached) {
      user = JSON.parse(cached) as CachedUser;
    } else {
      const doc = await this.usersRepository.findById(payload.sub);
      if (!doc) {
        throw new UnauthorizedException({
          errorCode: ErrorCodes.AUTH_TOKEN_INVALID,
          message: 'Người dùng không tồn tại',
        });
      }
      user = JSON.parse(JSON.stringify(doc)) as CachedUser;
      await this.redis.set(
        cacheKey,
        JSON.stringify(user),
        'EX',
        LIMITS.JWT_CACHE_TTL_SECONDS,
      );
    }

    if (user.status === UserStatus.LOCKED) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.AUTH_ACCOUNT_LOCKED,
        message: 'Tài khoản đã bị khóa',
      });
    }

    return user;
  }
}
