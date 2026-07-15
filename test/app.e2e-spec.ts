import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * Smoke test: proves the whole module graph wires up and that the three things
 * every route depends on still hold — the public API answers, unknown websites
 * 404, and admin routes stay behind auth.
 *
 * Needs the dev database seeded (`npx prisma db seed`). Richer behaviour is
 * covered by the scripts in test/e2e.
 */
describe('ModernWeb CMS (smoke)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // createNestApplication() does not run main.ts, so mirror its setup.
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the public Content API for a seeded website', () => {
    return request(app.getHttpServer())
      .get('/api/v1/content/halwa-travel/settings')
      .expect(200);
  });

  it('404s an unknown website instead of leaking its existence', () => {
    return request(app.getHttpServer())
      .get('/api/v1/content/tidak-ada/settings')
      .expect(404);
  });

  it('keeps admin routes behind auth', () => {
    return request(app.getHttpServer()).get('/api/v1/websites').expect(401);
  });
});
