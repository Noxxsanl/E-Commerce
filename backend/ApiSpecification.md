# API Specification — E-Commerce System
## Full Reference: Request · Response · Error Codes

> **Base URL:** `https://api.yourdomain.com/api/v1`  
> **Auth:** Bearer Token (JWT Access Token) trong header `Authorization: Bearer <token>`  
> **Content-Type:** `application/json` cho tất cả requests (trừ upload dùng `multipart/form-data`)  
> **Phiên bản:** 1.0.0

---

## Quy ước chung

### Response format chuẩn

```json
// Thành công — single object
{
  "success": true,
  "data": { ... },
  "message": "Mô tả kết quả"
}

// Thành công — danh sách có phân trang
{
  "success": true,
  "data": {
    "items": [ ... ],
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

// Thành công — không có dữ liệu trả về (DELETE)
HTTP 204 No Content

// Lỗi
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mô tả lỗi cho người dùng",
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
      { "field": "email", "message": "Email không đúng định dạng" },
      { "field": "password", "message": "Mật khẩu phải có ít nhất 8 ký tự" }
    ]
  }
}
```

### HTTP Status Codes

| Code | Ý nghĩa |
|------|---------|
| 200 | OK — thành công |
| 201 | Created — tạo mới thành công |
| 204 | No Content — xóa thành công |
| 400 | Bad Request — dữ liệu không hợp lệ |
| 401 | Unauthorized — chưa đăng nhập / token hết hạn |
| 403 | Forbidden — không có quyền |
| 404 | Not Found — resource không tồn tại |
| 409 | Conflict — trùng lặp dữ liệu |
| 422 | Unprocessable Entity — vi phạm business rule |
| 429 | Too Many Requests — vượt rate limit |
| 500 | Internal Server Error |

### Ký hiệu

| Ký hiệu | Nghĩa |
|---------|-------|
| 🔓 | Public — không cần auth |
| 🔐 | User — cần JWT (role: user) |
| 🛡️ | Admin/Moderator — cần role phù hợp |
| `?` sau field | Optional field |

---

## Mục Lục

