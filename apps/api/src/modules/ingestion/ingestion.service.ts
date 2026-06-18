import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CaptureMode, IngestionBatchStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ExtensionAuthenticatedRequest } from '../extension-sessions/extension-authenticated-request';
import { RawDataService } from '../raw-data/raw-data.service';
import { CreateIngestionBatchDto } from './dto/create-ingestion-batch.dto';

type IngestionPreview =
  | {
      type: 'public_search';
      keyword: string | null;
      resultCount: number;
      pageTitle: string | null;
      topResults: Array<{
        position: number | null;
        productTitle: string | null;
        productUrl: string | null;
        imageUrl: string | null;
        shopName: string | null;
        priceMin: number | null;
        priceMax: number | null;
        salesHint: string | null;
      }>;
    }
  | {
      type: 'public_product';
      pageTitle: string | null;
      product: {
        productTitle: string | null;
        productUrl: string | null;
        imageUrl: string | null;
        shopName: string | null;
        priceMin: number | null;
        priceMax: number | null;
        salesHint: string | null;
        ratingHint: string | null;
        reviewCountHint: string | null;
      } | null;
      salesHistory: {
        currentTotalSold: number | null;
        estimatedSold7d: number | null;
        estimatedSold15d: number | null;
        estimatedSold30d: number | null;
      } | null;
      highlights: string[];
    }
  | null;

