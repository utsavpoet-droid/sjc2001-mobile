import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
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
import { RichBody } from '@/components/content/rich-body';
import { Input, PrimaryButton } from '@/components/ui/primitives';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getBulkEngagement, getComments, getGalleryAlbum, getReactions, postComment, postReactionToggle } from '@/features/content/api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSharePhoto } from '@/hooks/use-share-photo';
import { resolveResponsiveImageUrl } from '@/lib/api/bases';
import { serializeComposerBody } from '@/lib/content/gif-tokens';

type Photo = { id?: number; photoUrl?: string };
type PhotoReactions = { count?: number; likedByMe?: boolean };

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

function ZoomablePhoto({
  uri,
  width,
  height,
  photoId,
  onZoomed,
  onToggleChrome,
  onDoubleTapReact,
}: {
  uri: string;
  width: number;
  height: number;
  photoId?: number;
  onZoomed: (zoomed: boolean) => void;
  onToggleChrome: () => void;
  onDoubleTapReact?: (photoId: number) => void;
}) {
  const [heartVisible, setHeartVisible] = useState(false);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const triggerReact = useCallback(() => {
    if (!photoId || !onDoubleTapReact) return;
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
        scale.value = withSpring(1, { damping: 20, stiffness: 200 });
        savedScale.value = 1;
        runOnJS(onZoomed)(false);
      } else {
        runOnJS(triggerReact)();
      }
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .onEnd(() => {
      runOnJS(onToggleChrome)();
    });

  const composed = Gesture.Exclusive(doubleTap, singleTap, pinch);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.photoSlide, { width, height }, animStyle]}>
        <Image
          source={{ uri }}
          style={[styles.photo, { width, height }]}
          contentFit="contain"
          transition={100}
          recyclingKey={`${uri}-${width}-${height}`}
        />
        <HeartBurst visible={heartVisible} />
      </Animated.View>
    </GestureDetector>
  );
}

export default function GalleryPhotoViewer() {
  const router = useRouter();
  const { albumId, startIndex, photoId } = useLocalSearchParams<{ albumId: string; startIndex: string; photoId?: string }>();
  const { width, height } = useWindowDimensions();
  const pageWidth = Math.max(1, Math.round(width));
  const pageHeight = Math.max(1, Math.round(height));
  const isLandscape = pageWidth > pageHeight;
  const listRef = useRef<FlatList<{ id: number; uri: string }> | null>(null);
  const initialScrollDoneRef = useRef(false);

  const [currentIndex, setCurrentIndex] = useState(Number(startIndex ?? 0));
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [chromeVisible, setChromeVisible] = useState(true);
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

  const { data } = useQuery({
    queryKey: ['gallery-album', albumId],
    queryFn: () => getGalleryAlbum(String(albumId)),
    staleTime: 60_000,
  });

  const photos: Photo[] = (data as { photos?: Photo[] })?.photos ?? [];
  const items = useMemo(
    () =>
      photos
        .map((photo) => ({
          id: Number(photo.id ?? 0),
          uri:
            resolveResponsiveImageUrl(
              photo.photoUrl ?? null,
              isLandscape ? { width: 1800, quality: 88 } : { width: 1400, quality: 84 },
            ) ?? '',
        }))
        .filter((photo): photo is { id: number; uri: string } => Number.isFinite(photo.id) && photo.id > 0 && Boolean(photo.uri)),
    [isLandscape, photos],
  );
  const requestedPhotoId = Number(photoId ?? 0);
  const requestedIndex = useMemo(() => {
    if (items.length === 0) return 0;
    if (Number.isFinite(requestedPhotoId) && requestedPhotoId > 0) {
      const matchedIndex = items.findIndex((item) => item.id === requestedPhotoId);
      if (matchedIndex >= 0) return matchedIndex;
    }
    const parsedIndex = Number(startIndex ?? 0);
    if (!Number.isFinite(parsedIndex)) return 0;
    return Math.max(0, Math.min(parsedIndex, items.length - 1));
  }, [items, photoId, requestedPhotoId, startIndex]);

  useEffect(() => {
    initialScrollDoneRef.current = false;
  }, [albumId]);

  useEffect(() => {
    if (items.length === 0) {
      setCurrentIndex(0);
      initialScrollDoneRef.current = false;
      return;
    }

    setCurrentIndex(requestedIndex);

    if (initialScrollDoneRef.current) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: requestedIndex,
        animated: false,
      });
      initialScrollDoneRef.current = true;
    });

    return () => cancelAnimationFrame(frame);
  }, [items.length, requestedIndex]);

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
      await postReactionToggle(token, { entityType: 'gallery_photo', entityId: String(photoId) });
    } catch {
      // Best-effort only inside the lightbox.
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

  const visibleIndex = items.length > 0 ? Math.min(currentIndex, items.length - 1) : 0;

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {chromeVisible ? (
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
                {visibleIndex + 1} / {items.length}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => {
              const uri = items[visibleIndex]?.uri;
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
      ) : null}

      {items.length > 0 && chromeVisible ? (
        <View style={[styles.hintBar, { bottom: Platform.OS === 'ios' ? (isLandscape ? 20 : 48) : 24 }]} pointerEvents="none">
          <Text style={styles.hintText}>Tap to hide controls  ·  Double-tap to like  ·  Pinch to zoom</Text>
        </View>
      ) : null}

      {currentPhoto && chromeVisible ? (
        <View style={[styles.bottomOverlay, { bottom: Platform.OS === 'ios' ? (isLandscape ? 18 : 48) : 28 }]}>
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
            <View style={[styles.commentsPanel, { maxHeight: pageHeight * (isLandscape ? 0.55 : 0.42) }]}>
              <FlatList
                data={comments}
                keyExtractor={(item) => String(item.id)}
                keyboardShouldPersistTaps="handled"
                style={[styles.commentsList, { maxHeight: pageHeight * (isLandscape ? 0.34 : 0.22) }]}
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

      <FlatList
        ref={listRef}
        key={`${pageWidth}x${pageHeight}`}
        data={items}
        keyExtractor={(item) => String(item.id)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        getItemLayout={(_, index) => ({
          length: pageWidth,
          offset: pageWidth * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          const safeIndex = Math.max(0, Math.min(info.index, items.length - 1));
          requestAnimationFrame(() => {
            listRef.current?.scrollToOffset({
              offset: safeIndex * pageWidth,
              animated: false,
            });
          });
        }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <ZoomablePhoto
            uri={item.uri}
            width={pageWidth}
            height={pageHeight}
            photoId={item.id}
            onZoomed={handleZoomed}
            onToggleChrome={() => setChromeVisible((visible) => !visible)}
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
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.72)',
    padding: 12,
    gap: 10,
  },
  commentsList: {
    maxHeight: 220,
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
    fontSize: 13,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    backgroundColor: '#000',
  },
  heartBurst: {
    position: 'absolute',
    alignSelf: 'center',
  },
});