- [1. Auth](#1-auth)
- [2. Users — Profile](#2-users--profile)
- [3. Addresses](#3-addresses)
- [4. Categories](#4-categories)
- [5. Products](#5-products)
- [6. Wishlist](#6-wishlist)
- [7. Cart](#7-cart)
- [8. Coupons](#8-coupons)
- [9. Orders](#9-orders)
- [10. Reviews](#10-reviews)
- [11. Banners](#11-banners)
- [12. Notifications](#12-notifications)
- [13. Upload](#13-upload)
- [14. Admin — Users](#14-admin--users)
- [15. Admin — Categories](#15-admin--categories)
- [16. Admin — Products](#16-admin--products)
- [17. Admin — Orders](#17-admin--orders)
- [18. Admin — Reviews](#18-admin--reviews)
- [19. Admin — Coupons](#19-admin--coupons)
- [20. Admin — Banners](#20-admin--banners)
- [21. Admin — Dashboard](#21-admin--dashboard)
- [22. System](#22-system)

---

# 1. AUTH

## POST /auth/register 🔓

Đăng ký tài khoản mới. Sau khi đăng ký, hệ thống gửi email xác nhận. User chưa verify email **không thể đăng nhập**.

**Request Body:**
```json
{
  "fullName": "Nguyễn Văn An",
  "email": "nguyenvanan@gmail.com",
  "password": "Password123"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `fullName` | string | required, 2–100 ký tự, trim |
| `email` | string | required, email format hợp lệ, lowercase |
| `password` | string | required, min 8 ký tự, phải có chữ hoa + chữ thường + số |

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0d1",
    "email": "nguyenvanan@gmail.com",
    "fullName": "Nguyễn Văn An",
    "status": "inactive",
    "createdAt": "2025-12-15T10:30:00.000Z"
  },
  "message": "Đăng ký thành công. Vui lòng kiểm tra email để xác nhận tài khoản."
}
```

**Errors:**
```
400 VALIDATION_ERROR       — Dữ liệu không hợp lệ (xem details)
409 AUTH_EMAIL_EXISTED     — "Email đã được sử dụng"
```

---

## POST /auth/login 🔓

Đăng nhập, nhận cặp access token + refresh token.

**Request Body:**
```json
{
  "email": "nguyenvanan@gmail.com",
  "password": "Password123"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | required |
| `password` | string | required |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "550e8400-e29b-41d4-a716-446655440000",
    "expiresIn": 900,
    "user": {
      "id": "6751a2b3c4d5e6f7a8b9c0d1",
      "email": "nguyenvanan@gmail.com",
      "fullName": "Nguyễn Văn An",
      "role": "user",
      "avatar": null,
      "isEmailVerified": true
    }
  }
}
```

**Errors:**
```
401 AUTH_INVALID_CREDENTIALS   — "Email hoặc mật khẩu không đúng"
403 AUTH_EMAIL_NOT_VERIFIED    — "Vui lòng xác nhận email trước khi đăng nhập"
403 AUTH_ACCOUNT_LOCKED        — "Tài khoản đã bị khóa. Lý do: Vi phạm chính sách"
429 THROTTLE_EXCEEDED          — "Quá nhiều lần thử. Vui lòng đợi 60 giây"
```

---

## POST /auth/logout 🔐

Đăng xuất, revoke refresh token của thiết bị hiện tại.

**Request Body:**
```json
{
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `refreshToken` | string | required |

**Response 200:**
```json
{
  "success": true,
  "message": "Đăng xuất thành công"
}
```

---

## POST /auth/refresh 🔓

Làm mới access token bằng refresh token. **Refresh token cũ bị revoke ngay lập tức** (token rotation).

**Request Body:**
```json
{
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "7f3a9b2c-1d4e-5f6a-8b9c-0d1e2f3a4b5c",
    "expiresIn": 900
  }
}
```

**Errors:**
```
401 AUTH_TOKEN_INVALID    — "Token không hợp lệ"
401 AUTH_TOKEN_EXPIRED    — "Token đã hết hạn. Vui lòng đăng nhập lại"
401 AUTH_TOKEN_REVOKED    — "Token đã bị thu hồi. Vui lòng đăng nhập lại"
```

---

## POST /auth/verify-email 🔓

Xác nhận email bằng token nhận từ email.

**Request Body:**
```json
{
  "token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Email đã được xác nhận thành công. Bạn có thể đăng nhập ngay bây giờ."
}
```

**Errors:**
```
400 AUTH_OTP_INVALID       — "Liên kết xác nhận không hợp lệ"
400 AUTH_OTP_EXPIRED       — "Liên kết đã hết hạn (60 phút). Vui lòng yêu cầu gửi lại"
400 AUTH_OTP_ALREADY_USED  — "Email đã được xác nhận trước đó"
```

---

## POST /auth/resend-verify-email 🔓

Gửi lại email xác nhận (khi token cũ hết hạn).

**Request Body:**
```json
{
  "email": "nguyenvanan@gmail.com"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Email xác nhận đã được gửi lại. Vui lòng kiểm tra hộp thư."
}
```

**Errors:**
```
404 USER_NOT_FOUND          — (không trả lỗi này — tránh email enumeration, luôn trả 200)
422 AUTH_EMAIL_ALREADY_VERIFIED — "Email đã được xác nhận rồi"
429 THROTTLE_EXCEEDED       — "Vui lòng đợi ít nhất 2 phút trước khi gửi lại"
```

---

## POST /auth/forgot-password 🔓

Yêu cầu đặt lại mật khẩu. Luôn trả về 200 dù email có tồn tại hay không (tránh email enumeration).

**Request Body:**
```json
{
  "email": "nguyenvanan@gmail.com"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu trong vài phút."
}
```

---

## POST /auth/reset-password 🔓

Đặt lại mật khẩu bằng token từ email. Token có hiệu lực 60 phút, dùng 1 lần.

**Request Body:**
```json
{
  "token": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "newPassword": "NewPassword456"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `token` | string | required |
| `newPassword` | string | required, min 8 ký tự, có chữ hoa + chữ thường + số |

**Response 200:**
```json
{
  "success": true,
  "message": "Mật khẩu đã được đặt lại thành công. Tất cả phiên đăng nhập khác đã bị đăng xuất."
}
```

**Errors:**
```
400 AUTH_OTP_INVALID       — "Liên kết không hợp lệ"
400 AUTH_OTP_EXPIRED       — "Liên kết đã hết hạn. Vui lòng yêu cầu đặt lại mật khẩu mới"
400 AUTH_OTP_ALREADY_USED  — "Liên kết đã được sử dụng"
400 VALIDATION_ERROR       — Mật khẩu không đủ điều kiện
```

---

## GET /auth/me 🔐

Lấy thông tin user đang đăng nhập.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0d1",
    "email": "nguyenvanan@gmail.com",
    "fullName": "Nguyễn Văn An",
    "phone": "0901234567",
    "avatar": "https://res.cloudinary.com/demo/image/upload/avatars/user123.jpg",
    "role": "user",
    "status": "active",
    "isEmailVerified": true,
    "lastLoginAt": "2025-12-15T08:00:00.000Z",
    "createdAt": "2025-10-01T10:00:00.000Z"
  }
}
```

---

# 2. USERS — PROFILE

## GET /users/me 🔐

Lấy hồ sơ cá nhân chi tiết.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0d1",
    "email": "nguyenvanan@gmail.com",
    "fullName": "Nguyễn Văn An",
    "phone": "0901234567",
    "avatar": "https://res.cloudinary.com/demo/image/upload/avatars/user123.jpg",
    "role": "user",
    "status": "active",
    "isEmailVerified": true,
    "lastLoginAt": "2025-12-15T08:00:00.000Z",
    "createdAt": "2025-10-01T10:00:00.000Z",
    "updatedAt": "2025-12-10T14:30:00.000Z"
  }
}
```

---

## PATCH /users/me 🔐

Cập nhật thông tin cá nhân (không bao gồm email, password).

**Request Body:**
```json
{
  "fullName": "Nguyễn Văn An Updated",
  "phone": "0909876543"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `fullName?` | string | 2–100 ký tự |
| `phone?` | string | 10–11 số, định dạng VN |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0d1",
    "email": "nguyenvanan@gmail.com",
    "fullName": "Nguyễn Văn An Updated",
    "phone": "0909876543",
    "avatar": "https://res.cloudinary.com/demo/image/upload/avatars/user123.jpg",
    "updatedAt": "2025-12-15T11:00:00.000Z"
  },
  "message": "Cập nhật hồ sơ thành công"
}
```

**Errors:**
```
400 VALIDATION_ERROR   — Dữ liệu không hợp lệ
```

---

## PATCH /users/me/password 🔐

Đổi mật khẩu. Yêu cầu nhập mật khẩu hiện tại để xác nhận.

**Request Body:**
```json
{
  "currentPassword": "Password123",
  "newPassword": "NewPassword456",
  "confirmPassword": "NewPassword456"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `currentPassword` | string | required |
| `newPassword` | string | required, min 8, có chữ hoa + thường + số, khác currentPassword |
| `confirmPassword` | string | required, phải khớp newPassword |

**Response 200:**
```json
{
  "success": true,
  "message": "Đổi mật khẩu thành công. Vui lòng đăng nhập lại trên các thiết bị khác."
}
```

**Errors:**
```
400 AUTH_INVALID_CREDENTIALS   — "Mật khẩu hiện tại không đúng"
400 VALIDATION_ERROR           — Mật khẩu mới không đủ điều kiện hoặc không khớp
```

---

## PATCH /users/me/avatar 🔐

Cập nhật ảnh đại diện bằng URL Cloudinary (upload ảnh trước qua `/upload/image`).

**Request Body:**
```json
{
  "avatarUrl": "https://res.cloudinary.com/demo/image/upload/avatars/new-avatar.jpg"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "avatar": "https://res.cloudinary.com/demo/image/upload/avatars/new-avatar.jpg"
  },
  "message": "Cập nhật ảnh đại diện thành công"
}
```

---

# 3. ADDRESSES

## GET /addresses 🔐

Lấy danh sách địa chỉ của user hiện tại.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "6751a2b3c4d5e6f7a8b9c0d2",
      "fullName": "Nguyễn Văn An",
      "phone": "0901234567",
      "province": { "code": "79", "name": "Thành phố Hồ Chí Minh" },
      "district": { "code": "760", "name": "Quận 1" },
      "ward": { "code": "26734", "name": "Phường Bến Nghé" },
      "streetAddress": "123 Đường Lê Lợi",
      "isDefault": true,
      "label": "home",
      "createdAt": "2025-11-01T10:00:00.000Z"
    },
    {
      "id": "6751a2b3c4d5e6f7a8b9c0d3",
      "fullName": "Nguyễn Văn An",
      "phone": "0901234567",
      "province": { "code": "01", "name": "Thành phố Hà Nội" },
      "district": { "code": "001", "name": "Quận Ba Đình" },
      "ward": { "code": "00001", "name": "Phường Phúc Xá" },
      "streetAddress": "45 Đường Hoàng Hoa Thám",
      "isDefault": false,
      "label": "office",
      "createdAt": "2025-11-15T14:00:00.000Z"
    }
  ]
}
```

---

## POST /addresses 🔐

Thêm địa chỉ mới. Nếu là địa chỉ đầu tiên, tự động set `isDefault = true`.

**Request Body:**
```json
{
  "fullName": "Nguyễn Văn An",
  "phone": "0901234567",
  "province": { "code": "79", "name": "Thành phố Hồ Chí Minh" },
  "district": { "code": "760", "name": "Quận 1" },
  "ward": { "code": "26734", "name": "Phường Bến Nghé" },
  "streetAddress": "123 Đường Lê Lợi",
  "label": "home",
  "isDefault": false
}
```

| Field | Type | Rules |
|-------|------|-------|
| `fullName` | string | required, 2–100 ký tự |
| `phone` | string | required, 10–11 số |
| `province` | object | required, { code, name } |
| `district` | object | required, { code, name } |
| `ward` | object | required, { code, name } |
| `streetAddress` | string | required, 5–200 ký tự |
| `label?` | enum | `home` \| `office` \| `other`, default: `home` |
| `isDefault?` | boolean | default: false |

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0d4",
    "fullName": "Nguyễn Văn An",
    "phone": "0901234567",
    "province": { "code": "79", "name": "Thành phố Hồ Chí Minh" },
    "district": { "code": "760", "name": "Quận 1" },
    "ward": { "code": "26734", "name": "Phường Bến Nghé" },
    "streetAddress": "123 Đường Lê Lợi",
    "isDefault": false,
    "label": "home",
    "createdAt": "2025-12-15T11:30:00.000Z"
  },
  "message": "Thêm địa chỉ thành công"
}
```

**Errors:**
```
400 VALIDATION_ERROR         — Dữ liệu không hợp lệ
422 ADDRESS_MAX_EXCEEDED     — "Bạn chỉ có thể lưu tối đa 10 địa chỉ"
```

---

## PATCH /addresses/:id 🔐

Cập nhật địa chỉ.

**Request Body:** *(Tất cả fields đều optional, chỉ cần truyền field cần thay đổi)*
```json
{
  "fullName": "Nguyễn Thị Bình",
  "phone": "0912345678",
  "streetAddress": "456 Đường Nguyễn Huệ",
  "label": "office"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0d2",
    "fullName": "Nguyễn Thị Bình",
    "phone": "0912345678",
    "province": { "code": "79", "name": "Thành phố Hồ Chí Minh" },
    "district": { "code": "760", "name": "Quận 1" },
    "ward": { "code": "26734", "name": "Phường Bến Nghé" },
    "streetAddress": "456 Đường Nguyễn Huệ",
    "isDefault": true,
    "label": "office",
    "updatedAt": "2025-12-15T12:00:00.000Z"
  },
  "message": "Cập nhật địa chỉ thành công"
}
```

**Errors:**
```
404 ADDRESS_NOT_FOUND   — "Địa chỉ không tồn tại"
403 FORBIDDEN           — Địa chỉ không thuộc về user hiện tại
```

---

## DELETE /addresses/:id 🔐

Xóa địa chỉ.

**Response 200:**
```json
{
  "success": true,
  "message": "Đã xóa địa chỉ"
}
```

**Errors:**
```
404 ADDRESS_NOT_FOUND                  — "Địa chỉ không tồn tại"
403 FORBIDDEN                          — Địa chỉ không thuộc về user hiện tại
422 ADDRESS_CANNOT_DELETE_DEFAULT      — "Không thể xóa địa chỉ mặc định. Hãy đặt địa chỉ khác làm mặc định trước"
```

---

## PATCH /addresses/:id/set-default 🔐

Đặt địa chỉ làm mặc định.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0d3",
    "isDefault": true
  },
  "message": "Đã đặt làm địa chỉ mặc định"
}
```

---

# 4. CATEGORIES

## GET /categories 🔓

Lấy cây danh mục (2 cấp: parent → children).

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "6751a2b3c4d5e6f7a8b9c0e1",
      "name": "Thời trang",
      "slug": "thoi-trang",
      "image": "https://res.cloudinary.com/demo/image/upload/categories/fashion.jpg",
      "order": 1,
      "children": [
        {
          "id": "6751a2b3c4d5e6f7a8b9c0e2",
          "name": "Áo",
          "slug": "ao",
          "image": "https://res.cloudinary.com/demo/image/upload/categories/shirts.jpg",
          "order": 1,
          "children": []
        },
        {
          "id": "6751a2b3c4d5e6f7a8b9c0e3",
          "name": "Quần",
          "slug": "quan",
          "image": "https://res.cloudinary.com/demo/image/upload/categories/pants.jpg",
          "order": 2,
          "children": []
        }
      ]
    },
    {
      "id": "6751a2b3c4d5e6f7a8b9c0e4",
      "name": "Điện tử",
      "slug": "dien-tu",
      "image": "https://res.cloudinary.com/demo/image/upload/categories/electronics.jpg",
      "order": 2,
      "children": [...]
    }
  ]
}
```

---

## GET /categories/:slug 🔓

Lấy thông tin một danh mục.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0e2",
    "name": "Áo",
    "slug": "ao",
    "description": "Các loại áo nam, nữ, trẻ em",
    "image": "https://res.cloudinary.com/demo/image/upload/categories/shirts.jpg",
    "parentId": "6751a2b3c4d5e6f7a8b9c0e1",
    "parent": {
      "id": "6751a2b3c4d5e6f7a8b9c0e1",
      "name": "Thời trang",
      "slug": "thoi-trang"
    },
    "order": 1,
    "isActive": true
  }
}
```

**Errors:**
```
404 CATEGORY_NOT_FOUND   — "Danh mục không tồn tại"
```

---

# 5. PRODUCTS

## GET /products 🔓

Lấy danh sách sản phẩm với filter, sort, phân trang.

**Query Parameters:**

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `page` | number | 1 | Trang hiện tại |
| `limit` | number | 20 | Số items/trang, max 100 |
| `category` | string | — | Slug danh mục |
| `brand` | string | — | Tên thương hiệu |
| `minPrice` | number | — | Giá tối thiểu (VNĐ) |
| `maxPrice` | number | — | Giá tối đa (VNĐ) |
| `minRating` | number | — | Rating tối thiểu (1–5) |
| `inStock` | boolean | — | Chỉ lấy còn hàng |
| `search` | string | — | Tìm kiếm full-text |
| `sort` | enum | `newest` | `newest` \| `best_selling` \| `price_asc` \| `price_desc` \| `rating` |

**Ví dụ:** `GET /products?category=ao&minPrice=100000&maxPrice=500000&sort=best_selling&page=1&limit=20`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "6751a2b3c4d5e6f7a8b9c0f1",
        "name": "Áo Thun Nam Basic Oversize",
        "slug": "ao-thun-nam-basic-oversize-abc123",
        "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/products/ao-thun-1.jpg",
        "price": 299000,
        "effectivePrice": 239200,
        "discountPercent": 20,
        "isFlashSale": false,
        "flashSaleEndAt": null,
        "averageRating": 4.5,
        "reviewCount": 128,
        "soldCount": 1540,
        "stock": 85,
        "brand": "Local Brand",
        "categories": [
          { "id": "6751a2b3c4d5e6f7a8b9c0e2", "name": "Áo", "slug": "ao" }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 245,
      "totalPages": 13,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

## GET /products/flash-sale 🔓

Lấy danh sách sản phẩm đang trong Flash Sale (có giới hạn thời gian).

**Query Parameters:** `page`, `limit`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "6751a2b3c4d5e6f7a8b9c0f2",
        "name": "Giày Nike Air Max 270",
        "slug": "giay-nike-air-max-270-def456",
        "thumbnailUrl": "https://res.cloudinary.com/.../nike-air.jpg",
        "price": 2500000,
        "effectivePrice": 1490000,
        "discountPercent": 0,
        "isFlashSale": true,
        "flashSalePrice": 1490000,
        "flashSaleStock": 12,
        "flashSaleEndAt": "2025-12-15T23:59:59.000Z",
        "averageRating": 4.8,
        "reviewCount": 89,
        "soldCount": 320,
        "stock": 50,
        "brand": "Nike",
        "categories": [...]
      }
    ],
    "meta": {
      "nextSaleAt": null
    },
    "pagination": { ... }
  }
}
```

---

## GET /products/featured 🔓

Lấy sản phẩm nổi bật (isFeatured = true).

**Query Parameters:** `limit` (default 12, max 24)

**Response 200:** *(Tương tự cấu trúc product list, không có pagination)*

---

## GET /products/best-sellers 🔓

Lấy sản phẩm bán chạy nhất (30 ngày qua).

**Query Parameters:** `limit` (default 10, max 20)

**Response 200:** *(Tương tự cấu trúc product list)*

---

## GET /products/newest 🔓

Lấy sản phẩm mới nhất.

**Query Parameters:** `limit` (default 12, max 24)

**Response 200:** *(Tương tự cấu trúc product list)*

---

## GET /products/:slug 🔓

Lấy chi tiết sản phẩm theo slug (dùng cho SSG/ISR).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0f1",
    "name": "Áo Thun Nam Basic Oversize",
    "slug": "ao-thun-nam-basic-oversize-abc123",
    "description": "<p>Mô tả chi tiết sản phẩm dạng HTML...</p>",
    "shortDescription": "Áo thun form rộng, chất liệu cotton 100%",
    "images": [
      "https://res.cloudinary.com/.../ao-thun-1.jpg",
      "https://res.cloudinary.com/.../ao-thun-2.jpg",
      "https://res.cloudinary.com/.../ao-thun-3.jpg"
    ],
    "video": null,
    "thumbnailUrl": "https://res.cloudinary.com/.../ao-thun-thumb.jpg",
    "price": 299000,
    "effectivePrice": 239200,
    "discountPercent": 20,
    "isFlashSale": false,
    "flashSalePrice": 0,
    "flashSaleStock": 0,
    "flashSaleEndAt": null,
    "stock": 85,
    "sku": "AT-BASIC-OS-001",
    "weight": 200,
    "dimensions": { "length": 30, "width": 25, "height": 2 },
    "brand": "Local Brand",
    "tags": ["ao-thun", "oversize", "cotton", "nam"],
    "averageRating": 4.5,
    "reviewCount": 128,
    "soldCount": 1540,
    "isFeatured": true,
    "categories": [
      {
        "id": "6751a2b3c4d5e6f7a8b9c0e2",
        "name": "Áo",
        "slug": "ao",
        "parent": { "id": "...", "name": "Thời trang", "slug": "thoi-trang" }
      }
    ],
    "variants": [
      {
        "id": "6751a2b3c4d5e6f7a8b9c0g1",
        "options": [
          { "name": "Màu sắc", "value": "Trắng" },
          { "name": "Kích thước", "value": "M" }
        ],
        "price": 299000,
        "effectivePrice": 239200,
        "stock": 20,
        "sku": "AT-BASIC-OS-WHITE-M",
        "image": "https://res.cloudinary.com/.../ao-thun-white.jpg"
      },
      {
        "id": "6751a2b3c4d5e6f7a8b9c0g2",
        "options": [
          { "name": "Màu sắc", "value": "Đen" },
          { "name": "Kích thước", "value": "L" }
        ],
        "price": 299000,
        "effectivePrice": 239200,
        "stock": 15,
        "sku": "AT-BASIC-OS-BLACK-L",
        "image": "https://res.cloudinary.com/.../ao-thun-black.jpg"
      }
    ],
    "metaTitle": "Áo Thun Nam Basic Oversize | Local Brand",
    "metaDescription": "Mua áo thun nam basic oversize chất lượng cao...",
    "createdAt": "2025-10-15T08:00:00.000Z",
    "updatedAt": "2025-12-10T16:00:00.000Z"
  }
}
```

**Errors:**
```
404 PRODUCT_NOT_FOUND   — "Sản phẩm không tồn tại hoặc đã ngừng kinh doanh"
```

---

## GET /products/:id/related 🔓

Lấy sản phẩm liên quan (cùng danh mục).

**Query Parameters:** `limit` (default 8, max 16)

**Response 200:** *(Mảng ProductCard, không có pagination)*

---

## POST /products/:id/view 🔓

Ghi nhận lượt xem sản phẩm (analytics, async không ảnh hưởng UX).

**Request Body:**
```json
{
  "sessionId": "sess_abc123xyz"
}
```

**Response 200:**
```json
{ "success": true }
```

---

# 6. WISHLIST

## GET /wishlist 🔐

Lấy danh sách sản phẩm yêu thích.

**Query Parameters:** `page` (default 1), `limit` (default 20)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "6751a2b3c4d5e6f7a8b9c0h1",
        "productId": "6751a2b3c4d5e6f7a8b9c0f1",
        "product": {
          "id": "6751a2b3c4d5e6f7a8b9c0f1",
          "name": "Áo Thun Nam Basic Oversize",
          "slug": "ao-thun-nam-basic-oversize-abc123",
          "thumbnailUrl": "https://res.cloudinary.com/.../ao-thun-thumb.jpg",
          "price": 299000,
          "effectivePrice": 239200,
          "discountPercent": 20,
          "isFlashSale": false,
          "stock": 85,
          "averageRating": 4.5,
          "isActive": true
        },
        "addedAt": "2025-12-01T10:00:00.000Z"
      }
    ],
    "pagination": { ... }
  }
}
```

---

## POST /wishlist/:productId 🔐

Thêm sản phẩm vào wishlist. Nếu đã có thì không làm gì (idempotent).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "productId": "6751a2b3c4d5e6f7a8b9c0f1",
    "isWishlisted": true
  },
  "message": "Đã thêm vào danh sách yêu thích"
}
```

**Errors:**
```
404 PRODUCT_NOT_FOUND   — "Sản phẩm không tồn tại"
```

---

## DELETE /wishlist/:productId 🔐

Xóa sản phẩm khỏi wishlist.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "productId": "6751a2b3c4d5e6f7a8b9c0f1",
    "isWishlisted": false
  },
  "message": "Đã xóa khỏi danh sách yêu thích"
}
```

---

## GET /wishlist/check/:productId 🔐

Kiểm tra sản phẩm có trong wishlist không.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "productId": "6751a2b3c4d5e6f7a8b9c0f1",
    "isWishlisted": true
  }
}
```

---

# 7. CART

## GET /cart 🔐

Lấy giỏ hàng với thông tin tồn kho và giá cập nhật.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0i1",
    "items": [
      {
        "id": "6751a2b3c4d5e6f7a8b9c0i2",
        "productId": "6751a2b3c4d5e6f7a8b9c0f1",
        "variantId": "6751a2b3c4d5e6f7a8b9c0g1",
        "productName": "Áo Thun Nam Basic Oversize",
        "productImage": "https://res.cloudinary.com/.../ao-thun-thumb.jpg",
        "variantOptions": "Màu sắc: Trắng, Kích thước: M",
        "snapshotPrice": 239200,
        "currentPrice": 239200,
        "isPriceChanged": false,
        "quantity": 2,
        "maxQuantity": 20,
        "isUnavailable": false,
        "isQuantityExceeded": false,
        "unavailableReason": null,
        "addedAt": "2025-12-14T15:00:00.000Z"
      }
    ],
    "summary": {
      "subtotal": 478400,
      "shippingFee": 0,
      "total": 478400,
      "itemCount": 1,
      "totalQuantity": 2,
      "canCheckout": true
    },
    "updatedAt": "2025-12-14T15:00:00.000Z"
  }
}
```

---

## POST /cart 🔐

Thêm sản phẩm vào giỏ hàng. Nếu đã tồn tại sẽ cộng thêm số lượng.

**Request Body:**
```json
{
  "productId": "6751a2b3c4d5e6f7a8b9c0f1",
  "variantId": "6751a2b3c4d5e6f7a8b9c0g1",
  "quantity": 2
}
```

| Field | Type | Rules |
|-------|------|-------|
| `productId` | string | required, MongoDB ObjectId |
| `variantId?` | string | MongoDB ObjectId, bắt buộc nếu sản phẩm có variants |
| `quantity` | number | required, integer, min 1, max 99 |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "cart": { /* full cart object */ },
    "addedItem": {
      "id": "6751a2b3c4d5e6f7a8b9c0i2",
      "productName": "Áo Thun Nam Basic Oversize",
      "quantity": 2,
      "price": 239200
    }
  },
  "message": "Đã thêm vào giỏ hàng"
}
```

**Errors:**
```
404 PRODUCT_NOT_FOUND              — "Sản phẩm không tồn tại"
404 VARIANT_NOT_FOUND              — "Không tìm thấy phân loại sản phẩm"
422 PRODUCT_NOT_AVAILABLE          — "Sản phẩm đã ngừng kinh doanh"
422 PRODUCT_INSUFFICIENT_STOCK     — "Không đủ hàng. Chỉ còn 5 sản phẩm"
422 CART_EXCEEDS_STOCK             — "Bạn đã có 3 sản phẩm này trong giỏ, tồn kho chỉ còn 4"
422 CART_MAX_ITEMS_EXCEEDED        — "Giỏ hàng không thể chứa quá 50 loại sản phẩm"
422 VARIANT_MISMATCH               — "Phân loại không thuộc sản phẩm này"
```

---

## PATCH /cart/:itemId 🔐

Cập nhật số lượng một item trong giỏ. Nếu `quantity = 0`, item bị xóa.

**Request Body:**
```json
{
  "quantity": 3
}
```

| Field | Type | Rules |
|-------|------|-------|
| `quantity` | number | required, integer, min 0, max 99 |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "cart": { /* full cart object */ }
  },
  "message": "Đã cập nhật giỏ hàng"
}
```

**Errors:**
```
404 CART_ITEM_NOT_FOUND         — "Không tìm thấy sản phẩm trong giỏ"
422 PRODUCT_INSUFFICIENT_STOCK  — "Không đủ hàng"
```

---

## DELETE /cart/:itemId 🔐

Xóa một item khỏi giỏ hàng.

**Response 200:**
```json
{
  "success": true,
  "data": { "cart": { /* full cart object */ } },
  "message": "Đã xóa sản phẩm khỏi giỏ hàng"
}
```

---

## DELETE /cart 🔐

Xóa toàn bộ giỏ hàng.

**Response 200:**
```json
{
  "success": true,
  "message": "Đã xóa toàn bộ giỏ hàng"
}
```

---

# 8. COUPONS

## POST /coupons/validate 🔐

Kiểm tra mã giảm giá và tính số tiền được giảm. **Không tăng lượt sử dụng**, chỉ dùng để preview.

**Request Body:**
```json
{
  "code": "SAVE20",
  "subtotal": 478400
}
```

| Field | Type | Rules |
|-------|------|-------|
| `code` | string | required, uppercase |
| `subtotal` | number | required, >= 0, giá trị giỏ hàng hiện tại |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "code": "SAVE20",
    "description": "Giảm 20% cho đơn từ 300.000đ, tối đa 100.000đ",
    "type": "percent",
    "value": 20,
    "minOrderAmount": 300000,
    "discountAmount": 95680,
    "shippingFeeDiscount": 0,
    "finalShippingFee": 0,
    "isApplicable": true
  },
  "message": "Mã giảm giá hợp lệ"
}
```

