/**
 * Types matching backend JSON (camelCase). Auth/push responses use `{ success, data }` envelope.
 */

export type MobileLoginRequest = {
  identifier: string;
  password: string;
  totpCode?: string;
  deviceName?: string;
  platform?: string;
};

export type MobileUser = {
  id: number;
  role: string;
  memberId: number;
  name: string;
  avatarUrl: string | null;
  totpEnabled?: boolean;
};

export type MobileLoginSuccessData = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: MobileUser;
};

export type MobileTotpChallengeData = {
  totpRequired: true;
};

export type MobileLoginResponseData = MobileLoginSuccessData | MobileTotpChallengeData;

export function isTotpChallengeData(
  d: MobileLoginResponseData,
): d is MobileTotpChallengeData {
  return 'totpRequired' in d && d.totpRequired === true;
}

export type MobileRefreshRequest = {
  refreshToken: string;
};

export type MobileRefreshResponseData = MobileLoginSuccessData;

export type MobileLogoutRequest = {
  refreshToken: string;
};

export type MobileMeUser = {
  id: number;
  role: string;
  memberId: number;
  name: string;
  avatarUrl: string | null;
  totpEnabled?: boolean;
};

export type PushRegisterRequest = {
  expoPushToken: string;
  platform: 'ios' | 'android' | string;
  deviceName?: string;
};

export type PushUnregisterRequest = {
  expoPushToken: string;
};
