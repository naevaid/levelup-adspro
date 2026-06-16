import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ExtensionSessionsService } from './extension-sessions.service';
import { ExtensionAuthenticatedRequest } from './extension-authenticated-request';

@Injectable()
export class ExtensionSessionAuthGuard implements CanActivate {
  constructor(
    private readonly extensionSessionsService: ExtensionSessionsService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<ExtensionAuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token extension diperlukan.');
    }

    const rawToken = authorization.slice('Bearer '.length).trim();
    if (!rawToken) {
      throw new UnauthorizedException('Extension token tidak valid.');
    }

    const session =
      await this.extensionSessionsService.validateAccessToken(rawToken);

    request.extensionAuth = {
      session: {
        id: session.id,
        organizationId: session.organizationId,
        userId: session.userId,
        shopId: session.shopId,
        deviceLabel: session.deviceLabel,
        extensionVersion: session.extensionVersion,
        status: session.status,
        expiresAt: session.expiresAt,
        lastHeartbeatAt: session.lastHeartbeatAt,
      },
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        status: session.user.status,
      },
      organization: {
        id: session.organization.id,
        name: session.organization.name,
        slug: session.organization.slug,
        status: session.organization.status,
      },
      shop: session.shop
        ? {
            id: session.shop.id,
            name: session.shop.name,
            status: session.shop.status,
            externalId: session.shop.externalId,
          }
        : null,
    };

    return true;
  }
}