**Errors:**
```
404 COUPON_NOT_FOUND                  — "Mã giảm giá không tồn tại"
422 COUPON_INACTIVE                   — "Mã giảm giá chưa kích hoạt"
422 COUPON_NOT_STARTED                — "Mã giảm giá chưa có hiệu lực đến ngày 20/12/2025"
422 COUPON_EXPIRED                    — "Mã giảm giá đã hết hạn ngày 01/12/2025"
422 COUPON_USAGE_LIMIT_REACHED        — "Mã giảm giá đã hết lượt sử dụng"
422 COUPON_USER_LIMIT_REACHED         — "Bạn đã dùng hết lượt cho mã này (tối đa 1 lần)"
422 COUPON_MIN_ORDER_NOT_MET          — { "minOrderAmount": 300000, "currentSubtotal": 150000, "message": "Đơn hàng tối thiểu 300.000đ để áp dụng mã này" }
422 COUPON_NOT_APPLICABLE_TO_CART     — "Mã giảm giá không áp dụng cho sản phẩm trong giỏ hàng"
```

---

# 9. ORDERS

## GET /orders 🔐

Lấy lịch sử đơn hàng của user hiện tại.

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|-------|
| `page` | number | default 1 |
| `limit` | number | default 10 |
| `status` | enum | `pending` \| `confirmed` \| `packing` \| `shipping` \| `delivered` \| `cancelled` \| `returned` |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "6751a2b3c4d5e6f7a8b9c0j1",
        "orderCode": "ORD-20251215-00042",
        "status": "shipping",
        "totalAmount": 478400,
        "itemCount": 2,
        "thumbnails": [
          "https://res.cloudinary.com/.../ao-thun-thumb.jpg",
          "https://res.cloudinary.com/.../giay-thumb.jpg"
        ],
        "paymentMethod": "cod",
        "paymentStatus": "pending",
        "createdAt": "2025-12-15T10:00:00.000Z",
        "updatedAt": "2025-12-16T08:00:00.000Z"
      }
    ],
    "pagination": { ... }
  }
}
```

---

## GET /orders/:id 🔐

Lấy chi tiết đơn hàng.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0j1",
    "orderCode": "ORD-20251215-00042",
    "status": "shipping",
    "shippingAddress": {
      "fullName": "Nguyễn Văn An",
      "phone": "0901234567",
      "province": "Thành phố Hồ Chí Minh",
      "district": "Quận 1",
      "ward": "Phường Bến Nghé",
      "streetAddress": "123 Đường Lê Lợi",
      "fullAddress": "123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh"
    },
    "items": [
      {
        "id": "6751a2b3c4d5e6f7a8b9c0j2",
        "productId": "6751a2b3c4d5e6f7a8b9c0f1",
        "productName": "Áo Thun Nam Basic Oversize",
        "productImage": "https://res.cloudinary.com/.../ao-thun-thumb.jpg",
        "variantOptions": "Màu sắc: Trắng, Kích thước: M",
        "unitPrice": 239200,
        "quantity": 2,
        "totalPrice": 478400,
        "isReviewed": false,
        "reviewId": null
      }
    ],
    "subtotal": 478400,
    "shippingFee": 0,
    "discountAmount": 0,
    "couponCode": null,
    "totalAmount": 478400,
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "notes": null,
    "cancelReason": null,
    "expectedDeliveryAt": "2025-12-18T23:59:59.000Z",
    "deliveredAt": null,
    "statusHistory": [
      { "status": "pending",   "updatedAt": "2025-12-15T10:00:00.000Z", "note": null },
      { "status": "confirmed", "updatedAt": "2025-12-15T11:30:00.000Z", "note": null },
      { "status": "packing",   "updatedAt": "2025-12-16T07:00:00.000Z", "note": null },
      { "status": "shipping",  "updatedAt": "2025-12-16T08:00:00.000Z", "note": "Đã bàn giao cho đơn vị vận chuyển" }
    ],
    "createdAt": "2025-12-15T10:00:00.000Z",
    "updatedAt": "2025-12-16T08:00:00.000Z"
  }
}
```

