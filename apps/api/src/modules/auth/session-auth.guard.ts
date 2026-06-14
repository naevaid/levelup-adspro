import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedRequest } from './authenticated-request';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token diperlukan.');
    }

    const rawToken = authorization.slice('Bearer '.length).trim();
    if (!rawToken) {
      throw new UnauthorizedException('Session token tidak valid.');
    }

    const sessionTokenHash = createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const session = await this.prisma.userSession.findUnique({
      where: { sessionTokenHash },
      include: {
        user: true,
        activeOrganization: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Session tidak ditemukan.');
    }

    if (session.expiresAt <= new Date()) {
      await this.prisma.userSession.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Session sudah kedaluwarsa.');
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: session.activeOrganizationId,
          userId: session.userId,
        },
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('Membership tenant tidak aktif.');
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    request.auth = {
      sessionId: session.id,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        status: session.user.status,
      },
      organization: {
        id: session.activeOrganization.id,
        name: session.activeOrganization.name,
        slug: session.activeOrganization.slug,
        status: session.activeOrganization.status,
      },
      membership: {
        id: membership.id,
        role: membership.role,
        status: membership.status,
      },
    };

    return true;
  }
}
