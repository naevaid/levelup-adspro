import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ExtensionSessionsModule } from '../extension-sessions/extension-sessions.module';
import { RawDataModule } from '../raw-data/raw-data.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [PrismaModule, RawDataModule, ExtensionSessionsModule],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}
