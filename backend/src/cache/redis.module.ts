import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { redisClientFactory } from './redis.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [redisClientFactory],
  exports: [redisClientFactory],
})
export class RedisModule {}
