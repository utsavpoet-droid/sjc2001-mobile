import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewToken,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GifPicker } from '@/components/content/gif-picker';
import { Input, PrimaryButton } from '@/components/ui/primitives';
import { RichBody } from '@/components/content/rich-body';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getBulkEngagement, getComments, getGalleryAlbum, getReactions, postComment, postReactionToggle } from '@/features/content/api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSharePhoto } from '@/hooks/use-share-photo';
import { resolveBackendUrl } from '@/lib/api/bases';
import { serializeComposerBody } from '@/lib/content/gif-tokens';

const { width: SW, height: SH } = Dimensions.get('window');

type Photo = { id?: number; photoUrl?: string };
type PhotoReactions = { count?: number; likedByMe?: boolean };

// ─── Animated heart burst ─────────────────────────────────────────────────────

function HeartBurst({ visible }: { visible: boolean }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      scale.value = withSequence(
        withSpring(1.4, { damping: 6, stiffness: 300 }),
        withSpring(1.0, { damping: 12, stiffness: 200 }),
        withDelay(400, withTiming(0, { duration: 300 })),
      );
      opacity.value = withSequence(
        withTiming(1, { duration: 80 }),
        withDelay(500, withTiming(0, { duration: 300 })),
      );
    }
  }, [visible, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.heartBurst, animStyle]} pointerEvents="none">
      <Ionicons name="heart" size={88} color="#FF4D6D" />
    </Animated.View>
  );
}

// ─── Per-photo zoomable component ────────────────────────────────────────────

function ZoomablePhoto({
  uri,
  photoId,
  onZoomed,
  onDoubleTapReact,
}: {
  uri: string;
  photoId?: number;
  onZoomed: (zoomed: boolean) => void;
  onDoubleTapReact?: (photoId: number) => void;
}) {
  const [heartVisible, setHeartVisible] = useState(false);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const triggerReact = useCallback(() => {
    if (!photoId || !onDoubleTapReact) return;
    // Briefly toggle the heart animation
    setHeartVisible(false);
    requestAnimationFrame(() => setHeartVisible(true));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDoubleTapReact(photoId);
  }, [photoId, onDoubleTapReact]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 5));
    })
    .onEnd(() => {
      if (scale.value < 1.15) {
        scale.value = withSpring(1, { damping: 20, stiffness: 200 });
        savedScale.value = 1;
        runOnJS(onZoomed)(false);
      } else {
        savedScale.value = scale.value;
        runOnJS(onZoomed)(true);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.05) {
        // Zoomed in → reset zoom on double-tap
        scale.value = withSpring(1, { damping: 20, stiffness: 200 });
        savedScale.value = 1;
        runOnJS(onZoomed)(false);
      } else {
        // Not zoomed → double-tap reacts (like)
        runOnJS(triggerReact)();
      }
    });

  const composed = Gesture.Simultaneous(doubleTap, pinch);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.photoSlide, animStyle]}>
        <Image
          source={{ uri }}
          style={styles.photo}
          contentFit="contain"
          transition={100}
          recyclingKey={uri}
        />
        <HeartBurst visible={heartVisible} />
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Main lightbox screen ─────────────────────────────────────────────────────

