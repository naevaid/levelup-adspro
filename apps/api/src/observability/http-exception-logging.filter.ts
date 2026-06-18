import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import {
  getAuthLogContext,
  getClientIp,
  getErrorMessage,
  getRequestPath,
  ObservabilityRequest,
  writeStructuredLog,
} from './http-request-context';

@Catch()
export class HttpExceptionLoggingFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  constructor(
    adapterHost: HttpAdapterHost,
    private readonly appEnv: string,
  ) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() === 'http') {
      const context = host.switchToHttp();
      const request = context.getRequest<ObservabilityRequest>();
      const statusCode =
        exception instanceof HttpException ? exception.getStatus() : 500;
      const responsePayload =
        exception instanceof HttpException ? exception.getResponse() : null;

      writeStructuredLog(statusCode >= 500 ? 'error' : 'warn', {
        event: 'http_error',
        request_id: request.requestId ?? null,
        method: request.method,
        path: getRequestPath(request),
        status_code: statusCode,
        ip: getClientIp(request),
        user_agent: request.get('user-agent') ?? null,
        exception_name:
          exception instanceof Error ? exception.name : 'UnknownException',
        error_message: getErrorMessage(exception),
        error_details:
          responsePayload && typeof responsePayload === 'object'
            ? responsePayload
            : responsePayload ?? null,
        stack:
          this.appEnv === 'production'
            ? null
            : exception instanceof Error
              ? exception.stack ?? null
              : null,
        ...getAuthLogContext(request),
      });
    }

    super.catch(exception, host);
  }
}
