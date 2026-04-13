import { useQuery } from '@tanstack/react-query';
import { useGlobalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getMemberTaggedPhotos } from '@/features/content/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveBackendUrl } from '@/lib/api/bases';

type TaggedPhoto = {
  photoId: number;
  photoUrl: string;
  albumTitle?: string | null;
  albumId?: number;
};

type TaggedResponse = {
  summary?: {
    photoCount?: number;
    albumCount?: number;
  };
  photos?: TaggedPhoto[];
};

export default function MemberTaggedPhotosScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const { id } = useGlobalSearchParams<{ id: string }>();

  const taggedQuery = useQuery({
    queryKey: ['member-tagged-photos', id],
    queryFn: () => getMemberTaggedPhotos(String(id)),
  });

  const tagged = useMemo(() => {
    const response = (taggedQuery.data ?? {}) as TaggedResponse;
    return {
      summary: response.summary ?? {},
      photos: (response.photos ?? []).map((photo) => ({
        ...photo,
        resolvedUrl: resolveBackendUrl(photo.photoUrl ?? null),
      })),
    };
  }, [taggedQuery.data]);

  return (
    <Screen scroll>
      <BackLink label="Back to contact card" />
      <SectionTitle
        eyebrow="Tagged Photos"
        title="Moments featuring this batchmate"
        subtitle={`${tagged.summary.photoCount ?? 0} photos across ${tagged.summary.albumCount ?? 0} albums`}
      />
      {taggedQuery.isLoading ? <ActivityIndicator color={colors.accent} /> : null}

      <View style={styles.grid}>
        {tagged.photos.map((photo) => (
          <Card key={photo.photoId} style={styles.photoCard}>
            {photo.resolvedUrl ? <Image source={{ uri: photo.resolvedUrl }} style={styles.photo} resizeMode="contain" /> : null}
            <View style={styles.captionRow}>
              <Text style={[styles.captionTitle, { color: colors.text }]}>{photo.albumTitle || 'Gallery photo'}</Text>
              {photo.albumId ? <Text style={[styles.captionMeta, { color: colors.textSecondary }]}>Album #{photo.albumId}</Text> : null}
            </View>
          </Card>
        ))}
      </View>

      {!taggedQuery.isLoading && tagged.photos.length === 0 ? (
        <Card>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No tagged photos have been added for this member yet.</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: Spacing.three,
  },
  photoCard: {
    gap: Spacing.two,
  },
  photo: {
    width: '100%',
    height: 260,
    borderRadius: 22,
  },
  captionRow: {
    gap: Spacing.one,
  },
  captionTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
  },
  captionMeta: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
});
