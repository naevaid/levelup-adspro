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
import { CreateMarketplaceCategoryFeeDto } from './dto/create-marketplace-category-fee.dto';
import { UpdateMarketplaceCategoryFeeDto } from './dto/update-marketplace-category-fee.dto';
import { MarketplaceCategoryFeesService } from './marketplace-category-fees.service';

@Controller('api/v1/marketplace-category-fees')
export class MarketplaceCategoryFeesController {
  constructor(
    private readonly marketplaceCategoryFeesService: MarketplaceCategoryFeesService,
  ) {}

  @UseGuards(SessionAuthGuard)
  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.marketplaceCategoryFeesService.listForOrganization(
      request.auth.organization.id,
    );
  }

  @UseGuards(SessionAuthGuard)
  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateMarketplaceCategoryFeeDto,
  ) {
    return this.marketplaceCategoryFeesService.createForOrganization(
      request.auth.organization.id,
      dto,
    );
  }

  @UseGuards(SessionAuthGuard)
  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateMarketplaceCategoryFeeDto,
  ) {
    return this.marketplaceCategoryFeesService.updateForOrganization(
      request.auth.organization.id,
      id,
      dto,
    );
  }

  @UseGuards(SessionAuthGuard)
  @Delete(':id')
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.marketplaceCategoryFeesService.removeForOrganization(
      request.auth.organization.id,
      id,
    );
  }
}