**Errors:**
```
404 ORDER_NOT_FOUND   — "Đơn hàng không tồn tại"
403 FORBIDDEN         — Đơn hàng không thuộc user hiện tại
```

---

## POST /orders 🔐

Tạo đơn hàng mới từ giỏ hàng hiện tại.

**Request Body:**
```json
{
  "addressId": "6751a2b3c4d5e6f7a8b9c0d2",
  "paymentMethod": "cod",
  "couponCode": "SAVE20",
  "notes": "Giao hàng giờ hành chính, gọi trước 30 phút"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `addressId` | string | required, ObjectId hợp lệ |
| `paymentMethod` | enum | required, hiện tại chỉ `"cod"` |
| `couponCode?` | string | uppercase |
| `notes?` | string | max 500 ký tự |

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0j1",
    "orderCode": "ORD-20251215-00042",
    "status": "pending",
    "shippingAddress": {
      "fullName": "Nguyễn Văn An",
      "phone": "0901234567",
      "fullAddress": "123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. HCM"
    },
    "items": [
      {
        "id": "...",
        "productName": "Áo Thun Nam Basic Oversize",
        "productImage": "...",
        "variantOptions": "Trắng, M",
        "unitPrice": 239200,
        "quantity": 2,
        "totalPrice": 478400
      }
    ],
    "subtotal": 478400,
    "shippingFee": 0,
    "discountAmount": 95680,
    "couponCode": "SAVE20",
    "totalAmount": 382720,
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "notes": "Giao hàng giờ hành chính, gọi trước 30 phút",
    "expectedDeliveryAt": "2025-12-18T23:59:59.000Z",
    "createdAt": "2025-12-15T10:00:00.000Z"
  },
  "message": "Đặt hàng thành công! Mã đơn hàng: ORD-20251215-00042"
}
```

**Errors:**
```
422 CART_EMPTY                         — "Giỏ hàng trống"
422 CART_HAS_UNAVAILABLE_ITEMS         — "Vui lòng xóa các sản phẩm không còn bán trước khi đặt hàng"
404 ADDRESS_NOT_FOUND                  — "Địa chỉ giao hàng không tồn tại"
403 FORBIDDEN                          — Địa chỉ không thuộc user hiện tại
422 PRODUCT_INSUFFICIENT_STOCK         — { "productName": "Áo Thun...", "requested": 3, "available": 1 }
422 COUPON_NOT_FOUND                   — "Mã giảm giá không tồn tại"
422 COUPON_EXPIRED                     — "Mã giảm giá đã hết hạn"
422 COUPON_USAGE_LIMIT_REACHED         — "Mã giảm giá đã hết lượt"
409 ORDER_STOCK_CONFLICT               — "Tạm thời không thể xử lý. Vui lòng thử lại sau vài giây"
```

---

## POST /orders/:id/cancel 🔐

Hủy đơn hàng. Chỉ được hủy khi `status = "pending"`.

**Request Body:**
```json
{
  "reason": "Tôi muốn thay đổi địa chỉ giao hàng"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `reason?` | string | max 500 ký tự |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0j1",
    "orderCode": "ORD-20251215-00042",
    "status": "cancelled",
    "cancelReason": "Tôi muốn thay đổi địa chỉ giao hàng"
  },
  "message": "Đơn hàng đã được hủy thành công"
}
```

**Errors:**
```
404 ORDER_NOT_FOUND      — "Đơn hàng không tồn tại"
403 FORBIDDEN            — Đơn hàng không thuộc user hiện tại
422 ORDER_CANNOT_CANCEL  — "Chỉ có thể hủy đơn hàng đang ở trạng thái Chờ xác nhận"
```

---

## POST /orders/:id/confirm-received 🔐

Xác nhận đã nhận hàng. Chỉ khi `status = "shipping"`.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0j1",
    "status": "delivered",
    "deliveredAt": "2025-12-17T14:30:00.000Z"
  },
  "message": "Đã xác nhận nhận hàng. Cảm ơn bạn đã mua sắm!"
}
```

**Errors:**
```
422 ORDER_CANNOT_CONFIRM_RECEIVED  — "Chỉ xác nhận nhận hàng khi đơn đang được giao"
```

---

# 10. REVIEWS

## GET /reviews/product/:productId 🔓

Lấy danh sách đánh giá của sản phẩm (chỉ hiển thị review đã approved và không bị ẩn).

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|-------|
| `page` | number | default 1 |
| `limit` | number | default 10 |
| `rating` | number | Filter theo rating (1–5) |
| `hasMedia` | boolean | Chỉ review có hình ảnh |
| `sort` | enum | `newest` (default) \| `helpful` |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "averageRating": 4.5,
      "totalReviews": 128,
      "ratingDistribution": {
        "5": 78,
        "4": 32,
        "3": 12,
        "2": 4,
        "1": 2
      }
    },
    "items": [
      {
        "id": "6751a2b3c4d5e6f7a8b9c0k1",
        "user": {
          "id": "6751a2b3c4d5e6f7a8b9c0d1",
          "fullName": "Nguyễn Văn An",
          "avatar": "https://res.cloudinary.com/.../avatar.jpg"
        },
        "rating": 5,
        "content": "Sản phẩm rất chất lượng, vải mềm mịn, form đẹp đúng như mô tả. Giao hàng nhanh, đóng gói cẩn thận. Sẽ ủng hộ shop dài dài!",
        "images": [
          "https://res.cloudinary.com/.../review-1.jpg",
          "https://res.cloudinary.com/.../review-2.jpg"
        ],
        "helpfulCount": 12,
        "isMyReview": false,
        "isHelpful": false,
        "createdAt": "2025-12-10T09:00:00.000Z"
      }
    ],
    "pagination": { ... }
  }
}
```

---

## POST /reviews 🔐

Tạo đánh giá sản phẩm. Điều kiện: đơn hàng phải `status = "delivered"`, chưa review item đó.

**Request Body:**
```json
{
  "orderItemId": "6751a2b3c4d5e6f7a8b9c0j2",
  "rating": 5,
  "content": "Sản phẩm rất chất lượng, vải mềm mịn, form đẹp đúng như mô tả!",
  "images": [
    "https://res.cloudinary.com/.../review-1.jpg"
  ]
}
```

| Field | Type | Rules |
|-------|------|-------|
| `orderItemId` | string | required, ObjectId |
| `rating` | number | required, integer, 1–5 |
| `content` | string | required, 10–1000 ký tự |
| `images?` | string[] | max 5 URLs Cloudinary |

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0k1",
    "productId": "6751a2b3c4d5e6f7a8b9c0f1",
    "rating": 5,
    "content": "Sản phẩm rất chất lượng...",
    "images": ["https://res.cloudinary.com/.../review-1.jpg"],
    "isApproved": false,
    "helpfulCount": 0,
    "createdAt": "2025-12-17T15:00:00.000Z"
  },
  "message": "Cảm ơn bạn đã đánh giá! Đánh giá sẽ hiển thị sau khi được kiểm duyệt."
}
```

**Errors:**
```
422 REVIEW_ORDER_ITEM_NOT_FOUND   — "Không tìm thấy sản phẩm trong đơn hàng"
403 FORBIDDEN                     — OrderItem không thuộc user hiện tại
422 REVIEW_ORDER_NOT_DELIVERED    — "Chỉ đánh giá được sản phẩm trong đơn hàng đã giao thành công"
409 REVIEW_ALREADY_SUBMITTED      — "Bạn đã đánh giá sản phẩm này rồi"
422 REVIEW_PERIOD_EXPIRED         — "Đã quá 90 ngày kể từ khi nhận hàng"
```

---

## POST /reviews/:id/helpful 🔐

Vote "review này hữu ích". Toggle: vote lần 2 = bỏ vote.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "reviewId": "6751a2b3c4d5e6f7a8b9c0k1",
    "helpfulCount": 13,
    "isHelpful": true
  }
}
```

---

# 11. BANNERS

## GET /banners 🔓

Lấy danh sách banner đang active (trong thời gian hiển thị).

**Query Parameters:** `type` (enum: `hero` \| `flash_sale` \| `category` \| `promotion`)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "6751a2b3c4d5e6f7a8b9c0l1",
      "title": "Siêu Sale 12/12",
      "imageUrl": "https://res.cloudinary.com/.../banner-1212.jpg",
      "mobileImageUrl": "https://res.cloudinary.com/.../banner-1212-mobile.jpg",
      "linkUrl": "/flash-sale",
      "type": "hero",
      "order": 1
    },
    {
      "id": "6751a2b3c4d5e6f7a8b9c0l2",
      "title": "Flash Sale Hàng Ngày",
      "imageUrl": "https://res.cloudinary.com/.../flash-sale-banner.jpg",
      "mobileImageUrl": null,
      "linkUrl": "/flash-sale",
      "type": "flash_sale",
      "order": 2
    }
  ]
}
```

---

# 12. NOTIFICATIONS

## GET /notifications 🔐

Lấy danh sách thông báo của user.

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|-------|
| `page` | number | default 1 |
| `limit` | number | default 20 |
| `isRead` | boolean | Filter đã đọc / chưa đọc |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "6751a2b3c4d5e6f7a8b9c0m1",
        "type": "order_status",
        "title": "Đơn hàng đang được giao",
        "message": "Đơn hàng ORD-20251215-00042 đang trên đường giao đến bạn",
        "link": "/orders/6751a2b3c4d5e6f7a8b9c0j1",
        "data": {
          "orderId": "6751a2b3c4d5e6f7a8b9c0j1",
          "orderCode": "ORD-20251215-00042",
          "status": "shipping"
        },
        "isRead": false,
        "createdAt": "2025-12-16T08:00:00.000Z"
      }
    ],
    "unreadCount": 3,
    "pagination": { ... }
  }
}
```

---

## PATCH /notifications/:id/read 🔐

Đánh dấu một thông báo đã đọc.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0m1",
    "isRead": true
  }
}
```

---

## PATCH /notifications/read-all 🔐

Đánh dấu tất cả thông báo đã đọc.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "updatedCount": 5
  },
  "message": "Đã đánh dấu tất cả là đã đọc"
}
```

---

## DELETE /notifications/:id 🔐

Xóa một thông báo.

**Response 200:**
```json
{
  "success": true,
  "message": "Đã xóa thông báo"
}
```

---

# 13. UPLOAD

## POST /upload/image 🔐

Upload một ảnh lên Cloudinary.

**Request:** `Content-Type: multipart/form-data`

| Field | Type | Rules |
|-------|------|-------|
| `file` | File | required, JPEG/PNG/WebP, max 5MB |
| `folder?` | string | `products` \| `reviews` \| `avatars` \| `categories` \| `banners`, default: `misc` |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "url": "https://res.cloudinary.com/demo/image/upload/products/ao-thun-abc123.jpg",
    "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/w_400,h_400,c_fill/products/ao-thun-abc123.jpg",
    "publicId": "ecommerce/products/ao-thun-abc123",
    "width": 1200,
    "height": 1200,
    "format": "jpg",
    "size": 245678
  }
}
```

**Errors:**
```
400 UPLOAD_INVALID_TYPE     — "Chỉ chấp nhận định dạng JPEG, PNG, WebP"
400 UPLOAD_FILE_TOO_LARGE   — "File quá lớn. Tối đa 5MB"
400 UPLOAD_NO_FILE          — "Không có file được gửi lên"
```

---

## POST /upload/images 🔐

Upload nhiều ảnh cùng lúc (max 10 ảnh).

**Request:** `Content-Type: multipart/form-data`

| Field | Type | Rules |
|-------|------|-------|
| `files` | File[] | required, max 10 files, mỗi file max 5MB |
| `folder?` | string | Tương tự upload đơn |

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "url": "...", "thumbnailUrl": "...", "publicId": "..." },
    { "url": "...", "thumbnailUrl": "...", "publicId": "..." }
  ]
}
```

