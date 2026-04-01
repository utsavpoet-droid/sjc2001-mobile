import { requestV1Json } from '@/lib/api/client';

import { API_PUSH_REGISTER, API_PUSH_UNREGISTER } from '@shared/contracts/api-routes';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

function bearerHeaders(accessToken: string): HeadersInit {
  return {
    ...JSON_HEADERS,
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function registerPushToken(
  accessToken: string,
  body: { expoPushToken: string; platform: string; deviceName?: string },
): Promise<void> {
  await requestV1Json<{ registered: boolean }>(API_PUSH_REGISTER, {
    method: 'POST',
    headers: bearerHeaders(accessToken),
    body: JSON.stringify(body),
  });
}

export async function unregisterPushToken(
  accessToken: string,
  body: { expoPushToken: string },
): Promise<void> {
  await requestV1Json<{ unregistered: boolean }>(API_PUSH_UNREGISTER, {
    method: 'POST',
    headers: bearerHeaders(accessToken),
    body: JSON.stringify(body),
  });
}
