import request from 'supertest';
import { AuthModule } from '../src/modules/auth/auth.module';
import { bootstrapTestApp, closeTestApp, TestAppContext } from './setup';
import { buildRegisterDto } from './fixtures';

describe('Auth (e2e)', () => {
  let ctx: TestAppContext;
  const credentials = buildRegisterDto();

  beforeAll(async () => {
    ctx = await bootstrapTestApp([AuthModule]);
  }, 30000);

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  // ── register ───────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('201 — creates user and sends verify email', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(credentials)
        .expect(201);

      expect(res.body.data).toMatchObject({ email: credentials.email });
      expect(ctx.emailMock.sendVerifyEmail).toHaveBeenCalledWith(
        credentials.email,
        credentials.fullName,
        expect.any(String),
      );
    });

    it('409 — rejects duplicate email', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(credentials)
        .expect(409);

      expect(res.body.errorCode).toBeDefined();
    });
  });

  // ── verify-email ───────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/verify-email', () => {
    it('200 — activates account with valid token', async () => {
      const token = (
        ctx.emailMock.sendVerifyEmail.mock.calls[0] as unknown[]
      )[2] as string;

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token })
        .expect(200);

      expect(res.body.data.message).toBe('Xác thực email thành công');
    });

    it('400 — rejects invalid token', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: 'definitely-not-a-valid-token' })
        .expect(400);
    });
  });

  // ── login ──────────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('200 — returns token pair after successful login', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: credentials.email, password: credentials.password })
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe(credentials.email);
    });

    it('401 — rejects wrong password', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: credentials.email, password: 'WrongPassword@1' })
        .expect(401);
    });
  });

  // ── refresh + logout flow ──────────────────────────────────────────────────

  describe('token refresh & logout flow', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeAll(async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: credentials.email, password: credentials.password });
      accessToken = res.body.data.accessToken as string;
      refreshToken = res.body.data.refreshToken as string;
    });

    it('200 — POST /refresh issues new token pair', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('200 — POST /logout revokes current refresh token', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      expect(res.body.data.message).toBeDefined();
    });

    it('401 — protected route requires valid Bearer token', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'any' })
        .expect(401);
    });
  });
});
