import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionLoggingFilter } from './observability/http-exception-logging.filter';
import { httpRequestLoggingMiddleware } from './observability/http-request-logging.middleware';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  const configService = app.get(ConfigService);
  const prismaService = app.get(PrismaService);
  const httpAdapterHost = app.get(HttpAdapterHost);
  const appEnv = configService.get<string>('APP_ENV', 'local');
  const port = configService.get<number>('PORT', 3001);

  app.use(httpRequestLoggingMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(
    new HttpExceptionLoggingFilter(httpAdapterHost, appEnv),
  );

  prismaService.enableShutdownHooks(app);
  await app.listen(port);
}
void bootstrap();
