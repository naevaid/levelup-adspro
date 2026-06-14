import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { AppService } from './../src/app.service';

describe('AppModule', () => {
  let moduleFixture: TestingModule;

  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  it('provides the worker bootstrap service', () => {
    const appService = moduleFixture.get(AppService);

    expect(appService.getStatus()).toEqual({
      appEnv: 'local',
      queueName: 'bootstrap-jobs',
      queueRunner: 'degraded',
      redisUrl: 'redis://localhost:6379',
      service: 'worker',
      status: 'ready',
    });
  });
});
