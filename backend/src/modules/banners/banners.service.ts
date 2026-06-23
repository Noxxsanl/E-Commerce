import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Cache } from '@nestjs/cache-manager';
import { BannersRepository } from './banners.repository';
import { BannerDocument, BannerType } from './schemas/banner.schema';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { ReorderBannersDto } from './dto/reorder-banners.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { CacheKeys } from '../../common/constants/cache-keys.constant';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

const BANNERS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class BannersService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly bannersRepository: BannersRepository,
  ) {}

  async getActiveBanners(type?: BannerType): Promise<BannerDocument[]> {
    const cacheKey = CacheKeys.BANNERS_ACTIVE;
    const cached = await this.cacheManager.get<BannerDocument[]>(cacheKey);
    if (cached) return type ? cached.filter((b) => b.type === type) : cached;

    const banners = await this.bannersRepository.findActive();
    await this.cacheManager.set(cacheKey, banners, BANNERS_CACHE_TTL_MS);
    return type ? banners.filter((b) => b.type === type) : banners;
  }

  // ==================== ADMIN METHODS ====================

  async findMany(
    queryDto: PaginationDto,
  ): Promise<PaginatedResultDto<BannerDocument>> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const { items, total } = await this.bannersRepository.findMany(
      {},
      { page, limit },
    );
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<BannerDocument> {
    const banner = await this.bannersRepository.findById(id);
    if (!banner) {
      throw new BusinessException(
        ErrorCodes.BANNER_NOT_FOUND,
        'Banner không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }
    return banner;
  }

  async create(dto: CreateBannerDto): Promise<BannerDocument> {
    const banner = await this.bannersRepository.create({
      ...dto,
      startAt: dto.startAt ? new Date(dto.startAt) : undefined,
      endAt: dto.endAt ? new Date(dto.endAt) : undefined,
    });
    await this.invalidateCache();
    return banner;
  }

  async update(id: string, dto: UpdateBannerDto): Promise<BannerDocument> {
    const updateData: Partial<BannerDocument> = {
      ...(dto as Partial<BannerDocument>),
      ...(dto.startAt ? { startAt: new Date(dto.startAt) } : {}),
      ...(dto.endAt ? { endAt: new Date(dto.endAt) } : {}),
    };
    const updated = await this.bannersRepository.update(id, updateData);
    if (!updated) {
      throw new BusinessException(
        ErrorCodes.BANNER_NOT_FOUND,
        'Banner không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.invalidateCache();
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.bannersRepository.delete(id);
    await this.invalidateCache();
  }

  async reorder(dto: ReorderBannersDto): Promise<void> {
    await this.bannersRepository.reorder(dto.orderedIds);
    await this.invalidateCache();
  }

  private async invalidateCache(): Promise<void> {
    await this.cacheManager.del(CacheKeys.BANNERS_ACTIVE).catch(() => void 0);
  }
}
