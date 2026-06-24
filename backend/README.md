# E-Commerce Backend API

Backend REST API cho hệ thống thương mại điện tử, xây dựng bằng **NestJS 11** + **MongoDB** + **Redis** + **BullMQ**.

---

## Công nghệ sử dụng

| Lớp | Công nghệ |
|---|---|
| Framework | NestJS 11, TypeScript 5.7 |
| Database | MongoDB 7 (Mongoose 9) |
| Cache / Session | Redis (ioredis) + cache-manager |
| Queue | BullMQ 5 |
| Auth | JWT (access 15m + refresh 7d), Passport |
| Email | Nodemailer + Handlebars templates |
| Upload | Cloudinary |
| Docs | Swagger / OpenAPI |
| Security | Helmet, CORS, Throttler, sanitize-html |
| Logging | Winston |
| Test | Jest 30, Supertest, MongoMemoryReplSet |
| Runtime | Node.js 22, pnpm |

---

## Các module

| Module | Chức năng |
|---|---|
| **Auth** | Đăng ký, đăng nhập, refresh token, OTP email, đổi mật khẩu |
| **Users** | Quản lý tài khoản người dùng |
| **Addresses** | Sổ địa chỉ giao hàng |
| **Categories** | Danh mục sản phẩm (cây phân cấp) |
| **Products** | CRUD sản phẩm, biến thể, flash sale, tìm kiếm |
| **Cart** | Giỏ hàng (thêm, cập nhật, xóa) |
| **Orders** | Đặt hàng, theo dõi trạng thái, hủy đơn |
| **Coupons** | Mã giảm giá (theo phần trăm / cố định, giới hạn số lần dùng) |
| **Reviews** | Đánh giá sản phẩm, vote helpful, duyệt review |
| **Wishlist** | Danh sách yêu thích |
| **Banners** | Banner quảng cáo |
| **Notifications** | Thông báo real-time (WebSocket / BullMQ) |
| **Dashboard** | Thống kê doanh thu, đơn hàng (Admin) |
| **Upload** | Upload ảnh lên Cloudinary |
| **Audit Logs** | Ghi lịch sử thao tác Admin |
| **Health** | Health check endpoint |

---

## Yêu cầu môi trường

- Node.js >= 22
- pnpm >= 9
- MongoDB >= 7 (replica set — bắt buộc cho transaction)
- Redis >= 7

---

## Cài đặt

```bash
# Clone repo và vào thư mục backend
cd backend

# Cài dependencies
pnpm install

# Tạo file .env từ template
cp .env.example .env
```

Sau đó chỉnh sửa `.env` theo hướng dẫn bên dưới.

---

## Biến môi trường

```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# JWT
JWT_ACCESS_SECRET=your-access-secret-change-in-production
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production
JWT_REFRESH_EXPIRES=7d

# MongoDB (replica set URI bắt buộc nếu dùng transaction)
MONGODB_URI=mongodb://admin:password@localhost:27017/ecommerce

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=no-reply@yourdomain.com

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

---

## Chạy ứng dụng

```bash
# Development (hot reload)
pnpm run start:dev

# Production build rồi chạy
pnpm run build
pnpm run start:prod
```

Server mặc định chạy tại `http://localhost:3001`.  
Swagger UI tại `http://localhost:3001/api/docs`.

---

## Docker

Build và chạy bằng Docker (multi-stage, image Node.js 22 Alpine):

```bash
# Build image
docker build -t ecommerce-backend .

# Chạy container
docker run -p 3001:3001 --env-file .env ecommerce-backend
```

> Đảm bảo MongoDB và Redis đã chạy và biến `MONGODB_URI`, `REDIS_HOST` trỏ đúng host từ bên trong container.

---

## Seed dữ liệu

```bash
pnpm run seed
```

---

## Kiểm thử

