import {
  BillingInterval,
  PlanStatus,
} from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateInternalPlanDto {
  @IsString()
  @MaxLength(80)
  code!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEnum(BillingInterval)
  billingInterval!: BillingInterval;

  @IsInt()
  @Min(0)
  @Max(1000000000)
  priceAmount!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  shopLimit!: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  memberLimit!: number;

  @IsInt()
  @Min(1)
  @Max(3650)
  historyDays!: number;

  @IsObject()
  features!: Record<string, unknown>;

  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;
}
