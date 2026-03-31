import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
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

import { postReactionToggle, getGalleryAlbum } from '@/features/content/api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useSharePhoto } from '@/hooks/use-share-photo';
import { resolveBackendUrl } from '@/lib/api/bases';

const { width: SW, height: SH } = Dimensions.get('window');

type Photo = { id?: number; photoUrl?: string };

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
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);
  const { share, sharing } = useSharePhoto();

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
