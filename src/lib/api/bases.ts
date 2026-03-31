/**
 * Resolve API bases from Expo public env. Single v1 base; content base explicit or derived from v1.
 */

type RuntimeImageAuthGlobal = typeof globalThis & {
  __SJC_MOBILE_IMAGE_TOKEN__?: string | null;
};

function trimSlash(s: string): string {
  return s.replace(/\/$/, '');
}

function normalizeNativeHost(url: string): string {
  return url.replace('://localhost', '://127.0.0.1');
}

function getRuntimeImageToken(): string | null {
  return (globalThis as RuntimeImageAuthGlobal).__SJC_MOBILE_IMAGE_TOKEN__ ?? null;
}

function attachMobileImageToken(url: string): string {
  const token = getRuntimeImageToken();
  if (!token) return url;

  try {
    const parsed = new URL(url);
    if (parsed.pathname === '/api/img' && !parsed.searchParams.get('mt')) {
      parsed.searchParams.set('mt', token);
      return parsed.toString();
    }
  } catch {
    return url;
  }

  return url;
}

/** `EXPO_PUBLIC_API_BASE_URL` must end with `/api/v1` (e.g. `https://host/api/v1`). */
export function getV1ApiBase(): string {
  const b = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!b?.trim()) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required');
  }
  return trimSlash(b.trim());
}

/**
 * Content routes live under `/api`, not `/api/v1`.
 * Set `EXPO_PUBLIC_API_CONTENT_BASE_URL` (e.g. `https://host/api`) or derive by stripping `/v1` from the v1 base.
 */
export function getContentApiBase(): string {
  const explicit = process.env.EXPO_PUBLIC_API_CONTENT_BASE_URL?.trim();
  if (explicit) {
    return trimSlash(explicit);
  }
  const v1 = getV1ApiBase();
  return deriveContentBaseFromV1Base(v1);
}

/** `https://x.com/api/v1` → `https://x.com/api` */
export function deriveContentBaseFromV1Base(v1Base: string): string {
  const t = trimSlash(v1Base);
  if (t.endsWith('/api/v1')) {
    return t.slice(0, -'/v1'.length);
  }
  if (/\/v1$/i.test(t)) {
    return t.replace(/\/v1$/i, '');
  }
  throw new Error(
    'Could not derive content base from EXPO_PUBLIC_API_BASE_URL; set EXPO_PUBLIC_API_CONTENT_BASE_URL',
  );
}

/** `https://x.com/api` → `https://x.com` */
export function getSiteBase(): string {
  const contentBase = getContentApiBase();
  const base = contentBase.endsWith('/api') ? contentBase.slice(0, -4) : contentBase;
  return normalizeNativeHost(base);
}

export function joinBasePath(base: string, path: string): string {
  const b = trimSlash(base);
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

export function resolveBackendUrl(url?: string | null): string | null {
  if (!url) return null;
  const resolved = /^https?:\/\//i.test(url)
    ? normalizeNativeHost(url)
    : joinBasePath(getSiteBase(), url);
  return attachMobileImageToken(resolved);
}
