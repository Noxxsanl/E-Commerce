import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import {
  RefreshToken,
  RefreshTokenSchema,
} from './schemas/refresh-token.schema';
import { OtpToken, OtpTokenSchema } from './schemas/otp-token.schema';
import { UsersModule } from '../users/users.module';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { OtpTokenRepository } from './repositories/otp-token.repository';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: OtpToken.name, schema: OtpTokenSchema },
    ]),
    UsersModule,
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    RefreshTokenRepository,
    OtpTokenRepository,
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
    AuthService,
  ],
  exports: [MongooseModule, RefreshTokenRepository, OtpTokenRepository],
})
export class AuthModule {}
