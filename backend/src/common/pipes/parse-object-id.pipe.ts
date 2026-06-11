import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';
import { ErrorCodes } from '../constants/error-codes.constant';

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<
  string,
  Types.ObjectId
> {
  transform(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_INVALID_OBJECT_ID,
        message: 'ID không hợp lệ',
      });
    }
    return new Types.ObjectId(value);
  }
}
