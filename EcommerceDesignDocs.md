# Tài Liệu Thiết Kế Kỹ Thuật — Hệ Thống E-Commerce

> **Phiên bản:** 1.0.0  
> **Cập nhật:** 2025  
> **Tác giả:** Tech Lead Fullstack  
> **Trạng thái:** Production Design Document

---

## Mục Lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Phân tích nghiệp vụ](#2-phân-tích-nghiệp-vụ)
3. [Tech Stack](#3-tech-stack)
4. [Phân quyền hệ thống](#4-phân-quyền-hệ-thống)
5. [Database Design](#5-database-design)
6. [MongoDB Schemas](#6-mongodb-schemas)
7. [Backend — Folder Structure](#7-backend--folder-structure)
8. [REST API Endpoints](#8-rest-api-endpoints)
9. [Frontend — Folder Structure](#9-frontend--folder-structure)
10. [UI/UX Sitemap](#10-uiux-sitemap)
11. [Socket.IO Events](#11-socketio-events)
12. [BullMQ Jobs](#12-bullmq-jobs)
13. [Caching Strategy](#13-caching-strategy)
14. [Security Best Practices](#14-security-best-practices)
15. [Testing Strategy](#15-testing-strategy)
16. [Docker Configuration](#16-docker-configuration)
17. [CI/CD Pipeline](#17-cicd-pipeline)
18. [Environment Variables](#18-environment-variables)
19. [Coding Standards](#19-coding-standards)
20. [Sprint Roadmap](#20-sprint-roadmap)

---

## 1. Tổng Quan Dự Án

### 1.1 Mô tả

Hệ thống thương mại điện tử (E-Commerce) hiện đại, lấy cảm hứng từ giao diện và UX của Shopee, tập trung vào chức năng mua bán hàng hóa. Được thiết kế theo chuẩn Enterprise với kiến trúc Clean Architecture và Feature-Based Architecture.

### 1.2 Phạm vi

**Bao gồm:**
- Mua bán hàng hóa (B2C)
- Quản lý đơn hàng COD
- Hệ thống đánh giá sản phẩm
- Flash Sale
- Mã giảm giá (Coupon)
- Thông báo realtime

**Không bao gồm (Phase 1):**
- Ví điện tử / thanh toán online
- Livestream / video streaming
- Game / minigame
- Affiliate marketing
- Chat seller / social features
- Multi-vendor (Seller role)

### 1.3 Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────┐
│                     Client Layer                         │
│        Next.js 15 App Router · SSR/SSG/ISR              │
└─────────────────────┬───────────────────────────────────┘
                       │ HTTPS
┌─────────────────────▼───────────────────────────────────┐
│                  Edge / CDN / Gateway                    │
│     Nginx · Rate Limiting · SSL · Helmet · CORS         │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
┌──────────▼──────┐      ┌────────────▼────────────────┐
│  Auth Service   │      │       NestJS App             │
│  JWT · Passport │◄────►│   REST API · Swagger         │
│  Guards · RBAC  │      │   WebSocket · BullMQ         │
└─────────────────┘      └────────┬───────────┬─────────┘
                                   │           │
                    ┌──────────────▼─┐  ┌──────▼──────────┐
                    │  MongoDB Atlas  │  │     Redis        │
                    │  Mongoose      │  │  Cache · Queue   │
                    └────────────────┘  └──────────────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │     Cloudinary       │
                                    │  Images · Videos     │
                                    └─────────────────────┘
```

---

## 2. Phân Tích Nghiệp Vụ

### 2.1 Use Cases — Guest

| UC | Mô tả | Điều kiện |
|----|-------|-----------|
| UC-G01 | Xem danh sách sản phẩm | Không cần đăng nhập |
| UC-G02 | Tìm kiếm sản phẩm | Không cần đăng nhập |
| UC-G03 | Xem chi tiết sản phẩm | Không cần đăng nhập |
| UC-G04 | Xem danh mục | Không cần đăng nhập |
| UC-G05 | Xem đánh giá sản phẩm | Không cần đăng nhập |
| UC-G06 | Đăng ký tài khoản | — |
| UC-G07 | Đăng nhập | Có tài khoản |

### 2.2 Use Cases — User

| UC | Mô tả | Điều kiện |
|----|-------|-----------|
| UC-U01 | Quản lý hồ sơ cá nhân | Đã đăng nhập |
| UC-U02 | Quản lý địa chỉ nhận hàng | Đã đăng nhập |
| UC-U03 | Thêm/xóa sản phẩm vào Wishlist | Đã đăng nhập |
| UC-U04 | Quản lý giỏ hàng | Đã đăng nhập |
| UC-U05 | Đặt hàng COD | Có sản phẩm trong cart |
| UC-U06 | Áp dụng mã giảm giá | Khi checkout |
| UC-U07 | Theo dõi trạng thái đơn hàng | Đã đặt hàng |
| UC-U08 | Hủy đơn hàng | Status = PENDING |
| UC-U09 | Xác nhận đã nhận hàng | Status = SHIPPING |
| UC-U10 | Đánh giá sản phẩm | Đơn hàng = DELIVERED |
| UC-U11 | Đổi mật khẩu | Đã đăng nhập |
| UC-U12 | Quên mật khẩu | Có email đăng ký |

### 2.3 Use Cases — Admin

| UC | Mô tả |
|----|-------|
| UC-A01 | Xem Dashboard tổng quan |
| UC-A02 | CRUD sản phẩm |
| UC-A03 | CRUD danh mục |
| UC-A04 | Quản lý đơn hàng (view, update status) |
| UC-A05 | Quản lý người dùng (view, lock/unlock) |
| UC-A06 | Quản lý đánh giá (approve/hide/delete) |
| UC-A07 | CRUD coupon |
| UC-A08 | CRUD banner |
| UC-A09 | Xem thống kê doanh thu |
| UC-A10 | Export báo cáo |

### 2.4 Luồng nghiệp vụ chính

#### Luồng đặt hàng COD

```
User chọn sản phẩm
    → Thêm vào giỏ hàng
    → Xem giỏ hàng, áp coupon (tuỳ chọn)
    → Checkout: Chọn địa chỉ giao hàng
    → Xác nhận đơn hàng
    → Tạo Order (status: PENDING)
    → Gửi email xác nhận
    → Admin xác nhận (CONFIRMED)
    → Đóng gói (PACKING)
    → Giao hàng (SHIPPING)
    → User xác nhận nhận hàng (DELIVERED)
    → Mở khóa chức năng đánh giá
```

#### Luồng Flash Sale

```
Admin tạo Flash Sale (product, salePrice, stock, startAt, endAt)
    → BullMQ schedules start job
    → Đến giờ: cập nhật product.isFlashSale = true
    → Realtime broadcast: flash-sale:started event
    → User mua hàng: trừ flashSaleStock (atomic Redis)
    → Hết stock / hết giờ: broadcast flash-sale:ended
    → BullMQ schedules end job: reset isFlashSale = false
```

#### Luồng Coupon

```
User nhập code tại checkout
    → Validate: code tồn tại, còn hiệu lực, chưa hết usageLimit
    → Validate: user chưa dùng quá usagePerUser lần
    → Validate: subtotal >= minOrderAmount
    → Tính discount: PERCENT | FIXED_AMOUNT | FREE_SHIPPING
    → Cap discount nếu type = PERCENT và có maxDiscountAmount
    → Áp dụng, lưu couponCode vào order
    → Sau khi order confirmed: tăng coupon.usedCount
```

---

## 3. Tech Stack

### 3.1 Frontend

| Package | Version | Mục đích |
|---------|---------|----------|
| Next.js | 15.x (App Router) | Framework chính, SSR/SSG/ISR |
| React | 19.x | UI Library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Styling |
| Shadcn/UI | latest | UI Component Library |
| TanStack Query | 5.x | Server state, cache, mutations |
| Zustand | 4.x | Client state management |
| React Hook Form | 7.x | Form management |
| Zod | 3.x | Schema validation |
| Axios | 1.x | HTTP client |
| Recharts | 2.x | Charts cho Admin Dashboard |
| Socket.io-client | 4.x | Realtime |
| Swiper.js | 11.x | Banner carousel, product gallery |
| react-zoom-pan-pinch | 3.x | Product image zoom |
| date-fns | 3.x | Date formatting |
| nuqs | 2.x | URL state management (filters) |
| next-auth | 5.x (beta) | Auth session management |
| Sonner | 1.x | Toast notifications |

### 3.2 Backend

| Package | Version | Mục đích |
|---------|---------|----------|
| NestJS | 11.x | Framework chính |
| Node.js | 20.x LTS | Runtime |
| TypeScript | 5.x | Type safety |
| MongoDB Atlas | 7.x | Database chính |
| Mongoose | 8.x | ODM |
| Redis | 7.x | Cache + Message Queue |
| ioredis | 5.x | Redis client |
| BullMQ | 5.x | Job queues |
| Passport | 0.7.x | Auth strategies |
| passport-jwt | 4.x | JWT strategy |
| passport-local | 1.x | Local strategy |
| @nestjs/jwt | 10.x | JWT module |
| @nestjs/throttler | 5.x | Rate limiting |
| @nestjs/cache-manager | 2.x | Cache abstraction |
| @nestjs/swagger | 7.x | API documentation |
| @nestjs/config | 3.x | Config management |
| @nestjs-modules/mailer | 2.x | Email service |
| Socket.IO | 4.x | Realtime |
| Cloudinary | 2.x | Media storage |
| class-validator | 0.14.x | DTO validation |
| class-transformer | 0.5.x | Object transformation |
| bcrypt | 5.x | Password hashing |
| winston | 3.x | Structured logging |
| nest-winston | 1.x | NestJS winston integration |
| mongodb-memory-server | 9.x | Testing |
| Joi | 17.x | Env validation |

### 3.3 DevOps

| Tool | Mục đích |
|------|----------|
| Docker | Containerization |
| Docker Compose | Local dev orchestration |
| GitHub Actions | CI/CD pipeline |
| Nginx | Reverse proxy, SSL termination |
| MongoDB Atlas | Cloud database |
| Cloudinary | Cloud media storage |
| Redis Cloud / Upstash | Cloud Redis (production) |

---

## 4. Phân Quyền Hệ Thống

### 4.1 Roles

```typescript
export enum UserRole {
  SUPER_ADMIN = 'super_admin',  // Toàn quyền, manage admins
  ADMIN       = 'admin',        // Full feature access
  MODERATOR   = 'moderator',    // Reviews, orders (no delete products)
  USER        = 'user',         // Standard user
}
```

### 4.2 Permission Matrix

| Feature | Guest | User | Moderator | Admin | Super Admin |
|---------|-------|------|-----------|-------|-------------|
| Xem sản phẩm | ✅ | ✅ | ✅ | ✅ | ✅ |
| Đặt hàng | ❌ | ✅ | ❌ | ❌ | ❌ |
| Wishlist / Cart | ❌ | ✅ | ❌ | ❌ | ❌ |
| Đánh giá | ❌ | ✅ | ❌ | ❌ | ❌ |
| Quản lý reviews | ❌ | ❌ | ✅ | ✅ | ✅ |
| Quản lý orders | ❌ | ❌ | ✅ | ✅ | ✅ |
| CRUD Products | ❌ | ❌ | ❌ | ✅ | ✅ |
| CRUD Categories | ❌ | ❌ | ❌ | ✅ | ✅ |
| Quản lý users | ❌ | ❌ | ❌ | ✅ | ✅ |
| CRUD Coupons | ❌ | ❌ | ❌ | ✅ | ✅ |
| Dashboard | ❌ | ❌ | ❌ | ✅ | ✅ |
| Quản lý admins | ❌ | ❌ | ❌ | ❌ | ✅ |

### 4.3 RBAC Implementation

```typescript
// common/decorators/roles.decorator.ts
export const Roles = (...roles: UserRole[]) =>
  SetMetadata('roles', roles);

// common/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      'roles', [context.getHandler(), context.getClass()]
    );
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some(role =>
      [user.role].includes(role)
    );
  }
}

// Sử dụng trong controller
@Get('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
findAll() { ... }
```

---

## 5. Database Design

### 5.1 ERD Overview

```
Users ──────< RefreshTokens
Users ──────< OtpTokens
Users ──────< Addresses
Users ──────< Orders
Users ──────< Reviews
Users ──────< Wishlist
Users ──────< AuditLogs

Categories >──────< Products (many-to-many via product.categories[])
Products ──────< ProductVariants
Products ──────< Reviews
Products ──────< WishlistItems

Orders ──────< OrderItems
Orders >────── Coupons (optional)
Orders >────── Addresses

Banners (standalone)
Notifications >────── Users
```

### 5.2 Collections List

| Collection | Mô tả |
|------------|-------|
| users | Tài khoản người dùng |
| refresh_tokens | JWT refresh token storage |
| otp_tokens | OTP cho verify email, reset password |
| addresses | Địa chỉ nhận hàng |
| categories | Danh mục sản phẩm (nested) |
| products | Sản phẩm |
| product_variants | Biến thể sản phẩm (size, color, ...) |
| wishlist | Wishlist của user |
| orders | Đơn hàng |
| order_items | Chi tiết đơn hàng |
| reviews | Đánh giá sản phẩm |
| coupons | Mã giảm giá |
| coupon_usages | Lịch sử dùng coupon |
| banners | Banner trang chủ |
| notifications | Thông báo người dùng |
| audit_logs | Log hành động admin |
| product_views | Tracking view sản phẩm |

---

## 6. MongoDB Schemas

### 6.1 User Schema

```typescript
// modules/users/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN       = 'admin',
  MODERATOR   = 'moderator',
  USER        = 'user',
}

export enum UserStatus {
  ACTIVE   = 'active',
  INACTIVE = 'inactive',
  LOCKED   = 'locked',
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false }) // KHÔNG trả về trong query
  password: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop()
  avatar?: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Prop({ type: String, enum: UserStatus, default: UserStatus.INACTIVE })
  status: UserStatus;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  lockedAt?: Date;

  @Prop()
  lockedReason?: string;
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ createdAt: -1 });

// Ẩn password khi toJSON
UserSchema.set('toJSON', {
  transform: (_, ret) => {
    delete ret.password;
    return ret;
  },
});
```

### 6.2 RefreshToken Schema

```typescript
@Schema({ timestamps: true, collection: 'refresh_tokens' })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, select: false })
  tokenHash: string; // bcrypt hash của refresh token

  @Prop({ required: true })
  expiresAt: Date;

  @Prop()
  revokedAt?: Date;

  @Prop()
  deviceInfo?: string; // User-Agent

  @Prop()
  ipAddress?: string;

  // TTL index — tự xóa sau khi hết hạn
  // RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
```

### 6.3 OtpToken Schema

```typescript
export enum OtpType {
  VERIFY_EMAIL    = 'verify_email',
  RESET_PASSWORD  = 'reset_password',
}

@Schema({ timestamps: true, collection: 'otp_tokens' })
export class OtpToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  token: string; // 6-digit OTP hoặc UUID token

  @Prop({ type: String, enum: OtpType, required: true })
  type: OtpType;

  @Prop({ required: true })
  expiresAt: Date; // 15 phút cho OTP, 1 giờ cho reset link

  @Prop({ default: false })
  used: boolean;
}

// TTL index
OtpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

### 6.4 Address Schema

```typescript
@Schema({ _id: false })
export class AdminDivision {
  @Prop({ required: true })
  code: string; // Mã đơn vị hành chính (theo ĐVHCVN)

  @Prop({ required: true })
  name: string;
}

export enum AddressLabel {
  HOME   = 'home',
  OFFICE = 'office',
  OTHER  = 'other',
}

@Schema({ timestamps: true, collection: 'addresses' })
export class Address {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ type: AdminDivision, required: true })
  province: AdminDivision;

  @Prop({ type: AdminDivision, required: true })
  district: AdminDivision;

  @Prop({ type: AdminDivision, required: true })
  ward: AdminDivision;

  @Prop({ required: true })
  streetAddress: string; // Số nhà, tên đường

  @Prop({ default: false })
  isDefault: boolean;

  @Prop({ type: String, enum: AddressLabel, default: AddressLabel.HOME })
  label: AddressLabel;
}

AddressSchema.index({ userId: 1 });
AddressSchema.index({ userId: 1, isDefault: 1 });
```

### 6.5 Category Schema

```typescript
@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true })
  slug: string;

  @Prop()
  description?: string;

  @Prop()
  image?: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null })
  parentId: Types.ObjectId | null; // null = root category

  @Prop({ default: 0 })
  order: number; // Thứ tự hiển thị

  @Prop({ default: true })
  isActive: boolean;
}

CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ parentId: 1, isActive: 1 });
```

### 6.6 Product Schema

```typescript
@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true })
  slug: string;

  @Prop({ required: true })
  description: string; // HTML content

  @Prop()
  shortDescription?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Category' }] })
  categories: Types.ObjectId[];

  @Prop()
  brand?: string;

  @Prop({ required: true, min: 0 })
  price: number; // Giá gốc (VNĐ)

  @Prop({ default: 0, min: 0, max: 100 })
  discountPercent: number; // % giảm giá thường xuyên

  // Flash Sale fields
  @Prop({ default: false })
  isFlashSale: boolean;

  @Prop({ default: 0, min: 0 })
  flashSalePrice: number;

  @Prop({ default: 0, min: 0 })
  flashSaleStock: number;

  @Prop()
  flashSaleEndAt?: Date;

  // Media
  @Prop({ type: [String] })
  images: string[]; // Cloudinary URLs

  @Prop()
  video?: string; // Cloudinary video URL

  @Prop()
  thumbnailUrl?: string; // Ảnh đại diện (tự tạo từ images[0])

  // Inventory
  @Prop({ required: true, min: 0 })
  stock: number;

  @Prop({ unique: true, sparse: true })
  sku?: string;

  // Shipping
  @Prop({ default: 0 })
  weight: number; // gram

  @Prop({ type: Object })
  dimensions?: { length: number; width: number; height: number }; // cm

  // SEO & Search
  @Prop({ type: [String] })
  tags: string[];

  @Prop()
  metaTitle?: string;

  @Prop()
  metaDescription?: string;

  // Flags
  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isFeatured: boolean;

  // Cached stats (updated async via BullMQ)
  @Prop({ default: 0 })
  soldCount: number;

  @Prop({ default: 0 })
  viewCount: number;

  @Prop({ default: 0, min: 0, max: 5 })
  averageRating: number;

  @Prop({ default: 0 })
  reviewCount: number;

  // Virtual field: effectivePrice (tính trong service)
  // = isFlashSale ? flashSalePrice : price * (1 - discountPercent/100)
}

// Virtual getter cho giá hiệu dụng
ProductSchema.virtual('effectivePrice').get(function () {
  if (this.isFlashSale && this.flashSaleStock > 0) {
    return this.flashSalePrice;
  }
  return Math.round(this.price * (1 - this.discountPercent / 100));
});

// Indexes
ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ categories: 1, isActive: 1 });
ProductSchema.index({ isActive: 1, isFeatured: 1 });
ProductSchema.index({ isActive: 1, isFlashSale: 1 });
ProductSchema.index({ isActive: 1, soldCount: -1 }); // Best sellers
ProductSchema.index({ isActive: 1, createdAt: -1 }); // Newest
ProductSchema.index({ isActive: 1, averageRating: -1 }); // Top rated
ProductSchema.index({ tags: 1 });
// Full-text search index
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
```

### 6.7 ProductVariant Schema

```typescript
@Schema({ _id: false })
export class VariantOption {
  @Prop({ required: true })
  name: string; // Tên option: "Màu sắc", "Kích thước"

  @Prop({ required: true })
  value: string; // Giá trị: "Đỏ", "XL"
}

@Schema({ timestamps: true, collection: 'product_variants' })
export class ProductVariant {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ type: [VariantOption], required: true })
  options: VariantOption[]; // Kết hợp: [{ name: 'Màu', value: 'Đỏ' }, { name: 'Size', value: 'L' }]

  @Prop()
  sku?: string;

  @Prop({ required: true, min: 0 })
  price: number; // Override price nếu variant có giá khác

  @Prop({ default: 0, min: 0, max: 100 })
  discountPercent: number;

  @Prop({ required: true, min: 0 })
  stock: number;

  @Prop()
  image?: string; // Ảnh riêng của variant

  @Prop({ default: true })
  isActive: boolean;
}

ProductVariantSchema.index({ productId: 1 });
ProductVariantSchema.index({ productId: 1, isActive: 1 });
```

### 6.8 Order Schema

```typescript
export enum OrderStatus {
  PENDING    = 'pending',
  CONFIRMED  = 'confirmed',
  PACKING    = 'packing',
  SHIPPING   = 'shipping',
  DELIVERED  = 'delivered',
  CANCELLED  = 'cancelled',
  RETURNED   = 'returned',
}

export enum PaymentMethod {
  COD           = 'cod',
  BANK_TRANSFER = 'bank_transfer', // Phase 2
}

export enum PaymentStatus {
  PENDING  = 'pending',
  PAID     = 'paid',
  REFUNDED = 'refunded',
}

@Schema({ _id: false })
export class OrderStatusHistory {
  @Prop({ type: String, enum: OrderStatus, required: true })
  status: OrderStatus;

  @Prop({ required: true })
  updatedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId; // null = system

  @Prop()
  note?: string;
}

@Schema({ _id: false })
export class ShippingAddress {
  @Prop({ required: true }) fullName: string;
  @Prop({ required: true }) phone: string;
  @Prop({ required: true }) province: string;
  @Prop({ required: true }) district: string;
  @Prop({ required: true }) ward: string;
  @Prop({ required: true }) streetAddress: string;
}

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ required: true, unique: true })
  orderCode: string; // VD: ORD-20250615-00001

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'OrderItem' }] })
  items: Types.ObjectId[];

  @Prop({ type: ShippingAddress, required: true })
  shippingAddress: ShippingAddress;

  @Prop({ required: true, min: 0 })
  subtotal: number; // Tổng trước giảm giá

  @Prop({ default: 0, min: 0 })
  shippingFee: number;

  @Prop({ default: 0, min: 0 })
  discountAmount: number; // Số tiền được giảm từ coupon

  @Prop()
  couponCode?: string;

  @Prop({ required: true, min: 0 })
  totalAmount: number; // Tổng thanh toán = subtotal + shippingFee - discountAmount

  @Prop({ type: String, enum: PaymentMethod, default: PaymentMethod.COD })
  paymentMethod: PaymentMethod;

  @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Prop({ type: [OrderStatusHistory], default: [] })
  statusHistory: OrderStatusHistory[];

  @Prop()
  notes?: string; // Ghi chú của buyer

  @Prop()
  cancelReason?: string;

  @Prop()
  expectedDeliveryAt?: Date;

  @Prop()
  deliveredAt?: Date;
}

OrderSchema.index({ orderCode: 1 }, { unique: true });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ createdAt: -1 }); // Admin listing
```

### 6.9 OrderItem Schema

```typescript
@Schema({ timestamps: false, collection: 'order_items' })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ProductVariant' })
  variantId?: Types.ObjectId;

  // Snapshot tại thời điểm đặt hàng (tránh ảnh hưởng khi product thay đổi)
  @Prop({ required: true }) productName: string;
  @Prop({ required: true }) productImage: string;
  @Prop()                   variantOptions?: string; // "Màu: Đỏ, Size: L"
  @Prop({ required: true }) unitPrice: number;       // Giá tại thời điểm mua
  @Prop({ required: true }) quantity: number;
  @Prop({ required: true }) totalPrice: number;

  // Review tracking
  @Prop({ default: false })
  isReviewed: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Review' })
  reviewId?: Types.ObjectId;
}

OrderItemSchema.index({ orderId: 1 });
OrderItemSchema.index({ productId: 1 });
```

### 6.10 Review Schema

```typescript
@Schema({ timestamps: true, collection: 'reviews' })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'OrderItem', required: true })
  orderItemId: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ required: true, trim: true, minlength: 10, maxlength: 1000 })
  content: string;

  @Prop({ type: [String], default: [] })
  images: string[]; // Max 5 ảnh

  @Prop({ default: false })
  isApproved: boolean;

  @Prop({ default: false })
  isHidden: boolean;

  @Prop()
  adminNote?: string;

  @Prop({ default: 0 })
  helpfulCount: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  helpfulVoters: Types.ObjectId[];
}

// Unique: mỗi orderItem chỉ review 1 lần
ReviewSchema.index({ orderItemId: 1 }, { unique: true });
ReviewSchema.index({ productId: 1, isApproved: 1, isHidden: 1 });
ReviewSchema.index({ userId: 1 });
```

### 6.11 Coupon Schema

```typescript
export enum CouponType {
  PERCENT       = 'percent',
  FIXED_AMOUNT  = 'fixed_amount',
  FREE_SHIPPING = 'free_shipping',
}

@Schema({ timestamps: true, collection: 'coupons' })
export class Coupon {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string;

  @Prop()
  description?: string;

  @Prop({ type: String, enum: CouponType, required: true })
  type: CouponType;

  @Prop({ required: true, min: 0 })
  value: number; // % nếu PERCENT, VNĐ nếu FIXED_AMOUNT, 0 nếu FREE_SHIPPING

  @Prop({ default: 0, min: 0 })
  minOrderAmount: number; // Đơn hàng tối thiểu

  @Prop({ default: 0, min: 0 })
  maxDiscountAmount: number; // Giảm tối đa (dùng khi type = PERCENT)

  @Prop({ default: 0, min: 0 })
  usageLimit: number; // 0 = unlimited

  @Prop({ default: 1, min: 1 })
  usagePerUser: number; // Mỗi user dùng tối đa n lần

  @Prop({ default: 0 })
  usedCount: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Product' }], default: [] })
  applicableProducts: Types.ObjectId[]; // Rỗng = áp dụng tất cả

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Category' }], default: [] })
  applicableCategories: Types.ObjectId[];

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ default: true })
  isActive: boolean;
}

CouponSchema.index({ code: 1 }, { unique: true });
CouponSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
```

### 6.12 CouponUsage Schema

```typescript
@Schema({ timestamps: true, collection: 'coupon_usages' })
export class CouponUsage {
  @Prop({ type: Types.ObjectId, ref: 'Coupon', required: true })
  couponId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId: Types.ObjectId;

  @Prop({ required: true })
  discountAmount: number;
}

CouponUsageSchema.index({ couponId: 1, userId: 1 });
CouponUsageSchema.index({ orderId: 1 });
```

### 6.13 Banner Schema

```typescript
export enum BannerType {
  HERO       = 'hero',        // Banner chính trang chủ
  FLASH_SALE = 'flash_sale',  // Banner flash sale
  CATEGORY   = 'category',    // Banner danh mục
  PROMOTION  = 'promotion',   // Banner khuyến mãi
}

@Schema({ timestamps: true, collection: 'banners' })
export class Banner {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  imageUrl: string;

  @Prop()
  mobileImageUrl?: string; // Ảnh tối ưu cho mobile

  @Prop()
  linkUrl?: string; // URL khi click banner

  @Prop({ type: String, enum: BannerType, default: BannerType.HERO })
  type: BannerType;

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  startAt?: Date;

  @Prop()
  endAt?: Date;
}

BannerSchema.index({ type: 1, isActive: 1, order: 1 });
```

### 6.14 Notification Schema

```typescript
export enum NotificationType {
  ORDER_STATUS    = 'order_status',
  PROMOTION       = 'promotion',
  FLASH_SALE      = 'flash_sale',
  REVIEW_APPROVED = 'review_approved',
  SYSTEM          = 'system',
}

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: NotificationType, required: true })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop()
  link?: string; // Deep link đến trang liên quan

  @Prop({ type: Object })
  data?: Record<string, any>; // Metadata tuỳ loại thông báo

  @Prop({ default: false })
  isRead: boolean;
}

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
// TTL: tự xóa notification sau 90 ngày
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });
```

### 6.15 AuditLog Schema

```typescript
@Schema({ timestamps: false, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  action: string; // VD: 'product.create', 'order.status_update', 'user.lock'

  @Prop({ required: true })
  resource: string; // Collection name: 'products', 'orders', 'users'

  @Prop()
  resourceId?: string;

  @Prop({ type: Object })
  before?: Record<string, any>; // State trước khi thay đổi

  @Prop({ type: Object })
  after?: Record<string, any>; // State sau khi thay đổi

  @Prop()
  ipAddress?: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ resource: 1, resourceId: 1 });
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15552000 }); // 180 ngày
```

---

## 7. Backend — Folder Structure

```
backend/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   │
│   ├── common/
│   │   ├── constants/
│   │   │   ├── cache-keys.constant.ts
│   │   │   ├── queue.constant.ts
│   │   │   └── error-codes.constant.ts
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   ├── public.decorator.ts          # Skip JWT guard
│   │   │   └── api-paginated-response.decorator.ts
│   │   ├── dto/
│   │   │   ├── pagination.dto.ts
│   │   │   ├── response.dto.ts              # ApiResponse wrapper
│   │   │   └── object-id.dto.ts
│   │   ├── exceptions/
│   │   │   ├── business.exception.ts        # Custom business errors
│   │   │   └── not-found.exception.ts
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── interceptors/
│   │   │   ├── transform.interceptor.ts     # Wrap response
│   │   │   ├── logging.interceptor.ts
│   │   │   └── audit.interceptor.ts
│   │   ├── interfaces/
│   │   │   ├── paginated-result.interface.ts
│   │   │   └── current-user.interface.ts
│   │   ├── middlewares/
│   │   │   └── request-logger.middleware.ts
│   │   ├── pipes/
│   │   │   ├── parse-object-id.pipe.ts
│   │   │   └── trim.pipe.ts
│   │   └── utils/
│   │       ├── pagination.util.ts
│   │       ├── slug.util.ts
│   │       ├── order-code.util.ts           # Generate ORD-YYYYMMDD-XXXXX
│   │       └── crypto.util.ts
│   │
│   ├── config/
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── jwt.config.ts
│   │   ├── redis.config.ts
│   │   ├── cloudinary.config.ts
│   │   ├── mail.config.ts
│   │   └── config.validation.ts             # Joi env validation
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── register.dto.ts
│   │   │   │   ├── login.dto.ts
│   │   │   │   ├── forgot-password.dto.ts
│   │   │   │   ├── reset-password.dto.ts
│   │   │   │   └── refresh-token.dto.ts
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   ├── jwt-refresh.strategy.ts
│   │   │   │   └── local.strategy.ts
│   │   │   └── schemas/
│   │   │       ├── refresh-token.schema.ts
│   │   │       └── otp-token.schema.ts
│   │   │
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts          # /users/me, /users/me/password
│   │   │   ├── users.admin.controller.ts    # /admin/users
│   │   │   ├── users.service.ts
│   │   │   ├── users.repository.ts
│   │   │   ├── dto/
│   │   │   │   ├── update-profile.dto.ts
│   │   │   │   ├── change-password.dto.ts
│   │   │   │   └── query-users.dto.ts
│   │   │   └── schemas/
│   │   │       └── user.schema.ts
│   │   │
│   │   ├── categories/
│   │   │   ├── categories.module.ts
│   │   │   ├── categories.controller.ts
│   │   │   ├── categories.admin.controller.ts
│   │   │   ├── categories.service.ts
│   │   │   ├── categories.repository.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-category.dto.ts
│   │   │   │   └── update-category.dto.ts
│   │   │   └── schemas/
│   │   │       └── category.schema.ts
│   │   │
│   │   ├── products/
│   │   │   ├── products.module.ts
│   │   │   ├── products.controller.ts
│   │   │   ├── products.admin.controller.ts
│   │   │   ├── products.service.ts
│   │   │   ├── products.repository.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-product.dto.ts
│   │   │   │   ├── update-product.dto.ts
│   │   │   │   └── query-product.dto.ts
│   │   │   └── schemas/
│   │   │       ├── product.schema.ts
│   │   │       └── product-variant.schema.ts
│   │   │
│   │   ├── wishlist/
│   │   │   ├── wishlist.module.ts
│   │   │   ├── wishlist.controller.ts
│   │   │   ├── wishlist.service.ts
│   │   │   └── schemas/
│   │   │       └── wishlist.schema.ts
│   │   │
│   │   ├── cart/
│   │   │   ├── cart.module.ts
│   │   │   ├── cart.controller.ts
│   │   │   ├── cart.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── add-to-cart.dto.ts
│   │   │   │   └── update-cart-item.dto.ts
│   │   │   └── schemas/
│   │   │       └── cart.schema.ts           # Embedded CartItems
│   │   │
│   │   ├── orders/
│   │   │   ├── orders.module.ts
│   │   │   ├── orders.controller.ts
│   │   │   ├── orders.admin.controller.ts
│   │   │   ├── orders.service.ts
│   │   │   ├── orders.repository.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-order.dto.ts
│   │   │   │   ├── update-order-status.dto.ts
│   │   │   │   └── query-orders.dto.ts
│   │   │   └── schemas/
│   │   │       ├── order.schema.ts
│   │   │       └── order-item.schema.ts
│   │   │
│   │   ├── reviews/
│   │   │   ├── reviews.module.ts
│   │   │   ├── reviews.controller.ts
│   │   │   ├── reviews.admin.controller.ts
│   │   │   ├── reviews.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-review.dto.ts
│   │   │   │   └── query-reviews.dto.ts
│   │   │   └── schemas/
│   │   │       └── review.schema.ts
│   │   │
│   │   ├── coupons/
│   │   │   ├── coupons.module.ts
│   │   │   ├── coupons.controller.ts        # POST /coupons/validate
│   │   │   ├── coupons.admin.controller.ts
│   │   │   ├── coupons.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-coupon.dto.ts
│   │   │   │   ├── update-coupon.dto.ts
│   │   │   │   └── validate-coupon.dto.ts
│   │   │   └── schemas/
│   │   │       ├── coupon.schema.ts
│   │   │       └── coupon-usage.schema.ts
│   │   │
│   │   ├── addresses/
│   │   │   ├── addresses.module.ts
│   │   │   ├── addresses.controller.ts
│   │   │   ├── addresses.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-address.dto.ts
│   │   │   │   └── update-address.dto.ts
│   │   │   └── schemas/
│   │   │       └── address.schema.ts
│   │   │
│   │   ├── banners/
│   │   │   ├── banners.module.ts
│   │   │   ├── banners.controller.ts
│   │   │   ├── banners.admin.controller.ts
│   │   │   ├── banners.service.ts
│   │   │   └── schemas/
│   │   │       └── banner.schema.ts
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.controller.ts
│   │   │   ├── notifications.service.ts
│   │   │   ├── notifications.gateway.ts     # Socket.IO gateway
│   │   │   └── schemas/
│   │   │       └── notification.schema.ts
│   │   │
│   │   ├── upload/
│   │   │   ├── upload.module.ts
│   │   │   ├── upload.controller.ts
│   │   │   ├── upload.service.ts            # Cloudinary integration
│   │   │   └── dto/
│   │   │       └── upload-response.dto.ts
│   │   │
│   │   ├── email/
│   │   │   ├── email.module.ts
│   │   │   ├── email.service.ts
│   │   │   └── templates/
│   │   │       ├── verify-email.hbs
│   │   │       ├── reset-password.hbs
│   │   │       ├── order-confirmation.hbs
│   │   │       └── order-status-update.hbs
│   │   │
│   │   └── dashboard/
│   │       ├── dashboard.module.ts
│   │       ├── dashboard.controller.ts
│   │       ├── dashboard.service.ts
│   │       └── dto/
│   │           ├── stats.dto.ts
│   │           └── revenue-chart.dto.ts
│   │
│   └── database/
│       ├── database.module.ts
│       └── seeds/
│           ├── seed.ts
│           ├── users.seed.ts
│           ├── categories.seed.ts
│           └── products.seed.ts
│
├── test/
│   ├── setup.ts
│   ├── database.ts                          # mongodb-memory-server
│   ├── fixtures/
│   │   ├── users.fixture.ts
│   │   ├── products.fixture.ts
│   │   └── orders.fixture.ts
│   └── e2e/
│       ├── auth.e2e-spec.ts
│       ├── products.e2e-spec.ts
│       └── orders.e2e-spec.ts
│
├── Dockerfile
├── .env.example
├── nest-cli.json
├── tsconfig.json
└── package.json
```

---

## 8. REST API Endpoints

### 8.1 Auth

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/auth/register` | — | Đăng ký |
| POST | `/auth/login` | — | Đăng nhập |
| POST | `/auth/logout` | JWT | Đăng xuất |
| POST | `/auth/refresh` | Refresh Token | Làm mới access token |
| POST | `/auth/forgot-password` | — | Gửi email reset password |
| POST | `/auth/reset-password` | — | Đặt lại mật khẩu |
| POST | `/auth/verify-email` | — | Xác nhận email |
| GET  | `/auth/me` | JWT | Lấy thông tin user hiện tại |

### 8.2 Users (Profile)

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/users/me` | JWT | Lấy profile |
| PATCH  | `/users/me` | JWT | Cập nhật profile |
| PATCH  | `/users/me/password` | JWT | Đổi mật khẩu |
| PATCH  | `/users/me/avatar` | JWT | Cập nhật avatar |

### 8.3 Addresses

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/addresses` | JWT | Danh sách địa chỉ |
| POST   | `/addresses` | JWT | Thêm địa chỉ |
| PATCH  | `/addresses/:id` | JWT | Cập nhật địa chỉ |
| DELETE | `/addresses/:id` | JWT | Xóa địa chỉ |
| PATCH  | `/addresses/:id/default` | JWT | Đặt làm địa chỉ mặc định |

### 8.4 Categories

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/categories` | — | Danh sách danh mục (tree) |
| GET    | `/categories/:slug` | — | Chi tiết danh mục |

### 8.5 Products

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/products` | — | Danh sách (filter, sort, paginate) |
| GET    | `/products/flash-sale` | — | Sản phẩm flash sale |
| GET    | `/products/featured` | — | Sản phẩm nổi bật |
| GET    | `/products/best-sellers` | — | Bán chạy nhất |
| GET    | `/products/newest` | — | Mới nhất |
| GET    | `/products/:slug` | — | Chi tiết theo slug |
| GET    | `/products/:id/related` | — | Sản phẩm liên quan |
| POST   | `/products/:id/view` | — | Ghi nhận lượt xem |

**Query parameters cho GET /products:**

```
?page=1
&limit=20
&category=slug_or_id
&brand=Nike
&minPrice=100000
&maxPrice=500000
&minRating=4
&inStock=true
&search=áo thun
&sort=newest|best_selling|price_asc|price_desc|rating
```

### 8.6 Wishlist

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/wishlist` | JWT | Danh sách wishlist |
| POST   | `/wishlist/:productId` | JWT | Thêm vào wishlist |
| DELETE | `/wishlist/:productId` | JWT | Xóa khỏi wishlist |

### 8.7 Cart

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/cart` | JWT | Lấy giỏ hàng |
| POST   | `/cart` | JWT | Thêm vào giỏ |
| PATCH  | `/cart/:itemId` | JWT | Cập nhật số lượng |
| DELETE | `/cart/:itemId` | JWT | Xóa item |
| DELETE | `/cart` | JWT | Xóa toàn bộ giỏ |

### 8.8 Coupons

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST   | `/coupons/validate` | JWT | Kiểm tra và tính giảm giá |

### 8.9 Orders

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/orders` | JWT | Lịch sử đơn hàng |
| GET    | `/orders/:id` | JWT | Chi tiết đơn hàng |
| POST   | `/orders` | JWT | Tạo đơn hàng |
| POST   | `/orders/:id/cancel` | JWT | Hủy đơn (chỉ khi PENDING) |
| POST   | `/orders/:id/confirm-received` | JWT | Xác nhận nhận hàng |

### 8.10 Reviews

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/reviews/product/:productId` | — | Đánh giá theo sản phẩm |
| POST   | `/reviews` | JWT | Tạo đánh giá |
| POST   | `/reviews/:id/helpful` | JWT | Vote helpful |

### 8.11 Banners

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/banners` | — | Lấy banners active |

### 8.12 Notifications

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/notifications` | JWT | Danh sách thông báo |
| PATCH  | `/notifications/:id/read` | JWT | Đánh dấu đã đọc |
| PATCH  | `/notifications/read-all` | JWT | Đánh dấu tất cả đã đọc |

### 8.13 Upload

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST   | `/upload/image` | JWT | Upload ảnh |
| POST   | `/upload/images` | JWT | Upload nhiều ảnh |
| DELETE | `/upload` | JWT | Xóa file |

### 8.14 Admin — Users

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/admin/users` | ADMIN | Danh sách users |
| GET    | `/admin/users/:id` | ADMIN | Chi tiết user |
| PATCH  | `/admin/users/:id/lock` | ADMIN | Khóa tài khoản |
| PATCH  | `/admin/users/:id/unlock` | ADMIN | Mở khóa |
| PATCH  | `/admin/users/:id/role` | SUPER_ADMIN | Đổi role |

### 8.15 Admin — Products

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/admin/products` | ADMIN | Danh sách sản phẩm |
| GET    | `/admin/products/:id` | ADMIN | Chi tiết |
| POST   | `/admin/products` | ADMIN | Tạo sản phẩm |
| PATCH  | `/admin/products/:id` | ADMIN | Cập nhật |
| DELETE | `/admin/products/:id` | ADMIN | Xóa |
| POST   | `/admin/products/:id/variants` | ADMIN | Thêm variant |
| PATCH  | `/admin/products/:id/variants/:variantId` | ADMIN | Cập nhật variant |
| DELETE | `/admin/products/:id/variants/:variantId` | ADMIN | Xóa variant |

### 8.16 Admin — Categories

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/admin/categories` | ADMIN | Danh sách |
| POST   | `/admin/categories` | ADMIN | Tạo mới |
| PATCH  | `/admin/categories/:id` | ADMIN | Cập nhật |
| DELETE | `/admin/categories/:id` | ADMIN | Xóa |

### 8.17 Admin — Orders

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/admin/orders` | ADMIN | Danh sách (filter, search) |
| GET    | `/admin/orders/:id` | ADMIN | Chi tiết |
| PATCH  | `/admin/orders/:id/status` | ADMIN | Cập nhật trạng thái |
| PATCH  | `/admin/orders/bulk-status` | ADMIN | Bulk update |
| GET    | `/admin/orders/export` | ADMIN | Export CSV |

### 8.18 Admin — Reviews

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/admin/reviews` | MODERATOR | Danh sách |
| PATCH  | `/admin/reviews/:id/approve` | MODERATOR | Duyệt |
| PATCH  | `/admin/reviews/:id/hide` | MODERATOR | Ẩn |
| DELETE | `/admin/reviews/:id` | ADMIN | Xóa |

### 8.19 Admin — Coupons

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/admin/coupons` | ADMIN | Danh sách |
| POST   | `/admin/coupons` | ADMIN | Tạo mới |
| PATCH  | `/admin/coupons/:id` | ADMIN | Cập nhật |
| DELETE | `/admin/coupons/:id` | ADMIN | Xóa |

### 8.20 Admin — Banners

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/admin/banners` | ADMIN | Danh sách |
| POST   | `/admin/banners` | ADMIN | Tạo mới |
| PATCH  | `/admin/banners/:id` | ADMIN | Cập nhật |
| DELETE | `/admin/banners/:id` | ADMIN | Xóa |
| PATCH  | `/admin/banners/reorder` | ADMIN | Sắp xếp thứ tự |

### 8.21 Admin — Dashboard

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET    | `/admin/dashboard/stats` | ADMIN | Cards tổng quan |
| GET    | `/admin/dashboard/revenue` | ADMIN | Revenue chart (period=day\|month) |
| GET    | `/admin/dashboard/orders/stats` | ADMIN | Order status breakdown |
| GET    | `/admin/dashboard/products/best-sellers` | ADMIN | Top 10 sản phẩm |
| GET    | `/admin/dashboard/users/recent` | ADMIN | Users mới đăng ký |

### 8.22 Response Format chuẩn

```typescript
// Thành công
{
  "success": true,
  "data": { ... },
  "message": "Thành công"
}

// Thành công có pagination
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}

// Lỗi
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Sản phẩm không tồn tại",
    "details": null
  }
}

// Lỗi validation
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ",
    "details": [
      { "field": "email", "message": "Email không đúng định dạng" }
    ]
  }
}
```

---

## 9. Frontend — Folder Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx
│   │   │   └── reset-password/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (shop)/
│   │   │   ├── layout.tsx                   # Shop layout (Header, Footer)
│   │   │   ├── page.tsx                     # Home page
│   │   │   ├── search/
│   │   │   │   └── page.tsx
│   │   │   ├── categories/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx
│   │   │   ├── products/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx             # Product Detail (SSG/ISR)
│   │   │   └── flash-sale/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (account)/
│   │   │   ├── layout.tsx                   # Account layout (Sidebar nav)
│   │   │   ├── account/
│   │   │   │   └── page.tsx                 # Profile
│   │   │   ├── account/addresses/
│   │   │   │   └── page.tsx
│   │   │   ├── wishlist/
│   │   │   │   └── page.tsx
│   │   │   ├── cart/
│   │   │   │   └── page.tsx
│   │   │   ├── checkout/
│   │   │   │   └── page.tsx
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   └── notifications/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (admin)/
│   │   │   ├── layout.tsx                   # Admin layout (Sidebar, Topbar)
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx                 # Dashboard
│   │   │   │   ├── products/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── create/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── categories/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── orders/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── users/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── reviews/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── coupons/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── banners/
│   │   │   │       └── page.tsx
│   │   │
│   │   ├── api/                             # Next.js API Routes (proxy/auth)
│   │   │   └── auth/
│   │   │       └── [...nextauth]/
│   │   │           └── route.ts
│   │   │
│   │   ├── layout.tsx                       # Root layout
│   │   ├── not-found.tsx
│   │   ├── error.tsx
│   │   └── loading.tsx
│   │
│   ├── components/
│   │   ├── ui/                              # Shadcn components (auto-generated)
│   │   ├── common/
│   │   │   ├── Logo.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── Pagination.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   └── ImageUploader.tsx
│   │   ├── layout/
│   │   │   ├── Header/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── SearchBar.tsx
│   │   │   │   ├── CartIcon.tsx
│   │   │   │   ├── WishlistIcon.tsx
│   │   │   │   └── UserMenu.tsx
│   │   │   ├── Footer/
│   │   │   │   └── Footer.tsx
│   │   │   ├── AdminSidebar/
│   │   │   │   └── AdminSidebar.tsx
│   │   │   └── AccountSidebar/
│   │   │       └── AccountSidebar.tsx
│   │   └── seo/
│   │       ├── ProductJsonLd.tsx
│   │       └── BreadcrumbJsonLd.tsx
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   └── RegisterForm.tsx
│   │   │   └── hooks/
│   │   │       └── useAuth.ts
│   │   │
│   │   ├── home/
│   │   │   ├── components/
│   │   │   │   ├── BannerCarousel.tsx
│   │   │   │   ├── FlashSaleSection.tsx
│   │   │   │   ├── CategoryGrid.tsx
│   │   │   │   ├── ProductSection.tsx
│   │   │   │   └── FlashSaleCountdown.tsx
│   │   │   └── hooks/
│   │   │       └── useFlashSale.ts
│   │   │
│   │   ├── products/
│   │   │   ├── components/
│   │   │   │   ├── ProductCard.tsx
│   │   │   │   ├── ProductCardSkeleton.tsx
│   │   │   │   ├── ProductGrid.tsx
│   │   │   │   ├── ProductFilter.tsx
│   │   │   │   ├── ProductSort.tsx
│   │   │   │   ├── ProductGallery.tsx       # Swiper + zoom
│   │   │   │   ├── ProductInfo.tsx
│   │   │   │   ├── VariantSelector.tsx
│   │   │   │   ├── QuantityInput.tsx
│   │   │   │   └── ReviewList.tsx
│   │   │   └── hooks/
│   │   │       ├── useProducts.ts
│   │   │       └── useProductDetail.ts
│   │   │
│   │   ├── cart/
│   │   │   ├── components/
│   │   │   │   ├── CartItem.tsx
│   │   │   │   └── CartSummary.tsx
│   │   │   └── hooks/
│   │   │       └── useCart.ts
│   │   │
│   │   ├── checkout/
│   │   │   ├── components/
│   │   │   │   ├── CheckoutStepper.tsx
│   │   │   │   ├── AddressStep.tsx
│   │   │   │   ├── PaymentStep.tsx
│   │   │   │   ├── ConfirmStep.tsx
│   │   │   │   └── CouponInput.tsx
│   │   │   └── hooks/
│   │   │       └── useCheckout.ts
│   │   │
│   │   ├── orders/
│   │   │   ├── components/
│   │   │   │   ├── OrderList.tsx
│   │   │   │   ├── OrderCard.tsx
│   │   │   │   ├── OrderDetail.tsx
│   │   │   │   ├── OrderStatusBadge.tsx
│   │   │   │   └── OrderTimeline.tsx
│   │   │   └── hooks/
│   │   │       └── useOrders.ts
│   │   │
│   │   ├── wishlist/
│   │   │   └── hooks/
│   │   │       └── useWishlist.ts
│   │   │
│   │   ├── reviews/
│   │   │   ├── components/
│   │   │   │   ├── ReviewCard.tsx
│   │   │   │   ├── ReviewForm.tsx
│   │   │   │   └── RatingSummary.tsx
│   │   │   └── hooks/
│   │   │       └── useReviews.ts
│   │   │
│   │   └── admin/
│   │       ├── components/
│   │       │   ├── DashboardStats.tsx
│   │       │   ├── RevenueChart.tsx
│   │       │   ├── OrdersTable.tsx
│   │       │   ├── ProductsDataTable.tsx
│   │       │   ├── UsersDataTable.tsx
│   │       │   └── ReviewsDataTable.tsx
│   │       └── hooks/
│   │           ├── useDashboard.ts
│   │           └── useAdminProducts.ts
│   │
│   ├── services/
│   │   ├── api.ts                           # Axios instance + interceptors
│   │   ├── auth.service.ts
│   │   ├── products.service.ts
│   │   ├── categories.service.ts
│   │   ├── cart.service.ts
│   │   ├── orders.service.ts
│   │   ├── wishlist.service.ts
│   │   ├── reviews.service.ts
│   │   ├── coupons.service.ts
│   │   ├── upload.service.ts
│   │   ├── notifications.service.ts
│   │   └── admin/
│   │       ├── admin-products.service.ts
│   │       ├── admin-orders.service.ts
│   │       ├── admin-users.service.ts
│   │       ├── admin-reviews.service.ts
│   │       ├── admin-coupons.service.ts
│   │       ├── admin-banners.service.ts
│   │       └── admin-dashboard.service.ts
│   │
│   ├── hooks/
│   │   ├── useDebounce.ts
│   │   ├── useLocalStorage.ts
│   │   ├── useMediaQuery.ts
│   │   ├── useIntersectionObserver.ts       # Infinite scroll
│   │   ├── useSocket.ts
│   │   └── useNotifications.ts
│   │
│   ├── store/
│   │   ├── authStore.ts                     # Zustand: user session
│   │   ├── cartStore.ts                     # Zustand: cart (optimistic)
│   │   ├── wishlistStore.ts                 # Zustand: wishlist (optimistic)
│   │   └── uiStore.ts                       # Zustand: modals, drawers
│   │
│   ├── lib/
│   │   ├── auth.ts                          # next-auth config
│   │   ├── queryClient.ts                   # TanStack Query client
│   │   ├── axios.ts                         # Axios instance
│   │   └── socket.ts                        # Socket.io singleton
│   │
│   ├── types/
│   │   ├── api.types.ts                     # ApiResponse, PaginatedResult
│   │   ├── auth.types.ts
│   │   ├── product.types.ts
│   │   ├── order.types.ts
│   │   ├── cart.types.ts
│   │   ├── review.types.ts
│   │   ├── user.types.ts
│   │   └── admin.types.ts
│   │
│   ├── constants/
│   │   ├── routes.ts                        # Tất cả app routes
│   │   ├── query-keys.ts                    # TanStack Query keys
│   │   ├── order-status.ts
│   │   └── regex.ts
│   │
│   └── schemas/
│       ├── auth.schema.ts                   # Zod schemas
│       ├── product.schema.ts
│       ├── order.schema.ts
│       ├── review.schema.ts
│       └── address.schema.ts
│
├── public/
│   ├── images/
│   └── icons/
│
├── Dockerfile
├── next.config.ts
├── tailwind.config.ts
├── components.json                          # Shadcn config
├── .env.local.example
└── package.json
```

---

## 10. UI/UX Sitemap

### 10.1 User Routes

```
/ (Home)
├── /search?q=...
├── /flash-sale
├── /categories/:slug
├── /products/:slug
├── /auth/login
├── /auth/register
├── /auth/forgot-password
├── /auth/reset-password
├── /wishlist (protected)
├── /cart (protected)
├── /checkout (protected)
├── /checkout/success (protected)
├── /orders (protected)
│   └── /:id
├── /account (protected)
│   ├── /addresses
│   └── /notifications
├── /terms
└── /privacy
```

### 10.2 Admin Routes

```
/admin
├── /admin/dashboard
├── /admin/products
│   ├── /create
│   └── /:id
├── /admin/categories
├── /admin/orders
│   └── /:id
├── /admin/users
├── /admin/reviews
├── /admin/coupons
└── /admin/banners
```

---

## 11. Socket.IO Events

### 11.1 Connection & Auth

```typescript
// Client kết nối với auth token
const socket = io(SOCKET_URL, {
  auth: { token: accessToken }
});

// Server join user vào room
socket.on('connect', () => {
  socket.join(`user:${userId}`);
  if (isAdmin) socket.join('admin');
});
```

### 11.2 Server → Client Events

```typescript
// Cập nhật trạng thái đơn hàng
socket.to(`user:${userId}`).emit('order:status-updated', {
  orderId: string;
  status: OrderStatus;
  message: string;
  updatedAt: Date;
});

// Thông báo mới
socket.to(`user:${userId}`).emit('notification:new', {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  createdAt: Date;
});

// Flash Sale bắt đầu (broadcast)
io.emit('flash-sale:started', {
  productId: string;
  productName: string;
  salePrice: number;
  originalPrice: number;
  stock: number;
  endAt: Date;
});

// Cập nhật tồn kho Flash Sale (broadcast)
io.emit('flash-sale:stock-update', {
  productId: string;
  remainingStock: number;
});

// Flash Sale kết thúc
io.emit('flash-sale:ended', {
  productId: string;
});
```

### 11.3 Client → Server Events

```typescript
// Theo dõi đơn hàng cụ thể
socket.emit('order:subscribe', { orderId: string });
socket.emit('order:unsubscribe', { orderId: string });
```

---

## 12. BullMQ Jobs

### 12.1 Queue Definitions

```typescript
// constants/queue.constant.ts
export const QUEUES = {
  EMAIL:            'email',
  NOTIFICATION:     'notification',
  ORDER:            'order',
  IMAGE_PROCESSING: 'image-processing',
  FLASH_SALE:       'flash-sale',
  ANALYTICS:        'analytics',
} as const;
```

### 12.2 Email Queue

```typescript
// Jobs:
// - send-verify-email
// - send-reset-password
// - send-order-confirmation
// - send-order-status-update

interface SendEmailJob {
  to: string;
  subject: string;
  template: string; // 'verify-email' | 'reset-password' | ...
  context: Record<string, any>;
}
```

### 12.3 Notification Queue

```typescript
// Jobs:
// - create-notification (lưu DB + emit socket)
// - create-bulk-notifications (cho broadcast)

interface CreateNotificationJob {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  data?: Record<string, any>;
}
```

### 12.4 Order Queue

```typescript
// Jobs:
// - update-product-sold-count (sau khi order DELIVERED)
// - auto-cancel-pending-orders (scheduled, hàng ngày)

interface UpdateSoldCountJob {
  items: Array<{ productId: string; quantity: number }>;
}
```

### 12.5 Flash Sale Queue

```typescript
// Jobs:
// - start-flash-sale (scheduled)
// - end-flash-sale (scheduled)

interface FlashSaleJob {
  productId: string;
  salePrice?: number;
  flashSaleStock?: number;
}
```

### 12.6 Analytics Queue

```typescript
// Jobs:
// - record-product-view (async, không block request)
// - update-product-view-count (batch update)

interface RecordViewJob {
  productId: string;
  userId?: string;
  sessionId?: string;
}
```

---

## 13. Caching Strategy

### 13.1 Redis Cache Keys

```typescript
// constants/cache-keys.constant.ts
export const CACHE_KEYS = {
  // Products
  PRODUCT_DETAIL:   (slug: string) => `product:${slug}`,
  PRODUCT_LIST:     (query: string) => `products:list:${query}`,
  FLASH_SALE_LIST:  () => 'products:flash-sale',
  BEST_SELLERS:     () => 'products:best-sellers',
  FEATURED:         () => 'products:featured',

  // Categories
  CATEGORY_TREE:    () => 'categories:tree',
  CATEGORY_DETAIL:  (slug: string) => `category:${slug}`,

  // Banners
  BANNERS:          () => 'banners:active',

  // Flash Sale stock (atomic counter)
  FLASH_SALE_STOCK: (productId: string) => `flash-sale:stock:${productId}`,
} as const;
```

### 13.2 TTL Strategy

| Cache Key | TTL | Invalidate on |
|-----------|-----|---------------|
| Product detail | 10 phút | Product updated |
| Product list | 5 phút | Product created/updated/deleted |
| Flash sale list | 1 phút | Flash sale start/end |
| Best sellers | 30 phút | Order delivered |
| Category tree | 60 phút | Category CRUD |
| Banners | 30 phút | Banner CRUD |
| Flash sale stock | Không expire | Atomic decr; clear khi end |

### 13.3 Cache Invalidation Pattern

```typescript
// Sử dụng Cache Aside pattern
async findBySlug(slug: string): Promise<Product> {
  const cacheKey = CACHE_KEYS.PRODUCT_DETAIL(slug);

  // 1. Check cache
  const cached = await this.cacheManager.get<Product>(cacheKey);
  if (cached) return cached;

  // 2. Query DB
  const product = await this.productRepository.findBySlug(slug);
  if (!product) throw new NotFoundException();

  // 3. Set cache
  await this.cacheManager.set(cacheKey, product, 600); // 10 phút
  return product;
}

async update(id: string, dto: UpdateProductDto): Promise<Product> {
  const product = await this.productRepository.update(id, dto);

  // Invalidate related caches
  await this.cacheManager.del(CACHE_KEYS.PRODUCT_DETAIL(product.slug));
  await this.cacheManager.del(CACHE_KEYS.BEST_SELLERS());

  return product;
}
```

---

## 14. Security Best Practices

### 14.1 Authentication & Authorization

```typescript
// main.ts — Helmet, CORS, Throttler
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
      },
    },
  }));

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  // Global rate limiting
  // Cấu hình trong app.module.ts:
  // ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,         // Strip unknown properties
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global transform interceptor
  app.useGlobalInterceptors(new TransformInterceptor());
}
```

### 14.2 Password Security

```typescript
// Luôn hash password trước khi lưu
async hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12); // saltRounds = 12
}

// Không bao giờ trả về password trong response
// Sử dụng @Exclude() decorator hoặc .select('-password') trong query
```

### 14.3 JWT Refresh Token Rotation

```typescript
// Mỗi lần refresh: revoke token cũ, tạo token mới
async refreshTokens(userId: string, refreshToken: string) {
  // 1. Tìm token hash trong DB
  const tokenRecord = await this.refreshTokenModel.findOne({ userId });
  if (!tokenRecord || tokenRecord.revokedAt) {
    throw new UnauthorizedException('Token đã bị thu hồi');
  }

  // 2. Verify token hash
  const isValid = await bcrypt.compare(refreshToken, tokenRecord.tokenHash);
  if (!isValid) throw new UnauthorizedException();

  // 3. Revoke token cũ
  await this.refreshTokenModel.updateOne(
    { _id: tokenRecord._id },
    { revokedAt: new Date() }
  );

  // 4. Tạo cặp token mới
  return this.generateTokens(userId);
}
```

### 14.4 File Upload Security

```typescript
// upload.service.ts
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

async uploadImage(file: Express.Multer.File): Promise<string> {
  // 1. Validate MIME type (kiểm tra magic bytes, không chỉ extension)
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    throw new BadRequestException('Định dạng file không hợp lệ');
  }

  // 2. Validate file size
  if (file.size > MAX_IMAGE_SIZE) {
    throw new BadRequestException('File quá lớn. Tối đa 5MB');
  }

  // 3. Upload lên Cloudinary (xử lý tại cloud, không lưu local)
  return this.cloudinaryService.upload(file.buffer, {
    folder: 'products',
    transformation: [
      { width: 1200, height: 1200, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' }
    ],
  });
}
```

### 14.5 Input Sanitization

```typescript
// Sử dụng sanitize-html cho product description (HTML content)
import sanitizeHtml from 'sanitize-html';

const sanitizedDescription = sanitizeHtml(dto.description, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'table']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'width', 'height'],
  },
  // Chỉ cho phép ảnh từ Cloudinary
  allowedSchemesByTag: { img: ['https'] },
});
```

### 14.6 Sensitive Data Protection

```
Checklist:
☐ Password luôn được hash với bcrypt (rounds >= 12)
☐ JWT secrets dài tối thiểu 64 characters
☐ Refresh tokens lưu dạng hash trong DB
☐ OTP tokens có TTL và đánh dấu used
☐ API keys không bao giờ commit vào git
☐ .env.example không chứa giá trị thật
☐ MongoDB connection string không expose trong logs
☐ Response không bao giờ trả về: password, tokenHash
☐ Error messages không leak internal details trong production
```

---

## 15. Testing Strategy

### 15.1 Backend Testing

#### Unit Tests (Jest)

```typescript
// products.service.spec.ts
describe('ProductsService', () => {
  let service: ProductsService;
  let repository: jest.Mocked<ProductsRepository>;
  let cacheManager: jest.Mocked<Cache>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: ProductsRepository,
          useValue: createMockRepository(),
        },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ProductsService);
    repository = module.get(ProductsRepository);
  });

  describe('findBySlug', () => {
    it('should return cached product if exists', async () => {
      const mockProduct = buildProductFixture();
      cacheManager.get.mockResolvedValue(mockProduct);

      const result = await service.findBySlug('test-product');

      expect(result).toEqual(mockProduct);
      expect(repository.findBySlug).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when product not found', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.findBySlug.mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
```

#### Integration Tests (mongodb-memory-server)

```typescript
// test/database.ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

export async function setupTestDatabase() {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}

export async function teardownTestDatabase() {
  await mongoose.disconnect();
  await mongoServer.stop();
}

export async function clearDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
```

#### E2E Tests

```typescript
// test/e2e/auth.e2e-spec.ts
describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    applyGlobalPipes(app);
    await app.init();
  });

  describe('POST /auth/register', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Test User',
          email: 'test@example.com',
          password: 'Password123!',
        })
        .expect(201)
        .expect(res => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.email).toBe('test@example.com');
          expect(res.body.data).not.toHaveProperty('password');
        });
    });

    it('should return 409 for duplicate email', () => {
      // ...
    });
  });
});
```

### 15.2 Frontend Testing

#### Vitest + RTL

```typescript
// features/products/components/ProductCard.test.tsx
describe('ProductCard', () => {
  const mockProduct = buildProductFixture({
    name: 'Áo Thun Test',
    price: 299000,
    averageRating: 4.5,
  });

  it('renders product name and price correctly', () => {
    render(<ProductCard product={mockProduct} />);

    expect(screen.getByText('Áo Thun Test')).toBeInTheDocument();
    expect(screen.getByText('299.000₫')).toBeInTheDocument();
  });

  it('shows discount badge when discountPercent > 0', () => {
    const discountedProduct = buildProductFixture({ discountPercent: 20 });
    render(<ProductCard product={discountedProduct} />);

    expect(screen.getByText('-20%')).toBeInTheDocument();
  });

  it('calls onAddToCart when button clicked', async () => {
    const onAddToCart = vi.fn();
    render(<ProductCard product={mockProduct} onAddToCart={onAddToCart} />);

    await userEvent.click(screen.getByRole('button', { name: /thêm vào giỏ/i }));
    expect(onAddToCart).toHaveBeenCalledWith(mockProduct.id);
  });
});
```

#### Zustand Store Tests

```typescript
// store/cartStore.test.ts
describe('cartStore', () => {
  beforeEach(() => {
    useCartStore.getState().reset();
  });

  it('should add item to cart', () => {
    const { addItem, items } = useCartStore.getState();

    addItem({ productId: '123', quantity: 2, price: 100000 });

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().total).toBe(200000);
  });
});
```

#### Playwright E2E

```typescript
// e2e/checkout.spec.ts
test('user can complete checkout flow', async ({ page }) => {
  // Login
  await page.goto('/auth/login');
  await page.fill('[name=email]', 'user@test.com');
  await page.fill('[name=password]', 'Password123!');
  await page.click('[type=submit]');

  // Add to cart
  await page.goto('/products/ao-thun-test');
  await page.click('[data-testid=add-to-cart]');
  await expect(page.locator('[data-testid=cart-count]')).toHaveText('1');

  // Checkout
  await page.goto('/cart');
  await page.click('[data-testid=checkout-button]');

  // Select address
  await page.click('[data-testid=address-option]');
  await page.click('[data-testid=next-step]');

  // Select COD
  await page.click('[data-testid=payment-cod]');
  await page.click('[data-testid=next-step]');

  // Confirm
  await page.click('[data-testid=confirm-order]');

  await expect(page).toHaveURL(/\/checkout\/success/);
  await expect(page.locator('h1')).toContainText('Đặt hàng thành công');
});
```

### 15.3 Coverage Requirements

| Layer | Tool | Target |
|-------|------|--------|
| Backend Unit | Jest | ≥ 80% |
| Backend Integration | Jest + mongodb-memory-server | ≥ 70% |
| Backend E2E | Jest Supertest | Critical flows 100% |
| Frontend Unit | Vitest + RTL | ≥ 75% |
| Frontend E2E | Playwright | Critical user journeys |

---

## 16. Docker Configuration

### 16.1 Dockerfile — Backend

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

# Dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

USER nestjs

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "dist/main"]
```

