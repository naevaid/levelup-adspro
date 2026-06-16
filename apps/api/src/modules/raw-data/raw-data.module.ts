import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { RawDataService } from './raw-data.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [RawDataService],
  exports: [RawDataService],
})
export class RawDataModule {}
