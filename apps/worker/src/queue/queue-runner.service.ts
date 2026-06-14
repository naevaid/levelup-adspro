import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, QueueEvents, Worker } from 'bullmq';
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
  private readonly logger = new Logger(QueueRunnerService.name);

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

      this.logger.log(
        `BullMQ worker ready. Queue "${this.queueName}" terhubung ke ${redisUrl}`,
      );
    } catch (error) {
      this.connectionState = 'degraded';
      await this.cleanupQueueResources();

      const message =
        error instanceof Error ? error.message : 'unknown connection error';

      this.logger.warn(
        `Worker queue berjalan dalam mode degraded. Redis belum tersedia: ${message}`,
      );
    }
  }

  async onApplicationShutdown() {
    await this.cleanupQueueResources();
  }

  private async processBootstrapJob(
    job: Job<BootstrapJobData>,
  ): Promise<BootstrapJobResult> {
    this.logger.log(
      `Memproses job ${job.name} dari ${job.data.source} pada ${job.data.createdAt}`,
    );

    return Promise.resolve({
      processedAt: new Date().toISOString(),
      queueName: this.queueName,
      status: 'processed',
    });
  }

  private registerQueueObservers() {
    this.worker?.on('completed', (job) => {
      this.logger.log(`Job selesai diproses: ${job.name}#${job.id}`);
    });

    this.worker?.on('failed', (job, error) => {
      this.logger.error(
        `Job gagal diproses: ${job?.name ?? 'unknown'}#${job?.id ?? 'n/a'} - ${error.message}`,
      );
    });

    this.queueEvents?.on('error', (error) => {
      this.logger.warn(`Queue event error: ${error.message}`);
    });
  }

  private async ensureBootstrapJob() {
    await this.queue?.add(
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