### 16.2 Dockerfile — Frontend

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

# Dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL

RUN pnpm build

# Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', r => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "server.js"]
```

### 16.3 docker-compose.yml

```yaml
# docker-compose.yml
version: '3.9'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
        NEXT_PUBLIC_SOCKET_URL: ${NEXT_PUBLIC_SOCKET_URL}
    container_name: ecommerce-frontend
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: ecommerce-backend
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      PORT: 3001
      MONGODB_URI: ${MONGODB_URI}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_ACCESS_EXPIRES: ${JWT_ACCESS_EXPIRES}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      JWT_REFRESH_EXPIRES: ${JWT_REFRESH_EXPIRES}
      CLOUDINARY_CLOUD_NAME: ${CLOUDINARY_CLOUD_NAME}
      CLOUDINARY_API_KEY: ${CLOUDINARY_API_KEY}
      CLOUDINARY_API_SECRET: ${CLOUDINARY_API_SECRET}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      SMTP_FROM: ${SMTP_FROM}
      FRONTEND_URL: ${FRONTEND_URL}
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3001/health', r => r.statusCode === 200 ? process.exit(0) : process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  redis:
    image: redis:7-alpine
    container_name: ecommerce-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    container_name: ecommerce-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    networks:
      - app-network
    restart: unless-stopped

