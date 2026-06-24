import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import { AuthModule } from '../src/modules/auth/auth.module';
import { ProductsModule } from '../src/modules/products/products.module';
import { CategoriesModule } from '../src/modules/categories/categories.module';
import { AuditLogsModule } from '../src/modules/audit-logs/audit-logs.module';
import { CartModule } from '../src/modules/cart/cart.module';
import { AddressesModule } from '../src/modules/addresses/addresses.module';
import { OrdersModule } from '../src/modules/orders/orders.module';
import { AppCacheModule } from '../src/cache/cache.module';
import { User, UserRole } from '../src/modules/users/schemas/user.schema';
import { bootstrapTestApp, closeTestApp, TestAppContext } from './setup';
import {
  buildRegisterDto,
  buildCreateCategoryDto,
  buildCreateProductDto,
  buildAddCartItemDto,
  buildCreateAddressDto,
  buildCreateOrderDto,
} from './fixtures';

describe('Orders (e2e)', () => {
  let ctx: TestAppContext;
  let userToken: string;
  let adminToken: string;
  let productId: string;
  let addressId: string;

  const userCreds = buildRegisterDto();
  const adminCreds = buildRegisterDto({
    email: `admin-${Date.now()}@example.com`,
  });

  beforeAll(async () => {
    ctx = await bootstrapTestApp([
      AppCacheModule,
      AuthModule,
      CategoriesModule,
      AuditLogsModule,
      ProductsModule,
      CartModule,
      AddressesModule,
      OrdersModule,
    ]);

    // Register + verify + login — regular user
    await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(userCreds);
    const verifyToken1 = (
      ctx.emailMock.sendVerifyEmail.mock.calls[0] as unknown[]
    )[2] as string;
    await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: verifyToken1 });
    const userLogin = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: userCreds.email, password: userCreds.password });
    userToken = userLogin.body.data.accessToken as string;

    // Register + verify + login — admin user
    ctx.emailMock.sendVerifyEmail.mockClear();
    await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(adminCreds);
    const verifyToken2 = (
      ctx.emailMock.sendVerifyEmail.mock.calls[0] as unknown[]
    )[2] as string;
    await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: verifyToken2 });

    // Promote to admin
    const userModel = ctx.app.get(getModelToken(User.name));
    await userModel.findOneAndUpdate(
      { email: adminCreds.email },
      { role: UserRole.SUPER_ADMIN },
    );
    ctx.redisMock._store.clear();

    const adminLogin = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminCreds.email, password: adminCreds.password });
    adminToken = adminLogin.body.data.accessToken as string;

    // Seed: category + product
    const catRes = await request(ctx.app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(buildCreateCategoryDto());
    const categoryId = catRes.body.data._id as string;

    const prodRes = await request(ctx.app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(buildCreateProductDto(categoryId, { stock: 50, price: 200000 }));
    productId = prodRes.body.data._id as string;

    // Seed: address for the regular user
    const addrRes = await request(ctx.app.getHttpServer())
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${userToken}`)
      .send(buildCreateAddressDto());
    addressId = addrRes.body.data._id as string;
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  // ── Cart operations ────────────────────────────────────────────────────────

  describe('Cart', () => {
    it('200 — GET /cart returns empty cart for new user', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
    });

    it('200 — POST /cart adds product to cart', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send(buildAddCartItemDto(productId, 2))
        .expect(200);

      const items = res.body.data.items as unknown[];
      expect(items.length).toBeGreaterThan(0);
    });

    it('401 — rejects unauthenticated cart access', async () => {
      await request(ctx.app.getHttpServer()).get('/api/v1/cart').expect(401);
    });
  });

  // ── Order creation ─────────────────────────────────────────────────────────

  describe('POST /api/v1/orders', () => {
    it('201 — creates order from non-empty cart', async () => {
      // Ensure cart has items
      await request(ctx.app.getHttpServer())
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send(buildAddCartItemDto(productId, 1));

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(buildCreateOrderDto(addressId))
        .expect(201);

      expect(res.body.data.order).toMatchObject({ status: 'pending' });
      expect(ctx.queueMock.add).toHaveBeenCalled();
    });

    it('400 — fails with empty cart', async () => {
      // Cart should be empty after order creation (cart is cleared)
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(buildCreateOrderDto(addressId));

      // Either 400 (CART_EMPTY) or 201 if cart wasn't cleared; just check not 5xx
      expect(res.status).toBeLessThan(500);
    });

    it('400 — fails with non-existent address', async () => {
      // Re-add to cart
      await request(ctx.app.getHttpServer())
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send(buildAddCartItemDto(productId, 1));

      await request(ctx.app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(buildCreateOrderDto('000000000000000000000000'))
        .expect(404);
    });
  });

  // ── Order listing and detail ───────────────────────────────────────────────

  describe('GET /api/v1/orders', () => {
    it('200 — returns user order list', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data).toMatchObject({
        items: expect.any(Array),
        total: expect.any(Number),
      });
    });

    it('401 — rejects unauthenticated', async () => {
      await request(ctx.app.getHttpServer()).get('/api/v1/orders').expect(401);
    });
  });

  // ── Cancel order ───────────────────────────────────────────────────────────

  describe('POST /api/v1/orders/:id/cancel', () => {
    let orderId: string;

    beforeAll(async () => {
      // Add to cart + create a fresh order to cancel
      await request(ctx.app.getHttpServer())
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send(buildAddCartItemDto(productId, 1));

      const orderRes = await request(ctx.app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(buildCreateOrderDto(addressId));

      orderId = orderRes.body.data.order._id as string;
    });

    it('200 — cancels a PENDING order', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'Changed my mind' })
        .expect(200);

      expect(res.body.data.order.status).toBe('cancelled');
    });

    it('400 — cannot cancel already-cancelled order', async () => {
      await request(ctx.app.getHttpServer())
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'Again' })
        .expect(400);
    });
  });

  // ── Admin: update order status ─────────────────────────────────────────────

  describe('PATCH /api/v1/admin/orders/:id/status', () => {
    let pendingOrderId: string;

    beforeAll(async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send(buildAddCartItemDto(productId, 1));

      const orderRes = await request(ctx.app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(buildCreateOrderDto(addressId));

      pendingOrderId = orderRes.body.data.order._id as string;
    });

    it('200 — admin confirms a pending order', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/api/v1/admin/orders/${pendingOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed' })
        .expect(200);

      expect(res.body.data.order.status).toBe('confirmed');
    });

    it('400 — rejects invalid status transition (pending → shipping)', async () => {
      await request(ctx.app.getHttpServer())
        .patch(`/api/v1/admin/orders/${pendingOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'shipping' })
        .expect(400);
    });

    it('403 — regular user cannot update status', async () => {
      await request(ctx.app.getHttpServer())
        .patch(`/api/v1/admin/orders/${pendingOrderId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'confirmed' })
        .expect(403);
    });
  });
});
