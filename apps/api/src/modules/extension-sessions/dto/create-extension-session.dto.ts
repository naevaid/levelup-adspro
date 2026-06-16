import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateExtensionSessionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  deviceLabel!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  extensionVersion!: string;

  @IsOptional()
  @IsUUID()
  shopId?: string;
}
