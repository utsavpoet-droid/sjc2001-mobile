import { Redirect, Stack, type Href } from 'expo-router';

import { useAuthStore } from '@/features/auth/store/auth-store';

export default function MemberLayout() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const user = useAuthStore((state) => state.user);

  if (!hydrated) return null;
  if (!user) {
    return <Redirect href={'/(auth)/sign-in' as Href} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="members/[id]" />
      <Stack.Screen name="members/[id]/tagged" />
      <Stack.Screen name="stories/[id]" />
      <Stack.Screen name="stories/create" />
      <Stack.Screen name="gallery/[id]" />
      <Stack.Screen
        name="gallery/photo"
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen name="profile/index" />
      <Stack.Screen
        name="photo-preview"
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen name="profile/edit" />
      <Stack.Screen name="settings/index" />
      <Stack.Screen name="activity/index" />
      <Stack.Screen name="polls/index" />
      <Stack.Screen name="silver-jubilee/index" />
      <Stack.Screen name="news/[id]" />
      <Stack.Screen name="committees/index" />
      <Stack.Screen name="committees/[id]/index" />
      <Stack.Screen name="committees/[id]/compose" />
      <Stack.Screen name="committees/[id]/posts/[postId]" />
      <Stack.Screen name="committees/[id]/members" />
      <Stack.Screen name="committees/[id]/invite" />
      <Stack.Screen name="committees/[id]/polls/new" />
      <Stack.Screen name="committees/[id]/tasks/index" />
      <Stack.Screen name="committees/[id]/tasks/new" />
      <Stack.Screen name="committees/[id]/tasks/[taskId]" />
      <Stack.Screen name="committees/[id]/decisions/index" />
      <Stack.Screen name="committees/[id]/decisions/new" />
      <Stack.Screen name="committees/[id]/decisions/[decisionId]" />
      <Stack.Screen name="committees/[id]/documents/index" />
      <Stack.Screen name="committees/[id]/documents/new" />
      <Stack.Screen name="committees/invitations" />
    </Stack>
  );
}
