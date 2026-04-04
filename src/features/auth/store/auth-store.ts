import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { postMobileLogin, postMobileLogout, postMobileRefresh } from '@/features/auth/api/auth-api';
import { getBiometricInfo, promptBiometric } from '@/lib/auth/biometrics';
import { ApiError } from '@/lib/api/errors';
import { unregisterDeviceForPush } from '@/lib/notifications/push';

import {
  isTotpChallengeData,
  type MobileLoginRequest,
  type MobileMeUser,
} from '@shared/auth/mobile-contract';

const REFRESH_TOKEN_KEY = 'sjc_refresh_token';
const ACCESS_TOKEN_KEY = 'sjc_access_token';
const EXPIRES_AT_KEY = 'sjc_expires_at';
const USER_KEY = 'sjc_user';
const BIOMETRIC_ENABLED_KEY = 'sjc_biometric_enabled';

type LoginResult =
  | { kind: 'totp_required' }
  | { kind: 'signed_in' };

type PendingTotpChallenge = {
  identifier: string;
  password: string;
  deviceName?: string;
  platform?: string;
};

type AuthState = {
  hydrated: boolean;
  busy: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: MobileMeUser | null;
  expiresAt: number | null;
  errorMessage: string | null;
  biometricEnabled: boolean;
  biometricLabel: string | null;
  pendingTotpChallenge: PendingTotpChallenge | null;
  hydrate: () => Promise<void>;
  signIn: (input: MobileLoginRequest) => Promise<LoginResult>;
  completeTotpSignIn: (totpCode: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  getValidAccessToken: () => Promise<string | null>;
  refreshSession: () => Promise<string | null>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  unlockWithBiometrics: () => Promise<string | null>;
  clearError: () => void;
  clearPendingTotpChallenge: () => void;
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

async function readAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

async function readExpiresAt() {
  const raw = await SecureStore.getItemAsync(EXPIRES_AT_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

async function readUser() {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MobileMeUser;
  } catch {
    return null;
  }
}

async function writeRefreshToken(refreshToken: string | null) {
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    return;
  }
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

async function writeSessionCache(input: {
  accessToken: string | null;
  expiresAt: number | null;
  user: MobileMeUser | null;
}) {
  if (input.accessToken) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, input.accessToken);
  } else {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  }

  if (input.expiresAt) {
    await SecureStore.setItemAsync(EXPIRES_AT_KEY, String(input.expiresAt));
  } else {
    await SecureStore.deleteItemAsync(EXPIRES_AT_KEY);
  }

  if (input.user) {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(input.user));
  } else {
    await SecureStore.deleteItemAsync(USER_KEY);
  }
}

async function readBiometricEnabled() {
  return (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)) === 'true';
}

async function writeBiometricEnabled(enabled: boolean) {
  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
    return;
  }
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
}

