import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdateShopDto {
  @IsOptional()
  @IsIn(['non_star', 'star', 'mall'])
  defaultStoreType?: 'non_star' | 'star' | 'mall';

  @IsOptional()
  @IsBoolean()
  promoXtraEnabled?: boolean;
}

