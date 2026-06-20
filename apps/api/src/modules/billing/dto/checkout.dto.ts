import { BillingInterval } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CheckoutDto {
  @IsString()
  @IsNotEmpty()
  planCode!: string;

  @IsEnum(BillingInterval)
  billingInterval!: BillingInterval;
}
