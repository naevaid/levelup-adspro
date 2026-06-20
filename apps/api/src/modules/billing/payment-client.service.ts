import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentSignatureService } from './payment-signature.service';

type PaymentProjectProfile = {
  data?: {
    app_id?: string;
    readiness?: {
      status?: string;
      can_charge?: boolean;
    };
  };
};

type PaymentChargePayload = {
  order_id: string;
  gross_amount: number;
  currency: string;
  customer_details: {
    first_name: string;
    email?: string;
    phone?: string;
  };
  item_details: Array<{
    id: string;
    price: number;
    quantity: number;
    name: string;
  }>;
  custom_callback_url: string;
  metadata: Record<string, unknown>;
};

type PaymentChargeResponse = {
  status?: string;
  order_id?: string;
  gateway_order_id?: string;
  token?: string;
  redirect_url?: string;
};

export type PaymentTransactionSnapshot = {
  gatewayOrderId: string | null;
  orderId: string | null;
  status: string | null;
  callbackStatus: string | null;
  paymentType: string | null;
  redirectUrl: string | null;
  rawResponse: Record<string, unknown>;
};

@Injectable()
export class PaymentClientService {
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentSignatureService: PaymentSignatureService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'PAYMENT_BASE_URL',
      'https://payment.naeva.id/api/v1',
    );
  }

  async ensureReadiness() {
    const profile = await this.request<PaymentProjectProfile>({
      method: 'GET',
      path: '/projects/me',
    });
    const readiness = profile.data?.readiness;

    if (!readiness?.can_charge) {
      throw new ServiceUnavailableException(
        'Integrasi payment belum siap untuk membuat charge.',
      );
    }

    return profile;
  }

  async createCharge(payload: PaymentChargePayload) {
    const response = await this.request<PaymentChargeResponse>({
      method: 'POST',
      path: '/charge',
      body: payload,
    });

    return {
      gatewayOrderId: response.gateway_order_id ?? null,
      orderId: response.order_id ?? payload.order_id,
      rawResponse: this.toPlainObject(response),
      redirectUrl: response.redirect_url ?? null,
      snapToken: response.token ?? null,
      status: response.status ?? null,
    };
  }

  async lookupTransactionByOrderId(orderId: string) {
    const query = new URLSearchParams({
      by: 'client_order_id',
      identifier: orderId,
    }).toString();

    const response = await this.request<{ data?: Record<string, unknown> }>({
      method: 'GET',
      path: `/transactions/lookup?${query}`,
    });

    return this.mapTransactionSnapshot(response.data ?? {});
  }

  async getTransactionDetail(gatewayOrderId: string) {
    const response = await this.request<{ data?: Record<string, unknown> }>({
      method: 'GET',
      path: `/transactions/${encodeURIComponent(gatewayOrderId)}`,
    });

    return this.mapTransactionSnapshot(response.data ?? {});
  }

  private async request<T>(params: {
    method: string;
    path: string;
    body?: Record<string, unknown>;
  }) {
    const appId = this.configService.getOrThrow<string>('PAYMENT_APP_ID');
    const secretKey = this.configService.getOrThrow<string>('PAYMENT_SECRET_KEY');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = params.body ? JSON.stringify(params.body) : '';
    const requestPath = this.normalizeRequestPath(params.path);
    const signature = this.paymentSignatureService.createRequestSignature({
      method: params.method,
      requestPath,
      appId,
      timestamp,
      rawBody,
      secretKey,
    });
    const url = new URL(requestPath, this.ensureBaseUrlTrailingSlash());
    const response = await fetch(url, {
      method: params.method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-App-ID': appId,
        'X-Payment-Signature': signature,
        'X-Timestamp': timestamp,
      },
      body: params.body ? rawBody : undefined,
    });

    const payload = await this.parseJsonResponse(response);
    if (!response.ok) {
      throw new BadGatewayException(
        this.extractErrorMessage(payload) ||
          'Payment service mengembalikan response yang tidak berhasil.',
      );
    }

    return payload as T;
  }

  private normalizeRequestPath(path: string) {
    const base = new URL(this.ensureBaseUrlTrailingSlash());
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(normalizedPath, base);
    return `${url.pathname}${url.search}`;
  }

  private ensureBaseUrlTrailingSlash() {
    return this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
  }

  private async parseJsonResponse(response: Response) {
    const text = await response.text();
    if (!text.trim()) {
      return {};
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new BadGatewayException(
        'Payment service mengembalikan payload non-JSON.',
      );
    }
  }

  private extractErrorMessage(payload: unknown) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    if ('message' in payload && typeof payload.message === 'string') {
      return payload.message;
    }

    if ('error' in payload && typeof payload.error === 'string') {
      return payload.error;
    }

    return null;
  }

  private mapTransactionSnapshot(data: Record<string, unknown>): PaymentTransactionSnapshot {
    return {
      gatewayOrderId:
        typeof data.gateway_order_id === 'string' ? data.gateway_order_id : null,
      orderId: typeof data.order_id === 'string' ? data.order_id : null,
      status: typeof data.status === 'string' ? data.status : null,
      callbackStatus:
        typeof data.callback_status === 'string' ? data.callback_status : null,
      paymentType:
        typeof data.payment_type === 'string' ? data.payment_type : null,
      redirectUrl:
        typeof data.redirect_url === 'string' ? data.redirect_url : null,
      rawResponse: this.toPlainObject(data),
    };
  }

  private toPlainObject(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }
}
