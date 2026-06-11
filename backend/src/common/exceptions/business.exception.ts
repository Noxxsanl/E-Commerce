import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.constant';

export class BusinessException extends HttpException {
  readonly errorCode: ErrorCode;

  constructor(
    errorCode: ErrorCode,
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ errorCode, message, statusCode }, statusCode);
    this.errorCode = errorCode;
  }
}
