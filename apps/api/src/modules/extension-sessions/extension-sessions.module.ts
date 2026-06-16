import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ExtensionSessionAuthGuard } from './extension-session-auth.guard';
import { ExtensionSessionsController } from './extension-sessions.controller';
import { ExtensionSessionsService } from './extension-sessions.service';

@Module({
  imports: [PrismaModule],
  controllers: [ExtensionSessionsController],
  providers: [ExtensionSessionsService, ExtensionSessionAuthGuard],
  exports: [ExtensionSessionsService, ExtensionSessionAuthGuard],
})
export class ExtensionSessionsModule {}
