import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { workerEnvValidationSchema } from './config/env.validation';
import { QueueRunnerService } from './queue/queue-runner.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
      validationSchema: workerEnvValidationSchema,
    }),
  ],
  providers: [AppService, QueueRunnerService],
})
export class AppModule {}