function isAuthFailure(error: unknown) {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

async function persistSignedInSession(result: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: MobileMeUser;
}) {
  await writeRefreshToken(result.refreshToken);
  const expiresAt = Date.now() + result.expiresIn * 1000;
  await writeSessionCache({
    accessToken: result.accessToken,
    expiresAt,
    user: result.user,
  });
  setRuntimeAccessToken(result.accessToken);
  return expiresAt;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  busy: false,
  accessToken: null,
  refreshToken: null,
  user: null,
  expiresAt: null,
  errorMessage: null,
  biometricEnabled: false,
  biometricLabel: null,
  pendingTotpChallenge: null,

  clearError: () => set({ errorMessage: null }),
  clearPendingTotpChallenge: () => set({ pendingTotpChallenge: null }),

  hydrate: async () => {
    if (get().hydrated || get().busy) return;

    set({ busy: true, errorMessage: null });
    try {
      const [refreshToken, cachedAccessToken, cachedExpiresAt, cachedUser, biometricEnabled, biometricInfo] = await Promise.all([
        readRefreshToken(),
        readAccessToken(),
        readExpiresAt(),
        readUser(),
        readBiometricEnabled(),
        getBiometricInfo(),
      ]);

      const sessionState = {
        biometricEnabled: biometricEnabled && biometricInfo.available,
        biometricLabel: biometricInfo.available ? biometricInfo.label : null,
      };

      if (cachedAccessToken && cachedExpiresAt && cachedUser && Date.now() < cachedExpiresAt - 15_000) {
        setRuntimeAccessToken(cachedAccessToken);
        set({
          ...sessionState,
          hydrated: true,
          busy: false,
          accessToken: cachedAccessToken,
          refreshToken,
          user: cachedUser,
          expiresAt: cachedExpiresAt,
        });
        return;
      }

      if (!refreshToken) {
        setRuntimeAccessToken(null);
        set({
          ...sessionState,
          hydrated: true,
          busy: false,
          accessToken: null,
          refreshToken: null,
          user: null,
          expiresAt: null,
          pendingTotpChallenge: null,
        });
        return;
      }

      const refreshed = await postMobileRefresh({ refreshToken });
      await writeRefreshToken(refreshed.refreshToken);
      await writeSessionCache({
        accessToken: refreshed.accessToken,
        expiresAt: Date.now() + refreshed.expiresIn * 1000,
        user: refreshed.user,
      });
      setRuntimeAccessToken(refreshed.accessToken);

        set({
          ...sessionState,
          hydrated: true,
          busy: false,
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          expiresAt: Date.now() + refreshed.expiresIn * 1000,
          user: refreshed.user,
          pendingTotpChallenge: null,
        });
    } catch (error) {
      const [refreshToken, cachedAccessToken, cachedExpiresAt, cachedUser, biometricEnabled, biometricInfo] = await Promise.all([
        readRefreshToken(),
        readAccessToken(),
        readExpiresAt(),
        readUser(),
        readBiometricEnabled(),
        getBiometricInfo(),
      ]);
      const sessionState = {
        biometricEnabled: biometricEnabled && biometricInfo.available,
        biometricLabel: biometricInfo.available ? biometricInfo.label : null,
      };

      if (isAuthFailure(error)) {
        await writeRefreshToken(null);
        await writeSessionCache({ accessToken: null, expiresAt: null, user: null });
        setRuntimeAccessToken(null);
        set({
          ...sessionState,
          hydrated: true,
          busy: false,
          accessToken: null,
          refreshToken: null,
          user: null,
          expiresAt: null,
          pendingTotpChallenge: null,
          errorMessage: error instanceof Error ? error.message : 'Session restore failed',
        });
        return;
      }

      set({
        ...sessionState,
        hydrated: true,
        busy: false,
        accessToken: cachedAccessToken,
        refreshToken,
        user: cachedUser,
        expiresAt: cachedExpiresAt,
        errorMessage: error instanceof Error ? error.message : 'Session restore failed',
      });
    }
  },

  signIn: async (input) => {
    set({ busy: true, errorMessage: null });
    try {
      const result = await postMobileLogin(input);
      if (isTotpChallengeData(result)) {
        set({
          busy: false,
          pendingTotpChallenge: {
            identifier: input.identifier,
            password: input.password,
            deviceName: input.deviceName,
            platform: input.platform,
          },
        });
        return { kind: 'totp_required' };
      }

      const expiresAt = await persistSignedInSession(result);
      set({
        busy: false,
        hydrated: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt,
        user: result.user,
        pendingTotpChallenge: null,
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

  completeTotpSignIn: async (totpCode) => {
    const challenge = get().pendingTotpChallenge;
    if (!challenge) {
      set({ errorMessage: 'Your sign-in session expired. Please enter your password again.' });
      throw new Error('No pending TOTP challenge');
    }

    set({ busy: true, errorMessage: null });
    try {
      const result = await postMobileLogin({
        ...challenge,
        totpCode: totpCode.trim(),
      });

      if (isTotpChallengeData(result)) {
        set({
          busy: false,
          errorMessage: 'Invalid verification code. Please try again.',
        });
        return { kind: 'totp_required' };
      }

      const expiresAt = await persistSignedInSession(result);
      set({
        busy: false,
        hydrated: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt,
        user: result.user,
        pendingTotpChallenge: null,
      });
      return { kind: 'signed_in' };
    } catch (error) {
      set({
        busy: false,
        errorMessage:
          error instanceof ApiError ? error.message : 'Unable to verify your code right now',
      });
      throw error;
    }
  },

  logout: async () => {
    const { refreshToken, accessToken } = get();
    set({ busy: true, errorMessage: null });
    try {
      await unregisterDeviceForPush(accessToken);
      if (refreshToken) {
        await postMobileLogout({ refreshToken });
      }
    } catch {
      // Best effort logout: always clear local state.
    } finally {
      await writeRefreshToken(null);
      await writeSessionCache({ accessToken: null, expiresAt: null, user: null });
      setRuntimeAccessToken(null);
      set({
        busy: false,
        hydrated: true,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        user: null,
        pendingTotpChallenge: null,
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
        pendingTotpChallenge: null,
      });
      return null;
    }

    try {
      const refreshed = await postMobileRefresh({ refreshToken });
      await writeRefreshToken(refreshed.refreshToken);
      const expiresAt = Date.now() + refreshed.expiresIn * 1000;
      await writeSessionCache({
        accessToken: refreshed.accessToken,
        expiresAt,
        user: refreshed.user,
      });
      setRuntimeAccessToken(refreshed.accessToken);

      set({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt,
        user: refreshed.user,
      });
      return refreshed.accessToken;
    } catch (error) {
      if (isAuthFailure(error)) {
        await writeRefreshToken(null);
        await writeSessionCache({ accessToken: null, expiresAt: null, user: null });
        setRuntimeAccessToken(null);
        set({
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          user: null,
          pendingTotpChallenge: null,
        });
        return null;
      }

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

  setBiometricEnabled: async (enabled) => {
    const info = await getBiometricInfo();
    const nextEnabled = enabled && info.available;
    await writeBiometricEnabled(nextEnabled);
    set({
      biometricEnabled: nextEnabled,
      biometricLabel: info.available ? info.label : null,
    });
  },

  unlockWithBiometrics: async () => {
    const [refreshToken, accessToken, expiresAt, user] = await Promise.all([
      readRefreshToken(),
      readAccessToken(),
      readExpiresAt(),
      readUser(),
    ]);
    const { biometricEnabled, biometricLabel } = get();

    if (!biometricEnabled || (!refreshToken && !accessToken)) {
      return null;
    }

    set({ busy: true, errorMessage: null });
    try {
      const ok = await promptBiometric(biometricLabel ?? undefined);
      if (!ok) {
        set({ busy: false });
        return null;
      }

      if (accessToken && expiresAt && user && Date.now() < expiresAt - 15_000) {
        setRuntimeAccessToken(accessToken);
        set({
          hydrated: true,
          busy: false,
          accessToken,
          refreshToken,
          user,
          expiresAt,
        });
        return accessToken;
      }

      const refreshed = await get().refreshSession();
      set({ busy: false });
      return refreshed;
    } catch (error) {
      set({
        busy: false,
        errorMessage: error instanceof Error ? error.message : 'Unable to unlock session',
      });
      return null;
    }
  },
}));
