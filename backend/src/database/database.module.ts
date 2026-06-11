import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        retryWrites: true,
        serverSelectionTimeoutMS: 5000,
        connectionFactory: (connection: {
          on: (event: string, cb: () => void) => void;
        }) => {
          connection.on('connected', () => {
            console.log('[MongoDB] Connected');
          });
          connection.on('disconnected', () => {
            console.log('[MongoDB] Disconnected');
          });
          return connection;
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