export default function GalleryPhotoViewer() {
  const router = useRouter();
  const { albumId, startIndex } = useLocalSearchParams<{
    albumId: string;
    startIndex: string;
  }>();

  const [currentIndex, setCurrentIndex] = useState(Number(startIndex ?? 0));
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [gifUrls, setGifUrls] = useState<string[]>([]);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);
  const accessToken = useAuthStore((state) => state.accessToken);
  const { share, sharing } = useSharePhoto();
  const queryClient = useQueryClient();
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const commentInputRef = useRef<TextInput>(null);

  // Re-use the already-cached album query — no extra network request
  const { data } = useQuery({
    queryKey: ['gallery-album', albumId],
    queryFn: () => getGalleryAlbum(String(albumId)),
    staleTime: 60_000,
  });

  const photos: Photo[] = (data as { photos?: Photo[] })?.photos ?? [];
  const items = photos
    .map((p) => ({
      id: p.id,
      uri: resolveBackendUrl(p.photoUrl ?? null),
    }))
    .filter((p): p is { id: number; uri: string } => Boolean(p.uri));

  const handleZoomed = useCallback((zoomed: boolean) => {
    setScrollEnabled(!zoomed);
  }, []);

  const currentPhoto = items[currentIndex] ?? null;
  const currentPhotoId = String(currentPhoto?.id ?? '');
  const reactionQuery = useQuery({
    queryKey: ['gallery-photo-reactions', currentPhotoId, accessToken],
    queryFn: () => getReactions({ entityType: 'gallery_photo', entityId: currentPhotoId }, accessToken),
    enabled: Boolean(currentPhotoId),
  });
  const commentsQuery = useQuery({
    queryKey: ['gallery-photo-comments', currentPhotoId],
    queryFn: () => getComments({ entityType: 'gallery_photo', entityId: currentPhotoId, page: 1, limit: 20 }),
    enabled: Boolean(currentPhotoId),
  });
  const comments = useMemo(
    () =>
      commentsQuery.data && typeof commentsQuery.data === 'object' && 'comments' in commentsQuery.data
        ? ((commentsQuery.data as { comments?: Array<{ id: number; body: string; author?: { name?: string } }> }).comments ?? [])
        : [],
    [commentsQuery.data],
  );
  const photoReactions = (reactionQuery.data ?? {}) as PhotoReactions;
  const commentEngagementQuery = useQuery({
    queryKey: ['gallery-photo-comment-engagement', currentPhotoId, comments.map((comment) => comment.id).join(','), accessToken],
    queryFn: () => getBulkEngagement('comment', comments.map((comment) => String(comment.id)), accessToken),
    enabled: comments.length > 0,
  });

  const reactionMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !currentPhotoId) throw new Error('Please sign in again.');
      return postReactionToggle(token, { entityType: 'gallery_photo', entityId: currentPhotoId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['gallery-photo-reactions', currentPhotoId] });
      void queryClient.invalidateQueries({ queryKey: ['gallery-photo-engagement'] });
    },
  });
  const commentMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !currentPhotoId) throw new Error('Please sign in again.');
      return postComment(token, {
        entityType: 'gallery_photo',
        entityId: currentPhotoId,
        body: serializeComposerBody(commentText, gifUrls),
      });
    },
    onSuccess: () => {
      setCommentText('');
      setGifUrls([]);
      setCommentsOpen(true);
      void queryClient.invalidateQueries({ queryKey: ['gallery-photo-comments', currentPhotoId] });
      void queryClient.invalidateQueries({ queryKey: ['gallery-photo-reactions', currentPhotoId] });
      void queryClient.invalidateQueries({ queryKey: ['gallery-photo-engagement'] });
    },
  });
  const commentReactionMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return postReactionToggle(token, { entityType: 'comment', entityId: String(commentId) });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['gallery-photo-comment-engagement', currentPhotoId] });
    },
  });

  const handleReact = useCallback(async (photoId: number) => {
    try {
      const token = await getValidAccessToken();
      if (!token) return;
      await postReactionToggle(token, {
        entityType: 'gallery_photo',
        entityId: String(photoId),
      });
    } catch {
      // Silent — reaction is best-effort in the lightbox
    }
  }, [getValidAccessToken]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) {
        setCurrentIndex(viewableItems[0].index);
        void Haptics.selectionAsync();
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* Top overlay: close + counter */}
      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.iconBtn}
          hitSlop={12}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>

        {items.length > 1 ? (
          <View style={styles.counterPill}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {items.length}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            const uri = items[currentIndex]?.uri;
            if (uri) void share(uri);
          }}
          disabled={sharing}
          style={[styles.iconBtn, { opacity: sharing ? 0.5 : 1 }]}
          hitSlop={12}>
          {sharing ? (
            <Ionicons name="hourglass-outline" size={20} color="#fff" />
          ) : (
            <Ionicons name="share-outline" size={20} color="#fff" />
          )}
        </Pressable>
      </View>

      {/* Hint for double-tap */}
      {items.length > 0 ? (
        <View style={styles.hintBar} pointerEvents="none">
          <Text style={styles.hintText}>Double-tap to like  ·  Pinch to zoom</Text>
        </View>
      ) : null}

      {currentPhoto ? (
        <View style={styles.bottomOverlay}>
          <View style={styles.bottomActions}>
            <Pressable onPress={() => reactionMutation.mutate()} style={[styles.bottomPill, { backgroundColor: photoReactions.likedByMe ? colors.accentSoft : 'rgba(0,0,0,0.55)', borderColor: photoReactions.likedByMe ? colors.accent : 'rgba(255,255,255,0.12)' }]}>
              <Ionicons name={photoReactions.likedByMe ? 'heart' : 'heart-outline'} size={16} color={photoReactions.likedByMe ? colors.accent : '#FFFFFF'} />
              <Text style={[styles.bottomPillText, { color: photoReactions.likedByMe ? colors.accent : '#FFFFFF' }]}>{photoReactions.count ?? 0}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setCommentsOpen((value) => !value);
                requestAnimationFrame(() => commentInputRef.current?.focus());
              }}
              style={[styles.bottomPill, { backgroundColor: comments.length > 0 ? colors.accentSoft : 'rgba(0,0,0,0.55)', borderColor: comments.length > 0 ? colors.accent : 'rgba(255,255,255,0.12)' }]}>
              <Ionicons name={comments.length > 0 ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={16} color={comments.length > 0 ? colors.accent : '#FFFFFF'} />
              <Text style={[styles.bottomPillText, { color: comments.length > 0 ? colors.accent : '#FFFFFF' }]}>{comments.length}</Text>
            </Pressable>
          </View>

          {commentsOpen ? (
            <View style={styles.commentsPanel}>
              <FlatList
                data={comments}
                keyExtractor={(item) => String(item.id)}
                keyboardShouldPersistTaps="handled"
                style={styles.commentsList}
                renderItem={({ item }) => {
                  const engagement = commentEngagementQuery.data?.[item.id] ?? { reactionCount: 0, likedByMe: false };
                  return (
                    <View style={styles.commentCard}>
                      <Text style={styles.commentAuthor}>{item.author?.name ?? 'Member'}</Text>
                      <RichBody body={item.body} />
                      <Pressable onPress={() => commentReactionMutation.mutate(item.id)} style={styles.commentLikeRow}>
                        <Ionicons name={engagement.likedByMe ? 'heart' : 'heart-outline'} size={15} color={engagement.likedByMe ? '#F6D9CB' : '#D7DCE4'} />
                        <Text style={styles.commentLikeText}>{engagement.reactionCount}</Text>
                      </Pressable>
                    </View>
                  );
                }}
              />
              <Input
                ref={commentInputRef}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Comment on this photo"
                multiline
                style={styles.commentInput}
              />
              <View style={styles.commentToolbar}>
                <Pressable onPress={() => setGifPickerOpen(true)} style={styles.gifButton}>
                  <Ionicons name="images-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.gifButtonText}>GIF</Text>
                </Pressable>
              </View>
              <PrimaryButton busy={commentMutation.isPending} disabled={!commentText.trim() && gifUrls.length === 0} onPress={() => commentMutation.mutate()}>
                Post Comment
              </PrimaryButton>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Photo pager */}
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        initialScrollIndex={Number(startIndex ?? 0)}
        getItemLayout={(_, index) => ({
          length: SW,
          offset: SW * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <ZoomablePhoto
            uri={item.uri}
            photoId={item.id}
            onZoomed={handleZoomed}
            onDoubleTapReact={(id) => void handleReact(id)}
          />
        )}
      />

      <GifPicker visible={gifPickerOpen} onClose={() => setGifPickerOpen(false)} onSelect={(gifUrl) => setGifUrls([gifUrl])} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 32,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterPill: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  hintBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 48 : 24,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: Platform.OS === 'ios' ? 78 : 48,
    zIndex: 10,
    gap: 10,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
  },
  bottomPill: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomPillText: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },
  commentsPanel: {
    maxHeight: SH * 0.42,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.72)',
    padding: 12,
    gap: 10,
  },
  commentsList: {
    maxHeight: SH * 0.22,
  },
  commentCard: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    gap: 6,
  },
  commentAuthor: {
    color: '#FFFFFF',
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },
  commentLikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentLikeText: {
    color: '#FFFFFF',
    fontFamily: Fonts.rounded,
    fontSize: 13,
  },
  commentInput: {
    minHeight: 84,
    textAlignVertical: 'top',
    paddingTop: Spacing.two,
  },
  commentToolbar: {
    flexDirection: 'row',
  },
  gifButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gifButtonText: {
    color: '#FFFFFF',
    fontFamily: Fonts.rounded,
    fontSize: 13,
  },
  photoSlide: {
    width: SW,
    height: SH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: SW,
    height: SH,
  },
  heartBurst: {
    position: 'absolute',
    alignSelf: 'center',
  },
});
