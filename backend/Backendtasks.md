# Backend Task Breakdown
## Hệ Thống E-Commerce — NestJS 11 · MongoDB · Redis · BullMQ · Socket.IO

> **Tổng:** 15 tasks · Mỗi task là một đơn vị công việc hoàn chỉnh, có thể commit độc lập  
> **Quy ước:** Hoàn thành task theo đúng thứ tự — task sau phụ thuộc task trước  
> **Định nghĩa Done:** Mỗi task chỉ được đánh dấu ✅ khi toàn bộ checklist đã pass

---

## Tổng quan tiến độ

| Task | Tên | Phụ thuộc | Ước tính |
|------|-----|-----------|----------|
| T-01 | Project Setup & Infrastructure | — | 1 ngày |
| T-02 | Database Schemas & Seed Data | T-01 | 1 ngày |
| T-03 | Common Infrastructure | T-01 | 1 ngày |
| T-04 | Upload Module | T-03 | 0.5 ngày |
| T-05 | Email Module | T-03 | 0.5 ngày |
| T-06 | Auth Module | T-02, T-03, T-05 | 2 ngày |
| T-07 | Users & Addresses Module | T-06 | 1 ngày |
| T-08 | Categories & Products Module | T-06, T-04 | 2 ngày |
| T-09 | Wishlist & Cart Module | T-08 | 1 ngày |
| T-10 | Coupons Module | T-08 | 0.5 ngày |
| T-11 | Orders Module | T-09, T-10 | 2 ngày |
| T-12 | Reviews Module | T-11 | 1 ngày |
| T-13 | Banners & Notifications & Socket.IO | T-06 | 1 ngày |
| T-14 | Dashboard Module | T-11, T-12 | 1 ngày |
| T-15 | Testing, Security & Documentation | T-01 → T-14 | 2 ngày |

**Tổng ước tính: ~17 ngày làm việc**

---

## Task Dependency Graph

```
T-01 (Setup)
  ├── T-02 (Schemas)      ──────────────────────────────────────────────┐
  │                                                                      │
  └── T-03 (Common)                                                      │
        ├── T-04 (Upload)                                                │
        ├── T-05 (Email)                                                 │
        │                                                                │
        └── T-06 (Auth) ◄────────────────── T-02, T-04(indirect), T-05 ◄┘
              │
              ├── T-07 (Users & Addresses)
              │
              └── T-08 (Categories & Products)
                    │
                    └── T-09 (Wishlist & Cart)
                          │
                          ├── T-10 (Coupons)
                          │
                          └── T-11 (Orders) ◄──── T-10
                                │
                                ├── T-12 (Reviews)
                                │
                                └── T-14 (Dashboard) ◄──── T-12

T-13 (Banners + Notifications + Socket) ◄──── T-06 (auth để emit to user)

T-15 (Testing + Security + Docs) ◄──── tất cả tasks trên
```

---

---

# TASK T-01
## Project Setup & Infrastructure

> **Mục tiêu:** Dựng khung NestJS hoàn chỉnh, kết nối đầy đủ MongoDB + Redis, Docker dev environment chạy được, CI pipeline lint + build xanh.

---

### 1.1 Khởi tạo NestJS project

- [ ] Tạo project NestJS 11 với `nest new backend --strict`
- [ ] Cài đặt toàn bộ dependencies cần thiết:
  ```
  @nestjs/mongoose mongoose
  @nestjs/jwt @nestjs/passport passport passport-jwt passport-local
  @nestjs/config joi
  @nestjs/throttler
  @nestjs/cache-manager cache-manager
  @nestjs/bull bullmq
  @nestjs/swagger swagger-ui-express
  @nestjs/schedule
  socket.io @nestjs/websockets @nestjs/platform-socket.io
  ioredis
  cloudinary multer @types/multer
  bcrypt @types/bcrypt
  class-validator class-transformer
  winston nest-winston
  @nestjs-modules/mailer nodemailer handlebars
  sanitize-html
  slugify
  uuid
  ```
- [ ] Cài devDependencies: `@types/passport-jwt @types/passport-local @types/multer @types/nodemailer mongodb-memory-server`
- [ ] Cấu hình `tsconfig.json`: `strict: true`, `strictNullChecks: true`, `noImplicitAny: true`
- [ ] Cấu hình `nest-cli.json` với `deleteOutDir: true`
- [ ] Setup `package.json` scripts:
  ```json
  "start:dev": "nest start --watch",
  "build": "nest build",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:cov": "jest --coverage",
  "test:e2e": "jest --config jest-e2e.json",
  "lint": "eslint \"{src,test}/**/*.ts\"",
  "type-check": "tsc --noEmit",
  "seed": "ts-node src/database/seeds/seed.ts"
  ```

---

### 1.2 Cấu hình Environment & Validation

- [ ] Tạo file `.env.example` với tất cả variables:
  ```env
  NODE_ENV=development
  PORT=3001
  FRONTEND_URL=http://localhost:3000

  # JWT
  JWT_ACCESS_SECRET=
  JWT_ACCESS_EXPIRES=15m
  JWT_REFRESH_SECRET=
  JWT_REFRESH_EXPIRES=7d

  # MongoDB
  MONGODB_URI=mongodb://admin:password@localhost:27017/ecommerce

  # Redis
  REDIS_HOST=localhost
  REDIS_PORT=6379
  REDIS_PASSWORD=

  # Cloudinary
  CLOUDINARY_CLOUD_NAME=
  CLOUDINARY_API_KEY=
  CLOUDINARY_API_SECRET=

  # Email (SMTP)
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=
  SMTP_PASS=
  SMTP_FROM=

  # Rate Limiting
  THROTTLE_TTL=60000
  THROTTLE_LIMIT=100
  ```
- [ ] Tạo `src/config/config.validation.ts` dùng Joi validate tất cả env vars bắt buộc khi khởi động
- [ ] Tạo từng config file riêng:
  - `src/config/app.config.ts`
  - `src/config/database.config.ts`
  - `src/config/jwt.config.ts`
  - `src/config/redis.config.ts`
  - `src/config/cloudinary.config.ts`
  - `src/config/mail.config.ts`
- [ ] Register `ConfigModule.forRoot({ isGlobal: true, validate: configValidation })` trong `AppModule`

---

### 1.3 Kết nối Database & Cache

- [ ] Tạo `src/database/database.module.ts`:
  - Kết nối MongoDB Atlas qua `MongooseModule.forRootAsync()`
  - Cấu hình: `retryWrites: true`, `retryReads: true`, `serverSelectionTimeoutMS: 5000`
- [ ] Tạo `src/cache/cache.module.ts`:
  - `CacheModule.registerAsync()` với ioredis adapter
  - Global module, import 1 lần dùng khắp nơi
- [ ] Cấu hình BullMQ với Redis connection trong `AppModule`
- [ ] Cấu hình `@nestjs/schedule` cho CRON jobs

---

### 1.4 Cấu hình main.ts

- [ ] Helmet với Content Security Policy phù hợp
- [ ] CORS chỉ cho phép `FRONTEND_URL`
- [ ] Global `ValidationPipe` với options:
  ```typescript
  { whitelist: true, forbidNonWhitelisted: true, transform: true,
    transformOptions: { enableImplicitConversion: true } }
  ```
- [ ] Global prefix `/api/v1`
- [ ] Swagger setup: `DocumentBuilder` với title, description, version, BearerAuth scheme
- [ ] Winston logger thay thế default NestJS logger
- [ ] `app.enableShutdownHooks()` cho graceful shutdown

---

### 1.5 Docker & CI/CD

- [ ] Tạo `docker-compose.dev.yml` với services: `mongodb`, `redis`, `redis-commander`, `mongo-express`
- [ ] Tạo `Dockerfile` backend multi-stage (base → deps → builder → runner)
- [ ] Tạo `.dockerignore`
- [ ] Tạo `.github/workflows/ci.yml`:
  - Job `backend-ci`: install → lint → type-check → test → build
  - Services: mongodb + redis cho test
- [ ] Verify: `docker compose -f docker-compose.dev.yml up -d` chạy OK
- [ ] Verify: `npm run start:dev` kết nối thành công MongoDB + Redis

---

### 1.6 Logging setup

- [ ] Tạo `src/common/logger/logger.module.ts` với Winston:
  - Console transport: colorized, timestamp
  - File transport: `logs/error.log` (level: error), `logs/combined.log` (level: info)
  - Format: JSON structured `{ timestamp, level, context, message, ...meta }`
- [ ] Không bao giờ log: password, token, secret (thêm filter/redact)

---

**✅ Definition of Done T-01:**
- `npm run start:dev` → server lắng nghe port 3001, không có lỗi
- `GET /api/v1` trả về JSON info
- `GET /api/docs` mở Swagger UI
- MongoDB + Redis kết nối thành công (thấy log `[MongoDB] Connected`, `[Redis] Connected`)
- `npm run lint` → 0 errors
- `npm run build` → dist/ được tạo thành công
- GitHub Actions CI pipeline xanh

---

---

# TASK T-02
## Database Schemas & Seed Data

> **Mục tiêu:** Tạo hoàn chỉnh toàn bộ Mongoose schemas với indexes, validation, relationships. Có seed data để dev/test.

**Phụ thuộc:** T-01

---

### 2.1 Tạo tất cả Mongoose Schemas

Tạo từng schema theo đúng thứ tự (schema sau có thể reference schema trước):

