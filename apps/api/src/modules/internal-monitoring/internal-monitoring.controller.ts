import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { InternalMonitoringService } from './internal-monitoring.service';

@Controller('api/v1/internal/monitoring')
export class InternalMonitoringController {
  constructor(
    private readonly internalMonitoringService: InternalMonitoringService,
  ) {}

  @UseGuards(SessionAuthGuard)
  @Get('summary')
  getSummary(@Req() request: AuthenticatedRequest) {
    this.internalMonitoringService.assertAccess(request.auth.user.internalRole);

    return this.internalMonitoringService.getOrganizationMonitoringSummary(
      request.auth.organization.id,
    );
  }
}
