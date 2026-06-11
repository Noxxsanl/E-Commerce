import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';
import { InjectRedis } from '../../cache/redis.provider';
import Redis from 'ioredis';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('System')
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check — ping MongoDB + Redis' })
  @ApiResponse({ status: 200, description: 'All services are up' })
  @ApiResponse({ status: 503, description: 'One or more services are down' })
  async check() {
    const mongoStatus =
      this.mongoConnection.readyState === ConnectionStates.connected
        ? 'up'
        : 'down';

    let redisStatus = 'down';
    try {
      await this.redis.ping();
      redisStatus = 'up';
    } catch {
      redisStatus = 'down';
    }

    const allUp = mongoStatus === 'up' && redisStatus === 'up';

    const result = {
      status: allUp ? 'ok' : 'degraded',
      services: {
        mongodb: mongoStatus,
        redis: redisStatus,
      },
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? '0.0.1',
    };

    if (!allUp) {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
