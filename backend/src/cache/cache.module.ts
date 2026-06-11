import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const port = configService.get<number>('REDIS_PORT', 6379);
        const password = configService.get<string>('REDIS_PASSWORD', '');
        const url = password
          ? `redis://:${password}@${host}:${port}`
          : `redis://${host}:${port}`;
        return {
          stores: [createKeyv(url)],
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class AppCacheModule {}
