import { MembershipRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateOrganizationMemberDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  email!: string;

  @IsEnum(MembershipRole)
  role!: MembershipRole;

  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;
}