**Errors:**
```
400 UPLOAD_MAX_FILES_EXCEEDED   — "Tối đa 10 ảnh mỗi lần upload"
```

---

## DELETE /upload 🔐

Xóa file đã upload khỏi Cloudinary.

**Request Body:**
```json
{
  "publicId": "ecommerce/products/ao-thun-abc123"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Đã xóa file"
}
```

---

# 14. ADMIN — USERS

> **Auth:** Role `admin` hoặc `super_admin`

## GET /admin/users 🛡️

Lấy danh sách tất cả users.

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|-------|
| `page` | number | default 1 |
| `limit` | number | default 20 |
| `search` | string | Tìm theo tên, email, SĐT |
| `role` | enum | `user` \| `moderator` \| `admin` \| `super_admin` |
| `status` | enum | `active` \| `inactive` \| `locked` |
| `sort` | enum | `newest` (default) \| `oldest` |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "6751a2b3c4d5e6f7a8b9c0d1",
        "fullName": "Nguyễn Văn An",
        "email": "nguyenvanan@gmail.com",
        "phone": "0901234567",
        "avatar": null,
        "role": "user",
        "status": "active",
        "isEmailVerified": true,
        "lastLoginAt": "2025-12-15T08:00:00.000Z",
        "orderCount": 15,
        "totalSpent": 4500000,
        "createdAt": "2025-10-01T10:00:00.000Z"
      }
    ],
    "pagination": { ... }
  }
}
```

---

## GET /admin/users/:id 🛡️

Xem chi tiết một user.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0d1",
    "fullName": "Nguyễn Văn An",
    "email": "nguyenvanan@gmail.com",
    "phone": "0901234567",
    "avatar": null,
    "role": "user",
    "status": "active",
    "isEmailVerified": true,
    "lastLoginAt": "2025-12-15T08:00:00.000Z",
    "lockedAt": null,
    "lockedReason": null,
    "stats": {
      "orderCount": 15,
      "totalSpent": 4500000,
      "reviewCount": 8,
      "wishlistCount": 23
    },
    "addresses": [
      {
        "id": "...",
        "fullAddress": "123 Lê Lợi, Q.1, TP.HCM",
        "isDefault": true
      }
    ],
    "recentOrders": [
      {
        "id": "...",
        "orderCode": "ORD-20251215-00042",
        "status": "delivered",
        "totalAmount": 478400,
        "createdAt": "2025-12-15T10:00:00.000Z"
      }
    ],
    "createdAt": "2025-10-01T10:00:00.000Z"
  }
}
```

---

## PATCH /admin/users/:id/lock 🛡️

Khóa tài khoản user.

**Request Body:**
```json
{
  "reason": "Vi phạm chính sách sử dụng: đặt hàng giả mạo"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `reason` | string | required, 10–500 ký tự |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0d1",
    "status": "locked",
    "lockedAt": "2025-12-15T12:00:00.000Z",
    "lockedReason": "Vi phạm chính sách sử dụng: đặt hàng giả mạo"
  },
  "message": "Đã khóa tài khoản"
}
```

**Errors:**
```
404 USER_NOT_FOUND         — "Người dùng không tồn tại"
422 USER_ALREADY_LOCKED    — "Tài khoản đã bị khóa rồi"
422 CANNOT_LOCK_ADMIN      — "Không thể khóa tài khoản admin" (chỉ super_admin mới lock được admin)
```

---

## PATCH /admin/users/:id/unlock 🛡️

Mở khóa tài khoản user.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0d1",
    "status": "active"
  },
  "message": "Đã mở khóa tài khoản"
}
```

**Errors:**
```
422 USER_NOT_LOCKED   — "Tài khoản không bị khóa"
```

---

## PATCH /admin/users/:id/role 🛡️ (Super Admin only)

Thay đổi role của user.

**Request Body:**
```json
{
  "role": "moderator"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `role` | enum | `user` \| `moderator` \| `admin` |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0d1",
    "role": "moderator"
  },
  "message": "Đã cập nhật quyền người dùng"
}
```

**Errors:**
```
403 FORBIDDEN   — Chỉ super_admin mới có quyền này
```

---

# 15. ADMIN — CATEGORIES

## GET /admin/categories 🛡️

Lấy danh sách tất cả danh mục (bao gồm cả inactive).

**Query Parameters:** `page`, `limit`, `search`, `isActive` (boolean), `parentId`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "6751a2b3c4d5e6f7a8b9c0e2",
        "name": "Áo",
        "slug": "ao",
        "image": "https://res.cloudinary.com/.../shirts.jpg",
        "parentId": "6751a2b3c4d5e6f7a8b9c0e1",
        "parentName": "Thời trang",
        "order": 1,
        "isActive": true,
        "productCount": 145,
        "createdAt": "2025-09-01T08:00:00.000Z"
      }
    ],
    "pagination": { ... }
  }
}
```

---

## POST /admin/categories 🛡️

Tạo danh mục mới.

**Request Body:**
```json
{
  "name": "Áo khoác",
  "description": "Các loại áo khoác, jacket, blazer",
  "image": "https://res.cloudinary.com/.../ao-khoac.jpg",
  "parentId": "6751a2b3c4d5e6f7a8b9c0e1",
  "order": 3,
  "isActive": true
}
```

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | required, 2–100 ký tự |
| `description?` | string | max 500 ký tự |
| `image?` | string | Cloudinary URL |
| `parentId?` | string | ObjectId, null = root category |
| `order?` | number | default 0 |
| `isActive?` | boolean | default true |

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0e5",
    "name": "Áo khoác",
    "slug": "ao-khoac",
    "description": "Các loại áo khoác, jacket, blazer",
    "image": "https://res.cloudinary.com/.../ao-khoac.jpg",
    "parentId": "6751a2b3c4d5e6f7a8b9c0e1",
    "order": 3,
    "isActive": true,
    "createdAt": "2025-12-15T13:00:00.000Z"
  },
  "message": "Đã tạo danh mục thành công"
}
```

**Errors:**
```
404 CATEGORY_NOT_FOUND   — parentId không tồn tại
```

---

## PATCH /admin/categories/:id 🛡️

Cập nhật danh mục.

**Request Body:** *(Tất cả optional)*
```json
{
  "name": "Áo khoác & Jacket",
  "isActive": false,
  "order": 2
}
```

**Response 200:** *(Category object đã cập nhật)*

**Errors:**
```
404 CATEGORY_NOT_FOUND                 — "Danh mục không tồn tại"
422 CATEGORY_CIRCULAR_DEPENDENCY       — "Không thể set danh mục cha là chính nó hoặc con của nó"
```

---

## DELETE /admin/categories/:id 🛡️

Xóa danh mục. Không thể xóa nếu còn sản phẩm active.

**Response 200:**
```json
{
  "success": true,
  "message": "Đã xóa danh mục"
}
```

**Errors:**
```
404 CATEGORY_NOT_FOUND      — "Danh mục không tồn tại"
422 CATEGORY_HAS_PRODUCTS   — "Danh mục đang có 145 sản phẩm. Vui lòng chuyển sản phẩm sang danh mục khác trước"
422 CATEGORY_HAS_CHILDREN   — "Danh mục đang có danh mục con. Vui lòng xóa các danh mục con trước"
```

---

# 16. ADMIN — PRODUCTS

## GET /admin/products 🛡️

Lấy danh sách sản phẩm (bao gồm cả inactive).

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|-------|
| `page` | number | default 1 |
| `limit` | number | default 20 |
| `search` | string | Tìm theo tên, SKU |
| `category` | string | Category ID hoặc slug |
| `brand` | string | |
| `isActive` | boolean | |
| `isFeatured` | boolean | |
| `isFlashSale` | boolean | |
| `inStock` | boolean | Còn hàng |
| `sort` | enum | `newest` \| `oldest` \| `name_asc` \| `price_asc` \| `price_desc` \| `sold_desc` |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "6751a2b3c4d5e6f7a8b9c0f1",
        "name": "Áo Thun Nam Basic Oversize",
        "slug": "ao-thun-nam-basic-oversize-abc123",
        "thumbnailUrl": "https://res.cloudinary.com/.../ao-thun-thumb.jpg",
        "price": 299000,
        "discountPercent": 20,
        "effectivePrice": 239200,
        "stock": 85,
        "isFlashSale": false,
        "isFeatured": true,
        "isActive": true,
        "soldCount": 1540,
        "averageRating": 4.5,
        "reviewCount": 128,
        "sku": "AT-BASIC-OS-001",
        "brand": "Local Brand",
        "categories": [{ "id": "...", "name": "Áo", "slug": "ao" }],
        "variantCount": 6,
        "createdAt": "2025-10-15T08:00:00.000Z"
      }
    ],
    "pagination": { ... }
  }
}
```

---

## GET /admin/products/:id 🛡️

Lấy chi tiết sản phẩm (đầy đủ hơn public endpoint, bao gồm cả inactive).

**Response 200:** *(Tương tự GET /products/:slug nhưng thêm các fields admin)*
```json
{
  "success": true,
  "data": {
    /* ... tất cả fields của product detail ... */
    "isActive": true,
    "isFeatured": true,
    "isFlashSale": false,
    "flashSalePrice": 0,
    "flashSaleStock": 0,
    "flashSaleEndAt": null,
    "sku": "AT-BASIC-OS-001",
    "weight": 200,
    "dimensions": { "length": 30, "width": 25, "height": 2 },
    "metaTitle": "...",
    "metaDescription": "...",
    "variants": [ /* full variant objects */ ]
  }
}
```

---

## POST /admin/products 🛡️

Tạo sản phẩm mới.

**Request Body:**
```json
{
  "name": "Áo Thun Nam Basic Oversize",
  "description": "<p>Mô tả chi tiết dạng HTML...</p>",
  "shortDescription": "Áo thun form rộng, chất liệu cotton 100%",
  "categories": ["6751a2b3c4d5e6f7a8b9c0e2"],
  "brand": "Local Brand",
  "price": 299000,
  "discountPercent": 20,
  "stock": 100,
  "sku": "AT-BASIC-OS-001",
  "weight": 200,
  "dimensions": { "length": 30, "width": 25, "height": 2 },
  "images": [
    "https://res.cloudinary.com/.../ao-thun-1.jpg",
    "https://res.cloudinary.com/.../ao-thun-2.jpg"
  ],
  "thumbnailUrl": "https://res.cloudinary.com/.../ao-thun-thumb.jpg",
  "video": null,
  "tags": ["ao-thun", "oversize", "cotton"],
  "isFeatured": true,
  "isActive": true,
  "metaTitle": "Áo Thun Nam Basic Oversize | Shop",
  "metaDescription": "Mua áo thun nam basic oversize...",
  "variants": [
    {
      "options": [
        { "name": "Màu sắc", "value": "Trắng" },
        { "name": "Kích thước", "value": "M" }
      ],
      "price": 299000,
      "stock": 20,
      "sku": "AT-BASIC-OS-WHITE-M",
      "image": "https://res.cloudinary.com/.../white.jpg"
    }
  ]
}
```

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | required, 2–200 ký tự |
| `description` | string | required |
| `shortDescription?` | string | max 500 ký tự |
| `categories` | string[] | required, min 1, valid ObjectIds |
| `brand?` | string | max 100 ký tự |
| `price` | number | required, >= 0 |
| `discountPercent?` | number | 0–100, default 0 |
| `stock` | number | required, integer >= 0 |
| `sku?` | string | unique |
| `weight?` | number | gram |
| `dimensions?` | object | { length, width, height } cm |
| `images` | string[] | required, min 1, max 10 Cloudinary URLs |
| `thumbnailUrl?` | string | default: images[0] |
| `video?` | string | Cloudinary video URL |
| `tags?` | string[] | max 20 tags |
| `isFeatured?` | boolean | default false |
| `isActive?` | boolean | default true |
| `metaTitle?` | string | max 70 ký tự |
| `metaDescription?` | string | max 160 ký tự |
| `variants?` | array | Xem schema bên trên |

