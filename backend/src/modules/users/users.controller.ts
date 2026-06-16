import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import type { UserDocument } from './schemas/user.schema';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin hồ sơ cá nhân' })
  @ApiResponse({ status: 200, description: 'Thông tin người dùng' })
  async getProfile(@CurrentUser('_id') userId: string): Promise<UserDocument> {
    return this.usersService.getProfile(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Cập nhật hồ sơ cá nhân (fullName, phone)' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  async updateProfile(
    @CurrentUser('_id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserDocument> {
    return this.usersService.updateProfile(userId, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi mật khẩu' })
  @ApiResponse({ status: 200, description: 'Đổi mật khẩu thành công' })
  @ApiResponse({ status: 401, description: 'Mật khẩu hiện tại không đúng' })
  @ApiResponse({
    status: 400,
    description:
      'Xác nhận mật khẩu không khớp hoặc mật khẩu mới giống mật khẩu cũ',
  })
  async changePassword(
    @CurrentUser('_id') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.usersService.changePassword(userId, dto);
    return { message: 'Đổi mật khẩu thành công' };
  }

  @Patch('me/avatar')
  @ApiOperation({ summary: 'Cập nhật ảnh đại diện' })
  @ApiResponse({ status: 200, description: 'Cập nhật avatar thành công' })
  async updateAvatar(
    @CurrentUser('_id') userId: string,
    @Body() dto: UpdateAvatarDto,
  ): Promise<UserDocument> {
    return this.usersService.updateAvatar(userId, dto.avatarUrl);
  }
}
