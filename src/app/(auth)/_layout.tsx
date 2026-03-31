import { Redirect, Stack, type Href } from 'expo-router';

import { useAuthStore } from '@/features/auth/store/auth-store';

export default function AuthLayout() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const user = useAuthStore((state) => state.user);

  if (!hydrated) return null;
  if (user) {
    return <Redirect href={'/(member)/(tabs)/home' as Href} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
