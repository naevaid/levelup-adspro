import { Transform } from 'class-transformer';
import { CategoryFeeStoreType, MarketplaceCode } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return value;
}

export class ListMarketplaceCategoryFeesDto {
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsUUID()
  marketplaceId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    const normalized = normalizeOptionalString(value);
    return normalized?.toUpperCase();
  })
  @IsEnum(MarketplaceCode)
  marketplaceCode?: MarketplaceCode;

  @IsOptional()
  @Transform(({ value }) => {
    const normalized = normalizeOptionalString(value);
    return normalized?.toUpperCase();
  })
  @IsEnum(CategoryFeeStoreType)
  storeType?: CategoryFeeStoreType;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}
