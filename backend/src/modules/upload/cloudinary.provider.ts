import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export const CLOUDINARY_TOKEN = 'CLOUDINARY';

export const CloudinaryProvider: FactoryProvider = {
  provide: CLOUDINARY_TOKEN,
  useFactory: (configService: ConfigService) => {
    return cloudinary.config({
      cloud_name: configService.get<string>('cloudinary.cloudName'),
      api_key: configService.get<string>('cloudinary.apiKey'),
      api_secret: configService.get<string>('cloudinary.apiSecret'),
    });
  },
  inject: [ConfigService],
};
