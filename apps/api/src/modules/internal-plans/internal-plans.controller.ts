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
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { CreateInternalPlanDto } from './dto/create-internal-plan.dto';
import { UpdateInternalPlanDto } from './dto/update-internal-plan.dto';
import { InternalPlansService } from './internal-plans.service';

@Controller('api/v1/internal/plans')
export class InternalPlansController {
  constructor(private readonly internalPlansService: InternalPlansService) {}

  @UseGuards(SessionAuthGuard)
  @Get()
  list(@Req() request: AuthenticatedRequest) {
    this.internalPlansService.assertAccess(request.auth.user.internalRole);
    return this.internalPlansService.listAll();
  }

  @UseGuards(SessionAuthGuard)
  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateInternalPlanDto,
  ) {
    this.internalPlansService.assertAccess(request.auth.user.internalRole);
    return this.internalPlansService.create(dto);
  }

  @UseGuards(SessionAuthGuard)
  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateInternalPlanDto,
  ) {
    this.internalPlansService.assertAccess(request.auth.user.internalRole);
    return this.internalPlansService.update(id, dto);
  }

  @UseGuards(SessionAuthGuard)
  @Delete(':id')
  deactivate(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    this.internalPlansService.assertAccess(request.auth.user.internalRole);
    return this.internalPlansService.deactivate(id);
  }
}
