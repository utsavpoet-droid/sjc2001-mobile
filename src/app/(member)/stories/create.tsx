import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { Card, Input, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { BackLink } from '@/components/ui/back-link';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { createStory } from '@/features/content/api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function CreateStoryScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);
  const [body, setBody] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return createStory(token, { body });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stories', 1] });
      router.back();
    },
    onError: (error) => {
      Alert.alert('Unable to post story', error instanceof Error ? error.message : 'Try again.');
    },
  });

  return (
    <Screen scroll>
      <BackLink label="Back to stories" />
      <SectionTitle
        eyebrow="New Story"
        title="Share something the batch will actually want to read"
        subtitle="The backend currently supports text stories plus mention/media tokens. This mobile flow focuses on clean text first."
      />

      <Card style={styles.card}>
        <Input
          value={body}
          onChangeText={setBody}
          placeholder="Write your story here"
          multiline
          style={styles.multilineInput}
        />
        <Text style={[styles.caption, { color: colors.textSecondary }]}>Minimum 10 characters unless media tokens are added later.</Text>
        <PrimaryButton
          busy={mutation.isPending}
          disabled={body.trim().length < 10}
          onPress={() => mutation.mutate()}>
          Publish Story
        </PrimaryButton>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  multilineInput: {
    minHeight: 240,
    paddingTop: Spacing.three,
    textAlignVertical: 'top',
  },
  caption: {
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
});
