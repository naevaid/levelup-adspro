import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { MarketplacesService } from './marketplaces.service';

@Controller('api/v1/marketplaces')
export class MarketplacesController {
  constructor(private readonly marketplacesService: MarketplacesService) {}

  @UseGuards(SessionAuthGuard)
  @Get()
  listMarketplaces() {
    return this.marketplacesService.list();
  }
}
