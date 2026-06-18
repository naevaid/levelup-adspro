import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';

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
      roasDefaults:
        shop.metadataJson &&
        typeof shop.metadataJson === 'object' &&
        'roasDefaults' in shop.metadataJson &&
        shop.metadataJson.roasDefaults &&
        typeof shop.metadataJson.roasDefaults === 'object' &&
        'storeType' in shop.metadataJson.roasDefaults
          ? {
              storeType:
                typeof shop.metadataJson.roasDefaults.storeType === 'string'
                  ? shop.metadataJson.roasDefaults.storeType
                  : null,
              promoXtraEnabled:
                typeof shop.metadataJson.roasDefaults.promoXtraEnabled === 'boolean'
                  ? shop.metadataJson.roasDefaults.promoXtraEnabled
                  : false,
            }
          : null,
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
          metadataJson: {
            roasDefaults: {
              storeType: 'non_star',
              promoXtraEnabled: false,
            },
          },
        },
        include: {
          marketplace: true,
        },
      });

      return {
        roasDefaults: {
          storeType: 'non_star',
          promoXtraEnabled: false,
        },
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

  async updateForOrganization(
    organizationId: string,
    shopId: string,
    dto: UpdateShopDto,
  ) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      throw new NotFoundException('Shop tidak ditemukan.');
    }

    if (shop.organizationId !== organizationId) {
      throw new ForbiddenException('Tidak memiliki akses untuk mengubah shop ini.');
    }

    const existingMetadata =
      shop.metadataJson && typeof shop.metadataJson === 'object'
        ? (shop.metadataJson as Record<string, unknown>)
        : {};
    const existingRoasDefaultsRaw = existingMetadata['roasDefaults'];
    const existingRoasDefaults =
      existingRoasDefaultsRaw && typeof existingRoasDefaultsRaw === 'object'
        ? (existingRoasDefaultsRaw as Record<string, unknown>)
        : {};

    const nextStoreType =
      typeof dto.defaultStoreType === 'string'
        ? dto.defaultStoreType
        : typeof existingRoasDefaults['storeType'] === 'string'
        ? (existingRoasDefaults['storeType'] as string)
        : 'non_star';

    const nextPromoXtraEnabled =
      typeof dto.promoXtraEnabled === 'boolean'
        ? dto.promoXtraEnabled
        : typeof existingRoasDefaults['promoXtraEnabled'] === 'boolean'
        ? (existingRoasDefaults['promoXtraEnabled'] as boolean)
        : false;

    const updated = await this.prisma.shop.update({
      where: { id: shopId },
      data: {
        metadataJson: {
          ...existingMetadata,
          roasDefaults: {
            ...existingRoasDefaults,
            storeType: nextStoreType,
            promoXtraEnabled: nextPromoXtraEnabled,
          },
        },
      },
      include: {
        marketplace: true,
      },
    });

    return {
      roasDefaults: {
        storeType: nextStoreType,
        promoXtraEnabled: nextPromoXtraEnabled,
      },
      id: updated.id,
      name: updated.name,
      status: updated.status,
      externalId: updated.externalId,
      createdAt: updated.createdAt,
      marketplace: {
        id: updated.marketplace.id,
        code: updated.marketplace.code,
        name: updated.marketplace.name,
      },
    };
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
