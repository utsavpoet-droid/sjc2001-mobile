import { requestV1Json } from '@/lib/api/client';

import {
  API_AUTH_MOBILE_LOGIN,
  API_AUTH_MOBILE_LOGOUT,
  API_AUTH_MOBILE_ME,
  API_AUTH_MOBILE_REFRESH,
} from '@shared/contracts/api-routes';
import type {
  MobileLoginRequest,
  MobileLoginResponseData,
  MobileLogoutRequest,
  MobileMeUser,
  MobileRefreshRequest,
  MobileRefreshResponseData,
} from '@shared/auth/mobile-contract';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

function bearerHeaders(accessToken: string): HeadersInit {
  return {
    ...JSON_HEADERS,
    Authorization: `Bearer ${accessToken}`,
  };
}

function bearerOnly(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

/** Login — send `identifier` (not legacy email/username fields). */
export async function postMobileLogin(
  body: MobileLoginRequest,
): Promise<MobileLoginResponseData> {
  return requestV1Json<MobileLoginResponseData>(API_AUTH_MOBILE_LOGIN, {
    method: 'POST',
    headers: { ...JSON_HEADERS },
    body: JSON.stringify(body),
  });
}

/** Refresh — body `{ refreshToken }` only (not `refresh_token`). */
export async function postMobileRefresh(
  body: MobileRefreshRequest,
): Promise<MobileRefreshResponseData> {
  return requestV1Json<MobileRefreshResponseData>(API_AUTH_MOBILE_REFRESH, {
    method: 'POST',
    headers: { ...JSON_HEADERS },
    body: JSON.stringify(body),
  });
}

/** Logout — body `{ refreshToken }`. */
export async function postMobileLogout(body: MobileLogoutRequest): Promise<void> {
  await requestV1Json<{ loggedOut: boolean }>(API_AUTH_MOBILE_LOGOUT, {
    method: 'POST',
    headers: { ...JSON_HEADERS },
    body: JSON.stringify(body),
  });
}

/** Current user — **access** token in `Authorization: Bearer`, not refresh. */
export async function getMobileMe(accessToken: string): Promise<MobileMeUser> {
  return requestV1Json<MobileMeUser>(API_AUTH_MOBILE_ME, {
    method: 'GET',
    headers: bearerOnly(accessToken),
  });
}