**Nhóm 1 — Auth & User:**
- [ ] `src/modules/users/schemas/user.schema.ts`
  - Fields: fullName, email (unique, lowercase), password (select: false), phone, avatar, role (enum), status (enum), isEmailVerified, lastLoginAt, lockedAt, lockedReason
  - `toJSON` transform: xóa `password` field
  - Indexes: `{ email: 1 }` unique, `{ role: 1, status: 1 }`, `{ createdAt: -1 }`

- [ ] `src/modules/auth/schemas/refresh-token.schema.ts`
  - Fields: userId (ref User), tokenHash (select: false), expiresAt, revokedAt, deviceInfo, ipAddress
  - TTL index: `{ expiresAt: 1 }` với `expireAfterSeconds: 0`
  - Index: `{ userId: 1 }`

- [ ] `src/modules/auth/schemas/otp-token.schema.ts`
  - Fields: userId (ref User), token, type (enum: verify_email|reset_password), expiresAt, used
  - TTL index: `{ expiresAt: 1 }` với `expireAfterSeconds: 0`

**Nhóm 2 — Address:**
- [ ] `src/modules/addresses/schemas/address.schema.ts`
  - Fields: userId (ref User), fullName, phone, province {code, name}, district {code, name}, ward {code, name}, streetAddress, isDefault, label (enum: home|office|other)
  - Indexes: `{ userId: 1 }`, `{ userId: 1, isDefault: 1 }`

**Nhóm 3 — Catalog:**
- [ ] `src/modules/categories/schemas/category.schema.ts`
  - Fields: name, slug (unique), description, image, parentId (ref Category, nullable), order, isActive
  - Indexes: `{ slug: 1 }` unique, `{ parentId: 1, isActive: 1 }`

- [ ] `src/modules/products/schemas/product.schema.ts`
  - Fields: tất cả fields đã thiết kế (name, slug, description, shortDescription, categories[], brand, price, discountPercent, isFlashSale, flashSalePrice, flashSaleStock, flashSaleEndAt, images[], video, thumbnailUrl, stock, sku, weight, dimensions, tags[], isFeatured, isActive, soldCount, viewCount, averageRating, reviewCount, metaTitle, metaDescription)
  - Indexes: 8 compound indexes cho các query patterns khác nhau
  - Text index: `{ name: 'text', description: 'text', tags: 'text' }`

- [ ] `src/modules/products/schemas/product-variant.schema.ts`
  - Fields: productId (ref Product), options[] {name, value}, price, discountPercent, stock, sku, image, isActive
  - Indexes: `{ productId: 1 }`, `{ productId: 1, isActive: 1 }`

**Nhóm 4 — Commerce:**
- [ ] `src/modules/cart/schemas/cart.schema.ts`
  - Embedded CartItem schema (không tách collection)
  - CartItem fields: productId, variantId, productName, productImage, variantOptions, price, quantity, addedAt

- [ ] `src/modules/wishlist/schemas/wishlist.schema.ts`
  - Fields: userId (ref User, unique), items[] { productId (ref Product), addedAt }
  - Index: `{ userId: 1 }`, `{ 'items.productId': 1 }`

- [ ] `src/modules/coupons/schemas/coupon.schema.ts`
  - Fields: code (unique, uppercase), description, type (enum: percent|fixed_amount|free_shipping), value, minOrderAmount, maxDiscountAmount, usageLimit, usagePerUser, usedCount, applicableProducts[], applicableCategories[], startDate, endDate, isActive
  - Indexes: `{ code: 1 }` unique, `{ isActive: 1, startDate: 1, endDate: 1 }`

- [ ] `src/modules/coupons/schemas/coupon-usage.schema.ts`
  - Fields: couponId, userId, orderId, discountAmount
  - Index: `{ couponId: 1, userId: 1 }`, `{ orderId: 1 }`

**Nhóm 5 — Orders:**
- [ ] `src/modules/orders/schemas/order.schema.ts`
  - Fields: orderCode (unique), userId, items[], shippingAddress (embedded snapshot), subtotal, shippingFee, discountAmount, couponCode, totalAmount, paymentMethod (enum), paymentStatus (enum), status (enum), statusHistory[] {status, updatedAt, updatedBy, note}, notes, cancelReason, expectedDeliveryAt, deliveredAt
  - Indexes: `{ orderCode: 1 }` unique, `{ userId: 1, createdAt: -1 }`, `{ status: 1, createdAt: -1 }`

- [ ] `src/modules/orders/schemas/order-item.schema.ts`
  - Fields: orderId, productId, variantId, productName, productImage, variantOptions, unitPrice, quantity, totalPrice, isReviewed, reviewId
  - Indexes: `{ orderId: 1 }`, `{ productId: 1 }`

**Nhóm 6 — Reviews & Content:**
- [ ] `src/modules/reviews/schemas/review.schema.ts`
  - Fields: userId, productId, orderId, orderItemId (unique index), rating, content, images[], isApproved, isHidden, adminNote, helpfulCount, helpfulVoters[]
  - Indexes: `{ orderItemId: 1 }` unique, `{ productId: 1, isApproved: 1, isHidden: 1 }`, `{ userId: 1 }`

- [ ] `src/modules/banners/schemas/banner.schema.ts`
  - Fields: title, imageUrl, mobileImageUrl, linkUrl, type (enum), order, isActive, startAt, endAt
  - Index: `{ type: 1, isActive: 1, order: 1 }`

- [ ] `src/modules/notifications/schemas/notification.schema.ts`
  - Fields: userId, type (enum), title, message, link, data (mixed), isRead
  - Indexes: `{ userId: 1, createdAt: -1 }`, `{ userId: 1, isRead: 1 }`
  - TTL index: `{ createdAt: 1 }` expireAfterSeconds: 7776000 (90 ngày)

**Nhóm 7 — System:**
- [ ] `src/modules/audit-logs/schemas/audit-log.schema.ts`
  - Fields: userId, action, resource, resourceId, before, after, ipAddress, createdAt
  - Indexes: `{ userId: 1, createdAt: -1 }`, `{ resource: 1, resourceId: 1 }`
  - TTL: 180 ngày

---

### 2.2 Export & Register Schemas

- [ ] Mỗi module export schema qua `MongooseModule.forFeature([{ name: X.name, schema: XSchema }])`
- [ ] Tạo barrel exports cho từng module's schema folder
- [ ] Verify tất cả schemas import đúng, không circular dependency

---

### 2.3 Seed Data

- [ ] Tạo `src/database/seeds/seed.ts` — entry point chạy tất cả seeders theo thứ tự
- [ ] `src/database/seeds/users.seed.ts`:
  - 1 Super Admin: `superadmin@ecommerce.com` / `SuperAdmin@123`
  - 1 Admin: `admin@ecommerce.com` / `Admin@123`
  - 1 Moderator: `moderator@ecommerce.com` / `Moderator@123`
  - 5 test users với orders/reviews
- [ ] `src/database/seeds/categories.seed.ts`:
  - 5 root categories: Thời trang, Điện tử, Gia dụng, Sách, Thể thao
  - 3–4 sub-categories mỗi root
- [ ] `src/database/seeds/products.seed.ts`:
  - 30 sản phẩm với đầy đủ fields, variants, images (dùng placeholder URLs)
  - 5 sản phẩm có flash sale
  - 8 sản phẩm isFeatured
- [ ] `src/database/seeds/banners.seed.ts`: 3 banners hero, 2 banners flash-sale
- [ ] `src/database/seeds/coupons.seed.ts`: 3 coupons (PERCENT, FIXED_AMOUNT, FREE_SHIPPING)
- [ ] Thêm `npm run seed` script, seed có thể chạy lại an toàn (idempotent — upsert, không duplicate)

---

**✅ Definition of Done T-02:**
- `npm run seed` chạy thành công không có lỗi
- Mongo Express hiển thị đúng tất cả collections với data
- Tất cả indexes được tạo (verify qua Atlas UI hoặc `db.collection.getIndexes()`)
- Schema validation pass (test thử insert document thiếu required field → lỗi)

---

---

# TASK T-03
## Common Infrastructure

> **Mục tiêu:** Tạo toàn bộ building blocks dùng chung: Guards, Pipes, Filters, Interceptors, Decorators, Exception classes. Đây là nền tảng cho tất cả modules sau.

**Phụ thuộc:** T-01

---

### 3.1 Custom Exceptions

- [ ] `src/common/exceptions/business.exception.ts`:
  ```typescript
  export class BusinessException extends HttpException {
    constructor(message: string, errorCode: string, statusCode: HttpStatus) { ... }
  }
  ```
- [ ] `src/common/exceptions/not-found.exception.ts`
- [ ] `src/common/constants/error-codes.constant.ts` — export tất cả ~65 error code strings làm constants

---

### 3.2 Global Exception Filter

- [ ] `src/common/filters/global-exception.filter.ts`:
  - Catch `BusinessException` → format `{ success: false, error: { code, message } }`
  - Catch `ValidationError` (class-validator) → format `{ success: false, error: { code: 'VALIDATION_ERROR', details: [...] } }`
  - Catch `MongoError` code 11000 (duplicate key) → trả về 409 Conflict
  - Catch `UnauthorizedException`, `ForbiddenException`, `NotFoundException` → format chuẩn
  - Catch generic `Error` → log stack trace, trả về 500 `SYS_INTERNAL_ERROR`
  - **Không expose stack trace trong production**
- [ ] Register global trong `main.ts`: `app.useGlobalFilters(new GlobalExceptionFilter(logger))`

