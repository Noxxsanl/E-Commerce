import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from '../../users/users.repository';
import { UserDocument } from '../../users/schemas/user.schema';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCodes } from '../../../common/constants/error-codes.constant';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersRepository: UsersRepository) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  async validate(email: string, password: string): Promise<UserDocument> {
    const user = await this.usersRepository.findByEmailWithPassword(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new BusinessException(
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
        'Email hoặc mật khẩu không đúng',
        401,
      );
    }

    return user;
  }
}
