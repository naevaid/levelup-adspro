import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { BillingService } from './billing.service';
import { CheckoutDto } from './dto/checkout.dto';
import { RefreshPaymentStatusDto } from './dto/refresh-payment-status.dto';

@Controller('api/v1')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @UseGuards(SessionAuthGuard)
  @Get('plans')
  listPlans() {
    return this.billingService.listPlans();
  }

  @UseGuards(SessionAuthGuard)
  @Get('subscription')
  getSubscription(@Req() request: AuthenticatedRequest) {
    return this.billingService.getSubscription(request.auth.organization.id);
  }

  @UseGuards(SessionAuthGuard)
  @Post('subscription/checkout')
  checkout(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CheckoutDto,
  ) {
    return this.billingService.checkout(
      request.auth.organization.id,
      request.auth.membership.role,
      {
        email: request.auth.user.email,
        name: request.auth.user.name,
      },
      dto,
    );
  }

  @UseGuards(SessionAuthGuard)
  @Get('subscription/invoices')
  listInvoices(
    @Req() request: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : 20;
    return this.billingService.listInvoices(
      request.auth.organization.id,
      status,
      Number.isFinite(parsedLimit) ? parsedLimit : 20,
    );
  }

  @UseGuards(SessionAuthGuard)
  @Get('subscription/invoices/:invoiceId')
  getInvoiceDetail(
    @Req() request: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.billingService.getInvoiceDetail(
      request.auth.organization.id,
      invoiceId,
    );
  }

  @UseGuards(SessionAuthGuard)
  @Post('subscription/refresh-payment-status')
  refreshPaymentStatus(
    @Req() request: AuthenticatedRequest,
    @Body() dto: RefreshPaymentStatusDto,
  ) {
    return this.billingService.refreshPaymentStatus(
      request.auth.organization.id,
      request.auth.membership.role,
      dto.invoiceId,
    );
  }
}
