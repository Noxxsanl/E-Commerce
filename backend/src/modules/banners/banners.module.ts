import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Banner, BannerSchema } from './schemas/banner.schema';
import { BannersRepository } from './banners.repository';
import { BannersService } from './banners.service';
import { BannersController } from './banners.controller';
import { BannersAdminController } from './banners.admin.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Banner.name, schema: BannerSchema }]),
  ],
  controllers: [BannersController, BannersAdminController],
  providers: [BannersRepository, BannersService],
  exports: [MongooseModule, BannersService],
})
export class BannersModule {}
