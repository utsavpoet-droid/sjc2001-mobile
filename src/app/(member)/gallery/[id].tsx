import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Input, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { BackLink } from '@/components/ui/back-link';
import { GifPicker } from '@/components/content/gif-picker';
import { RichBody } from '@/components/content/rich-body';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getBulkEngagement, getComments, getGalleryAlbum, getReactions, postComment, postReactionToggle } from '@/features/content/api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveResponsiveImageUrl } from '@/lib/api/bases';
import { serializeComposerBody } from '@/lib/content/gif-tokens';

type AlbumDetail = {
  title?: string | null;
  description?: string | null;
  photos?: Array<{ id?: number; photoUrl?: string }>;
};
type AlbumReactions = { count?: number; likedByMe?: boolean };
type GalleryPhotoItem = { id: number; uri: string };

export default function GalleryDetailScreen() {
  const { id, focusComments } = useLocalSearchParams<{ id: string; focusComments?: string }>();
  const router = useRouter();
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const queryClient = useQueryClient();
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);
  const accessToken = useAuthStore((state) => state.accessToken);
  const [commentText, setCommentText] = useState('');
  const [gifUrls, setGifUrls] = useState<string[]>([]);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const commentInputRef = useRef<TextInput>(null);

  const query = useQuery({
    queryKey: ['gallery-album', id],
    queryFn: () => getGalleryAlbum(String(id)),
  });
  const albumReactionsQuery = useQuery({
    queryKey: ['gallery-album-reactions', id, accessToken],
    queryFn: () => getReactions({ entityType: 'gallery_album', entityId: String(id) }, accessToken),
    enabled: !!id,
  });
  const albumCommentsQuery = useQuery({
    queryKey: ['gallery-album-comments', id],
    queryFn: () => getComments({ entityType: 'gallery_album', entityId: String(id), page: 1, limit: 20 }),
    enabled: !!id,
  });

  const album = (query.data ?? {}) as AlbumDetail;
  const albumReactions = (albumReactionsQuery.data ?? {}) as AlbumReactions;
  const galleryItems: GalleryPhotoItem[] = (album.photos ?? [])
    .map((photo) => ({
      id: Number(photo.id ?? 0),
      uri: resolveResponsiveImageUrl(photo.photoUrl ?? null, { width: 900, quality: 76 }) ?? '',
    }))
    .filter((photo): photo is GalleryPhotoItem => Number.isFinite(photo.id) && photo.id > 0 && Boolean(photo.uri));
  const comments =
    albumCommentsQuery.data && typeof albumCommentsQuery.data === 'object' && 'comments' in albumCommentsQuery.data
      ? ((albumCommentsQuery.data as { comments?: Array<{ id: number; body: string; author?: { name?: string } }> }).comments ?? [])
      : [];
  const commentEngagementQuery = useQuery({
    queryKey: ['gallery-album-comment-engagement', id, comments.map((comment) => comment.id).join(','), accessToken],
    queryFn: () => getBulkEngagement('comment', comments.map((comment) => String(comment.id)), accessToken),
    enabled: comments.length > 0,
  });
  const photoIds = galleryItems.map((photo) => String(photo.id));
  const photoEngagementQuery = useQuery({
    queryKey: ['gallery-photo-engagement', id, photoIds.join(','), accessToken],
    queryFn: () => getBulkEngagement('gallery_photo', photoIds, accessToken),
    enabled: photoIds.length > 0,
  });
  const albumReactionMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return postReactionToggle(token, { entityType: 'gallery_album', entityId: String(id) });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['gallery-album-reactions', id] });
      void queryClient.invalidateQueries({ queryKey: ['gallery-album-engagement'] });
    },
    onError: (error) => {
      Alert.alert('Unable to react', error instanceof Error ? error.message : 'Try again.');
    },
  });
  const commentMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return postComment(token, {
        entityType: 'gallery_album',
        entityId: String(id),
        body: serializeComposerBody(commentText, gifUrls),
      });
    },
    onSuccess: () => {
      setCommentText('');
      setGifUrls([]);
      void queryClient.invalidateQueries({ queryKey: ['gallery-album-comments', id] });
      void queryClient.invalidateQueries({ queryKey: ['gallery-album-reactions', id] });
      void queryClient.invalidateQueries({ queryKey: ['gallery-album-engagement'] });
    },
    onError: (error) => {
      Alert.alert('Unable to comment', error instanceof Error ? error.message : 'Try again.');
    },
  });
  const commentReactionMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return postReactionToggle(token, { entityType: 'comment', entityId: String(commentId) });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['gallery-album-comment-engagement', id] });
    },
    onError: (error) => {
      Alert.alert('Unable to react', error instanceof Error ? error.message : 'Try again.');
    },
  });

  useEffect(() => {
    if (focusComments === '1') {
      const timeout = setTimeout(() => commentInputRef.current?.focus(), 250);
      return () => clearTimeout(timeout);
    }
  }, [focusComments]);

  if (query.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <BackLink label="Back to gallery" />
      <SectionTitle
        eyebrow="Album Detail"
        title={album.title || 'Gallery album'}
        subtitle={album.description || 'A direct mobile view of the selected website album.'}
      />

      <Card style={styles.engagementCard}>
        <View style={styles.engagementRow}>
          <Pressable onPress={() => albumReactionMutation.mutate()} style={[styles.engagementPill, { backgroundColor: albumReactions.likedByMe ? colors.accentSoft : colors.surfaceMuted, borderColor: albumReactions.likedByMe ? colors.accent : colors.border }]}>
            <Ionicons name={albumReactions.likedByMe ? 'heart' : 'heart-outline'} size={16} color={albumReactions.likedByMe ? colors.accent : colors.textSecondary} />
            <Text style={[styles.engagementText, { color: albumReactions.likedByMe ? colors.accent : colors.text }]}>{albumReactions.count ?? 0}</Text>
          </Pressable>
          <Pressable onPress={() => commentInputRef.current?.focus()} style={[styles.engagementPill, { backgroundColor: comments.length > 0 ? colors.accentSoft : colors.surfaceMuted, borderColor: comments.length > 0 ? colors.accent : colors.border }]}>
            <Ionicons name={comments.length > 0 ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={16} color={comments.length > 0 ? colors.accent : colors.textSecondary} />
            <Text style={[styles.engagementText, { color: comments.length > 0 ? colors.accent : colors.text }]}>{comments.length}</Text>
          </Pressable>
        </View>
      </Card>

      <View style={styles.grid}>
        {galleryItems.map((photo, index) => {
          const engagement = photoEngagementQuery.data?.[photo.id] ?? { reactionCount: 0, commentCount: 0 };
          return (
            <Pressable
              key={String(photo.id)}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(
                  `/(member)/gallery/photo?albumId=${id}&startIndex=${index}&photoId=${photo.id}` as never,
                );
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
              <Card style={[styles.photoCard, { backgroundColor: colors.surface }]}>
                {photo.uri ? (
                  <View style={[styles.photoFrame, { backgroundColor: colors.backgroundSoft }]}>
                    <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="contain" />
                    <View style={styles.photoStatsRow}>
                      <View style={styles.photoStatPill}>
                        <Ionicons name="heart-outline" size={12} color="#FFFFFF" />
                        <Text style={styles.photoStatText}>{engagement.reactionCount}</Text>
                      </View>
                      <View style={styles.photoStatPill}>
                        <Ionicons name="chatbubble-ellipses-outline" size={12} color="#FFFFFF" />
                        <Text style={styles.photoStatText}>{engagement.commentCount}</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.photoFallback, { color: colors.textSecondary }]}>Photo unavailable</Text>
                )}
              </Card>
            </Pressable>
          );
        })}
        {galleryItems.length === 0 ? (
          <Card>
            <Text style={[styles.photoFallback, { color: colors.textSecondary }]}>No photos in this album yet.</Text>
          </Card>
        ) : null}
      </View>

      {comments.length > 0 ? (
        <View style={styles.commentStack}>
          {comments.map((comment) => {
            const engagement = commentEngagementQuery.data?.[comment.id] ?? { reactionCount: 0, likedByMe: false };
            return (
            <Card key={comment.id}>
              <Text style={[styles.commentAuthor, { color: colors.text }]}>{comment.author?.name ?? 'Member'}</Text>
              <RichBody body={comment.body} />
              <Pressable onPress={() => commentReactionMutation.mutate(comment.id)} style={styles.commentLikeRow}>
                <Ionicons name={engagement.likedByMe ? 'heart' : 'heart-outline'} size={15} color={engagement.likedByMe ? colors.accent : colors.textSecondary} />
                <Text style={[styles.commentLikeText, { color: engagement.likedByMe ? colors.accent : colors.textSecondary }]}>{engagement.reactionCount}</Text>
              </Pressable>
            </Card>
          )})}
        </View>
      ) : null}

      <Card style={styles.commentComposer}>
        <Text style={[styles.commentHeading, { color: colors.text }]}>Join the album conversation</Text>
        <Input
          ref={commentInputRef}
          value={commentText}
          onChangeText={setCommentText}
          placeholder="Add a comment"
          multiline
          style={styles.commentInput}
        />
        <View style={styles.toolbarRow}>
          <Pressable onPress={() => setGifPickerOpen(true)} style={[styles.toolbarButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Ionicons name="images-outline" size={16} color={colors.accent} />
            <Text style={[styles.toolbarText, { color: colors.text }]}>GIF</Text>
          </Pressable>
        </View>
        {gifUrls[0] ? (
          <View style={[styles.gifPreviewCard, { backgroundColor: colors.backgroundSoft, borderColor: colors.border }]}>
            <Image source={{ uri: resolveResponsiveImageUrl(gifUrls[0], { width: 900, quality: 80 }) ?? gifUrls[0] }} style={styles.gifPreview} resizeMode="cover" />
            <Pressable onPress={() => setGifUrls([])} style={styles.gifRemoveButton}>
              <Ionicons name="close-circle" size={20} color={colors.accent} />
            </Pressable>
          </View>
        ) : null}
        <PrimaryButton busy={commentMutation.isPending} disabled={!commentText.trim() && gifUrls.length === 0} onPress={() => commentMutation.mutate()}>
          Post Comment
        </PrimaryButton>
      </Card>

      <GifPicker visible={gifPickerOpen} onClose={() => setGifPickerOpen(false)} onSelect={(gifUrl) => setGifUrls([gifUrl])} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: Spacing.three,
  },
  engagementCard: {
    gap: Spacing.one,
  },
  engagementRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  engagementPill: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  engagementText: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },
  photoCard: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  photoFrame: {
    width: '100%',
    height: 260,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoStatsRow: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  photoStatPill: {
    backgroundColor: 'rgba(8,8,8,0.66)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photoStatText: {
    color: '#FFFFFF',
    fontFamily: Fonts.rounded,
    fontSize: 12,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  commentStack: {
    gap: Spacing.two,
  },
  commentAuthor: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
  },
  commentLikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.one,
  },
  commentLikeText: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
  },
  commentComposer: {
    gap: Spacing.two,
  },
  commentHeading: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
  },
  commentInput: {
    minHeight: 110,
    textAlignVertical: 'top',
    paddingTop: Spacing.three,
  },
  toolbarRow: {
    flexDirection: 'row',
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
  toolbarText: {
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
});