networks:
  app-network:
    driver: bridge

volumes:
  redis-data:
    driver: local
```

### 16.4 docker-compose.dev.yml

```yaml
# docker-compose.dev.yml — Local development
version: '3.9'

services:
  mongodb:
    image: mongo:7
    container_name: ecommerce-mongo-dev
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
      MONGO_INITDB_DATABASE: ecommerce
    volumes:
      - mongo-dev-data:/data/db
    networks:
      - dev-network

  redis:
    image: redis:7-alpine
    container_name: ecommerce-redis-dev
    ports:
      - "6379:6379"
    networks:
      - dev-network

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: ecommerce-redis-ui
    ports:
      - "8081:8081"
    environment:
      REDIS_HOSTS: local:redis:6379
    depends_on:
      - redis
    networks:
      - dev-network

  mongo-express:
    image: mongo-express:latest
    container_name: ecommerce-mongo-ui
    ports:
      - "8082:8081"
    environment:
      ME_CONFIG_MONGODB_ADMINUSERNAME: admin
      ME_CONFIG_MONGODB_ADMINPASSWORD: password
      ME_CONFIG_MONGODB_URL: mongodb://admin:password@mongodb:27017/
    depends_on:
      - mongodb
    networks:
      - dev-network

networks:
  dev-network:
    driver: bridge

