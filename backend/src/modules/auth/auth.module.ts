import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RefreshToken,
  RefreshTokenSchema,
} from './schemas/refresh-token.schema';
import { OtpToken, OtpTokenSchema } from './schemas/otp-token.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: OtpToken.name, schema: OtpTokenSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class AuthModule {}
