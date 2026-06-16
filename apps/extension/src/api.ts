import type { AuthSession, ExtensionSession, ShopSummary } from './types';

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '');
}

async function apiRequest<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
  token?: string,
): Promise<T> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request gagal dengan status ${response.status}.`;
    try {
      const body = (await response.json()) as
        | { message?: string | string[] }
        | undefined;
      if (Array.isArray(body?.message)) {
        message = body.message.join(', ');
      } else if (typeof body?.message === 'string') {
        message = body.message;
      }
    } catch {
      try {
        const text = await response.text();
        if (text.trim()) {
          message = text.trim();
        }
      } catch {
        // Ignore secondary parsing errors.
      }
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function login(
  baseUrl: string,
  email: string,
  password: string,
) {
  return apiRequest<AuthSession>(baseUrl, '/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function listShops(baseUrl: string, token: string) {
  return apiRequest<ShopSummary[]>(baseUrl, '/api/v1/shops', undefined, token);
}

export async function createExtensionSession(
  baseUrl: string,
  token: string,
  payload: { deviceLabel: string; extensionVersion: string; shopId?: string },
) {
  return apiRequest<ExtensionSession>(
    baseUrl,
    '/api/v1/extension/session',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  );
}

export async function sendHeartbeat(baseUrl: string, token: string) {
  return apiRequest<{
    id: string;
    status: string;
    lastHeartbeatAt: string;
    expiresAt: string;
    shop: ExtensionSession['shop'];
  }>(
    baseUrl,
    '/api/v1/extension/heartbeat',
    {
      method: 'POST',
    },
    token,
  );
}

export async function createIngestionBatch(
  baseUrl: string,
  token: string,
  payload: Record<string, unknown>,
) {
  return apiRequest<{
    id: string;
    status: string;
    capturedAt: string;
    rawPayloadObject: {
      id: string;
      storageKey: string;
      sizeBytes: number;
      retentionUntil: string;
      status: string;
    };
  }>(
    baseUrl,
    '/api/v1/ingestion/batches',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  );
}
