export type MembershipRole = "OWNER" | "MANAGER" | "STAFF" | "AGENCY_ADMIN";

export type StoredAuthSession = {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    status: string;
  };
  activeOrganization: {
    id: string;
    name: string;
    slug: string;
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
  status: string;
  currentMembership: {
    id: string;
    role: MembershipRole;
    status: string;
  };
};