volumes:
  mongo-dev-data:
```

---

## 17. CI/CD Pipeline

### 17.1 GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  REGISTRY: ghcr.io
  IMAGE_BACKEND: ${{ github.repository }}/backend
  IMAGE_FRONTEND: ${{ github.repository }}/frontend

jobs:
  # ─────────── Backend ───────────
  backend-ci:
    name: Backend CI
    runs-on: ubuntu-latest

    services:
      mongodb:
        image: mongo:7
        ports: ['27017:27017']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          cache-dependency-path: backend/pnpm-lock.yaml

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        working-directory: backend
        run: pnpm install --frozen-lockfile

      - name: Lint
        working-directory: backend
        run: pnpm lint

      - name: Type check
        working-directory: backend
        run: pnpm type-check

      - name: Unit & Integration Tests
        working-directory: backend
        env:
          MONGODB_URI: mongodb://localhost:27017/ecommerce_test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          JWT_ACCESS_SECRET: test_access_secret_64_chars_minimum_length_here_abc
          JWT_REFRESH_SECRET: test_refresh_secret_64_chars_minimum_length_here_abc
          JWT_ACCESS_EXPIRES: 15m
          JWT_REFRESH_EXPIRES: 7d
        run: pnpm test:cov

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          directory: backend/coverage
          flags: backend

      - name: Build
        working-directory: backend
        run: pnpm build

  # ─────────── Frontend ───────────
  frontend-ci:
    name: Frontend CI
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          cache-dependency-path: frontend/pnpm-lock.yaml

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        working-directory: frontend
        run: pnpm install --frozen-lockfile

      - name: Lint
        working-directory: frontend
        run: pnpm lint

      - name: Type check
        working-directory: frontend
        run: pnpm type-check

      - name: Unit Tests
        working-directory: frontend
        run: pnpm test:run --coverage

      - name: Build
        working-directory: frontend
        env:
          NEXT_PUBLIC_API_URL: http://localhost:3001
          NEXT_PUBLIC_SOCKET_URL: http://localhost:3001
        run: pnpm build

  # ─────────── Docker Build & Push ───────────
  docker-build:
    name: Docker Build & Push
    runs-on: ubuntu-latest
    needs: [backend-ci, frontend-ci]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata (backend)
        id: meta-backend
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_BACKEND }}
          tags: |
            type=sha
            type=raw,value=latest

      - name: Build & push backend
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: ${{ steps.meta-backend.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Extract metadata (frontend)
        id: meta-frontend
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_FRONTEND }}
          tags: |
            type=sha
            type=raw,value=latest

      - name: Build & push frontend
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: ${{ steps.meta-frontend.outputs.tags }}
          build-args: |
            NEXT_PUBLIC_API_URL=${{ secrets.NEXT_PUBLIC_API_URL }}
            NEXT_PUBLIC_SOCKET_URL=${{ secrets.NEXT_PUBLIC_SOCKET_URL }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ─────────── Deploy ───────────
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: docker-build
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /app/ecommerce
            docker compose pull
            docker compose up -d --no-deps --build
            docker system prune -f
```

