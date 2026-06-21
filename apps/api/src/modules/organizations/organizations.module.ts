import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsMembersController } from './organizations-members.controller';
import { OrganizationsMembersService } from './organizations-members.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController, OrganizationsMembersController],
  providers: [OrganizationsMembersService, OrganizationsService],
})
export class OrganizationsModule {}
