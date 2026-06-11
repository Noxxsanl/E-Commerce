import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';
import { UploadResponseDto } from './dto/upload-response.dto';
import { DeleteFileDto } from './dto/delete-file.dto';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { LIMITS } from '../../common/constants/app.constant';

const multerOptions = {
  storage: memoryStorage(),
  limits: { fileSize: LIMITS.UPLOAD_MAX_SIZE_IMAGE },
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(
        new BadRequestException({
          errorCode: ErrorCodes.UPLOAD_INVALID_TYPE,
          message: 'Chỉ chấp nhận file ảnh (JPEG, PNG, GIF, WebP)',
        }),
        false,
      );
    } else {
      cb(null, true);
    }
  },
};

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload một ảnh lên Cloudinary' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File ảnh (JPEG, PNG, GIF, WebP, tối đa 5MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    type: UploadResponseDto,
    description: 'Upload thành công',
  })
  @ApiResponse({ status: 400, description: 'Sai định dạng hoặc file quá lớn' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException({
        errorCode: ErrorCodes.UPLOAD_INVALID_TYPE,
        message: 'Chưa chọn file',
      });
    }
    return this.uploadService.uploadImage(file);
  }

  @Post('images')
  @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload nhiều ảnh (tối đa 10)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Danh sách file ảnh (tối đa 10, mỗi file tối đa 5MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    type: [UploadResponseDto],
    description: 'Upload thành công',
  })
  @ApiResponse({ status: 400, description: 'Sai định dạng hoặc file quá lớn' })
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<UploadResponseDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException({
        errorCode: ErrorCodes.UPLOAD_INVALID_TYPE,
        message: 'Chưa chọn file',
      });
    }
    return this.uploadService.uploadImages(files);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa file trên Cloudinary theo publicId' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 400, description: 'publicId không hợp lệ' })
  async deleteFile(@Body() dto: DeleteFileDto): Promise<{ message: string }> {
    await this.uploadService.deleteFile(dto.publicId);
    return { message: 'Xóa file thành công' };
  }
}
