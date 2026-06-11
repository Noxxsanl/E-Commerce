import { Connection, Types } from 'mongoose';
import { CategorySchema } from '../../modules/categories/schemas/category.schema';

interface CategoryData {
  name: string;
  slug: string;
  description: string;
  image: string;
  order: number;
  isActive: boolean;
  parentId?: Types.ObjectId | null;
}

const rootCategories: CategoryData[] = [
  {
    name: 'Thời Trang',
    slug: 'thoi-trang',
    description: 'Quần áo, giày dép, phụ kiện thời trang',
    image: 'https://placehold.co/400x400?text=Thoi+Trang',
    order: 1,
    isActive: true,
    parentId: null,
  },
  {
    name: 'Điện Tử',
    slug: 'dien-tu',
    description: 'Điện thoại, máy tính, thiết bị điện tử',
    image: 'https://placehold.co/400x400?text=Dien+Tu',
    order: 2,
    isActive: true,
    parentId: null,
  },
  {
    name: 'Gia Dụng',
    slug: 'gia-dung',
    description: 'Đồ dùng gia đình, nhà bếp',
    image: 'https://placehold.co/400x400?text=Gia+Dung',
    order: 3,
    isActive: true,
    parentId: null,
  },
  {
    name: 'Sách',
    slug: 'sach',
    description: 'Sách văn học, khoa học, kỹ năng sống',
    image: 'https://placehold.co/400x400?text=Sach',
    order: 4,
    isActive: true,
    parentId: null,
  },
  {
    name: 'Thể Thao',
    slug: 'the-thao',
    description: 'Dụng cụ thể thao, đồ thể thao',
    image: 'https://placehold.co/400x400?text=The+Thao',
    order: 5,
    isActive: true,
    parentId: null,
  },
];