**Response 201:**
```json
{
  "success": true,
  "data": { /* full product object */ },
  "message": "Đã tạo sản phẩm thành công"
}
```

**Errors:**
```
404 CATEGORY_NOT_FOUND   — "Danh mục [id] không tồn tại"
409 PRODUCT_SKU_EXISTED  — "SKU đã tồn tại"
```

---

## PATCH /admin/products/:id 🛡️

Cập nhật sản phẩm. Tất cả fields đều optional.

**Request Body:** *(Chỉ truyền fields cần thay đổi)*
```json
{
  "price": 349000,
  "discountPercent": 15,
  "stock": 150,
  "isFeatured": false,
  "isFlashSale": true,
  "flashSalePrice": 199000,
  "flashSaleStock": 50,
  "flashSaleEndAt": "2025-12-31T23:59:59.000Z"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": { /* full updated product object */ },
  "message": "Đã cập nhật sản phẩm"
}
```

**Errors:**
```
404 PRODUCT_NOT_FOUND                — "Sản phẩm không tồn tại"
422 FLASH_SALE_PRICE_INVALID         — "Giá flash sale phải nhỏ hơn giá gốc"
422 FLASH_SALE_STOCK_EXCEEDS         — "Số lượng flash sale không được vượt quá tổng tồn kho"
422 FLASH_SALE_END_TIME_INVALID      — "Thời gian kết thúc phải ít nhất 5 phút từ bây giờ"
```

---

## DELETE /admin/products/:id 🛡️

Xóa mềm sản phẩm (set `isActive = false`, không xóa khỏi DB).

**Response 200:**
```json
{
  "success": true,
  "message": "Đã ẩn sản phẩm"
}
```

---

## PATCH /admin/products/:id/toggle-active 🛡️

Bật/tắt hiển thị sản phẩm.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "isActive": false
  },
  "message": "Đã ẩn sản phẩm"
}
```

---

## POST /admin/products/:id/variants 🛡️

Thêm variant mới cho sản phẩm.

**Request Body:**
```json
{
  "options": [
    { "name": "Màu sắc", "value": "Xanh Navy" },
    { "name": "Kích thước", "value": "XL" }
  ],
  "price": 299000,
  "discountPercent": 20,
  "stock": 15,
  "sku": "AT-BASIC-OS-NAVY-XL",
  "image": "https://res.cloudinary.com/.../navy.jpg"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0g3",
    "productId": "6751a2b3c4d5e6f7a8b9c0f1",
    "options": [
      { "name": "Màu sắc", "value": "Xanh Navy" },
      { "name": "Kích thước", "value": "XL" }
    ],
    "price": 299000,
    "effectivePrice": 239200,
    "discountPercent": 20,
    "stock": 15,
    "sku": "AT-BASIC-OS-NAVY-XL",
    "image": "https://res.cloudinary.com/.../navy.jpg",
    "isActive": true
  },
  "message": "Đã thêm phân loại sản phẩm"
}
```

---

## PATCH /admin/products/:id/variants/:variantId 🛡️

Cập nhật variant.

**Request Body:** *(Tất cả optional)*
```json
{
  "stock": 20,
  "price": 319000,
  "isActive": false
}
```

**Response 200:** *(Variant object đã cập nhật)*

---

## DELETE /admin/products/:id/variants/:variantId 🛡️

Xóa variant.

**Response 200:**
```json
{
  "success": true,
  "message": "Đã xóa phân loại sản phẩm"
}
```

**Errors:**
```
422 VARIANT_IN_ACTIVE_CART   — "Phân loại này đang có trong giỏ hàng của một số khách. Hãy deactive thay vì xóa"
```

---

# 17. ADMIN — ORDERS

## GET /admin/orders 🛡️

Lấy tất cả đơn hàng với filter.

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|-------|
| `page` | number | default 1 |
| `limit` | number | default 20 |
| `search` | string | Tìm theo orderCode, tên user, email |
| `status` | enum | Trạng thái đơn hàng |
| `paymentStatus` | enum | `pending` \| `paid` \| `refunded` |
| `paymentMethod` | enum | `cod` |
| `startDate` | string | ISO date, lọc từ ngày |
| `endDate` | string | ISO date, lọc đến ngày |
| `minAmount` | number | Tổng tiền tối thiểu |
| `maxAmount` | number | Tổng tiền tối đa |
| `sort` | enum | `newest` (default) \| `oldest` \| `amount_desc` \| `amount_asc` |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "6751a2b3c4d5e6f7a8b9c0j1",
        "orderCode": "ORD-20251215-00042",
        "user": {
          "id": "6751a2b3c4d5e6f7a8b9c0d1",
          "fullName": "Nguyễn Văn An",
          "email": "nguyenvanan@gmail.com",
          "phone": "0901234567"
        },
        "status": "shipping",
        "paymentMethod": "cod",
        "paymentStatus": "pending",
        "subtotal": 478400,
        "shippingFee": 0,
        "discountAmount": 95680,
        "totalAmount": 382720,
        "itemCount": 2,
        "shippingAddress": {
          "fullName": "Nguyễn Văn An",
          "phone": "0901234567",
          "fullAddress": "123 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM"
        },
        "createdAt": "2025-12-15T10:00:00.000Z"
      }
    ],
    "summary": {
      "totalOrders": 1250,
      "totalRevenue": 125000000,
      "pendingCount": 45,
      "processingCount": 120
    },
    "pagination": { ... }
  }
}
```

---

## GET /admin/orders/:id 🛡️

Chi tiết đơn hàng đầy đủ (admin view).

**Response 200:** *(Tương tự GET /orders/:id + thêm user info, audit history)*
```json
{
  "success": true,
  "data": {
    /* ... tất cả fields như user view ... */
    "user": {
      "id": "...",
      "fullName": "Nguyễn Văn An",
      "email": "nguyenvanan@gmail.com",
      "phone": "0901234567"
    },
    "couponDetails": {
      "code": "SAVE20",
      "type": "percent",
      "value": 20,
      "discountAmount": 95680
    }
  }
}
```

---

## PATCH /admin/orders/:id/status 🛡️

Cập nhật trạng thái đơn hàng.

**Valid transitions:**
- `pending` → `confirmed` | `cancelled`
- `confirmed` → `packing` | `cancelled`
- `packing` → `shipping`
- `shipping` → `delivered`
- `delivered` → `returned`

**Request Body:**
```json
{
  "status": "confirmed",
  "note": "Đã kiểm tra và xác nhận đơn hàng"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `status` | enum | required, phải là transition hợp lệ |
| `note?` | string | max 500 ký tự |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0j1",
    "orderCode": "ORD-20251215-00042",
    "status": "confirmed",
    "statusHistory": [
      { "status": "pending",   "updatedAt": "2025-12-15T10:00:00.000Z", "updatedBy": null,    "note": null },
      { "status": "confirmed", "updatedAt": "2025-12-15T11:30:00.000Z", "updatedBy": "adminId", "note": "Đã kiểm tra và xác nhận đơn hàng" }
    ]
  },
  "message": "Đã cập nhật trạng thái đơn hàng"
}
```

**Errors:**
```
404 ORDER_NOT_FOUND                    — "Đơn hàng không tồn tại"
422 ORDER_INVALID_STATUS_TRANSITION    — "Không thể chuyển từ 'shipping' sang 'confirmed'"
```

---

## PATCH /admin/orders/bulk-status 🛡️

Cập nhật trạng thái nhiều đơn hàng cùng lúc.

**Request Body:**
```json
{
  "orderIds": [
    "6751a2b3c4d5e6f7a8b9c0j1",
    "6751a2b3c4d5e6f7a8b9c0j3"
  ],
  "status": "confirmed",
  "note": "Xác nhận hàng loạt"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "successCount": 2,
    "failedCount": 0,
    "failed": []
  },
  "message": "Đã cập nhật 2/2 đơn hàng"
}
```

Nếu một số đơn fail:
```json
{
  "success": true,
  "data": {
    "successCount": 1,
    "failedCount": 1,
    "failed": [
      {
        "orderId": "6751a2b3c4d5e6f7a8b9c0j3",
        "orderCode": "ORD-20251215-00041",
        "reason": "Không thể chuyển từ 'delivered' sang 'confirmed'"
      }
    ]
  },
  "message": "Đã cập nhật 1/2 đơn hàng (1 thất bại)"
}
```

---

## GET /admin/orders/export 🛡️

Export danh sách đơn hàng ra file CSV.

**Query Parameters:** *(Tương tự GET /admin/orders, không có page/limit)*

**Response:** `Content-Type: text/csv; charset=utf-8`

File CSV các cột: `orderCode`, `customerName`, `customerEmail`, `customerPhone`, `status`, `paymentMethod`, `subtotal`, `shippingFee`, `discountAmount`, `totalAmount`, `shippingAddress`, `createdAt`

---

# 18. ADMIN — REVIEWS

## GET /admin/reviews 🛡️ (Moderator+)

Lấy tất cả reviews.

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|-------|
| `page` | number | default 1 |
| `limit` | number | default 20 |
| `isApproved` | boolean | Filter đã duyệt/chưa |
| `isHidden` | boolean | |
| `rating` | number | 1–5 |
| `productId` | string | |
| `sort` | enum | `newest` \| `rating_asc` \| `rating_desc` |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "6751a2b3c4d5e6f7a8b9c0k1",
        "product": {
          "id": "6751a2b3c4d5e6f7a8b9c0f1",
          "name": "Áo Thun Nam Basic Oversize",
          "thumbnailUrl": "https://res.cloudinary.com/.../thumb.jpg"
        },
        "user": {
          "id": "6751a2b3c4d5e6f7a8b9c0d1",
          "fullName": "Nguyễn Văn An",
          "email": "nguyenvanan@gmail.com"
        },
        "rating": 2,
        "content": "Hàng không như mô tả...",
        "images": [],
        "isApproved": false,
        "isHidden": false,
        "helpfulCount": 0,
        "adminNote": null,
        "createdAt": "2025-12-17T09:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 45, "totalPages": 3, "hasNext": true, "hasPrev": false }
  }
}
```

---

## PATCH /admin/reviews/:id/approve 🛡️ (Moderator+)

Duyệt review.

**Response 200:**
```json
{
  "success": true,
  "data": { "id": "6751a2b3c4d5e6f7a8b9c0k1", "isApproved": true },
  "message": "Đã duyệt đánh giá"
}
```

---

## PATCH /admin/reviews/:id/hide 🛡️ (Moderator+)

Ẩn review.

**Request Body:**
```json
{ "note": "Nội dung vi phạm chính sách" }
```

**Response 200:**
```json
{
  "success": true,
  "data": { "id": "...", "isHidden": true, "adminNote": "Nội dung vi phạm chính sách" },
  "message": "Đã ẩn đánh giá"
}
```

---

## PATCH /admin/reviews/:id/unhide 🛡️ (Moderator+)

Bỏ ẩn review.

**Response 200:**
```json
{
  "success": true,
  "data": { "id": "...", "isHidden": false },
  "message": "Đã hiện đánh giá"
}
```

---

## DELETE /admin/reviews/:id 🛡️ (Admin+)

Xóa vĩnh viễn review.

**Response 200:**
```json
{ "success": true, "message": "Đã xóa đánh giá" }
```

**Errors:**
```
404 REVIEW_NOT_FOUND   — "Đánh giá không tồn tại"
```

---

# 19. ADMIN — COUPONS

## GET /admin/coupons 🛡️

Lấy danh sách tất cả coupons.

**Query Parameters:** `page`, `limit`, `search` (code/mô tả), `type`, `isActive`, `sort` (`newest` \| `expiring_soon`)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "6751a2b3c4d5e6f7a8b9c0n1",
        "code": "SAVE20",
        "description": "Giảm 20% tối đa 100k cho đơn từ 300k",
        "type": "percent",
        "value": 20,
        "minOrderAmount": 300000,
        "maxDiscountAmount": 100000,
        "usageLimit": 500,
        "usagePerUser": 1,
        "usedCount": 124,
        "usagePercent": 24.8,
        "startDate": "2025-12-01T00:00:00.000Z",
        "endDate": "2025-12-31T23:59:59.000Z",
        "isActive": true,
        "isExpired": false,
        "daysRemaining": 16,
        "createdAt": "2025-11-25T10:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 12, "totalPages": 1, "hasNext": false, "hasPrev": false }
  }
}
```

