"use client";

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from "./storage";
import type {
  CurrentOrganizationResponse,
  MeResponse,
  OrganizationListResponse,
  OrganizationWorkspace,
  StoredAuthSession,
} from "./types";

type AuthContextValue = {
  isReady: boolean;
  session: StoredAuthSession | null;
  profile: MeResponse | null;
  currentOrganization: CurrentOrganizationResponse | null;
  organizations: OrganizationWorkspace[];
  isRefreshingProfile: boolean;
  isSwitchingOrganization: boolean;
  profileError: string | null;
  saveSession: (session: StoredAuthSession) => void;
  clearSession: () => void;
  refreshProfile: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [session, setSession] = useState<StoredAuthSession | null>(null);
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [currentOrganization, setCurrentOrganization] =
    useState<CurrentOrganizationResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationWorkspace[]>([]);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [isSwitchingOrganization, setIsSwitchingOrganization] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedSession = readStoredSession();
      if (!storedSession) {
        setIsReady(true);
        return;
      }

      const isExpired =
        new Date(storedSession.expiresAt).getTime() <= Date.now();
      if (isExpired) {
        clearStoredSession();
        setIsReady(true);
        return;
      }

      setSession(storedSession);
      setIsReady(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const clearSessionState = useCallback(() => {
    clearStoredSession();
    setSession(null);
    setProfile(null);
    setCurrentOrganization(null);
    setOrganizations([]);
    setProfileError(null);
  }, []);

  const saveSession = useCallback((nextSession: StoredAuthSession) => {
    writeStoredSession(nextSession);
    setSession(nextSession);
    setProfile(null);
    setCurrentOrganization(null);
    setOrganizations([]);
    setProfileError(null);
  }, []);

  const syncSessionFromProfile = useCallback(
    (me: MeResponse) => {
      setSession((currentSession) => {
        if (!currentSession) {
          return currentSession;
        }

        const sessionAlreadySynced =
          currentSession.user.id === me.user.id &&
          currentSession.user.email === me.user.email &&
          currentSession.user.name === me.user.name &&
          currentSession.user.status === me.user.status &&
          currentSession.user.internalRole === me.user.internalRole &&
          currentSession.activeOrganization.id === me.activeOrganization.id &&
          currentSession.activeOrganization.name === me.activeOrganization.name &&
          currentSession.activeOrganization.slug === me.activeOrganization.slug &&
          currentSession.activeOrganization.status === me.activeOrganization.status &&
          currentSession.membership.id === me.membership.id &&
          currentSession.membership.role === me.membership.role &&
          currentSession.membership.status === me.membership.status;

        if (sessionAlreadySynced) {
          return currentSession;
        }

        const nextSession: StoredAuthSession = {
          ...currentSession,
          user: me.user,
          activeOrganization: me.activeOrganization,
          membership: me.membership,
        };

        writeStoredSession(nextSession);
        return nextSession;
      });
    },
    [],
  );

  const authorization = session
    ? `${session.tokenType} ${session.accessToken}`
    : null;

  const refreshProfile = useCallback(async () => {
    if (!authorization) {
      return;
    }

    setIsRefreshingProfile(true);
    setProfileError(null);

    try {
      const [me, organization, workspaces] = await Promise.all([
        apiFetch<MeResponse>("/api/v1/me", {
          headers: {
            Authorization: authorization,
          },
        }),
        apiFetch<CurrentOrganizationResponse>("/api/v1/organizations/current", {
          headers: {
            Authorization: authorization,
          },
        }),
        apiFetch<OrganizationListResponse>("/api/v1/organizations", {
          headers: {
            Authorization: authorization,
          },
        }),
      ]);

      syncSessionFromProfile(me);
      setProfile(me);
      setCurrentOrganization(organization);
      setOrganizations(workspaces.data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal memuat profil user.";
      setProfileError(message);

      if (
        message.toLowerCase().includes("session") ||
        message.toLowerCase().includes("unauthorized") ||
        message.toLowerCase().includes("401")
      ) {
        clearSessionState();
      }
    } finally {
      setIsRefreshingProfile(false);
    }
  }, [authorization, clearSessionState, syncSessionFromProfile]);

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      if (!session || !authorization) {
        return;
      }

      if (session.activeOrganization.id === organizationId) {
        return;
      }

      setIsSwitchingOrganization(true);
      setProfileError(null);

      try {
        await apiFetch("/api/v1/organizations/switch", {
          method: "POST",
          headers: {
            Authorization: authorization,
          },
          body: JSON.stringify({
            organizationId,
          }),
        });

        await refreshProfile();
      } finally {
        setIsSwitchingOrganization(false);
      }
    },
    [authorization, refreshProfile, session],
  );

  useEffect(() => {
    if (!authorization) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshProfile();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [authorization, refreshProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isReady,
      session,
      profile,
      currentOrganization,
      organizations,
      isRefreshingProfile,
      isSwitchingOrganization,
      profileError,
      saveSession,
      clearSession: clearSessionState,
      refreshProfile,
      switchOrganization,
    }),
    [
      organizations,
      currentOrganization,
      clearSessionState,
      isReady,
      isRefreshingProfile,
      isSwitchingOrganization,
      profile,
      profileError,
      refreshProfile,
      session,
      saveSession,
      switchOrganization,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth harus dipakai di dalam AuthProvider.");
  }

  return context;
}