@Injectable()
export class IngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rawDataService: RawDataService,
  ) {}

  async listLatestForOrganization(organizationId: string) {
    const batches = await this.prisma.ingestionBatch.findMany({
      where: { organizationId },
      include: {
        shop: {
          include: {
            marketplace: true,
          },
        },
        extensionSession: true,
        rawPayloadObjects: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const summarizedBatches = await Promise.all(
      batches.map(async (batch) => {
        const rawPayloadObject = batch.rawPayloadObjects[0] ?? null;
        const preview = rawPayloadObject
          ? await this.extractPreviewFromRawPayload(rawPayloadObject.storageKey)
          : null;

        return {
          id: batch.id,
          status: batch.status,
          captureMode: batch.captureMode.toLowerCase(),
          pageType: batch.pageType,
          marketplace: batch.marketplace,
          payloadSchemaVersion: batch.payloadSchemaVersion,
          capturedAt: batch.capturedAt,
          processedAt: batch.processedAt,
          errorCode: batch.errorCode,
          errorMessage: batch.errorMessage,
          createdAt: batch.createdAt,
          extensionSession: {
            id: batch.extensionSession.id,
            deviceLabel: batch.extensionSession.deviceLabel,
            extensionVersion: batch.extensionSession.extensionVersion,
            status: batch.extensionSession.status,
            expiresAt: batch.extensionSession.expiresAt,
          },
          shop: batch.shop
            ? {
                id: batch.shop.id,
                name: batch.shop.name,
                externalId: batch.shop.externalId,
                status: batch.shop.status,
                marketplace: {
                  id: batch.shop.marketplace.id,
                  code: batch.shop.marketplace.code,
                  name: batch.shop.marketplace.name,
                },
              }
            : null,
          rawPayloadObject: rawPayloadObject
            ? {
                id: rawPayloadObject.id,
                storageKey: rawPayloadObject.storageKey,
                sizeBytes: rawPayloadObject.sizeBytes,
                retentionUntil: rawPayloadObject.retentionUntil,
                status: rawPayloadObject.status,
              }
            : null,
          preview,
        };
      }),
    );

    const salesHistoryByBatchId = await this.buildPublicProductSalesHistory(
      organizationId,
      summarizedBatches,
    );

    return summarizedBatches.map((batch) => {
      if (batch.preview?.type !== 'public_product') {
        return batch;
      }

      return {
        ...batch,
        preview: {
          ...batch.preview,
          salesHistory: salesHistoryByBatchId.get(batch.id) ?? null,
        },
      };
    });
  }

  async createBatch(
    request: ExtensionAuthenticatedRequest,
    dto: CreateIngestionBatchDto,
  ) {
    this.assertSessionMatchesRequest(request, dto);

    if (dto.captureMode === 'owned' && !dto.shopId) {
      throw new BadRequestException(
        'shopId wajib dikirim untuk capture mode owned.',
      );
    }

    if (dto.shopId) {
      const shop = await this.prisma.shop.findFirst({
        where: {
          id: dto.shopId,
          organizationId: request.extensionAuth.organization.id,
        },
      });

      if (!shop) {
        throw new BadRequestException(
          'shopId tidak ditemukan pada organization extension session.',
        );
      }
    }

    const batch = await this.prisma.ingestionBatch.create({
      data: {
        organizationId: request.extensionAuth.organization.id,
        shopId: dto.shopId ?? null,
        extensionSessionId: request.extensionAuth.session.id,
        captureMode:
          dto.captureMode === 'owned' ? CaptureMode.OWNED : CaptureMode.PUBLIC,
        pageType: dto.pageType,
        marketplace: dto.marketplace,
        payloadSchemaVersion: dto.payloadSchemaVersion,
        status: IngestionBatchStatus.ACCEPTED,
        capturedAt: new Date(dto.capturedAt),
      },
    });

    try {
      const retentionDays = await this.resolveRetentionDays(
        request.extensionAuth.organization.id,
      );
      const rawPayloadObject = await this.rawDataService.storeRawPayload({
        ingestionBatchId: batch.id,
        organizationId: request.extensionAuth.organization.id,
        shopId: dto.shopId ?? null,
        retentionDays,
        payload: {
          ...dto,
          shopId: dto.shopId ?? null,
          receivedAt: new Date().toISOString(),
        },
      });

      return {
        id: batch.id,
        status: batch.status,
        capturedAt: batch.capturedAt,
        rawPayloadObject: {
          id: rawPayloadObject.id,
          storageKey: rawPayloadObject.storageKey,
          sizeBytes: rawPayloadObject.sizeBytes,
          retentionUntil: rawPayloadObject.retentionUntil,
          status: rawPayloadObject.status,
        },
      };
    } catch (error) {
      await this.prisma.ingestionBatch.update({
        where: { id: batch.id },
        data: {
          status: IngestionBatchStatus.FAILED,
          errorCode: 'RAW_STORAGE_FAILED',
          errorMessage:
            error instanceof Error
              ? error.message.slice(0, 500)
              : 'Unknown raw storage error',
          processedAt: new Date(),
        },
      });
      throw error;
    }
  }

  async removeForOrganization(organizationId: string, id: string) {
    const existing = await this.prisma.ingestionBatch.findFirst({
      where: { id, organizationId },
      include: {
        rawPayloadObjects: {
          select: {
            id: true,
            storageKey: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Batch market research tidak ditemukan.');
    }

    await Promise.all(
      existing.rawPayloadObjects.map((rawPayloadObject) =>
        this.rawDataService.deleteRawPayload(rawPayloadObject.storageKey),
      ),
    );

    await this.prisma.$transaction(async (transaction) => {
      await transaction.rawPayloadObject.deleteMany({
        where: {
          ingestionBatchId: existing.id,
        },
      });

      await transaction.ingestionBatch.delete({
        where: {
          id: existing.id,
        },
      });
    });

    return { success: true };
  }

  private assertSessionMatchesRequest(
    request: ExtensionAuthenticatedRequest,
    dto: CreateIngestionBatchDto,
  ) {
    if (dto.sessionId !== request.extensionAuth.session.id) {
      throw new ForbiddenException(
        'sessionId payload tidak cocok dengan extension session aktif.',
      );
    }

    if (dto.organizationId !== request.extensionAuth.organization.id) {
      throw new ForbiddenException(
        'organizationId payload tidak cocok dengan extension session aktif.',
      );
    }

    if (
      request.extensionAuth.session.shopId &&
      dto.shopId &&
      dto.shopId !== request.extensionAuth.session.shopId
    ) {
      throw new ForbiddenException(
        'shopId payload tidak cocok dengan extension session aktif.',
      );
    }

    if (
      dto.device.extensionVersion !==
      request.extensionAuth.session.extensionVersion
    ) {
      throw new BadRequestException(
        'device.extensionVersion harus cocok dengan extension session.',
      );
    }
  }

  private async resolveRetentionDays(organizationId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    return subscription?.plan.historyDays ?? 30;
  }

  private normalizeComparableProductUrl(rawUrl?: string | null) {
    if (!rawUrl) {
      return null;
    }

    try {
      const parsed = new URL(rawUrl);
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return rawUrl;
    }
  }

  private parseSalesHintUnits(rawValue?: string | null) {
    if (!rawValue) {
      return null;
    }

    const normalized = rawValue.replace(/\s+/g, ' ').trim().toLowerCase();
    const match = normalized.match(
      /(\d[\d.,]*)(?:\s?(rb|ribu|jt|juta|k|m))?\+?\s*(?:terjual|sold)/i,
    );

    if (!match) {
      return null;
    }

    const numericPart = match[1];
    const suffix = match[2]?.toLowerCase() ?? null;

    if (suffix) {
      const value = Number.parseFloat(
        numericPart.replace(/\./g, '').replace(',', '.'),
      );
      if (!Number.isFinite(value)) {
        return null;
      }

      if (suffix === 'rb' || suffix === 'ribu' || suffix === 'k') {
        return Math.round(value * 1000);
      }

      if (suffix === 'jt' || suffix === 'juta' || suffix === 'm') {
        return Math.round(value * 1000000);
      }
    }

    const digits = numericPart.replace(/[^\d]/g, '');
    if (!digits) {
      return null;
    }

    const parsed = Number.parseInt(digits, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private buildEstimatedSalesDelta(
    points: Array<{ capturedAt: Date; salesCount: number | null }>,
    targetCapturedAt: Date,
    currentSalesCount: number | null,
    windowDays: number,
  ) {
    if (currentSalesCount === null) {
      return null;
    }

    const thresholdTime =
      targetCapturedAt.getTime() - windowDays * 24 * 60 * 60 * 1000;
    const baseline = points.find(
      (point) =>
        point.salesCount !== null &&
        point.capturedAt.getTime() <= thresholdTime,
    );

    if (!baseline || baseline.salesCount === null) {
      return null;
    }

    return Math.max(currentSalesCount - baseline.salesCount, 0);
  }

  private async buildPublicProductSalesHistory(
    organizationId: string,
    summarizedBatches: Array<{
      id: string;
      capturedAt: Date;
      preview:
        | {
            type: 'public_product';
            product: {
              productUrl: string | null;
              salesHint: string | null;
            } | null;
          }
        | {
            type: 'public_search';
          }
        | null;
    }>,
  ) {
    const publicProductTargets = summarizedBatches
      .map((batch) => {
        if (
          batch.preview?.type !== 'public_product' ||
          !batch.preview.product
        ) {
          return null;
        }

        const productKey = this.normalizeComparableProductUrl(
          batch.preview.product.productUrl,
        );
        if (!productKey) {
          return null;
        }

        return {
          batchId: batch.id,
          productKey,
          capturedAt: batch.capturedAt,
          currentSalesCount: this.parseSalesHintUnits(
            batch.preview.product.salesHint,
          ),
        };
      })
      .filter(
        (
          value,
        ): value is {
          batchId: string;
          productKey: string;
          capturedAt: Date;
          currentSalesCount: number | null;
        } => value !== null,
      );

    if (publicProductTargets.length === 0) {
      return new Map<
        string,
        {
          currentTotalSold: number | null;
          estimatedSold7d: number | null;
          estimatedSold15d: number | null;
          estimatedSold30d: number | null;
        }
      >();
    }

    const lookbackStart = new Date(
      Math.min(
        ...publicProductTargets.map((item) => item.capturedAt.getTime()),
      ) -
        32 * 24 * 60 * 60 * 1000,
    );

    const historicalBatches = await this.prisma.ingestionBatch.findMany({
      where: {
        organizationId,
        captureMode: CaptureMode.PUBLIC,
        pageType: 'shopee_public_product',
        capturedAt: {
          gte: lookbackStart,
        },
      },
      include: {
        rawPayloadObjects: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { capturedAt: 'desc' },
      take: 250,
    });

    const pointsByProductKey = new Map<
      string,
      Array<{ capturedAt: Date; salesCount: number | null }>
    >();

    for (const batch of historicalBatches) {
      const rawPayloadObject = batch.rawPayloadObjects[0];
      if (!rawPayloadObject) {
        continue;
      }

      const rawPayload = await this.rawDataService.readRawPayload<{
        content?: {
          product?: {
            productUrl?: string;
            salesHint?: string;
          };
        };
      }>(rawPayloadObject.storageKey);

      const productKey = this.normalizeComparableProductUrl(
        rawPayload?.content?.product?.productUrl,
      );
      if (!productKey) {
        continue;
      }

      const currentPoints = pointsByProductKey.get(productKey) ?? [];
      currentPoints.push({
        capturedAt: batch.capturedAt,
        salesCount: this.parseSalesHintUnits(
          rawPayload?.content?.product?.salesHint,
        ),
      });
      pointsByProductKey.set(productKey, currentPoints);
    }

    for (const [productKey, points] of pointsByProductKey.entries()) {
      points.sort(
        (left, right) => right.capturedAt.getTime() - left.capturedAt.getTime(),
      );
      pointsByProductKey.set(productKey, points);
    }

    return new Map(
      publicProductTargets.map((target) => {
        const points = pointsByProductKey.get(target.productKey) ?? [];

        return [
          target.batchId,
          {
            currentTotalSold: target.currentSalesCount,
            estimatedSold7d: this.buildEstimatedSalesDelta(
              points,
              target.capturedAt,
              target.currentSalesCount,
              7,
            ),
            estimatedSold15d: this.buildEstimatedSalesDelta(
              points,
              target.capturedAt,
              target.currentSalesCount,
              15,
            ),
            estimatedSold30d: this.buildEstimatedSalesDelta(
              points,
              target.capturedAt,
              target.currentSalesCount,
              30,
            ),
          },
        ] as const;
      }),
    );
  }

  private async extractPreviewFromRawPayload(
    storageKey: string,
  ): Promise<IngestionPreview> {
    const rawPayload = await this.rawDataService.readRawPayload<{
      pageType?: string;
      marketplace?: string;
      content?: {
        keyword?: string;
        resultCount?: number;
        pageTitle?: string;
        results?: Array<{
          position?: number;
          productTitle?: string;
          productUrl?: string;
          imageUrl?: string;
          shopName?: string | null;
          priceMin?: number;
          priceMax?: number;
          salesHint?: string;
        }>;
        product?: {
          productTitle?: string;
          productUrl?: string;
          imageUrl?: string;
          shopName?: string | null;
          priceMin?: number;
          priceMax?: number;
          salesHint?: string;
          ratingHint?: string;
          reviewCountHint?: string;
        };
        highlights?: string[];
      };
    }>(storageKey);

    if (!rawPayload?.content) {
      return null;
    }

    if (rawPayload.pageType === 'shopee_public_search') {
      return {
        type: 'public_search',
        keyword: rawPayload.content.keyword ?? null,
        resultCount: rawPayload.content.resultCount ?? 0,
        pageTitle: rawPayload.content.pageTitle ?? null,
        topResults: (rawPayload.content.results ?? [])
          .slice(0, 5)
          .map((item) => ({
            position: item.position ?? null,
            productTitle: item.productTitle ?? null,
            productUrl: item.productUrl ?? null,
            imageUrl: item.imageUrl ?? null,
            shopName: item.shopName ?? null,
            priceMin: item.priceMin ?? null,
            priceMax: item.priceMax ?? null,
            salesHint: item.salesHint ?? null,
          })),
      };
    }

    if (rawPayload.pageType === 'shopee_public_product') {
      return {
        type: 'public_product',
        pageTitle: rawPayload.content.pageTitle ?? null,
        product: rawPayload.content.product
          ? {
              productTitle: rawPayload.content.product.productTitle ?? null,
              productUrl: rawPayload.content.product.productUrl ?? null,
              imageUrl: rawPayload.content.product.imageUrl ?? null,
              shopName: rawPayload.content.product.shopName ?? null,
              priceMin: rawPayload.content.product.priceMin ?? null,
              priceMax: rawPayload.content.product.priceMax ?? null,
              salesHint: rawPayload.content.product.salesHint ?? null,
              ratingHint: rawPayload.content.product.ratingHint ?? null,
              reviewCountHint:
                rawPayload.content.product.reviewCountHint ?? null,
            }
          : null,
        salesHistory: null,
        highlights: (rawPayload.content.highlights ?? []).slice(0, 8),
      };
    }

    return null;
  }
}
