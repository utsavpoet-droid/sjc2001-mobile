import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { Card, SectionTitle } from '@/components/ui/primitives';
import { BackLink } from '@/components/ui/back-link';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getGalleryAlbum } from '@/features/content/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveBackendUrl } from '@/lib/api/bases';

type AlbumDetail = {
  title?: string | null;
  description?: string | null;
  photos?: Array<{ id?: number; photoUrl?: string }>;
};

export default function GalleryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = Colors[resolveThemeMode(useColorScheme())];

  const query = useQuery({
    queryKey: ['gallery-album', id],
    queryFn: () => getGalleryAlbum(String(id)),
  });

  if (query.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const album = (query.data ?? {}) as AlbumDetail;

  return (
    <Screen scroll>
      <BackLink label="Back to gallery" />
      <SectionTitle
        eyebrow="Album Detail"
        title={album.title || 'Gallery album'}
        subtitle={album.description || 'A direct mobile view of the selected website album.'}
      />

      <View style={styles.grid}>
        {(album.photos ?? []).map((photo) => {
          const uri = resolveBackendUrl(photo.photoUrl ?? null);
          return (
            <Card key={String(photo.id)} style={[styles.photoCard, { backgroundColor: colors.surface }]}>
              {uri ? (
                <View style={[styles.photoFrame, { backgroundColor: colors.backgroundSoft }]}>
                  <Image source={{ uri }} style={styles.photo} resizeMode="contain" />
                </View>
              ) : (
                <Text style={[styles.photoFallback, { color: colors.textSecondary }]}>Photo unavailable</Text>
              )}
            </Card>
          );
        })}
        {(album.photos ?? []).length === 0 ? (
          <Card>
            <Text style={[styles.photoFallback, { color: colors.textSecondary }]}>No photos in this album yet.</Text>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: Spacing.three,
  },
  photoCard: {
    borderRadius: 28,
  },
  photoFrame: {
    width: '100%',
    height: 260,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
});