---

### 3.3 Transform Interceptor

- [ ] `src/common/interceptors/transform.interceptor.ts`:
  - Wrap mọi response thành `{ success: true, data: ..., message: ... }`
  - Nếu response là `null` hoặc `void` → không wrap thêm data
- [ ] `src/common/interceptors/logging.interceptor.ts`:
  - Log mỗi request: `[method] [url] [statusCode] [durationMs]ms`
  - Log body chỉ trong development, không log password fields
- [ ] Register cả hai global trong `AppModule`

---

### 3.4 Guards

- [ ] `src/common/guards/jwt-auth.guard.ts`:
  - Extend `AuthGuard('jwt')`
  - Kiểm tra `@Public()` metadata → bỏ qua nếu có
  - Nếu token hết hạn → throw `AUTH_TOKEN_EXPIRED` (không throw generic `Unauthorized`)
- [ ] `src/common/guards/roles.guard.ts`:
  - Đọc `@Roles()` metadata từ handler và class
  - So sánh `req.user.role` với required roles
  - Không có roles requirement → allow all authenticated users

---

### 3.5 Custom Decorators

- [ ] `src/common/decorators/current-user.decorator.ts`:
  ```typescript
  export const CurrentUser = createParamDecorator(
    (data: keyof User | undefined, ctx) => {
      const user = ctx.switchToHttp().getRequest().user;
      return data ? user?.[data] : user;
    }
  );
  ```
- [ ] `src/common/decorators/roles.decorator.ts`: `@Roles(...roles: UserRole[])`
- [ ] `src/common/decorators/public.decorator.ts`: `@Public()` — skip JWT guard
- [ ] `src/common/decorators/audit.decorator.ts`: `@Audit({ action, resource })` — metadata cho AuditInterceptor
- [ ] `src/common/decorators/api-paginated-response.decorator.ts` — Swagger helper

---

### 3.6 Custom Pipes

- [ ] `src/common/pipes/parse-object-id.pipe.ts`:
  - Validate string là MongoDB ObjectId hợp lệ
  - Throw `BadRequestException` nếu không hợp lệ, message: `"ID không hợp lệ"`
- [ ] `src/common/pipes/trim.pipe.ts`:
  - Trim tất cả string fields trong request body/query

---

### 3.7 Pagination & Response DTOs

- [ ] `src/common/dto/pagination.dto.ts`:
  ```typescript
  export class PaginationDto {
    @IsOptional() @Min(1) @Type(() => Number)
    page?: number = 1;

    @IsOptional() @Min(1) @Max(100) @Type(() => Number)
    limit?: number = 20;
  }
  ```
- [ ] `src/common/dto/paginated-result.dto.ts` — wrapper cho paginated responses
- [ ] `src/common/utils/pagination.util.ts` — hàm `paginate(model, filter, sort, { page, limit })`

---

### 3.8 Utility Functions

- [ ] `src/common/utils/slug.util.ts`:
  - `generateSlug(name: string): string` — slugify tiếng Việt + suffix ngẫu nhiên
  - `generateUniqueSlug(name, checkFn): Promise<string>` — retry nếu trùng
- [ ] `src/common/utils/order-code.util.ts`:
  - `generateOrderCode(redisClient): Promise<string>` — `ORD-YYYYMMDD-XXXXX` dùng Redis INCR
- [ ] `src/common/utils/crypto.util.ts`:
  - `hashToken(token): Promise<string>` — bcrypt hash với rounds 10
  - `verifyToken(plain, hash): Promise<boolean>`
  - `generateToken(): string` — UUID v4

---

### 3.9 Constants

- [ ] `src/common/constants/cache-keys.constant.ts` — tất cả Redis key builders
- [ ] `src/common/constants/queue.constant.ts` — tên tất cả queues
- [ ] `src/common/constants/app.constant.ts`:
  ```typescript
  export const LIMITS = {
    CART_MAX_ITEMS: 50,
    ADDRESS_MAX_PER_USER: 10,
    REVIEW_MAX_IMAGES: 5,
    FREE_SHIPPING_THRESHOLD: 500_000,
    STANDARD_SHIPPING_FEE: 30_000,
    UPLOAD_MAX_SIZE_IMAGE: 5_242_880,
    BCRYPT_ROUNDS: 12,
    AUTO_CANCEL_PENDING_HOURS: 48,
    REVIEW_PERIOD_DAYS: 90,
  };
  ```

---

### 3.10 Health Check Module

- [ ] `src/modules/health/health.controller.ts`:
  - `GET /health` → ping MongoDB + Redis, trả về `{ status, services, uptime, version }`
  - HTTP 200 nếu tất cả OK, 503 nếu degraded
- [ ] `GET /api/v1` → API info endpoint

---

**✅ Definition of Done T-03:**
- Tạo một controller test, throw `BusinessException` → response đúng format
- Throw validation error (missing required field) → response có `details` array
- `@Public()` endpoint không cần token
- `@Roles(UserRole.ADMIN)` endpoint → 403 khi gọi với user token
- `GET /health` → `{ status: "ok", services: { mongodb: "up", redis: "up" } }`

---

---

# TASK T-04
## Upload Module

> **Mục tiêu:** Tích hợp Cloudinary, upload/xóa ảnh an toàn với validation MIME type thực.

**Phụ thuộc:** T-01, T-03

---

### 4.1 Cloudinary Service

- [ ] Tạo `src/modules/upload/upload.module.ts` — Global module
- [ ] Tạo `src/modules/upload/cloudinary.provider.ts`:
  ```typescript
  export const CloudinaryProvider = {
    provide: 'CLOUDINARY',
    useFactory: () => cloudinary.config({ cloud_name, api_key, api_secret })
  };
  ```
- [ ] Tạo `src/modules/upload/cloudinary.service.ts`:
  - `uploadImage(buffer, options): Promise<UploadResult>` — upload với transformation (1200×1200 limit, quality auto, fetch_format auto)
  - `deleteFile(publicId): Promise<void>`
  - Xử lý lỗi Cloudinary → wrap thành `BusinessException`

---

### 4.2 Upload Controller & Validation

