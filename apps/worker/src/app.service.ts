import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeWorkerLog } from './observability/worker-log';
import { QueueRunnerService } from './queue/queue-runner.service';

@Injectable()
export class AppService implements OnApplicationBootstrap {
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
    const appEnv = this.configService.get<string>('APP_ENV', 'local');

    writeWorkerLog('log', {
      event: 'worker_bootstrap_ready',
      app_env: appEnv,
      queue_name: this.queueRunnerService.getStatus().queueName,
      redis_target: redisUrl,
      queue_runner_status: this.queueRunnerService.getStatus().redisConnection,
    });
  }
}
