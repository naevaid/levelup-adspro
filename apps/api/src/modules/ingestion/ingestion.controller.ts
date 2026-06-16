import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { ExtensionAuthenticatedRequest } from '../extension-sessions/extension-authenticated-request';
import { ExtensionSessionAuthGuard } from '../extension-sessions/extension-session-auth.guard';
import { CreateIngestionBatchDto } from './dto/create-ingestion-batch.dto';
import { IngestionService } from './ingestion.service';

@Controller('api/v1/ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @UseGuards(ExtensionSessionAuthGuard)
  @Post('batches')
  createBatch(
    @Req() request: ExtensionAuthenticatedRequest,
    @Body() dto: CreateIngestionBatchDto,
  ) {
    return this.ingestionService.createBatch(request, dto);
  }
}
