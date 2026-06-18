import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, QueueEvents, Worker } from 'bullmq';
import { writeWorkerLog } from '../observability/worker-log';
import { BOOTSTRAP_JOB_NAME, WORKER_QUEUE_NAME } from './queue.constants';

type BootstrapJobData = {
  createdAt: string;
  source: string;
};

type BootstrapJobResult = {
  processedAt: string;
  queueName: string;
  status: 'processed';
};

@Injectable()
export class QueueRunnerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly queueName: string;

  private connectionState: 'idle' | 'connected' | 'degraded' = 'idle';
  private queue?: Queue<BootstrapJobData, BootstrapJobResult, string>;
  private worker?: Worker<BootstrapJobData, BootstrapJobResult, string>;
  private queueEvents?: QueueEvents;

  constructor(private readonly configService: ConfigService) {
    this.queueName = this.configService.get<string>(
      'WORKER_QUEUE_NAME',
      WORKER_QUEUE_NAME,
    );
  }

  getStatus() {
    return {
      queueName: this.queueName,
      redisConnection: this.connectionState,
    } as const;
  }

  async onApplicationBootstrap() {
    const appEnv = this.configService.get<string>('APP_ENV', 'local');
    try {
      const redisUrl = this.configService.get<string>(
        'REDIS_URL',
        'redis://localhost:6379',
      );
      const connection = this.createConnectionOptions(redisUrl);

      this.worker = new Worker<BootstrapJobData, BootstrapJobResult, string>(
        this.queueName,
        async (job) => this.processBootstrapJob(job),
        {
          connection,
        },
      );

      this.queue = new Queue<BootstrapJobData, BootstrapJobResult, string>(
        this.queueName,
        {
          connection,
        },
      );

      this.queueEvents = new QueueEvents(this.queueName, {
        connection,
      });

      this.registerQueueObservers();

      await this.worker.waitUntilReady();
      await this.queueEvents.waitUntilReady();

      this.connectionState = 'connected';
      await this.ensureBootstrapJob();

      writeWorkerLog('log', {
        event: 'worker_queue_ready',
        app_env: appEnv,
        queue_name: this.queueName,
        redis_target: redisUrl,
        redis_connection: this.connectionState,
      });
    } catch (error) {
      this.connectionState = 'degraded';
      await this.cleanupQueueResources();

      const message =
        error instanceof Error ? error.message : 'unknown connection error';

      writeWorkerLog('warn', {
        event: 'worker_queue_degraded',
        app_env: appEnv,
        queue_name: this.queueName,
        redis_connection: this.connectionState,
        error_message: message,
      });
    }
  }

  async onApplicationShutdown() {
    await this.cleanupQueueResources();
  }

  private async processBootstrapJob(
    job: Job<BootstrapJobData>,
  ): Promise<BootstrapJobResult> {
    writeWorkerLog('log', {
      event: 'worker_job_processing',
      app_env: this.configService.get<string>('APP_ENV', 'local'),
      queue_name: this.queueName,
      job_id: job.id ?? null,
      job_name: job.name,
      job_source: job.data.source,
      job_created_at: job.data.createdAt,
    });

    return Promise.resolve({
      processedAt: new Date().toISOString(),
      queueName: this.queueName,
      status: 'processed',
    });
  }

  private registerQueueObservers() {
    this.worker?.on('completed', (job) => {
      writeWorkerLog('log', {
        event: 'worker_job_completed',
        app_env: this.configService.get<string>('APP_ENV', 'local'),
        queue_name: this.queueName,
        job_id: job.id ?? null,
        job_name: job.name,
      });
    });

    this.worker?.on('failed', (job, error) => {
      writeWorkerLog('error', {
        event: 'worker_job_failed',
        app_env: this.configService.get<string>('APP_ENV', 'local'),
        queue_name: this.queueName,
        job_id: job?.id ?? null,
        job_name: job?.name ?? null,
        error_message: error.message,
        stack: error.stack ?? null,
      });
    });

    this.queueEvents?.on('error', (error) => {
      writeWorkerLog('warn', {
        event: 'worker_queue_event_error',
        app_env: this.configService.get<string>('APP_ENV', 'local'),
        queue_name: this.queueName,
        error_message: error.message,
      });
    });
  }

  private async ensureBootstrapJob() {
    const job = await this.queue?.add(
      BOOTSTRAP_JOB_NAME,
      {
        createdAt: new Date().toISOString(),
        source: 'worker-bootstrap',
      },
      {
        jobId: 'worker-bootstrap-job',
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    );

    writeWorkerLog('log', {
      event: 'worker_bootstrap_job_enqueued',
      app_env: this.configService.get<string>('APP_ENV', 'local'),
      queue_name: this.queueName,
      job_id: job?.id ?? null,
      job_name: BOOTSTRAP_JOB_NAME,
    });
  }

  private async cleanupQueueResources() {
    await this.queueEvents?.close();
    await this.worker?.close();
    await this.queue?.close();

    this.queueEvents = undefined;
    this.worker = undefined;
    this.queue = undefined;
  }

  private createConnectionOptions(redisUrl: string) {
    const parsedUrl = new URL(redisUrl);
    const db = parsedUrl.pathname ? Number(parsedUrl.pathname.slice(1)) : 0;

    return {
      host: parsedUrl.hostname,
      port: Number(parsedUrl.port || 6379),
      db: Number.isNaN(db) ? 0 : db,
      password: parsedUrl.password || undefined,
      username: parsedUrl.username || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }
}
