import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';

type RawBodyRequest = Request & {
  rawBody?: Buffer;
};

@Controller('api/billing/payment')
export class BillingCallbackController {
  constructor(private readonly billingService: BillingService) {}

  @Post('callback')
  callback(
    @Req() request: RawBodyRequest,
    @Headers('x-payment-app-id') appId?: string,
    @Headers('x-payment-event') eventType?: string,
    @Headers('x-payment-attempt') attemptRaw?: string,
    @Headers('x-payment-timestamp') timestamp?: string,
    @Headers('x-payment-delivery-id') deliveryId?: string,
    @Headers('x-payment-signature') signature?: string,
    @Body() payload?: Record<string, unknown>,
  ) {
    const rawBodyPresent = Boolean(request.rawBody);
    const rawPayload =
      request.rawBody?.toString('utf8') ?? JSON.stringify(payload ?? {});
    const parsedAttempt = attemptRaw ? Number.parseInt(attemptRaw, 10) : 1;

    return this.billingService.handlePaymentCallback({
      headers: {
        appId: appId ?? null,
        attempt: Number.isFinite(parsedAttempt) ? parsedAttempt : 1,
        deliveryId: deliveryId ?? null,
        eventType: eventType ?? null,
        requestPath: request.originalUrl ?? request.url ?? null,
        signature: signature ?? null,
        timestamp: timestamp ?? null,
        rawBodyPresent,
      },
      payload: payload ?? {},
      rawPayload,
    });
  }
}
