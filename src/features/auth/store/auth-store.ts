import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { postMobileLogin, postMobileLogout, postMobileRefresh } from '@/features/auth/api/auth-api';
import { ApiError } from '@/lib/api/errors';

import {
  isTotpChallengeData,
  type MobileLoginRequest,
  type MobileMeUser,
} from '@shared/auth/mobile-contract';

const REFRESH_TOKEN_KEY = 'sjc_refresh_token';

type LoginResult =
  | { kind: 'totp_required' }
  | { kind: 'signed_in' };

type AuthState = {
  hydrated: boolean;
  busy: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: MobileMeUser | null;
  expiresAt: number | null;
  errorMessage: string | null;
  hydrate: () => Promise<void>;
  signIn: (input: MobileLoginRequest) => Promise<LoginResult>;
  logout: () => Promise<void>;
  getValidAccessToken: () => Promise<string | null>;
  refreshSession: () => Promise<string | null>;
  clearError: () => void;
};

type RuntimeImageAuthGlobal = typeof globalThis & {
  __SJC_MOBILE_IMAGE_TOKEN__?: string | null;
};

function setRuntimeAccessToken(accessToken: string | null) {
  (globalThis as RuntimeImageAuthGlobal).__SJC_MOBILE_IMAGE_TOKEN__ = accessToken;
}

async function readRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

async function writeRefreshToken(refreshToken: string | null) {
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    return;
  }
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  busy: false,
  accessToken: null,
  refreshToken: null,
  user: null,
  expiresAt: null,
  errorMessage: null,

  clearError: () => set({ errorMessage: null }),

  hydrate: async () => {
    if (get().hydrated || get().busy) return;

    set({ busy: true, errorMessage: null });
    try {
      const refreshToken = await readRefreshToken();
      if (!refreshToken) {
        setRuntimeAccessToken(null);
        set({
          hydrated: true,
          busy: false,
          accessToken: null,
          refreshToken: null,
          user: null,
          expiresAt: null,
        });
        return;
      }

      const refreshed = await postMobileRefresh({ refreshToken });
      await writeRefreshToken(refreshed.refreshToken);
      setRuntimeAccessToken(refreshed.accessToken);

      set({
        hydrated: true,
        busy: false,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: Date.now() + refreshed.expiresIn * 1000,
        user: refreshed.user,
      });
    } catch (error) {
      await writeRefreshToken(null);
      setRuntimeAccessToken(null);
      set({
        hydrated: true,
        busy: false,
        accessToken: null,
        refreshToken: null,
        user: null,
        expiresAt: null,
        errorMessage: error instanceof Error ? error.message : 'Session restore failed',
      });
    }
  },

  signIn: async (input) => {
    set({ busy: true, errorMessage: null });
    try {
      const result = await postMobileLogin(input);
      if (isTotpChallengeData(result)) {
        set({ busy: false });
        return { kind: 'totp_required' };
      }

      await writeRefreshToken(result.refreshToken);
      setRuntimeAccessToken(result.accessToken);
      set({
        busy: false,
        hydrated: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: Date.now() + result.expiresIn * 1000,
        user: result.user,
      });
      return { kind: 'signed_in' };
    } catch (error) {
      set({
        busy: false,
        errorMessage:
          error instanceof ApiError ? error.message : 'Unable to sign in right now',
      });
      throw error;
    }
  },

  logout: async () => {
    const { refreshToken } = get();
    set({ busy: true, errorMessage: null });
    try {
      if (refreshToken) {
        await postMobileLogout({ refreshToken });
      }
    } catch {
      // Best effort logout: always clear local state.
    } finally {
      await writeRefreshToken(null);
      setRuntimeAccessToken(null);
      set({
        busy: false,
        hydrated: true,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        user: null,
      });
    }
  },

  refreshSession: async () => {
    const refreshToken = get().refreshToken ?? (await readRefreshToken());
    if (!refreshToken) {
      setRuntimeAccessToken(null);
      set({
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        user: null,
      });
      return null;
    }

    try {
      const refreshed = await postMobileRefresh({ refreshToken });
      await writeRefreshToken(refreshed.refreshToken);
      setRuntimeAccessToken(refreshed.accessToken);

      set({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: Date.now() + refreshed.expiresIn * 1000,
        user: refreshed.user,
      });
      return refreshed.accessToken;
    } catch {
      await writeRefreshToken(null);
      setRuntimeAccessToken(null);
      set({
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        user: null,
      });
      return null;
    }
  },

  getValidAccessToken: async () => {
    const { accessToken, expiresAt } = get();
    if (accessToken && expiresAt && Date.now() < expiresAt - 60_000) {
      setRuntimeAccessToken(accessToken);
      return accessToken;
    }

    const refreshed = await get().refreshSession();
    setRuntimeAccessToken(refreshed);
    return refreshed;
  },
}));
