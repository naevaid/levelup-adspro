import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoryFeeStoreType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMarketplaceCategoryFeeDto } from './dto/create-marketplace-category-fee.dto';
import { UpdateMarketplaceCategoryFeeDto } from './dto/update-marketplace-category-fee.dto';

@Injectable()
export class MarketplaceCategoryFeesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForOrganization(organizationId: string) {
    const fees = await this.prisma.marketplaceCategoryFee.findMany({
      where: { organizationId },
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

  async createForOrganization(
    organizationId: string,
    dto: CreateMarketplaceCategoryFeeDto,
  ) {
    await this.ensureMarketplaceExists(dto.marketplaceId);

    try {
      const created = await this.prisma.marketplaceCategoryFee.create({
        data: {
          organizationId,
          marketplaceId: dto.marketplaceId,
          storeType: dto.storeType,
          primaryCategory: dto.primaryCategory.trim(),
          secondaryCategory: dto.secondaryCategory?.trim() || null,
          categoryName: dto.categoryName.trim(),
          feePercent: dto.feePercent,
          isActive: dto.isActive ?? true,
          notes: dto.notes?.trim() || null,
        },
        include: { marketplace: true },
      });

      return this.toSummary(created);
    } catch (error) {
      this.handleConflict(error);
      throw error;
    }
  }

  async updateForOrganization(
    organizationId: string,
    id: string,
    dto: UpdateMarketplaceCategoryFeeDto,
  ) {
    const existing = await this.prisma.marketplaceCategoryFee.findFirst({
      where: { id, organizationId },
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
          marketplaceId: dto.marketplaceId,
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
          isActive: dto.isActive,
          notes:
            typeof dto.notes === 'string'
              ? dto.notes.trim() || null
              : dto.notes === null
                ? null
                : undefined,
        },
        include: { marketplace: true },
      });

      return this.toSummary(updated);
    } catch (error) {
      this.handleConflict(error);
      throw error;
    }
  }

  async removeForOrganization(organizationId: string, id: string) {
    const existing = await this.prisma.marketplaceCategoryFee.findFirst({
      where: { id, organizationId },
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
