import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  UserDocument,
  UserRole,
} from '../../modules/users/schemas/user.schema';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ErrorCodes } from '../constants/error-codes.constant';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: UserDocument }>();
    const user = request.user;
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.AUTH_TOKEN_INVALID,
        message: 'Bạn không có quyền thực hiện hành động này',
      });
    }
    return true;
  }
}
