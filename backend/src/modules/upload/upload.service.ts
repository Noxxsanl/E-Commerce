import { HttpStatus, Injectable } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { UploadResponseDto } from './dto/upload-response.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { LIMITS } from '../../common/constants/app.constant';

function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  // GIF: 47 49 46 38
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'image/gif';
  }
  // WebP: RIFF....WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

@Injectable()
export class UploadService {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  async uploadImage(
    file: Express.Multer.File,
    folder?: string,
  ): Promise<UploadResponseDto> {
    this.validateFileSize(file.buffer);
    this.validateMimeType(file.buffer);

    const result = await this.cloudinaryService.uploadImage(
      file.buffer,
      folder,
    );
    const thumbnailUrl = this.cloudinaryService.getThumbnailUrl(
      result.public_id,
    );

    return {
      url: result.secure_url,
      thumbnailUrl,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes,
    };
  }

  async uploadImages(
    files: Express.Multer.File[],
    folder?: string,
  ): Promise<UploadResponseDto[]> {
    return Promise.all(files.map((f) => this.uploadImage(f, folder)));
  }

  async deleteFile(publicId: string): Promise<void> {
    await this.cloudinaryService.deleteFile(publicId);
  }

  private validateFileSize(buffer: Buffer): void {
    if (buffer.length > LIMITS.UPLOAD_MAX_SIZE_IMAGE) {
      throw new BusinessException(
        ErrorCodes.UPLOAD_FILE_TOO_LARGE,
        `File quá lớn. Tối đa ${LIMITS.UPLOAD_MAX_SIZE_IMAGE / 1024 / 1024}MB`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private validateMimeType(buffer: Buffer): void {
    const mime = detectMimeType(buffer);
    if (!mime) {
      throw new BusinessException(
        ErrorCodes.UPLOAD_INVALID_TYPE,
        'Định dạng file không được hỗ trợ. Chỉ chấp nhận: JPEG, PNG, GIF, WebP',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
