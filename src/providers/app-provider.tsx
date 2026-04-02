import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { AppState, InteractionManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useAuthStore } from '@/features/auth/store/auth-store';
import { prepareNotificationRuntime, registerDeviceForPush, subscribeToNotificationResponses } from '@/lib/notifications/push';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnReconnect: true,
    },
  },
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((state) => state.hydrate);
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);
  const user = useAuthStore((state) => state.user);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hydrate().finally(() => setReady(true));
  }, [hydrate]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void prepareNotificationRuntime().catch(() => {
        // Push setup is best-effort and must never block app startup.
      });
    });
    const sub = subscribeToNotificationResponses();
    return () => {
      task.cancel();
      sub.remove();
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void getValidAccessToken();
      }
    });
    return () => sub.remove();
  }, [getValidAccessToken]);

  useEffect(() => {
    if (!ready || !user) return;

    let cancelled = false;
    void (async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (cancelled) return;
        const token = await getValidAccessToken();
        if (!token || cancelled) return;
        await registerDeviceForPush(token);
      } catch {
        // Push registration is best-effort and must never block signed-in app use.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getValidAccessToken, ready, user]);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </GestureHandlerRootView>
  );
}
