import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserDocument } from '../../modules/users/schemas/user.schema';

export const CurrentUser = createParamDecorator(
  (field: keyof UserDocument | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: UserDocument }>();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);
