import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

@Controller('api/v1/organizations')
export class OrganizationsController {
  @UseGuards(SessionAuthGuard)
  @Get('current')
  getCurrentOrganization(@Req() request: AuthenticatedRequest) {
    return {
      id: request.auth.organization.id,
      name: request.auth.organization.name,
      slug: request.auth.organization.slug,
      status: request.auth.organization.status,
      currentMembership: {
        id: request.auth.membership.id,
        role: request.auth.membership.role,
        status: request.auth.membership.status,
      },
    };
  }
}
