import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import * as path from 'path';

const sensitiveFields = ['password', 'token', 'secret', 'authorization'];

const redactSensitiveData = winston.format((info) => {
  if (info.message && typeof info.message === 'string') {
    sensitiveFields.forEach((field) => {
      const regex = new RegExp(`("${field}"\\s*:\\s*)"[^"]*"`, 'gi');
      info.message = (info.message as string).replace(
        regex,
        `"${field}": "[REDACTED]"`,
      );
    });
  }
  return info;
});

export const winstonConfig: winston.LoggerOptions = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.colorize({ all: true }),
        winston.format.printf(
          ({ timestamp, level, context, message, ...meta }) => {
            const ctx = context ? `[${context as string}] ` : '';
            const metaStr = Object.keys(meta).length
              ? ` ${JSON.stringify(meta)}`
              : '';
            return `${timestamp as string} ${level} ${ctx}${message as string}${metaStr}`;
          },
        ),
      ),
    }),
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      format: winston.format.combine(
        redactSensitiveData(),
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      level: 'info',
      format: winston.format.combine(
        redactSensitiveData(),
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ],
};

@Module({
  imports: [WinstonModule.forRoot(winstonConfig)],
  exports: [WinstonModule],
})
export class LoggerModule {}