### 17.2 Branch Strategy

```
main        → Production (protected, require PR + review)
develop     → Staging (auto-deploy to staging env)
feature/*   → Feature branches (merge into develop via PR)
hotfix/*    → Hotfixes (merge directly into main + develop)
```

---

## 18. Environment Variables

### 18.1 Backend (.env.example)

```env
# ─── App ───────────────────────────────────────
NODE_ENV=development
PORT=3001
APP_NAME=ECommerce API
FRONTEND_URL=http://localhost:3000

# ─── JWT ───────────────────────────────────────
# Tối thiểu 64 characters
JWT_ACCESS_SECRET=your_access_secret_minimum_64_characters_long_replace_this
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_SECRET=your_refresh_secret_minimum_64_characters_long_replace_this
JWT_REFRESH_EXPIRES=7d

# ─── Database ──────────────────────────────────
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/ecommerce

# ─── Redis ─────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# ─── Cloudinary ────────────────────────────────
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ─── Email (SMTP) ──────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="ECommerce <noreply@yourdomain.com>"

# ─── Rate Limiting ─────────────────────────────
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

### 18.2 Frontend (.env.local.example)

```env
# ─── API ───────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

# ─── Auth (next-auth) ──────────────────────────
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_minimum_32_chars

# ─── App ───────────────────────────────────────
NEXT_PUBLIC_APP_NAME=ECommerce
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 18.3 GitHub Secrets

