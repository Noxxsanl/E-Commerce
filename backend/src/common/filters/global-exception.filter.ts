import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { BusinessException } from '../exceptions/business.exception';
import { ErrorCodes } from '../constants/error-codes.constant';

interface MongoError extends Error {
  code: number;
}

function isMongoServerError(err: unknown): err is MongoError {
  return (
    err instanceof Error && 'code' in err && (err as MongoError).code === 11000
  );
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof BusinessException) {
      const body = exception.getResponse() as {
        errorCode: string;
        message: string;
      };
      response.status(exception.getStatus()).json({
        success: false,
        errorCode: body.errorCode,
        message: body.message,
        statusCode: exception.getStatus(),
      });
      return;
    }

    if (exception instanceof BadRequestException) {
      const body = exception.getResponse();
      const isValidationError =
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        Array.isArray((body as Record<string, unknown>)['message']);

      if (isValidationError) {
        const messages = (body as { message: string[] }).message;
        response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
          success: false,
          errorCode: ErrorCodes.VALIDATION_FAILED,
          message: messages[0] ?? 'Dữ liệu không hợp lệ',
          errors: messages,
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        });
        return;
      }

      const message =
        typeof body === 'object' && body !== null && 'message' in body
          ? (body as { message: string }).message
          : exception.message;

      response.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        errorCode: ErrorCodes.VALIDATION_FAILED,
        message,
        statusCode: HttpStatus.BAD_REQUEST,
      });
      return;
    }

    if (isMongoServerError(exception)) {
      response.status(HttpStatus.CONFLICT).json({
        success: false,
        errorCode: ErrorCodes.VALIDATION_FAILED,
        message: 'Dữ liệu đã tồn tại',
        statusCode: HttpStatus.CONFLICT,
      });
      return;
    }

    if (exception instanceof UnauthorizedException) {
      response.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        errorCode: ErrorCodes.AUTH_TOKEN_INVALID,
        message: exception.message || 'Không có quyền truy cập',
        statusCode: HttpStatus.UNAUTHORIZED,
      });
      return;
    }

    if (exception instanceof ForbiddenException) {
      response.status(HttpStatus.FORBIDDEN).json({
        success: false,
        errorCode: ErrorCodes.AUTH_TOKEN_INVALID,
        message:
          exception.message || 'Bạn không có quyền thực hiện hành động này',
        statusCode: HttpStatus.FORBIDDEN,
      });
      return;
    }

    if (exception instanceof NotFoundException) {
      response.status(HttpStatus.NOT_FOUND).json({
        success: false,
        errorCode: ErrorCodes.VALIDATION_FAILED,
        message: exception.message || 'Không tìm thấy',
        statusCode: HttpStatus.NOT_FOUND,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'object' && body !== null && 'message' in body
          ? (body as { message: string }).message
          : exception.message;

      response.status(status).json({
        success: false,
        errorCode: ErrorCodes.SYS_INTERNAL_ERROR,
        message,
        statusCode: status,
      });
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.message : 'Unknown error',
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      errorCode: ErrorCodes.SYS_INTERNAL_ERROR,
      message: 'Đã xảy ra lỗi hệ thống',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}
