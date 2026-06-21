import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SwitchOrganizationDto } from './dto/switch-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('api/v1/organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @UseGuards(SessionAuthGuard)
  @Get()
  listOrganizations(@Req() request: AuthenticatedRequest) {
    return this.organizationsService.listOrganizations(
      request.auth.user.id,
      request.auth.organization.id,
    );
  }

  @UseGuards(SessionAuthGuard)
  @Get('current')
  getCurrentOrganization(@Req() request: AuthenticatedRequest) {
    return this.organizationsService.getCurrentOrganization(
      request.auth.user.id,
      request.auth.organization.id,
    );
  }

  @UseGuards(SessionAuthGuard)
  @Post('switch')
  switchOrganization(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SwitchOrganizationDto,
  ) {
    return this.organizationsService.switchOrganization(
      request.auth.sessionId,
      request.auth.user.id,
      dto.organizationId,
    );
  }
}
