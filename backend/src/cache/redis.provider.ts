import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const InjectRedis = () => Inject(REDIS_CLIENT);

export const redisClientFactory = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService): Redis => {
    const host = configService.get<string>('REDIS_HOST', 'localhost');
    const port = configService.get<number>('REDIS_PORT', 6379);
    const password = configService.get<string>('REDIS_PASSWORD', '');

    const client = new Redis({
      host,
      port,
      password: password || undefined,
      lazyConnect: false,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
    });

    client.on('connect', () => console.log('[Redis] Connected'));
    client.on('error', (err: Error) =>
      console.error('[Redis] Error:', err.message),
    );

    return client;
  },
  inject: [ConfigService],
};
