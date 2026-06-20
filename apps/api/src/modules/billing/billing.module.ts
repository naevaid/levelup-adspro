import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingCallbackController } from './billing-callback.controller';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaymentClientService } from './payment-client.service';
import { PaymentSignatureService } from './payment-signature.service';

@Module({
  imports: [AuthModule],
  controllers: [BillingController, BillingCallbackController],
  providers: [BillingService, PaymentClientService, PaymentSignatureService],
})
export class BillingModule {}
