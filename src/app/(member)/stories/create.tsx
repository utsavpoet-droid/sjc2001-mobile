import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Input, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { BackLink } from '@/components/ui/back-link';
import { GifPicker } from '@/components/content/gif-picker';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { createStory } from '@/features/content/api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveBackendUrl } from '@/lib/api/bases';
import { serializeComposerBody } from '@/lib/content/gif-tokens';

export default function CreateStoryScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);
  const [bodyText, setBodyText] = useState('');
  const [gifUrls, setGifUrls] = useState<string[]>([]);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return createStory(token, { body: serializeComposerBody(bodyText, gifUrls) });
    },
    onSuccess: () => {
      setBodyText('');
      setGifUrls([]);
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
          value={bodyText}
          onChangeText={setBodyText}
          placeholder="Write your story here"
          multiline
          style={styles.multilineInput}
        />
        <View style={styles.toolbarRow}>
          <Pressable
            onPress={() => setGifPickerOpen(true)}
            style={[styles.toolbarButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Ionicons name="images-outline" size={16} color={colors.accent} />
            <Text style={[styles.toolbarButtonText, { color: colors.text }]}>GIF</Text>
          </Pressable>
        </View>
        {gifUrls[0] ? (
          <View style={[styles.gifPreviewCard, { backgroundColor: colors.backgroundSoft, borderColor: colors.border }]}> 
            <Image source={{ uri: resolveBackendUrl(gifUrls[0]) ?? gifUrls[0] }} style={styles.gifPreview} contentFit="cover" />
            <Pressable onPress={() => setGifUrls([])} style={styles.gifRemoveButton}>
              <Ionicons name="close-circle" size={20} color={colors.accent} />
            </Pressable>
          </View>
        ) : null}
        <Text style={[styles.caption, { color: colors.textSecondary }]}>Minimum 10 characters unless media tokens are added later.</Text>
        <PrimaryButton
          busy={mutation.isPending}
          disabled={bodyText.trim().length < 10 && gifUrls.length === 0}
          onPress={() => mutation.mutate()}>
          Publish Story
        </PrimaryButton>
      </Card>

      <GifPicker
        visible={gifPickerOpen}
        onClose={() => setGifPickerOpen(false)}
        onSelect={(gifUrl) => setGifUrls([gifUrl])}
      />
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
  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  toolbarButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolbarButtonText: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
  },
  gifPreviewCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  gifPreview: {
    width: '100%',
    height: 132,
  },
  gifRemoveButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
  },
  caption: {
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
});
