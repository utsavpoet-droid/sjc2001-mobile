/**
 * Generic fullscreen photo viewer.
 * Accepts `uris` (JSON array, URI-encoded) and optional `startIndex`.
 * Used by profile photos, member cards, etc. — anywhere outside the gallery.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSharePhoto } from '@/hooks/use-share-photo';
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
  withSpring,
} from 'react-native-reanimated';

const { width: SW, height: SH } = Dimensions.get('window');

function ZoomablePhoto({
  uri,
  onZoomed,
}: {
  uri: string;
  onZoomed: (zoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

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
      scale.value = withSpring(1, { damping: 20, stiffness: 200 });
      savedScale.value = 1;
      runOnJS(onZoomed)(false);
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
      </Animated.View>
    </GestureDetector>
  );
}

export default function PhotoPreviewScreen() {
  const router = useRouter();
  const { uris: urisParam, startIndex } = useLocalSearchParams<{
    uris: string;
    startIndex: string;
  }>();

  const uris: string[] = (() => {
    try {
      return JSON.parse(decodeURIComponent(urisParam ?? '[]'));
    } catch {
      return [];
    }
  })();

  const [currentIndex, setCurrentIndex] = useState(Number(startIndex ?? 0));
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const { share, sharing } = useSharePhoto();

  const handleZoomed = useCallback((zoomed: boolean) => {
    setScrollEnabled(!zoomed);
  }, []);

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

        {uris.length > 1 ? (
          <View style={styles.counterPill}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {uris.length}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            const uri = uris[currentIndex];
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

      <FlatList
        data={uris}
        keyExtractor={(_, i) => String(i)}
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
        renderItem={({ item: uri }) => (
          <ZoomablePhoto uri={uri} onZoomed={handleZoomed} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
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
  counterText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  photoSlide: {
    width: SW,
    height: SH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { width: SW, height: SH },
});
