import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import {
  QueryBestSellersDto,
  QueryOrderStatsDto,
  QueryPendingReviewsDto,
  QueryRecentUsersDto,
  QueryRevenueDto,
} from './dto/query-dashboard.dto';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@Controller('admin/dashboard')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Tổng quan: doanh thu, đơn hàng, người dùng, sản phẩm',
  })
  async getStats(): Promise<unknown> {
    return this.dashboardService.getStats();
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Biểu đồ doanh thu theo ngày hoặc tháng' })
  async getRevenue(@Query() queryDto: QueryRevenueDto): Promise<unknown> {
    if (queryDto.period === 'day') {
      return this.dashboardService.getRevenueByDay(queryDto);
    }
    return this.dashboardService.getRevenueByMonth(queryDto);
  }

  @Get('orders/stats')
  @ApiOperation({ summary: 'Thống kê đơn hàng theo trạng thái' })
  async getOrderStats(@Query() queryDto: QueryOrderStatsDto): Promise<unknown> {
    return this.dashboardService.getOrderStats(queryDto);
  }

  @Get('products/best-sellers')
  @ApiOperation({ summary: 'Top sản phẩm bán chạy' })
  async getBestSellers(
    @Query() queryDto: QueryBestSellersDto,
  ): Promise<unknown> {
    return this.dashboardService.getBestSellers(queryDto);
  }

  @Get('users/recent')
  @ApiOperation({ summary: 'Users mới đăng ký gần đây' })
  async getRecentUsers(
    @Query() queryDto: QueryRecentUsersDto,
  ): Promise<unknown> {
    return this.dashboardService.getRecentUsers(queryDto);
  }

  @Get('reviews/pending')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Reviews chờ duyệt' })
  async getPendingReviews(
    @Query() queryDto: QueryPendingReviewsDto,
  ): Promise<unknown> {
    return this.dashboardService.getPendingReviews(queryDto);
  }
}
