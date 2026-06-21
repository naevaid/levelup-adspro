import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ExtensionSessionStatus } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExtensionSessionDto } from './dto/create-extension-session.dto';

@Injectable()
export class ExtensionSessionsService {
  private static readonly SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

  constructor(private readonly prisma: PrismaService) {}

  async createForUserSession(
    userId: string,
    organizationId: string,
    dto: CreateExtensionSessionDto,
  ) {
    const shop = dto.shopId
      ? await this.prisma.shop.findFirst({
          where: {
            id: dto.shopId,
            organizationId,
          },
        })
      : null;

    if (dto.shopId && !shop) {
      throw new NotFoundException(
        'Shop tidak ditemukan pada organization aktif.',
      );
    }

    const rawToken = randomBytes(32).toString('hex');
    const sessionTokenHash = this.hashToken(rawToken);
    const now = new Date();
    const expiresAt = this.createExpiryDate(now);

    const session = await this.prisma.extensionSession.create({
      data: {
        organizationId,
        userId,
        shopId: shop?.id ?? null,
        deviceLabel: dto.deviceLabel.trim(),
        extensionVersion: dto.extensionVersion.trim(),
        sessionTokenHash,
        status: ExtensionSessionStatus.ACTIVE,
        lastHeartbeatAt: now,
        expiresAt,
      },
      include: {
        shop: true,
      },
    });

    return {
      id: session.id,
      accessToken: rawToken,
      tokenType: 'Bearer',
      expiresAt: session.expiresAt,
      deviceLabel: session.deviceLabel,
      extensionVersion: session.extensionVersion,
      shop: session.shop
        ? {
            id: session.shop.id,
            name: session.shop.name,
            status: session.shop.status,
            externalId: session.shop.externalId,
          }
        : null,
    };
  }

  async validateAccessToken(rawToken: string) {
    const sessionTokenHash = this.hashToken(rawToken);
    const session = await this.prisma.extensionSession.findUnique({
      where: { sessionTokenHash },
      include: {
        user: true,
        organization: true,
        shop: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Extension session tidak ditemukan.');
    }

    if (session.status !== ExtensionSessionStatus.ACTIVE) {
      throw new UnauthorizedException('Extension session tidak aktif.');
    }

    if (session.expiresAt <= new Date()) {
      await this.prisma.extensionSession.update({
        where: { id: session.id },
        data: { status: ExtensionSessionStatus.EXPIRED },
      });
      throw new UnauthorizedException('Extension session sudah kedaluwarsa.');
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: session.organizationId,
          userId: session.userId,
        },
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('Membership tenant tidak aktif.');
    }

    return session;
  }

  async refreshHeartbeat(sessionId: string) {
    const now = new Date();
    const expiresAt = this.createExpiryDate(now);

    const session = await this.prisma.extensionSession.update({
      where: { id: sessionId },
      data: {
        lastHeartbeatAt: now,
        expiresAt,
      },
      include: {
        shop: true,
      },
    });

    return {
      id: session.id,
      status: session.status,
      lastHeartbeatAt: session.lastHeartbeatAt,
      expiresAt: session.expiresAt,
      shop: session.shop
        ? {
            id: session.shop.id,
            name: session.shop.name,
            status: session.shop.status,
            externalId: session.shop.externalId,
          }
        : null,
    };
  }

  private hashToken(rawToken: string) {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private createExpiryDate(now: Date) {
    return new Date(now.getTime() + ExtensionSessionsService.SESSION_TTL_MS);
  }
}
