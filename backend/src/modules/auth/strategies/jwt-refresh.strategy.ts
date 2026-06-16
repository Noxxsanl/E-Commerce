import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtRefreshPayload {
  sub: string;
  jti: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret') ?? '',
    });
  }

  // Chỉ verify format (signature + expiry) — passport-jwt đã làm điều này
  // trước khi gọi validate(). State thật (revoked, hash match) check ở AuthService.
  validate(payload: JwtRefreshPayload): JwtRefreshPayload {
    return payload;
  }
}
