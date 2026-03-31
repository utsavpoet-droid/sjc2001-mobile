import { requestV1Json } from '@/lib/api/client';

import { API_PUSH_REGISTER, API_PUSH_UNREGISTER } from '@shared/contracts/api-routes';
import type { PushRegisterRequest, PushUnregisterRequest } from '@shared/auth/mobile-contract';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

function bearerHeaders(accessToken: string): HeadersInit {
  return {
    ...JSON_HEADERS,
    Authorization: `Bearer ${accessToken}`,
  };
}

/** Register device — send `expoPushToken` (canonical), not legacy `token` only. */
export async function registerPushDevice(
  accessToken: string,
  body: PushRegisterRequest,
): Promise<{ registered: boolean }> {
  return requestV1Json<{ registered: boolean }>(API_PUSH_REGISTER, {
    method: 'POST',
    headers: bearerHeaders(accessToken),
    body: JSON.stringify(body),
  });
}

export async function unregisterPushDevice(
  accessToken: string,
  body: PushUnregisterRequest,
): Promise<{ unregistered: boolean }> {
  return requestV1Json<{ unregistered: boolean }>(API_PUSH_UNREGISTER, {
    method: 'POST',
    headers: bearerHeaders(accessToken),
    body: JSON.stringify(body),
  });
}
