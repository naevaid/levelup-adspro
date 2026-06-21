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

export class UpdateInternalPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000000)
  priceAmount?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  shopLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  memberLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  historyDays?: number;

  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;
}
