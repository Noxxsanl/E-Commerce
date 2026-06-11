# Backend Implementation Blueprint
## Hệ Thống E-Commerce — NestJS + MongoDB + Redis

> **Mục đích:** Tài liệu này được viết để đọc **trước khi viết bất kỳ dòng code nào**.  
> Nó trả lời: dữ liệu chạy như thế nào, điều gì có thể sai, API trông như thế nào, và tại sao lại thiết kế như vậy.
>
> **Phiên bản:** 1.0.0  
> **Stack:** NestJS 11 · MongoDB Atlas · Redis · BullMQ · Socket.IO · Cloudinary

---

## Mục Lục

### Phần I — Nền Tảng Kiến Trúc
1. [Nguyên tắc thiết kế & quyết định kiến trúc](#1-nguyên-tắc-thiết-kế--quyết-định-kiến-trúc)
2. [Module dependency graph](#2-module-dependency-graph)
3. [Layered architecture trong từng module](#3-layered-architecture-trong-từng-module)

### Phần II — Luồng Dữ Liệu (Data Flow)
4. [Request lifecycle tổng quát](#4-request-lifecycle-tổng-quát)
5. [Auth flow — đăng ký, đăng nhập, refresh, logout](#5-auth-flow)
6. [Product flow — tạo, đọc, cache, invalidate](#6-product-flow)
7. [Cart flow — thêm, cập nhật, tính tổng](#7-cart-flow)
8. [Order flow — tạo đến giao hàng](#8-order-flow)
9. [Flash Sale flow — schedule, atomic stock, broadcast](#9-flash-sale-flow)
10. [Coupon flow — validate và apply](#10-coupon-flow)
11. [Review flow — điều kiện, tạo, duyệt](#11-review-flow)
12. [Upload flow — validate, transform, store](#12-upload-flow)
13. [Notification flow — tạo, queue, socket](#13-notification-flow)

### Phần III — Phân Tích Edge Cases
14. [Auth edge cases](#14-auth-edge-cases)
15. [Product & Inventory edge cases](#15-product--inventory-edge-cases)
16. [Cart edge cases](#16-cart-edge-cases)
17. [Order edge cases](#17-order-edge-cases)
18. [Coupon edge cases](#18-coupon-edge-cases)
19. [Flash Sale edge cases](#19-flash-sale-edge-cases)
20. [Concurrency & Race Conditions](#20-concurrency--race-conditions)

### Phần IV — API Contract
21. [API design principles](#21-api-design-principles)
22. [Request / Response schema chi tiết — Auth](#22-api-contract--auth)
23. [Request / Response schema chi tiết — Products](#23-api-contract--products)
24. [Request / Response schema chi tiết — Cart](#24-api-contract--cart)
25. [Request / Response schema chi tiết — Orders](#25-api-contract--orders)
26. [Request / Response schema chi tiết — Reviews](#26-api-contract--reviews)
27. [Request / Response schema chi tiết — Coupons](#27-api-contract--coupons)
28. [Request / Response schema chi tiết — Admin](#28-api-contract--admin)

### Phần V — Thiết Kế Hệ Thống Phụ Trợ
29. [Redis — key schema & TTL map đầy đủ](#29-redis--key-schema--ttl-map)
30. [BullMQ — job schema & retry strategy](#30-bullmq--job-schema--retry-strategy)
31. [Socket.IO — room strategy & event contract](#31-socketio--room-strategy--event-contract)
32. [Email — template & trigger map](#32-email--template--trigger-map)
33. [Audit Log — what, when, why](#33-audit-log--what-when-why)

### Phần VI — Triển Khai Chi Tiết Từng Module
34. [Module: Auth](#34-module-auth)
35. [Module: Users & Addresses](#35-module-users--addresses)
36. [Module: Categories](#36-module-categories)
37. [Module: Products](#37-module-products)
38. [Module: Cart](#38-module-cart)
39. [Module: Orders](#39-module-orders)
40. [Module: Reviews](#40-module-reviews)
41. [Module: Coupons](#41-module-coupons)
42. [Module: Banners](#42-module-banners)
43. [Module: Notifications](#43-module-notifications)
44. [Module: Upload](#44-module-upload)
45. [Module: Dashboard](#45-module-dashboard)

### Phần VII — Vận Hành
46. [Error taxonomy & HTTP status map](#46-error-taxonomy--http-status-map)
47. [Logging strategy](#47-logging-strategy)
48. [Health check & graceful shutdown](#48-health-check--graceful-shutdown)
49. [Database indexing strategy](#49-database-indexing-strategy)
50. [Implementation checklist](#50-implementation-checklist)

---

# PHẦN I — NỀN TẢNG KIẾN TRÚC

## 1. Nguyên Tắc Thiết Kế & Quyết Định Kiến Trúc

### 1.1 Các quyết định kiến trúc quan trọng (ADR)

#### ADR-01: Repository Pattern bắt buộc

**Quyết định:** Mỗi module có `*.repository.ts` riêng. Service **không bao giờ** gọi Mongoose Model trực tiếp.

**Lý do:**
- Tách biệt business logic khỏi persistence layer
- Dễ mock trong unit test (mock repository, không mock Mongoose)
- Khi đổi DB sau này chỉ sửa repository, không đụng service

```
service.ts  →  repository.ts  →  Mongoose Model  →  MongoDB
              (duy nhất layer được dùng Model)
```

#### ADR-02: Cache Aside Pattern

**Quyết định:** Không dùng write-through cache. Dùng Cache Aside (lazy loading).

**Lý do:** Write-through tăng độ phức tạp, không phù hợp với MongoDB + Redis ở scale hiện tại.

**Luồng đọc:**
```
1. Check Redis → HIT → return
2. Miss → query MongoDB → set Redis → return
```

**Invalidation:** Explicit delete sau mỗi mutation, không dùng TTL đơn thuần cho dữ liệu hay thay đổi.

#### ADR-03: Stateful Refresh Token (không phải stateless)

**Quyết định:** Lưu refresh token hash vào MongoDB, không dùng hoàn toàn stateless JWT refresh.

**Lý do:**
- Cho phép revoke token ngay lập tức (logout, khóa tài khoản)
- Phát hiện token reuse (nếu token đã bị revoke mà vẫn dùng → nghi bị đánh cắp)
- Stateless refresh không thể logout từ server side

#### ADR-04: Optimistic Stock Decrement với Redis

**Quyết định:** Flash Sale stock dùng Redis `DECRBY` atomic, sau đó async sync về MongoDB.

**Lý do:** MongoDB không đủ nhanh cho concurrent stock decrement trong Flash Sale (hàng nghìn req/s). Redis atomic operations đảm bảo không oversell.

#### ADR-05: Snapshot dữ liệu trong OrderItem

**Quyết định:** `OrderItem` lưu snapshot `productName`, `unitPrice`, `variantOptions` tại thời điểm đặt hàng.

**Lý do:** Nếu admin cập nhật giá sau khi order đã tạo, lịch sử đơn hàng phải giữ nguyên giá gốc. Không dùng reference đến Product cho display purposes.

#### ADR-06: BullMQ cho mọi side-effect nặng

**Quyết định:** Bất kỳ operation nào không cần kết quả ngay (email, notification, analytics, image processing) đều đi qua BullMQ queue.

**Lý do:** Tránh blocking request-response cycle. Nếu email service down, job sẽ retry tự động không mất dữ liệu.

### 1.2 Quy tắc bất biến (không được vi phạm)

```
RULE-01: Service không import Model trực tiếp, chỉ import Repository
RULE-02: Controller không chứa business logic, chỉ validate + delegate
RULE-03: DTO luôn có @IsNotEmpty / @IsOptional rõ ràng, không để ambiguous
RULE-04: Password không bao giờ xuất hiện trong log, response, hay DTO output
RULE-05: Mọi lỗi business logic throw BusinessException, không throw raw Error
RULE-06: Mọi ObjectId từ request phải qua ParseObjectIdPipe trước khi vào service
RULE-07: Mọi side-effect (email, notification) đi qua BullMQ, không gọi trực tiếp
RULE-08: Cache invalidation phải xảy ra trong cùng service method với mutation
RULE-09: Không lưu plaintext password, OTP, hay secret bất kỳ đâu ngoài hash
RULE-10: Admin endpoints luôn ghi AuditLog trước khi return response
```

---

## 2. Module Dependency Graph

```
                        ┌─────────────────┐
                        │   AppModule     │
                        └────────┬────────┘
                                 │ imports
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
   ┌────▼─────┐           ┌──────▼──────┐         ┌──────▼──────┐
   │  Auth    │           │  Products   │         │   Orders    │
   │  Module  │           │  Module     │         │   Module    │
   └────┬─────┘           └──────┬──────┘         └──────┬──────┘
        │ imports                │ imports               │ imports
        │                        │                       │
   ┌────▼─────┐           ┌──────▼──────┐         ┌──────▼──────┐
   │  Users   │           │ Categories  │         │    Cart     │
   │  Module  │◄──────────│  Module     │         │   Module    │
   └────┬─────┘           └─────────────┘         └──────┬──────┘
        │                                                 │
        │ shared                                          │ imports
   ┌────▼──────────────────────────────────────┐  ┌──────▼──────┐
   │              Shared Modules                │  │  Coupons    │
   │  EmailModule · UploadModule · NotifModule  │  │  Module     │
   └────────────────────────────────────────────┘  └─────────────┘

Shared (globally registered, không cần import lại):
  - DatabaseModule
  - ConfigModule
  - CacheModule (Redis)
  - ThrottlerModule
```

**Nguyên tắc import:**
- Module A import Module B có nghĩa A **dùng service** của B
- Tránh circular dependency: nếu A → B → A, tách logic chung ra SharedModule
- `forwardRef()` chỉ dùng khi thực sự không tránh được

---

## 3. Layered Architecture Trong Từng Module

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────────────┐
│  MIDDLEWARE LAYER                                │
│  RequestLoggerMiddleware · ThrottlerGuard        │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│  GUARD LAYER                                     │
│  JwtAuthGuard → xác thực token                  │
│  RolesGuard   → kiểm tra role/permission         │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│  PIPE LAYER                                      │
│  ValidationPipe  → validate + transform DTO      │
│  ParseObjectIdPipe → validate MongoDB ObjectId   │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│  CONTROLLER LAYER                                │
│  - Nhận HTTP request, extract params/body        │
│  - Gọi service method tương ứng                  │
│  - Không chứa if/else business logic             │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│  SERVICE LAYER  (Business Logic)                 │
│  - Orchestrate các bước nghiệp vụ                │
│  - Gọi repository để đọc/ghi dữ liệu            │
│  - Gọi cache để check/set/invalidate             │
│  - Enqueue BullMQ jobs cho side-effects          │
│  - Throw BusinessException khi vi phạm rule      │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│  REPOSITORY LAYER  (Data Access)                 │
│  - Chỉ chứa Mongoose queries                     │
│  - Không có business logic                        │
│  - Trả về plain objects hoặc Document            │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│  DATABASE LAYER                                  │
│  MongoDB Atlas ← Mongoose Schema/Model           │
└─────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│  INTERCEPTOR LAYER  (response wrapping)          │
│  TransformInterceptor → wrap thành ApiResponse   │
│  LoggingInterceptor  → log duration, status      │
│  AuditInterceptor    → ghi audit log (admin)     │
└─────────────────────────────────────────────────┘
```

---

# PHẦN II — LUỒNG DỮ LIỆU

## 4. Request Lifecycle Tổng Quát

### 4.1 Happy path — GET /products/:slug

```
Client
  │ GET /products/ao-thun-nam-basic
  │
  ▼
Nginx (rate limit check, SSL termination)
  │
  ▼
NestJS Global Middleware (RequestLogger: log method, url, ip)
  │
  ▼
ThrottlerGuard (100 req/60s per IP — public endpoints)
  │
  ▼
JwtAuthGuard — route này @Public(), bỏ qua guard
  │
  ▼
ValidationPipe — không có body, bỏ qua
  │
  ▼
ProductsController.findBySlug(slug: string)
  │
  ▼
ProductsService.findBySlug(slug)
  │
  ├─ 1. cacheManager.get('product:ao-thun-nam-basic')
  │       ├─ HIT → return cached (end)
  │       └─ MISS → tiếp tục
  │
  ├─ 2. productRepository.findBySlug(slug, { isActive: true })
  │       ├─ NOT FOUND → throw NotFoundException('PRODUCT_NOT_FOUND')
  │       └─ FOUND → product document
  │
  ├─ 3. Enqueue analytics job: { productId, sessionId }
  │       (không await — fire and forget)
  │
  ├─ 4. cacheManager.set('product:ao-thun-nam-basic', product, 600)
  │
  └─ 5. return product
  │
  ▼
TransformInterceptor → wrap thành { success: true, data: product }
  │
  ▼
Client nhận response 200
```

### 4.2 Error path — POST /orders (stock không đủ)

```
Client
  │ POST /orders  { items: [{ productId, variantId, quantity: 10 }] }
  │
  ▼
JwtAuthGuard → verify JWT → inject @CurrentUser()
  │
  ▼
ValidationPipe → validate CreateOrderDto
  │
  ▼
OrdersController.create(dto, currentUser)
  │
  ▼
OrdersService.create(dto, userId)
  │
  ├─ 1. Validate từng item:
  │       productRepository.findById(productId)
  │         → product.stock = 3, requested = 10
  │         → throw BusinessException('PRODUCT_INSUFFICIENT_STOCK', 422)
  │
  ▼
GlobalExceptionFilter bắt BusinessException
  │
  └─ return { success: false, error: { code: 'PRODUCT_INSUFFICIENT_STOCK',
                                       message: 'Không đủ hàng trong kho' } }
  │
  ▼
Client nhận 422 Unprocessable Entity
```

---

## 5. Auth Flow

### 5.1 Đăng ký (Register)

```
POST /auth/register
Body: { fullName, email, password }

Bước 1 — Validate input
  ├─ email format hợp lệ
  ├─ password: min 8 chars, có uppercase, lowercase, số
  └─ fullName: không rỗng, max 100 chars

Bước 2 — Kiểm tra duplicate
  └─ userRepository.findByEmail(email)
       ├─ EXISTS → throw ConflictException('AUTH_EMAIL_EXISTED')
       └─ NOT EXISTS → tiếp tục

Bước 3 — Hash password
  └─ bcrypt.hash(password, 12)

Bước 4 — Tạo user
  └─ userRepository.create({
       fullName, email,
       password: hashedPassword,
       status: 'inactive',       ← chưa verify email
       isEmailVerified: false,
       role: 'user'
     })

Bước 5 — Tạo OTP token
  └─ otpRepository.create({
       userId, token: generateUUID(),
       type: 'verify_email',
       expiresAt: now + 60 phút
     })

Bước 6 — Enqueue email job (KHÔNG await)
  └─ emailQueue.add('send-verify-email', {
       to: email,
       token: otpToken,
       fullName
     })

Bước 7 — Return (không trả về password)
  └─ { id, email, fullName, status: 'inactive' }

Note: User chưa verify email KHÔNG thể đăng nhập.
```

### 5.2 Đăng nhập (Login)

```
POST /auth/login
Body: { email, password }

Bước 1 — Validate input (basic format check)

Bước 2 — Tìm user (bao gồm password field với .select('+password'))
  └─ userRepository.findByEmailWithPassword(email)
       ├─ NOT FOUND → throw UnauthorizedException('AUTH_INVALID_CREDENTIALS')
       │               (KHÔNG nói rõ "email không tồn tại" — security)
       └─ FOUND → user

Bước 3 — Kiểm tra trạng thái tài khoản
  ├─ status = 'inactive' (chưa verify email)
  │     → throw ForbiddenException('AUTH_EMAIL_NOT_VERIFIED')
  └─ status = 'locked'
       → throw ForbiddenException('AUTH_ACCOUNT_LOCKED')

Bước 4 — Verify password
  └─ bcrypt.compare(password, user.password)
       ├─ FALSE → throw UnauthorizedException('AUTH_INVALID_CREDENTIALS')
       └─ TRUE → tiếp tục

Bước 5 — Tạo Access Token (JWT, 15 phút)
  └─ payload: { sub: userId, email, role }

Bước 6 — Tạo Refresh Token
  ├─ Generate random UUID token string
  ├─ Hash token: bcrypt.hash(token, 10)
  └─ refreshTokenRepository.create({
       userId,
       tokenHash: hashedToken,
       expiresAt: now + 7 ngày,
       deviceInfo: req.headers['user-agent'],
       ipAddress: req.ip
     })

Bước 7 — Cập nhật lastLoginAt (async, không await)
  └─ userRepository.updateLastLogin(userId)

Bước 8 — Return
  └─ {
       accessToken,       ← trong response body
       refreshToken,      ← trong response body
       expiresIn: 900,    ← 15 phút tính bằng giây
       user: { id, email, fullName, role, avatar }
     }

Frontend lưu: accessToken trong memory, refreshToken trong httpOnly cookie
hoặc cả hai trong localStorage (kém an toàn hơn).
```

### 5.3 Refresh Token Rotation

```
POST /auth/refresh
Body: { refreshToken: "uuid-token-string" }

Bước 1 — Validate refreshToken present

Bước 2 — Tìm token record chưa bị revoke
  └─ refreshTokenRepository.findActiveByUserId(userId)
       ├─ NOT FOUND hoặc revokedAt != null
       │     → throw UnauthorizedException('AUTH_TOKEN_REVOKED')
       │     → Nghi ngờ token bị đánh cắp: log + alert
       └─ FOUND → tokenRecord

Bước 3 — Verify hash
  └─ bcrypt.compare(refreshToken, tokenRecord.tokenHash)
       ├─ FALSE → throw UnauthorizedException('AUTH_TOKEN_INVALID')
       └─ TRUE → tiếp tục

Bước 4 — Kiểm tra hết hạn
  └─ tokenRecord.expiresAt < now
       → throw UnauthorizedException('AUTH_TOKEN_EXPIRED')

Bước 5 — Revoke token cũ (QUAN TRỌNG — ngăn reuse)
  └─ refreshTokenRepository.revoke(tokenRecord._id)

Bước 6 — Tạo cặp token mới (giống flow login từ bước 5)

Bước 7 — Return { accessToken, refreshToken, expiresIn }
```

### 5.4 Logout

```
POST /auth/logout
Headers: Authorization: Bearer <accessToken>
Body: { refreshToken }

Bước 1 — Xác thực accessToken (JwtAuthGuard)

Bước 2 — Revoke refresh token
  └─ refreshTokenRepository.revokeByToken(refreshToken, userId)
       (verify userId match để tránh revoke token của người khác)

Bước 3 — Return 204 No Content

Note: Access token vẫn có hiệu lực đến khi hết 15 phút.
Nếu cần revoke ngay lập tức → thêm Redis blacklist (overkill cho hầu hết cases).
```

### 5.5 Forgot & Reset Password

```
POST /auth/forgot-password
Body: { email }

Bước 1 — Tìm user (KHÔNG báo lỗi nếu email không tồn tại — chống enumeration)
  └─ userRepository.findByEmail(email)
       ├─ NOT FOUND → return 200 (giả vờ thành công)
       └─ FOUND → tiếp tục

Bước 2 — Xóa OTP cũ nếu còn (tránh nhiều token tồn tại song song)
  └─ otpRepository.deleteByUserAndType(userId, 'reset_password')

Bước 3 — Tạo token mới
  └─ otpRepository.create({ userId, token: uuid, type: 'reset_password', expiresAt: now+60m })

Bước 4 — Enqueue email job
  └─ emailQueue.add('send-reset-password', { to: email, token, fullName })

Bước 5 — Return 200 { message: "Nếu email tồn tại, bạn sẽ nhận được hướng dẫn" }

─────────────────────────────────────────────────

POST /auth/reset-password
Body: { token, newPassword }

Bước 1 — Tìm OTP token
  └─ otpRepository.findValid({ token, type: 'reset_password' })
       ├─ NOT FOUND → throw BadRequestException('AUTH_OTP_INVALID')
       └─ FOUND nhưng expiresAt < now → throw BadRequestException('AUTH_OTP_EXPIRED')

Bước 2 — Đánh dấu OTP đã dùng
  └─ otpRepository.markUsed(token._id)

Bước 3 — Hash + update password
  └─ userRepository.updatePassword(userId, bcrypt.hash(newPassword, 12))

Bước 4 — Revoke tất cả refresh tokens của user (buộc đăng nhập lại mọi thiết bị)
  └─ refreshTokenRepository.revokeAllByUser(userId)

Bước 5 — Enqueue email thông báo password đã thay đổi

Bước 6 — Return 200
```

---

## 6. Product Flow

### 6.1 Đọc danh sách sản phẩm (có filter)

```
GET /products?category=ao-thun&minPrice=100000&maxPrice=500000&sort=best_selling&page=2

Bước 1 — Parse & validate query params (QueryProductDto)
  ├─ page: default 1, min 1
  ├─ limit: default 20, max 100
  ├─ sort: enum [newest, best_selling, price_asc, price_desc, rating]
  ├─ minPrice/maxPrice: number, min 0
  ├─ minRating: 1-5
  └─ inStock: boolean

Bước 2 — Build cache key từ query string (normalize để đảm bảo cùng params → cùng key)
  └─ normalizeQuery(query) → sort keys, stringify
     key = 'products:list:' + md5(normalizedQuery)

Bước 3 — Check cache
  ├─ HIT → return cached result
  └─ MISS → tiếp tục

Bước 4 — Build MongoDB query
  filter = { isActive: true }
  ├─ category → lookup slug → lấy categoryId → filter.categories = categoryId
  ├─ brand → filter.brand = brand
  ├─ minPrice/maxPrice → filter.price = { $gte, $lte }
  │   Note: filter theo effectivePrice (sau discount), cần pipeline
  ├─ minRating → filter.averageRating = { $gte: minRating }
  └─ inStock = true → filter.stock = { $gt: 0 }

Bước 5 — Build sort
  sort map:
    newest       → { createdAt: -1 }
    best_selling → { soldCount: -1 }
    price_asc    → { price: 1 }    (hoặc effectivePrice nếu dùng aggregation)
    price_desc   → { price: -1 }
    rating       → { averageRating: -1 }

Bước 6 — Execute query với pagination
  ├─ products = await productRepository.findMany(filter, sort, page, limit)
  └─ total = await productRepository.count(filter)

Bước 7 — Cache result (TTL: 5 phút)
  └─ cacheManager.set(key, result, 300)

Bước 8 — Return PaginatedResult<Product>
```

### 6.2 Tạo sản phẩm (Admin)

```
POST /admin/products
Body: CreateProductDto

Bước 1 — Validate DTO
  ├─ name: không rỗng
  ├─ categories: mảng MongoDB ObjectId hợp lệ, tồn tại trong DB
  ├─ price: >= 0
  ├─ stock: >= 0 integer
  └─ images: ít nhất 1 URL Cloudinary

Bước 2 — Validate categories tồn tại
  └─ categoryRepository.findByIds(dto.categories)
       → length !== dto.categories.length → throw 'CATEGORY_NOT_FOUND'

Bước 3 — Generate slug từ name
  └─ slug = slugify(dto.name) + '-' + shortId()
     // Đảm bảo unique, thêm suffix nếu cần

Bước 4 — Tạo product
  └─ productRepository.create({ ...dto, slug })

Bước 5 — Nếu có variants trong dto: tạo ProductVariant records

Bước 6 — Invalidate cache
  └─ xóa: 'products:list:*' (pattern delete)
           'products:best-sellers'
           'products:featured'
           'categories:tree' (vì có thể ảnh hưởng product count)

Bước 7 — Ghi AuditLog (async)
  └─ { action: 'product.create', resource: 'products', resourceId, after: product }

Bước 8 — Return created product
```

### 6.3 Tính giá hiển thị (effectivePrice logic)

```
Hàm tính giá hiệu dụng — CHỈ dùng ở service layer, không ở DB query:

function getEffectivePrice(product: Product): number {
  // Flash Sale ưu tiên cao nhất
  if (product.isFlashSale
      && product.flashSaleStock > 0
      && product.flashSaleEndAt > new Date()) {
    return product.flashSalePrice;
  }

  // Discount thường
  if (product.discountPercent > 0) {
    return Math.round(product.price * (1 - product.discountPercent / 100));
  }

  // Giá gốc
  return product.price;
}

// Áp dụng khi:
// - Hiển thị sản phẩm trong list/detail
// - Tính CartItem.unitPrice khi thêm vào giỏ
// - Validate giá khi tạo OrderItem
```

---

## 7. Cart Flow

### 7.1 Thêm vào giỏ hàng

```
POST /cart
Body: { productId, variantId?, quantity }

Bước 1 — Validate
  ├─ quantity: integer, min 1, max 99
  └─ productId: ObjectId hợp lệ

Bước 2 — Kiểm tra sản phẩm
  └─ productRepository.findById(productId)
       ├─ NOT FOUND → throw 'PRODUCT_NOT_FOUND'
       ├─ isActive = false → throw 'PRODUCT_NOT_AVAILABLE'
       └─ FOUND → product

Bước 3 — Nếu có variantId: kiểm tra variant
  └─ variantRepository.findById(variantId)
       ├─ NOT FOUND → throw 'VARIANT_NOT_FOUND'
       ├─ variantId.productId !== productId → throw 'VARIANT_MISMATCH'
       └─ FOUND → variant (dùng variant.price nếu có, fallback product.price)

Bước 4 — Kiểm tra tồn kho
  ├─ targetStock = variant?.stock ?? product.stock
  └─ targetStock < quantity → throw 'PRODUCT_INSUFFICIENT_STOCK'

Bước 5 — Lấy hoặc tạo Cart của user
  └─ cartRepository.findOrCreateByUserId(userId)

Bước 6 — Kiểm tra item đã tồn tại trong cart chưa
  └─ existingItem = cart.items.find(
         i => i.productId == productId && i.variantId == variantId
     )

  ├─ EXISTING:
  │   newQuantity = existingItem.quantity + quantity
  │   ├─ newQuantity > targetStock → throw 'CART_EXCEEDS_STOCK'
  │   │   message: "Bạn đã có X sản phẩm này trong giỏ, tồn kho chỉ còn Y"
  │   └─ update existingItem.quantity = newQuantity
  │
  └─ NEW:
      cart.items.push({
        productId, variantId,
        quantity,
        price: getEffectivePrice(product),  ← snapshot giá lúc thêm vào
        productName: product.name,          ← snapshot tên
        productImage: product.thumbnailUrl, ← snapshot ảnh
        variantOptions: formatVariantOptions(variant)
      })

Bước 7 — Recalculate cart totals
  └─ cartService.recalculate(cart)
     → subtotal = sum(item.price * item.quantity)
     Note: Giá trong cart là snapshot, KHÔNG recalculate lại từ DB
           (tránh giá thay đổi khi user đang checkout)
           Chỉ recalculate khi user refresh cart (xem bước tiếp)

Bước 8 — Save cart

Bước 9 — Return cart
```

### 7.2 Xem giỏ hàng (với price refresh)

```
GET /cart

Bước 1 — Lấy cart của user

Bước 2 — Với mỗi item trong cart, kiểm tra và cập nhật:
  ├─ productRepository.findByIds([...productIds])
  └─ Với mỗi item:
       ├─ Product không tồn tại / bị deactive:
       │   → item.isUnavailable = true (đánh dấu, không xóa)
       │   → item.unavailableReason = 'Sản phẩm không còn bán'
       │
       ├─ stock = 0:
       │   → item.isUnavailable = true
       │   → item.unavailableReason = 'Tạm hết hàng'
       │
       ├─ item.quantity > currentStock:
       │   → item.isQuantityExceeded = true
       │   → item.maxQuantity = currentStock
       │
       └─ Price thay đổi (giá hiện tại khác giá snapshot):
           → item.currentPrice = getEffectivePrice(product)
           → item.isPriceChanged = true
           (hiển thị cảnh báo giá đã thay đổi, user tự quyết định)

Bước 3 — Return cart với enriched item data
  (KHÔNG auto-update giá trong DB — chỉ thông báo cho user)
```

### 7.3 Tính toán giỏ hàng (Cart Summary)

```
Hàm calculateCartSummary(cart, coupon?):

  subtotal = sum(item.price * item.quantity)    ← dùng giá snapshot
             chỉ tính items không có isUnavailable = true

  shippingFee = calculateShipping(subtotal)
    ├─ subtotal >= FREE_SHIPPING_THRESHOLD (500,000đ) → 0
    └─ else → STANDARD_SHIPPING_FEE (30,000đ)

  discountAmount = 0
  if (coupon):
    discountAmount = calculateCouponDiscount(coupon, subtotal)
    ├─ type = PERCENT: min(subtotal * value/100, maxDiscountAmount || Infinity)
    ├─ type = FIXED_AMOUNT: min(value, subtotal)   ← không giảm quá subtotal
    └─ type = FREE_SHIPPING: shippingFee (set về 0)

  total = subtotal + shippingFee - discountAmount
  total = max(total, 0)    ← không âm

  return { subtotal, shippingFee, discountAmount, total }
```

---

## 8. Order Flow

### 8.1 Tạo đơn hàng

```
POST /orders
Body: CreateOrderDto {
  addressId: string,
  couponCode?: string,
  paymentMethod: 'cod',
  notes?: string
}

Bước 1 — Lấy cart của user
  ├─ cart rỗng → throw 'CART_EMPTY'
  └─ cart có items isUnavailable → throw 'CART_HAS_UNAVAILABLE_ITEMS'
     message: "Vui lòng xóa các sản phẩm không còn bán trước khi đặt hàng"

Bước 2 — Validate address
  └─ addressRepository.findById(addressId)
       ├─ NOT FOUND → throw 'ADDRESS_NOT_FOUND'
       └─ address.userId !== currentUserId → throw 'FORBIDDEN'

Bước 3 — Validate coupon (nếu có)
  └─ couponService.validateAndCalculate(couponCode, userId, subtotal)
       (xem chi tiết ở Coupon Flow)

Bước 4 — Validate và lock stock (QUAN TRỌNG — atomic)
  ├─ Với mỗi item trong cart:
  │   a. Lấy product từ DB với session (để dùng transaction)
  │   b. Kiểm tra: product.stock >= item.quantity
  │      → FAIL → throw 'PRODUCT_INSUFFICIENT_STOCK' {
  │                  productName, requested: item.quantity, available: product.stock
  │                }
  │
  └─ Tất cả pass → tiếp tục

Bước 5 — Trong MongoDB Transaction:
  a. Decrement stock cho từng sản phẩm
     productRepository.decrementStock(productId, variantId, quantity)
     → dùng $inc: { stock: -quantity }, $min safe (check stock >= 0)

  b. Generate orderCode = 'ORD-' + YYYYMMDD + '-' + padded counter
     (counter lưu trong Redis: INCR 'order:counter:YYYYMMDD')

  c. Create Order record {
       orderCode, userId,
       shippingAddress: snapshot(address),  ← SNAPSHOT, không reference
       paymentMethod, notes,
       status: 'pending',
       couponCode,
       subtotal, shippingFee, discountAmount, totalAmount,
       statusHistory: [{ status: 'pending', updatedAt: now }]
     }

  d. Create OrderItem records cho từng cart item
     (snapshot: productName, productImage, variantOptions, unitPrice)

  e. Nếu có coupon: increment coupon.usedCount
                    create CouponUsage record

  f. Clear cart

Bước 6 — Sau transaction thành công (ngoài transaction):
  ├─ Enqueue emailQueue.add('send-order-confirmation', { orderId, userId })
  ├─ Enqueue notificationQueue.add('create-notification', {
  │     userId, type: 'order_status',
  │     title: 'Đặt hàng thành công',
  │     message: `Đơn hàng ${orderCode} đã được tạo`,
  │     link: `/orders/${orderId}`
  │   })
  └─ Emit socket event tới admin room:
       io.to('admin').emit('order:new', { orderId, orderCode, totalAmount })

Bước 7 — Return order
```

### 8.2 Update trạng thái đơn hàng (Admin)

```
PATCH /admin/orders/:id/status
Body: { status, note? }

Valid status transitions:
  pending    → confirmed | cancelled
  confirmed  → packing   | cancelled
  packing    → shipping
  shipping   → delivered
  delivered  → returned
  cancelled  → (terminal state)
  returned   → (terminal state)

Bước 1 — Lấy order
  └─ NOT FOUND → throw 'ORDER_NOT_FOUND'

Bước 2 — Validate transition
  └─ !isValidTransition(current, requested) → throw 'ORDER_INVALID_STATUS_TRANSITION'
     message: "Không thể chuyển từ X sang Y"

Bước 3 — Xử lý side-effects theo trạng thái mới:

  → CONFIRMED:
    Enqueue email: order-status-update

  → CANCELLED (bởi admin):
    ├─ Restock: productRepository.incrementStock cho từng item
    ├─ Nếu có coupon: decrement coupon.usedCount, delete CouponUsage
    └─ Enqueue email: order-cancelled

  → DELIVERED:
    ├─ deliveredAt = now
    ├─ paymentStatus = 'paid' (COD nhận tiền khi giao)
    └─ Enqueue job: 'update-product-sold-count' { items }

  → RETURNED:
    └─ Restock (giống cancelled)

Bước 4 — Update order
  ├─ status = newStatus
  └─ statusHistory.push({ status: newStatus, updatedAt: now, updatedBy: adminId, note })

Bước 5 — Gửi Socket event tới user
  └─ io.to(`user:${order.userId}`).emit('order:status-updated', {
       orderId, status: newStatus, message: getStatusMessage(newStatus)
     })

Bước 6 — Enqueue notification tới user

Bước 7 — Ghi AuditLog

Bước 8 — Return updated order
```

### 8.3 Hủy đơn hàng (User)

```
POST /orders/:id/cancel
Body: { reason? }

Bước 1 — Lấy order
  ├─ NOT FOUND → 'ORDER_NOT_FOUND'
  └─ order.userId !== currentUserId → 403 Forbidden

Bước 2 — Kiểm tra có thể hủy không
  └─ order.status !== 'pending' → throw 'ORDER_CANNOT_CANCEL'
     message: "Chỉ có thể hủy đơn hàng đang chờ xác nhận"

Bước 3 — Thực hiện hủy (tương tự admin cancel)
  ├─ Restock
  ├─ Nếu có coupon: hoàn lại coupon usage
  └─ cancelReason = reason

Bước 4 — Notifications & email

Bước 5 — Return updated order
```

---

## 9. Flash Sale Flow

### 9.1 Admin tạo Flash Sale

```
PATCH /admin/products/:id (update product với flash sale fields)
Body: {
  isFlashSale: true,
  flashSalePrice: 199000,
  flashSaleStock: 50,
  flashSaleEndAt: "2025-12-31T23:59:59Z"
}

Bước 1 — Validate
  ├─ flashSalePrice < product.price (phải rẻ hơn)
  ├─ flashSaleStock <= product.stock (không vượt tổng tồn kho)
  └─ flashSaleEndAt > now + 5 phút (ít nhất 5 phút nữa)

Bước 2 — Update product trong MongoDB

Bước 3 — Khởi tạo Redis stock counter
  └─ redis.set('flash-sale:stock:productId', flashSaleStock, 'EX', ttlUntilEnd)

Bước 4 — Schedule end job trong BullMQ
  └─ flashSaleQueue.add('end-flash-sale',
       { productId },
       { delay: flashSaleEndAt - now }
     )

Bước 5 — Broadcast Socket event
  └─ io.emit('flash-sale:started', {
       productId, productName,
       salePrice: flashSalePrice,
       originalPrice: product.price,
       stock: flashSaleStock,
       endAt: flashSaleEndAt
     })

Bước 6 — Invalidate cache
  └─ xóa: 'products:flash-sale', 'product:slug'
```

### 9.2 Mua hàng trong Flash Sale (atomic stock)

```
Khi user thêm Flash Sale product vào cart:

Bước 1 — Check Redis stock (nhanh hơn MongoDB)
  └─ remaining = await redis.get('flash-sale:stock:productId')
       ├─ remaining = null → Flash Sale đã kết thúc, dùng giá thường
       └─ remaining <= 0 → throw 'FLASH_SALE_OUT_OF_STOCK'

Bước 2 — KHÔNG decrement ở bước thêm cart
  (chỉ check, không giữ chỗ — giữ chỗ ở bước tạo order)

Khi tạo Order chứa Flash Sale item:

Bước 1 — Atomic decrement trong Redis
  └─ newStock = await redis.decrby('flash-sale:stock:productId', quantity)
       ├─ newStock < 0:
       │   ├─ Rollback: redis.incrby('flash-sale:stock:productId', quantity)
       │   └─ throw 'FLASH_SALE_OUT_OF_STOCK'
       └─ newStock >= 0 → tiếp tục

Bước 2 — Cũng decrement MongoDB stock trong transaction (như flow bình thường)

Bước 3 — Broadcast stock update
  └─ io.emit('flash-sale:stock-update', { productId, remainingStock: newStock })
```

### 9.3 Kết thúc Flash Sale (BullMQ job)

```
Job: 'end-flash-sale' { productId }

Bước 1 — Update MongoDB product
  └─ { isFlashSale: false, flashSalePrice: 0, flashSaleStock: 0, flashSaleEndAt: null }

Bước 2 — Xóa Redis stock key
  └─ redis.del('flash-sale:stock:productId')

Bước 3 — Broadcast
  └─ io.emit('flash-sale:ended', { productId })

Bước 4 — Invalidate cache sản phẩm
```

---

## 10. Coupon Flow

### 10.1 Validate coupon

```
POST /coupons/validate
Body: { code, subtotal }

Hàm validateCoupon(code, userId, subtotal):

Bước 1 — Tìm coupon
  └─ couponRepository.findByCode(code.toUpperCase())
       ├─ NOT FOUND → throw 'COUPON_NOT_FOUND'
       └─ FOUND → coupon

Bước 2 — Kiểm tra active
  └─ !coupon.isActive → throw 'COUPON_INACTIVE'

Bước 3 — Kiểm tra thời gian
  ├─ now < coupon.startDate → throw 'COUPON_NOT_STARTED'
  └─ now > coupon.endDate → throw 'COUPON_EXPIRED'

Bước 4 — Kiểm tra usage limit tổng
  └─ coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit
       → throw 'COUPON_USAGE_LIMIT_REACHED'

Bước 5 — Kiểm tra usage limit per user
  └─ usageCount = couponUsageRepository.countByUserAndCoupon(userId, coupon._id)
     usageCount >= coupon.usagePerUser
       → throw 'COUPON_USER_LIMIT_REACHED'

Bước 6 — Kiểm tra giá trị đơn hàng tối thiểu
  └─ subtotal < coupon.minOrderAmount
       → throw 'COUPON_MIN_ORDER_NOT_MET' {
           minOrderAmount: coupon.minOrderAmount,
           currentSubtotal: subtotal
         }

Bước 7 — Kiểm tra applicable products/categories (nếu có restriction)
  → complex logic, xem section 10.2

Bước 8 — Tính discount amount
  └─ calculateDiscount(coupon, subtotal) (xem Cart Flow 7.3)

Bước 9 — Return {
  coupon: { code, type, value, description },
  discountAmount,
  isValid: true
}
```

### 10.2 Coupon với giới hạn sản phẩm

```
Nếu coupon.applicableProducts.length > 0 hoặc coupon.applicableCategories.length > 0:

  cartItems = lấy từ cart hiện tại của user

  eligibleSubtotal = 0
  for each item in cartItems:
    product = productRepository.findById(item.productId)

    isEligible = (
      coupon.applicableProducts.includes(item.productId)
      || product.categories.some(c => coupon.applicableCategories.includes(c))
    )

    if (isEligible):
      eligibleSubtotal += item.price * item.quantity

  if (eligibleSubtotal === 0):
    throw 'COUPON_NOT_APPLICABLE_TO_CART'
    message: "Mã giảm giá không áp dụng cho sản phẩm trong giỏ hàng"

  Tính discount dựa trên eligibleSubtotal, không phải toàn bộ subtotal
```

---

## 11. Review Flow

### 11.1 Điều kiện để review

```
Trước khi tạo review, PHẢI pass tất cả điều kiện:

1. User đã đăng nhập (JwtAuthGuard)

2. OrderItem tồn tại và thuộc về user
   orderItem = orderItemRepository.findById(orderItemId)
   ├─ NOT FOUND → 'REVIEW_ORDER_ITEM_NOT_FOUND'
   └─ order.userId !== currentUserId → 403

3. Đơn hàng đã giao thành công
   order.status === 'delivered'
   → FAIL → 'REVIEW_ORDER_NOT_DELIVERED'
   message: "Chỉ đánh giá được sản phẩm trong đơn hàng đã giao thành công"

4. Chưa đánh giá orderItem này
   orderItem.isReviewed === true
   → throw 'REVIEW_ALREADY_SUBMITTED'

5. (Tùy chọn) Trong vòng 90 ngày kể từ khi giao hàng
   order.deliveredAt + 90 days < now
   → throw 'REVIEW_PERIOD_EXPIRED'
```

### 11.2 Tạo review

```
POST /reviews
Body: { orderItemId, rating, content, images? }

Sau khi pass điều kiện ở 11.1:

Bước 1 — Tạo Review record
  └─ reviewRepository.create({
       userId, productId: orderItem.productId,
       orderId: orderItem.orderId, orderItemId,
       rating, content, images,
       isApproved: false    ← Cần duyệt trước khi hiển thị
     })

Bước 2 — Đánh dấu orderItem đã review
  └─ orderItemRepository.markReviewed(orderItemId, reviewId)

Bước 3 — Cập nhật product stats (async qua BullMQ)
  └─ analyticsQueue.add('update-product-rating', { productId })
     Job này sẽ recalculate averageRating và reviewCount từ DB

Bước 4 — Notify admin có review mới (qua BullMQ)

Bước 5 — Return created review

Note: Review chưa isApproved sẽ KHÔNG hiển thị công khai.
      User vẫn thấy review của chính mình dù chưa approved.
```

### 11.3 Admin duyệt review

```
PATCH /admin/reviews/:id/approve

Bước 1 — Tìm review
Bước 2 — Set isApproved = true
Bước 3 — Recalculate product averageRating (sync)
  └─ Aggregate: db.reviews.aggregate([
       { $match: { productId, isApproved: true, isHidden: false } },
       { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
     ])
     → Update product.averageRating, product.reviewCount

Bước 4 — Enqueue notification tới user
  └─ "Đánh giá của bạn về [productName] đã được duyệt"

Bước 5 — Invalidate cache product

Bước 6 — Ghi AuditLog
```

---

## 12. Upload Flow

### 12.1 Upload ảnh sản phẩm

```
POST /upload/image
Content-Type: multipart/form-data
Body: { file: <binary>, folder?: string }

Bước 1 — Multer middleware (memory storage, không lưu disk)
  ├─ maxSize: 5MB
  └─ fileFilter: chỉ chấp nhận image/jpeg, image/png, image/webp

Bước 2 — Validate MIME type thực (magic bytes, không tin extension)
  └─ fileTypeFromBuffer(file.buffer)
       ├─ type.mime không thuộc allowed list → 400 'UPLOAD_INVALID_TYPE'
       └─ VALID → tiếp tục

Bước 3 — Validate kích thước
  └─ file.size > MAX_SIZE → 400 'UPLOAD_FILE_TOO_LARGE'

Bước 4 — Upload lên Cloudinary
  └─ cloudinary.uploader.upload_stream({
       folder: `ecommerce/${folder || 'misc'}`,
       transformation: [
         { width: 1200, height: 1200, crop: 'limit' },
         { quality: 'auto', fetch_format: 'auto' }
       ],
       eager: [
         { width: 400, height: 400, crop: 'fill' },   ← thumbnail
         { width: 100, height: 100, crop: 'fill' }    ← micro thumbnail
       ]
     })

Bước 5 — Return {
  url: result.secure_url,           ← URL full size
  thumbnailUrl: result.eager[0].secure_url,
  publicId: result.public_id        ← cần để delete sau này
}
```

---

## 13. Notification Flow

### 13.1 Luồng tạo và gửi notification

```
Trigger: một event nghiệp vụ xảy ra (order created, status changed, ...)

Bước 1 — Service tạo notification job
  └─ notificationQueue.add('create-notification', {
       userId,
       type: NotificationType,
       title, message, link,
       data: { orderId, ... }
     })

Bước 2 — NotificationProcessor xử lý job
  a. Lưu vào MongoDB
     └─ notificationRepository.create({ userId, type, title, message, link, data })

  b. Gửi Socket event realtime
     └─ io.to(`user:${userId}`).emit('notification:new', {
          id: notification._id,
          type, title, message, link,
          createdAt: notification.createdAt
        })
     Note: User có thể offline, socket emit sẽ fail silently → OK
           User sẽ fetch lại khi online qua GET /notifications

Bước 3 — User nhận và đọc
  ├─ Realtime: socket event khi đang online
  └─ API: GET /notifications (khi vào app lại)
```

---

# PHẦN III — PHÂN TÍCH EDGE CASES

## 14. Auth Edge Cases

| Case | Tình huống | Xử lý |
|------|-----------|-------|
| AC-01 | Đăng ký email đã tồn tại nhưng chưa verify | Cho phép gửi lại email verify. Không tạo user mới. |
| AC-02 | Đăng nhập trong khi account đang bị lock | Return 403 với lý do bị lock và thời gian. |
| AC-03 | Refresh token bị dùng 2 lần (reuse attack) | Revoke toàn bộ refresh tokens của user đó, force re-login, log security alert. |
| AC-04 | Reset password link bị click nhiều lần | OTP đánh dấu `used = true` sau lần đầu. Lần sau throw 'AUTH_OTP_ALREADY_USED'. |
| AC-05 | User đổi password trong khi có session khác | Revoke tất cả refresh tokens trừ session hiện tại (hoặc tất cả, force re-login mọi thiết bị). |
| AC-06 | JWT hết hạn đúng lúc request đang xử lý | Guard throw 401, client phải refresh. Không auto-refresh ở server. |
| AC-07 | Brute force đăng nhập | Throttler: max 5 lần/phút/IP cho `/auth/login`. Sau 10 lần fail trong 15 phút: tạm khóa account 30 phút. |
| AC-08 | Email verify token hết hạn | Cho phép request gửi lại email. Xóa token cũ, tạo token mới. Chỉ cho phép nếu chưa verify. |
| AC-09 | Nhiều thiết bị đăng nhập cùng lúc | Cho phép (mỗi thiết bị có refresh token riêng). Khi logout chỉ revoke token của thiết bị đó. |
| AC-10 | Admin bị lock account trong khi đang login | Sau khi lock: access token còn hiệu lực đến hết 15 phút. Sau đó không refresh được (JwtAuthGuard check status). |

**Lưu ý AC-10:** Cần thêm check status vào JwtStrategy:

```typescript
// jwt.strategy.ts
async validate(payload: JwtPayload) {
  const user = await this.usersService.findById(payload.sub);
  if (!user || user.status === 'locked') {
    throw new UnauthorizedException();
  }
  return user;
}
// Có thể cache user status trong Redis (30s) để tránh DB query mỗi request
```

---

## 15. Product & Inventory Edge Cases

| Case | Tình huống | Xử lý |
|------|-----------|-------|
| PC-01 | Sản phẩm bị deactivate trong khi đang có trong cart | Khi GET /cart: đánh dấu `isUnavailable`. Khi POST /orders: throw lỗi yêu cầu xóa trước. |
| PC-02 | Admin cập nhật giá khi user đang checkout | Giá trong cart là snapshot, KHÔNG bị ảnh hưởng. Hiển thị cảnh báo nếu giá đã thay đổi. |
| PC-03 | Slug bị trùng khi tạo sản phẩm cùng tên | `generateUniqueSlug()`: thử slug gốc → nếu trùng → thêm suffix ngẫu nhiên (`-abc123`). |
| PC-04 | Sản phẩm có variant, xóa variant đang có trong cart | Đánh dấu cart item `variantUnavailable`. Không cho phép checkout. |
| PC-05 | Stock âm sau khi nhiều user order đồng thời | MongoDB transaction với `$inc` và check `stock >= 0`. Nếu concurrent: transaction retry 3 lần. |
| PC-06 | Filter theo `price` khi sản phẩm đang Flash Sale | Flash Sale price là giá hiệu dụng. Phải filter theo `effectivePrice` (computed), không phải `price` raw. Dùng aggregation với `$addFields`. |
| PC-07 | Xóa category đang có sản phẩm | KHÔNG cho phép nếu có sản phẩm active. Soft delete nếu không có sản phẩm. |
| PC-08 | Full-text search không có kết quả | Return empty array với `pagination.total = 0`. KHÔNG throw lỗi. |
| PC-09 | Upload ảnh thành công nhưng tạo product thất bại | Cloudinary ảnh đã upload → orphan file. Cần cleanup job hàng tuần xóa orphan public_ids. |
| PC-10 | Product có nhiều categories, filter theo category cha | Cần resolve nested categories: nếu filter "Áo" thì cũng match "Áo thun" (sub-category). |

---

## 16. Cart Edge Cases

| Case | Tình huống | Xử lý |
|------|-----------|-------|
| CC-01 | Thêm cùng product + variant 2 lần | Merge quantity, không tạo 2 cart items. |
| CC-02 | Thêm quantity vượt stock | Throw `CART_EXCEEDS_STOCK` với message rõ ràng: "Chỉ còn X sản phẩm". |
| CC-03 | Cart của user bị null (chưa tạo) | `findOrCreate`: tạo cart rỗng nếu chưa có. |
| CC-04 | Update quantity về 0 | Xóa item khỏi cart (không giữ item với quantity 0). |
| CC-05 | Stock giảm sau khi user đã thêm vào cart | Phát hiện khi GET /cart (stock check step). Đánh dấu `isQuantityExceeded`, hiển thị cảnh báo. |
| CC-06 | User merge cart guest → logged-in | **Không implement trong Phase 1** (không có guest cart). Defer. |
| CC-07 | Cart quá lớn (người dùng thêm hàng trăm items) | Giới hạn: max 50 items per cart. Throw `CART_MAX_ITEMS_EXCEEDED`. |
| CC-08 | Flash Sale hết trong khi item đang trong cart | Khi GET /cart: check flash sale status, cập nhật `currentPrice` sang giá thường, đánh dấu `isPriceChanged`. |

---

## 17. Order Edge Cases

| Case | Tình huống | Xử lý |
|------|-----------|-------|
| OC-01 | Đặt hàng 2 lần nhanh (double submit) | Idempotency: Check xem có pending order trùng user + cart hash trong 60s không. Nếu có, return order cũ. |
| OC-02 | Stock vừa đủ cho nhiều user đặt đồng thời | MongoDB transaction + retry. Nếu transaction fail 3 lần do conflict → throw 'ORDER_STOCK_CONFLICT'. |
| OC-03 | Coupon hết lượt khi nhiều user dùng cùng lúc | Dùng MongoDB `findOneAndUpdate` với atomic `$inc` và kiểm tra điều kiện. |
| OC-04 | Admin cập nhật sai status (backward) | Validate state machine. KHÔNG cho phép: delivered → confirmed. Throw `ORDER_INVALID_STATUS_TRANSITION`. |
| OC-05 | Order bị hủy sau khi email confirm đã gửi | Vẫn hủy bình thường, gửi email hủy. Không thể unsend email đã gửi. |
| OC-06 | Địa chỉ giao hàng bị xóa sau khi order | Không ảnh hưởng: order lưu snapshot địa chỉ tại thời điểm đặt. |
| OC-07 | Đặt hàng thành công nhưng email queue down | Job sẽ retry theo BullMQ config (3 lần, backoff 5 phút). Nếu vẫn fail → dead letter queue để xử lý thủ công. |
| OC-08 | orderCode duplicate | orderCode dùng Redis INCR (atomic), không thể duplicate trong cùng ngày. Khác ngày thì prefix YYYYMMDD khác nhau. |
| OC-09 | User xóa tài khoản khi có đơn hàng đang xử lý | Không cho phép xóa tài khoản nếu có order ở trạng thái active (pending→shipping). Chỉ lock account. |
| OC-10 | Flash Sale item trong order, Flash Sale kết thúc sau khi order tạo | Không ảnh hưởng: OrderItem đã snapshot `unitPrice` tại thời điểm mua. |

---

## 18. Coupon Edge Cases

| Case | Tình huống | Xử lý |
|------|-----------|-------|
| CC-01 | Coupon code không phân biệt hoa thường | Normalize: luôn uppercase khi lưu và khi query. |
| CC-02 | Nhiều user dùng coupon cùng lúc khi gần hết limit | Atomic check với `findOneAndUpdate + $inc + condition`. Nếu sau increment mà vượt limit: rollback. |
| CC-03 | Hủy order → hoàn lại coupon | `coupon.usedCount--` và xóa `CouponUsage` record tương ứng. |
| CC-04 | Discount vượt quá subtotal | `discountAmount = min(calculatedDiscount, subtotal)`. Total không âm. |
| CC-05 | Coupon PERCENT không có `maxDiscountAmount` | Không giới hạn (giảm theo % thực tế). Document rõ khi admin tạo coupon. |
| CC-06 | Validate coupon nhưng chưa checkout | Validate chỉ read-only, KHÔNG tăng `usedCount`. Chỉ tăng khi order thực sự tạo thành công. |
| CC-07 | Coupon hết hạn trong khi đang ở trang checkout | Frontend validate lại trước khi submit. Backend validate tại POST /orders. |

---

## 19. Flash Sale Edge Cases

| Case | Tình huống | Xử lý |
|------|-----------|-------|
| FS-01 | Redis restart → mất stock counter | Khi Redis khởi động lại, job định kỳ sync từ MongoDB. Hoặc: khởi tạo lại counter khi detect missing key. |
| FS-02 | BullMQ job end-flash-sale bị delay | Flash Sale vẫn kết thúc đúng giờ nhờ `flashSaleEndAt` check trong code. Redis key cũng có TTL. |
| FS-03 | Admin tạo Flash Sale 2 lần cho cùng product | Nếu đang có Flash Sale active → throw error hoặc override (cần business decision). Default: throw lỗi. |
| FS-04 | Stock Flash Sale = 0 nhưng key vẫn tồn tại trong Redis | Stock = 0 xử lý đúng (DECRBY trả về âm → rollback). Key tự expire theo TTL. |
| FS-05 | User mua cuối cùng (stock = 1) và 2 user click cùng lúc | Redis DECRBY atomic: chỉ 1 user thành công (trả về 0), user còn lại trả về -1 → rollback + báo hết hàng. |
| FS-06 | Flash Sale item bị hủy order | Restock Flash Sale: phải cộng lại cả MongoDB stock lẫn Redis counter (nếu Flash Sale vẫn đang diễn ra). |

---

## 20. Concurrency & Race Conditions

### 20.1 Các điểm cần xử lý concurrency

```
1. Order creation (stock decrement)
   Pattern: MongoDB Transaction
   └─ session.startTransaction()
      try { ... all operations ... }
      catch { session.abortTransaction() }
      finally { session.endSession() }

2. Coupon usage increment
   Pattern: Atomic findOneAndUpdate
   └─ db.coupons.findOneAndUpdate(
        { _id: couponId, usedCount: { $lt: usageLimit } },
        { $inc: { usedCount: 1 } },
        { returnDocument: 'after' }
      )
      → null result = optimistic lock fail → throw 'COUPON_LIMIT_REACHED'

3. Flash Sale stock
   Pattern: Redis DECRBY (atomic by design)
   └─ xem section 9.2

4. Cart update
   Pattern: MongoDB versioning ($where hoặc optimistic locking)
   └─ Dùng __v (versionKey) của Mongoose:
      findByIdAndUpdate với { $set: ..., $inc: { __v: 0 } }
      và điều kiện { __v: expectedVersion }
      → Nếu version mismatch → retry

5. OrderCode generation
   Pattern: Redis INCR atomic
   └─ INCR 'order:counter:YYYYMMDD' → luôn unique
```

### 20.2 Deadlock prevention

```
Khi update nhiều documents trong cùng transaction:
→ Luôn update theo thứ tự ID tăng dần để tránh deadlock

Ví dụ: Decrement stock của nhiều sản phẩm:
  // ĐỐI: 
  items.forEach(item => decrement(item.productId))     ← thứ tự random

  // ĐÚNG:
  items.sort((a, b) => a.productId.localeCompare(b.productId))
       .forEach(item => decrement(item.productId))      ← thứ tự nhất quán
```

---

# PHẦN IV — API CONTRACT

## 21. API Design Principles

### 21.1 URL conventions

```
Naming:
  - Dùng danh từ số nhiều: /products, /orders, /users
  - Không dùng động từ trong URL: /products/create ← SAI
  - Nesting tối đa 2 cấp: /products/:id/variants ← OK
  - 3 cấp trở lên → flatten: /variant-images ← thay vì /products/:id/variants/:id/images

Versioning:
  - Prefix /api/v1/ cho tất cả endpoints (cấu hình global prefix)
  - Frontend gọi: https://api.domain.com/api/v1/products
```

### 21.2 HTTP methods

```
GET    → Đọc dữ liệu. Idempotent. Có thể cache.
POST   → Tạo resource mới hoặc action không idempotent (/orders, /auth/login).
PATCH  → Cập nhật một phần resource. Idempotent.
PUT    → Thay thế toàn bộ resource. Ít dùng.
DELETE → Xóa resource. Idempotent.
```

### 21.3 Pagination contract

```typescript
// Query: ?page=1&limit=20
// Response luôn bao gồm:
{
  items: T[],
  pagination: {
    page: number,       // trang hiện tại
    limit: number,      // items per page
    total: number,      // tổng số items
    totalPages: number, // total / limit (ceil)
    hasNext: boolean,
    hasPrev: boolean
  }
}
```

---

## 22. API Contract — Auth

### POST /auth/register

**Request:**
```typescript
{
  fullName: string;   // min 2, max 100 chars
  email: string;      // valid email format
  password: string;   // min 8, có uppercase + lowercase + số
                      // ví dụ: "Password123"
}
```

**Response 201:**
```typescript
{
  success: true,
  data: {
    id: string;
    email: string;
    fullName: string;
    status: "inactive";   // chưa verify email
    createdAt: string;    // ISO 8601
  },
  message: "Đăng ký thành công. Vui lòng kiểm tra email để xác nhận tài khoản."
}
```

**Errors:**
```
409 → AUTH_EMAIL_EXISTED    "Email đã được sử dụng"
400 → VALIDATION_ERROR      "password: Mật khẩu phải có ít nhất 8 ký tự..."
```

---

### POST /auth/login

**Request:**
```typescript
{
  email: string;
  password: string;
}
```

**Response 200:**
```typescript
{
  success: true,
  data: {
    accessToken: string;         // JWT, expires in 15m
    refreshToken: string;        // UUID, expires in 7d
    expiresIn: 900;              // seconds
    user: {
      id: string;
      email: string;
      fullName: string;
      role: "user" | "admin" | "moderator" | "super_admin";
      avatar: string | null;
    }
  }
}
```

**Errors:**
```
401 → AUTH_INVALID_CREDENTIALS    "Email hoặc mật khẩu không đúng"
403 → AUTH_EMAIL_NOT_VERIFIED     "Vui lòng xác nhận email trước khi đăng nhập"
403 → AUTH_ACCOUNT_LOCKED         "Tài khoản đã bị khóa. Lý do: ..."
429 → THROTTLE_EXCEEDED           "Quá nhiều lần thử. Vui lòng đợi 60 giây"
```

---

### POST /auth/refresh

**Request:**
```typescript
{
  refreshToken: string;
}
```

**Response 200:**
```typescript
{
  success: true,
  data: {
    accessToken: string;
    refreshToken: string;   // Token MỚI (rotation)
    expiresIn: 900;
  }
}
```

**Errors:**
```
401 → AUTH_TOKEN_INVALID     "Token không hợp lệ"
401 → AUTH_TOKEN_EXPIRED     "Token đã hết hạn"
401 → AUTH_TOKEN_REVOKED     "Token đã bị thu hồi"
```

---

### POST /auth/forgot-password

**Request:**
```typescript
{ email: string; }
```

**Response 200:** *(Luôn trả về 200 dù email có tồn tại hay không)*
```typescript
{
  success: true,
  message: "Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu."
}
```

---

### POST /auth/reset-password

**Request:**
```typescript
{
  token: string;       // UUID từ email
  newPassword: string; // min 8, có uppercase + lowercase + số
}
```

**Response 200:**
```typescript
{
  success: true,
  message: "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại."
}
```

**Errors:**
```
400 → AUTH_OTP_INVALID       "Liên kết không hợp lệ"
400 → AUTH_OTP_EXPIRED       "Liên kết đã hết hạn. Vui lòng yêu cầu lại"
400 → AUTH_OTP_ALREADY_USED  "Liên kết đã được sử dụng"
```

---

## 23. API Contract — Products

### GET /products

**Query params:**
```typescript
{
  page?:        number;   // default 1
  limit?:       number;   // default 20, max 100
  category?:    string;   // category slug
  brand?:       string;
  minPrice?:    number;   // VNĐ
  maxPrice?:    number;
  minRating?:   number;   // 1-5
  inStock?:     boolean;
  search?:      string;   // full-text search
  sort?:        "newest" | "best_selling" | "price_asc" | "price_desc" | "rating";
                          // default: newest
}
```

**Response 200:**
```typescript
{
  success: true,
  data: {
    items: ProductCard[],   // xem type bên dưới
    pagination: { page, limit, total, totalPages, hasNext, hasPrev }
  }
}

type ProductCard = {
  id: string;
  name: string;
  slug: string;
  thumbnailUrl: string;
  price: number;                  // giá gốc
  effectivePrice: number;         // giá sau giảm (hiển thị)
  discountPercent: number;
  isFlashSale: boolean;
  flashSaleEndAt: string | null;
  averageRating: number;
  reviewCount: number;
  soldCount: number;
  stock: number;
  categories: { id: string; name: string; slug: string }[];
  brand: string | null;
}
```

---

### GET /products/:slug

**Response 200:**
```typescript
{
  success: true,
  data: {
    id: string;
    name: string;
    slug: string;
    description: string;         // HTML
    shortDescription: string;
    images: string[];
    video: string | null;
    thumbnailUrl: string;
    price: number;
    effectivePrice: number;
    discountPercent: number;
    isFlashSale: boolean;
    flashSalePrice: number;
    flashSaleStock: number;
    flashSaleEndAt: string | null;
    stock: number;
    sku: string | null;
    weight: number;
    dimensions: { length: number; width: number; height: number } | null;
    brand: string | null;
    tags: string[];
    averageRating: number;
    reviewCount: number;
    soldCount: number;
    categories: { id: string; name: string; slug: string }[];
    variants: ProductVariant[];
    isActive: boolean;
    isFeatured: boolean;
    createdAt: string;
    metaTitle: string | null;
    metaDescription: string | null;
  }
}

type ProductVariant = {
  id: string;
  options: { name: string; value: string }[];
  price: number;
  effectivePrice: number;
  stock: number;
  sku: string | null;
  image: string | null;
}
```

**Errors:**
```
404 → PRODUCT_NOT_FOUND    "Sản phẩm không tồn tại hoặc đã bị xóa"
```

---

## 24. API Contract — Cart

### GET /cart

**Response 200:**
```typescript
{
  success: true,
  data: {
    id: string;
    items: CartItem[];
    summary: CartSummary;
  }
}

type CartItem = {
  id: string;                    // cart item id
  productId: string;
  variantId: string | null;
  productName: string;           // snapshot
  productImage: string;          // snapshot
  variantOptions: string | null; // "Màu: Đỏ, Size: L"
  snapshotPrice: number;         // giá lúc thêm vào giỏ
  currentPrice: number;          // giá hiện tại (sau khi check)
  isPriceChanged: boolean;       // true nếu giá đã thay đổi
  quantity: number;
  maxQuantity: number;           // tồn kho hiện tại (để UI giới hạn)
  isUnavailable: boolean;        // product bị xóa/deactive
  isQuantityExceeded: boolean;   // quantity > currentStock
  unavailableReason: string | null;
}

type CartSummary = {
  subtotal: number;
  shippingFee: number;
  total: number;
  itemCount: number;             // tổng số loại sản phẩm
  canCheckout: boolean;          // false nếu có items không hợp lệ
}
```

---

### POST /cart

**Request:**
```typescript
{
  productId: string;     // MongoDB ObjectId
  variantId?: string;    // nếu sản phẩm có variant
  quantity: number;      // min 1, max 99
}
```

**Response 200:**
```typescript
{
  success: true,
  data: {
    cart: Cart;           // cart đã update
    addedItem: CartItem;  // item vừa thêm/update
  },
  message: "Đã thêm vào giỏ hàng"
}
```

**Errors:**
```
404 → PRODUCT_NOT_FOUND             "Sản phẩm không tồn tại"
422 → PRODUCT_NOT_AVAILABLE         "Sản phẩm không còn được bán"
422 → PRODUCT_INSUFFICIENT_STOCK    "Không đủ hàng. Chỉ còn X sản phẩm"
422 → CART_EXCEEDS_STOCK            "Bạn đã có X sản phẩm này trong giỏ, tồn kho chỉ còn Y"
422 → CART_MAX_ITEMS_EXCEEDED       "Giỏ hàng không thể chứa quá 50 sản phẩm"
```

---

## 25. API Contract — Orders

### POST /orders

**Request:**
```typescript
{
  addressId: string;
  couponCode?: string;
  paymentMethod: "cod";    // Phase 1 chỉ có COD
  notes?: string;          // max 500 chars
}
```

**Response 201:**
```typescript
{
  success: true,
  data: {
    id: string;
    orderCode: string;         // "ORD-20251215-00042"
    status: "pending";
    shippingAddress: {
      fullName: string;
      phone: string;
      province: string;
      district: string;
      ward: string;
      streetAddress: string;
    };
    items: OrderItemResponse[];
    subtotal: number;
    shippingFee: number;
    discountAmount: number;
    couponCode: string | null;
    totalAmount: number;
    paymentMethod: string;
    paymentStatus: "pending";
    notes: string | null;
    expectedDeliveryAt: string | null;
    createdAt: string;
  },
  message: "Đặt hàng thành công! Mã đơn hàng: ORD-20251215-00042"
}

type OrderItemResponse = {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  variantOptions: string | null;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  isReviewed: boolean;
}
```

**Errors:**
```
422 → CART_EMPTY                          "Giỏ hàng trống"
422 → CART_HAS_UNAVAILABLE_ITEMS          "Giỏ hàng có sản phẩm không còn bán"
404 → ADDRESS_NOT_FOUND                   "Địa chỉ không tồn tại"
422 → PRODUCT_INSUFFICIENT_STOCK          { productName, requested, available }
422 → COUPON_NOT_FOUND                    "Mã giảm giá không tồn tại"
422 → COUPON_EXPIRED                      "Mã giảm giá đã hết hạn"
422 → COUPON_USAGE_LIMIT_REACHED          "Mã giảm giá đã hết lượt sử dụng"
422 → COUPON_USER_LIMIT_REACHED           "Bạn đã sử dụng mã này rồi"
422 → COUPON_MIN_ORDER_NOT_MET            { minOrderAmount, currentSubtotal }
```

---

### GET /orders

**Query params:**
```typescript
{
  page?:    number;
  limit?:   number;     // default 10
  status?:  OrderStatus;
}
```

**Response 200:** Danh sách order tóm tắt (không bao gồm items chi tiết).

---

### GET /orders/:id

**Response 200:** Order đầy đủ bao gồm items và statusHistory.

**Errors:**
```
404 → ORDER_NOT_FOUND    "Đơn hàng không tồn tại"
403 → FORBIDDEN          (order không thuộc về user hiện tại)
```

---

### POST /orders/:id/cancel

**Request:**
```typescript
{
  reason?: string;    // max 500 chars
}
```

**Response 200:**
```typescript
{
  success: true,
  data: { id, status: "cancelled", cancelReason },
  message: "Đơn hàng đã được hủy thành công"
}
```

**Errors:**
```
422 → ORDER_CANNOT_CANCEL   "Chỉ có thể hủy đơn hàng đang chờ xác nhận"
```

---

## 26. API Contract — Reviews

### GET /reviews/product/:productId

**Query params:**
```typescript
{
  page?:        number;
  limit?:       number;    // default 10
  rating?:      number;    // filter theo rating cụ thể (1-5)
  hasMedia?:    boolean;   // chỉ review có hình
  sort?:        "newest" | "helpful";
}
```

**Response 200:**
```typescript
{
  success: true,
  data: {
    items: ReviewResponse[];
    pagination: { ... };
    summary: {
      averageRating: number;
      totalReviews: number;
      ratingDistribution: {
        1: number; 2: number; 3: number; 4: number; 5: number;
      }
    }
  }
}

type ReviewResponse = {
  id: string;
  userId: string;
  userFullName: string;
  userAvatar: string | null;
  rating: number;
  content: string;
  images: string[];
  helpfulCount: number;
  isMyReview: boolean;     // true nếu là review của người đang đăng nhập
  isHelpful: boolean;      // true nếu người đang đăng nhập đã vote helpful
  createdAt: string;
  // orderItemId và orderId KHÔNG trả về (privacy)
}
```

---

### POST /reviews

**Request:**
```typescript
{
  orderItemId: string;      // MongoDB ObjectId
  rating: number;           // 1-5, integer
  content: string;          // min 10, max 1000 chars
  images?: string[];        // max 5 Cloudinary URLs
}
```

**Response 201:**
```typescript
{
  success: true,
  data: ReviewResponse,
  message: "Cảm ơn bạn đã đánh giá! Đánh giá sẽ được hiển thị sau khi được duyệt."
}
```

**Errors:**
```
422 → REVIEW_ORDER_ITEM_NOT_FOUND   "Không tìm thấy sản phẩm trong đơn hàng"
422 → REVIEW_ORDER_NOT_DELIVERED    "Chỉ đánh giá được đơn hàng đã giao thành công"
422 → REVIEW_ALREADY_SUBMITTED      "Bạn đã đánh giá sản phẩm này rồi"
422 → REVIEW_PERIOD_EXPIRED         "Đã quá 90 ngày kể từ khi nhận hàng"
```

---

## 27. API Contract — Coupons

### POST /coupons/validate

**Request:**
```typescript
{
  code: string;
  subtotal: number;    // giá trị giỏ hàng hiện tại (VNĐ)
}
```

**Response 200:**
```typescript
{
  success: true,
  data: {
    code: string;
    description: string | null;
    type: "percent" | "fixed_amount" | "free_shipping";
    value: number;
    discountAmount: number;       // số tiền được giảm (đã tính)
    finalShippingFee: number;     // 0 nếu là FREE_SHIPPING coupon
    isApplicable: boolean;        // luôn true nếu không throw lỗi
  }
}
```

**Errors:**
```
404 → COUPON_NOT_FOUND               "Mã giảm giá không tồn tại"
422 → COUPON_INACTIVE                "Mã giảm giá chưa kích hoạt"
422 → COUPON_NOT_STARTED             "Mã giảm giá chưa có hiệu lực"
422 → COUPON_EXPIRED                 "Mã giảm giá đã hết hạn"
422 → COUPON_USAGE_LIMIT_REACHED     "Mã giảm giá đã hết lượt sử dụng"
422 → COUPON_USER_LIMIT_REACHED      "Bạn đã dùng hết lượt cho mã này"
422 → COUPON_MIN_ORDER_NOT_MET       { minOrderAmount, currentSubtotal }
422 → COUPON_NOT_APPLICABLE_TO_CART  "Mã không áp dụng cho sản phẩm trong giỏ"
```

---

## 28. API Contract — Admin

### PATCH /admin/orders/:id/status

**Request:**
```typescript
{
  status: "confirmed" | "packing" | "shipping" | "delivered" | "cancelled" | "returned";
  note?: string;
}
```

**Response 200:**
```typescript
{
  success: true,
  data: {
    id: string;
    status: string;
    statusHistory: { status, updatedAt, updatedBy, note }[];
  },
  message: "Cập nhật trạng thái thành công"
}
```

**Errors:**
```
422 → ORDER_INVALID_STATUS_TRANSITION   "Không thể chuyển từ [current] sang [requested]"
```

---

### GET /admin/dashboard/stats

**Response 200:**
```typescript
{
  success: true,
  data: {
    revenue: {
      today: number;
      thisMonth: number;
      lastMonth: number;
      growthPercent: number;     // so sánh tháng này vs tháng trước
    };
    orders: {
      total: number;
      pending: number;
      processing: number;        // confirmed + packing + shipping
      completed: number;         // delivered
      cancelled: number;
    };
    users: {
      total: number;
      newThisMonth: number;
    };
    products: {
      total: number;
      outOfStock: number;
    };
  }
}
```

---

### GET /admin/dashboard/revenue

**Query:** `?period=day|month&year=2025&month=12` (month optional nếu period=month)

**Response 200:**
```typescript
{
  success: true,
  data: {
    period: "day" | "month";
    data: {
      label: string;      // "01/12", "Jan 2025", ...
      revenue: number;
      orderCount: number;
    }[]
  }
}
```

---

# PHẦN V — THIẾT KẾ HỆ THỐNG PHỤ TRỢ

## 29. Redis — Key Schema & TTL Map

### 29.1 Key naming convention

```
Format: {domain}:{sub-domain}:{identifier}

Ví dụ:
  product:{slug}                    → Product detail cache
  products:list:{md5-of-query}      → Product list cache
  products:flash-sale               → Flash sale list cache
  products:best-sellers             → Best sellers cache
  products:featured                 → Featured products cache
  categories:tree                   → Category tree cache
  banners:active                    → Active banners cache
  flash-sale:stock:{productId}      → Flash sale stock counter
  order:counter:{YYYYMMDD}          → Daily order counter
  user:status:{userId}              → User status cache (for guard)
  throttle:{ip}:{endpoint}          → Rate limiting (managed by @nestjs/throttler)
```

### 29.2 TTL Map đầy đủ

| Key Pattern | TTL | Invalidate Trigger | Lý do TTL |
|------------|-----|-------------------|-----------|
| `product:{slug}` | 10 phút | Product updated/deleted | Dữ liệu ít thay đổi |
| `products:list:*` | 5 phút | Product CRUD | List thay đổi thường xuyên hơn |
| `products:flash-sale` | 1 phút | Flash sale start/end | Real-time quan trọng |
| `products:best-sellers` | 30 phút | Async job (mỗi giờ) | OK nếu stale 30 phút |
| `products:featured` | 30 phút | Product isFeatured update | |
| `categories:tree` | 60 phút | Category CRUD | Rất ít thay đổi |
| `banners:active` | 30 phút | Banner CRUD | |
| `flash-sale:stock:{id}` | Đến `flashSaleEndAt` + 5 phút | Explicit delete khi end | Auto cleanup |
| `order:counter:{date}` | Đến hết ngày | Không cần (counter chỉ tăng) | |
| `user:status:{userId}` | 30 giây | User locked/unlocked | Short TTL để lock có hiệu lực sớm |

### 29.3 Pattern delete cho list cache

```typescript
// Khi cần xóa tất cả list cache (pattern delete)
// KHÔNG dùng KEYS * trong production (blocking)
// Dùng SCAN với cursor:

async deleteByPattern(pattern: string): Promise<void> {
  const stream = this.redis.scanStream({ match: pattern, count: 100 });
  const pipeline = this.redis.pipeline();

  stream.on('data', (keys: string[]) => {
    keys.forEach(key => pipeline.del(key));
  });

  stream.on('end', () => pipeline.exec());
}

// Gọi:
await this.deleteByPattern('products:list:*');
```

---

## 30. BullMQ — Job Schema & Retry Strategy

### 30.1 Queue config mặc định

```typescript
// Shared queue options
const DEFAULT_QUEUE_OPTIONS = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,   // 5s, 25s, 125s
    },
    removeOnComplete: { count: 100 },    // giữ 100 jobs đã done gần nhất
    removeOnFail: { count: 500 },        // giữ 500 jobs fail để debug
  },
};
```

### 30.2 Job definitions chi tiết

```typescript
// ─── EMAIL QUEUE ───────────────────────────────
Queue: 'email'
Concurrency: 5

Jobs:
  'send-verify-email'
    payload: { to: string, fullName: string, token: string }
    attempts: 5    // email quan trọng, retry nhiều hơn
    timeout: 30s

  'send-reset-password'
    payload: { to: string, fullName: string, token: string, expiresInMinutes: 60 }
    attempts: 5
    timeout: 30s

  'send-order-confirmation'
    payload: {
      to: string, fullName: string,
      orderCode: string, totalAmount: number,
      items: { name, quantity, price }[],
      shippingAddress: string
    }
    attempts: 3
    timeout: 30s

  'send-order-status-update'
    payload: { to: string, fullName: string, orderCode: string, newStatus: string, message: string }
    attempts: 3

  'send-password-changed-notice'
    payload: { to: string, fullName: string, changedAt: Date }
    attempts: 2   // không quan trọng bằng các email trên

// ─── NOTIFICATION QUEUE ────────────────────────
Queue: 'notification'
Concurrency: 10

Jobs:
  'create-notification'
    payload: { userId, type, title, message, link?, data? }
    attempts: 3

  'create-bulk-notifications'     // broadcast (admin gửi cho nhiều user)
    payload: { userIds: string[], type, title, message, link? }
    attempts: 2

// ─── ORDER QUEUE ───────────────────────────────
Queue: 'order'
Concurrency: 3

Jobs:
  'update-product-sold-count'
    payload: { items: { productId: string, quantity: number }[] }
    attempts: 3
    delay: 5000   // 5 giây delay sau khi order delivered

  'auto-cancel-pending-orders'    // CRON: mỗi ngày 2am
    payload: { olderThanHours: 48 }   // hủy orders pending > 48h
    repeat: { cron: '0 2 * * *' }
    attempts: 1

// ─── ANALYTICS QUEUE ───────────────────────────
Queue: 'analytics'
Concurrency: 20    // high concurrency, low priority

Jobs:
  'record-product-view'
    payload: { productId, userId?, sessionId, viewedAt }
    attempts: 1    // analytics không cần reliable
    removeOnComplete: true

  'update-product-view-count'    // CRON: mỗi 5 phút batch update
    repeat: { every: 300000 }   // aggregate từ analytics records → update product.viewCount

// ─── IMAGE PROCESSING QUEUE ─────────────────────
Queue: 'image-processing'
Concurrency: 2    // CPU/bandwidth intensive

Jobs:
  'generate-thumbnail'
    payload: { publicId: string, productId?: string }
    attempts: 3

// ─── FLASH SALE QUEUE ───────────────────────────
Queue: 'flash-sale'
Concurrency: 1    // chỉ 1 job cùng lúc để tránh conflict

Jobs:
  'start-flash-sale'           // scheduled by delay
    payload: { productId: string }
    attempts: 3

  'end-flash-sale'             // scheduled by delay
    payload: { productId: string }
    attempts: 3
```

### 30.3 Dead Letter Queue handling

```typescript
// Khi job fail hết attempts: chuyển vào dead letter (fail queue)
// Monitor định kỳ:

@Cron('0 9 * * *')    // mỗi ngày 9am
async alertFailedJobs() {
  const counts = await emailQueue.getFailedCount();
  if (counts > 10) {
    // Alert slack/email tới team
    logger.error(`Email queue có ${counts} jobs thất bại cần xử lý`);
  }
}
```

---

## 31. Socket.IO — Room Strategy & Event Contract

### 31.1 Room strategy

```typescript
// Rooms:
// - user:{userId}    → events cá nhân (order updates, notifications)
// - admin            → events cho admin (new orders, alerts)
// - broadcast        → events cho tất cả (flash sale)

// Khi user kết nối:
@SubscribeMessage('connect')
handleConnection(socket: Socket) {
  const userId = socket.handshake.auth.userId;   // extracted từ JWT

  if (userId) {
    socket.join(`user:${userId}`);
  }

  if (user.role === 'admin' || user.role === 'super_admin') {
    socket.join('admin');
  }
}
```

### 31.2 Event contract

```typescript
// ─── SERVER → CLIENT ─────────────────────────

// Order status thay đổi
Event: 'order:status-updated'
Room: user:{userId}
Payload: {
  orderId: string;
  orderCode: string;
  status: OrderStatus;
  message: string;      // "Đơn hàng của bạn đang được đóng gói"
  updatedAt: string;    // ISO 8601
}

// Thông báo mới
Event: 'notification:new'
Room: user:{userId}
Payload: {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  createdAt: string;
}

// Đơn hàng mới (cho admin dashboard)
Event: 'order:new'
Room: admin
Payload: {
  orderId: string;
  orderCode: string;
  totalAmount: number;
  userId: string;
  createdAt: string;
}

// Flash Sale bắt đầu
Event: 'flash-sale:started'
Room: broadcast (io.emit)
Payload: {
  productId: string;
  productName: string;
  salePrice: number;
  originalPrice: number;
  stock: number;
  endAt: string;
}

// Cập nhật tồn kho Flash Sale (throttled: max 1/giây/product)
Event: 'flash-sale:stock-update'
Room: broadcast
Payload: { productId: string; remainingStock: number; }

// Flash Sale kết thúc
Event: 'flash-sale:ended'
Room: broadcast
Payload: { productId: string; }

// ─── CLIENT → SERVER ─────────────────────────

// (Hiện không có client→server events bắt buộc ngoài connection)
// Theo dõi đơn hàng cụ thể (optional optimization)
Event: 'order:subscribe'
Payload: { orderId: string }

Event: 'order:unsubscribe'
Payload: { orderId: string }
```

---

## 32. Email — Template & Trigger Map

### 32.1 Template list

| Template | File | Trigger | Priority |
|----------|------|---------|----------|
| `verify-email` | verify-email.hbs | Sau khi đăng ký | Critical |
| `reset-password` | reset-password.hbs | Forgot password request | Critical |
| `order-confirmation` | order-confirmation.hbs | Tạo order thành công | High |
| `order-status-update` | order-status-update.hbs | Admin update status | Medium |
| `order-cancelled` | order-cancelled.hbs | Order bị hủy | Medium |
| `password-changed` | password-changed.hbs | Đổi/reset password thành công | Low |
| `account-locked` | account-locked.hbs | Admin lock account | High |

### 32.2 Template variables

```handlebars
{{!-- verify-email.hbs --}}
Biến: { fullName, verifyUrl, expiresInMinutes: 60 }

{{!-- reset-password.hbs --}}
Biến: { fullName, resetUrl, expiresInMinutes: 60 }

{{!-- order-confirmation.hbs --}}
Biến: { fullName, orderCode, orderUrl, items[], subtotal, shippingFee, total, shippingAddress }

{{!-- order-status-update.hbs --}}
Biến: { fullName, orderCode, orderUrl, oldStatus, newStatus, statusMessage, note? }
```

---

## 33. Audit Log — What, When, Why

### 33.1 Những gì cần log

```
Nguyên tắc: Ghi log mọi action của admin/moderator có thể ảnh hưởng đến dữ liệu.

PHẢI ghi:
  product.create          Admin tạo sản phẩm
  product.update          Admin cập nhật sản phẩm
  product.delete          Admin xóa sản phẩm
  product.toggle_active   Admin ẩn/hiện sản phẩm
  order.status_update     Admin đổi trạng thái đơn hàng
  user.lock               Admin khóa tài khoản user
  user.unlock             Admin mở khóa
  user.change_role        Super Admin đổi role
  review.approve          Moderator duyệt review
  review.hide             Moderator ẩn review
  review.delete           Admin xóa review
  coupon.create           Admin tạo coupon
  coupon.update           Admin sửa coupon
  coupon.delete           Admin xóa coupon
  banner.create           Admin tạo banner
  banner.delete           Admin xóa banner

KHÔNG cần ghi:
  GET requests (chỉ đọc)
  User tự sửa profile của mình
  User tạo/hủy đơn hàng (đã có statusHistory trong Order)
```

### 33.2 AuditLog trong code

```typescript
// AuditInterceptor tự động ghi log cho tất cả admin endpoints

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(async (response) => {
        const request = context.switchToHttp().getRequest();
        const auditMeta = Reflect.getMetadata('audit', context.getHandler());
        if (!auditMeta) return;

        await this.auditLogService.create({
          userId: request.user.id,
          action: auditMeta.action,
          resource: auditMeta.resource,
          resourceId: request.params.id,
          after: response?.data,
          ipAddress: request.ip,
        });
      }),
    );
  }
}

// Sử dụng decorator trên controller method:
@Patch(':id/status')
@Audit({ action: 'order.status_update', resource: 'orders' })
async updateStatus(...) {}
```

---

# PHẦN VI — TRIỂN KHAI CHI TIẾT TỪNG MODULE

## 34. Module: Auth

### 34.1 Files & responsibilities

```
auth/
├── auth.module.ts
│   imports: UsersModule, JwtModule, PassportModule
│   providers: AuthService, LocalStrategy, JwtStrategy, JwtRefreshStrategy
│
├── auth.controller.ts
│   POST /auth/register       → authService.register()
│   POST /auth/login          → authService.login()      [@Public]
│   POST /auth/logout         → authService.logout()
│   POST /auth/refresh        → authService.refresh()    [@Public]
│   POST /auth/forgot-password → authService.forgotPassword() [@Public]
│   POST /auth/reset-password  → authService.resetPassword()  [@Public]
│   POST /auth/verify-email    → authService.verifyEmail()    [@Public]
│   GET  /auth/me             → return req.user
│
├── auth.service.ts
│   Orchestrates tất cả auth flows
│
├── dto/
│   ├── register.dto.ts        { fullName, email, password }
│   ├── login.dto.ts           { email, password }
│   ├── forgot-password.dto.ts { email }
│   ├── reset-password.dto.ts  { token, newPassword }
│   ├── verify-email.dto.ts    { token }
│   └── refresh-token.dto.ts   { refreshToken }
│
└── strategies/
    ├── local.strategy.ts         Dùng cho login (validate email+password)
    ├── jwt.strategy.ts           Dùng cho protected routes
    └── jwt-refresh.strategy.ts   Dùng cho /auth/refresh
```

### 34.2 JWT Payload structure

```typescript
// Access Token payload
interface JwtPayload {
  sub: string;       // userId
  email: string;
  role: UserRole;
  iat: number;       // issued at
  exp: number;       // expires at
}

// Không đặt sensitive data vào JWT payload
// Không đặt toàn bộ user object (payload bị decode client-side)
```

---

## 35. Module: Users & Addresses

### 35.1 Files

```
users/
├── users.controller.ts      # /users/me, /users/me/password
├── users.admin.controller.ts # /admin/users
├── users.service.ts
├── users.repository.ts
│
addresses/
├── addresses.controller.ts   # /addresses CRUD
├── addresses.service.ts
└── addresses.repository.ts
```

### 35.2 Business rules

```
Users:
- Một user chỉ có 1 email (unique)
- Đổi email cần verify lại (Phase 2)
- Xóa user: soft delete (không xóa cứng) hoặc lock

Addresses:
- Một user có tối đa 10 địa chỉ
- Khi thêm địa chỉ đầu tiên: tự động set isDefault = true
- Khi set isDefault: unset isDefault của địa chỉ cũ
- Không thể xóa địa chỉ default nếu đang có đơn hàng pending
- Khi xóa địa chỉ: soft delete (orders đã có vẫn có snapshot)
```

---

## 36. Module: Categories

### 36.1 Files

```
categories/
├── categories.controller.ts        # GET /categories (public)
├── categories.admin.controller.ts  # CRUD /admin/categories
├── categories.service.ts
└── categories.repository.ts
```

### 36.2 Tree structure

```typescript
// Lấy category tree (đệ quy 2 cấp)
async getCategoryTree(): Promise<CategoryTree[]> {
  const cached = await this.cache.get(CACHE_KEYS.CATEGORY_TREE());
  if (cached) return cached;

  // Lấy tất cả categories active
  const all = await this.categoryRepository.findAll({ isActive: true });

  // Build tree trong memory (không cần recursive DB query)
  const rootCategories = all.filter(c => c.parentId === null);
  const tree = rootCategories.map(root => ({
    ...root,
    children: all.filter(c => c.parentId?.equals(root._id))
  }));

  await this.cache.set(CACHE_KEYS.CATEGORY_TREE(), tree, 3600);
  return tree;
}
```

---

## 37. Module: Products

### 37.1 Files

```
products/
├── products.controller.ts        # Public product endpoints
├── products.admin.controller.ts  # Admin CRUD
├── products.service.ts
├── products.repository.ts
└── schemas/
    ├── product.schema.ts
    └── product-variant.schema.ts
```

### 37.2 Repository methods cần implement

```typescript
interface IProductRepository {
  findBySlug(slug: string, filter?: Partial<Product>): Promise<Product | null>;
  findById(id: string): Promise<Product | null>;
  findMany(filter: ProductFilter, sort: SortConfig, pagination: Pagination): Promise<PaginatedResult<Product>>;
  findByIds(ids: string[]): Promise<Product[]>;
  findFlashSale(): Promise<Product[]>;
  findFeatured(limit: number): Promise<Product[]>;
  findBestSellers(limit: number): Promise<Product[]>;
  findNewest(limit: number): Promise<Product[]>;
  findRelated(productId: string, categoryIds: string[], limit: number): Promise<Product[]>;
  create(data: CreateProductData): Promise<Product>;
  update(id: string, data: Partial<Product>): Promise<Product | null>;
  softDelete(id: string): Promise<void>;
  decrementStock(id: string, variantId: string | null, quantity: number, session?: ClientSession): Promise<void>;
  incrementStock(id: string, variantId: string | null, quantity: number): Promise<void>;
  updateStats(id: string, stats: Partial<{ soldCount, viewCount, averageRating, reviewCount }>): Promise<void>;
}
```

### 37.3 Full-text search implementation

```typescript
// Dùng MongoDB Text Index
// Schema đã có: ProductSchema.index({ name: 'text', description: 'text', tags: 'text' })

async searchProducts(query: string): Promise<Product[]> {
  return this.productModel.find(
    {
      $text: { $search: query, $language: 'none' },  // 'none' để support tiếng Việt
      isActive: true
    },
    {
      score: { $meta: 'textScore' }  // relevance score
    }
  ).sort({ score: { $meta: 'textScore' } });
}

// Lưu ý tiếng Việt: MongoDB text search không tốt với tiếng Việt có dấu.
// Production recommendation: Dùng Elasticsearch hoặc Atlas Search (Phase 2).
// Phase 1: Dùng regex case-insensitive + text index kết hợp.
```

---

## 38. Module: Cart

### 38.1 Files & schema

```
cart/
├── cart.controller.ts
├── cart.service.ts
└── schemas/
    └── cart.schema.ts       # Embedded CartItems (không tách collection)
```

### 38.2 Cart schema (embedded)

```typescript
// Cart dùng embedded document (không tách CartItem collection)
// Lý do: cart thường được đọc toàn bộ, embedded = 1 query, nhanh hơn

@Schema({ timestamps: true })
export class Cart {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: [CartItemSchema], default: [] })
  items: CartItem[];    // max 50 items
}

@Schema({ _id: true, timestamps: false })
export class CartItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true }) productId;
  @Prop({ type: Types.ObjectId, ref: 'ProductVariant' })          variantId?;

  // Snapshots tại thời điểm thêm vào giỏ
  @Prop({ required: true }) productName: string;
  @Prop({ required: true }) productImage: string;
  @Prop()                   variantOptions?: string;
  @Prop({ required: true }) price: number;    // giá lúc add

  @Prop({ required: true, min: 1, max: 99 }) quantity: number;
  @Prop({ required: true }) addedAt: Date;
}
```

---

## 39. Module: Orders

### 39.1 Files

```
orders/
├── orders.controller.ts         # User order endpoints
├── orders.admin.controller.ts   # Admin order management
├── orders.service.ts
└── orders.repository.ts
```

### 39.2 Transaction helper

```typescript
// Wrapper để dễ sử dụng MongoDB transaction
async withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await this.connection.startSession();
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// Sử dụng trong orders.service.ts:
return this.withTransaction(async (session) => {
  await this.productRepository.decrementStock(productId, null, qty, session);
  const order = await this.orderRepository.create(orderData, session);
  await this.orderItemRepository.createMany(itemsData, session);
  await this.couponRepository.incrementUsed(couponId, session);
  await this.cartRepository.clear(userId, session);
  return order;
});
```

---

## 40. Module: Reviews

### 40.1 Files

```
reviews/
├── reviews.controller.ts          # Public + user endpoints
├── reviews.admin.controller.ts    # Admin management
├── reviews.service.ts
└── reviews.repository.ts
```

### 40.2 Rating recalculation

```typescript
// Được gọi sau khi approve/hide/delete review
async recalculateProductRating(productId: string): Promise<void> {
  const result = await this.reviewModel.aggregate([
    { $match: { productId: new Types.ObjectId(productId), isApproved: true, isHidden: false } },
    { $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 }
      }
    }
  ]);

  const stats = result[0] ?? { averageRating: 0, reviewCount: 0 };

  await this.productRepository.updateStats(productId, {
    averageRating: Math.round(stats.averageRating * 10) / 10,  // 1 decimal
    reviewCount: stats.reviewCount
  });

  await this.cacheManager.del(CACHE_KEYS.PRODUCT_DETAIL(productSlug));
}
```

---

## 41. Module: Coupons

### 41.1 Files

```
coupons/
├── coupons.controller.ts         # POST /coupons/validate
├── coupons.admin.controller.ts   # Admin CRUD
├── coupons.service.ts            # validate + calculateDiscount
└── schemas/
    ├── coupon.schema.ts
    └── coupon-usage.schema.ts
```

### 41.2 Atomic usage increment

```typescript
async atomicIncrementUsage(couponId: string, userId: string, orderId: string, discountAmount: number): Promise<void> {
  // Atomic: chỉ increment nếu chưa đạt limit
  const updated = await this.couponModel.findOneAndUpdate(
    {
      _id: couponId,
      $or: [
        { usageLimit: 0 },                                           // unlimited
        { $expr: { $lt: ['$usedCount', '$usageLimit'] } }            // còn slot
      ]
    },
    { $inc: { usedCount: 1 } },
    { new: true }
  );

  if (!updated) throw new BusinessException('COUPON_USAGE_LIMIT_REACHED', 422);

  // Ghi usage record
  await this.couponUsageModel.create({ couponId, userId, orderId, discountAmount });
}
```

---

## 42. Module: Banners

### 42.1 Business rules

```
- Banner có thể có thời gian hiển thị (startAt, endAt)
- Khi GET /banners: chỉ lấy banner active VÀ trong thời gian hiển thị
- Sắp xếp theo field `order` tăng dần
- Admin có thể drag-and-drop reorder (PATCH /admin/banners/reorder)
```

### 42.2 Reorder implementation

```typescript
// PATCH /admin/banners/reorder
// Body: { orderedIds: string[] }  // mảng ID theo thứ tự mới

async reorder(orderedIds: string[]): Promise<void> {
  const bulkOps = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: new Types.ObjectId(id) },
      update: { $set: { order: index } }
    }
  }));

  await this.bannerModel.bulkWrite(bulkOps);
  await this.cacheManager.del(CACHE_KEYS.BANNERS());
}
```

---

## 43. Module: Notifications

### 43.1 Files

```
notifications/
├── notifications.controller.ts    # User notification endpoints
├── notifications.service.ts       # Create + query
├── notifications.gateway.ts       # Socket.IO gateway
└── notifications.processor.ts     # BullMQ processor
```

### 43.2 Gateway authentication

```typescript
@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL } })
export class NotificationsGateway {
  @WebSocketServer() server: Server;

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth.token;
      const payload = this.jwtService.verify(token);
      const user = await this.usersService.findById(payload.sub);

      if (!user || user.status !== 'active') {
        socket.disconnect();
        return;
      }

      socket['userId'] = user.id;
      socket['userRole'] = user.role;

      // Join personal room
      await socket.join(`user:${user.id}`);

      // Join admin room
      if (['admin', 'super_admin', 'moderator'].includes(user.role)) {
        await socket.join('admin');
      }

    } catch {
      socket.disconnect();
    }
  }
}
```

---

## 44. Module: Upload

### 44.1 Cloudinary configuration

```typescript
// config/cloudinary.config.ts
export const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

// Folder structure trên Cloudinary:
ecommerce/
├── products/          ← ảnh sản phẩm
├── categories/        ← ảnh danh mục
├── banners/           ← ảnh banner
├── reviews/           ← ảnh trong review
└── avatars/           ← avatar user
```

### 44.2 Upload với transformation

```typescript
async uploadToCloudinary(
  buffer: Buffer,
  options: { folder: string; publicId?: string }
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `ecommerce/${options.folder}`,
        public_id: options.publicId,
        overwrite: true,
        transformation: [
          { width: 1200, height: 1200, crop: 'limit', quality: 'auto' },
          { fetch_format: 'auto' }    // auto WebP cho Chrome
        ],
        eager: [
          { width: 400,  height: 400,  crop: 'fill', gravity: 'auto' },
          { width: 100,  height: 100,  crop: 'fill', gravity: 'auto' }
        ],
        eager_async: true,   // không chờ eager transformations
      },
      (error, result) => error ? reject(error) : resolve(result)
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}
```

---

## 45. Module: Dashboard

### 45.1 Revenue calculation

```typescript
// Revenue theo ngày (trong tháng)
async getRevenueByDay(year: number, month: number) {
  return this.orderModel.aggregate([
    {
      $match: {
        status: 'delivered',
        createdAt: {
          $gte: new Date(year, month - 1, 1),
          $lt: new Date(year, month, 1)
        }
      }
    },
    {
      $group: {
        _id: { $dayOfMonth: '$createdAt' },
        revenue: { $sum: '$totalAmount' },
        orderCount: { $sum: 1 }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
}

// Best sellers (30 ngày gần nhất)
async getBestSellers(limit = 10) {
  return this.orderItemModel.aggregate([
    {
      $lookup: {
        from: 'orders',
        localField: 'orderId',
        foreignField: '_id',
        as: 'order'
      }
    },
    { $unwind: '$order' },
    {
      $match: {
        'order.status': 'delivered',
        'order.createdAt': { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    },
    {
      $group: {
        _id: '$productId',
        totalSold: { $sum: '$quantity' },
        revenue: { $sum: '$totalPrice' },
        productName: { $first: '$productName' },
        productImage: { $first: '$productImage' }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: limit }
  ]);
}
```

---

# PHẦN VII — VẬN HÀNH

## 46. Error Taxonomy & HTTP Status Map

### 46.1 Error code conventions

```
Format: {MODULE}_{ERROR_NOUN}
Luôn viết hoa, dùng underscore

Module prefixes:
  AUTH_       → Authentication & Authorization
  PRODUCT_    → Products
  VARIANT_    → Product Variants
  CATEGORY_   → Categories
  CART_       → Cart
  ORDER_      → Orders
  REVIEW_     → Reviews
  COUPON_     → Coupons
  ADDRESS_    → Addresses
  UPLOAD_     → File Upload
  USER_       → User management
  FLASH_SALE_ → Flash Sale
  NOTIF_      → Notifications
  SYS_        → System errors
```

### 46.2 Full error code map

```typescript
// auth errors
AUTH_EMAIL_EXISTED           409    "Email đã được sử dụng"
AUTH_INVALID_CREDENTIALS     401    "Email hoặc mật khẩu không đúng"
AUTH_EMAIL_NOT_VERIFIED      403    "Vui lòng xác nhận email trước khi đăng nhập"
AUTH_ACCOUNT_LOCKED          403    "Tài khoản đã bị khóa"
AUTH_TOKEN_INVALID           401    "Token không hợp lệ"
AUTH_TOKEN_EXPIRED           401    "Token đã hết hạn"
AUTH_TOKEN_REVOKED           401    "Token đã bị thu hồi"
AUTH_OTP_INVALID             400    "Liên kết không hợp lệ"
AUTH_OTP_EXPIRED             400    "Liên kết đã hết hạn"
AUTH_OTP_ALREADY_USED        400    "Liên kết đã được sử dụng"

// product errors
PRODUCT_NOT_FOUND            404    "Sản phẩm không tồn tại"
PRODUCT_NOT_AVAILABLE        422    "Sản phẩm không còn được bán"
PRODUCT_INSUFFICIENT_STOCK   422    "Không đủ hàng trong kho"
PRODUCT_SLUG_EXISTED         409    "Slug đã tồn tại"

// variant errors
VARIANT_NOT_FOUND            404    "Biến thể không tồn tại"
VARIANT_MISMATCH             422    "Biến thể không thuộc sản phẩm này"

// cart errors
CART_EMPTY                   422    "Giỏ hàng trống"
CART_EXCEEDS_STOCK           422    "Số lượng vượt quá tồn kho"
CART_MAX_ITEMS_EXCEEDED      422    "Giỏ hàng không thể chứa quá 50 sản phẩm"
CART_HAS_UNAVAILABLE_ITEMS   422    "Có sản phẩm không còn bán trong giỏ"

// order errors
ORDER_NOT_FOUND              404    "Đơn hàng không tồn tại"
ORDER_CANNOT_CANCEL          422    "Không thể hủy đơn hàng ở trạng thái này"
ORDER_INVALID_STATUS_TRANSITION 422 "Không thể chuyển trạng thái"
ORDER_STOCK_CONFLICT         409    "Tạm thời không thể xử lý. Vui lòng thử lại"

// review errors
REVIEW_ORDER_ITEM_NOT_FOUND  422    "Không tìm thấy sản phẩm trong đơn hàng"
REVIEW_ORDER_NOT_DELIVERED   422    "Chỉ đánh giá được đơn hàng đã giao thành công"
REVIEW_ALREADY_SUBMITTED     409    "Bạn đã đánh giá sản phẩm này rồi"
REVIEW_PERIOD_EXPIRED        422    "Đã quá thời gian cho phép đánh giá"

// coupon errors
COUPON_NOT_FOUND             404    "Mã giảm giá không tồn tại"
COUPON_INACTIVE              422    "Mã giảm giá chưa kích hoạt"
COUPON_NOT_STARTED           422    "Mã giảm giá chưa có hiệu lực"
COUPON_EXPIRED               422    "Mã giảm giá đã hết hạn"
COUPON_USAGE_LIMIT_REACHED   422    "Mã giảm giá đã hết lượt sử dụng"
COUPON_USER_LIMIT_REACHED    422    "Bạn đã dùng hết lượt cho mã này"
COUPON_MIN_ORDER_NOT_MET     422    "Chưa đạt giá trị đơn hàng tối thiểu"
COUPON_NOT_APPLICABLE_TO_CART 422   "Mã không áp dụng cho sản phẩm trong giỏ"

// address errors
ADDRESS_NOT_FOUND            404    "Địa chỉ không tồn tại"
ADDRESS_MAX_EXCEEDED         422    "Tối đa 10 địa chỉ"
ADDRESS_CANNOT_DELETE_DEFAULT 422   "Không thể xóa địa chỉ mặc định đang có đơn hàng"

// upload errors
UPLOAD_INVALID_TYPE          400    "Định dạng file không hợp lệ"
UPLOAD_FILE_TOO_LARGE        400    "File quá lớn. Tối đa 5MB"

// user errors
USER_NOT_FOUND               404    "Người dùng không tồn tại"
USER_ALREADY_LOCKED          422    "Tài khoản đã bị khóa"
USER_NOT_LOCKED              422    "Tài khoản không bị khóa"

// category errors
CATEGORY_NOT_FOUND           404    "Danh mục không tồn tại"
CATEGORY_HAS_PRODUCTS        422    "Danh mục đang có sản phẩm, không thể xóa"

// flash sale errors
FLASH_SALE_OUT_OF_STOCK      422    "Đã hết hàng flash sale"
FLASH_SALE_ALREADY_ACTIVE    422    "Sản phẩm đang có flash sale"
FLASH_SALE_PRICE_INVALID     422    "Giá flash sale phải nhỏ hơn giá gốc"

// system errors
SYS_INTERNAL_ERROR           500    "Đã có lỗi xảy ra. Vui lòng thử lại sau"
SYS_SERVICE_UNAVAILABLE      503    "Dịch vụ tạm thời không khả dụng"
```

---

## 47. Logging Strategy

### 47.1 Log levels & khi nào dùng

```
ERROR   → Lỗi cần xử lý ngay: DB connection fail, unhandled exception, payment fail
WARN    → Lỗi không critical: rate limit hit, cache miss rate cao, deprecated API
INFO    → Events quan trọng: user đăng ký, order tạo, order delivered, admin actions
DEBUG   → Chi tiết kỹ thuật: query thực thi, cache hit/miss, job enqueue (chỉ DEV)
VERBOSE → Mọi thứ (chỉ khi debug sự cố cụ thể)
```

### 47.2 Structured log format

```json
{
  "timestamp": "2025-12-15T10:30:45.123Z",
  "level": "INFO",
  "context": "OrdersService",
  "message": "Order created successfully",
  "data": {
    "orderId": "...",
    "orderCode": "ORD-20251215-00042",
    "userId": "...",
    "totalAmount": 450000
  },
  "requestId": "req-uuid-here",
  "duration": 245
}
```

### 47.3 Những gì KHÔNG được log

```
KHÔNG BAO GIỜ log:
  - Password (kể cả hashed)
  - JWT tokens đầy đủ
  - Refresh tokens
  - Credit card numbers
  - OTP tokens
  - API keys / secrets
  - Personal data nhạy cảm (CCCD, passport number)
```

---

## 48. Health Check & Graceful Shutdown

### 48.1 Health check endpoint

```typescript
// modules/health/health.controller.ts
@Get('/health')
@Public()
async check() {
  const mongoStatus = await this.checkMongo();
  const redisStatus = await this.checkRedis();

  const isHealthy = mongoStatus && redisStatus;

  return {
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      mongodb: mongoStatus ? 'up' : 'down',
      redis: redisStatus ? 'up' : 'down',
    }
  };
  // HTTP 200 nếu ok, 503 nếu degraded
}
```

### 48.2 Graceful shutdown

```typescript
// main.ts
app.enableShutdownHooks();

// app.module.ts implements OnModuleDestroy
async onModuleDestroy() {
  // 1. Stop accepting new connections
  // 2. Drain BullMQ queues (finish in-progress jobs)
  // 3. Close Redis connection
  // 4. Close MongoDB connection
  logger.log('Application shutting down gracefully');
}
```

---

## 49. Database Indexing Strategy

### 49.1 Index analysis by query pattern

```typescript
// Các query phổ biến và index tương ứng:

// GET /products (listing)
// filter: { isActive: 1, categories: ..., price: range, averageRating: gte }
// sort: { createdAt: -1 } or { soldCount: -1 } or { price: 1/-1 }
ProductSchema.index({ isActive: 1, createdAt: -1 });
ProductSchema.index({ isActive: 1, soldCount: -1 });
ProductSchema.index({ isActive: 1, averageRating: -1 });
ProductSchema.index({ isActive: 1, price: 1 });
ProductSchema.index({ categories: 1, isActive: 1 });

// GET /products/flash-sale
ProductSchema.index({ isActive: 1, isFlashSale: 1 });

// Admin: products by status + pagination
ProductSchema.index({ isActive: 1, createdAt: -1 });

// GET /orders (user)
OrderSchema.index({ userId: 1, createdAt: -1 });
// Admin: orders by status
OrderSchema.index({ status: 1, createdAt: -1 });

// GET /reviews (product)
ReviewSchema.index({ productId: 1, isApproved: 1, isHidden: 1, createdAt: -1 });

// CouponUsage: check user usage
CouponUsageSchema.index({ couponId: 1, userId: 1 });

// Notifications: user + unread
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// AuditLogs: admin actions
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ resource: 1, resourceId: 1, createdAt: -1 });
```

### 49.2 Index warnings

```
⚠ Quá nhiều index = write chậm hơn
  → Chỉ tạo index cho queries thực sự cần thiết
  → Dùng MongoDB Atlas Performance Advisor để detect missing indexes

⚠ Compound index: thứ tự field quan trọng
  → { isActive: 1, createdAt: -1 } phục vụ:
      - filter by isActive only ✅
      - filter by isActive + sort by createdAt ✅
      - sort by createdAt only ❌ (không dùng được)

⚠ Text index chỉ 1 per collection
  → Gộp tất cả searchable fields vào 1 text index
```

---

## 50. Implementation Checklist

### 50.1 Checklist khi implement mỗi module

```
Trước khi viết code:
  ☐ Đã đọc data flow cho module này (Phần II)
  ☐ Đã đọc edge cases cho module này (Phần III)
  ☐ Đã xác định API contract (Phần IV)
  ☐ Đã biết cache keys và TTL cần dùng (Phần V)
  ☐ Đã biết BullMQ jobs nào cần enqueue

Khi implement:
  ☐ Repository không có business logic
  ☐ Service không import Model trực tiếp
  ☐ Tất cả DTO có @ApiProperty (Swagger)
  ☐ Tất cả errors dùng BusinessException với error code đúng
  ☐ Cache được set sau mỗi DB read
  ☐ Cache bị invalidate sau mỗi mutation
  ☐ Side-effects (email, notification) đi qua BullMQ
  ☐ Admin endpoints có @Audit decorator
  ☐ Sensitive routes có @Roles decorator
  ☐ ObjectId params qua ParseObjectIdPipe

Sau khi implement:
  ☐ Unit test cho service (mock repository)
  ☐ Integration test cho controller (real DB)
  ☐ Swagger docs đầy đủ, response examples
  ☐ Error codes documented
```

### 50.2 Thứ tự implement modules

```
Sprint 1 (Foundation):
  1. Common infrastructure (guards, interceptors, filters, pipes)
  2. Auth module (register, login, refresh, forgot/reset password)
  3. Email module (templates + queue processor)
  4. Upload module (Cloudinary integration)

Sprint 2 (Core catalog):
  5. Categories module
  6. Products module (CRUD + caching)
  7. Product Variants

Sprint 3 (Shopping):
  8. Addresses module
  9. Cart module
  10. Coupons module

Sprint 4 (Transactions):
  11. Orders module (create + status management)
  12. Flash Sale integration (BullMQ + Redis + Socket)

Sprint 5 (Social + Realtime):
  13. Reviews module
  14. Notifications module (BullMQ + Socket.IO)
  15. Banners module

Sprint 6 (Admin + Analytics):
  16. Dashboard module
  17. Audit logs
```

### 50.3 Definition of Done cho mỗi endpoint

```
Một endpoint được coi là DONE khi:

  Functionality:
  ☐ Happy path hoạt động đúng
  ☐ Tất cả edge cases đã xử lý
  ☐ Error responses đúng format và HTTP status
  ☐ Cache được implement (nếu applicable)
  ☐ BullMQ jobs được enqueue (nếu applicable)
  ☐ Audit log được ghi (nếu admin endpoint)

  Quality:
  ☐ Unit test coverage >= 80% cho service
  ☐ Integration test cho happy path + ít nhất 2 error cases
  ☐ Không có TypeScript errors
  ☐ Không có ESLint warnings

  Documentation:
  ☐ Swagger: @ApiOperation, @ApiResponse (200 + error cases)
  ☐ DTO: @ApiProperty với example values
  ☐ Complex logic có comment giải thích
```

---

## Phụ Lục — Quick Reference

### A. Tóm tắt các business rules quan trọng

```
Đặt hàng:
  - Phải có địa chỉ giao hàng
  - Cart không có sản phẩm không khả dụng
  - Stock được kiểm tra và lock trong transaction
  - Coupon chỉ increment usedCount khi order CONFIRMED

Hủy đơn:
  - User: chỉ khi status = PENDING
  - Admin: có thể hủy đến CONFIRMED
  - Hủy → restock + hoàn coupon usage

Review:
  - Chỉ sau khi DELIVERED
  - Mỗi OrderItem chỉ 1 review
  - Cần duyệt trước khi hiển thị công khai

Flash Sale:
  - Stock dùng Redis DECRBY (atomic)
  - Price snapshot vào OrderItem tại thời điểm mua
  - Kết thúc tự động qua BullMQ delayed job

Coupon:
  - Validate là read-only (không tăng usedCount)
  - Apply chỉ khi tạo order thành công
  - Hoàn lại khi order bị hủy
```

### B. Các con số giới hạn (Constants)

```typescript
export const LIMITS = {
  CART_MAX_ITEMS: 50,
  ADDRESS_MAX_PER_USER: 10,
  REVIEW_MAX_IMAGES: 5,
  REVIEW_MIN_CONTENT: 10,
  REVIEW_MAX_CONTENT: 1000,
  REVIEW_PERIOD_DAYS: 90,
  PRODUCT_MAX_IMAGES: 10,
  ORDER_CANCEL_VALID_STATUS: ['pending'],
  FREE_SHIPPING_THRESHOLD: 500_000,   // VNĐ
  STANDARD_SHIPPING_FEE: 30_000,      // VNĐ
  UPLOAD_MAX_SIZE_IMAGE: 5_242_880,   // 5MB
  UPLOAD_MAX_SIZE_VIDEO: 52_428_800,  // 50MB
  JWT_ACCESS_EXPIRES: '15m',
  JWT_REFRESH_EXPIRES: '7d',
  OTP_EXPIRES_MINUTES: 60,
  AUTO_CANCEL_PENDING_HOURS: 48,
  FLASH_SALE_MIN_ADVANCE_MINUTES: 5,
  BCRYPT_ROUNDS: 12,
} as const;
```

### C. Status transition map

```
Order Status:
  pending ──────► confirmed ──────► packing ──────► shipping ──────► delivered
     │                │                                                   │
     ▼                ▼                                                   ▼
  cancelled        cancelled                                           returned

Valid transitions (code reference):
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['packing',   'cancelled'],
  packing:   ['shipping'],
  shipping:  ['delivered'],
  delivered: ['returned'],
  cancelled: [],    // terminal
  returned:  [],    // terminal
};
```