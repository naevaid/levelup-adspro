import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
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
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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
        where: { status: 'ACTIVE' },
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

    const membership = await this.prisma.membership.findFirst({
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

    if (!membership) {
      throw new UnauthorizedException(
        'User belum memiliki organization aktif.',
      );
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now },
      });

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
        name: user.name,
        status: user.status,
      },
      activeOrganization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
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

  private serializeAuthPayload(input: {
    accessToken: string;
    expiresAt: Date;
    user: {
      id: string;
      email: string;
      name: string;
      status: UserStatus;
    };
    organization: {
      id: string;
      name: string;
      slug: string;
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
        name: input.user.name,
        status: input.user.status,
      },
      activeOrganization: {
        id: input.organization.id,
        name: input.organization.name,
        slug: input.organization.slug,
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
}