```bash
# Unit tests (75 test cases)
pnpm run test

# Unit tests với coverage
pnpm run test:cov

# E2e tests (cần MongoDB replica set — tự khởi tạo qua MongoMemoryReplSet)
pnpm run test:e2e
```

### Cấu trúc test

```
src/
  modules/
    auth/auth.service.spec.ts
    coupons/coupons.service.spec.ts
    cart/cart.service.spec.ts
    orders/orders.service.spec.ts
    products/products.service.spec.ts
    reviews/reviews.service.spec.ts
test/
  setup.ts               # bootstrapTestApp factory (MongoMemoryReplSet + mock Redis/Queue/Email)
  fixtures/index.ts      # DTO builders cho e2e test
  auth.e2e-spec.ts
  products.e2e-spec.ts
  orders.e2e-spec.ts
```

---

## Kiểm tra code

```bash
# Lint
pnpm run lint

# Type check
pnpm run type-check
```

---

## Cấu trúc thư mục

```
src/
├── app.module.ts
├── main.ts
├── cache/                   # Redis client + cache module
├── common/
│   ├── constants/           # Error codes, queue names
│   ├── decorators/          # @CurrentUser, @Roles, @Public
│   ├── exceptions/          # BusinessException
│   ├── filters/             # GlobalExceptionFilter
│   ├── guards/              # JwtAuthGuard, RolesGuard
│   ├── interceptors/        # LoggingInterceptor, TransformInterceptor
│   ├── logger/              # Winston config
│   └── utils/               # crypto, slug helpers
├── config/                  # Cấu hình theo môi trường
├── database/
│   └── seeds/               # Seed script
└── modules/
    ├── addresses/
    ├── audit-logs/
    ├── auth/
    ├── banners/
    ├── cart/
    ├── categories/
    ├── coupons/
    ├── dashboard/
    ├── email/
    ├── health/
    ├── notifications/
    ├── orders/
    ├── products/
    ├── reviews/
    ├── upload/
    ├── users/
    └── wishlist/
```

---

## API

Tất cả endpoint có prefix `/api/v1`.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/api/v1/auth/register` | Đăng ký tài khoản |
| POST | `/api/v1/auth/login` | Đăng nhập |
| POST | `/api/v1/auth/refresh` | Làm mới access token |
| POST | `/api/v1/auth/verify-email` | Xác thực email |
| POST | `/api/v1/auth/logout` | Đăng xuất |
| GET | `/api/v1/products` | Danh sách sản phẩm (có phân trang, tìm kiếm) |
| GET | `/api/v1/products/flash-sale` | Sản phẩm flash sale |
| GET | `/api/v1/products/:slug` | Chi tiết sản phẩm |
| GET | `/api/v1/cart` | Xem giỏ hàng |
| POST | `/api/v1/cart` | Thêm sản phẩm vào giỏ |
| POST | `/api/v1/orders` | Đặt hàng |
| GET | `/api/v1/orders` | Lịch sử đơn hàng |
| POST | `/api/v1/orders/:id/cancel` | Hủy đơn hàng |
| POST | `/api/v1/admin/products` | (Admin) Tạo sản phẩm |
| PATCH | `/api/v1/admin/products/:id` | (Admin) Cập nhật sản phẩm |
| PATCH | `/api/v1/admin/orders/:id/status` | (Admin) Cập nhật trạng thái đơn |

Xem đầy đủ tại Swagger UI: `http://localhost:3001/api/docs`

---

## Bảo mật

- **Helmet** — HTTP security headers
- **CORS** — chỉ cho phép origin từ `FRONTEND_URL`
- **Rate limiting** — Throttler toàn cục (mặc định 100 req / 60s)
- **JWT** — access token ngắn hạn (15m) + refresh token (7d) với rotation
- **sanitize-html** — lọc XSS trong mô tả sản phẩm
- **Bcrypt** — băm mật khẩu
- **OTP** — xác thực email và reset mật khẩu qua token 1 lần dùng

---

## Tác giả

Nguyễn Hoàng Đạt
