import { randomUUID } from 'crypto';
import type { NextFunction, Response } from 'express';
import {
  getAuthLogContext,
  getClientIp,
  getRequestPath,
  ObservabilityRequest,
  REQUEST_ID_HEADER,
  writeStructuredLog,
} from './http-request-context';

export function httpRequestLoggingMiddleware(
  request: ObservabilityRequest,
  response: Response,
  next: NextFunction,
) {
  const existingRequestId = request.headers[REQUEST_ID_HEADER];
  const requestId =
    typeof existingRequestId === 'string' && existingRequestId.trim().length > 0
      ? existingRequestId.trim()
      : randomUUID();

  request.requestId = requestId;
  request.requestStartedAt = Date.now();
  response.setHeader(REQUEST_ID_HEADER, requestId);

  let hasLogged = false;
  const logRequest = (outcome: 'request_completed' | 'request_aborted') => {
    if (hasLogged) {
      return;
    }
    hasLogged = true;

    const durationMs = Date.now() - (request.requestStartedAt ?? Date.now());
    const statusCode = response.statusCode;
    const level =
      outcome === 'request_aborted'
        ? 'error'
        : statusCode >= 500
          ? 'error'
          : statusCode >= 400
            ? 'warn'
            : 'log';

    writeStructuredLog(level, {
      event: 'http_request',
      outcome,
      request_id: requestId,
      method: request.method,
      path: getRequestPath(request),
      status_code: statusCode,
      duration_ms: durationMs,
      ip: getClientIp(request),
      user_agent: request.get('user-agent') ?? null,
      ...getAuthLogContext(request),
    });
  };

  response.on('finish', () => {
    logRequest('request_completed');
  });

  response.on('close', () => {
    if (!response.writableEnded) {
      logRequest('request_aborted');
    }
  });

  next();
}
