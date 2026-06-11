import { Global, Module } from '@nestjs/common';
import { CloudinaryProvider } from './cloudinary.provider';
import { CloudinaryService } from './cloudinary.service';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';

@Global()
@Module({
  providers: [CloudinaryProvider, CloudinaryService, UploadService],
  controllers: [UploadController],
  exports: [CloudinaryService, UploadService],
})
export class UploadModule {}
