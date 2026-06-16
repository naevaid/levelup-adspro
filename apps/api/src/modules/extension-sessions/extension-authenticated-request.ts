import { ExtensionSession, Organization, Shop, User } from '@prisma/client';
import { Request } from 'express';

export type ExtensionAuthenticatedRequest = Request & {
  extensionAuth: {
    session: Pick<
      ExtensionSession,
      | 'id'
      | 'organizationId'
      | 'userId'
      | 'shopId'
      | 'deviceLabel'
      | 'extensionVersion'
      | 'status'
      | 'expiresAt'
      | 'lastHeartbeatAt'
    >;
    user: Pick<User, 'id' | 'email' | 'name' | 'status'>;
    organization: Pick<Organization, 'id' | 'name' | 'slug' | 'status'>;
    shop: Pick<Shop, 'id' | 'name' | 'status' | 'externalId'> | null;
  };
};