```
SERVER_HOST              Production server IP
SERVER_USER              SSH username
SERVER_SSH_KEY           Private SSH key
NEXT_PUBLIC_API_URL      Production API URL
NEXT_PUBLIC_SOCKET_URL   Production Socket URL
```

---

## 19. Coding Standards

### 19.1 Naming Conventions

```typescript
// Files: kebab-case
products.service.ts
create-product.dto.ts
product.schema.ts

// Classes: PascalCase
class ProductsService {}
class CreateProductDto {}

// Variables & functions: camelCase
const productList = [];
async findBySlug() {}

// Constants: SCREAMING_SNAKE_CASE
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Interfaces: PascalCase với prefix I (tùy chọn)
interface IPaginatedResult<T> {}

// Enums: PascalCase, values SCREAMING_SNAKE_CASE
enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
}

// MongoDB ObjectId: dùng Types.ObjectId, không dùng string raw
userId: Types.ObjectId;
```

### 19.2 API Response Conventions

```typescript
// Luôn dùng TransformInterceptor để wrap response
// Luôn trả về consistent format

// HTTP Status Codes:
// 200 OK          — GET thành công
// 201 Created     — POST tạo resource mới
// 204 No Content  — DELETE thành công (không có body)
// 400 Bad Request — Validation error
// 401 Unauthorized — Chưa đăng nhập
// 403 Forbidden   — Không có quyền
// 404 Not Found   — Resource không tồn tại
// 409 Conflict    — Duplicate resource (email đã tồn tại)
// 422 Unprocessable Entity — Business logic error
// 429 Too Many Requests — Rate limit
// 500 Internal Server Error — Lỗi server
```

