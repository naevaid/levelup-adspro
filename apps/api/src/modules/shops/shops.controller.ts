import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { ShopsService } from './shops.service';

@Controller('api/v1/shops')
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @UseGuards(SessionAuthGuard)
  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.shopsService.listForOrganization(request.auth.organization.id);
  }

  @UseGuards(SessionAuthGuard)
  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateShopDto) {
    return this.shopsService.createForOrganization(
      request.auth.organization.id,
      dto,
    );
  }

  @UseGuards(SessionAuthGuard)
  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateShopDto,
  ) {
    return this.shopsService.updateForOrganization(request.auth.organization.id, id, dto);
  }
}
