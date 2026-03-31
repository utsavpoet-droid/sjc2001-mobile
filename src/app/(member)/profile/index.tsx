import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams, useRouter, useSegments, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { GhostButton } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import {
  type MemberProfile,
  type MemberProfileDirectoryItem,
  getMemberProfile,
  getMemberProfiles,
} from '@/features/member/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveBackendUrl } from '@/lib/api/bases';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CONTENT_PADDING = Spacing.three * 2; // 32px total
const PHOTO_WIDTH = SCREEN_WIDTH - CONTENT_PADDING;
const MAX_PORTRAIT_HEIGHT = SCREEN_WIDTH * 1.2; // cap tall portraits

// ─── Helper: opens photo-preview lightbox ────────────────────────────────────

function usePhotoPreview() {
  const router = useRouter();
  return (uris: string[], startIndex = 0) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(
      `/(member)/photo-preview?uris=${encodeURIComponent(JSON.stringify(uris))}&startIndex=${startIndex}` as never,
    );
  };
}

// ─── Section divider: ──── THEN · 2001 ──── ──────────────────────────────────

function SectionDivider({
  label,
  year,
  color,
}: {
  label: string;
  year?: string;
  color: string;
}) {
  return (
    <View style={styles.dividerRow}>
      <View style={[styles.dividerLine, { backgroundColor: color }]} />
      <Text style={[styles.dividerText, { color }]}>
        {label}
        {year ? ` · ${year}` : ''}
      </Text>
      <View style={[styles.dividerLine, { backgroundColor: color }]} />
    </View>
  );
}

// ─── Smart photo: auto-sizes to image aspect ratio ───────────────────────────

function SmartPhoto({
  uri,
  onPress,
}: {
  uri: string;
  onPress: () => void;
}) {
  const [height, setHeight] = useState(PHOTO_WIDTH * 0.75); // default 4:3 until loaded

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.smartPhotoWrap, { opacity: pressed ? 0.88 : 1 }]}>
      <Image
        source={{ uri }}
        style={[styles.smartPhoto, { width: PHOTO_WIDTH, height }]}
        contentFit="contain"
        recyclingKey={uri}
        onLoad={(e) => {
          const { width: w, height: h } = e.source;
          if (w > 0 && h > 0) {
            const ratio = h / w;
            const computed = PHOTO_WIDTH * ratio;
            setHeight(Math.min(computed, MAX_PORTRAIT_HEIGHT));
          }
        }}
      />
      {/* Tap hint overlay */}
      <View style={styles.expandHint} pointerEvents="none">
        <View style={styles.expandPill}>
          <Text style={styles.expandPillText}>Tap to expand</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Family photo grid: adapts to 1, 2 or 3 photos ──────────────────────────