---

## GET /admin/coupons/:id 🛡️

Chi tiết coupon + lịch sử sử dụng gần đây.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0n1",
    "code": "SAVE20",
    "description": "Giảm 20% tối đa 100k cho đơn từ 300k",
    "type": "percent",
    "value": 20,
    "minOrderAmount": 300000,
    "maxDiscountAmount": 100000,
    "usageLimit": 500,
    "usagePerUser": 1,
    "usedCount": 124,
    "applicableProducts": [],
    "applicableCategories": [],
    "startDate": "2025-12-01T00:00:00.000Z",
    "endDate": "2025-12-31T23:59:59.000Z",
    "isActive": true,
    "recentUsages": [
      {
        "userId": "...",
        "userFullName": "Nguyễn Văn An",
        "orderId": "...",
        "orderCode": "ORD-20251215-00042",
        "discountAmount": 95680,
        "usedAt": "2025-12-15T10:00:00.000Z"
      }
    ],
    "createdAt": "2025-11-25T10:00:00.000Z"
  }
}
```

---

## POST /admin/coupons 🛡️

Tạo coupon mới.

**Request Body:**
```json
{
  "code": "XMAS2025",
  "description": "Giảm 50k cho đơn từ 200k dịp Giáng sinh",
  "type": "fixed_amount",
  "value": 50000,
  "minOrderAmount": 200000,
  "maxDiscountAmount": 0,
  "usageLimit": 1000,
  "usagePerUser": 1,
  "applicableProducts": [],
  "applicableCategories": [],
  "startDate": "2025-12-20T00:00:00.000Z",
  "endDate": "2025-12-26T23:59:59.000Z",
  "isActive": true
}
```

| Field | Type | Rules |
|-------|------|-------|
| `code` | string | required, uppercase, unique, không có khoảng trắng |
| `description?` | string | max 200 ký tự |
| `type` | enum | required: `percent` \| `fixed_amount` \| `free_shipping` |
| `value` | number | required: % nếu PERCENT (1–100), VNĐ nếu FIXED_AMOUNT, 0 nếu FREE_SHIPPING |
| `minOrderAmount?` | number | default 0 |
| `maxDiscountAmount?` | number | dùng khi type=PERCENT, 0 = không giới hạn |
| `usageLimit?` | number | 0 = không giới hạn |
| `usagePerUser?` | number | default 1 |
| `applicableProducts?` | string[] | ObjectIds, rỗng = áp dụng tất cả |
| `applicableCategories?` | string[] | ObjectIds |
| `startDate` | string | required, ISO datetime |
| `endDate` | string | required, ISO datetime, phải sau startDate |
| `isActive?` | boolean | default true |

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0n2",
    "code": "XMAS2025",
    "type": "fixed_amount",
    "value": 50000,
    "usedCount": 0,
    "createdAt": "2025-12-15T14:00:00.000Z"
  },
  "message": "Đã tạo mã giảm giá"
}
```

**Errors:**
```
409 COUPON_CODE_EXISTED   — "Mã giảm giá XMAS2025 đã tồn tại"
422 VALIDATION_ERROR      — "Ngày kết thúc phải sau ngày bắt đầu"
```

---

## PATCH /admin/coupons/:id 🛡️

Cập nhật coupon. **Không thể sửa `code` sau khi tạo.**

**Request Body:** *(Tất cả optional)*
```json
{
  "description": "Giảm 50k cho đơn từ 150k",
  "minOrderAmount": 150000,
  "usageLimit": 2000,
  "isActive": false
}
```

**Response 200:**
```json
{
  "success": true,
  "data": { /* coupon object đã cập nhật */ },
  "message": "Đã cập nhật mã giảm giá"
}
```

**Errors:**
```
404 COUPON_NOT_FOUND   — "Mã giảm giá không tồn tại"
```

---

## DELETE /admin/coupons/:id 🛡️

Xóa coupon. Không thể xóa nếu đã có lịch sử sử dụng.

**Response 200:**
```json
{ "success": true, "message": "Đã xóa mã giảm giá" }
```

**Errors:**
```
404 COUPON_NOT_FOUND           — "Mã giảm giá không tồn tại"
422 COUPON_HAS_USAGE_HISTORY   — "Không thể xóa mã đã được sử dụng. Hãy deactive thay vì xóa"
```

---

# 20. ADMIN — BANNERS

## GET /admin/banners 🛡️

Lấy tất cả banners (gồm cả inactive và hết hạn).

**Query Parameters:** `page`, `limit`, `type`, `isActive`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "6751a2b3c4d5e6f7a8b9c0l1",
        "title": "Siêu Sale 12/12",
        "imageUrl": "https://res.cloudinary.com/.../banner-1212.jpg",
        "mobileImageUrl": "https://res.cloudinary.com/.../banner-1212-mobile.jpg",
        "linkUrl": "/flash-sale",
        "type": "hero",
        "order": 1,
        "isActive": true,
        "startAt": "2025-12-12T00:00:00.000Z",
        "endAt": "2025-12-12T23:59:59.000Z",
        "isExpired": true,
        "createdAt": "2025-12-01T10:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 8, "totalPages": 1, "hasNext": false, "hasPrev": false }
  }
}
```

---

## POST /admin/banners 🛡️

Tạo banner mới.

**Request Body:**
```json
{
  "title": "Flash Sale Cuối Năm",
  "imageUrl": "https://res.cloudinary.com/.../flash-sale-banner.jpg",
  "mobileImageUrl": "https://res.cloudinary.com/.../flash-sale-mobile.jpg",
  "linkUrl": "/flash-sale",
  "type": "flash_sale",
  "order": 1,
  "isActive": true,
  "startAt": "2025-12-20T00:00:00.000Z",
  "endAt": "2025-12-31T23:59:59.000Z"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `title` | string | required, 2–100 ký tự |
| `imageUrl` | string | required, Cloudinary URL |
| `mobileImageUrl?` | string | Cloudinary URL, tối ưu cho mobile |
| `linkUrl?` | string | URL đích khi click banner |
| `type` | enum | required: `hero` \| `flash_sale` \| `category` \| `promotion` |
| `order?` | number | default 0 |
| `isActive?` | boolean | default true |
| `startAt?` | string | ISO datetime |
| `endAt?` | string | ISO datetime |

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "6751a2b3c4d5e6f7a8b9c0l3",
    "title": "Flash Sale Cuối Năm",
    "imageUrl": "https://res.cloudinary.com/.../flash-sale-banner.jpg",
    "type": "flash_sale",
    "order": 1,
    "isActive": true,
    "createdAt": "2025-12-15T15:00:00.000Z"
  },
  "message": "Đã tạo banner"
}
```

---

## PATCH /admin/banners/:id 🛡️

Cập nhật banner.

**Request Body:** *(Tất cả optional)*
```json
{
  "isActive": false,
  "endAt": "2025-12-25T23:59:59.000Z"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": { /* banner object đã cập nhật */ },
  "message": "Đã cập nhật banner"
}
```

**Errors:**
```
404 BANNER_NOT_FOUND   — "Banner không tồn tại"
```

---

## DELETE /admin/banners/:id 🛡️

Xóa banner.

**Response 200:**
```json
{ "success": true, "message": "Đã xóa banner" }
```

---

## PATCH /admin/banners/reorder 🛡️

Cập nhật thứ tự hiển thị banners (drag-and-drop).

**Request Body:**
```json
{
  "orderedIds": [
    "6751a2b3c4d5e6f7a8b9c0l2",
    "6751a2b3c4d5e6f7a8b9c0l3",
    "6751a2b3c4d5e6f7a8b9c0l1"
  ]
}
```

**Response 200:**
```json
{ "success": true, "message": "Đã cập nhật thứ tự banner" }
```

---

# 21. ADMIN — DASHBOARD

## GET /admin/dashboard/stats 🛡️

Các số liệu tổng quan (cards).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "revenue": {
      "today": 12500000,
      "thisMonth": 285000000,
      "lastMonth": 241000000,
      "growthPercent": 18.26,
      "growthDirection": "up"
    },
    "orders": {
      "total": 4521,
      "today": 45,
      "pending": 23,
      "confirmed": 15,
      "packing": 32,
      "shipping": 87,
      "delivered": 4250,
      "cancelled": 95,
      "returned": 19
    },
    "users": {
      "total": 8420,
      "active": 7950,
      "locked": 12,
      "newThisMonth": 342,
      "newLastMonth": 289
    },
    "products": {
      "total": 1250,
      "active": 1180,
      "outOfStock": 34,
      "flashSale": 5,
      "featured": 24
    }
  }
}
```

---

## GET /admin/dashboard/revenue 🛡️

Dữ liệu biểu đồ doanh thu.

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|-------|
| `period` | enum | required: `day` \| `month` |
| `year` | number | default: năm hiện tại |
| `month` | number | 1–12, bắt buộc khi `period=day` |

**Ví dụ:** `GET /admin/dashboard/revenue?period=day&year=2025&month=12`

**Response 200 (period=day):**
```json
{
  "success": true,
  "data": {
    "period": "day",
    "year": 2025,
    "month": 12,
    "data": [
      { "label": "01/12", "date": "2025-12-01", "revenue": 8500000,  "orderCount": 32 },
      { "label": "02/12", "date": "2025-12-02", "revenue": 12300000, "orderCount": 47 },
      { "label": "15/12", "date": "2025-12-15", "revenue": 15200000, "orderCount": 58 }
    ],
    "total": { "revenue": 285000000, "orderCount": 1085 }
  }
}
```

**Response 200 (period=month):**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "year": 2025,
    "data": [
      { "label": "Th1",  "date": "2025-01", "revenue": 95000000,   "orderCount": 380  },
      { "label": "Th6",  "date": "2025-06", "revenue": 142000000,  "orderCount": 568  },
      { "label": "Th12", "date": "2025-12", "revenue": 285000000,  "orderCount": 1085 }
    ],
    "total": { "revenue": 1850000000, "orderCount": 7420 }
  }
}
```

---

## GET /admin/dashboard/orders/stats 🛡️

Thống kê đơn hàng theo trạng thái.

**Query Parameters:** `startDate`, `endDate` (ISO date, default: 30 ngày qua)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "period": { "startDate": "2025-11-15", "endDate": "2025-12-15" },
    "statusBreakdown": [
      { "status": "delivered",  "count": 892, "revenue": 245000000, "percent": 82.1 },
      { "status": "shipping",   "count": 87,  "revenue": 0,         "percent": 8.0  },
      { "status": "cancelled",  "count": 65,  "revenue": 0,         "percent": 6.0  },
      { "status": "pending",    "count": 23,  "revenue": 0,         "percent": 2.1  },
      { "status": "returned",   "count": 19,  "revenue": 0,         "percent": 1.7  }
    ],
    "totalOrders": 1086,
    "completionRate": 82.1,
    "cancellationRate": 6.0
  }
}
```

---

## GET /admin/dashboard/products/best-sellers 🛡️

Top sản phẩm bán chạy.

**Query Parameters:** `limit` (default 10, max 20), `period` (`7d` \| `30d` \| `90d`, default `30d`)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "period": "30d",
    "items": [
      {
        "rank": 1,
        "productId": "6751a2b3c4d5e6f7a8b9c0f1",
        "productName": "Áo Thun Nam Basic Oversize",
        "thumbnailUrl": "https://res.cloudinary.com/.../ao-thun-thumb.jpg",
        "totalSold": 312,
        "revenue": 74582400,
        "averageRating": 4.5,
        "currentStock": 85
      },
      {
        "rank": 2,
        "productId": "...",
        "productName": "Giày Nike Air Max 270",
        "thumbnailUrl": "...",
        "totalSold": 245,
        "revenue": 365050000,
        "averageRating": 4.8,
        "currentStock": 32
      }
    ]
  }
}
```

---

## GET /admin/dashboard/users/recent 🛡️

Users mới đăng ký gần đây.

**Query Parameters:** `limit` (default 10, max 20)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "6751a2b3c4d5e6f7a8b9c0d1",
      "fullName": "Nguyễn Văn An",
      "email": "nguyenvanan@gmail.com",
      "avatar": null,
      "status": "active",
      "orderCount": 0,
      "createdAt": "2025-12-15T10:30:00.000Z"
    }
  ]
}
```

