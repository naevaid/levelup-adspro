import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CreateExtensionSessionDto } from './dto/create-extension-session.dto';
import type { ExtensionAuthenticatedRequest } from './extension-authenticated-request';
import { ExtensionSessionAuthGuard } from './extension-session-auth.guard';
import { ExtensionSessionsService } from './extension-sessions.service';

@Controller('api/v1/extension')
export class ExtensionSessionsController {
  constructor(
    private readonly extensionSessionsService: ExtensionSessionsService,
  ) {}

  @UseGuards(SessionAuthGuard)
  @Post('session')
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateExtensionSessionDto,
  ) {
    return this.extensionSessionsService.createForUserSession(
      request.auth.user.id,
      request.auth.organization.id,
      dto,
    );
  }

  @UseGuards(ExtensionSessionAuthGuard)
  @Post('heartbeat')
  heartbeat(@Req() request: ExtensionAuthenticatedRequest) {
    return this.extensionSessionsService.refreshHeartbeat(
      request.extensionAuth.session.id,
    );
  }
}