function FamilyGrid({
  uris,
  onPress,
}: {
  uris: string[];
  onPress: (index: number) => void;
}) {
  if (uris.length === 1) {
    return (
      <Pressable
        onPress={() => onPress(0)}
        style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
        <Image
          source={{ uri: uris[0] }}
          style={[styles.familySingle, { width: PHOTO_WIDTH }]}
          contentFit="contain"
          recyclingKey={uris[0]}
        />
      </Pressable>
    );
  }

  if (uris.length === 2) {
    const half = (PHOTO_WIDTH - Spacing.two) / 2;
    return (
      <View style={styles.familyRow}>
        {uris.map((uri, i) => (
          <Pressable
            key={uri}
            onPress={() => onPress(i)}
            style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
            <Image
              source={{ uri }}
              style={[styles.familyTile, { width: half, height: half * 1.25 }]}
              contentFit="contain"
              recyclingKey={uri}
            />
          </Pressable>
        ))}
      </View>
    );
  }

  // 3 photos: large left + 2 stacked right
  const leftW = PHOTO_WIDTH * 0.58;
  const rightW = PHOTO_WIDTH - leftW - Spacing.two;
  const totalH = leftW * 1.35;
  const rightH = (totalH - Spacing.two) / 2;

  return (
    <View style={styles.familyRow}>
      <Pressable
        onPress={() => onPress(0)}
        style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
        <Image
          source={{ uri: uris[0] }}
          style={[styles.familyTile, { width: leftW, height: totalH }]}
          contentFit="contain"
          recyclingKey={uris[0]}
        />
      </Pressable>
      <View style={[styles.familyRightCol, { gap: Spacing.two }]}>
        {uris.slice(1).map((uri, i) => (
          <Pressable
            key={uri}
            onPress={() => onPress(i + 1)}
            style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
            <Image
              source={{ uri }}
              style={[styles.familyTile, { width: rightW, height: rightH }]}
              contentFit="contain"
              recyclingKey={uri}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function MyProfileScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const router = useRouter();
  const segments = useSegments() as string[];
  const { memberId, fromTab } = useLocalSearchParams<{ memberId?: string; fromTab?: string }>();
  const user = useAuthStore((state) => state.user);
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);
  const openPreview = usePhotoPreview();
  const isOwnProfile = !memberId || String(memberId) === String(user?.memberId ?? '');
  const insideTabbedAccount = segments.includes('(tabs)') && segments.includes('account');
  const showBackLink = !(isOwnProfile && (fromTab === '1' || insideTabbedAccount));

  const ownProfileQuery = useQuery({
    queryKey: ['member-profile'],
    enabled: isOwnProfile,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return getMemberProfile(token);
    },
  });

  const otherProfileQuery = useQuery({
    queryKey: ['member-profile-by-member', memberId],
    enabled: Boolean(memberId) && !isOwnProfile,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      const response = await getMemberProfiles(token, { page: 1, limit: 500 });
      return response.profiles.find((item) => String(item.user?.memberId ?? '') === String(memberId)) ?? null;
    },
  });

  const profile = ((isOwnProfile ? ownProfileQuery.data : otherProfileQuery.data) ?? null) as
    | MemberProfile
    | MemberProfileDirectoryItem
    | null;
  const profileQueryLoading = isOwnProfile ? ownProfileQuery.isLoading : otherProfileQuery.isLoading;
  const profileMember = !isOwnProfile && profile && 'user' in profile ? (profile.user?.member ?? null) : null;
  const schoolPhoto = resolveBackendUrl(profile?.schoolPhotoUrl ?? null);
  const currentPhoto = resolveBackendUrl(profile?.currentPhotoUrl ?? null);
  const familyPhotos = (profile?.familyPhotos ?? [])
    .map((p) => resolveBackendUrl(p.photoUrl))
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  const allPhotoUris = [schoolPhoto, currentPhoto, ...familyPhotos].filter(
    (u): u is string => Boolean(u),
  );

  const profileName = isOwnProfile
    ? (user?.name ?? 'My Profile')
    : (profileMember?.name ?? 'Member Profile');
  const locationLabel = !isOwnProfile
    ? [profileMember?.city, profileMember?.country].filter(Boolean).join(', ')
    : '';
  const titleOrLocation = profile?.title || locationLabel;
  const hasThen = Boolean(schoolPhoto);
  const hasNow = Boolean(currentPhoto);
  const hasFamily = familyPhotos.length > 0;
  const hasMessage = Boolean(profile?.comments);

  return (
    <Screen scroll>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          {showBackLink ? <BackLink label={isOwnProfile ? 'Back to profile' : 'Back to contact'} /> : null}
        </View>
        {isOwnProfile ? (
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(member)/settings');
            }}
            style={[styles.settingsButton, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Ionicons name="settings-outline" size={18} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      {profileQueryLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: Spacing.four }} />
      ) : null}

      <LinearGradient
        colors={['#1C0F07', '#3D1E0F', '#7A3820']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBanner}>
        <View style={styles.avatarRing}>
          {allPhotoUris[0] ? (
          <Image
            source={{ uri: allPhotoUris[0] }}
            style={styles.avatar}
            contentFit="contain"
          />
          ) : (
            <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
          )}
        </View>

        <Text style={styles.heroName}>{profileName}</Text>
        {titleOrLocation ? (
          <Text style={styles.heroTitle}>{titleOrLocation}</Text>
        ) : null}

        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>SJC Batch of 2001</Text>
        </View>
      </LinearGradient>

      {hasMessage ? (
        <View style={[styles.quoteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.quoteMark, { color: colors.accent }]}>"</Text>
          <Text style={[styles.quoteBody, { color: colors.text }]}>
            {profile!.comments}
          </Text>
        </View>
      ) : null}

      {hasThen || !profileQueryLoading ? (
        <SectionDivider label="THEN" year="2001" color={colors.textMuted} />
      ) : null}

      {hasThen ? (
        <SmartPhoto
          uri={schoolPhoto!}
          onPress={() => openPreview([schoolPhoto!], 0)}
        />
      ) : !profileQueryLoading ? (
        <View style={[styles.emptyPhoto, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}> 
          <Text style={[styles.emptyPhotoText, { color: colors.textMuted }]}>School photo not added yet</Text>
        </View>
      ) : null}

      {hasNow || !profileQueryLoading ? (
        <SectionDivider label="NOW" year="2025" color={colors.textMuted} />
      ) : null}

      {hasNow ? (
        <SmartPhoto
          uri={currentPhoto!}
          onPress={() => openPreview([currentPhoto!], 0)}
        />
      ) : !profileQueryLoading ? (
        <View style={[styles.emptyPhoto, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}> 
          <Text style={[styles.emptyPhotoText, { color: colors.textMuted }]}>Current photo not added yet</Text>
        </View>
      ) : null}

      {hasFamily ? (
        <>
          <SectionDivider label="FAMILY" color={colors.textMuted} />
          <FamilyGrid
            uris={familyPhotos}
            onPress={(index) => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              openPreview(familyPhotos, index);
            }}
          />
        </>
      ) : null}

      {isOwnProfile ? (
        <Link href={'/(member)/profile/edit' as Href} asChild>
          <GhostButton>Edit Profile</GhostButton>
        </Link>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  topBarLeft: {
    flex: 1,
  },
  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Hero
  heroBanner: {
    borderRadius: 28,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
    overflow: 'hidden',
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3,
    borderColor: 'rgba(240,139,99,0.6)',
    overflow: 'hidden',
    marginBottom: Spacing.two,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  heroName: {
    color: '#FFF7F1',
    fontFamily: Fonts.rounded,
    fontSize: 30,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  heroTitle: {
    color: '#EAD4C7',
    fontFamily: Fonts.sans,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  heroBadge: {
    marginTop: Spacing.one,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroBadgeText: {
    color: '#EAD4C7',
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // Quote
  quoteCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  quoteMark: {
    fontFamily: Fonts.serif,
    fontSize: 48,
    lineHeight: 40,
    opacity: 0.7,
  },
  quoteBody: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    lineHeight: 26,
    fontStyle: 'italic',
  },

  // Section divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginVertical: Spacing.one,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.35,
  },
  dividerText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Smart photo
  smartPhotoWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(17, 12, 10, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  smartPhoto: {
    borderRadius: 20,
  },
  expandHint: {
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
  expandPill: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  expandPillText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: Fonts.sans,
  },

  // Empty photo placeholder
  emptyPhoto: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPhotoText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },

  // Family grid
  familyRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  familyRightCol: {
    flex: 1,
  },
  familySingle: {
    height: PHOTO_WIDTH * 0.65,
    borderRadius: 16,
    backgroundColor: 'rgba(17, 12, 10, 0.96)',
  },
  familyTile: {
    borderRadius: 16,
    backgroundColor: 'rgba(17, 12, 10, 0.96)',
  },
});
