import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueRunnerService } from './queue/queue-runner.service';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly queueRunnerService: QueueRunnerService,
  ) {}

  getStatus() {
    return {
      appEnv: this.configService.get<string>('APP_ENV', 'local'),
      queueName: this.queueRunnerService.getStatus().queueName,
      queueRunner: this.queueRunnerService.getStatus().redisConnection,
      redisUrl: this.configService.get<string>(
        'REDIS_URL',
        'redis://localhost:6379',
      ),
      service: 'worker',
      status: 'ready',
    } as const;
  }

  onApplicationBootstrap() {
    const redisUrl = this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );

    this.logger.log(
      `Worker bootstrap placeholder ready. Redis target: ${redisUrl}. Queue: ${this.queueRunnerService.getStatus().queueName}`,
    );
  }
}
