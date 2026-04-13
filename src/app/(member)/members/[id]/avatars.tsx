import { useQuery } from '@tanstack/react-query';
import { useGlobalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getMemberAvatars } from '@/features/content/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveBackendUrl } from '@/lib/api/bases';

type AvatarItem = {
  id: string;
  imageUrl?: string | null;
  sourceType?: 'contact_card' | 'tagged_face';
  sourceLabel?: string | null;
  albumTitle?: string | null;
  confidence?: number | null;
};

type AvatarResponse = {
  summary?: {
    avatarCount?: number;
    taggedAvatarCount?: number;
  };
  avatars?: AvatarItem[];
};

export default function MemberAvatarsScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const { id } = useGlobalSearchParams<{ id: string }>();

  const avatarsQuery = useQuery({
    queryKey: ['member-avatars', id],
    queryFn: () => getMemberAvatars(String(id)),
  });

  const avatars = useMemo(() => {
    const response = (avatarsQuery.data ?? {}) as AvatarResponse;
    return {
      summary: response.summary ?? {},
      avatars: (response.avatars ?? []).map((avatar) => ({
        ...avatar,
        resolvedUrl: resolveBackendUrl(avatar.imageUrl ?? null),
      })),
    };
  }, [avatarsQuery.data]);

  return (
    <Screen scroll>
      <BackLink label="Back to contact card" />
      <SectionTitle
        eyebrow="Member Avatars"
        title="Portraits built from contact and tagged photos"
        subtitle={`${avatars.summary.avatarCount ?? 0} avatars, including ${avatars.summary.taggedAvatarCount ?? 0} face crops from tagged photos`}
      />

      {avatarsQuery.isLoading ? <ActivityIndicator color={colors.accent} /> : null}

      <View style={styles.grid}>
        {avatars.avatars.map((avatar) => (
          <Card key={avatar.id} style={styles.avatarCard}>
            {avatar.resolvedUrl ? (
              <Image source={{ uri: avatar.resolvedUrl }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <View style={[styles.avatarImage, { backgroundColor: colors.surfaceMuted }]} />
            )}
            <Text style={[styles.kicker, { color: colors.textMuted }]}>
              {avatar.sourceType === 'contact_card' ? 'Contact card' : 'Tagged face'}
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>{avatar.sourceLabel || 'Avatar'}</Text>
            {avatar.albumTitle ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{avatar.albumTitle}</Text> : null}
            {typeof avatar.confidence === 'number' ? (
              <Text style={[styles.meta, { color: colors.textSecondary }]}>Confidence {Math.round(avatar.confidence)}%</Text>
            ) : null}
          </Card>
        ))}
      </View>

      {!avatarsQuery.isLoading && avatars.avatars.length === 0 ? (
        <Card>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No avatars have been generated for this member yet.
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: Spacing.three,
  },
  avatarCard: {
    gap: Spacing.two,
  },
  avatarImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
  },
  kicker: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
  },
  meta: {
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
});
