export type MembershipRole = "OWNER" | "MANAGER" | "STAFF" | "AGENCY_ADMIN";
export type InternalUserRole = "PLATFORM_ADMIN";

export type StoredAuthSession = {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  user: {
    id: string;
    email: string;
    internalRole: InternalUserRole | null;
    name: string;
    status: string;
  };
  activeOrganization: {
    id: string;
    name: string;
    slug: string;
    isInternal: boolean;
    status: string;
  };
  membership: {
    id: string;
    role: MembershipRole;
    status: string;
  };
};

export type MeResponse = {
  user: StoredAuthSession["user"];
  activeOrganization: StoredAuthSession["activeOrganization"];
  membership: StoredAuthSession["membership"];
};

export type CurrentOrganizationResponse = {
  id: string;
  name: string;
  slug: string;
  isInternal: boolean;
  status: string;
  isActive?: boolean;
  currentMembership: {
    id: string;
    role: MembershipRole;
    status: string;
  };
};

export type OrganizationWorkspace = CurrentOrganizationResponse;

export type OrganizationListResponse = {
  data: OrganizationWorkspace[];
};
