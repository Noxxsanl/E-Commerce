import {
  INestApplication,
  ModuleMetadata,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { REDIS_CLIENT } from '../src/cache/redis.provider';
import { EmailService } from '../src/modules/email/email.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { QUEUE_NAMES } from '../src/common/constants/queue.constant';
import jwtConfig from '../src/config/jwt.config';

// Env vars required by ConfigModule validation
function setTestEnv(mongoUri: string) {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-chars!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars!';
  process.env.JWT_ACCESS_EXPIRES = '15m';
  process.env.JWT_REFRESH_EXPIRES = '7d';
  process.env.MONGODB_URI = mongoUri;
  process.env.CLOUDINARY_CLOUD_NAME = 'test';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  process.env.SMTP_HOST = 'localhost';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'test@test.com';
  process.env.SMTP_PASS = 'testpass';
  process.env.SMTP_FROM = '"Test" <test@test.com>';
}

export function createRedisMock() {
  const store = new Map<string, string>();

  return {
    get: jest
      .fn()
      .mockImplementation(async (key: string) => store.get(key) ?? null),
    set: jest
      .fn()
      .mockImplementation(
        async (key: string, value: string, ...args: unknown[]) => {
          store.set(key, value);
          const exIdx = args.indexOf('EX');
          if (exIdx >= 0 && typeof args[exIdx + 1] === 'number') {
            setTimeout(
              () => store.delete(key),
              (args[exIdx + 1] as number) * 1000,
            );
          }
          return 'OK';
        },
      ),
    del: jest.fn().mockImplementation(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    incr: jest.fn().mockImplementation(async (key: string) => {
      const next = parseInt(store.get(key) ?? '0', 10) + 1;
      store.set(key, String(next));
      return next;
    }),
    expire: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockImplementation(async (pattern: string) => {
      const prefix = pattern.replace(/\*/g, '');
      return [...store.keys()].filter((k) => k.startsWith(prefix));
    }),
    _store: store,
  };
}

export function createQueueMock() {
  return {
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    getJob: jest.fn().mockResolvedValue(null),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

export function createEmailServiceMock() {
  return {
    sendVerifyEmail: jest.fn().mockResolvedValue(undefined),
    sendResetPassword: jest.fn().mockResolvedValue(undefined),
    sendPasswordChanged: jest.fn().mockResolvedValue(undefined),
    sendOrderConfirmation: jest.fn().mockResolvedValue(undefined),
    sendOrderStatusUpdate: jest.fn().mockResolvedValue(undefined),
  };
}

export interface TestAppContext {
  app: INestApplication;
  mongod: MongoMemoryReplSet;
  redisMock: ReturnType<typeof createRedisMock>;
  emailMock: ReturnType<typeof createEmailServiceMock>;
  queueMock: ReturnType<typeof createQueueMock>;
}

export async function bootstrapTestApp(
  imports: ModuleMetadata['imports'],
): Promise<TestAppContext> {
  const mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongod.getUri();
  setTestEnv(uri);

  const redisMock = createRedisMock();
  const queueMock = createQueueMock();
  const emailMock = createEmailServiceMock();

  const moduleFixture = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [jwtConfig],
      }),
      ThrottlerModule.forRoot([{ ttl: 60000, limit: 10000 }]),
      MongooseModule.forRoot(uri),
      // BullModule.forRoot is needed when feature modules import BullModule.registerQueue.
      // Queues are overridden below so no real Redis connection is made to process jobs.
      BullModule.forRoot({
        connection: {
          host: '127.0.0.1',
          port: 6379,
          maxRetriesPerRequest: null,
          enableOfflineQueue: false,
          connectTimeout: 1000,
          lazyConnect: true,
        },
      }),
      ...(imports ?? []),
    ],
    providers: [
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  })
    .overrideProvider(REDIS_CLIENT)
    .useValue(redisMock)
    .overrideProvider(EmailService)
    .useValue(emailMock)
    .overrideProvider(getQueueToken(QUEUE_NAMES.EMAIL))
    .useValue(queueMock)
    .overrideProvider(getQueueToken(QUEUE_NAMES.NOTIFICATION))
    .useValue(queueMock)
    .overrideProvider(getQueueToken(QUEUE_NAMES.ORDER))
    .useValue(queueMock)
    .overrideProvider(getQueueToken(QUEUE_NAMES.ANALYTICS))
    .useValue(queueMock)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.setGlobalPrefix('api/v1');
  await app.init();

  return { app, mongod, redisMock, emailMock, queueMock };
}

export async function closeTestApp(ctx: TestAppContext) {
  await ctx.app.close();
  await ctx.mongod.stop();
}
