import { Module } from '@nestjs/common';
import { AppService } from '../../app.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { InternalMonitoringController } from './internal-monitoring.controller';
import { InternalMonitoringService } from './internal-monitoring.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [InternalMonitoringController],
  providers: [InternalMonitoringService, AppService],
})
export class InternalMonitoringModule {}
