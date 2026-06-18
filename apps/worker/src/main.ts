import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppService } from './app.service';
import { writeWorkerLog } from './observability/worker-log';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const configService = app.get(ConfigService);
  const appService = app.get(AppService);
  const appEnv = configService.get<string>('APP_ENV', 'local');

  writeWorkerLog('log', {
    event: 'worker_bootstrap_started',
    app_env: appEnv,
    status: appService.getStatus(),
  });

  const shutdown = async () => {
    writeWorkerLog('log', {
      event: 'worker_shutdown_signal',
      app_env: appEnv,
      signal: 'manual',
      message: 'Worker shutdown signal diterima, menutup aplikasi.',
    });
    await app.close();
    process.exit(0);
  };

  process.once('SIGINT', () => {
    writeWorkerLog('warn', {
      event: 'worker_signal_received',
      app_env: appEnv,
      signal: 'SIGINT',
    });
    void shutdown();
  });

  process.once('SIGTERM', () => {
    writeWorkerLog('warn', {
      event: 'worker_signal_received',
      app_env: appEnv,
      signal: 'SIGTERM',
    });
    void shutdown();
  });

  await new Promise(() => undefined);
}
void bootstrap();
