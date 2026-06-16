import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CouponsService, CouponValidationResult } from './coupons.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@ApiTags('Coupons')
@ApiBearerAuth()
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post('validate')
  @ApiOperation({ summary: 'Kiểm tra và tính toán giảm giá của mã coupon' })
  @ApiResponse({ status: 200, description: 'Mã hợp lệ, trả về discountAmount' })
  @ApiResponse({ status: 404, description: 'Mã không tồn tại' })
  @ApiResponse({ status: 422, description: 'Mã không đủ điều kiện áp dụng' })
  async validate(
    @CurrentUser('_id') userId: string,
    @Body() dto: ValidateCouponDto,
  ): Promise<CouponValidationResult> {
    return this.couponsService.validateCoupon(dto.code, userId, dto.subtotal);
  }
}
