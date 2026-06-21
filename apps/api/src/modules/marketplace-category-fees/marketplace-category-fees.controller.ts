import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { CreateMarketplaceCategoryFeeDto } from './dto/create-marketplace-category-fee.dto';
import { ListMarketplaceCategoryFeesDto } from './dto/list-marketplace-category-fees.dto';
import { UpdateMarketplaceCategoryFeeDto } from './dto/update-marketplace-category-fee.dto';
import { MarketplaceCategoryFeesService } from './marketplace-category-fees.service';

@Controller('api/v1/marketplace-category-fees')
export class MarketplaceCategoryFeesController {
  constructor(
    private readonly marketplaceCategoryFeesService: MarketplaceCategoryFeesService,
  ) {}

  @UseGuards(SessionAuthGuard)
  @Get()
  list(
    @Req() _request: AuthenticatedRequest,
    @Query() query: ListMarketplaceCategoryFeesDto,
  ) {
    return this.marketplaceCategoryFeesService.listGlobal(query);
  }

  @UseGuards(SessionAuthGuard)
  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateMarketplaceCategoryFeeDto,
  ) {
    this.marketplaceCategoryFeesService.assertAccess(
      request.auth.user.internalRole,
    );
    return this.marketplaceCategoryFeesService.createGlobal(dto);
  }

  @UseGuards(SessionAuthGuard)
  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateMarketplaceCategoryFeeDto,
  ) {
    this.marketplaceCategoryFeesService.assertAccess(
      request.auth.user.internalRole,
    );
    return this.marketplaceCategoryFeesService.updateGlobal(id, dto);
  }

  @UseGuards(SessionAuthGuard)
  @Delete(':id')
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    this.marketplaceCategoryFeesService.assertAccess(
      request.auth.user.internalRole,
    );
    return this.marketplaceCategoryFeesService.removeGlobal(id);
  }
}
