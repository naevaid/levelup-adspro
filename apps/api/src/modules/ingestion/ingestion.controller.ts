import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { ExtensionAuthenticatedRequest } from '../extension-sessions/extension-authenticated-request';
import { ExtensionSessionAuthGuard } from '../extension-sessions/extension-session-auth.guard';
import { CreateIngestionBatchDto } from './dto/create-ingestion-batch.dto';
import { IngestionService } from './ingestion.service';

@Controller('api/v1/ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @UseGuards(SessionAuthGuard)
  @Get('batches')
  list(@Req() request: AuthenticatedRequest) {
    return this.ingestionService.listLatestForOrganization(
      request.auth.organization.id,
    );
  }

  @UseGuards(ExtensionSessionAuthGuard)
  @Post('batches')
  createBatch(
    @Req() request: ExtensionAuthenticatedRequest,
    @Body() dto: CreateIngestionBatchDto,
  ) {
    return this.ingestionService.createBatch(request, dto);
  }

  @UseGuards(SessionAuthGuard)
  @Delete('batches/:id')
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.ingestionService.removeForOrganization(
      request.auth.organization.id,
      id,
    );
  }
}
