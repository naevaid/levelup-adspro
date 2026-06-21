import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InternalUserRole,
  PlanStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInternalPlanDto } from './dto/create-internal-plan.dto';
import { UpdateInternalPlanDto } from './dto/update-internal-plan.dto';

@Injectable()
export class InternalPlansService {
  constructor(private readonly prisma: PrismaService) {}

  assertAccess(internalRole: InternalUserRole | null) {
    if (internalRole !== InternalUserRole.PLATFORM_ADMIN) {
      throw new ForbiddenException(
        'Akses plan management hanya untuk internal platform admin.',
      );
    }
  }

  async listAll() {
    const [plans, activeSubscriptionCounts] = await Promise.all([
      this.prisma.plan.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.subscription.groupBy({
        by: ['planId'],
        where: {
          status: {
            in: ['TRIALING', 'PENDING_ACTIVATION', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD'],
          },
        },
        _count: { _all: true },
      }),
    ]);

    const subscriptionCountMap = new Map(
      activeSubscriptionCounts.map((item) => [item.planId, item._count._all]),
    );

    return {
      data: plans.map((plan) => ({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        is_internal: plan.isInternal,
        billing_interval: plan.billingInterval,
        price_amount: plan.priceAmount,
        currency: plan.currency,
        sort_order: plan.sortOrder,
        status: plan.status,
        quotas: {
          max_shops: plan.shopLimit,
          max_members: plan.memberLimit,
          history_days: plan.historyDays,
        },
        features: this.toPlainObject(plan.featuresJson),
        active_subscription_count: subscriptionCountMap.get(plan.id) ?? 0,
        created_at: plan.createdAt,
        updated_at: plan.updatedAt,
      })),
    };
  }

  async create(dto: CreateInternalPlanDto) {
    try {
      const plan = await this.prisma.plan.create({
        data: {
          code: this.normalizeCode(dto.code),
          name: dto.name.trim(),
          billingInterval: dto.billingInterval,
          priceAmount: dto.priceAmount,
          currency: dto.currency.toUpperCase(),
          sortOrder: dto.sortOrder ?? 0,
          shopLimit: dto.shopLimit,
          memberLimit: dto.memberLimit,
          historyDays: dto.historyDays,
          featuresJson: dto.features as Prisma.InputJsonValue,
          status: dto.status ?? PlanStatus.ACTIVE,
        },
      });

      return { data: this.toSummary(plan) };
    } catch (error) {
      this.handleConflict(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateInternalPlanDto) {
    const existing = await this.prisma.plan.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Plan tidak ditemukan.');
    }

    try {
      const updated = await this.prisma.plan.update({
        where: { id },
        data: {
          code:
            typeof dto.code === 'string'
              ? this.normalizeCode(dto.code)
              : undefined,
          name:
            typeof dto.name === 'string' ? dto.name.trim() : undefined,
          billingInterval: dto.billingInterval,
          priceAmount: dto.priceAmount,
          currency:
            typeof dto.currency === 'string'
              ? dto.currency.toUpperCase()
              : undefined,
          sortOrder: dto.sortOrder,
          shopLimit: dto.shopLimit,
          memberLimit: dto.memberLimit,
          historyDays: dto.historyDays,
          featuresJson: dto.features as Prisma.InputJsonValue | undefined,
          status: dto.status,
        },
      });

      return { data: this.toSummary(updated) };
    } catch (error) {
      this.handleConflict(error);
      throw error;
    }
  }

  async deactivate(id: string) {
    const existing = await this.prisma.plan.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Plan tidak ditemukan.');
    }

    const updated = await this.prisma.plan.update({
      where: { id },
      data: { status: PlanStatus.INACTIVE },
    });

    return { data: this.toSummary(updated) };
  }

  private normalizeCode(code: string) {
    return code.trim().toLowerCase();
  }

  private handleConflict(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Code plan sudah dipakai.');
    }
  }

  private toSummary(plan: {
    id: string;
    code: string;
    name: string;
    isInternal: boolean;
    billingInterval: string;
    priceAmount: number;
    currency: string;
    sortOrder: number;
    shopLimit: number;
    memberLimit: number;
    historyDays: number;
    status: PlanStatus;
    createdAt: Date;
    updatedAt: Date;
    featuresJson: Prisma.JsonValue;
  }) {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      is_internal: plan.isInternal,
      billing_interval: plan.billingInterval,
      price_amount: plan.priceAmount,
      currency: plan.currency,
      sort_order: plan.sortOrder,
      status: plan.status,
      quotas: {
        max_shops: plan.shopLimit,
        max_members: plan.memberLimit,
        history_days: plan.historyDays,
      },
      features: this.toPlainObject(plan.featuresJson),
      created_at: plan.createdAt,
      updated_at: plan.updatedAt,
    };
  }

  private toPlainObject(value: Prisma.JsonValue) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }
}