### 19.3 DTO Validation Examples

```typescript
// create-product.dto.ts
export class CreateProductDto {
  @ApiProperty({ example: 'Áo Thun Nam Basic' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }) => value.trim())
  name: string;

  @ApiProperty({ example: 299000, minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({ example: 20, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  discountPercent?: number;

  @ApiProperty({ type: [String], example: ['category_id_1'] })
  @IsArray()
  @IsMongoId({ each: true })
  @ArrayMinSize(1)
  categories: string[];

  @ApiProperty({ example: 100, minimum: 0 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stock: number;
}
```

### 19.4 Error Handling

```typescript
// common/exceptions/business.exception.ts
export class BusinessException extends HttpException {
  constructor(
    message: string,
    errorCode: string,
    statusCode: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
  ) {
    super({ message, errorCode }, statusCode);
  }
}

// Ví dụ dùng trong service
if (order.status !== OrderStatus.PENDING) {
  throw new BusinessException(
    'Chỉ có thể hủy đơn hàng ở trạng thái Chờ xác nhận',
    'ORDER_CANNOT_CANCEL',
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}
```

### 19.5 Frontend Conventions

```typescript
// Luôn dùng React Query cho server state
// Luôn dùng Zustand cho client state (cart, wishlist, auth)
// Không mix server state vào Zustand

// Query key factory pattern
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: string) => [...productKeys.lists(), { filters }] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (slug: string) => [...productKeys.details(), slug] as const,
};

// Sử dụng
const { data } = useQuery({
  queryKey: productKeys.detail(slug),
  queryFn: () => productService.findBySlug(slug),
  staleTime: 5 * 60 * 1000, // 5 phút
});
```

