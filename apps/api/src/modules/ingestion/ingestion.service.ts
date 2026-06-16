import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CaptureMode, IngestionBatchStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ExtensionAuthenticatedRequest } from '../extension-sessions/extension-authenticated-request';
import { RawDataService } from '../raw-data/raw-data.service';
import { CreateIngestionBatchDto } from './dto/create-ingestion-batch.dto';

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

    return batches.map((batch) => {
      const rawPayloadObject = batch.rawPayloadObjects[0] ?? null;

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
}
