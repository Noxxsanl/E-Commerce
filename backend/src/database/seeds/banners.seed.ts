import { Connection } from 'mongoose';
import {
  BannerSchema,
  BannerType,
} from '../../modules/banners/schemas/banner.schema';

const bannersData = [
  {
    title: 'Flash Sale Cuối Tuần - Giảm Đến 70%',
    imageUrl: 'https://placehold.co/1920x600?text=Flash+Sale+70%25',
    mobileImageUrl: 'https://placehold.co/800x400?text=Flash+Sale+70%25',
    linkUrl: '/flash-sale',
    type: BannerType.FLASH_SALE,
    order: 1,
    isActive: true,
  },
  {
    title: 'Bộ Sưu Tập Hè 2025',
    imageUrl: 'https://placehold.co/1920x600?text=Summer+Collection+2025',
    mobileImageUrl: 'https://placehold.co/800x400?text=Summer+2025',
    linkUrl: '/collections/he-2025',
    type: BannerType.HERO,
    order: 1,
    isActive: true,
  },
  {
    title: 'Công Nghệ Mới - Trải Nghiệm Tốt Hơn',
    imageUrl: 'https://placehold.co/1920x600?text=New+Tech+2025',
    mobileImageUrl: 'https://placehold.co/800x400?text=New+Tech',
    linkUrl: '/categories/dien-tu',
    type: BannerType.HERO,
    order: 2,
    isActive: true,
  },
  {
    title: 'Thể Thao Mỗi Ngày - Khỏe Hơn Mỗi Ngày',
    imageUrl: 'https://placehold.co/1920x600?text=Sport+Every+Day',
    mobileImageUrl: 'https://placehold.co/800x400?text=Sport',
    linkUrl: '/categories/the-thao',
    type: BannerType.CATEGORY,
    order: 1,
    isActive: true,
  },
  {
    title: 'Flash Sale Điện Tử - Hôm Nay Thôi!',
    imageUrl: 'https://placehold.co/1920x600?text=Flash+Sale+Electronics',
    mobileImageUrl: 'https://placehold.co/800x400?text=Flash+Electronics',
    linkUrl: '/flash-sale?category=dien-tu',
    type: BannerType.FLASH_SALE,
    order: 2,
    isActive: true,
  },
];

export async function seedBanners(connection: Connection): Promise<void> {
  const BannerModel = connection.model('Banner', BannerSchema);

  for (const bannerData of bannersData) {
    const existing = await BannerModel.findOne({ title: bannerData.title });
    if (existing) {
      console.log(`[Seed] Banner already exists: ${bannerData.title}`);
      continue;
    }

    await BannerModel.create(bannerData);
    console.log(`[Seed] Created banner: ${bannerData.title}`);
  }
}
