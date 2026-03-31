import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link, type Href } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getBulkEngagement, getGallery } from '@/features/content/api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveBackendUrl } from '@/lib/api/bases';

type AlbumWire = {
  id?: number;
  title?: string | null;
  description?: string | null;
  photos?: Array<{ photoUrl?: string }>;
};

function AlbumStat({ icon, count }: { icon: keyof typeof Ionicons.glyphMap; count: number }) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  return (
    <View style={[styles.countPill, { backgroundColor: 'rgba(8, 8, 8, 0.64)' }]}>
      <Ionicons name={icon} size={12} color={count > 0 ? '#F6D9CB' : '#FFFFFF'} />
      <Text style={styles.countText}>{count}</Text>
    </View>
  );
}

export default function GalleryScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const accessToken = useAuthStore((state) => state.accessToken);
  const query = useQuery({
    queryKey: ['gallery'],
    queryFn: () => getGallery(),
  });

  const albums = Array.isArray(query.data) ? (query.data as AlbumWire[]) : [];
  const engagementQuery = useQuery({
    queryKey: ['gallery-album-engagement', albums.map((album) => album.id).join(','), accessToken],
    queryFn: () => getBulkEngagement('gallery_album', albums.map((album) => String(album.id ?? '')).filter(Boolean), accessToken),
    enabled: albums.length > 0,
  });

  return (
    <Screen scroll>
      <SectionTitle
        eyebrow="Gallery"
        title="Albums and photo memories"
        subtitle="Browse the same gallery albums the website serves, including their cover photos and full image sets."
      />

      {query.isLoading ? <ActivityIndicator color={colors.accent} /> : null}

      <View style={styles.stack}>
        {albums.map((album) => {
          const cover = resolveBackendUrl(album.photos?.[0]?.photoUrl ?? null);
          const photoCount = album.photos?.length ?? 0;
          return (
            <Link key={String(album.id)} href={`/(member)/gallery/${album.id}` as Href} asChild>
              <Pressable>
                {({ pressed }) => (
                  <Card style={[styles.albumCard, { transform: [{ scale: pressed ? 0.988 : 1 }] }]}>
                    <ImageBackground
                      source={cover ? { uri: cover } : undefined}
                      style={styles.cover}
                      imageStyle={styles.coverImage}
                      resizeMode="cover">
                      <View style={styles.overlayTopRow}>
                        <AlbumStat icon="images" count={photoCount} />
                        <View style={styles.overlayActions}>
                          <AlbumStat icon="heart" count={engagementQuery.data?.[Number(album.id ?? 0)]?.reactionCount ?? 0} />
                          <AlbumStat icon="chatbubble-ellipses" count={engagementQuery.data?.[Number(album.id ?? 0)]?.commentCount ?? 0} />
                          <View style={[styles.countPill, { backgroundColor: 'rgba(8, 8, 8, 0.64)' }]}>
                            <Ionicons name="expand" size={12} color="#FFFFFF" />
                          </View>
                        </View>
                      </View>
                      <View style={styles.overlayBottom}>
                        <Text style={styles.overlayTitle}>{album.title || 'Untitled album'}</Text>
                        {album.description ? (
                          <Text style={styles.overlayDescription} numberOfLines={2}>
                            {album.description}
                          </Text>
                        ) : null}
                      </View>
                    </ImageBackground>
                  </Card>
                )}
              </Pressable>
            </Link>
          );
        })}
        {!query.isLoading && albums.length === 0 ? (
          <Card>
            <Text style={[styles.albumDescription, { color: colors.textSecondary }]}>No albums have been published yet.</Text>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.three,
  },
  albumCard: {
    gap: 0,
    overflow: 'hidden',
    borderRadius: 32,
    padding: 0,
  },
  cover: {
    width: '100%',
    height: 250,
    justifyContent: 'space-between',
  },
  coverImage: {
    borderRadius: 32,
  },
  overlayTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  overlayActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  overlayBottom: {
    gap: Spacing.one,
    padding: Spacing.three,
    backgroundColor: 'rgba(9, 12, 18, 0.46)',
  },
  overlayTitle: {
    color: '#FFFFFF',
    fontFamily: Fonts.rounded,
    fontSize: 22,
  },
  overlayDescription: {
    color: '#E6E8EC',
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  countText: {
    color: '#FFFFFF',
    fontFamily: Fonts.rounded,
    fontSize: 12,
  },
  albumDescription: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
});
