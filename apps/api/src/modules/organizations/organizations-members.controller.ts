import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CreateOrganizationMemberDto } from './dto/create-organization-member.dto';
import { UpdateOrganizationMemberDto } from './dto/update-organization-member.dto';
import { OrganizationsMembersService } from './organizations-members.service';

@Controller('api/v1/organizations/current/members')
export class OrganizationsMembersController {
  constructor(
    private readonly organizationsMembersService: OrganizationsMembersService,
  ) {}

  @UseGuards(SessionAuthGuard)
  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.organizationsMembersService.listMembers(
      request.auth.organization.id,
      request.auth.membership.role,
    );
  }

  @UseGuards(SessionAuthGuard)
  @Post('invite')
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateOrganizationMemberDto,
  ) {
    return this.organizationsMembersService.createMember(
      request.auth.organization.id,
      request.auth.user.id,
      request.auth.membership.role,
      dto,
    );
  }

  @UseGuards(SessionAuthGuard)
  @Patch(':memberId')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateOrganizationMemberDto,
  ) {
    return this.organizationsMembersService.updateMember(
      request.auth.organization.id,
      memberId,
      request.auth.user.id,
      request.auth.membership.role,
      dto,
    );
  }

  @UseGuards(SessionAuthGuard)
  @Delete(':memberId')
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('memberId') memberId: string,
  ) {
    return this.organizationsMembersService.removeMember(
      request.auth.organization.id,
      memberId,
      request.auth.user.id,
      request.auth.membership.role,
    );
  }
}
