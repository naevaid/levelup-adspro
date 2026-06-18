import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { Socket } from 'net';

type DependencyHealth = {
  status: 'up' | 'down';
  latencyMs: number;
  error?: string | null;
};

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  getHealth() {
    return {
      appEnv: this.configService.get<string>('APP_ENV', 'local'),
      port: this.configService.get<number>('PORT', 3001),
      service: 'api',
      status: 'ok',
    } as const;
  }

  async getReadiness() {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);
    const status =
      database.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded';

    return {
      appEnv: this.configService.get<string>('APP_ENV', 'local'),
      port: this.configService.get<number>('PORT', 3001),
      service: 'api',
      status,
      dependencies: {
        database,
        redis,
      },
      queue: {
        transport: 'redis',
        configured: Boolean(this.configService.get<string>('REDIS_URL')),
        status: redis.status === 'up' ? 'ready' : 'degraded',
      },
    } as const;
  }

  private async checkDatabase(): Promise<DependencyHealth> {
    const startedAt = Date.now();

    try {
      await this.prismaService.$queryRawUnsafe('SELECT 1');
      return {
        status: 'up',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Database check failed.',
      };
    }
  }

  private async checkRedis(): Promise<DependencyHealth> {
    const startedAt = Date.now();
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      return {
        status: 'down',
        latencyMs: 0,
        error: 'REDIS_URL belum dikonfigurasi.',
      };
    }

    try {
      const url = new URL(redisUrl);
      const host = url.hostname;
      const port = Number.parseInt(url.port || '6379', 10);

      await new Promise<void>((resolve, reject) => {
        const socket = new Socket();
        const onError = (error: Error) => {
          socket.destroy();
          reject(error);
        };

        socket.setTimeout(2000);
        socket.once('error', onError);
        socket.once('timeout', () => {
          socket.destroy();
          reject(new Error('Redis check timed out.'));
        });
        socket.connect(port, host, () => {
          socket.end();
          resolve();
        });
      });

      return {
        status: 'up',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Redis check failed.',
      };
    }
  }
}
