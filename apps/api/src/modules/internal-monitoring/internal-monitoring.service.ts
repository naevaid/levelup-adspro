import { ForbiddenException, Injectable } from '@nestjs/common';
import { IngestionBatchStatus, MembershipRole } from '@prisma/client';
import { AppService } from '../../app.service';
import { PrismaService } from '../../prisma/prisma.service';

const STALE_INGESTION_THRESHOLD_MINUTES = 15;
const RECENT_WINDOW_HOURS = 24;
const INGESTION_FAILURE_SPIKE_COUNT_THRESHOLD = 5;
const INGESTION_FAILURE_SPIKE_RATIO_THRESHOLD = 0.2;
const WORKER_STOPPED_RISK_MINUTES = 20;
const MONITORING_ALLOWED_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.MANAGER,
  MembershipRole.AGENCY_ADMIN,
]);

type MonitoringAlert = {
  code: 'api_failure' | 'ingestion_failure_spike' | 'worker_stopped_risk';
  severity: 'critical' | 'warning';
  title: string;
  message: string;
  metric: {
    value: number | string;
    unit: 'count' | 'ratio' | 'status' | 'minutes';
  };
};

@Injectable()
export class InternalMonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appService: AppService,
  ) {}

  assertAccess(role: MembershipRole) {
    if (!MONITORING_ALLOWED_ROLES.has(role)) {
      throw new ForbiddenException(
        'Akses monitoring internal hanya untuk owner atau manager organization.',
      );
    }
  }

  async getOrganizationMonitoringSummary(organizationId: string) {
    const readiness = await this.appService.getReadiness();
    const recentSince = new Date(
      Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const staleBefore = new Date(
      Date.now() - STALE_INGESTION_THRESHOLD_MINUTES * 60 * 1000,
    );

    const [
      recentStatusCounts,
      backlogAcceptedCount,
      backlogProcessingCount,
      staleAcceptedCount,
      staleProcessingCount,
      recentFailureErrorCodes,
      latestBatch,
      latestProcessedBatch,
      activeExtensionSessions,
    ] = await Promise.all([
      this.prisma.ingestionBatch.groupBy({
        by: ['status'],
        where: {
          organizationId,
          createdAt: { gte: recentSince },
        },
        _count: { _all: true },
      }),
      this.prisma.ingestionBatch.count({
        where: {
          organizationId,
          status: IngestionBatchStatus.ACCEPTED,
        },
      }),
      this.prisma.ingestionBatch.count({
        where: {
          organizationId,
          status: IngestionBatchStatus.PROCESSING,
        },
      }),
      this.prisma.ingestionBatch.count({
        where: {
          organizationId,
          status: IngestionBatchStatus.ACCEPTED,
          createdAt: { lt: staleBefore },
        },
      }),
      this.prisma.ingestionBatch.count({
        where: {
          organizationId,
          status: IngestionBatchStatus.PROCESSING,
          createdAt: { lt: staleBefore },
        },
      }),
      this.prisma.ingestionBatch.groupBy({
        by: ['errorCode'],
        where: {
          organizationId,
          status: IngestionBatchStatus.FAILED,
          createdAt: { gte: recentSince },
        },
        _count: { _all: true },
        orderBy: {
          _count: {
            errorCode: 'desc',
          },
        },
        take: 5,
      }),
      this.prisma.ingestionBatch.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          pageType: true,
          captureMode: true,
          createdAt: true,
          capturedAt: true,
          processedAt: true,
          errorCode: true,
        },
      }),
      this.prisma.ingestionBatch.findFirst({
        where: {
          organizationId,
          processedAt: { not: null },
        },
        orderBy: { processedAt: 'desc' },
        select: {
          id: true,
          status: true,
          processedAt: true,
          errorCode: true,
        },
      }),
      this.prisma.extensionSession.count({
        where: {
          organizationId,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    const recentCounts = {
      accepted: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const item of recentStatusCounts) {
      if (item.status === IngestionBatchStatus.ACCEPTED) {
        recentCounts.accepted = item._count._all;
      }
      if (item.status === IngestionBatchStatus.PROCESSING) {
        recentCounts.processing = item._count._all;
      }
      if (item.status === IngestionBatchStatus.COMPLETED) {
        recentCounts.completed = item._count._all;
      }
      if (item.status === IngestionBatchStatus.FAILED) {
        recentCounts.failed = item._count._all;
      }
    }

    const backlogTotal = backlogAcceptedCount + backlogProcessingCount;
    const staleIndicatorCount = staleAcceptedCount + staleProcessingCount;
    const totalRecentIngestionCount =
      recentCounts.accepted +
      recentCounts.processing +
      recentCounts.completed +
      recentCounts.failed;
    const failureRate =
      recentCounts.failed > 0
        ? recentCounts.failed / Math.max(1, totalRecentIngestionCount)
        : 0;
    const latestProcessedAgeMinutes = latestProcessedBatch?.processedAt
      ? this.diffMinutes(latestProcessedBatch.processedAt)
      : null;
    const alerts = this.buildAlerts({
      readinessStatus: readiness.status,
      queueStatus: readiness.queue.status,
      backlogTotal,
      staleIndicatorCount,
      recentFailedCount: recentCounts.failed,
      failureRate,
      latestProcessedAgeMinutes,
    });
    const status =
      alerts.some((alert) => alert.severity === 'critical') ||
      readiness.status !== 'ok' ||
      staleIndicatorCount > 0
        ? 'degraded'
        : 'ok';

    return {
      status,
      generatedAt: new Date().toISOString(),
      readiness,
      alerts,
      queue: {
        backlog: {
          accepted: backlogAcceptedCount,
          processing: backlogProcessingCount,
          total: backlogTotal,
        },
        transport: readiness.queue.transport,
        status:
          readiness.queue.status === 'ready' && backlogTotal === 0
            ? 'idle'
            : readiness.queue.status,
      },
      ingestion: {
        recentWindowHours: RECENT_WINDOW_HOURS,
        recentCounts,
        staleIndicators: {
          thresholdMinutes: STALE_INGESTION_THRESHOLD_MINUTES,
          acceptedOlderThanThreshold: staleAcceptedCount,
          processingOlderThanThreshold: staleProcessingCount,
          total: staleIndicatorCount,
        },
        latestBatch: latestBatch
          ? {
              ...latestBatch,
              ageMinutes: this.diffMinutes(latestBatch.createdAt),
            }
          : null,
        latestProcessedBatch: latestProcessedBatch
          ? {
              ...latestProcessedBatch,
              ageMinutes: latestProcessedBatch.processedAt
                ? this.diffMinutes(latestProcessedBatch.processedAt)
                : null,
            }
          : null,
        errorSummary: {
          failedLast24h: recentCounts.failed,
          failureRateLast24h: Number(failureRate.toFixed(4)),
          topErrorCodes: recentFailureErrorCodes.map((item) => ({
            errorCode: item.errorCode ?? 'UNKNOWN',
            count: item._count._all,
          })),
        },
      },
      activity: {
        activeExtensionSessions,
      },
    } as const;
  }

  private diffMinutes(value: Date) {
    return Math.max(0, Math.round((Date.now() - value.getTime()) / 60000));
  }

  private buildAlerts(input: {
    readinessStatus: 'ok' | 'degraded';
    queueStatus: 'ready' | 'degraded';
    backlogTotal: number;
    staleIndicatorCount: number;
    recentFailedCount: number;
    failureRate: number;
    latestProcessedAgeMinutes: number | null;
  }): MonitoringAlert[] {
    const alerts: MonitoringAlert[] = [];

    if (input.readinessStatus !== 'ok') {
      alerts.push({
        code: 'api_failure',
        severity: 'critical',
        title: 'API readiness degraded',
        message:
          'Satu atau lebih dependency inti API tidak ready. Periksa koneksi database dan Redis.',
        metric: {
          value: input.readinessStatus,
          unit: 'status',
        },
      });
    }

    if (
      input.recentFailedCount >= INGESTION_FAILURE_SPIKE_COUNT_THRESHOLD &&
      input.failureRate >= INGESTION_FAILURE_SPIKE_RATIO_THRESHOLD
    ) {
      alerts.push({
        code: 'ingestion_failure_spike',
        severity: 'warning',
        title: 'Lonjakan ingestion gagal',
        message:
          'Jumlah ingestion gagal dalam 24 jam terakhir melewati threshold. Periksa error code dominan dan payload yang masuk.',
        metric: {
          value: Number(input.failureRate.toFixed(4)),
          unit: 'ratio',
        },
      });
    }

    const hasWorkerStoppedRisk =
      input.queueStatus !== 'ready' ||
      input.staleIndicatorCount > 0 ||
      (input.backlogTotal > 0 &&
        typeof input.latestProcessedAgeMinutes === 'number' &&
        input.latestProcessedAgeMinutes >= WORKER_STOPPED_RISK_MINUTES);

    if (hasWorkerStoppedRisk) {
      alerts.push({
        code: 'worker_stopped_risk',
        severity: input.queueStatus !== 'ready' ? 'critical' : 'warning',
        title: 'Risiko worker berhenti atau macet',
        message:
          'Queue menunjukkan backlog atau indikator stale. Periksa proses worker dan jalur Redis sebelum backlog bertambah.',
        metric: {
          value:
            input.latestProcessedAgeMinutes ??
            input.staleIndicatorCount ??
            input.backlogTotal,
          unit:
            typeof input.latestProcessedAgeMinutes === 'number'
              ? 'minutes'
              : 'count',
        },
      });
    }

    return alerts;
  }
}
