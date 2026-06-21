import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipRole,
  MembershipStatus,
  Prisma,
  SubscriptionStatus,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizationMemberDto } from './dto/create-organization-member.dto';
import { UpdateOrganizationMemberDto } from './dto/update-organization-member.dto';

@Injectable()
export class OrganizationsMembersService {
  constructor(private readonly prisma: PrismaService) {}

  assertManagementAccess(role: MembershipRole) {
    if (
      role !== MembershipRole.OWNER &&
      role !== MembershipRole.MANAGER &&
      role !== MembershipRole.AGENCY_ADMIN
    ) {
      throw new ForbiddenException(
        'Hanya owner, manager, atau agency admin yang bisa mengelola anggota.',
      );
    }
  }

  async listMembers(organizationId: string, actorRole: MembershipRole) {
    this.assertManagementAccess(actorRole);

    const memberships = await this.prisma.membership.findMany({
      where: {
        organizationId,
        status: {
          not: MembershipStatus.REMOVED,
        },
      },
      include: {
        user: true,
        invitedByUser: true,
      },
      orderBy: [{ createdAt: 'asc' }, { joinedAt: 'asc' }],
    });

    return memberships.map((membership) => this.toSummary(membership));
  }

  async createMember(
    organizationId: string,
    actorUserId: string,
    actorRole: MembershipRole,
    dto: CreateOrganizationMemberDto,
  ) {
    this.assertManagementAccess(actorRole);
    this.assertManageableRole(dto.role);
    await this.assertWithinMemberLimit(organizationId);

    const email = dto.email.trim().toLowerCase();
    const name = dto.name?.trim() ?? '';
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: { email },
      });

      if (!user) {
        if (!dto.password?.trim()) {
          throw new BadRequestException(
            'Password wajib diisi jika email belum pernah terdaftar.',
          );
        }

        if (!name) {
          throw new BadRequestException(
            'Nama wajib diisi jika email belum pernah terdaftar.',
          );
        }

        const passwordHash = await bcrypt.hash(dto.password, 10);
        user = await tx.user.create({
          data: {
            email,
            name,
            passwordHash,
            status: UserStatus.ACTIVE,
          },
        });
      } else if (user.status !== UserStatus.ACTIVE) {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            status: UserStatus.ACTIVE,
          },
        });
      }

      const existingMembership = await tx.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: user.id,
          },
        },
        include: {
          user: true,
          invitedByUser: true,
        },
      });

      if (existingMembership) {
        if (existingMembership.status !== MembershipStatus.REMOVED) {
          throw new ConflictException(
            'User tersebut sudah menjadi anggota organization ini.',
          );
        }

        const restored = await tx.membership.update({
          where: { id: existingMembership.id },
          data: {
            role: dto.role,
            status: MembershipStatus.ACTIVE,
            joinedAt: now,
            invitedByUserId: actorUserId,
          },
          include: {
            user: true,
            invitedByUser: true,
          },
        });

        return this.toSummary(restored);
      }

      try {
        const created = await tx.membership.create({
          data: {
            organizationId,
            userId: user.id,
            role: dto.role,
            status: MembershipStatus.ACTIVE,
            invitedByUserId: actorUserId,
            joinedAt: now,
          },
          include: {
            user: true,
            invitedByUser: true,
          },
        });

        return this.toSummary(created);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'User tersebut sudah menjadi anggota organization ini.',
          );
        }

        throw error;
      }
    });
  }

  async updateMember(
    organizationId: string,
    memberId: string,
    actorUserId: string,
    actorRole: MembershipRole,
    dto: UpdateOrganizationMemberDto,
  ) {
    this.assertManagementAccess(actorRole);
    this.assertManageableRole(dto.role);

    const membership = await this.prisma.membership.findUnique({
      where: { id: memberId },
      include: {
        user: true,
        invitedByUser: true,
      },
    });

    if (!membership || membership.organizationId !== organizationId) {
      throw new NotFoundException('Anggota tidak ditemukan.');
    }

    if (membership.role === MembershipRole.OWNER) {
      throw new ForbiddenException('Role owner tidak bisa diubah dari halaman ini.');
    }

    if (membership.userId === actorUserId) {
      throw new ForbiddenException('Role akun Anda sendiri tidak bisa diubah di sini.');
    }

    const updated = await this.prisma.membership.update({
      where: { id: membership.id },
      data: { role: dto.role },
      include: {
        user: true,
        invitedByUser: true,
      },
    });

    return this.toSummary(updated);
  }

  async removeMember(
    organizationId: string,
    memberId: string,
    actorUserId: string,
    actorRole: MembershipRole,
  ) {
    this.assertManagementAccess(actorRole);

    const membership = await this.prisma.membership.findUnique({
      where: { id: memberId },
    });

    if (!membership || membership.organizationId !== organizationId) {
      throw new NotFoundException('Anggota tidak ditemukan.');
    }

    if (membership.role === MembershipRole.OWNER) {
      throw new ForbiddenException('Owner organization tidak bisa dihapus.');
    }

    if (membership.userId === actorUserId) {
      throw new ForbiddenException(
        'Akun Anda sendiri tidak bisa dihapus dari organization ini.',
      );
    }

    await this.prisma.membership.update({
      where: { id: membership.id },
      data: {
        status: MembershipStatus.REMOVED,
      },
    });

    return {
      ok: true,
      message: 'Anggota berhasil dihapus dari organization.',
    };
  }

  private assertManageableRole(role: MembershipRole) {
    if (role === MembershipRole.OWNER) {
      throw new BadRequestException(
        'Role owner tidak bisa ditambahkan atau diubah dari halaman Team.',
      );
    }
  }

  private async assertWithinMemberLimit(organizationId: string) {
    const subscription = await this.ensureSubscriptionWithPlan(organizationId);
    const activeMemberCount = await this.prisma.membership.count({
      where: {
        organizationId,
        status: MembershipStatus.ACTIVE,
      },
    });
    const limit = subscription.plan.memberLimit;

    if (activeMemberCount >= limit) {
      throw new ForbiddenException(
        `Limit anggota untuk plan ${subscription.plan.name} sudah tercapai (${limit}).`,
      );
    }
  }

  private async ensureSubscriptionWithPlan(organizationId: string) {
    const existing = await this.prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    if (existing) {
      return existing;
    }

    const defaultPlan =
      (await this.prisma.plan.findUnique({
        where: { code: 'free-monthly' },
      })) ??
      (await this.prisma.plan.findFirst({
        where: { status: 'ACTIVE', isInternal: false },
        orderBy: { createdAt: 'asc' },
      }));

    if (!defaultPlan) {
      throw new ForbiddenException('Plan default belum tersedia.');
    }

    return this.prisma.subscription.create({
      data: {
        organizationId,
        planId: defaultPlan.id,
        status: SubscriptionStatus.TRIALING,
        startsAt: new Date(),
        provider: 'internal-default',
      },
      include: { plan: true },
    });
  }

  private toSummary(
    membership: Prisma.MembershipGetPayload<{
      include: { user: true; invitedByUser: true };
    }>,
  ) {
    return {
      id: membership.id,
      role: membership.role,
      status: membership.status,
      joinedAt: membership.joinedAt,
      createdAt: membership.createdAt,
      user: {
        id: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        status: membership.user.status,
      },
      invitedBy: membership.invitedByUser
        ? {
            id: membership.invitedByUser.id,
            name: membership.invitedByUser.name,
            email: membership.invitedByUser.email,
          }
        : null,
    };
  }
}
