import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const envLocal = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
}
dotenv.config();

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

describe('Appointments & Auth API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /appointments/availability', () => {
    it('should return availability for a valid month without exposing customer data', async () => {
      const res = await request(app.getHttpServer())
        .get('/appointments/availability?month=2026-10')
        .expect(200);

      expect(res.body).toHaveProperty('month', '2026-10');
      expect(Array.isArray(res.body.days)).toBe(true);
      expect(res.body.days.length).toBe(31);

      const firstDay = res.body.days[0];
      expect(firstDay).toHaveProperty('date', '2026-10-01');
      expect(typeof firstDay.available).toBe('boolean');

      // Verify privacy guarantee: no customer data anywhere in response
      const stringified = JSON.stringify(res.body);
      expect(stringified).not.toContain('customerName');
      expect(stringified).not.toContain('email');
      expect(stringified).not.toContain('phone');
    });

    it('should reject invalid month query with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .get('/appointments/availability?month=invalid-format')
        .expect(400);
    });

    it('should reject missing month parameter with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .get('/appointments/availability')
        .expect(400);
    });
  });

  describe('POST /appointments (validation)', () => {
    it('should reject booking requests with invalid date (e.g. Feb 30)', async () => {
      await request(app.getHttpServer())
        .post('/appointments')
        .send({
          customerName: 'Jane Doe',
          email: 'jane@example.com',
          date: '2026-02-30',
        })
        .expect(400);
    });

    it('should reject booking requests with invalid email', async () => {
      await request(app.getHttpServer())
        .post('/appointments')
        .send({
          customerName: 'Jane Doe',
          email: 'not-an-email',
          date: '2026-10-15',
        })
        .expect(400);
    });

    it('should reject booking requests with missing required customer name', async () => {
      await request(app.getHttpServer())
        .post('/appointments')
        .send({
          email: 'jane@example.com',
          date: '2026-10-15',
        })
        .expect(400);
    });

    it('should reject unexpected extra fields (whitelisting enforced)', async () => {
      await request(app.getHttpServer())
        .post('/appointments')
        .send({
          customerName: 'Jane Doe',
          email: 'jane@example.com',
          date: '2026-10-15',
          price: 100, // forbidden property
        })
        .expect(400);
    });
  });

  describe('Protected Admin Endpoints (authorization guards)', () => {
    it('GET /appointments should reject unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .get('/appointments?month=2026-10')
        .expect(401);
    });

    it('GET /appointments/:id should reject unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .get('/appointments/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });

    it('PATCH /appointments/:id/cancel should reject unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .patch('/appointments/00000000-0000-0000-0000-000000000000/cancel')
        .expect(401);
    });

    it('GET /auth/me should reject unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });
  });

  describe('POST /auth/login (authentication)', () => {
    it('should reject invalid credentials with generic 401 message', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent-admin@beautysalon.com',
          password: 'wrongpassword123',
        })
        .expect(401);

      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should reject malformed login body with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'not-an-email',
          password: 'short',
        })
        .expect(400);
    });
  });
});
