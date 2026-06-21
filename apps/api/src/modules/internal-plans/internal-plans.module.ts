import { Module } from '@nestjs/common';
import { InternalPlansController } from './internal-plans.controller';
import { InternalPlansService } from './internal-plans.service';

@Module({
  controllers: [InternalPlansController],
  providers: [InternalPlansService],
})
export class InternalPlansModule {}
