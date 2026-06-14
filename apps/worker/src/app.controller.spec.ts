import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';
import { QueueRunnerService } from './queue/queue-runner.service';

describe('AppService', () => {
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: QueueRunnerService,
          useValue: {
            getStatus: () => ({
              queueName: 'bootstrap-jobs',
              redisConnection: 'connected',
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: unknown) => {
              if (key === 'APP_ENV') return 'test';
              if (key === 'REDIS_URL') return 'redis://localhost:6379';
              return defaultValue;
            },
          },
        },
      ],
    }).compile();

    appService = app.get<AppService>(AppService);
  });

  describe('status', () => {
    it('should return a ready payload', () => {
      expect(appService.getStatus()).toEqual({
        appEnv: 'test',
        queueName: 'bootstrap-jobs',
        queueRunner: 'connected',
        redisUrl: 'redis://localhost:6379',
        service: 'worker',
        status: 'ready',
      });
    });
  });
});
