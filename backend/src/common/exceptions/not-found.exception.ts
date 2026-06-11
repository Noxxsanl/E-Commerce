import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.constant';
import { BusinessException } from './business.exception';

export class NotFoundException extends BusinessException {
  constructor(errorCode: ErrorCode, message: string) {
    super(errorCode, message, HttpStatus.NOT_FOUND);
  }
}
