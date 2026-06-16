import {
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ALLOWED_CAPTURE_MODES,
  ALLOWED_CAPTURE_REASONS,
  ALLOWED_MARKETPLACES,
  ALLOWED_PAGE_TYPES,
} from '../ingestion.constants';

class DeviceMetadataDto {
  @IsString()
  @MaxLength(32)
  extensionVersion!: string;

  @IsString()
  @MaxLength(32)
  browserName!: string;
}

export class CreateIngestionBatchDto {
  @IsString()
  @IsIn(ALLOWED_CAPTURE_MODES)
  captureMode!: (typeof ALLOWED_CAPTURE_MODES)[number];

  @IsString()
  @IsIn(ALLOWED_PAGE_TYPES)
  pageType!: (typeof ALLOWED_PAGE_TYPES)[number];

  @IsString()
  @IsIn(ALLOWED_MARKETPLACES)
  marketplace!: (typeof ALLOWED_MARKETPLACES)[number];

  @IsString()
  @MaxLength(16)
  payloadSchemaVersion!: string;

  @IsISO8601()
  capturedAt!: string;

  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  sourceUrl!: string;

  @IsUUID()
  sessionId!: string;

  @IsUUID()
  organizationId!: string;

  @IsOptional()
  @IsUUID()
  shopId?: string;

  @ValidateNested()
  @Type(() => DeviceMetadataDto)
  device!: DeviceMetadataDto;

  @IsObject()
  content!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  traceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  requestId?: string;

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_CAPTURE_REASONS)
  captureReason?: (typeof ALLOWED_CAPTURE_REASONS)[number];
}
