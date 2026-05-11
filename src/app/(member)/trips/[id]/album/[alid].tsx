import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, PrimaryButton } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { requestContentJson } from '@/lib/api/client';
import { addPhotoToAlbum, deleteTripAlbumPhoto, getTripAlbum } from '@/features/trips/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { TripAlbumPhoto } from '@shared/contracts/trips-contract';

const VIDEO_RE = /\.(mp4|mov|webm|avi|m4v)(\?|$)/i;
const isVideoUrl = (url: string) => VIDEO_RE.test(url);

const COL = 3;
const GAP = 4;
const SCREEN_W = Dimensions.get('window').width;
const CELL_SIZE = (SCREEN_W - Spacing.four * 2 - GAP * (COL - 1)) / COL;

export default function TripAlbumScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const { id, alid } = useLocalSearchParams<{ id: string; alid: string }>();
  const tripId = parseInt(id ?? '0', 10);
  const albumId = parseInt(alid ?? '0', 10);
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const [preview, setPreview] = useState<TripAlbumPhoto | null>(null);

  const query = useQuery({
    queryKey: ['trip-album', tripId, albumId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getTripAlbum(token, tripId, albumId);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return null;

      const asset = result.assets[0];
      const isVideo = asset.type === 'video';

      let uri = asset.uri;
      let filename = asset.fileName ?? `${isVideo ? 'video' : 'photo'}-${Date.now()}`;
      let contentType = asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg');

      if (!isVideo) {
        const looksHeic =
          /\.(heic|heif)$/i.test(filename) ||
          /image\/heic|image\/heif/i.test(contentType);
        if (looksHeic || contentType !== 'image/jpeg') {
          const manipulated = await ImageManipulator.manipulateAsync(asset.uri, [], {
            compress: 0.85,
            format: ImageManipulator.SaveFormat.JPEG,
          });
          uri = manipulated.uri;
          filename = filename.replace(/\.(heic|heif|png|webp)$/i, '.jpg');
          if (!/\.jpe?g$/i.test(filename)) filename = `${filename}.jpg`;
          contentType = 'image/jpeg';
        }
      } else if (!/\.(mp4|mov|webm|avi|m4v)$/i.test(filename)) {
        filename = `${filename}.mp4`;
      }

      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');

      const presign = await requestContentJson<{ uploadUrl: string; publicUrl: string }>('/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, contentType }),
      });
      const { uploadUrl, publicUrl } = presign;

      const fileRes = await fetch(uri);
      const blob = await fileRes.blob();
      await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });

      await addPhotoToAlbum(token, tripId, albumId, publicUrl);
      return publicUrl;
    },
    onSuccess: (url) => {
      if (url) {
        void queryClient.invalidateQueries({ queryKey: ['trip-album', tripId, albumId] });
      }
    },
    onError: (err) => {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (photoId: number) => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      await deleteTripAlbumPhoto(token, tripId, albumId, photoId);
    },
    onSuccess: () => {
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ['trip-album', tripId, albumId] });
    },
    onError: (err) => {
      Alert.alert('Could not delete', err instanceof Error ? err.message : 'Try again.');
    },
  });

  const confirmDelete = (photoId: number) => {
    Alert.alert(
      'Delete photo?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(photoId) },
      ],
    );
  };

  const album = query.data?.album;
  const photos = query.data?.photos ?? [];

  return (
    <Screen>
      <View style={styles.headerArea}>
        <BackLink />
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {album?.title ?? 'Album'}
          </Text>
          {album?.isLocked ? (
            <View style={[styles.lockBadge, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.lockText, { color: colors.textMuted }]}>Locked</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.countText, { color: colors.textMuted }]}>
          {query.data?.total ?? 0} photo{(query.data?.total ?? 0) !== 1 ? 's' : ''}
        </Text>
      </View>

      {!album?.isLocked ? (
        <View style={[styles.uploadBar, { borderBottomColor: colors.border }]}>
          <PrimaryButton
            busy={uploadMutation.isPending}
            onPress={() => void uploadMutation.mutate()}>
            Add Photo
          </PrimaryButton>
        </View>
      ) : null}

      {query.isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={photos}
          numColumns={COL}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              tintColor={colors.accent}
            />
          }
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => {
            const video = isVideoUrl(item.url);
            return (
              <Pressable onPress={() => setPreview(item)} style={styles.cell}>
                <Image
                  source={{ uri: item.thumbUrl ?? item.url }}
                  style={styles.cellImage}
                  resizeMode="cover"
                />
                {video ? (
                  <View style={styles.videoBadge} pointerEvents="none">
                    <Ionicons name="play" size={14} color="#fff" />
                  </View>
                ) : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Ionicons name="images-outline" size={36} color={colors.textMuted} style={{ alignSelf: 'center' }} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No photos yet.{!album?.isLocked ? ' Tap "Add Photo" to upload.' : ''}
              </Text>
            </Card>
          }
        />
      )}

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={styles.modalScrim}>
          <Pressable style={styles.modalDismiss} onPress={() => setPreview(null)} />
          {preview ? (
            <PreviewContent
              photo={preview}
              onClose={() => setPreview(null)}
              onDelete={() => confirmDelete(preview.id)}
              deleting={deleteMutation.isPending}
            />
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

function PreviewContent({
  photo,
  onClose,
  onDelete,
  deleting,
}: {
  photo: TripAlbumPhoto;
  onClose: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const video = isVideoUrl(photo.url);
  return (
    <View style={styles.modalContent} pointerEvents="box-none">
      {video ? (
        <VideoPreview uri={photo.url} />
      ) : (
        <Image source={{ uri: photo.url }} style={styles.fullImage} resizeMode="contain" />
      )}
      {photo.caption ? <Text style={styles.captionText}>{photo.caption}</Text> : null}
      <View style={styles.previewActions}>
        <Pressable onPress={onClose} style={[styles.previewButton, styles.previewClose]}>
          <Text style={styles.previewButtonText}>Close</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          disabled={deleting}
          style={[styles.previewButton, styles.previewDelete, deleting && styles.previewDeleteBusy]}
        >
          <Ionicons name="trash-outline" size={16} color="#fff" />
          <Text style={styles.previewButtonText}>{deleting ? 'Deleting…' : 'Delete'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  return <VideoView player={player} style={styles.fullImage} contentFit="contain" nativeControls />;
}

const styles = StyleSheet.create({
  headerArea: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  title: {
    flex: 1,
    fontFamily: Fonts.rounded,
    fontSize: 24,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  lockText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  countText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  uploadBar: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    padding: Spacing.four,
    paddingBottom: 124,
    gap: GAP,
  },
  row: {
    gap: GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cellImage: {
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
  emptyCard: {
    gap: Spacing.two,
    alignItems: 'center',
    paddingVertical: Spacing.five,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    textAlign: 'center',
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.two,
  },
  fullImage: {
    width: SCREEN_W,
    height: SCREEN_W,
  },
  captionText: {
    color: '#fff',
    fontFamily: Fonts.sans,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
  },
  videoBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  previewClose: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  previewDelete: {
    backgroundColor: '#dc2626',
  },
  previewDeleteBusy: {
    opacity: 0.6,
  },
  previewButtonText: {
    color: '#fff',
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
  },
});
