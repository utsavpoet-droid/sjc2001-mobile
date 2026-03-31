import { Redirect, type Href } from 'expo-router';

import { useAuthStore } from '@/features/auth/store/auth-store';

export default function Index() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const user = useAuthStore((state) => state.user);

  if (!hydrated) return null;

  return <Redirect href={(user ? '/(member)/(tabs)/home' : '/(auth)/sign-in') as Href} />;
}
