import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type MembershipWithOrganization = Prisma.MembershipGetPayload<{
  include: { organization: true };
}>;

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrganizations(userId: string, activeOrganizationId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
      },
      include: {
        organization: true,
      },
      orderBy: [{ createdAt: 'asc' }, { joinedAt: 'asc' }],
    });

    return {
      data: memberships.map((membership) =>
        this.toSummary(membership, membership.organizationId === activeOrganizationId),
      ),
    };
  }

  async getCurrentOrganization(userId: string, organizationId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new NotFoundException('Organization aktif tidak ditemukan.');
    }

    return this.toSummary(membership, true);
  }

  async switchOrganization(
    sessionId: string,
    userId: string,
    organizationId: string,
  ) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Workspace tidak ditemukan.');
    }

    if (membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('Membership workspace tersebut tidak aktif.');
    }

    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: {
        activeOrganizationId: organizationId,
      },
    });

    return {
      data: this.toSummary(membership, true),
    };
  }

  private toSummary(membership: MembershipWithOrganization, isActive: boolean) {
    return {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      isInternal: membership.organization.isInternal,
      status: membership.organization.status,
      isActive,
      currentMembership: {
        id: membership.id,
        role: membership.role,
        status: membership.status,
      },
    };
  }
}