- [ ] Cấu hình Multer: memory storage (không lưu disk), maxFileSize 5MB, fileFilter chỉ nhận MIME image/*
- [ ] `src/modules/upload/upload.controller.ts`:
  - `POST /upload/image` — upload single image
  - `POST /upload/images` — upload multiple (max 10)
  - `DELETE /upload` — xóa file theo publicId
  - Tất cả endpoints yêu cầu JWT
- [ ] `src/modules/upload/upload.service.ts`:
  - Validate MIME type thực bằng magic bytes (dùng `file-type` package hoặc check đầu buffer)
  - Validate file size
  - Gọi cloudinaryService.uploadImage()
- [ ] `src/modules/upload/dto/upload-response.dto.ts`: `{ url, thumbnailUrl, publicId, width, height, format, size }`

---

### 4.3 Swagger Documentation

- [ ] `@ApiConsumes('multipart/form-data')` trên upload endpoints
- [ ] `@ApiBody({ schema: { ... } })` mô tả file field
- [ ] `@ApiResponse` cho 200, 400 (invalid type, too large)

---

**✅ Definition of Done T-04:**
- `POST /upload/image` với ảnh JPEG → trả về URL Cloudinary thực, có thumbnailUrl
- Upload file PDF → 400 `UPLOAD_INVALID_TYPE`
- Upload file > 5MB → 400 `UPLOAD_FILE_TOO_LARGE`
- `DELETE /upload` → file bị xóa trên Cloudinary

---

---

# TASK T-05
## Email Module

> **Mục tiêu:** Email service với Nodemailer + Handlebars templates, BullMQ email queue để không block request.

**Phụ thuộc:** T-01, T-03

---

### 5.1 Email Service & Templates

- [ ] Tạo `src/modules/email/email.module.ts` — Global module
- [ ] Cấu hình `MailerModule.forRootAsync()` với Nodemailer SMTP transport
- [ ] Tạo templates Handlebars (dùng HTML responsive, mobile-friendly):
  - `src/modules/email/templates/verify-email.hbs` — variables: `{ fullName, verifyUrl, expiresInMinutes }`
  - `src/modules/email/templates/reset-password.hbs` — variables: `{ fullName, resetUrl, expiresInMinutes }`
  - `src/modules/email/templates/order-confirmation.hbs` — variables: `{ fullName, orderCode, orderUrl, items[], subtotal, shippingFee, total, shippingAddress }`
  - `src/modules/email/templates/order-status-update.hbs` — variables: `{ fullName, orderCode, orderUrl, newStatus, statusMessage, note }`
  - `src/modules/email/templates/password-changed.hbs` — variables: `{ fullName, changedAt }`

---

### 5.2 BullMQ Email Queue

- [ ] Tạo `src/modules/email/email.queue.ts` — định nghĩa queue `email` với options:
  ```typescript
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 }
  }
  ```
- [ ] Tạo `src/modules/email/email.processor.ts` — BullMQ Worker:
  - Xử lý jobs: `send-verify-email`, `send-reset-password`, `send-order-confirmation`, `send-order-status-update`, `send-password-changed`
  - Log thành công/thất bại
  - Khi job fail quá attempts → log ERROR alert
- [ ] Tạo `src/modules/email/email.service.ts` — public API:
  - `sendVerifyEmail(to, fullName, token): Promise<void>` — enqueue job
  - `sendResetPassword(to, fullName, token): Promise<void>` — enqueue job
  - `sendOrderConfirmation(to, orderData): Promise<void>` — enqueue job
  - `sendOrderStatusUpdate(to, data): Promise<void>` — enqueue job

---

**✅ Definition of Done T-05:**
- `emailService.sendVerifyEmail()` → job xuất hiện trong BullMQ queue
- Email processor xử lý job → email được gửi thực (test với Mailtrap hoặc SMTP thật)
- Job fail → retry tự động với exponential backoff
- Không leak SMTP credentials trong logs

---

---

# TASK T-06
## Auth Module

> **Mục tiêu:** Authentication hoàn chỉnh với JWT access/refresh token rotation, email verification, forgot/reset password.

**Phụ thuộc:** T-02, T-03, T-05

---

### 6.1 Repositories

- [ ] `src/modules/users/users.repository.ts`:
  - `findByEmail(email): Promise<User | null>`
  - `findByEmailWithPassword(email): Promise<UserDocument | null>` — include password field
  - `findById(id): Promise<User | null>`
  - `create(data): Promise<User>`
  - `updateById(id, data): Promise<User | null>`
  - `updateLastLogin(id): Promise<void>`
  - `updatePassword(id, hashedPassword): Promise<void>`
  - `updateStatus(id, status, reason?): Promise<void>`

- [ ] `src/modules/auth/repositories/refresh-token.repository.ts`:
  - `create(data): Promise<RefreshToken>`
  - `findActiveByUserId(userId): Promise<RefreshToken[]>`
  - `findAndVerify(tokenHash, userId): Promise<RefreshToken | null>`
  - `revoke(id): Promise<void>`
  - `revokeAllByUser(userId): Promise<void>`

- [ ] `src/modules/auth/repositories/otp-token.repository.ts`:
  - `create(data): Promise<OtpToken>`
  - `findValid({ token, type }): Promise<OtpToken | null>` — lọc expiresAt > now và used = false
  - `markUsed(id): Promise<void>`
  - `deleteByUserAndType(userId, type): Promise<void>`

---

### 6.2 Passport Strategies

- [ ] `src/modules/auth/strategies/local.strategy.ts`:
  - Validate email + password
  - Throw exception với message không tiết lộ field nào sai (`AUTH_INVALID_CREDENTIALS`)
  - Kiểm tra user status trước khi trả về

- [ ] `src/modules/auth/strategies/jwt.strategy.ts`:
  - Extract Bearer token từ header
  - Verify, decode payload
  - Query user từ DB (hoặc Redis cache 30s để tránh DB hit mỗi request)
  - Kiểm tra `user.status !== 'locked'` → throw nếu locked

- [ ] `src/modules/auth/strategies/jwt-refresh.strategy.ts`:
  - Extract refresh token từ request body
  - Chỉ verify format, không verify state (state check ở service)

---

### 6.3 Auth Service

- [ ] `register(dto)`:
  - Kiểm tra email duplicate
  - Hash password với bcrypt (rounds: 12)
  - Tạo user với status `inactive`
  - Tạo OTP verify_email token (TTL: 60 phút)
  - Enqueue email job `send-verify-email`
  - Return user (không có password)

- [ ] `login(dto)`:
  - LocalStrategy đã validate, nhận user object
  - Kiểm tra status: inactive → `AUTH_EMAIL_NOT_VERIFIED`, locked → `AUTH_ACCOUNT_LOCKED`
  - Generate access token (JWT 15 phút, payload: `{ sub, email, role }`)
  - Generate refresh token (UUID), hash lưu DB
  - Update `lastLoginAt` async
  - Return `{ accessToken, refreshToken, expiresIn: 900, user }`

- [ ] `logout(userId, refreshToken)`:
  - Tìm và revoke refresh token
  - Return 200

- [ ] `refresh(refreshToken)`:
  - Tìm record có hash match
  - Kiểm tra `revokedAt` — nếu đã revoke: đây là reuse attack, revoke ALL tokens của user, throw `AUTH_TOKEN_REVOKED`
  - Kiểm tra `expiresAt`
  - Revoke token cũ, tạo cặp token mới (rotation)
  - Return `{ accessToken, refreshToken, expiresIn }`

- [ ] `verifyEmail(token)`:
  - Tìm OTP valid với type `verify_email`
  - Mark used
  - Update user `isEmailVerified: true`, `status: active`

- [ ] `resendVerifyEmail(email)`:
  - Không báo lỗi nếu email không tồn tại (tránh enumeration)
  - Rate limit: không gửi lại nếu đã gửi trong 2 phút (check Redis)
  - Xóa OTP cũ, tạo mới, enqueue email

- [ ] `forgotPassword(email)`:
  - Luôn return 200 (không tiết lộ email có tồn tại không)
  - Nếu user tồn tại: xóa OTP cũ, tạo token reset_password (TTL: 60 phút), enqueue email

- [ ] `resetPassword({ token, newPassword })`:
  - Tìm OTP valid với type `reset_password`
  - Mark used
  - Hash và update password
  - Revoke ALL refresh tokens của user (buộc đăng nhập lại)
  - Enqueue email `send-password-changed`

---

### 6.4 Auth Controller

- [ ] `POST /auth/register` — `@Public()`
- [ ] `POST /auth/login` — `@Public()`, dùng `@UseGuards(LocalAuthGuard)`
- [ ] `POST /auth/logout` — JWT required
- [ ] `POST /auth/refresh` — `@Public()`
- [ ] `POST /auth/verify-email` — `@Public()`
- [ ] `POST /auth/resend-verify-email` — `@Public()`, throttle 2 req/phút
- [ ] `POST /auth/forgot-password` — `@Public()`, throttle 3 req/phút
- [ ] `POST /auth/reset-password` — `@Public()`
- [ ] `GET /auth/me` — JWT required

---

### 6.5 DTOs với đầy đủ Swagger

- [ ] `RegisterDto`: fullName, email, password với `@ApiProperty` và `example` values
- [ ] `LoginDto`: email, password
- [ ] `ForgotPasswordDto`: email
- [ ] `ResetPasswordDto`: token, newPassword — validate password strength
- [ ] `VerifyEmailDto`: token
- [ ] `ResendVerifyEmailDto`: email
- [ ] `RefreshTokenDto`: refreshToken

---

**✅ Definition of Done T-06:**
- Đăng ký → nhận email verify
- Đăng nhập khi chưa verify → 403 `AUTH_EMAIL_NOT_VERIFIED`
- Verify email → đăng nhập thành công
- Refresh token → nhận cặp token mới, token cũ bị revoke
- Dùng token cũ sau khi refresh → 401 `AUTH_TOKEN_REVOKED`
- Forgot password → nhận email, reset thành công
- `GET /auth/me` với valid token → user object
- Rate limit `/auth/login` → 429 sau 5 lần/phút

---

---

# TASK T-07
## Users & Addresses Module

> **Mục tiêu:** User profile management và địa chỉ giao hàng với validation địa chỉ Việt Nam.

**Phụ thuộc:** T-06

---

### 7.1 Users Module (Profile)

- [ ] `src/modules/users/users.controller.ts`:
  - `GET /users/me` — return full profile
  - `PATCH /users/me` — update fullName, phone
  - `PATCH /users/me/password` — đổi mật khẩu (cần currentPassword)
  - `PATCH /users/me/avatar` — update avatar URL

- [ ] `src/modules/users/users.service.ts`:
  - `getProfile(userId)`: query user, return không có password
  - `updateProfile(userId, dto)`: validate, update, return updated
  - `changePassword(userId, dto)`:
    - Lấy user có password field
    - Verify `currentPassword` với bcrypt
    - Validate `newPassword !== currentPassword`
    - Hash và update
    - Revoke tất cả refresh tokens của user (trừ current session - optional)
  - `updateAvatar(userId, avatarUrl)`: validate Cloudinary URL format, update

- [ ] DTOs: `UpdateProfileDto`, `ChangePasswordDto` (currentPassword, newPassword, confirmPassword)

---

### 7.2 Addresses Module

- [ ] `src/modules/addresses/addresses.repository.ts`:
  - `findByUserId(userId)`: danh sách địa chỉ
  - `findByIdAndUser(id, userId)`: lấy 1 địa chỉ (check ownership)
  - `create(data)`: tạo mới
  - `update(id, data)`: update
  - `delete(id)`: xóa
  - `countByUser(userId)`: đếm số địa chỉ
  - `unsetDefault(userId)`: set tất cả isDefault = false
  - `setDefault(id, userId)`: set 1 địa chỉ là default

- [ ] `src/modules/addresses/addresses.service.ts`:
  - `getAddresses(userId)`: list
  - `create(userId, dto)`:
    - Check `count >= 10` → `ADDRESS_MAX_EXCEEDED`
    - Nếu là địa chỉ đầu tiên: set `isDefault = true`
    - Nếu `isDefault = true`: unset default cũ trước
  - `update(userId, id, dto)`:
    - Verify ownership
    - Nếu update `isDefault = true`: unset default cũ
  - `delete(userId, id)`:
    - Verify ownership
    - Nếu là default → `ADDRESS_CANNOT_DELETE_DEFAULT`
  - `setDefault(userId, id)`:
    - Verify ownership
    - unsetDefault(userId) → setDefault(id, userId)

- [ ] `src/modules/addresses/addresses.controller.ts`:
  - `GET /addresses`
  - `POST /addresses`
  - `PATCH /addresses/:id`
  - `DELETE /addresses/:id`
  - `PATCH /addresses/:id/set-default`

- [ ] DTOs: `CreateAddressDto` với nested AdminDivisionDto `{ code: string, name: string }`

---

**✅ Definition of Done T-07:**
- `PATCH /users/me` cập nhật đúng, không cho sửa email/role
- `PATCH /users/me/password` với sai currentPassword → 401
- Thêm địa chỉ thứ 11 → 422 `ADDRESS_MAX_EXCEEDED`
- Thêm địa chỉ đầu tiên → tự set isDefault
- Set default địa chỉ mới → địa chỉ cũ isDefault = false
- Xóa địa chỉ default → 422

---

---

# TASK T-08
## Categories & Products Module

> **Mục tiêu:** Catalog hoàn chỉnh với Redis caching, full-text search, Flash Sale fields, variant management.

**Phụ thuộc:** T-06, T-04

---

### 8.1 Categories Module

- [ ] `src/modules/categories/categories.repository.ts`:
  - `findAll(filter)`: tất cả categories
  - `findBySlug(slug)`: theo slug
  - `findById(id)`: theo id
  - `findByIds(ids)`: bulk lookup
  - `create(data)`: tạo mới
  - `update(id, data)`: cập nhật
  - `delete(id)`: xóa

- [ ] `src/modules/categories/categories.service.ts`:
  - `getCategoryTree()`:
    - Check cache `categories:tree`
    - Query all active categories
    - Build tree trong memory (2 cấp)
    - Set cache (TTL: 60 phút)
    - Return tree
  - `getCategoryBySlug(slug)`:
    - Check cache `category:{slug}`
    - Query + populate parent
    - Set cache (TTL: 60 phút)
  - `create(dto)`: generate slug, validate parentId, create, invalidate cache
  - `update(id, dto)`: update, validate circular dependency nếu đổi parentId, invalidate cache
  - `delete(id)`:
    - Check có product active → `CATEGORY_HAS_PRODUCTS`
    - Check có children → `CATEGORY_HAS_CHILDREN`
    - Delete, invalidate cache

- [ ] Public controller: `GET /categories`, `GET /categories/:slug`
- [ ] Admin controller: `GET/POST/PATCH/DELETE /admin/categories`
- [ ] DTOs: `CreateCategoryDto`, `UpdateCategoryDto`

---

### 8.2 Products Module — Repository

- [ ] `src/modules/products/products.repository.ts`:
  - `findBySlug(slug, filter?)`: query + populate categories + variants
  - `findById(id)`: by MongoDB ObjectId
  - `findMany(filter, sort, pagination)`: paginated list
  - `findByIds(ids)`: bulk lookup
  - `findFlashSale()`: `{ isFlashSale: true, flashSaleEndAt: { $gt: now } }`
  - `findFeatured(limit)`: `{ isFeatured: true, isActive: true }`
  - `findBestSellers(limit)`: sort by soldCount
  - `findNewest(limit)`: sort by createdAt
  - `findRelated(productId, categoryIds, limit)`: cùng category, trừ product hiện tại
  - `create(data)`: tạo product
  - `update(id, data)`: cập nhật
  - `softDelete(id)`: set isActive = false
  - `decrementStock(id, variantId, qty, session?)`: `$inc: { stock: -qty }` trong transaction
  - `incrementStock(id, variantId, qty)`: restock khi hủy order
  - `updateStats(id, stats)`: cập nhật soldCount, viewCount, averageRating, reviewCount

---

### 8.3 Products Module — Service

- [ ] `src/modules/products/products.service.ts`:

  **Public methods:**
  - `findMany(queryDto)`:
    - Build filter từ query params (category, brand, price range, rating, inStock)
    - Normalize query → MD5 → cache key
    - Check cache → hit: return; miss: query + set cache (5 phút)
  - `findBySlug(slug)`:
    - Check cache `product:{slug}`
    - Miss: query, enqueue view tracking async
    - Set cache (10 phút)
    - Throw `PRODUCT_NOT_FOUND` nếu không tìm thấy hoặc `isActive = false`
  - `findFlashSale()`: check cache `products:flash-sale` (TTL: 1 phút)
  - `findFeatured(limit)`: check cache `products:featured` (TTL: 30 phút)
  - `findBestSellers(limit)`: check cache `products:best-sellers` (TTL: 30 phút)
  - `findRelated(productId, limit)`: không cần cache (ít call)
  - `trackView(productId, sessionId?)`: enqueue analytics job

  **Admin methods:**
  - `create(dto)`:
    - Validate categories tồn tại
    - Generate unique slug
    - Create product
    - Create variants nếu có
    - Invalidate list caches
    - Ghi AuditLog
  - `update(id, dto)`:
    - Validate flash sale fields (price < original price, stock <= total stock, endAt trong tương lai)
    - Update
    - Nếu flash sale được bật: init Redis stock counter, schedule BullMQ end job, broadcast socket
    - Invalidate specific cache + list caches
    - Ghi AuditLog
  - `delete(id)`: soft delete, invalidate cache, audit
  - `toggleActive(id)`: flip isActive, audit
  - Variant CRUD: `addVariant`, `updateVariant`, `deleteVariant`

---

### 8.4 Products Controller

- [ ] `src/modules/products/products.controller.ts` (public):
  - `GET /products` với `QueryProductDto` (page, limit, category, brand, minPrice, maxPrice, minRating, inStock, search, sort)
  - `GET /products/flash-sale`
  - `GET /products/featured`
  - `GET /products/best-sellers`
  - `GET /products/newest`
  - `GET /products/:slug`
  - `GET /products/:id/related`
  - `POST /products/:id/view`

- [ ] `src/modules/products/products.admin.controller.ts`:
  - `GET /admin/products` — paginated với filter
  - `GET /admin/products/:id`
  - `POST /admin/products`
  - `PATCH /admin/products/:id`
  - `DELETE /admin/products/:id`
  - `PATCH /admin/products/:id/toggle-active`
  - `POST /admin/products/:id/variants`
  - `PATCH /admin/products/:id/variants/:variantId`
  - `DELETE /admin/products/:id/variants/:variantId`

---

### 8.5 DTOs

- [ ] `CreateProductDto` — đầy đủ fields với validation
- [ ] `UpdateProductDto` — PartialType của CreateProductDto
- [ ] `QueryProductDto` — extends PaginationDto
- [ ] `CreateVariantDto`, `UpdateVariantDto`
- [ ] Thêm `@ApiProperty` với examples cho tất cả

---

**✅ Definition of Done T-08:**
- `GET /products?category=ao&sort=best_selling` → paginated response đúng
- Cache hit: request thứ 2 nhanh hơn rõ rệt, log thấy `[Cache] HIT`
- Create product → slug được generate, cache invalidated
- `GET /products/:slug` với slug không tồn tại → 404 đúng format
- Flash sale fields validate đúng (giá phải rẻ hơn giá gốc)
- Variant CRUD hoạt động

---

---

# TASK T-09
## Wishlist & Cart Module

> **Mục tiêu:** Wishlist đồng bộ DB, Cart với embedded items, price snapshot, stock validation realtime khi xem giỏ.

**Phụ thuộc:** T-08

---

### 9.1 Wishlist Module

- [ ] `src/modules/wishlist/wishlist.service.ts`:
  - `getWishlist(userId, pagination)`: paginated, populate product info
  - `addToWishlist(userId, productId)`:
    - Validate product tồn tại và active
    - `findOrCreate` wishlist document
    - Nếu productId đã có → idempotent, không báo lỗi
    - Push vào items[]
  - `removeFromWishlist(userId, productId)`: pull productId khỏi items
  - `checkWishlisted(userId, productId)`: `{ isWishlisted: boolean }`

- [ ] `src/modules/wishlist/wishlist.controller.ts`:
  - `GET /wishlist`
  - `POST /wishlist/:productId`
  - `DELETE /wishlist/:productId`
  - `GET /wishlist/check/:productId`

---

### 9.2 Cart Module

- [ ] `src/modules/cart/cart.repository.ts`:
  - `findByUserId(userId)`: lấy cart
  - `findOrCreate(userId)`: tìm hoặc tạo cart mới
  - `save(cart)`: lưu cart document
  - `clear(userId, session?)`: xóa toàn bộ items

- [ ] `src/modules/cart/cart.service.ts`:
  - `getCart(userId)`:
    - `findOrCreate` cart
    - Fetch current product info cho tất cả items (batch query)
    - Enrich từng item:
      - `isUnavailable`: product không tồn tại hoặc isActive = false
      - `isQuantityExceeded`: quantity > currentStock
      - `currentPrice`: giá hiện tại (có thể khác snapshot)
      - `isPriceChanged`: giá thay đổi so với snapshot
      - `maxQuantity`: tồn kho hiện tại
    - Tính `summary`: subtotal, shippingFee, total, canCheckout
    - Return enriched cart

  - `addItem(userId, dto)`:
    - Validate product, variant (nếu có)
    - Kiểm tra `product.isActive`, stock
    - `findOrCreate` cart
    - Kiểm tra item đã tồn tại chưa (theo productId + variantId)
    - Nếu đã có: merge quantity, check `newQty > stock`
    - Nếu chưa có: push item với price snapshot
    - Kiểm tra `items.length >= 50` → `CART_MAX_ITEMS_EXCEEDED`
    - Tính lại summary
    - Save cart

  - `updateItem(userId, itemId, quantity)`:
    - Tìm item trong cart của user (kiểm tra ownership)
    - `quantity = 0` → remove item
    - `quantity > 0` → validate stock, update
    - Save

  - `removeItem(userId, itemId)`: remove item, save

  - `clearCart(userId)`: xóa toàn bộ items

  - `calculateSummary(items)`:
    - subtotal = sum(price × qty) — chỉ items không isUnavailable
    - shippingFee = subtotal >= 500000 ? 0 : 30000
    - total = subtotal + shippingFee
    - canCheckout = !items.some(i => i.isUnavailable)

- [ ] `src/modules/cart/cart.controller.ts`:
  - `GET /cart`
  - `POST /cart`
  - `PATCH /cart/:itemId`
  - `DELETE /cart/:itemId`
  - `DELETE /cart`

---

**✅ Definition of Done T-09:**
- Add item → cart có item với price snapshot
- Add cùng item lần 2 → quantity cộng lại, không tạo item mới
- Add > stock → 422 với message rõ ràng
- `GET /cart` khi product bị deactive → item có `isUnavailable: true`
- `GET /cart` khi stock giảm → `isQuantityExceeded: true`, `maxQuantity` đúng
- `PATCH /cart/:itemId` với quantity = 0 → item bị xóa

---

---

# TASK T-10
## Coupons Module

> **Mục tiêu:** Validate và apply coupon với business rules đầy đủ, atomic usage counter.

**Phụ thuộc:** T-08

---

### 10.1 Coupons Repository

- [ ] `src/modules/coupons/coupons.repository.ts`:
  - `findByCode(code)`: tìm coupon (uppercase code)
  - `findById(id)`: by id
  - `findMany(filter, pagination)`: admin listing
  - `create(data)`: tạo mới
  - `update(id, data)`: cập nhật
  - `delete(id)`: xóa
  - `atomicIncrementUsed(couponId, session?)`: increment usedCount atomic, chỉ khi usedCount < usageLimit
  - `decrementUsed(couponId)`: hoàn lại khi hủy order

- [ ] `src/modules/coupons/coupon-usage.repository.ts`:
  - `create(data)`: ghi lại lượt dùng
  - `countByUserAndCoupon(userId, couponId)`: đếm lượt user đã dùng
  - `deleteByOrder(orderId)`: hoàn lại khi hủy order

---

### 10.2 Coupons Service

- [ ] `validateCoupon(code, userId, subtotal, cartItems?)`:
  1. Tìm coupon theo code (uppercase)
  2. Check `isActive`
  3. Check thời gian: `now < startDate` → NOT_STARTED, `now > endDate` → EXPIRED
  4. Check `usageLimit > 0 && usedCount >= usageLimit` → LIMIT_REACHED
  5. Check per-user limit: `couponUsageRepo.countByUserAndCoupon(userId, couponId) >= usagePerUser`
  6. Check `subtotal >= minOrderAmount`
  7. Check applicable products/categories (nếu có restriction)
  8. Tính `discountAmount`:
     - PERCENT: `min(subtotal × value/100, maxDiscountAmount || Infinity)`
     - FIXED_AMOUNT: `min(value, subtotal)`
     - FREE_SHIPPING: 0 (shippingFee về 0)
  9. Return `{ coupon, discountAmount, isValid: true }`

- [ ] `applyCoupon(couponId, userId, orderId, discountAmount, session)`:
  - `atomicIncrementUsed(couponId, session)` — trong transaction của order
  - `couponUsageRepo.create({ couponId, userId, orderId, discountAmount })`

- [ ] `revertCoupon(orderId)`:
  - Tìm CouponUsage by orderId
  - `decrementUsed(couponId)`
  - `deleteByOrder(orderId)`

- [ ] Admin CRUD service methods

---

### 10.3 Controller

- [ ] `POST /coupons/validate` — JWT required, body: `{ code, subtotal }`
- [ ] Admin controller: `GET/GET:id/POST/PATCH/DELETE /admin/coupons`

---

**✅ Definition of Done T-10:**
- `POST /coupons/validate` với code hợp lệ → trả về discountAmount đúng
- Code hết hạn → 422 `COUPON_EXPIRED`
- Subtotal < minOrderAmount → 422 với message nêu rõ số tiền
- User đã dùng hết lượt → 422 `COUPON_USER_LIMIT_REACHED`
- Coupon FREE_SHIPPING → discountAmount = shippingFee

---

---

# TASK T-11
## Orders Module

> **Mục tiêu:** Toàn bộ order lifecycle: tạo đơn trong MongoDB transaction, status machine, hủy đơn, xác nhận nhận hàng. BullMQ jobs cho email và notifications.

**Phụ thuộc:** T-09, T-10

---

### 11.1 Orders Repository

- [ ] `src/modules/orders/orders.repository.ts`:
  - `create(data, session)`: tạo order trong transaction
  - `findById(id)`: by id, populate items
  - `findByIdAndUser(id, userId)`: kiểm tra ownership
  - `findManyByUser(userId, filter, pagination)`: lịch sử user
  - `findMany(filter, sort, pagination)`: admin listing
  - `updateStatus(id, status, updatedBy, note, session?)`: push vào statusHistory
  - `count(filter)`: đếm để build stats

- [ ] `src/modules/orders/order-items.repository.ts`:
  - `createMany(items, session)`: bulk insert
  - `findByOrderId(orderId)`: items của order
  - `markReviewed(itemId, reviewId)`: đánh dấu đã review

---

### 11.2 Orders Service

- [ ] **`create(userId, dto)`** — đây là method phức tạp nhất:
  1. Lấy cart, validate không rỗng, không có unavailable items
  2. Validate addressId tồn tại và thuộc userId
  3. Validate + tính coupon (nếu có) qua `couponService.validateCoupon()`
  4. Validate stock từng item (đọc product từ DB với session)
  5. Tính `subtotal`, `shippingFee`, `discountAmount`, `totalAmount`
  6. Trong **MongoDB Transaction**:
     - Decrement stock từng item (theo thứ tự productId tăng dần — tránh deadlock)
     - Generate orderCode (Redis INCR)
     - Create Order document
     - Create OrderItems (snapshot product info)
     - Apply coupon nếu có (`couponService.applyCoupon()`)
     - Clear cart
  7. **Sau transaction** (không trong transaction):
     - Enqueue `email.send-order-confirmation`
     - Enqueue `notification.create-notification`
     - Emit socket `order:new` tới admin room
  8. Return created order

- [ ] **`updateStatus(orderId, dto, adminId)`**:
  - Validate state machine transition (dùng `VALID_TRANSITIONS` map)
  - Xử lý side-effects theo status mới:
    - `confirmed`: enqueue email + notification
    - `cancelled`: restock + revert coupon + enqueue email + notification
    - `delivered`: set deliveredAt + paymentStatus=paid + enqueue job update soldCount
    - `returned`: restock + enqueue email + notification
  - Update order status
  - Emit socket `order:status-updated` tới `user:{userId}` room
  - Ghi AuditLog

- [ ] **`cancelByUser(userId, orderId, reason?)`**:
  - Verify ownership
  - Check `status !== 'pending'` → `ORDER_CANNOT_CANCEL`
  - Gọi `updateStatus` logic (restock, revert coupon, notifications)

- [ ] **`confirmReceived(userId, orderId)`**:
  - Verify ownership
  - Check `status !== 'shipping'` → `ORDER_CANNOT_CONFIRM_RECEIVED`
  - Gọi `updateStatus` với status `delivered`

- [ ] **`getOrders(userId, queryDto)`**: paginated list
- [ ] **`getOrderById(userId, orderId)`**: chi tiết, kiểm tra ownership

---

### 11.3 BullMQ Jobs liên quan

- [ ] `src/modules/orders/processors/order.processor.ts`:
  - Job `update-product-sold-count`: delay 5s sau delivered, cập nhật soldCount cho từng item
  - Job `auto-cancel-pending-orders` (CRON `0 2 * * *`): hủy orders pending > 48h

---

### 11.4 Orders Controllers

- [ ] `src/modules/orders/orders.controller.ts`:
  - `GET /orders` — query: page, limit, status
  - `GET /orders/:id`
  - `POST /orders`
  - `POST /orders/:id/cancel`
  - `POST /orders/:id/confirm-received`

- [ ] `src/modules/orders/orders.admin.controller.ts`:
  - `GET /admin/orders` — với đầy đủ filters
  - `GET /admin/orders/:id`
  - `PATCH /admin/orders/:id/status`
  - `PATCH /admin/orders/bulk-status`
  - `GET /admin/orders/export` — trả về CSV stream

---

### 11.5 Order Export (CSV)

- [ ] `exportOrders(filter)`: query orders với filter
- [ ] Format CSV với headers tiếng Anh
- [ ] Stream response với `Content-Type: text/csv; charset=utf-8` và `Content-Disposition: attachment; filename=orders-YYYYMMDD.csv`

---

**✅ Definition of Done T-11:**
- Tạo order → transaction thành công, cart bị clear, stock bị trừ, email enqueue
- Tạo order khi stock vừa hết (2 user đồng thời) → 1 thành công, 1 nhận 409
- Cancel order pending → stock được hoàn, coupon được revert
- Cancel order confirmed → 422 `ORDER_CANNOT_CANCEL`
- Admin update status invalid transition → 422 với message rõ ràng
- `GET /admin/orders/export` → file CSV download được
- CRON job auto-cancel chạy → log thấy cancelled orders

---

---

# TASK T-12
## Reviews Module

> **Mục tiêu:** Review system với điều kiện nghiêm ngặt (chỉ sau delivered), admin moderation, tự động cập nhật rating sản phẩm.

**Phụ thuộc:** T-11

---

### 12.1 Reviews Repository

- [ ] `src/modules/reviews/reviews.repository.ts`:
  - `findByProductId(productId, filter, pagination)`: public listing (chỉ approved + không hidden)
  - `findByProductIdAdmin(productId, filter, pagination)`: admin listing (tất cả)
  - `findMany(filter, pagination)`: admin listing tổng
  - `findById(id)`: by id
  - `findByOrderItemId(orderItemId)`: check đã review chưa
  - `create(data)`: tạo mới
  - `update(id, data)`: cập nhật (approve/hide)
  - `delete(id)`: xóa
  - `getRatingSummary(productId)`: aggregate avg + count + distribution
  - `recalculateProductRating(productId)`: aggregate và update product stats

---

### 12.2 Reviews Service

- [ ] `createReview(userId, dto)`:
  1. Tìm `orderItem` by `dto.orderItemId`, không tồn tại → `REVIEW_ORDER_ITEM_NOT_FOUND`
  2. Kiểm tra orderItem.orderId → lấy order, check `order.userId === userId` → 403
  3. Kiểm tra `order.status === 'delivered'` → `REVIEW_ORDER_NOT_DELIVERED`
  4. Kiểm tra `orderItem.isReviewed === true` → `REVIEW_ALREADY_SUBMITTED`
  5. (Optional) Kiểm tra `order.deliveredAt + 90 ngày > now` → `REVIEW_PERIOD_EXPIRED`
  6. Tạo review với `isApproved: false`
  7. Update `orderItem.isReviewed = true`, `orderItem.reviewId = review._id`
  8. Enqueue notification tới admin
  9. Return review

- [ ] `getProductReviews(productId, queryDto)`:
  - Filter: only `isApproved: true, isHidden: false`
  - Query reviews + tính rating summary
  - Nếu user đang login: mark `isMyReview`, `isHelpful`

- [ ] `voteHelpful(userId, reviewId)`:
  - Nếu userId đã trong `helpfulVoters` → remove (toggle off)
  - Nếu chưa → push, increment `helpfulCount`
  - Return `{ helpfulCount, isHelpful }`

- [ ] **Admin methods:**
  - `approveReview(id)`:
    - Set `isApproved = true`
    - Gọi `recalculateProductRating(productId)` → update product.averageRating, reviewCount
    - Invalidate cache product
    - Enqueue notification cho user: "Đánh giá của bạn đã được duyệt"
    - Ghi AuditLog
  - `hideReview(id, note)`: set `isHidden = true`, `adminNote`, recalculate rating, audit
  - `unhideReview(id)`: set `isHidden = false`, recalculate, audit
  - `deleteReview(id)`: xóa cứng, recalculate, audit

---

### 12.3 Controllers

- [ ] `src/modules/reviews/reviews.controller.ts`:
  - `GET /reviews/product/:productId`
  - `POST /reviews`
  - `POST /reviews/:id/helpful`

- [ ] `src/modules/reviews/reviews.admin.controller.ts`:
  - `GET /admin/reviews`
  - `PATCH /admin/reviews/:id/approve`
  - `PATCH /admin/reviews/:id/hide`
  - `PATCH /admin/reviews/:id/unhide`
  - `DELETE /admin/reviews/:id`

---

**✅ Definition of Done T-12:**
- Review khi order chưa delivered → 422
- Review lần 2 cùng orderItem → 409 `REVIEW_ALREADY_SUBMITTED`
- Tạo review thành công → `isApproved: false`, không hiển thị công khai
- Admin approve → xuất hiện trên public GET /reviews, product.averageRating được cập nhật
- Admin hide → không hiển thị công khai nhưng không xóa DB
- Vote helpful toggle: lần 1 = +1, lần 2 = -1

---

---

# TASK T-13
## Banners, Notifications & Socket.IO

> **Mục tiêu:** Banner management, notification system với BullMQ queue, Socket.IO gateway cho realtime updates.

**Phụ thuộc:** T-06 (cần auth cho socket)

---

### 13.1 Banners Module

- [ ] `src/modules/banners/banners.service.ts`:
  - `getActiveBanners(type?)`: filter active, trong thời gian hiển thị (`startAt <= now <= endAt` hoặc null), sort by order
  - Check cache `banners:active` (TTL: 30 phút)
  - Admin CRUD methods với cache invalidation sau mỗi mutation
  - `reorder(orderedIds)`: bulkWrite update order field

- [ ] `src/modules/banners/banners.controller.ts`: `GET /banners`
- [ ] `src/modules/banners/banners.admin.controller.ts`:
  - `GET/POST/PATCH/DELETE /admin/banners`
  - `PATCH /admin/banners/reorder`

---

### 13.2 Notifications Module

- [ ] `src/modules/notifications/notifications.repository.ts`:
  - `findByUserId(userId, filter, pagination)`
  - `countUnread(userId)`
  - `create(data)`
  - `markRead(id, userId)`: update isRead, check ownership
  - `markAllRead(userId)`: updateMany
  - `delete(id, userId)`: check ownership, xóa

- [ ] `src/modules/notifications/notifications.service.ts`:
  - `getNotifications(userId, queryDto)`:
    - Paginated list
    - Include `unreadCount` trong response
  - `markRead(userId, id)`
  - `markAllRead(userId)`
  - `delete(userId, id)`
  - `createNotification(data)`: tạo DB record + emit socket

- [ ] `src/modules/notifications/notifications.processor.ts`:
  - Job `create-notification`: tạo record → `notificationsService.createNotification()`
  - Job `create-bulk-notifications`: loop qua userIds, tạo từng notification

- [ ] `src/modules/notifications/notifications.controller.ts`:
  - `GET /notifications`
  - `PATCH /notifications/:id/read`
  - `PATCH /notifications/read-all`
  - `DELETE /notifications/:id`

---

### 13.3 Socket.IO Gateway

- [ ] `src/modules/notifications/notifications.gateway.ts`:

  ```typescript
  @WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL } })
  export class NotificationsGateway {
    @WebSocketServer() server: Server;
    
    // Auth khi kết nối
    async handleConnection(socket: Socket): Promise<void> {
      try {
        const token = socket.handshake.auth.token;
        const payload = this.jwtService.verify(token);
        const user = await this.usersService.findById(payload.sub);
        if (!user || user.status !== 'active') {
          socket.disconnect(); return;
        }
        socket['userId'] = user.id;
        await socket.join(`user:${user.id}`);
        if (['admin', 'super_admin', 'moderator'].includes(user.role)) {
          await socket.join('admin');
        }
      } catch {
        socket.disconnect();
      }
    }
    
    // Emit methods (gọi từ các services khác)
    emitToUser(userId: string, event: string, data: any): void
    emitToAdmin(event: string, data: any): void
    broadcast(event: string, data: any): void
  }
  ```

- [ ] Inject `NotificationsGateway` vào `NotificationsService` để emit sau khi tạo notification
- [ ] Inject vào `OrdersService` để emit `order:status-updated` và `order:new`
- [ ] Inject vào `ProductsService` để emit `flash-sale:started`, `flash-sale:ended`, `flash-sale:stock-update`

---

**✅ Definition of Done T-13:**
- `GET /banners` → chỉ trả về banners active trong thời gian hiển thị
- Admin reorder banners → thứ tự thay đổi đúng
- Khi order status được update → user nhận notification qua socket (test với wscat/Postman)
- Socket disconnect nếu token không hợp lệ
- Notification DB được tạo khi processor xử lý job

---

---

# TASK T-14
## Dashboard Module

> **Mục tiêu:** Admin dashboard với stats cards, revenue charts, best sellers, các số liệu phân tích bằng MongoDB aggregation pipelines.

**Phụ thuộc:** T-11, T-12

---

### 14.1 Dashboard Service

- [ ] `src/modules/dashboard/dashboard.service.ts`:

  **`getStats()`** — cache `dashboard:stats` (TTL: 5 phút):
  - Revenue: today, thisMonth, lastMonth, growthPercent
  - Orders: total + count theo từng status
  - Users: total, active, locked, newThisMonth, newLastMonth
  - Products: total, active, outOfStock, flashSale, featured

  **`getRevenueByDay(year, month)`** — cache `dashboard:revenue:day:{year}-{month}` (TTL: 1 giờ):
  ```typescript
  db.orders.aggregate([
    { $match: { status: 'delivered', createdAt: { $gte: startDate, $lt: endDate } } },
    { $group: { _id: { $dayOfMonth: '$createdAt' }, revenue: { $sum: '$totalAmount' }, orderCount: { $sum: 1 } } },
    { $sort: { '_id': 1 } }
  ])
  ```
  - Fill missing days với revenue = 0

  **`getRevenueByMonth(year)`** — cache `dashboard:revenue:month:{year}` (TTL: 6 giờ):
  - Tương tự nhưng group by month

  **`getOrderStats(startDate, endDate)`** — không cache:
  - Aggregate orders theo status trong khoảng thời gian
  - Tính completionRate, cancellationRate

  **`getBestSellers(limit, period)`** — cache `dashboard:best-sellers:{period}` (TTL: 30 phút):
  ```typescript
  db.order_items.aggregate([
    { $lookup: { from: 'orders', localField: 'orderId', ... } },
    { $unwind: '$order' },
    { $match: { 'order.status': 'delivered', 'order.createdAt': { $gte: periodStart } } },
    { $group: { _id: '$productId', totalSold: { $sum: '$quantity' }, revenue: { $sum: '$totalPrice' }, ... } },
    { $sort: { totalSold: -1 } },
    { $limit: limit }
  ])
  ```

  **`getRecentUsers(limit)`** — không cache:
  - Lấy users mới nhất với orderCount

  **`getPendingReviews(limit)`** — không cache:
  - Reviews chưa approved

---

### 14.2 Dashboard Controller

- [ ] `src/modules/dashboard/dashboard.controller.ts`:
  - `GET /admin/dashboard/stats`
  - `GET /admin/dashboard/revenue?period=day|month&year=2025&month=12`
  - `GET /admin/dashboard/orders/stats?startDate=...&endDate=...`
  - `GET /admin/dashboard/products/best-sellers?limit=10&period=30d`
  - `GET /admin/dashboard/users/recent?limit=10`
  - `GET /admin/dashboard/reviews/pending?limit=10`
  - Tất cả cần role ADMIN+, riêng `reviews/pending` cần MODERATOR+

---

**✅ Definition of Done T-14:**
- `GET /admin/dashboard/stats` → numbers chính xác, khớp với data trong DB
- Revenue by day: điền đủ tất cả ngày trong tháng (ngày không có đơn = 0)
- Best sellers đúng với khoảng thời gian
- Cache hoạt động: request thứ 2 nhanh hơn đáng kể

---

---

# TASK T-15
## Testing, Security Hardening & Documentation

> **Mục tiêu:** Unit tests đạt coverage ≥ 80%, Integration tests cho critical flows, Security audit, Swagger hoàn chỉnh.

**Phụ thuộc:** T-01 → T-14

---

### 15.1 Unit Tests (Jest)

Viết unit tests cho **Service layer** của từng module (mock Repository + Cache):

- [ ] `auth.service.spec.ts`:
  - `register()`: happy path, duplicate email, hash password
  - `login()`: success, invalid credentials, locked account, not verified
  - `refresh()`: success, revoked token, expired token, reuse attack
  - `resetPassword()`: success, expired OTP, already used OTP

- [ ] `products.service.spec.ts`:
  - `findBySlug()`: cache hit, cache miss, not found
  - `create()`: happy path, invalid categories, slug generation
  - `update()`: flash sale validation (price, stock, endAt)

- [ ] `cart.service.spec.ts`:
  - `addItem()`: new item, merge existing, exceeds stock, max items
  - `getCart()`: enrich items (unavailable, exceeded, price changed)
  - `updateItem()`: quantity = 0 removes item

- [ ] `orders.service.spec.ts`:
  - `create()`: happy path, empty cart, insufficient stock, coupon apply
  - `updateStatus()`: valid transitions, invalid transition throws
  - `cancelByUser()`: success, wrong status

- [ ] `coupons.service.spec.ts`:
  - `validateCoupon()`: all 8 validation steps
  - `calculateDiscount()`: PERCENT, FIXED_AMOUNT, FREE_SHIPPING, cap maxDiscount

- [ ] `reviews.service.spec.ts`:
  - `createReview()`: success, not delivered, already reviewed
  - `approveReview()`: updates product rating

**Coverage target: ≥ 80% lines + branches cho mỗi service**

---

### 15.2 Integration Tests (mongodb-memory-server)

- [ ] `test/setup.ts`:
  - `setupTestDatabase()`: khởi động MongoMemoryServer, kết nối Mongoose
  - `teardownTestDatabase()`: dừng server
  - `clearDatabase()`: xóa toàn bộ collections sau mỗi test suite

- [ ] `test/fixtures/`: factory functions cho test data
  - `buildUserFixture(overrides?)`: user với default values
  - `buildProductFixture(overrides?)`: product
  - `buildOrderFixture(overrides?)`: order với items

- [ ] `auth.e2e-spec.ts`:
  - Register → verify email → login → refresh → logout flow
  - Forgot password → reset password flow
  - Rate limiting test

- [ ] `orders.e2e-spec.ts`:
  - Full order flow: add to cart → apply coupon → create order → admin confirm → admin ship → user confirm received
  - Cancel flow: create order → cancel → verify stock restored
  - Concurrent order test (2 users đặt cùng sản phẩm stock=1)

- [ ] `products.e2e-spec.ts`:
  - CRUD product
  - Search và filter

---

### 15.3 Security Hardening

- [ ] **Rate Limiting:** kiểm tra và điều chỉnh limits cho từng endpoint nhạy cảm:
  - `/auth/login`: 5 req/phút/IP
  - `/auth/register`: 3 req/phút/IP
  - `/auth/forgot-password`: 3 req/phút
  - `/auth/resend-verify-email`: 2 req/phút
  - `/upload/image`: 20 req/phút
  - Public APIs: 100 req/phút

- [ ] **Input Sanitization:**
  - Product description HTML: dùng `sanitize-html` với allowlist tags
  - Trim tất cả string inputs (TrimPipe đã tạo ở T-03)
  - Reject thêm SQL injection patterns (class-validator đủ với `@IsString`)

- [ ] **Security Headers** (đã có Helmet, verify các settings):
  - X-Content-Type-Options: nosniff ✓
  - X-Frame-Options: DENY ✓
  - X-XSS-Protection ✓
  - Strict-Transport-Security (production) ✓

- [ ] **Sensitive Data:**
  - Audit tất cả endpoints, đảm bảo không trả về password field
  - Đảm bảo log không chứa tokens, passwords
  - Verify `@Exclude()` trên password field hoặc `select: false` trên schema

- [ ] **MongoDB Security:**
  - Không cho phép `$where` operator trong user inputs
  - Dùng `mongoose-sanitize` hoặc validate ObjectId trước khi query
  - Đảm bảo không có NoSQL injection qua unvalidated inputs

- [ ] **CORS:**
  - Chỉ allow `FRONTEND_URL` origin
  - Không dùng wildcard `*`
  - Verify credentials + methods settings

---

### 15.4 Swagger Documentation hoàn chỉnh

- [ ] Mỗi controller endpoint có:
  - `@ApiOperation({ summary: '...' })`
  - `@ApiResponse({ status: 200, description: '...', type: ... })` cho success
  - `@ApiResponse({ status: 4xx, description: '...' })` cho mỗi error case
  - `@ApiTags('...')` trên controller class

- [ ] Mỗi DTO field có:
  - `@ApiProperty({ description, example, required })` hoặc `@ApiPropertyOptional`

- [ ] Auth: `@ApiBearerAuth()` trên protected controllers

- [ ] Verify Swagger UI tại `/api/docs` hiển thị đúng, có thể test thực tế từ UI

---

### 15.5 Final Checklist

- [ ] `npm run test:cov` → coverage report, mỗi service ≥ 80%
- [ ] `npm run test:e2e` → tất cả critical flows pass
- [ ] `npm run lint` → 0 errors, 0 warnings
- [ ] `npm run type-check` → 0 TypeScript errors
- [ ] `npm run build` → build thành công, không có lỗi compile
- [ ] Tất cả environment variables có trong `.env.example` với comments giải thích
- [ ] `README.md` cho backend: setup instructions, how to run, how to test, seed data info
- [ ] Kiểm tra tất cả `TODO` và `FIXME` comments trong code → resolve hoặc ticket
- [ ] Review lại tất cả error messages: tiếng Việt, rõ ràng, không expose internal details
- [ ] Kiểm tra tất cả admin endpoints có `@Audit` decorator
- [ ] Kiểm tra tất cả destructive admin actions có AuditLog

---

**✅ Definition of Done T-15:**
- `npm run test:cov` → tất cả services ≥ 80% coverage
- `npm run test:e2e` → 100% critical flow tests pass
- `npm run lint` và `npm run type-check` → 0 errors
- Swagger UI có thể dùng để test toàn bộ API không cần Postman
- Security: không thể inject qua query params, không leak password/token trong response

---

---

## Tổng kết

### Thứ tự triển khai tối ưu cho team nhỏ

```
Tuần 1:  T-01 → T-02 → T-03 (nền tảng)
Tuần 2:  T-04 → T-05 → T-06 (upload + email + auth — core)
Tuần 3:  T-07 → T-08 (users + catalog — cần thiết để test tiếp)
Tuần 4:  T-09 → T-10 → T-11 (shopping flow hoàn chỉnh)
Tuần 5:  T-12 → T-13 → T-14 (reviews + realtime + analytics)
Tuần 6:  T-15 (testing + security + docs)
```

### Quy tắc khi làm việc

```
Trước khi bắt đầu task:
  ☐ Đọc lại API contract của module đó trong api-specification.md
  ☐ Đọc data flow và edge cases trong backend-implementation-blueprint.md
  ☐ Tạo branch mới: feature/task-T-XX-module-name

Khi code:
  ☐ Service không import Model trực tiếp — chỉ qua Repository
  ☐ Mọi lỗi business logic dùng BusinessException với error code từ constants
  ☐ Mọi side-effect (email, notification) đi qua BullMQ, không gọi trực tiếp
  ☐ Cache invalidate trong cùng service method với mutation
  ☐ Admin endpoints: @Audit decorator + AuditLog

Trước khi merge:
  ☐ Tất cả checklist trong Definition of Done đã pass
  ☐ Unit tests viết và pass
  ☐ Không có TypeScript errors, không có lint warnings
  ☐ Swagger docs cập nhật cho endpoints mới
```