const subCategoriesMap: Record<string, CategoryData[]> = {
  'thoi-trang': [
    {
      name: 'Áo Nam',
      slug: 'ao-nam',
      description: 'Áo sơ mi, áo thun nam',
      image: 'https://placehold.co/400x400?text=Ao+Nam',
      order: 1,
      isActive: true,
    },
    {
      name: 'Quần Nam',
      slug: 'quan-nam',
      description: 'Quần jeans, quần tây nam',
      image: 'https://placehold.co/400x400?text=Quan+Nam',
      order: 2,
      isActive: true,
    },
    {
      name: 'Áo Nữ',
      slug: 'ao-nu',
      description: 'Áo sơ mi, áo thun nữ',
      image: 'https://placehold.co/400x400?text=Ao+Nu',
      order: 3,
      isActive: true,
    },
    {
      name: 'Giày Dép',
      slug: 'giay-dep',
      description: 'Giày thể thao, dép sandal',
      image: 'https://placehold.co/400x400?text=Giay+Dep',
      order: 4,
      isActive: true,
    },
  ],
  'dien-tu': [
    {
      name: 'Điện Thoại',
      slug: 'dien-thoai',
      description: 'Smartphone các hãng',
      image: 'https://placehold.co/400x400?text=Dien+Thoai',
      order: 1,
      isActive: true,
    },
    {
      name: 'Laptop',
      slug: 'laptop',
      description: 'Laptop văn phòng, gaming',
      image: 'https://placehold.co/400x400?text=Laptop',
      order: 2,
      isActive: true,
    },
    {
      name: 'Tai Nghe',
      slug: 'tai-nghe',
      description: 'Tai nghe có dây, không dây',
      image: 'https://placehold.co/400x400?text=Tai+Nghe',
      order: 3,
      isActive: true,
    },
    {
      name: 'Phụ Kiện',
      slug: 'phu-kien-dien-tu',
      description: 'Ốp lưng, sạc, cáp',
      image: 'https://placehold.co/400x400?text=Phu+Kien',
      order: 4,
      isActive: true,
    },
  ],
  'gia-dung': [
    {
      name: 'Nhà Bếp',
      slug: 'nha-bep',
      description: 'Nồi, chảo, dụng cụ bếp',
      image: 'https://placehold.co/400x400?text=Nha+Bep',
      order: 1,
      isActive: true,
    },
    {
      name: 'Phòng Ngủ',
      slug: 'phong-ngu',
      description: 'Chăn ga gối, đèn',
      image: 'https://placehold.co/400x400?text=Phong+Ngu',
      order: 2,
      isActive: true,
    },
    {
      name: 'Vệ Sinh',
      slug: 've-sinh',
      description: 'Đồ vệ sinh nhà cửa',
      image: 'https://placehold.co/400x400?text=Ve+Sinh',
      order: 3,
      isActive: true,
    },
  ],
  sach: [
    {
      name: 'Văn Học',
      slug: 'van-hoc',
      description: 'Tiểu thuyết, truyện ngắn',
      image: 'https://placehold.co/400x400?text=Van+Hoc',
      order: 1,
      isActive: true,
    },
    {
      name: 'Kỹ Năng Sống',
      slug: 'ky-nang-song',
      description: 'Sách phát triển bản thân',
      image: 'https://placehold.co/400x400?text=Ky+Nang',
      order: 2,
      isActive: true,
    },
    {
      name: 'Khoa Học',
      slug: 'khoa-hoc',
      description: 'Sách khoa học tự nhiên',
      image: 'https://placehold.co/400x400?text=Khoa+Hoc',
      order: 3,
      isActive: true,
    },
    {
      name: 'Thiếu Nhi',
      slug: 'thieu-nhi',
      description: 'Sách dành cho trẻ em',
      image: 'https://placehold.co/400x400?text=Thieu+Nhi',
      order: 4,
      isActive: true,
    },
  ],
  'the-thao': [
    {
      name: 'Bóng Đá',
      slug: 'bong-da',
      description: 'Dụng cụ bóng đá',
      image: 'https://placehold.co/400x400?text=Bong+Da',
      order: 1,
      isActive: true,
    },
    {
      name: 'Gym & Fitness',
      slug: 'gym-fitness',
      description: 'Dụng cụ tập gym',
      image: 'https://placehold.co/400x400?text=Gym',
      order: 2,
      isActive: true,
    },
    {
      name: 'Bơi Lội',
      slug: 'boi-loi',
      description: 'Đồ bơi, phụ kiện bơi',
      image: 'https://placehold.co/400x400?text=Boi+Loi',
      order: 3,
      isActive: true,
    },
    {
      name: 'Cầu Lông',
      slug: 'cau-long',
      description: 'Vợt, cầu lông',
      image: 'https://placehold.co/400x400?text=Cau+Long',
      order: 4,
      isActive: true,
    },
  ],
};

export async function seedCategories(
  connection: Connection,
): Promise<Map<string, Types.ObjectId>> {
  const CategoryModel = connection.model('Category', CategorySchema);
  const slugToId = new Map<string, Types.ObjectId>();

  // Upsert root categories
  for (const cat of rootCategories) {
    const doc = await CategoryModel.findOneAndUpdate(
      { slug: cat.slug },
      { $setOnInsert: { ...cat, parentId: null } },
      { upsert: true, new: true },
    );
    slugToId.set(cat.slug, doc._id);
    console.log(`[Seed] Category upserted: ${cat.name}`);
  }

  // Upsert sub-categories
  for (const [parentSlug, subs] of Object.entries(subCategoriesMap)) {
    const parentId = slugToId.get(parentSlug);
    if (!parentId) continue;

    for (const sub of subs) {
      const doc = await CategoryModel.findOneAndUpdate(
        { slug: sub.slug },
        { $setOnInsert: { ...sub, parentId } },
        { upsert: true, new: true },
      );
      slugToId.set(sub.slug, doc._id);
      console.log(`[Seed] Sub-category upserted: ${sub.name}`);
    }
  }

  return slugToId;
}
