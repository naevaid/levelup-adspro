import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShopDto } from './dto/create-shop.dto';

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForOrganization(organizationId: string) {
    const shops = await this.prisma.shop.findMany({
      where: { organizationId },
      include: { marketplace: true },
      orderBy: { createdAt: 'asc' },
    });

    return shops.map((shop) => ({
      id: shop.id,
      name: shop.name,
      status: shop.status,
      externalId: shop.externalId,
      createdAt: shop.createdAt,
      marketplace: {
        id: shop.marketplace.id,
        code: shop.marketplace.code,
        name: shop.marketplace.name,
      },
    }));
  }

  async createForOrganization(organizationId: string, dto: CreateShopDto) {
    const marketplace = await this.prisma.marketplace.findUnique({
      where: { id: dto.marketplaceId },
    });

    if (!marketplace) {
      throw new NotFoundException('Marketplace tidak ditemukan.');
    }

    await this.assertWithinShopLimit(organizationId);

    try {
      const shop = await this.prisma.shop.create({
        data: {
          organizationId,
          marketplaceId: marketplace.id,
          externalId: dto.externalId.trim(),
          name: dto.name?.trim() ? dto.name.trim() : null,
          metadataJson: {},
        },
        include: {
          marketplace: true,
        },
      });

      return {
        id: shop.id,
        name: shop.name,
        status: shop.status,
        externalId: shop.externalId,
        createdAt: shop.createdAt,
        marketplace: {
          id: shop.marketplace.id,
          code: shop.marketplace.code,
          name: shop.marketplace.name,
        },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Shop dengan external identifier tersebut sudah terdaftar.',
          );
        }
      }

      throw error;
    }
  }

  private async assertWithinShopLimit(organizationId: string) {
    const subscription = await this.ensureSubscriptionWithPlan(organizationId);
    const shopCount = await this.prisma.shop.count({
      where: { organizationId },
    });
    const limit = subscription.plan.shopLimit;

    if (shopCount >= limit) {
      throw new ForbiddenException(
        `Limit shop untuk plan ${subscription.plan.name} sudah tercapai (${limit}).`,
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
        where: { status: 'ACTIVE' },
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
}
