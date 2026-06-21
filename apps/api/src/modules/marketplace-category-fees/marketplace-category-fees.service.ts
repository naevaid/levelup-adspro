import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CategoryFeeStoreType,
  InternalUserRole,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMarketplaceCategoryFeeDto } from './dto/create-marketplace-category-fee.dto';
import { ListMarketplaceCategoryFeesDto } from './dto/list-marketplace-category-fees.dto';
import { UpdateMarketplaceCategoryFeeDto } from './dto/update-marketplace-category-fee.dto';

@Injectable()
export class MarketplaceCategoryFeesService {
  constructor(private readonly prisma: PrismaService) {}

  assertAccess(internalRole: InternalUserRole | null) {
    if (internalRole !== InternalUserRole.PLATFORM_ADMIN) {
      throw new ForbiddenException(
        'Master fee kategori marketplace hanya bisa diakses internal platform admin.',
      );
    }
  }

  async listGlobal(filters: ListMarketplaceCategoryFeesDto = {}) {
    const where: Prisma.MarketplaceCategoryFeeWhereInput = {
      marketplaceId: filters.marketplaceId,
      storeType: filters.storeType,
      isActive: filters.isActive,
      marketplace: filters.marketplaceCode
        ? {
            code: filters.marketplaceCode,
          }
        : undefined,
    };

    const fees = await this.prisma.marketplaceCategoryFee.findMany({
      where,
      include: { marketplace: true },
      orderBy: [
        { marketplace: { createdAt: 'asc' } },
        { storeType: 'asc' },
        { primaryCategory: 'asc' },
        { secondaryCategory: 'asc' },
        { categoryName: 'asc' },
      ],
    });

    return fees.map((fee) => this.toSummary(fee));
  }

  async createGlobal(dto: CreateMarketplaceCategoryFeeDto) {
    await this.ensureMarketplaceExists(dto.marketplaceId);

    try {
      const created = await this.prisma.marketplaceCategoryFee.create({
        data: {
          marketplace: {
            connect: { id: dto.marketplaceId },
          },
          storeType: dto.storeType,
          primaryCategory: dto.primaryCategory.trim(),
          secondaryCategory: dto.secondaryCategory?.trim() || null,
          categoryName: dto.categoryName.trim(),
          feePercent: dto.feePercent,
          gratisOngkirPctRegular: dto.gratisOngkirPctRegular ?? 0,
          gratisOngkirCapRegular: dto.gratisOngkirCapRegular ?? 0,
          gratisOngkirPctSpecial: dto.gratisOngkirPctSpecial ?? 0,
          gratisOngkirCapSpecial: dto.gratisOngkirCapSpecial ?? 0,
          isActive: dto.isActive ?? true,
          notes: dto.notes?.trim() || null,
        },
      });

      return this.getSummaryById(created.id);
    } catch (error) {
      this.handleConflict(error);
      throw error;
    }
  }

  async updateGlobal(id: string, dto: UpdateMarketplaceCategoryFeeDto) {
    const existing = await this.prisma.marketplaceCategoryFee.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Fee kategori marketplace tidak ditemukan.');
    }

    if (dto.marketplaceId) {
      await this.ensureMarketplaceExists(dto.marketplaceId);
    }

    try {
      const updated = await this.prisma.marketplaceCategoryFee.update({
        where: { id: existing.id },
        data: {
          marketplace: dto.marketplaceId
            ? {
                connect: { id: dto.marketplaceId },
              }
            : undefined,
          storeType: dto.storeType,
          primaryCategory:
            typeof dto.primaryCategory === 'string' ? dto.primaryCategory.trim() : undefined,
          secondaryCategory:
            typeof dto.secondaryCategory === 'string'
              ? dto.secondaryCategory.trim() || null
              : undefined,
          categoryName:
            typeof dto.categoryName === 'string' ? dto.categoryName.trim() : undefined,
          feePercent: dto.feePercent,
          gratisOngkirPctRegular: dto.gratisOngkirPctRegular,
          gratisOngkirCapRegular: dto.gratisOngkirCapRegular,
          gratisOngkirPctSpecial: dto.gratisOngkirPctSpecial,
          gratisOngkirCapSpecial: dto.gratisOngkirCapSpecial,
          isActive: dto.isActive,
          notes:
            typeof dto.notes === 'string'
              ? dto.notes.trim() || null
              : dto.notes === null
                ? null
                : undefined,
        },
      });

      return this.getSummaryById(updated.id);
    } catch (error) {
      this.handleConflict(error);
      throw error;
    }
  }

  async removeGlobal(id: string) {
    const existing = await this.prisma.marketplaceCategoryFee.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Fee kategori marketplace tidak ditemukan.');
    }

    await this.prisma.marketplaceCategoryFee.delete({
      where: { id: existing.id },
    });

    return { success: true };
  }

  private async ensureMarketplaceExists(marketplaceId: string) {
    const marketplace = await this.prisma.marketplace.findUnique({
      where: { id: marketplaceId },
    });

    if (!marketplace) {
      throw new NotFoundException('Marketplace tidak ditemukan.');
    }
  }

  private async getSummaryById(id: string) {
    const fee = await this.prisma.marketplaceCategoryFee.findUnique({
      where: { id },
      include: { marketplace: true },
    });

    if (!fee) {
      throw new NotFoundException('Fee kategori marketplace tidak ditemukan.');
    }

    return this.toSummary(fee);
  }

  private handleConflict(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Fee kategori dengan kombinasi marketplace, jenis toko, dan kategori tersebut sudah ada.',
      );
    }
  }

  private toSummary(fee: {
    id: string;
    storeType: CategoryFeeStoreType;
    primaryCategory: string;
    secondaryCategory: string | null;
    categoryName: string;
    feePercent: number;
    gratisOngkirPctRegular: number;
    gratisOngkirCapRegular: number;
    gratisOngkirPctSpecial: number;
    gratisOngkirCapSpecial: number;
    isActive: boolean;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    marketplace: {
      id: string;
      code: string;
      name: string;
    };
  }) {
    return {
      id: fee.id,
      storeType: fee.storeType,
      primaryCategory: fee.primaryCategory,
      secondaryCategory: fee.secondaryCategory,
      categoryName: fee.categoryName,
      feePercent: fee.feePercent,
      gratisOngkirPctRegular: fee.gratisOngkirPctRegular,
      gratisOngkirCapRegular: fee.gratisOngkirCapRegular,
      gratisOngkirPctSpecial: fee.gratisOngkirPctSpecial,
      gratisOngkirCapSpecial: fee.gratisOngkirCapSpecial,
      isActive: fee.isActive,
      notes: fee.notes,
      createdAt: fee.createdAt,
      updatedAt: fee.updatedAt,
      marketplace: {
        id: fee.marketplace.id,
        code: fee.marketplace.code,
        name: fee.marketplace.name,
      },
    };
  }
}