---

## GET /admin/dashboard/reviews/pending 🛡️ (Moderator+)

Reviews đang chờ duyệt.

**Query Parameters:** `limit` (default 10)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "pendingCount": 18,
    "items": [
      {
        "id": "...",
        "product": {
          "id": "...",
          "name": "Áo Thun Nam Basic Oversize",
          "thumbnailUrl": "..."
        },
        "user": {
          "id": "...",
          "fullName": "Trần Thị Bình",
          "email": "tranthibinh@gmail.com"
        },
        "rating": 2,
        "content": "Sản phẩm không đúng màu như mô tả, vải khá mỏng...",
        "images": [],
        "createdAt": "2025-12-15T09:00:00.000Z"
      }
    ]
  }
}
```

---

# 22. SYSTEM

## GET /health 🔓

Kiểm tra trạng thái hệ thống.

**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-15T12:00:00.000Z",
  "uptime": 86400,
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "mongodb": "up",
    "redis": "up"
  }
}
```

**Response 503 (khi service bị lỗi):**
```json
{
  "status": "degraded",
  "timestamp": "2025-12-15T12:00:00.000Z",
  "services": {
    "mongodb": "up",
    "redis": "down"
  }
}
```

---

## GET /api/v1 🔓

Thông tin API.

**Response 200:**
```json
{
  "name": "E-Commerce API",
  "version": "1.0.0",
  "description": "RESTful API cho hệ thống thương mại điện tử",
  "documentation": "https://api.yourdomain.com/api/docs"
}
```

---

# Phụ Lục A — Tổng hợp Error Codes

| Code | HTTP | Mô tả |
|------|------|-------|
| `VALIDATION_ERROR` | 400 | Dữ liệu không hợp lệ (kèm details) |
| `AUTH_EMAIL_EXISTED` | 409 | Email đã được sử dụng |
| `AUTH_INVALID_CREDENTIALS` | 401 | Email hoặc mật khẩu không đúng |
| `AUTH_EMAIL_NOT_VERIFIED` | 403 | Chưa xác nhận email |
| `AUTH_ACCOUNT_LOCKED` | 403 | Tài khoản bị khóa |
| `AUTH_TOKEN_INVALID` | 401 | Token không hợp lệ |
| `AUTH_TOKEN_EXPIRED` | 401 | Token hết hạn |
| `AUTH_TOKEN_REVOKED` | 401 | Token đã bị thu hồi |
| `AUTH_OTP_INVALID` | 400 | OTP/Link không hợp lệ |
| `AUTH_OTP_EXPIRED` | 400 | OTP/Link hết hạn |
| `AUTH_OTP_ALREADY_USED` | 400 | OTP/Link đã dùng rồi |
| `AUTH_EMAIL_ALREADY_VERIFIED` | 422 | Email đã xác nhận rồi |
| `PRODUCT_NOT_FOUND` | 404 | Sản phẩm không tồn tại |
| `PRODUCT_NOT_AVAILABLE` | 422 | Sản phẩm ngừng kinh doanh |
| `PRODUCT_INSUFFICIENT_STOCK` | 422 | Không đủ hàng |
| `PRODUCT_SKU_EXISTED` | 409 | SKU đã tồn tại |
| `VARIANT_NOT_FOUND` | 404 | Biến thể không tồn tại |
| `VARIANT_MISMATCH` | 422 | Biến thể không thuộc sản phẩm |
| `VARIANT_IN_ACTIVE_CART` | 422 | Biến thể đang trong giỏ của khách |
| `CATEGORY_NOT_FOUND` | 404 | Danh mục không tồn tại |
| `CATEGORY_HAS_PRODUCTS` | 422 | Danh mục còn sản phẩm |
| `CATEGORY_HAS_CHILDREN` | 422 | Danh mục còn danh mục con |
| `CATEGORY_CIRCULAR_DEPENDENCY` | 422 | Phụ thuộc vòng tròn |
| `CART_EMPTY` | 422 | Giỏ hàng trống |
| `CART_EXCEEDS_STOCK` | 422 | Vượt tồn kho |
| `CART_MAX_ITEMS_EXCEEDED` | 422 | Vượt giới hạn 50 items |
| `CART_HAS_UNAVAILABLE_ITEMS` | 422 | Có sản phẩm không khả dụng |
| `CART_ITEM_NOT_FOUND` | 404 | Item không tồn tại trong giỏ |
| `ORDER_NOT_FOUND` | 404 | Đơn hàng không tồn tại |
| `ORDER_CANNOT_CANCEL` | 422 | Không thể hủy đơn |
| `ORDER_CANNOT_CONFIRM_RECEIVED` | 422 | Không thể xác nhận nhận hàng |
| `ORDER_INVALID_STATUS_TRANSITION` | 422 | Chuyển trạng thái không hợp lệ |
| `ORDER_STOCK_CONFLICT` | 409 | Xung đột tồn kho (race condition) |
| `REVIEW_ORDER_ITEM_NOT_FOUND` | 422 | Không tìm thấy sản phẩm trong đơn |
| `REVIEW_ORDER_NOT_DELIVERED` | 422 | Đơn chưa giao thành công |
| `REVIEW_ALREADY_SUBMITTED` | 409 | Đã review rồi |
| `REVIEW_PERIOD_EXPIRED` | 422 | Hết thời gian review (90 ngày) |
| `REVIEW_NOT_FOUND` | 404 | Review không tồn tại |
| `COUPON_NOT_FOUND` | 404 | Mã không tồn tại |
| `COUPON_INACTIVE` | 422 | Mã chưa kích hoạt |
| `COUPON_NOT_STARTED` | 422 | Mã chưa có hiệu lực |
| `COUPON_EXPIRED` | 422 | Mã hết hạn |
| `COUPON_USAGE_LIMIT_REACHED` | 422 | Mã hết lượt dùng |
| `COUPON_USER_LIMIT_REACHED` | 422 | User hết lượt |
| `COUPON_MIN_ORDER_NOT_MET` | 422 | Chưa đạt đơn tối thiểu |
| `COUPON_NOT_APPLICABLE_TO_CART` | 422 | Không áp dụng cho sản phẩm trong giỏ |
| `COUPON_CODE_EXISTED` | 409 | Code đã tồn tại |
| `COUPON_HAS_USAGE_HISTORY` | 422 | Đã có lịch sử sử dụng |
| `ADDRESS_NOT_FOUND` | 404 | Địa chỉ không tồn tại |
| `ADDRESS_MAX_EXCEEDED` | 422 | Vượt giới hạn 10 địa chỉ |
| `ADDRESS_CANNOT_DELETE_DEFAULT` | 422 | Không xóa được địa chỉ mặc định |
| `USER_NOT_FOUND` | 404 | Người dùng không tồn tại |
| `USER_ALREADY_LOCKED` | 422 | Tài khoản đã bị khóa |
| `USER_NOT_LOCKED` | 422 | Tài khoản không bị khóa |
| `CANNOT_LOCK_ADMIN` | 422 | Không thể khóa tài khoản admin |
| `UPLOAD_INVALID_TYPE` | 400 | Định dạng file không hợp lệ |
| `UPLOAD_FILE_TOO_LARGE` | 400 | File quá lớn (max 5MB) |
| `UPLOAD_NO_FILE` | 400 | Không có file nào được gửi lên |
| `UPLOAD_MAX_FILES_EXCEEDED` | 400 | Vượt giới hạn số file (max 10) |
| `FLASH_SALE_OUT_OF_STOCK` | 422 | Hết hàng Flash Sale |
| `FLASH_SALE_ALREADY_ACTIVE` | 422 | Sản phẩm đang có Flash Sale |
| `FLASH_SALE_PRICE_INVALID` | 422 | Giá Flash Sale phải nhỏ hơn giá gốc |
| `FLASH_SALE_STOCK_EXCEEDS` | 422 | Vượt tổng tồn kho |
| `FLASH_SALE_END_TIME_INVALID` | 422 | Thời gian kết thúc không hợp lệ |
| `BANNER_NOT_FOUND` | 404 | Banner không tồn tại |
| `FORBIDDEN` | 403 | Không có quyền thực hiện thao tác |
| `THROTTLE_EXCEEDED` | 429 | Vượt giới hạn request (rate limit) |
| `SYS_INTERNAL_ERROR` | 500 | Lỗi hệ thống nội bộ |
| `SYS_SERVICE_UNAVAILABLE` | 503 | Dịch vụ tạm thời không khả dụng |

---

# Phụ Lục B — Danh Sách Endpoints

### Public 🔓 (18 endpoints)
```
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/verify-email
POST /auth/resend-verify-email
POST /auth/forgot-password
POST /auth/reset-password
GET  /categories
GET  /categories/:slug
GET  /products
GET  /products/flash-sale
GET  /products/featured
GET  /products/best-sellers
GET  /products/newest
GET  /products/:slug
GET  /products/:id/related
POST /products/:id/view
GET  /banners
GET  /reviews/product/:productId
GET  /health
GET  /api/v1
```

### User 🔐 (33 endpoints)
```
POST   /auth/logout
GET    /auth/me
GET    /users/me
PATCH  /users/me
PATCH  /users/me/password
PATCH  /users/me/avatar
GET    /addresses
POST   /addresses
PATCH  /addresses/:id
DELETE /addresses/:id
PATCH  /addresses/:id/set-default
GET    /wishlist
GET    /wishlist/check/:productId
POST   /wishlist/:productId
DELETE /wishlist/:productId
GET    /cart
POST   /cart
PATCH  /cart/:itemId
DELETE /cart/:itemId
DELETE /cart
POST   /coupons/validate
GET    /orders
GET    /orders/:id
POST   /orders
POST   /orders/:id/cancel
POST   /orders/:id/confirm-received
POST   /reviews
POST   /reviews/:id/helpful
GET    /notifications
PATCH  /notifications/:id/read
PATCH  /notifications/read-all
DELETE /notifications/:id
POST   /upload/image
POST   /upload/images
DELETE /upload
```

### Admin/Moderator 🛡️ (38 endpoints)
```
GET    /admin/users
GET    /admin/users/:id
PATCH  /admin/users/:id/lock
PATCH  /admin/users/:id/unlock
PATCH  /admin/users/:id/role
GET    /admin/categories
POST   /admin/categories
PATCH  /admin/categories/:id
DELETE /admin/categories/:id
GET    /admin/products
GET    /admin/products/:id
POST   /admin/products
PATCH  /admin/products/:id
DELETE /admin/products/:id
PATCH  /admin/products/:id/toggle-active
POST   /admin/products/:id/variants
PATCH  /admin/products/:id/variants/:variantId
DELETE /admin/products/:id/variants/:variantId
GET    /admin/orders
GET    /admin/orders/:id
PATCH  /admin/orders/:id/status
PATCH  /admin/orders/bulk-status
GET    /admin/orders/export
GET    /admin/reviews
PATCH  /admin/reviews/:id/approve
PATCH  /admin/reviews/:id/hide
PATCH  /admin/reviews/:id/unhide
DELETE /admin/reviews/:id
GET    /admin/coupons
GET    /admin/coupons/:id
POST   /admin/coupons
PATCH  /admin/coupons/:id
DELETE /admin/coupons/:id
GET    /admin/banners
POST   /admin/banners
PATCH  /admin/banners/:id
DELETE /admin/banners/:id
PATCH  /admin/banners/reorder
GET    /admin/dashboard/stats
GET    /admin/dashboard/revenue
GET    /admin/dashboard/orders/stats
GET    /admin/dashboard/products/best-sellers
GET    /admin/dashboard/users/recent
GET    /admin/dashboard/reviews/pending
```

**TỔNG: ~92 endpoints**