---

## 20. Sprint Roadmap

### Sprint 1 — Foundation (Tuần 1–2)

**Mục tiêu:** Setup hoàn chỉnh infrastructure, auth module.

Backend:
- [ ] Khởi tạo NestJS project, cấu hình module cơ bản
- [ ] Kết nối MongoDB Atlas, Redis
- [ ] Auth module: register, login, logout, refresh token rotation
- [ ] Email service: verify email, forgot password
- [ ] Upload module: Cloudinary integration
- [ ] Global exception filter, transform interceptor
- [ ] Swagger documentation setup
- [ ] Seed data (admin, categories, products)

Frontend:
- [ ] Khởi tạo Next.js project, cấu hình Tailwind, Shadcn
- [ ] Layout system (Header, Footer, Admin Sidebar)
- [ ] Auth pages: Login, Register, Forgot Password
- [ ] next-auth v5 configuration
- [ ] Axios instance + TanStack Query setup
- [ ] Zustand stores (auth, cart, wishlist)

DevOps:
- [ ] Docker Compose dev environment
- [ ] GitHub Actions CI pipeline (lint + test + build)

---

### Sprint 2 — Products & Categories (Tuần 3–4)

**Mục tiêu:** CRUD sản phẩm và danh mục hoàn chỉnh.

Backend:
- [ ] Categories module (CRUD, tree structure)
- [ ] Products module (CRUD, filter, search, pagination)
- [ ] ProductVariants module
- [ ] Redis caching cho products, categories
- [ ] Full-text search index

Frontend:
- [ ] Admin: Category management page
- [ ] Admin: Product management page (DataTable, Create/Edit form)
- [ ] Image uploader component

---

### Sprint 3 — User Shopping Experience (Tuần 5–6)

**Mục tiêu:** Trải nghiệm mua sắm hoàn chỉnh cho user.

Backend:
- [ ] Banners module
- [ ] Wishlist module
- [ ] Cart module

Frontend:
- [ ] Home page (Banner Carousel, Flash Sale section, Category grid, Product sections)
- [ ] Product Listing page (filter, sort, pagination, nuqs URL state)
- [ ] Product Detail page (gallery với zoom, variant selector, SSG/ISR)
- [ ] Search page
- [ ] Wishlist page
- [ ] Cart page

---

### Sprint 4 — Checkout & Orders (Tuần 7–8)

**Mục tiêu:** Luồng đặt hàng và quản lý đơn hàng.

Backend:
- [ ] Addresses module
- [ ] Coupons module (CRUD + validate)
- [ ] Orders module (create, cancel, confirm-received)
- [ ] BullMQ: order queue, email queue
- [ ] Order confirmation email

Frontend:
- [ ] Address management page
- [ ] Checkout flow (4 bước: Stepper)
- [ ] Order History page + Order Detail page
- [ ] Admin: Order management page

---

### Sprint 5 — Reviews, Notifications, Realtime (Tuần 9–10)

**Mục tiêu:** Reviews, thông báo, Socket.IO realtime.

Backend:
- [ ] Reviews module (create, helpful vote)
- [ ] Admin reviews management (approve, hide, delete)
- [ ] Notifications module
- [ ] Socket.IO gateway (order status, notifications)
- [ ] BullMQ: notification queue
- [ ] Admin: Coupons management
- [ ] Admin: Banners management

Frontend:
- [ ] Review form + Review list với rating
- [ ] Notification dropdown + Notification page
- [ ] Socket.IO integration (realtime order updates)
- [ ] Flash Sale page với countdown timer

---

### Sprint 6 — Admin Dashboard & Analytics (Tuần 11–12)

**Mục tiêu:** Dashboard hoàn chỉnh, Flash Sale, thống kê.

Backend:
- [ ] Dashboard module (stats, revenue charts, best sellers)
- [ ] Flash Sale: BullMQ scheduled jobs, Socket broadcast
- [ ] AuditLogs module
- [ ] Orders export CSV

Frontend:
- [ ] Admin Dashboard (cards + charts với Recharts)
- [ ] Admin: Users management (lock/unlock)
- [ ] Admin: Reviews management
- [ ] Flash Sale countdown realtime

---

### Sprint 7 — Testing & Performance (Tuần 13–14)

**Mục tiêu:** Đảm bảo chất lượng, tối ưu hiệu năng.

- [ ] Backend unit tests ≥ 80% coverage
- [ ] Backend integration tests (mongodb-memory-server)
- [ ] Backend E2E tests (critical flows)
- [ ] Frontend unit tests với Vitest + RTL
- [ ] Playwright E2E (checkout, auth flows)
- [ ] Performance audit (Lighthouse, bundle analyzer)
- [ ] SEO audit (meta tags, JSON-LD, sitemap)
- [ ] Image optimization (next/image, WebP)
- [ ] Database query optimization (explain plans)

---

### Sprint 8 — Security, Documentation & Deploy (Tuần 15–16)

**Mục tiêu:** Production-ready deployment.

- [ ] Security audit (OWASP checklist)
- [ ] Environment variables audit
- [ ] Rate limiting fine-tuning
- [ ] Swagger documentation hoàn chỉnh
- [ ] README.md (setup guide, architecture overview)
- [ ] Docker production build
- [ ] GitHub Actions CD pipeline (deploy to VPS)
- [ ] SSL certificate (Let's Encrypt)
- [ ] Monitoring setup (logs, health checks)
- [ ] Final QA & bug fixes
- [ ] Demo preparation

---

## Phụ Lục

### A. Error Codes Reference

```
AUTH_001   Email đã tồn tại
AUTH_002   Email hoặc mật khẩu không đúng
AUTH_003   Tài khoản chưa xác thực email
AUTH_004   Tài khoản đã bị khóa
AUTH_005   Token hết hạn hoặc không hợp lệ
AUTH_006   OTP không hợp lệ hoặc đã hết hạn

PRODUCT_001   Sản phẩm không tồn tại
PRODUCT_002   Sản phẩm đã hết hàng
PRODUCT_003   Số lượng mua vượt quá tồn kho
PRODUCT_004   Sản phẩm không còn trong Flash Sale

ORDER_001   Đơn hàng không tồn tại
ORDER_002   Không thể hủy đơn hàng ở trạng thái này
ORDER_003   Không thể xác nhận nhận hàng ở trạng thái này

COUPON_001   Mã giảm giá không tồn tại
COUPON_002   Mã giảm giá đã hết hạn
COUPON_003   Mã giảm giá đã hết lượt sử dụng
COUPON_004   Bạn đã dùng mã này rồi
COUPON_005   Đơn hàng chưa đạt giá trị tối thiểu

REVIEW_001   Bạn chưa mua sản phẩm này
REVIEW_002   Bạn đã đánh giá sản phẩm này rồi
REVIEW_003   Chỉ đánh giá được đơn hàng đã giao thành công

UPLOAD_001   Định dạng file không hợp lệ
UPLOAD_002   File quá lớn
```

### B. Checklist trước khi Deploy

```
Infrastructure:
☐ MongoDB Atlas cluster đã tạo, connection string OK
☐ Redis instance đã cấu hình, password set
☐ Cloudinary account, credentials OK
☐ SMTP credentials đã test gửi email thành công
☐ Domain đã trỏ về server

Security:
☐ JWT secrets dài tối thiểu 64 chars
☐ NEXTAUTH_SECRET đã set
☐ CORS chỉ cho phép frontend domain
☐ Rate limiting đã cấu hình
☐ Helmet headers đã bật
☐ MongoDB user chỉ có quyền readWrite (không phải admin)

Build:
☐ .env.production không commit lên git
☐ next.config.ts: output: 'standalone'
☐ Docker images build thành công
☐ Health check endpoints hoạt động (/health)

Monitoring:
☐ Winston logging configured
☐ Log rotation setup
☐ Error alerting (optional: Sentry)
```

### C. Tích hợp địa chỉ Việt Nam

Sử dụng API provinces.open-api.vn để lấy danh sách tỉnh/huyện/xã:

```typescript
// Frontend: địa chỉ form
const PROVINCES_API = 'https://provinces.open-api.vn/api';

// Lấy tất cả tỉnh/thành
GET https://provinces.open-api.vn/api/?depth=1

// Lấy quận/huyện theo tỉnh
GET https://provinces.open-api.vn/api/p/{province_code}?depth=2

// Lấy phường/xã theo quận
GET https://provinces.open-api.vn/api/d/{district_code}?depth=2

// Cache kết quả trong Redis (TTL: 24h) để tránh gọi API liên tục
```