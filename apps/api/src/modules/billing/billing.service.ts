import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingInterval,
  InvoiceStatus,
  MembershipRole,
  Plan,
  PlanStatus,
  Prisma,
  Subscription,
  SubscriptionStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckoutDto } from './dto/checkout.dto';
import {
  PaymentClientService,
  PaymentTransactionSnapshot,
} from './payment-client.service';
import { PaymentSignatureService } from './payment-signature.service';

type SubscriptionWithPlan = Subscription & {
  plan: Plan;
};

type CallbackHeaders = {
  appId: string | null;
  attempt: number;
  deliveryId: string | null;
  eventType: string | null;
  requestPath: string | null;
  receivedHeaders?: Record<string, string>;
  rawBodyPresent?: boolean;
  signature: string | null;
  timestamp: string | null;
};

type CallbackPayload = {
  gateway_order_id?: unknown;
  gross_amount?: unknown;
  metadata?: unknown;
  order_id?: unknown;
  payment_type?: unknown;
  transaction_status?: unknown;
  transaction_time?: unknown;
};

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly paymentClientService: PaymentClientService,
    private readonly paymentSignatureService: PaymentSignatureService,
  ) {}

  async listPlans() {
    const plans = await this.prisma.plan.findMany({
      where: { status: PlanStatus.ACTIVE },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      data: plans.map((plan) => ({
        code: plan.code,
        name: plan.name,
        billing_interval: plan.billingInterval,
        currency: plan.currency,
        price_amount: plan.priceAmount,
        features: this.extractFeatures(plan),
        quotas: this.extractQuotas(plan),
      })),
    };
  }

  async getSubscription(organizationId: string) {
    const [subscription, activeShops, activeMembers] = await Promise.all([
      this.ensureSubscriptionWithPlan(organizationId),
      this.prisma.shop.count({
        where: {
          organizationId,
          status: 'ACTIVE',
        },
      }),
      this.prisma.membership.count({
        where: {
          organizationId,
          status: 'ACTIVE',
        },
      }),
    ]);

    const snapshot = await this.prisma.organizationEntitlementSnapshot.findUnique({
      where: { organizationId },
    });

    return {
      data: {
        subscription: {
          status: subscription.status,
          plan_code: subscription.plan.code,
          billing_interval: subscription.plan.billingInterval,
          current_period_start: subscription.currentPeriodStart,
          current_period_end: subscription.currentPeriodEnd,
          grace_period_end: subscription.gracePeriodEnd,
        },
        entitlements: {
          features: snapshot
            ? this.toPlainObject(snapshot.featuresJson)
            : this.extractFeatures(subscription.plan),
          quotas: snapshot
            ? this.toPlainObject(snapshot.quotasJson)
            : this.extractQuotas(subscription.plan),
        },
        usage: {
          active_shops: activeShops,
          active_members: activeMembers,
        },
      },
    };
  }

  async checkout(
    organizationId: string,
    membershipRole: MembershipRole,
    actor: {
      email: string;
      name: string;
    },
    dto: CheckoutDto,
  ) {
    this.assertOwner(membershipRole);

    const plan = await this.resolvePlan(dto);
    const currentSubscription = await this.ensureSubscriptionWithPlan(organizationId);
    const isFreePlan = plan.code.startsWith('free');

    if (plan.priceAmount <= 0 && !isFreePlan) {
      throw new BadRequestException(
        'Harga plan belum dikonfigurasi, checkout payment belum bisa diproses.',
      );
    }

    if (plan.priceAmount > 0) {
      await this.paymentClientService.ensureReadiness();
    }

    const now = new Date();
    const invoiceNumber = this.generateInvoiceNumber(now);
    const orderId = invoiceNumber;
    const description = `${plan.name} ${plan.billingInterval.toLowerCase()}`;
    const subscription = await this.prisma.subscription.update({
      where: { id: currentSubscription.id },
      data: {
        planId: plan.id,
        status:
          plan.priceAmount > 0
            ? SubscriptionStatus.PENDING_ACTIVATION
            : SubscriptionStatus.ACTIVE,
        provider: plan.priceAmount > 0 ? 'payment.naeva.id' : 'internal-free',
        cancelAtPeriodEnd: false,
        canceledAt: null,
        expiredAt: null,
        gracePeriodEnd: null,
      },
      include: { plan: true },
    });

    const invoice = await this.prisma.billingInvoice.create({
      data: {
        invoiceNumber,
        organizationId,
        subscriptionId: subscription.id,
        planId: plan.id,
        billingInterval: plan.billingInterval,
        amount: plan.priceAmount,
        currency: plan.currency,
        status: plan.priceAmount > 0 ? InvoiceStatus.DRAFT : InvoiceStatus.PAID,
        orderId,
        description,
        issuedAt: now,
        paidAt: plan.priceAmount > 0 ? null : now,
        metadataJson: {
          organization_id: organizationId,
          plan_code: plan.code,
          subscription_id: subscription.id,
          source: 'levelup-adspro',
        },
      },
    });

    if (plan.priceAmount <= 0) {
      const activatedSubscription = await this.activateSubscriptionAfterPayment(
        subscription.id,
        plan,
        now,
        null,
      );
      await this.refreshEntitlementSnapshot(organizationId, activatedSubscription);

      return {
        data: {
          subscription_id: activatedSubscription.id,
          invoice_id: invoice.id,
          invoice_status: InvoiceStatus.PAID,
          payment: null,
        },
      };
    }

    try {
      const charge = await this.paymentClientService.createCharge({
        order_id: orderId,
        gross_amount: plan.priceAmount,
        currency: plan.currency,
        customer_details: {
          first_name: actor.name.trim() || 'Owner',
          email: actor.email,
        },
        item_details: [
          {
            id: plan.code,
            price: plan.priceAmount,
            quantity: 1,
            name: `LevelUP adsPRO ${plan.name} ${plan.billingInterval.toLowerCase()}`,
          },
        ],
        custom_callback_url:
          this.configService.getOrThrow<string>('BILLING_CALLBACK_URL'),
        metadata: {
          organization_id: organizationId,
          subscription_id: subscription.id,
          invoice_id: invoice.id,
          plan_code: plan.code,
          billing_interval: plan.billingInterval.toLowerCase(),
          source: 'levelup-adspro',
        },
      });

      const updatedInvoice = await this.prisma.billingInvoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.PENDING_PAYMENT,
          gatewayOrderId: charge.gatewayOrderId,
        },
      });

      await this.prisma.billingPaymentTransaction.upsert({
        where: { invoiceId: invoice.id },
        update: {
          provider: 'midtrans',
          paymentService: 'payment.naeva.id',
          orderId,
          gatewayOrderId: charge.gatewayOrderId,
          redirectUrl: charge.redirectUrl,
          snapToken: charge.snapToken,
          rawChargeResponseJson:
            charge.rawResponse as Prisma.InputJsonValue,
          transactionStatus: charge.status,
        },
        create: {
          invoiceId: invoice.id,
          provider: 'midtrans',
          paymentService: 'payment.naeva.id',
          orderId,
          gatewayOrderId: charge.gatewayOrderId,
          redirectUrl: charge.redirectUrl,
          snapToken: charge.snapToken,
          rawChargeResponseJson:
            charge.rawResponse as Prisma.InputJsonValue,
          transactionStatus: charge.status,
        },
      });

      return {
        data: {
          subscription_id: subscription.id,
          invoice_id: invoice.id,
          invoice_status: updatedInvoice.status,
          payment: {
            order_id: orderId,
            gateway_order_id: charge.gatewayOrderId,
            redirect_url: charge.redirectUrl,
            snap_token: charge.snapToken,
          },
        },
      };
    } catch (error) {
      await this.prisma.billingInvoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.FAILED,
          failedAt: new Date(),
        },
      });

      throw error;
    }
  }

  async listInvoices(
    organizationId: string,
    status?: string,
    limit = 20,
  ) {
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;
    const invoiceStatus = this.parseInvoiceStatus(status);
    const invoices = await this.prisma.billingInvoice.findMany({
      where: {
        organizationId,
        ...(invoiceStatus ? { status: invoiceStatus } : {}),
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
      take: normalizedLimit,
    });

    return {
      data: invoices.map((invoice) => ({
        invoice_id: invoice.id,
        invoice_number: invoice.invoiceNumber,
        plan_code: invoice.plan.code,
        billing_interval: invoice.billingInterval,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        issued_at: invoice.issuedAt,
        paid_at: invoice.paidAt,
      })),
    };
  }

  async getInvoiceDetail(organizationId: string, invoiceId: string) {
    const invoice = await this.prisma.billingInvoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: {
        plan: true,
        paymentTransaction: true,
        callbackDeliveries: {
          orderBy: { receivedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice tidak ditemukan.');
    }

    return {
      data: {
        invoice: {
          id: invoice.id,
          invoice_number: invoice.invoiceNumber,
          order_id: invoice.orderId,
          gateway_order_id: invoice.gatewayOrderId,
          plan_code: invoice.plan.code,
          billing_interval: invoice.billingInterval,
          amount: invoice.amount,
          currency: invoice.currency,
          status: invoice.status,
          issued_at: invoice.issuedAt,
          paid_at: invoice.paidAt,
          failed_at: invoice.failedAt,
          expired_at: invoice.expiredAt,
        },
        payment: invoice.paymentTransaction
          ? {
              provider: invoice.paymentTransaction.provider,
              payment_service: invoice.paymentTransaction.paymentService,
              payment_type: invoice.paymentTransaction.paymentType,
              transaction_status: invoice.paymentTransaction.transactionStatus,
              callback_status: invoice.paymentTransaction.callbackStatus,
              redirect_url: invoice.paymentTransaction.redirectUrl,
              snap_token: invoice.paymentTransaction.snapToken,
            }
          : null,
        latest_callback: invoice.callbackDeliveries[0]
          ? {
              delivery_id: invoice.callbackDeliveries[0].deliveryId,
              attempt: invoice.callbackDeliveries[0].attempt,
              event_type: invoice.callbackDeliveries[0].eventType,
              signature_valid: invoice.callbackDeliveries[0].signatureValid,
              processed_successfully:
                invoice.callbackDeliveries[0].processedSuccessfully,
              http_response_code: invoice.callbackDeliveries[0].httpResponseCode,
              received_at: invoice.callbackDeliveries[0].receivedAt,
              processed_at: invoice.callbackDeliveries[0].processedAt,
            }
          : null,
      },
    };
  }

  async refreshPaymentStatus(
    organizationId: string,
    membershipRole: MembershipRole,
    invoiceId: string,
  ) {
    this.assertOwner(membershipRole);

    const invoice = await this.prisma.billingInvoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: {
        plan: true,
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice tidak ditemukan.');
    }

    const snapshot = invoice.gatewayOrderId
      ? await this.paymentClientService.getTransactionDetail(invoice.gatewayOrderId)
      : await this.paymentClientService.lookupTransactionByOrderId(invoice.orderId);

    await this.prisma.billingPaymentTransaction.upsert({
      where: { invoiceId: invoice.id },
      update: {
        gatewayOrderId: snapshot.gatewayOrderId,
        orderId: snapshot.orderId ?? invoice.orderId,
        paymentType: snapshot.paymentType,
        transactionStatus: snapshot.status,
        callbackStatus: snapshot.callbackStatus,
        redirectUrl: snapshot.redirectUrl,
        lastLookupResponseJson: snapshot.rawResponse as Prisma.InputJsonValue,
      },
      create: {
        invoiceId: invoice.id,
        provider: 'midtrans',
        paymentService: 'payment.naeva.id',
        gatewayOrderId: snapshot.gatewayOrderId,
        orderId: snapshot.orderId ?? invoice.orderId,
        paymentType: snapshot.paymentType,
        transactionStatus: snapshot.status,
        callbackStatus: snapshot.callbackStatus,
        redirectUrl: snapshot.redirectUrl,
        lastLookupResponseJson: snapshot.rawResponse as Prisma.InputJsonValue,
      },
    });

    const nextSubscription = await this.applyTransactionStatusTransition(
      invoice.id,
      snapshot,
      new Date(),
    );

    await this.refreshEntitlementSnapshot(organizationId, nextSubscription);

    return {
      data: {
        invoice_id: invoice.id,
        invoice_status: this.mapInvoiceStatusFromTransaction(snapshot.status),
        transaction_status: snapshot.status,
        gateway_order_id: snapshot.gatewayOrderId,
      },
    };
  }

  async handlePaymentCallback(params: {
    headers: CallbackHeaders;
    payload: CallbackPayload;
    rawPayload: string;
  }) {
    if (!params.headers.deliveryId) {
      throw new UnauthorizedException('Header callback delivery id wajib ada.');
    }

    const existingDelivery = await this.prisma.billingCallbackDelivery.findFirst({
      where: {
        deliveryId: params.headers.deliveryId,
        attempt: params.headers.attempt,
      },
    });

    if (existingDelivery?.processedSuccessfully) {
      return { ok: true };
    }

    const invoice = await this.findInvoiceForCallback(params.payload);
    const verificationDebug = this.buildCallbackVerificationDebug(
      params.headers,
      params.rawPayload,
    );
    const signatureValid = verificationDebug.signatureValid;

    await this.upsertCallbackDelivery({
      debug: verificationDebug,
      existingId: existingDelivery?.id ?? null,
      invoiceId: invoice?.id ?? null,
      headers: params.headers,
      payload: params.payload,
      signatureValid,
      processedSuccessfully: false,
      httpResponseCode: signatureValid ? 202 : 401,
      errorMessage: signatureValid ? null : 'Invalid callback signature.',
    });

    if (!signatureValid) {
      throw new UnauthorizedException('Signature callback payment tidak valid.');
    }

    if (params.headers.eventType === 'payment.callback.test') {
      await this.upsertCallbackDelivery({
        debug: verificationDebug,
        existingId: existingDelivery?.id ?? null,
        invoiceId: invoice?.id ?? null,
        headers: params.headers,
        payload: params.payload,
        signatureValid: true,
        processedSuccessfully: true,
        httpResponseCode: 200,
        errorMessage: null,
      });

      return {
        received: true,
        message: 'Test callback diterima.',
      };
    }

    if (!invoice) {
      throw new NotFoundException('Invoice callback payment tidak ditemukan.');
    }

    const snapshot: PaymentTransactionSnapshot = {
      gatewayOrderId:
        typeof params.payload.gateway_order_id === 'string'
          ? params.payload.gateway_order_id
          : invoice.gatewayOrderId,
      orderId:
        typeof params.payload.order_id === 'string'
          ? params.payload.order_id
          : invoice.orderId,
      status:
        typeof params.payload.transaction_status === 'string'
          ? params.payload.transaction_status
          : null,
      callbackStatus: 'received',
      paymentType:
        typeof params.payload.payment_type === 'string'
          ? params.payload.payment_type
          : null,
      redirectUrl: null,
      rawResponse: this.toPlainObject(params.payload),
    };
    const transitionAt = this.parseTransactionTime(params.payload.transaction_time);
    const nextSubscription = await this.applyTransactionStatusTransition(
      invoice.id,
      snapshot,
      transitionAt,
      this.toPlainObject(params.payload),
    );

    await this.refreshEntitlementSnapshot(invoice.organizationId, nextSubscription);

    await this.upsertCallbackDelivery({
      debug: verificationDebug,
      existingId: existingDelivery?.id ?? null,
      invoiceId: invoice.id,
      headers: params.headers,
      payload: params.payload,
      signatureValid: true,
      processedSuccessfully: true,
      httpResponseCode: 200,
      errorMessage: null,
    });

    return { ok: true };
  }

  private assertOwner(membershipRole: MembershipRole) {
    if (membershipRole !== MembershipRole.OWNER) {
      throw new ForbiddenException('Aksi billing ini hanya boleh dilakukan owner.');
    }
  }

  private async resolvePlan(dto: CheckoutDto) {
    const requestCode = dto.planCode.trim().toLowerCase();
    const baseCode = requestCode.replace(/-(monthly|yearly)$/i, '');
    const intervalSuffix = dto.billingInterval.toLowerCase();
    const plan = await this.prisma.plan.findFirst({
      where: {
        status: PlanStatus.ACTIVE,
        billingInterval: dto.billingInterval,
        code: {
          in: [requestCode, `${baseCode}-${intervalSuffix}`],
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan tidak ditemukan atau belum aktif.');
    }

    return plan;
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
        where: { status: PlanStatus.ACTIVE },
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

  private extractFeatures(plan: Plan) {
    return this.toPlainObject(plan.featuresJson);
  }

  private extractQuotas(plan: Plan) {
    return {
      max_shops: plan.shopLimit,
      max_members: plan.memberLimit,
      history_days: plan.historyDays,
    };
  }

  private generateInvoiceNumber(now: Date) {
    const year = now.getUTCFullYear();
    const timePortion = String(now.getTime()).slice(-8);
    const randomPortion = randomBytes(2).toString('hex').toUpperCase();
    return `INV-LUAP-${year}-${timePortion}${randomPortion}`;
  }

  private async activateSubscriptionAfterPayment(
    subscriptionId: string,
    plan: Plan,
    activatedAt: Date,
    providerReference: string | null,
  ) {
    const periodEnd = this.calculatePeriodEnd(activatedAt, plan.billingInterval);

    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        startsAt: activatedAt,
        currentPeriodStart: activatedAt,
        currentPeriodEnd: periodEnd,
        activatedAt,
        provider: providerReference ? 'payment.naeva.id' : 'internal-free',
        providerReference,
        canceledAt: null,
        expiredAt: null,
        gracePeriodEnd: null,
      },
      include: { plan: true },
    });
  }

  private calculatePeriodEnd(startAt: Date, billingInterval: BillingInterval) {
    const next = new Date(startAt);
    if (billingInterval === BillingInterval.YEARLY) {
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      return next;
    }

    next.setUTCMonth(next.getUTCMonth() + 1);
    return next;
  }

  private parseInvoiceStatus(status?: string) {
    if (!status) {
      return null;
    }

    const normalized = status.toUpperCase();
    if (
      normalized === InvoiceStatus.DRAFT ||
      normalized === InvoiceStatus.ISSUED ||
      normalized === InvoiceStatus.PENDING_PAYMENT ||
      normalized === InvoiceStatus.PAID ||
      normalized === InvoiceStatus.FAILED ||
      normalized === InvoiceStatus.EXPIRED ||
      normalized === InvoiceStatus.VOID ||
      normalized === InvoiceStatus.REFUNDED
    ) {
      return normalized as InvoiceStatus;
    }

    throw new NotFoundException('Status invoice tidak valid.');
  }

  private async applyTransactionStatusTransition(
    invoiceId: string,
    snapshot: PaymentTransactionSnapshot,
    transitionedAt: Date,
    callbackPayload?: Record<string, unknown>,
  ) {
    const invoice = await this.prisma.billingInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: {
          include: { plan: true },
        },
        plan: true,
      },
    });

    if (!invoice || !invoice.subscription) {
      throw new NotFoundException('Invoice subscription tidak ditemukan.');
    }

    await this.prisma.billingPaymentTransaction.upsert({
      where: { invoiceId },
      update: {
        provider: 'midtrans',
        paymentService: 'payment.naeva.id',
        gatewayOrderId: snapshot.gatewayOrderId,
        orderId: snapshot.orderId ?? invoice.orderId,
        paymentType: snapshot.paymentType,
        transactionStatus: snapshot.status,
        callbackStatus: snapshot.callbackStatus,
        redirectUrl: snapshot.redirectUrl,
        lastLookupResponseJson: callbackPayload
          ? undefined
          : (snapshot.rawResponse as Prisma.InputJsonValue),
        lastCallbackPayloadJson: callbackPayload
          ? (callbackPayload as Prisma.InputJsonValue)
          : undefined,
        lastCallbackReceivedAt: callbackPayload ? new Date() : undefined,
      },
      create: {
        invoiceId,
        provider: 'midtrans',
        paymentService: 'payment.naeva.id',
        gatewayOrderId: snapshot.gatewayOrderId,
        orderId: snapshot.orderId ?? invoice.orderId,
        paymentType: snapshot.paymentType,
        transactionStatus: snapshot.status,
        callbackStatus: snapshot.callbackStatus,
        redirectUrl: snapshot.redirectUrl,
        lastLookupResponseJson: callbackPayload
          ? undefined
          : (snapshot.rawResponse as Prisma.InputJsonValue),
        lastCallbackPayloadJson: callbackPayload
          ? (callbackPayload as Prisma.InputJsonValue)
          : undefined,
        lastCallbackReceivedAt: callbackPayload ? new Date() : undefined,
      },
    });

    const nextInvoiceStatus = this.mapInvoiceStatusFromTransaction(snapshot.status);
    const invoiceData: Prisma.BillingInvoiceUpdateInput = {
      gatewayOrderId: snapshot.gatewayOrderId,
      status: nextInvoiceStatus,
    };

    if (nextInvoiceStatus === InvoiceStatus.PAID) {
      invoiceData.paidAt = transitionedAt;
      invoiceData.failedAt = null;
      invoiceData.expiredAt = null;
      invoiceData.voidedAt = null;
    }

    if (nextInvoiceStatus === InvoiceStatus.FAILED) {
      invoiceData.failedAt = transitionedAt;
    }

    if (nextInvoiceStatus === InvoiceStatus.EXPIRED) {
      invoiceData.expiredAt = transitionedAt;
    }

    if (nextInvoiceStatus === InvoiceStatus.VOID) {
      invoiceData.voidedAt = transitionedAt;
    }

    await this.prisma.billingInvoice.update({
      where: { id: invoiceId },
      data: invoiceData,
    });

    if (nextInvoiceStatus === InvoiceStatus.PAID) {
      return this.activateSubscriptionAfterPayment(
        invoice.subscription.id,
        invoice.plan,
        transitionedAt,
        snapshot.gatewayOrderId,
      );
    }

    const subscriptionStatus = this.mapSubscriptionStatusFromTransaction(
      snapshot.status,
      invoice.subscription.status,
    );

    return this.prisma.subscription.update({
      where: { id: invoice.subscription.id },
      data: {
        status: subscriptionStatus,
        gracePeriodEnd:
          subscriptionStatus === SubscriptionStatus.GRACE_PERIOD
            ? this.calculateGracePeriodEnd(transitionedAt)
            : null,
        canceledAt:
          subscriptionStatus === SubscriptionStatus.CANCELED
            ? transitionedAt
            : null,
        expiredAt:
          subscriptionStatus === SubscriptionStatus.EXPIRED
            ? transitionedAt
            : null,
      },
      include: { plan: true },
    });
  }

  private calculateGracePeriodEnd(referenceDate: Date) {
    const grace = new Date(referenceDate);
    grace.setUTCDate(grace.getUTCDate() + 7);
    return grace;
  }

  private mapInvoiceStatusFromTransaction(status: string | null) {
    switch ((status ?? '').toLowerCase()) {
      case 'settlement':
        return InvoiceStatus.PAID;
      case 'failed':
        return InvoiceStatus.FAILED;
      case 'expired':
        return InvoiceStatus.EXPIRED;
      case 'cancelled':
        return InvoiceStatus.VOID;
      case 'refunded':
        return InvoiceStatus.REFUNDED;
      case 'pending':
      default:
        return InvoiceStatus.PENDING_PAYMENT;
    }
  }

  private mapSubscriptionStatusFromTransaction(
    status: string | null,
    currentStatus: SubscriptionStatus,
  ) {
    switch ((status ?? '').toLowerCase()) {
      case 'settlement':
        return SubscriptionStatus.ACTIVE;
      case 'failed':
        return currentStatus === SubscriptionStatus.ACTIVE
          ? SubscriptionStatus.PAST_DUE
          : SubscriptionStatus.PENDING_ACTIVATION;
      case 'expired':
        return currentStatus === SubscriptionStatus.ACTIVE
          ? SubscriptionStatus.GRACE_PERIOD
          : SubscriptionStatus.EXPIRED;
      case 'cancelled':
      case 'refunded':
        return SubscriptionStatus.CANCELED;
      case 'pending':
      default:
        return SubscriptionStatus.PENDING_ACTIVATION;
    }
  }

  private async refreshEntitlementSnapshot(
    organizationId: string,
    subscription: SubscriptionWithPlan,
  ) {
    await this.prisma.organizationEntitlementSnapshot.upsert({
      where: { organizationId },
      update: {
        subscriptionId: subscription.id,
        planCode: subscription.plan.code,
        subscriptionStatus: subscription.status,
        featuresJson: this.extractFeatures(subscription.plan) as Prisma.InputJsonValue,
        quotasJson: this.extractQuotas(subscription.plan) as Prisma.InputJsonValue,
        computedAt: new Date(),
      },
      create: {
        organizationId,
        subscriptionId: subscription.id,
        planCode: subscription.plan.code,
        subscriptionStatus: subscription.status,
        featuresJson: this.extractFeatures(subscription.plan) as Prisma.InputJsonValue,
        quotasJson: this.extractQuotas(subscription.plan) as Prisma.InputJsonValue,
        computedAt: new Date(),
      },
    });
  }

  private async findInvoiceForCallback(payload: CallbackPayload) {
    const orderId = typeof payload.order_id === 'string' ? payload.order_id : null;
    const gatewayOrderId =
      typeof payload.gateway_order_id === 'string'
        ? payload.gateway_order_id
        : null;
    const metadata = this.toPlainObject(payload.metadata);
    const metadataInvoiceId =
      typeof metadata.invoice_id === 'string' ? metadata.invoice_id : null;

    if (metadataInvoiceId) {
      const invoice = await this.prisma.billingInvoice.findUnique({
        where: { id: metadataInvoiceId },
      });
      if (invoice) {
        return invoice;
      }
    }

    if (gatewayOrderId) {
      const invoice = await this.prisma.billingInvoice.findFirst({
        where: { gatewayOrderId },
      });
      if (invoice) {
        return invoice;
      }
    }

    if (orderId) {
      return this.prisma.billingInvoice.findFirst({
        where: { orderId },
      });
    }

    return null;
  }

  private buildCallbackVerificationDebug(
    headers: CallbackHeaders,
    rawPayload: string,
  ) {
    if (!headers.signature || !headers.appId) {
      return {
        appIdMatches: false,
        candidates: [],
        providedSignature: headers.signature,
        rawBodyPresent: headers.rawBodyPresent ?? false,
        rawPayloadLength: rawPayload.length,
        rawPayloadSha256: createHash('sha256').update(rawPayload).digest('hex'),
        signatureValid: false,
      };
    }

    const appId = this.configService.get<string>('PAYMENT_APP_ID');
    if (!appId || headers.appId !== appId) {
      return {
        appIdMatches: false,
        candidates: [],
        providedSignature: headers.signature,
        rawBodyPresent: headers.rawBodyPresent ?? false,
        rawPayloadLength: rawPayload.length,
        rawPayloadSha256: createHash('sha256').update(rawPayload).digest('hex'),
        signatureValid: false,
      };
    }

    const secretKey = this.configService.get<string>('PAYMENT_SECRET_KEY');
    if (!secretKey) {
      return {
        appIdMatches: true,
        candidates: [],
        providedSignature: headers.signature,
        rawBodyPresent: headers.rawBodyPresent ?? false,
        rawPayloadLength: rawPayload.length,
        rawPayloadSha256: createHash('sha256').update(rawPayload).digest('hex'),
        signatureValid: false,
      };
    }

    const candidates = this.paymentSignatureService.listCallbackSignatureCandidates({
      appId: headers.appId,
      rawPayload,
      requestPath: headers.requestPath ?? undefined,
      secretKey,
      timestamp: headers.timestamp ?? undefined,
    });

    return {
      appIdMatches: true,
      candidates,
      providedSignature: headers.signature,
      rawBodyPresent: headers.rawBodyPresent ?? false,
      rawPayloadLength: rawPayload.length,
      rawPayloadSha256: createHash('sha256').update(rawPayload).digest('hex'),
      signatureValid: this.paymentSignatureService.isCallbackSignatureValid({
        appId: headers.appId,
        rawPayload,
        providedSignature: headers.signature,
        requestPath: headers.requestPath ?? undefined,
        secretKey,
        timestamp: headers.timestamp ?? undefined,
      }),
    };
  }

  private parseTransactionTime(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) {
      return new Date();
    }

    const normalized = value.includes('T')
      ? value
      : value.trim().replace(' ', 'T');
    const parsed = new Date(normalized);

    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private async upsertCallbackDelivery(params: {
    debug: {
      appIdMatches: boolean;
      candidates: Array<{ name: string; value: string }>;
      providedSignature: string | null;
      rawBodyPresent: boolean;
      rawPayloadLength: number;
      rawPayloadSha256: string;
      signatureValid: boolean;
    };
    existingId: string | null;
    invoiceId: string | null;
    headers: CallbackHeaders;
    payload: CallbackPayload;
    signatureValid: boolean;
    processedSuccessfully: boolean;
    httpResponseCode: number;
    errorMessage: string | null;
  }) {
    const data: Prisma.BillingCallbackDeliveryUncheckedCreateInput = {
      invoiceId: params.invoiceId,
      gatewayOrderId:
        typeof params.payload.gateway_order_id === 'string'
          ? params.payload.gateway_order_id
          : null,
      deliveryId: params.headers.deliveryId ?? 'missing-delivery-id',
      attempt: params.headers.attempt,
      eventType: params.headers.eventType,
      signatureValid: params.signatureValid,
      processedSuccessfully: params.processedSuccessfully,
      httpResponseCode: params.httpResponseCode,
      processedAt: params.processedSuccessfully ? new Date() : null,
      headersJson: {
        app_id: params.headers.appId,
        event: params.headers.eventType,
        attempt: params.headers.attempt,
        timestamp: params.headers.timestamp,
        delivery_id: params.headers.deliveryId,
        provided_signature: params.debug.providedSignature,
        request_path: params.headers.requestPath,
        received_headers: params.headers.receivedHeaders ?? {},
        app_id_matches_expected: params.debug.appIdMatches,
        raw_body_present: params.debug.rawBodyPresent,
        raw_payload_length: params.debug.rawPayloadLength,
        raw_payload_sha256: params.debug.rawPayloadSha256,
        signature_candidates: params.debug.candidates,
      } as Prisma.InputJsonValue,
      payloadJson: this.toPlainObject(params.payload) as Prisma.InputJsonValue,
      errorMessage: params.errorMessage,
    };

    if (params.existingId) {
      await this.prisma.billingCallbackDelivery.update({
        where: { id: params.existingId },
        data,
      });
      return;
    }

    await this.prisma.billingCallbackDelivery.create({ data });
  }

  private toPlainObject(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }
}
