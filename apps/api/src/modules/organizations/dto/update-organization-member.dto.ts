import { MembershipRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateOrganizationMemberDto {
  @IsEnum(MembershipRole)
  role!: MembershipRole;
}
