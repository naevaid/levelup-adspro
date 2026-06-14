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
  StoredAuthSession,
} from "./types";

type AuthContextValue = {
  isReady: boolean;
  session: StoredAuthSession | null;
  profile: MeResponse | null;
  currentOrganization: CurrentOrganizationResponse | null;
  isRefreshingProfile: boolean;
  profileError: string | null;
  saveSession: (session: StoredAuthSession) => void;
  clearSession: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [session, setSession] = useState<StoredAuthSession | null>(null);
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [currentOrganization, setCurrentOrganization] =
    useState<CurrentOrganizationResponse | null>(null);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
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
    setProfileError(null);
  }, []);

  const saveSession = useCallback((nextSession: StoredAuthSession) => {
    writeStoredSession(nextSession);
    setSession(nextSession);
    setProfile(null);
    setCurrentOrganization(null);
    setProfileError(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session) {
      return;
    }

    setIsRefreshingProfile(true);
    setProfileError(null);

    try {
      const authorization = `${session.tokenType} ${session.accessToken}`;
      const [me, organization] = await Promise.all([
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
      ]);

      setProfile(me);
      setCurrentOrganization(organization);
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
  }, [clearSessionState, session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshProfile();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refreshProfile, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isReady,
      session,
      profile,
      currentOrganization,
      isRefreshingProfile,
      profileError,
      saveSession,
      clearSession: clearSessionState,
      refreshProfile,
    }),
    [
      currentOrganization,
      clearSessionState,
      isReady,
      isRefreshingProfile,
      profile,
      profileError,
      refreshProfile,
      session,
      saveSession,
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
