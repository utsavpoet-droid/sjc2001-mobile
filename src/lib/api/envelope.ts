/**
 * Auth/push JSON uses `{ success, data }`. Content routes are raw JSON (no envelope).
 */

export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string } | unknown;
};

export function parseSuccessData<T>(json: unknown): T {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid JSON response');
  }
  const o = json as ApiEnvelope<T>;
  if (o.success === false) {
    const msg =
      o.error &&
      typeof o.error === 'object' &&
      o.error !== null &&
      'message' in o.error &&
      typeof (o.error as { message?: unknown }).message === 'string'
        ? (o.error as { message: string }).message
        : 'Request failed';
    throw new Error(msg);
  }
  if (o.success !== true || o.data === undefined) {
    throw new Error('Invalid success envelope');
  }
  return o.data;
}
