import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ErrorCodes } from '../constants/error-codes.constant';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    info: { name?: string },
  ): TUser {
    if (info?.name === 'TokenExpiredError') {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.AUTH_TOKEN_EXPIRED,
        message: 'Token đã hết hạn',
      });
    }
    if (err || !user) {
      throw (
        err ??
        new UnauthorizedException({
          errorCode: ErrorCodes.AUTH_TOKEN_INVALID,
          message: 'Token không hợp lệ',
        })
      );
    }
    return user;
  }
}
