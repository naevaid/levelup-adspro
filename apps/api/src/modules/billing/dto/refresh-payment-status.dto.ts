import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshPaymentStatusDto {
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;
}
