import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingService } from './billing.service';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const INITIAL_CLEANUP_DELAY_MS = 30 * 1000;

@Injectable()
export class BillingCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingCleanupService.name);
  private cleanupTimer: NodeJS.Timeout | null = null;
  private cleanupInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly billingService: BillingService,
  ) {}

  onModuleInit() {
    this.scheduleCleanup(INITIAL_CLEANUP_DELAY_MS);
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  async cleanupUnsuccessfulTransactions(referenceDate = new Date()) {
    if (this.cleanupInProgress) {
      return {
        callbackDeliveriesDeleted: 0,
        invoicesDeleted: 0,
        paymentTransactionsDeleted: 0,
        skipped: true,
      };
    }

    this.cleanupInProgress = true;

    try {
      const cutoff = this.buildCleanupCutoff(referenceDate);
      const invoices = await this.prisma.billingInvoice.findMany({
        where: {
          OR: [
            {
              status: {
                in: [
                  InvoiceStatus.FAILED,
                  InvoiceStatus.EXPIRED,
                  InvoiceStatus.VOID,
                ],
              },
              createdAt: {
                lt: cutoff,
              },
            },
            {
              status: InvoiceStatus.PENDING_PAYMENT,
              createdAt: {
                lt: cutoff,
              },
              OR: [
                {
                  dueAt: null,
                },
                {
                  dueAt: {
                    lt: referenceDate,
                  },
                },
              ],
            },
          ],
        },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
        },
      });

      if (invoices.length === 0) {
        return {
          callbackDeliveriesDeleted: 0,
          invoicesDeleted: 0,
          paymentTransactionsDeleted: 0,
          skipped: false,
        };
      }

      const invoiceIds = invoices.map((invoice) => invoice.id);
      const [callbackDeliveries, paymentTransactions, deletedInvoices] =
        await this.prisma.$transaction([
          this.prisma.billingCallbackDelivery.deleteMany({
            where: {
              invoiceId: {
                in: invoiceIds,
              },
            },
          }),
          this.prisma.billingPaymentTransaction.deleteMany({
            where: {
              invoiceId: {
                in: invoiceIds,
              },
            },
          }),
          this.prisma.billingInvoice.deleteMany({
            where: {
              id: {
                in: invoiceIds,
              },
            },
          }),
        ]);

      this.logger.log(
        `Cleanup billing menghapus ${deletedInvoices.count} invoice tidak berhasil yang lebih tua dari ${cutoff.toISOString()}: ${invoices
          .map((invoice) => `${invoice.invoiceNumber}:${invoice.status}`)
          .join(', ')}`,
      );

      return {
        callbackDeliveriesDeleted: callbackDeliveries.count,
        invoicesDeleted: deletedInvoices.count,
        paymentTransactionsDeleted: paymentTransactions.count,
        skipped: false,
      };
    } finally {
      this.cleanupInProgress = false;
    }
  }

  private scheduleCleanup(delayMs: number) {
    this.cleanupTimer = setTimeout(async () => {
      try {
        const lifecycle = await this.billingService.reconcileSubscriptionLifecycle();
        const renewal = await this.billingService.processRenewalBilling();
        const cleanup = await this.cleanupUnsuccessfulTransactions();

        this.logger.log(
          `Billing background cycle selesai: renewal_created=${renewal.created}, renewal_failed=${renewal.failed}, renewal_skipped=${renewal.skipped}, lifecycle_transitioned=${lifecycle.transitioned}, cleanup_deleted=${cleanup.invoicesDeleted}`,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown cleanup error';
        const stack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Cleanup billing gagal dijalankan: ${message}`,
          stack,
        );
      } finally {
        this.scheduleCleanup(CLEANUP_INTERVAL_MS);
      }
    }, delayMs);
  }

  private buildCleanupCutoff(referenceDate: Date) {
    const retentionHours = this.configService.get<number>(
      'BILLING_UNSUCCESSFUL_TRANSACTION_RETENTION_HOURS',
      24,
    );
    return new Date(referenceDate.getTime() - retentionHours * 60 * 60 * 1000);
  }
}
