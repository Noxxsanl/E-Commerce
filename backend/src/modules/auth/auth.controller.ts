import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, seconds } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerifyEmailDto } from './dto/resend-verify-email.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import type { UserDocument } from '../users/schemas/user.schema';
import type { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
  @ApiResponse({
    status: 201,
    description: 'Đăng ký thành công, đã gửi email xác thực',
  })
  @ApiResponse({ status: 409, description: 'Email đã được sử dụng' })
  async register(@Body() dto: RegisterDto): Promise<UserDocument> {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiBody({ type: LoginDto })
  @ApiOperation({ summary: 'Đăng nhập' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Sai email hoặc mật khẩu' })
  @ApiResponse({
    status: 403,
    description: 'Email chưa xác thực hoặc tài khoản bị khóa',
  })
  @ApiResponse({
    status: 429,
    description: 'Quá nhiều lần đăng nhập, thử lại sau',
  })
  async login(@CurrentUser() user: UserDocument): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: UserDocument;
  }> {
    return this.authService.login(user);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng xuất — revoke refresh token hiện tại' })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  async logout(
    @CurrentUser('_id') userId: string,
    @Body() dto: RefreshTokenDto,
  ): Promise<{ message: string }> {
    await this.authService.logout(userId, dto.refreshToken);
    return { message: 'Đăng xuất thành công' };
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @ApiOperation({ summary: 'Cấp lại cặp access/refresh token (rotation)' })
  @ApiResponse({ status: 200, description: 'Cấp token mới thành công' })
  @ApiResponse({
    status: 401,
    description: 'Refresh token không hợp lệ, hết hạn hoặc đã bị revoke',
  })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @CurrentUser() payload: JwtRefreshPayload,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    return this.authService.refresh(dto.refreshToken, payload.sub);
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Xác thực email bằng token' })
  @ApiResponse({ status: 200, description: 'Xác thực thành công' })
  @ApiResponse({
    status: 400,
    description: 'Token không hợp lệ hoặc đã hết hạn',
  })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ message: string }> {
    await this.authService.verifyEmail(dto.token);
    return { message: 'Xác thực email thành công' };
  }

  @Public()
  @Throttle({ default: { limit: 2, ttl: seconds(60) } })
  @Post('resend-verify-email')
  @ApiOperation({ summary: 'Gửi lại email xác thực' })
  @ApiResponse({ status: 200, description: 'Đã gửi lại email (nếu hợp lệ)' })
  async resendVerifyEmail(
    @Body() dto: ResendVerifyEmailDto,
  ): Promise<{ message: string }> {
    await this.authService.resendVerifyEmail(dto.email);
    return { message: 'Nếu email hợp lệ, một email xác thực mới đã được gửi' };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: seconds(60) } })
  @Post('forgot-password')
  @ApiOperation({ summary: 'Quên mật khẩu — gửi email đặt lại' })
  @ApiResponse({ status: 200, description: 'Đã gửi email (nếu hợp lệ)' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    return {
      message: 'Nếu email hợp lệ, một email đặt lại mật khẩu đã được gửi',
    };
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Đặt lại mật khẩu bằng token' })
  @ApiResponse({ status: 200, description: 'Đặt lại mật khẩu thành công' })
  @ApiResponse({
    status: 400,
    description: 'Token không hợp lệ hoặc đã hết hạn',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Đặt lại mật khẩu thành công' };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin người dùng hiện tại' })
  @ApiResponse({ status: 200, description: 'Thông tin người dùng' })
  me(@CurrentUser() user: UserDocument): UserDocument {
    return user;
  }
}
