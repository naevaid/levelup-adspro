import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateShopDto {
  @IsUUID()
  marketplaceId!: string;

  @IsString()
  @IsNotEmpty()
  externalId!: string;

  @IsString()
  @IsOptional()
  name?: string;
}
