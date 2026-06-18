import type { Request } from 'express';
import { AuthenticatedRequest } from '../modules/auth/authenticated-request';
import { ExtensionAuthenticatedRequest } from '../modules/extension-sessions/extension-authenticated-request';

export const REQUEST_ID_HEADER = 'x-request-id';

export type ObservabilityRequest = Request & {
  requestId?: string;
  requestStartedAt?: number;
  auth?: AuthenticatedRequest['auth'];
  extensionAuth?: ExtensionAuthenticatedRequest['extensionAuth'];
};

export function getRequestPath(request: ObservabilityRequest) {
  return request.originalUrl || request.url || '/';
}

export function getClientIp(request: ObservabilityRequest) {
  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
    return forwardedFor.split(',')[0]?.trim() ?? null;
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0]?.trim() ?? null;
  }

  return request.ip || request.socket?.remoteAddress || null;
}

export function getAuthLogContext(request: ObservabilityRequest) {
  if (request.auth) {
    return {
      auth_type: 'dashboard_session',
      session_id: request.auth.sessionId,
      organization_id: request.auth.organization.id,
      user_id: request.auth.user.id,
      membership_role: request.auth.membership.role,
    };
  }

  if (request.extensionAuth) {
    return {
      auth_type: 'extension_session',
      session_id: request.extensionAuth.session.id,
      organization_id: request.extensionAuth.organization.id,
      user_id: request.extensionAuth.user.id,
      shop_id: request.extensionAuth.shop?.id ?? null,
      extension_version: request.extensionAuth.session.extensionVersion,
    };
  }

  return {
    auth_type: 'anonymous',
  };
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
}

export function writeStructuredLog(
  level: 'log' | 'warn' | 'error',
  payload: Record<string, unknown>,
) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    ...payload,
  };
  const serialized = JSON.stringify(entry);

  if (level === 'error') {
    console.error(serialized);
    return;
  }

  if (level === 'warn') {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}
