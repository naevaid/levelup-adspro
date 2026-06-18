import { CategoryFeeStoreType } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateMarketplaceCategoryFeeDto {
  @IsUUID()
  marketplaceId!: string;

  @IsEnum(CategoryFeeStoreType)
  storeType!: CategoryFeeStoreType;

  @IsString()
  @MaxLength(120)
  primaryCategory!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  secondaryCategory?: string;

  @IsString()
  @MaxLength(160)
  categoryName!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  feePercent!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
