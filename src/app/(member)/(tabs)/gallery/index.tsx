import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getBulkEngagement, getGallery, postReactionToggle } from '@/features/content/api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveBackendUrl } from '@/lib/api/bases';

type AlbumWire = {
  id?: number;
  title?: string | null;
  description?: string | null;
  photos?: Array<{ photoUrl?: string }>;
};

function AlbumStat({
  icon,
  count,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  active?: boolean;
  onPress?: () => void;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        onPress?.();
      }}
      style={[styles.countPill, { backgroundColor: active ? 'rgba(246,217,203,0.92)' : 'rgba(8, 8, 8, 0.64)' }]}>
      <Ionicons name={icon} size={12} color={active ? '#172236' : count > 0 ? '#F6D9CB' : '#FFFFFF'} />
      <Text style={styles.countText}>{count}</Text>
    </Pressable>
  );
}

export default function GalleryScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const accessToken = useAuthStore((state) => state.accessToken);
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);
  const queryClient = useQueryClient();
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
  const reactionMutation = useMutation({
    mutationFn: async (albumId: string) => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return postReactionToggle(token, { entityType: 'gallery_album', entityId: albumId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['gallery-album-engagement'] });
    },
    onError: (error) => {
      Alert.alert('Unable to react', error instanceof Error ? error.message : 'Try again.');
    },
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
            <Pressable key={String(album.id)} onPress={() => router.push(`/(member)/gallery/${album.id}` as Href)}>
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
                          <AlbumStat
                            icon={(engagementQuery.data?.[Number(album.id ?? 0)]?.likedByMe ? 'heart' : 'heart-outline') as keyof typeof Ionicons.glyphMap}
                            count={engagementQuery.data?.[Number(album.id ?? 0)]?.reactionCount ?? 0}
                            active={Boolean(engagementQuery.data?.[Number(album.id ?? 0)]?.likedByMe)}
                            onPress={() => reactionMutation.mutate(String(album.id ?? ''))}
                          />
                          <AlbumStat
                            icon="chatbubble-ellipses-outline"
                            count={engagementQuery.data?.[Number(album.id ?? 0)]?.commentCount ?? 0}
                            active={(engagementQuery.data?.[Number(album.id ?? 0)]?.commentCount ?? 0) > 0}
                            onPress={() => router.push(`/(member)/gallery/${album.id}?focusComments=1` as Href)}
                          />
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
