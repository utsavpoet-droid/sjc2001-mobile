import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { router, type Href } from 'expo-router';

import { registerPushToken, unregisterPushToken } from '@/features/notifications/api';

const PUSH_TOKEN_KEY = 'sjc_expo_push_token';

type PushPayload = {
  url?: string;
  entityType?: string;
  entityId?: number | string;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function getProjectId(): string | null {
  const easProjectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    (Constants as typeof Constants & { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return easProjectId ?? null;
}

function getStoredPushToken() {
  return SecureStore.getItemAsync(PUSH_TOKEN_KEY);
}

async function setStoredPushToken(token: string | null) {
  if (token) {
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
    return;
  }
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
}

function routeForNotificationData(data: PushPayload): Href | null {
  const rawUrl = typeof data.url === 'string' ? data.url : null;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      const path = parsed.pathname.replace(/^\/+/, '');
      const segments = path.split('/').filter(Boolean);
      const [entity, id] = segments;
      if (entity === 'stories' && id) return `/(member)/stories/${id}` as Href;
      if (entity === 'gallery' && id) return `/(member)/gallery/${id}` as Href;
      if (entity === 'polls') return '/(member)/polls/index' as Href;
      if ((entity === 'directory' || entity === 'members') && id) return `/(member)/members/${id}` as Href;
    } catch {
      // Fall through to entityType/entityId mapping.
    }
  }

  const entityType = data.entityType;
  const entityId = data.entityId != null ? String(data.entityId) : null;
  if (entityType === 'story' && entityId) return `/(member)/stories/${entityId}` as Href;
  if (entityType === 'gallery_album' && entityId) return `/(member)/gallery/${entityId}` as Href;
  if (entityType === 'member' && entityId) return `/(member)/members/${entityId}` as Href;
  if (entityType === 'poll') return '/(member)/polls/index' as Href;

  return null;
}

export async function prepareNotificationRuntime() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#C96A4A',
        sound: 'default',
      });
    }
  } catch {
    // Push setup is best-effort and must never block app launch.
  }
}

export async function registerDeviceForPush(accessToken: string) {
  try {
    if (!Device.isDevice) {
      return { registered: false, reason: 'simulator' as const };
    }

    const projectId = getProjectId();
    if (!projectId) {
      return { registered: false, reason: 'missing-project-id' as const };
    }

    const existing = await Notifications.getPermissionsAsync();
    const status = existing.status;

    if (status !== 'granted') {
      return { registered: false, reason: 'permission-denied' as const };
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const storedToken = await getStoredPushToken();

    if (!storedToken || storedToken !== token) {
      if (storedToken) {
        try {
          await unregisterPushToken(accessToken, { expoPushToken: storedToken });
        } catch {
          // Best effort cleanup; continue with the fresh token registration.
        }
      }
      await registerPushToken(accessToken, {
        expoPushToken: token,
        platform: Platform.OS,
        deviceName: Device.deviceName ?? Platform.OS,
      });
      await setStoredPushToken(token);
    }

    return { registered: true, token };
  } catch {
    return { registered: false, reason: 'registration-failed' as const };
  }
}

export async function requestPushPermissions() {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') {
      return { granted: true as const, canAskAgain: existing.canAskAgain };
    }

    const requested = await Notifications.requestPermissionsAsync();
    return {
      granted: requested.status === 'granted',
      canAskAgain: requested.canAskAgain,
    };
  } catch {
    return { granted: false as const, canAskAgain: false };
  }
}

export async function unregisterDeviceForPush(accessToken: string | null) {
  const token = await getStoredPushToken();
  if (!token) return;

  try {
    if (accessToken) {
      await unregisterPushToken(accessToken, { expoPushToken: token });
    }
  } finally {
    await setStoredPushToken(null);
  }
}

export function subscribeToNotificationResponses() {
  try {
    return Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data ?? {}) as PushPayload;
      const href = routeForNotificationData(data);
      if (href) {
        router.push(href);
      }
    });
  } catch {
    return { remove() {} };
  }
}
