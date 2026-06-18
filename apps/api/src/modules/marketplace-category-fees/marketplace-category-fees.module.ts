import { Module } from '@nestjs/common';
import { MarketplaceCategoryFeesController } from './marketplace-category-fees.controller';
import { MarketplaceCategoryFeesService } from './marketplace-category-fees.service';

@Module({
  controllers: [MarketplaceCategoryFeesController],
  providers: [MarketplaceCategoryFeesService],
  exports: [MarketplaceCategoryFeesService],
})
export class MarketplaceCategoryFeesModule {}
