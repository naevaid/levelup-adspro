import { Membership, Organization, User } from '@prisma/client';
import { Request } from 'express';

export type AuthenticatedRequest = Request & {
  auth: {
    sessionId: string;
    user: Pick<User, 'id' | 'email' | 'name' | 'status' | 'internalRole'>;
    organization: Pick<Organization, 'id' | 'name' | 'slug' | 'status' | 'isInternal'>;
    membership: Pick<Membership, 'id' | 'role' | 'status'>;
  };
};
