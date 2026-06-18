import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: unknown) => {
              if (key === 'APP_ENV') return 'test';
              if (key === 'PORT') return 3001;
              return defaultValue;
            },
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $queryRawUnsafe: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('health', () => {
    it('should return an ok payload', () => {
      expect(appController.getHealth()).toEqual({
        appEnv: 'test',
        port: 3001,
        service: 'api',
        status: 'ok',
      });
    });
  });

  describe('readiness', () => {
    it('should return readiness payload', async () => {
      await expect(appService.getReadiness()).resolves.toMatchObject({
        appEnv: 'test',
        port: 3001,
        service: 'api',
        queue: {
          configured: true,
          transport: 'redis',
        },
      });
    });
  });
});
