import { getContentApiBase, getV1ApiBase, joinBasePath } from '@/lib/api/bases';
import { ApiError } from '@/lib/api/errors';
import { parseSuccessData } from '@/lib/api/envelope';

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(res.status, 'Invalid JSON response', text);
  }
}

/**
 * v1 routes (`/api/v1` base): response body is `{ success, data }` on success.
 */
export async function requestV1Json<T>(path: string, init?: RequestInit): Promise<T> {
  const url = joinBasePath(getV1ApiBase(), path);
  const res = await fetch(url, init);
  const json = await readJson(res);
  if (!res.ok) {
    const msg =
      json &&
      typeof json === 'object' &&
      json !== null &&
      'error' in json &&
      typeof (json as { error?: { message?: string } }).error?.message === 'string'
        ? (json as { error: { message: string } }).error.message
        : res.statusText;
    throw new ApiError(res.status, msg, json);
  }
  return parseSuccessData<T>(json);
}

/**
 * Content routes (`/api` base): raw JSON, no envelope.
 */
export async function requestContentJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = joinBasePath(getContentApiBase(), path);
  const res = await fetch(url, init);
  const json = await readJson(res);
  if (!res.ok) {
    const msg =
      typeof json === 'object' &&
      json !== null &&
      'message' in json &&
      typeof (json as { message?: unknown }).message === 'string'
        ? (json as { message: string }).message
        : res.statusText;
    throw new ApiError(res.status, msg, json);
  }
  return json as T;
}
