import { HttpStatus, Injectable } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiErrorResponse,
  UploadApiResponse,
} from 'cloudinary';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';

@Injectable()
export class CloudinaryService {
  async uploadImage(
    buffer: Buffer,
    folder = 'ecommerce',
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          transformation: [
            {
              width: 1200,
              height: 1200,
              crop: 'limit',
              quality: 'auto',
              fetch_format: 'auto',
            },
          ],
        },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error) {
            reject(
              new BusinessException(
                ErrorCodes.UPLOAD_FAILED,
                `Upload thất bại: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
              ),
            );
            return;
          }
          if (!result) {
            reject(
              new BusinessException(
                ErrorCodes.UPLOAD_FAILED,
                'Upload thất bại',
                HttpStatus.INTERNAL_SERVER_ERROR,
              ),
            );
            return;
          }
          resolve(result);
        },
      );
      stream.end(buffer);
    });
  }

  getThumbnailUrl(publicId: string, width = 400, height = 400): string {
    return cloudinary.url(publicId, {
      width,
      height,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto',
      secure: true,
    });
  }

  async deleteFile(publicId: string): Promise<void> {
    const raw: unknown = await cloudinary.uploader.destroy(publicId);
    const result = raw as { result: string };
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new BusinessException(
        ErrorCodes.UPLOAD_FAILED,
        'Xóa file thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
