import { Connection, Types } from 'mongoose';
import { ProductSchema } from '../../modules/products/schemas/product.schema';
import { ProductVariantSchema } from '../../modules/products/schemas/product-variant.schema';

interface ProductSeedData {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  categorySlugs: string[];
  brand: string;
  price: number;
  discountPercent: number;
  stock: number;
  sku: string;
  images: string[];
  thumbnailUrl: string;
  tags: string[];
  isFeatured: boolean;
  isFlashSale?: boolean;
  flashSalePrice?: number;
  flashSaleStock?: number;
  flashSaleEndAt?: Date;
  variants?: {
    options: { name: string; value: string }[];
    price: number;
    stock: number;
    sku: string;
  }[];
}

const flashSaleEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

const productsData: ProductSeedData[] = [
  // Thời Trang - Áo Nam
  {
    name: 'Áo Thun Nam Basic Cổ Tròn',
    slug: 'ao-thun-nam-basic-co-tron',
    description:
      'Áo thun nam basic cổ tròn chất liệu cotton 100%, thoáng mát, thấm hút mồ hôi tốt.',
    shortDescription: 'Áo thun nam cotton 100%, nhiều màu sắc',
    categorySlugs: ['thoi-trang', 'ao-nam'],
    brand: 'LocalBrand VN',
    price: 180000,
    discountPercent: 10,
    stock: 200,
    sku: 'AT-NAM-001',
    images: [
      'https://placehold.co/800x800?text=Ao+Thun+Nam+1',
      'https://placehold.co/800x800?text=Ao+Thun+Nam+2',
    ],
    thumbnailUrl: 'https://placehold.co/400x400?text=Ao+Thun+Nam',
    tags: ['áo thun', 'nam', 'basic', 'cotton'],
    isFeatured: true,
    isFlashSale: true,
    flashSalePrice: 129000,
    flashSaleStock: 50,
    flashSaleEndAt: flashSaleEnd,
    variants: [
      {
        options: [
          { name: 'Màu', value: 'Trắng' },
          { name: 'Size', value: 'S' },
        ],
        price: 180000,
        stock: 30,
        sku: 'AT-NAM-001-W-S',
      },
      {
        options: [
          { name: 'Màu', value: 'Trắng' },
          { name: 'Size', value: 'M' },
        ],
        price: 180000,
        stock: 40,
        sku: 'AT-NAM-001-W-M',
      },
      {
        options: [
          { name: 'Màu', value: 'Đen' },
          { name: 'Size', value: 'S' },
        ],
        price: 180000,
        stock: 35,
        sku: 'AT-NAM-001-B-S',
      },
      {
        options: [
          { name: 'Màu', value: 'Đen' },
          { name: 'Size', value: 'M' },
        ],
        price: 180000,
        stock: 45,
        sku: 'AT-NAM-001-B-M',
      },
    ],
  },
  {
    name: 'Áo Sơ Mi Nam Dài Tay Kẻ Sọc',
    slug: 'ao-so-mi-nam-dai-tay-ke-soc',
    description:
      'Áo sơ mi nam dài tay kẻ sọc phong cách công sở, chất liệu vải mềm mại.',
    shortDescription: 'Áo sơ mi công sở nam, kẻ sọc thời trang',
    categorySlugs: ['thoi-trang', 'ao-nam'],
    brand: 'FashionVN',
    price: 350000,
    discountPercent: 15,
    stock: 100,
    sku: 'SM-NAM-001',
    images: ['https://placehold.co/800x800?text=So+Mi+Nam+1'],
    thumbnailUrl: 'https://placehold.co/400x400?text=So+Mi+Nam',
    tags: ['sơ mi', 'nam', 'công sở', 'dài tay'],
    isFeatured: true,
  },
  {
    name: 'Quần Jeans Nam Slim Fit',
    slug: 'quan-jeans-nam-slim-fit',
    description:
      'Quần jeans nam dáng slim fit, chất vải denim cao cấp, bền đẹp.',
    shortDescription: 'Quần jeans slim fit thời trang',
    categorySlugs: ['thoi-trang', 'quan-nam'],
    brand: 'DenimCo',
    price: 450000,
    discountPercent: 0,
    stock: 80,
    sku: 'QJ-NAM-001',
    images: ['https://placehold.co/800x800?text=Jean+Nam+1'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Jean+Nam',
    tags: ['quần jeans', 'nam', 'slim fit', 'denim'],
    isFeatured: false,
  },
  {
    name: 'Áo Thun Nữ Crop Top',
    slug: 'ao-thun-nu-crop-top',
    description:
      'Áo thun nữ crop top thời trang, phong cách trẻ trung, năng động.',
    shortDescription: 'Áo crop top nữ nhiều màu sắc',
    categorySlugs: ['thoi-trang', 'ao-nu'],
    brand: 'GirlStyle',
    price: 150000,
    discountPercent: 20,
    stock: 150,
    sku: 'AT-NU-001',
    images: ['https://placehold.co/800x800?text=Crop+Top+Nu'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Crop+Top',
    tags: ['áo thun', 'nữ', 'crop top', 'thời trang'],
    isFeatured: true,
    isFlashSale: true,
    flashSalePrice: 99000,
    flashSaleStock: 30,
    flashSaleEndAt: flashSaleEnd,
  },
  {
    name: 'Giày Thể Thao Nam Runner',
    slug: 'giay-the-thao-nam-runner',
    description:
      'Giày thể thao nam dành cho chạy bộ, đế cao su chống trượt, thoáng khí.',
    shortDescription: 'Giày chạy bộ nam, thoáng khí nhẹ nhàng',
    categorySlugs: ['thoi-trang', 'giay-dep'],
    brand: 'SportX',
    price: 650000,
    discountPercent: 10,
    stock: 60,
    sku: 'GT-NAM-001',
    images: ['https://placehold.co/800x800?text=Giay+Nam'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Giay+Nam',
    tags: ['giày', 'thể thao', 'nam', 'chạy bộ'],
    isFeatured: true,
  },
  // Điện Tử
  {
    name: 'Điện Thoại SmartPhone Pro X',
    slug: 'dien-thoai-smartphone-pro-x',
    description:
      'Điện thoại thông minh màn hình AMOLED 6.5 inch, camera 108MP, pin 5000mAh.',
    shortDescription: 'Smartphone flagship camera 108MP',
    categorySlugs: ['dien-tu', 'dien-thoai'],
    brand: 'TechBrand',
    price: 8990000,
    discountPercent: 5,
    stock: 50,
    sku: 'DT-PRO-001',
    images: ['https://placehold.co/800x800?text=SmartPhone+Pro'],
    thumbnailUrl: 'https://placehold.co/400x400?text=SmartPhone',
    tags: ['điện thoại', 'smartphone', 'flagship', 'camera'],
    isFeatured: true,
    isFlashSale: true,
    flashSalePrice: 7490000,
    flashSaleStock: 10,
    flashSaleEndAt: flashSaleEnd,
  },
  {
    name: 'Laptop Gaming UltraBook 15',
    slug: 'laptop-gaming-ultrabook-15',
    description:
      'Laptop gaming màn hình 15.6 inch 144Hz, GPU RTX 4060, RAM 16GB DDR5.',
    shortDescription: 'Laptop gaming hiệu năng cao RTX 4060',
    categorySlugs: ['dien-tu', 'laptop'],
    brand: 'TechBrand',
    price: 22990000,
    discountPercent: 8,
    stock: 20,
    sku: 'LP-GAME-001',
    images: ['https://placehold.co/800x800?text=Laptop+Gaming'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Laptop+Gaming',
    tags: ['laptop', 'gaming', 'rtx 4060', 'màn 144hz'],
    isFeatured: true,
  },
  {
    name: 'Tai Nghe Bluetooth Noise Cancelling',
    slug: 'tai-nghe-bluetooth-noise-cancelling',
    description:
      'Tai nghe bluetooth chống ồn chủ động ANC, pin 30 giờ, âm thanh Hi-Fi.',
    shortDescription: 'Tai nghe ANC bluetooth 30h pin',
    categorySlugs: ['dien-tu', 'tai-nghe'],
    brand: 'SoundPro',
    price: 1290000,
    discountPercent: 12,
    stock: 80,
    sku: 'TN-BT-001',
    images: ['https://placehold.co/800x800?text=Tai+Nghe+BT'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Tai+Nghe',
    tags: ['tai nghe', 'bluetooth', 'ANC', 'noise cancelling'],
    isFeatured: false,
  },
  {
    name: 'Ốp Lưng Silicon iPhone 15',
    slug: 'op-lung-silicon-iphone-15',
    description:
      'Ốp lưng silicon mềm cho iPhone 15, bảo vệ 4 góc, chống bám vân tay.',
    shortDescription: 'Ốp lưng silicon mềm iPhone 15',
    categorySlugs: ['dien-tu', 'phu-kien-dien-tu'],
    brand: 'CaseGuard',
    price: 89000,
    discountPercent: 0,
    stock: 300,
    sku: 'OL-IP15-001',
    images: ['https://placehold.co/800x800?text=Op+Lung+IP15'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Op+Lung',
    tags: ['ốp lưng', 'iphone 15', 'silicon', 'phụ kiện'],
    isFeatured: false,
  },
  // Gia Dụng
  {
    name: 'Nồi Cơm Điện Tử Smart 1.8L',
    slug: 'noi-com-dien-tu-smart-1-8l',
    description:
      'Nồi cơm điện tử thông minh 1.8L, có chế độ giữ ấm, nấu cháo, hấp.',
    shortDescription: 'Nồi cơm điện tử 1.8L đa chức năng',
    categorySlugs: ['gia-dung', 'nha-bep'],
    brand: 'HomeKing',
    price: 890000,
    discountPercent: 15,
    stock: 45,
    sku: 'NCD-18-001',
    images: ['https://placehold.co/800x800?text=Noi+Com'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Noi+Com',
    tags: ['nồi cơm', 'điện tử', 'gia dụng', 'nhà bếp'],
    isFeatured: false,
  },
  {
    name: 'Bộ Chăn Ga Gối Cotton King Size',
    slug: 'bo-chan-ga-goi-cotton-king-size',
    description:
      'Bộ chăn ga gối cotton 100% kích thước king size, mềm mại thoáng mát.',
    shortDescription: 'Bộ chăn ga cotton king size 4 món',
    categorySlugs: ['gia-dung', 'phong-ngu'],
    brand: 'SleepWell',
    price: 1290000,
    discountPercent: 20,
    stock: 30,
    sku: 'CGG-KS-001',
    images: ['https://placehold.co/800x800?text=Chan+Ga+Goi'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Chan+Ga',
    tags: ['chăn ga', 'gối', 'cotton', 'phòng ngủ'],
    isFeatured: true,
  },
  {
    name: 'Máy Hút Bụi Không Dây 25000Pa',
    slug: 'may-hut-bui-khong-day-25000pa',
    description:
      'Máy hút bụi không dây công suất 25000Pa, pin 60 phút, lọc HEPA.',
    shortDescription: 'Máy hút bụi không dây 25000Pa lọc HEPA',
    categorySlugs: ['gia-dung', 've-sinh'],
    brand: 'CleanPro',
    price: 1890000,
    discountPercent: 10,
    stock: 25,
    sku: 'MHB-KD-001',
    images: ['https://placehold.co/800x800?text=May+Hut+Bui'],
    thumbnailUrl: 'https://placehold.co/400x400?text=May+Hut+Bui',
    tags: ['máy hút bụi', 'không dây', 'HEPA', 'vệ sinh'],
    isFeatured: false,
  },
  // Sách
  {
    name: 'Đắc Nhân Tâm - Dale Carnegie',
    slug: 'dac-nhan-tam-dale-carnegie',
    description:
      'Cuốn sách kỹ năng giao tiếp và ảnh hưởng người khác bán chạy nhất mọi thời đại.',
    shortDescription: 'Bí quyết thành công trong giao tiếp',
    categorySlugs: ['sach', 'ky-nang-song'],
    brand: 'NXB Tổng Hợp',
    price: 89000,
    discountPercent: 0,
    stock: 500,
    sku: 'SACH-DNT-001',
    images: ['https://placehold.co/800x800?text=Dac+Nhan+Tam'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Dac+Nhan+Tam',
    tags: ['sách', 'kỹ năng', 'giao tiếp', 'bestseller'],
    isFeatured: true,
  },
  {
    name: 'Sapiens: Lược Sử Loài Người',
    slug: 'sapiens-luoc-su-loai-nguoi',
    description:
      'Tác phẩm khoa học vĩ đại của Yuval Noah Harari về lịch sử tiến hóa con người.',
    shortDescription: 'Lịch sử loài người từ thời nguyên thủy',
    categorySlugs: ['sach', 'khoa-hoc'],
    brand: 'NXB Thế Giới',
    price: 149000,
    discountPercent: 5,
    stock: 200,
    sku: 'SACH-SAP-001',
    images: ['https://placehold.co/800x800?text=Sapiens'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Sapiens',
    tags: ['sách', 'khoa học', 'lịch sử', 'bestseller'],
    isFeatured: false,
  },
  {
    name: 'Doraemon Tập 1 - Fujiko F. Fujio',
    slug: 'doraemon-tap-1',
    description: 'Truyện tranh Doraemon tập 1 - chú mèo máy đến từ tương lai.',
    shortDescription: 'Truyện tranh Doraemon - mèo máy tương lai',
    categorySlugs: ['sach', 'thieu-nhi'],
    brand: 'NXB Kim Đồng',
    price: 25000,
    discountPercent: 0,
    stock: 1000,
    sku: 'SACH-DRM-001',
    images: ['https://placehold.co/800x800?text=Doraemon'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Doraemon',
    tags: ['truyện tranh', 'thiếu nhi', 'doraemon', 'manga'],
    isFeatured: false,
  },
  // Thể Thao
  {
    name: 'Bóng Đá FIFA Pro Size 5',
    slug: 'bong-da-fifa-pro-size-5',
    description:
      'Bóng đá tiêu chuẩn FIFA size 5, chất liệu PU cao cấp, bền đẹp.',
    shortDescription: 'Bóng đá FIFA chuẩn thi đấu size 5',
    categorySlugs: ['the-thao', 'bong-da'],
    brand: 'SportKing',
    price: 350000,
    discountPercent: 0,
    stock: 100,
    sku: 'BD-FIFA-001',
    images: ['https://placehold.co/800x800?text=Bong+Da'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Bong+Da',
    tags: ['bóng đá', 'FIFA', 'size 5', 'thể thao'],
    isFeatured: false,
  },
  {
    name: 'Tạ Tay Điều Chỉnh 20KG',
    slug: 'ta-tay-dieu-chinh-20kg',
    description:
      'Tạ tay điều chỉnh được trọng lượng từ 2-20KG, tiết kiệm không gian.',
    shortDescription: 'Tạ tay điều chỉnh 2-20KG đa năng',
    categorySlugs: ['the-thao', 'gym-fitness'],
    brand: 'FitPro',
    price: 1290000,
    discountPercent: 10,
    stock: 40,
    sku: 'TA-DC-001',
    images: ['https://placehold.co/800x800?text=Ta+Tay'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Ta+Tay',
    tags: ['tạ tay', 'gym', 'fitness', 'điều chỉnh'],
    isFeatured: true,
  },
  {
    name: 'Kính Bơi Chống Tia UV Speedo',
    slug: 'kinh-boi-chong-tia-uv-speedo',
    description:
      'Kính bơi chống tia UV chuyên nghiệp, gioăng silicon, ôm mặt tốt.',
    shortDescription: 'Kính bơi UV Speedo chuyên nghiệp',
    categorySlugs: ['the-thao', 'boi-loi'],
    brand: 'AquaSport',
    price: 280000,
    discountPercent: 15,
    stock: 80,
    sku: 'KB-UV-001',
    images: ['https://placehold.co/800x800?text=Kinh+Boi'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Kinh+Boi',
    tags: ['kính bơi', 'UV', 'bơi lội', 'speedo'],
    isFeatured: false,
  },
  {
    name: 'Vợt Cầu Lông Carbon Pro 4U',
    slug: 'vot-cau-long-carbon-pro-4u',
    description:
      'Vợt cầu lông carbon 4U nhẹ, cán vợt chắc chắn, lý tưởng cho thi đấu.',
    shortDescription: 'Vợt cầu lông carbon Pro 4U thi đấu',
    categorySlugs: ['the-thao', 'cau-long'],
    brand: 'BadmintonPro',
    price: 890000,
    discountPercent: 5,
    stock: 60,
    sku: 'VCL-C4U-001',
    images: ['https://placehold.co/800x800?text=Vot+Cau+Long'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Vot+Cau+Long',
    tags: ['vợt cầu lông', 'carbon', '4U', 'thi đấu'],
    isFeatured: false,
  },
  // More featured products
  {
    name: 'Đồng Hồ Thông Minh SmartWatch GT3',
    slug: 'dong-ho-thong-minh-smartwatch-gt3',
    description:
      'Smartwatch màn hình AMOLED 1.5 inch, đo SpO2, nhịp tim, GPS tích hợp.',
    shortDescription: 'Smartwatch GT3 GPS SpO2 pin 14 ngày',
    categorySlugs: ['dien-tu'],
    brand: 'TechWatch',
    price: 2490000,
    discountPercent: 20,
    stock: 35,
    sku: 'DH-SW-GT3',
    images: ['https://placehold.co/800x800?text=SmartWatch'],
    thumbnailUrl: 'https://placehold.co/400x400?text=SmartWatch',
    tags: ['smartwatch', 'đồng hồ thông minh', 'GPS', 'SpO2'],
    isFeatured: true,
    isFlashSale: true,
    flashSalePrice: 1790000,
    flashSaleStock: 15,
    flashSaleEndAt: flashSaleEnd,
  },
  {
    name: 'Bàn Phím Cơ Gaming RGB',
    slug: 'ban-phim-co-gaming-rgb',
    description:
      'Bàn phím cơ gaming switch đỏ, đèn RGB 16 triệu màu, chống nước IP54.',
    shortDescription: 'Bàn phím cơ gaming RGB switch đỏ',
    categorySlugs: ['dien-tu', 'phu-kien-dien-tu'],
    brand: 'GameGear',
    price: 890000,
    discountPercent: 10,
    stock: 55,
    sku: 'BP-CO-RGB',
    images: ['https://placehold.co/800x800?text=Ban+Phim+Co'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Ban+Phim',
    tags: ['bàn phím', 'cơ', 'gaming', 'RGB'],
    isFeatured: true,
  },
  {
    name: 'Chuột Không Dây Gaming Pro',
    slug: 'chuot-khong-day-gaming-pro',
    description:
      'Chuột gaming không dây, DPI 25600, 6 nút lập trình, pin 70 giờ.',
    shortDescription: 'Chuột gaming không dây DPI 25600',
    categorySlugs: ['dien-tu', 'phu-kien-dien-tu'],
    brand: 'GameGear',
    price: 590000,
    discountPercent: 15,
    stock: 70,
    sku: 'CHT-KD-PRO',
    images: ['https://placehold.co/800x800?text=Chuot+Gaming'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Chuot+Gaming',
    tags: ['chuột', 'không dây', 'gaming', 'DPI'],
    isFeatured: false,
  },
  {
    name: 'Áo Hoodie Nam Oversized',
    slug: 'ao-hoodie-nam-oversized',
    description:
      'Áo hoodie nam dáng oversized, chất liệu nỉ bông dày, ấm áp mùa đông.',
    shortDescription: 'Hoodie nam oversized nỉ bông ấm',
    categorySlugs: ['thoi-trang', 'ao-nam'],
    brand: 'UrbanWear',
    price: 390000,
    discountPercent: 0,
    stock: 90,
    sku: 'HD-NAM-OVS',
    images: ['https://placehold.co/800x800?text=Hoodie+Nam'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Hoodie',
    tags: ['hoodie', 'nam', 'oversized', 'áo nỉ'],
    isFeatured: true,
  },
  {
    name: 'Túi Xách Nữ Da PU Thời Trang',
    slug: 'tui-xach-nu-da-pu-thoi-trang',
    description:
      'Túi xách nữ da PU cao cấp, nhiều ngăn tiện dụng, phong cách Hàn Quốc.',
    shortDescription: 'Túi xách nữ da PU phong cách Hàn Quốc',
    categorySlugs: ['thoi-trang'],
    brand: 'KStyle',
    price: 480000,
    discountPercent: 25,
    stock: 65,
    sku: 'TX-NU-DA-PU',
    images: ['https://placehold.co/800x800?text=Tui+Xach+Nu'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Tui+Xach',
    tags: ['túi xách', 'nữ', 'da PU', 'Hàn Quốc'],
    isFeatured: true,
  },
  {
    name: 'Bình Nước Thể Thao 1L Inox',
    slug: 'binh-nuoc-the-thao-1l-inox',
    description: 'Bình nước thể thao 1L inox 316, giữ nhiệt 24 giờ, không BPA.',
    shortDescription: 'Bình nước inox 316 giữ nhiệt 24h',
    categorySlugs: ['the-thao'],
    brand: 'AquaFit',
    price: 290000,
    discountPercent: 0,
    stock: 120,
    sku: 'BN-1L-INOX',
    images: ['https://placehold.co/800x800?text=Binh+Nuoc'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Binh+Nuoc',
    tags: ['bình nước', 'inox', 'thể thao', 'giữ nhiệt'],
    isFeatured: false,
  },
  {
    name: 'Máy Pha Cà Phê Espresso Mini',
    slug: 'may-pha-ca-phe-espresso-mini',
    description:
      'Máy pha cà phê espresso mini áp suất 15 bar, dung tích 1.2L, tự động ngắt.',
    shortDescription: 'Máy espresso mini 15 bar nhỏ gọn',
    categorySlugs: ['gia-dung', 'nha-bep'],
    brand: 'CoffeePro',
    price: 1490000,
    discountPercent: 18,
    stock: 20,
    sku: 'MCP-ESPR-MINI',
    images: ['https://placehold.co/800x800?text=May+Espresso'],
    thumbnailUrl: 'https://placehold.co/400x400?text=May+Espresso',
    tags: ['máy pha cà phê', 'espresso', 'gia dụng', 'nhà bếp'],
    isFeatured: true,
  },
  {
    name: 'Sách Atomic Habits - James Clear',
    slug: 'sach-atomic-habits-james-clear',
    description:
      'Thay đổi tí hon, hiệu quả bất ngờ - cuốn sách về xây dựng thói quen tốt.',
    shortDescription: 'Xây dựng thói quen tốt, phá bỏ thói quen xấu',
    categorySlugs: ['sach', 'ky-nang-song'],
    brand: 'NXB Lao Động',
    price: 115000,
    discountPercent: 10,
    stock: 300,
    sku: 'SACH-AH-001',
    images: ['https://placehold.co/800x800?text=Atomic+Habits'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Atomic+Habits',
    tags: ['sách', 'thói quen', 'kỹ năng', 'bestseller'],
    isFeatured: false,
  },
  {
    name: 'Quần Short Tập Gym Nam',
    slug: 'quan-short-tap-gym-nam',
    description:
      'Quần short tập gym nam, chất vải co giãn 4 chiều, thoáng mát.',
    shortDescription: 'Quần short gym nam co giãn 4 chiều',
    categorySlugs: ['the-thao', 'gym-fitness'],
    brand: 'FitWear',
    price: 220000,
    discountPercent: 0,
    stock: 130,
    sku: 'QS-GYM-NAM',
    images: ['https://placehold.co/800x800?text=Quan+Short+Gym'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Quan+Gym',
    tags: ['quần short', 'gym', 'nam', 'thể thao'],
    isFeatured: false,
  },
  {
    name: 'Kem Chống Nắng SPF50+ PA++++',
    slug: 'kem-chong-nang-spf50-pa',
    description:
      'Kem chống nắng SPF50+ PA++++, không nhờn rít, phù hợp da dầu và nhạy cảm.',
    shortDescription: 'Kem chống nắng SPF50+ cho mọi loại da',
    categorySlugs: ['gia-dung'],
    brand: 'SkinCare VN',
    price: 285000,
    discountPercent: 0,
    stock: 200,
    sku: 'KCN-SPF50',
    images: ['https://placehold.co/800x800?text=Kem+Chong+Nang'],
    thumbnailUrl: 'https://placehold.co/400x400?text=Kem+CN',
    tags: ['kem chống nắng', 'SPF50', 'skincare', 'chăm sóc da'],
    isFeatured: false,
  },
];

export async function seedProducts(
  connection: Connection,
  categorySlugToId: Map<string, Types.ObjectId>,
): Promise<void> {
  const ProductModel = connection.model('Product', ProductSchema);
  const ProductVariantModel = connection.model(
    'ProductVariant',
    ProductVariantSchema,
  );

  for (const productData of productsData) {
    const { categorySlugs, variants, ...rest } = productData;

    const categoryIds = categorySlugs
      .map((slug) => categorySlugToId.get(slug))
      .filter(Boolean) as Types.ObjectId[];

    const existing = await ProductModel.findOne({ slug: rest.slug });
    if (existing) {
      console.log(`[Seed] Product already exists: ${rest.name}`);
      continue;
    }

    const product = await ProductModel.create({
      ...rest,
      categories: categoryIds,
    });

    if (variants && variants.length > 0) {
      await ProductVariantModel.insertMany(
        variants.map((v) => ({ ...v, productId: product._id })),
      );
    }

    console.log(`[Seed] Created product: ${rest.name}`);
  }
}
