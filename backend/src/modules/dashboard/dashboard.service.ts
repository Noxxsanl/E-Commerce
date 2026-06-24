import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderStatus } from '../orders/schemas/order.schema';
import { OrderItem } from '../orders/schemas/order-item.schema';
import { User, UserStatus } from '../users/schemas/user.schema';
import { Product } from '../products/schemas/product.schema';
import { Review } from '../reviews/schemas/review.schema';
import { CacheKeys } from '../../common/constants/cache-keys.constant';
import {
  QueryBestSellersDto,
  QueryOrderStatsDto,
  QueryPendingReviewsDto,
  QueryRecentUsersDto,
  QueryRevenueDto,
} from './dto/query-dashboard.dto';

const STATS_TTL = 5 * 60 * 1000;
const REVENUE_DAY_TTL = 60 * 60 * 1000;
const REVENUE_MONTH_TTL = 6 * 60 * 60 * 1000;
const BEST_SELLERS_TTL = 30 * 60 * 1000;

const PERIOD_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
const MONTH_LABELS = [
  'Th1',
  'Th2',
  'Th3',
  'Th4',
  'Th5',
  'Th6',
  'Th7',
  'Th8',
  'Th9',
  'Th10',
  'Th11',
  'Th12',
];

// ── Internal aggregate result shapes ──────────────────────────────────────────

interface RevenueDoc {
  revenue: number;
}
interface StatusCountDoc {
  _id: string;
  count: number;
}
interface SimpleCountDoc {
  count: number;
}
interface RevenueFacet {
  today: RevenueDoc[];
  thisMonth: RevenueDoc[];
  lastMonth: RevenueDoc[];
}
interface OrderFacet {
  byStatus: StatusCountDoc[];
  todayCount: SimpleCountDoc[];
}
interface UserFacet {
  byStatus: StatusCountDoc[];
  newThisMonth: SimpleCountDoc[];
  newLastMonth: SimpleCountDoc[];
}
interface ProductFacet {
  total: SimpleCountDoc[];
  active: SimpleCountDoc[];
  outOfStock: SimpleCountDoc[];
  flashSale: SimpleCountDoc[];
  featured: SimpleCountDoc[];
}
interface RevenueGroupDoc {
  _id: number;
  revenue: number;
  orderCount: number;
}
interface BestSellerRaw {
  _id: Types.ObjectId;
  totalSold: number;
  revenue: number;
  product: Array<{
    _id: Types.ObjectId;
    name: string;
    thumbnailUrl: string;
    averageRating: number;
    stock: number;
  }>;
}
interface RecentUserRaw {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  avatar: string | null;
  status: string;
  createdAt: Date;
  orderCount: number;
}
interface PendingReviewItemRaw {
  _id: Types.ObjectId;
  rating: number;
  content: string;
  images: string[];
  createdAt: Date;
  product: Array<{ _id: Types.ObjectId; name: string; thumbnailUrl: string }>;
  user: Array<{ _id: Types.ObjectId; fullName: string; email: string }>;
}
interface PendingReviewFacet {
  total: SimpleCountDoc[];
  items: PendingReviewItemRaw[];
}

