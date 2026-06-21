import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  InternalUserRole,
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
  Prisma,
  SubscriptionStatus,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { AuthMailService } from './auth-mail.service';

const INTERNAL_PLAN_CODE = 'internal-unlimited';
const INTERNAL_WORKSPACE_SLUG = 'internal-platform-admin';
const INTERNAL_WORKSPACE_NAME = 'Internal Platform Admin';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly authMailService: AuthMailService,
  ) {}

  async signup(dto: SignupDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email sudah terdaftar.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const organizationSlug = await this.generateUniqueSlug(
      dto.organizationName,
    );
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          name: dto.name.trim(),
          passwordHash,
          status: UserStatus.ACTIVE,
          lastLoginAt: now,
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName.trim(),
          slug: organizationSlug,
          ownerUserId: user.id,
          status: OrganizationStatus.ACTIVE,
        },
      });

      const membership = await tx.membership.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
          joinedAt: now,
        },
      });

      const defaultPlan = await tx.plan.findFirst({
        where: { status: 'ACTIVE', isInternal: false },
        orderBy: { createdAt: 'asc' },
      });

      if (defaultPlan) {
        await tx.subscription.create({
          data: {
            organizationId: organization.id,
            planId: defaultPlan.id,
            status: SubscriptionStatus.TRIALING,
            startsAt: now,
            provider: 'internal-seed',
          },
        });
      }

      const session = await this.createSession(tx, user.id, organization.id);

      return {
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
        user,
        organization,
        membership,
      };
    });

    return this.serializeAuthPayload(result);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Email atau password salah.');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email atau password salah.');
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now },
      });

      if (user.internalRole === InternalUserRole.PLATFORM_ADMIN) {
        await this.ensureInternalWorkspaceAccess(tx, user.id, now);
      }

      const memberships = await tx.membership.findMany({
        where: {
          userId: user.id,
          status: MembershipStatus.ACTIVE,
        },
        include: {
          organization: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
      const membership = this.pickActiveMembership(
        memberships,
        user.internalRole,
      );

      if (!membership) {
        throw new UnauthorizedException(
          'User belum memiliki organization aktif.',
        );
      }

      const session = await this.createSession(
        tx,
        user.id,
        membership.organizationId,
      );

      return {
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
        user: {
          ...user,
          lastLoginAt: now,
        },
        organization: membership.organization,
        membership,
      };
    });

    return this.serializeAuthPayload(result);
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    const successMessage =
      'Jika email terdaftar, kami akan mengirimkan tautan untuk mengatur ulang password.';

    if (!user || user.status !== UserStatus.ACTIVE) {
      return {
        ok: true,
        message: successMessage,
      };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() +
        this.configService.get<number>('PASSWORD_RESET_TTL_MINUTES', 60) *
          60 *
          1000,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });
    });

    const appBaseUrl = this.configService
      .get<string>('APP_BASE_URL', 'http://localhost:3000')
      .replace(/\/+$/, '');
    const resetUrl = `${appBaseUrl}/reset-password?token=${rawToken}`;

    await this.authMailService.sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      resetUrl,
    });

    return {
      ok: true,
      message: successMessage,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token.trim());
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      throw new BadRequestException(
        'Tautan reset password tidak valid atau sudah kedaluwarsa.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const usedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
        },
      });

      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt },
      });

      await tx.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          id: {
            not: resetToken.id,
          },
        },
      });

      await tx.userSession.deleteMany({
        where: { userId: resetToken.userId },
      });

      await tx.extensionSession.deleteMany({
        where: { userId: resetToken.userId },
      });
    });

    return {
      ok: true,
      message: 'Password berhasil diperbarui. Silakan login kembali.',
    };
  }

  async logout(sessionId: string) {
    await this.prisma.userSession.delete({ where: { id: sessionId } });

    return {
      ok: true,
      message: 'Session berhasil diakhiri.',
    };
  }

  async me(userId: string, organizationId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const membership = await this.prisma.membership.findUniqueOrThrow({
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

    return {
      user: {
        id: user.id,
        email: user.email,
        internalRole: user.internalRole,
        name: user.name,
        status: user.status,
      },
      activeOrganization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        isInternal: membership.organization.isInternal,
        status: membership.organization.status,
      },
      membership: {
        id: membership.id,
        role: membership.role,
        status: membership.status,
      },
    };
  }

  private async createSession(
    tx: Prisma.TransactionClient,
    userId: string,
    organizationId: string,
  ) {
    const accessToken = randomBytes(32).toString('hex');
    const sessionTokenHash = createHash('sha256')
      .update(accessToken)
      .digest('hex');
    const ttlHours = this.configService.get<number>('SESSION_TTL_HOURS', 168);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    await tx.userSession.create({
      data: {
        userId,
        activeOrganizationId: organizationId,
        sessionTokenHash,
        expiresAt,
        lastSeenAt: now,
      },
    });

    return {
      accessToken,
      expiresAt,
    };
  }

  private hashToken(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private serializeAuthPayload(input: {
    accessToken: string;
    expiresAt: Date;
    user: {
      id: string;
      email: string;
      internalRole: InternalUserRole | null;
      name: string;
      status: UserStatus;
    };
    organization: {
      id: string;
      name: string;
      slug: string;
      isInternal: boolean;
      status: OrganizationStatus;
    };
    membership: {
      id: string;
      role: MembershipRole;
      status: MembershipStatus;
    };
  }) {
    return {
      accessToken: input.accessToken,
      tokenType: 'Bearer',
      expiresAt: input.expiresAt.toISOString(),
      user: {
        id: input.user.id,
        email: input.user.email,
        internalRole: input.user.internalRole,
        name: input.user.name,
        status: input.user.status,
      },
      activeOrganization: {
        id: input.organization.id,
        name: input.organization.name,
        slug: input.organization.slug,
        isInternal: input.organization.isInternal,
        status: input.organization.status,
      },
      membership: {
        id: input.membership.id,
        role: input.membership.role,
        status: input.membership.status,
      },
    };
  }

  private async generateUniqueSlug(name: string) {
    const normalized = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);

    const baseSlug = normalized || 'organization';
    let candidate = baseSlug;
    let suffix = 2;

    while (
      await this.prisma.organization.findUnique({ where: { slug: candidate } })
    ) {
      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  private pickActiveMembership(
    memberships: Array<
      Prisma.MembershipGetPayload<{
        include: { organization: true };
      }>
    >,
    internalRole: InternalUserRole | null,
  ) {
    if (internalRole === InternalUserRole.PLATFORM_ADMIN) {
      return (
        memberships.find((membership) => membership.organization.isInternal) ??
        memberships[0] ??
        null
      );
    }

    return (
      memberships.find((membership) => !membership.organization.isInternal) ??
      memberships[0] ??
      null
    );
  }

  private async ensureInternalWorkspaceAccess(
    tx: Prisma.TransactionClient,
    userId: string,
    now: Date,
  ) {
    const internalPlan = await tx.plan.findUnique({
      where: { code: INTERNAL_PLAN_CODE },
    });

    if (!internalPlan || !internalPlan.isInternal) {
      throw new UnauthorizedException(
        'Plan internal belum tersedia. Jalankan migration dan seed terlebih dahulu.',
      );
    }

    let organization = await tx.organization.findUnique({
      where: { slug: INTERNAL_WORKSPACE_SLUG },
    });

    if (!organization) {
      organization = await tx.organization.create({
        data: {
          name: INTERNAL_WORKSPACE_NAME,
          slug: INTERNAL_WORKSPACE_SLUG,
          ownerUserId: userId,
          isInternal: true,
          status: OrganizationStatus.ACTIVE,
        },
      });
    }

    const membership = await tx.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId,
        },
      },
    });

    if (!membership) {
      await tx.membership.create({
        data: {
          organizationId: organization.id,
          userId,
          role:
            organization.ownerUserId === userId
              ? MembershipRole.OWNER
              : MembershipRole.AGENCY_ADMIN,
          status: MembershipStatus.ACTIVE,
          joinedAt: now,
        },
      });
    } else if (membership.status !== MembershipStatus.ACTIVE) {
      await tx.membership.update({
        where: { id: membership.id },
        data: {
          status: MembershipStatus.ACTIVE,
          joinedAt: membership.joinedAt ?? now,
        },
      });
    }

    const subscription = await tx.subscription.findUnique({
      where: { organizationId: organization.id },
      include: { plan: true },
    });

    if (!subscription) {
      await tx.subscription.create({
        data: {
          organizationId: organization.id,
          planId: internalPlan.id,
          status: SubscriptionStatus.ACTIVE,
          startsAt: now,
          currentPeriodStart: now,
          provider: 'internal-unlimited',
          autoRenew: false,
          cancelAtPeriodEnd: false,
          activatedAt: now,
        },
      });
      return;
    }

    if (!subscription.plan.isInternal || subscription.plan.code !== INTERNAL_PLAN_CODE) {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: internalPlan.id,
          status: SubscriptionStatus.ACTIVE,
          startsAt: subscription.startsAt ?? now,
          endsAt: null,
          currentPeriodStart: subscription.currentPeriodStart ?? now,
          currentPeriodEnd: null,
          gracePeriodEnd: null,
          cancelAtPeriodEnd: false,
          activatedAt: subscription.activatedAt ?? now,
          canceledAt: null,
          expiredAt: null,
          autoRenew: false,
          provider: 'internal-unlimited',
          providerReference: null,
        },
      });
    }
  }
}
