import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppService } from './app.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);
  const appService = app.get(AppService);
  const appEnv = configService.get<string>('APP_ENV', 'local');

  logger.log(
    `Worker started in ${appEnv} with status: ${JSON.stringify(appService.getStatus())}`,
  );

  const shutdown = async () => {
    logger.log('Worker shutdown signal diterima, menutup aplikasi...');
    await app.close();
    process.exit(0);
  };

  process.once('SIGINT', () => {
    void shutdown();
  });

  process.once('SIGTERM', () => {
    void shutdown();
  });

  await new Promise(() => undefined);
}
void bootstrap();