// ──────────────────────────────────────────────────────────────────────────────

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(OrderItem.name)
    private readonly orderItemModel: Model<OrderItem>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getStats(): Promise<unknown> {
    const cached = await this.cacheManager.get(CacheKeys.DASHBOARD_STATS);
    if (cached) return cached;

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [revenueAgg, orderAgg, userAgg, productAgg] = await Promise.all([
      this.orderModel.aggregate<RevenueFacet>([
        {
          $facet: {
            today: [
              {
                $match: {
                  status: OrderStatus.DELIVERED,
                  createdAt: { $gte: todayStart },
                },
              },
              { $group: { _id: null, revenue: { $sum: '$totalAmount' } } },
            ],
            thisMonth: [
              {
                $match: {
                  status: OrderStatus.DELIVERED,
                  createdAt: { $gte: thisMonthStart, $lt: nextMonthStart },
                },
              },
              { $group: { _id: null, revenue: { $sum: '$totalAmount' } } },
            ],
            lastMonth: [
              {
                $match: {
                  status: OrderStatus.DELIVERED,
                  createdAt: { $gte: lastMonthStart, $lt: thisMonthStart },
                },
              },
              { $group: { _id: null, revenue: { $sum: '$totalAmount' } } },
            ],
          },
        },
      ]),
      this.orderModel.aggregate<OrderFacet>([
        {
          $facet: {
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            todayCount: [
              { $match: { createdAt: { $gte: todayStart } } },
              { $count: 'count' },
            ],
          },
        },
      ]),
      this.userModel.aggregate<UserFacet>([
        {
          $facet: {
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            newThisMonth: [
              { $match: { createdAt: { $gte: thisMonthStart } } },
              { $count: 'count' },
            ],
            newLastMonth: [
              {
                $match: {
                  createdAt: { $gte: lastMonthStart, $lt: thisMonthStart },
                },
              },
              { $count: 'count' },
            ],
          },
        },
      ]),
      this.productModel.aggregate<ProductFacet>([
        {
          $facet: {
            total: [{ $count: 'count' }],
            active: [{ $match: { isActive: true } }, { $count: 'count' }],
            outOfStock: [
              { $match: { stock: { $lte: 0 } } },
              { $count: 'count' },
            ],
            flashSale: [
              { $match: { isFlashSale: true, isActive: true } },
              { $count: 'count' },
            ],
            featured: [
              { $match: { isFeatured: true, isActive: true } },
              { $count: 'count' },
            ],
          },
        },
      ]),
    ]);

    // Revenue
    const rev = revenueAgg[0];
    const todayRev = rev?.today[0]?.revenue ?? 0;
    const thisMonth = rev?.thisMonth[0]?.revenue ?? 0;
    const lastMonth = rev?.lastMonth[0]?.revenue ?? 0;
    const growthPercent =
      lastMonth === 0
        ? 0
        : Math.round(((thisMonth - lastMonth) / lastMonth) * 10000) / 100;

    // Orders
    const ord = orderAgg[0];
    const statusMap = new Map(
      (ord?.byStatus ?? []).map((s) => [s._id, s.count]),
    );
    const orderTotal = (ord?.byStatus ?? []).reduce((s, d) => s + d.count, 0);

    // Users
    const usr = userAgg[0];
    const userStatusMap = new Map(
      (usr?.byStatus ?? []).map((s) => [s._id, s.count]),
    );
    const userTotal = (usr?.byStatus ?? []).reduce((s, d) => s + d.count, 0);

    // Products
    const prod = productAgg[0];

    const result = {
      revenue: {
        today: todayRev,
        thisMonth,
        lastMonth,
        growthPercent,
        growthDirection: thisMonth >= lastMonth ? 'up' : 'down',
      },
      orders: {
        total: orderTotal,
        today: ord?.todayCount[0]?.count ?? 0,
        pending: statusMap.get(OrderStatus.PENDING) ?? 0,
        confirmed: statusMap.get(OrderStatus.CONFIRMED) ?? 0,
        packing: statusMap.get(OrderStatus.PREPARING) ?? 0,
        shipping: statusMap.get(OrderStatus.SHIPPING) ?? 0,
        delivered: statusMap.get(OrderStatus.DELIVERED) ?? 0,
        cancelled: statusMap.get(OrderStatus.CANCELLED) ?? 0,
        returned: statusMap.get(OrderStatus.RETURNED) ?? 0,
      },
      users: {
        total: userTotal,
        active: userStatusMap.get(UserStatus.ACTIVE) ?? 0,
        locked: userStatusMap.get(UserStatus.LOCKED) ?? 0,
        newThisMonth: usr?.newThisMonth[0]?.count ?? 0,
        newLastMonth: usr?.newLastMonth[0]?.count ?? 0,
      },
      products: {
        total: prod?.total[0]?.count ?? 0,
        active: prod?.active[0]?.count ?? 0,
        outOfStock: prod?.outOfStock[0]?.count ?? 0,
        flashSale: prod?.flashSale[0]?.count ?? 0,
        featured: prod?.featured[0]?.count ?? 0,
      },
    };

    await this.cacheManager.set(CacheKeys.DASHBOARD_STATS, result, STATS_TTL);
    return result;
  }

  async getRevenueByDay(queryDto: QueryRevenueDto): Promise<unknown> {
    const year = queryDto.year ?? new Date().getFullYear();
    const month = queryDto.month ?? new Date().getMonth() + 1;

    const cacheKey = CacheKeys.DASHBOARD_REVENUE_DAY(year, month);
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    const daysInMonth = new Date(year, month, 0).getDate();

    const rawData = await this.orderModel.aggregate<RevenueGroupDoc>([
      {
        $match: {
          status: OrderStatus.DELIVERED,
          createdAt: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: { $dayOfMonth: '$createdAt' },
          revenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const dataMap = new Map(rawData.map((r) => [r._id, r]));
    const data = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const found = dataMap.get(day);
      return {
        label: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`,
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        revenue: found?.revenue ?? 0,
        orderCount: found?.orderCount ?? 0,
      };
    });

    const total = {
      revenue: data.reduce((s, d) => s + d.revenue, 0),
      orderCount: data.reduce((s, d) => s + d.orderCount, 0),
    };

    const result = { period: 'day', year, month, data, total };
    await this.cacheManager.set(cacheKey, result, REVENUE_DAY_TTL);
    return result;
  }

  async getRevenueByMonth(queryDto: QueryRevenueDto): Promise<unknown> {
    const year = queryDto.year ?? new Date().getFullYear();

    const cacheKey = CacheKeys.DASHBOARD_REVENUE_MONTH(year);
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const rawData = await this.orderModel.aggregate<RevenueGroupDoc>([
      {
        $match: {
          status: OrderStatus.DELIVERED,
          createdAt: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          revenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const dataMap = new Map(rawData.map((r) => [r._id, r]));
    const data = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const found = dataMap.get(m);
      return {
        label: MONTH_LABELS[i] ?? `Th${m}`,
        date: `${year}-${String(m).padStart(2, '0')}`,
        revenue: found?.revenue ?? 0,
        orderCount: found?.orderCount ?? 0,
      };
    });

    const total = {
      revenue: data.reduce((s, d) => s + d.revenue, 0),
      orderCount: data.reduce((s, d) => s + d.orderCount, 0),
    };

    const result = { period: 'month', year, data, total };
    await this.cacheManager.set(cacheKey, result, REVENUE_MONTH_TTL);
    return result;
  }

  async getOrderStats(queryDto: QueryOrderStatsDto): Promise<unknown> {
    const now = new Date();
    const endDate = queryDto.endDate ? new Date(queryDto.endDate) : now;
    const startDate = queryDto.startDate
      ? new Date(queryDto.startDate)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    interface OrderStatDoc {
      _id: OrderStatus;
      count: number;
      revenue: number;
    }

    const rawData = await this.orderModel.aggregate<OrderStatDoc>([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [
                { $eq: ['$status', OrderStatus.DELIVERED] },
                '$totalAmount',
                0,
              ],
            },
          },
        },
      },
    ]);

    const totalOrders = rawData.reduce((s, d) => s + d.count, 0);
    const statusBreakdown = rawData
      .map((d) => ({
        status: d._id,
        count: d.count,
        revenue: d.revenue,
        percent:
          totalOrders > 0 ? Math.round((d.count / totalOrders) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const deliveredCount =
      rawData.find((d) => d._id === OrderStatus.DELIVERED)?.count ?? 0;
    const cancelledCount =
      rawData.find((d) => d._id === OrderStatus.CANCELLED)?.count ?? 0;
    const completionRate =
      totalOrders > 0
        ? Math.round((deliveredCount / totalOrders) * 1000) / 10
        : 0;
    const cancellationRate =
      totalOrders > 0
        ? Math.round((cancelledCount / totalOrders) * 1000) / 10
        : 0;

    return {
      period: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
      statusBreakdown,
      totalOrders,
      completionRate,
      cancellationRate,
    };
  }

  async getBestSellers(queryDto: QueryBestSellersDto): Promise<unknown> {
    const limit = queryDto.limit ?? 10;
    const period = queryDto.period ?? '30d';

    const cacheKey = CacheKeys.DASHBOARD_BEST_SELLERS(period);
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const periodDays = PERIOD_DAYS[period] ?? 30;
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const rawData = await this.orderItemModel.aggregate<BestSellerRaw>([
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: '$order' },
      {
        $match: {
          'order.status': OrderStatus.DELIVERED,
          'order.createdAt': { $gte: periodStart },
        },
      },
      {
        $group: {
          _id: '$productId',
          totalSold: { $sum: '$quantity' },
          revenue: { $sum: '$totalPrice' },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
    ]);

    const items = rawData.map((d, i) => ({
      rank: i + 1,
      productId: d._id.toString(),
      productName: d.product[0]?.name ?? '',
      thumbnailUrl: d.product[0]?.thumbnailUrl ?? '',
      totalSold: d.totalSold,
      revenue: d.revenue,
      averageRating: d.product[0]?.averageRating ?? 0,
      currentStock: d.product[0]?.stock ?? 0,
    }));

    const result = { period, items };
    await this.cacheManager.set(cacheKey, result, BEST_SELLERS_TTL);
    return result;
  }

  async getRecentUsers(queryDto: QueryRecentUsersDto): Promise<unknown> {
    const limit = queryDto.limit ?? 10;

    const rawData = await this.userModel.aggregate<RecentUserRaw>([
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'userId',
          as: 'orders',
        },
      },
      {
        $project: {
          fullName: 1,
          email: 1,
          avatar: 1,
          status: 1,
          createdAt: 1,
          orderCount: { $size: '$orders' },
        },
      },
    ]);

    return rawData.map((u) => ({
      id: u._id.toString(),
      fullName: u.fullName,
      email: u.email,
      avatar: u.avatar ?? null,
      status: u.status,
      orderCount: u.orderCount,
      createdAt: u.createdAt,
    }));
  }

  async getPendingReviews(queryDto: QueryPendingReviewsDto): Promise<unknown> {
    const limit = queryDto.limit ?? 10;

    const rawData = await this.reviewModel.aggregate<PendingReviewFacet>([
      { $match: { isApproved: false, isHidden: false } },
      {
        $facet: {
          total: [{ $count: 'count' }],
          items: [
            { $sort: { createdAt: -1 } },
            { $limit: limit },
            {
              $lookup: {
                from: 'products',
                localField: 'productId',
                foreignField: '_id',
                as: 'product',
              },
            },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user',
              },
            },
          ],
        },
      },
    ]);

    const facet = rawData[0];
    const pendingCount = facet?.total[0]?.count ?? 0;
    const items = (facet?.items ?? []).map((r) => ({
      id: r._id.toString(),
      product: r.product[0]
        ? {
            id: r.product[0]._id.toString(),
            name: r.product[0].name,
            thumbnailUrl: r.product[0].thumbnailUrl,
          }
        : null,
      user: r.user[0]
        ? {
            id: r.user[0]._id.toString(),
            fullName: r.user[0].fullName,
            email: r.user[0].email,
          }
        : null,
      rating: r.rating,
      content: r.content,
      images: r.images,
      createdAt: r.createdAt,
    }));

    return { pendingCount, items };
  }
}
