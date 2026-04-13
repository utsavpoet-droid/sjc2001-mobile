import { getContentApiBase, joinBasePath } from '@/lib/api/bases';
import { useAuthStore } from '@/features/auth/store/auth-store';

type ErrorPayload = {
  message: string;
  stack?: string | null;
  source?: string;
  platform?: string;
  routePath?: string | null;
  screen?: string | null;
  component?: string | null;
  metadata?: unknown;
  level?: string;
};

export async function reportMobileError(payload: ErrorPayload) {
  try {
    const token = useAuthStore.getState().accessToken;
    await fetch(joinBasePath(getContentApiBase(), '/error-logs'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        level: payload.level || 'error',
        source: payload.source || 'mobile-client',
        platform: payload.platform || 'mobile',
        message: payload.message,
        stack: payload.stack || null,
        routePath: payload.routePath || null,
        screen: payload.screen || null,
        component: payload.component || null,
        metadata: payload.metadata,
      }),
    });
  } catch {
    // Logging must stay non-blocking.
  }
}
