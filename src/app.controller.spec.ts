import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should redirect / to /api', () => {
      const res = { redirect: jest.fn() };
      appController.root(res as any);
      expect(res.redirect).toHaveBeenCalledWith('/api');
    });

    it('should return health status', () => {
      const health = appController.getHealth();
      expect(health.status).toBe('ok');
      expect(health.timestamp).toBeDefined();
    });
  });
});
