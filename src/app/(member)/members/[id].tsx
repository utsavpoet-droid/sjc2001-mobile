import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useGlobalSearchParams, type Href } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { GhostButton, Input, PrimaryButton } from '@/components/ui/primitives';
import { RichBody } from '@/components/content/rich-body';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import {
  getComments,
  getMember,
  getMemberTaggedPhotos,
  getReactions,
  postComment,
  postReactionToggle,
} from '@/features/content/api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getMemberProfiles, memberProfileHasContent } from '@/features/member/api';
import { resolveBackendUrl } from '@/lib/api/bases';
import { mapMemberDetailFromWire } from '@/lib/api/wire-alignment';

const SW = Dimensions.get('window').width;
const PHOTO_WIDTH = SW - Spacing.three * 2;
const MAX_HERO_HEIGHT = SW * 1.1;
type ThemeColors = (typeof Colors)[keyof typeof Colors];

// ─── Types ────────────────────────────────────────────────────────────────────

type TaggedPhotosResponse = {
  summary?: { photoCount?: number; albumCount?: number };
  photos?: Array<{ photoId: number; photoUrl: string; albumTitle?: string | null; albumId?: number }>;
};
type ReactionsResponse = { count?: number; likedByMe?: boolean };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatContribution(amount?: string) {
  if (!amount) return null;
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(numeric);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ─── Action stat pill ─────────────────────────────────────────────────────────

function ActionStat({
  icon,
  label,
  count,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count: number;
  active?: boolean;
  onPress?: () => void;
}) {
  const bg = active ? '#F1D7CA' : 'rgba(255,255,255,0.1)';
  const border = active ? '#F1D7CA' : 'rgba(255,255,255,0.14)';
  const iconColor = active ? '#172236' : '#E7CEC2';
  const textColor = active ? '#172236' : '#FFF7F2';

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={[styles.actionStat, { backgroundColor: bg, borderColor: border }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={[styles.actionCount, { color: textColor }]}>{count}</Text>
      <Text style={[styles.actionLabel, { color: textColor, opacity: 0.75 }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Contact info row ─────────────────────────────────────────────────────────

function ContactRow({
  icon,
  label,
  value,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.contactRow,
        { borderBottomColor: colors.border },
        onPress && { opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={[styles.contactIconWrap, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name={icon} size={16} color={colors.accent} />
      </View>
      <View style={styles.contactText}>
        <Text style={[styles.contactLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.contactValue, { color: colors.text }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={14} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

// ─── Comment bubble ───────────────────────────────────────────────────────────

function CommentBubble({
  author,
  body,
  colors,
}: {
  author: string;
  body: string;
  colors: ThemeColors;
}) {
  const mono = initials(author);
  return (
    <View style={styles.commentBubble}>
      <View style={[styles.commentAvatar, { backgroundColor: colors.accentSoft }]}>
        <Text style={[styles.commentAvatarText, { color: colors.accent }]}>{mono}</Text>
      </View>
      <View style={[styles.commentBody, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.commentAuthor, { color: colors.text }]}>{author}</Text>
        <RichBody body={body} />
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function MemberDetailScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const queryClient = useQueryClient();
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);
  const [commentBody, setCommentBody] = useState('');
  const [heroHeight, setHeroHeight] = useState(PHOTO_WIDTH * 0.9);
  const commentInputRef = useRef<TextInput>(null);

  const memberQuery = useQuery({
    queryKey: ['member', id],
    queryFn: () => getMember(String(id)),
  });
  const commentsQuery = useQuery({
    queryKey: ['member-comments', id],
    queryFn: () => getComments({ entityType: 'member', entityId: String(id), page: 1, limit: 20 }),
  });
  const reactionsQuery = useQuery({
    queryKey: ['member-reactions', id],
    queryFn: () =>
      getReactions(
        { entityType: 'member', entityId: String(id) },
        useAuthStore.getState().accessToken,
      ),
  });
  const taggedPhotosQuery = useQuery({
    queryKey: ['member-tagged-photos', id],
    queryFn: () => getMemberTaggedPhotos(String(id)),
  });

  const memberProfileQuery = useQuery({
    queryKey: ['member-profile-by-member', id],
    enabled: !!id && memberQuery.isSuccess,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      const response = await getMemberProfiles(token, { page: 1, limit: 500 });
      return response.profiles.find((item) => String(item.user?.memberId ?? '') === String(id)) ?? null;
    },
  });

  const reactionMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return postReactionToggle(token, { entityType: 'member', entityId: String(id) });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['member-reactions', id] }),
    onError: (e) =>
      Alert.alert('Unable to react', e instanceof Error ? e.message : 'Try again.'),
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return postComment(token, { entityType: 'member', entityId: String(id), body: commentBody });
    },
    onSuccess: () => {
      setCommentBody('');
      void queryClient.invalidateQueries({ queryKey: ['member-comments', id] });
    },
    onError: (e) =>
      Alert.alert('Unable to comment', e instanceof Error ? e.message : 'Try again.'),
  });

  if (memberQuery.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const member = mapMemberDetailFromWire((memberQuery.data ?? {}) as Record<string, unknown>);
  const contribution = formatContribution(member.contributionAmount);
  const heroPhoto = member.photo_urls[0] ?? member.avatar_url ?? null;
  const comments =
    commentsQuery.data &&
    typeof commentsQuery.data === 'object' &&
    'comments' in commentsQuery.data
      ? (
          (
            commentsQuery.data as {
              comments?: Array<{ id: number; body: string; author?: { name?: string } }>;
            }
          ).comments ?? []
        )
      : [];
  const reactions = (reactionsQuery.data ?? {}) as ReactionsResponse;
  const taggedPhotos = useMemo(
    () =>
      (((taggedPhotosQuery.data ?? {}) as TaggedPhotosResponse).photos ?? []).map((p) => ({
        ...p,
        resolvedUrl: resolveBackendUrl(p.photoUrl ?? null),
      })),
    [taggedPhotosQuery.data],
  );
  const taggedSummary = ((taggedPhotosQuery.data ?? {}) as TaggedPhotosResponse).summary ?? {};
  const tappableTaggedUris = taggedPhotos
    .map((p) => p.resolvedUrl)
    .filter((u): u is string => Boolean(u));
  const hasExtendedProfile = memberProfileHasContent(memberProfileQuery.data);

  return (
    <Screen scroll>
      <BackLink label="Back to directory" />

      {/* ── HERO PHOTO CARD ──────────────────────────────────────── */}
      <View style={styles.heroCard}>
        {/* Photo or gradient fallback */}
        {heroPhoto ? (
          <Image
            source={{ uri: heroPhoto }}
            style={[styles.heroPhoto, { height: heroHeight }]}
            contentFit="cover"
            onLoad={(e) => {
              const { width: w, height: h } = e.source;
              if (w > 0 && h > 0) {
                setHeroHeight(Math.min(PHOTO_WIDTH * (h / w), MAX_HERO_HEIGHT));
              }
            }}
          />
        ) : (
          <LinearGradient
            colors={['#1C0F07', '#4A2010']}
            style={[styles.heroPhoto, { height: PHOTO_WIDTH * 0.75, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={styles.heroInitials}>{initials(member.display_name || '?')}</Text>
          </LinearGradient>
        )}

        {/* Gradient overlay at photo bottom → name/location */}
        <LinearGradient
          colors={['transparent', 'rgba(10,5,2,0.72)', 'rgba(10,5,2,0.96)']}
          style={styles.heroOverlay}>
          <View style={styles.heroOverlayContent}>
            {member.isJoining ? (
              <View style={styles.joiningChip}>
                <Ionicons name="sparkles" size={11} color="#F6D9CB" />
                <Text style={styles.joiningText}>Joining the reunion</Text>
              </View>
            ) : null}
            <Text style={styles.heroName}>{member.display_name || 'Member'}</Text>
            {member.location_label ? (
              <Text style={styles.heroLocation}>{member.location_label}</Text>
            ) : null}
          </View>
        </LinearGradient>

        {/* Action stats row */}
        <View style={styles.actionsRow}>
          <ActionStat
            icon={reactions.likedByMe ? 'heart' : 'heart-outline'}
            label="Likes"
            count={reactions.count ?? 0}
            active={reactions.likedByMe}
            onPress={() => reactionMutation.mutate()}
          />
          <ActionStat
            icon={comments.length > 0 ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
            label="Comments"
            count={comments.length}
            active={comments.length > 0}
            onPress={() => commentInputRef.current?.focus()}
          />
          <ActionStat
            icon="images-outline"
            label="Tagged"
            count={taggedSummary.photoCount ?? 0}
            onPress={() => router.push(`/(member)/members/${id}/tagged` as Href)}
          />
        </View>
      </View>

      {/* ── BIO ──────────────────────────────────────────────────── */}
      {member.bioFromComments ? (
        <View style={[styles.bioCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.bioText, { color: colors.text }]}>{member.bioFromComments}</Text>
        </View>
      ) : null}

      {hasExtendedProfile ? (
        <Pressable
          onPress={() => router.push(`/(member)/profile?memberId=${id}` as Href)}
          style={[styles.profilePreviewLink, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View>
            <Text style={[styles.profilePreviewEyebrow, { color: colors.textMuted }]}>Extended profile</Text>
            <Text style={[styles.profilePreviewTitle, { color: colors.text }]}>View profile</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}

      {/* ── CONTACT INFO ─────────────────────────────────────────── */}
      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.infoHeading, { color: colors.text }]}>Contact</Text>
        {member.email ? (
          <ContactRow
            icon="mail-outline"
            label="Email"
            value={member.email}
            onPress={() => void Linking.openURL(`mailto:${member.email}`)}
            colors={colors}
          />
        ) : null}
        {member.phone ? (
          <ContactRow
            icon="call-outline"
            label="Phone"
            value={member.phone}
            onPress={() => void Linking.openURL(`tel:${member.phone}`)}
            colors={colors}
          />
        ) : null}
        {member.location_label ? (
          <ContactRow
            icon="location-outline"
            label="Location"
            value={member.location_label}
            colors={colors}
          />
        ) : null}
        {!member.email && !member.phone && !member.location_label ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No contact details listed.</Text>
        ) : null}
      </View>

      {/* ── REUNION STATUS ────────────────────────────────────────── */}
      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.infoHeading, { color: colors.text }]}>Reunion</Text>
        <View style={styles.reunionRow}>
          <View
            style={[
              styles.reunionDot,
              { backgroundColor: member.isJoining ? colors.success : colors.border },
            ]}
          />
          <Text style={[styles.reunionStatus, { color: colors.textSecondary }]}>
            {member.isJoining ? 'Attending the Silver Jubilee' : 'Attendance not confirmed yet'}
          </Text>
        </View>
        {contribution ? (
          <View style={styles.reunionRow}>
            <View style={[styles.reunionDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.reunionStatus, { color: colors.textSecondary }]}>
              Contributed {contribution}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── TAGGED PHOTOS ─────────────────────────────────────────── */}
      {taggedPhotos.length > 0 ? (
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.taggedHeader}>
            <Text style={[styles.infoHeading, { color: colors.text }]}>Tagged photos</Text>
            <Pressable
              onPress={() => router.push(`/(member)/members/${id}/tagged` as Href)}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text style={[styles.viewAllLink, { color: colors.accent }]}>
                View all ({taggedSummary.photoCount ?? taggedPhotos.length})
              </Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.taggedScroll}>
            {taggedPhotos.map((photo, index) =>
              photo.resolvedUrl ? (
                <Pressable
                  key={photo.photoId}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(
                      `/(member)/photo-preview?uris=${encodeURIComponent(JSON.stringify(tappableTaggedUris))}&startIndex=${index}` as never,
                    );
                  }}
                  style={({ pressed }) => [styles.taggedThumb, { opacity: pressed ? 0.85 : 1 }]}>
                  <Image
                    source={{ uri: photo.resolvedUrl }}
                    style={styles.taggedThumbImg}
                    contentFit="cover"
                    recyclingKey={photo.resolvedUrl}
                  />
                </Pressable>
              ) : null,
            )}
          </ScrollView>
        </View>
      ) : null}

      {/* ── COMMENTS ─────────────────────────────────────────────── */}
      {comments.length > 0 ? (
        <View style={styles.commentStack}>
          <Text style={[styles.infoHeading, { color: colors.text }]}>
            {comments.length === 1 ? '1 comment' : `${comments.length} comments`}
          </Text>
          {comments.map((c) => (
            <CommentBubble
              key={c.id}
              author={c.author?.name ?? 'Member'}
              body={c.body}
              colors={colors}
            />
          ))}
        </View>
      ) : null}

      {/* ── COMMENT COMPOSER ─────────────────────────────────────── */}
      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.infoHeading, { color: colors.text }]}>Leave a note</Text>
        <Input
          ref={commentInputRef}
          value={commentBody}
          onChangeText={setCommentBody}
          placeholder="Write something thoughtful..."
          multiline
          style={styles.commentInput}
        />
        <PrimaryButton busy={commentMutation.isPending} onPress={() => commentMutation.mutate()}>
          Post comment
        </PrimaryButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Hero
  heroCard: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#0D0A08',
  },
  heroPhoto: {
    width: '100%',
    borderRadius: 0,
  },
  heroInitials: {
    color: '#EAD4C7',
    fontFamily: Fonts.rounded,
    fontSize: 64,
    opacity: 0.4,
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 72, // leave room for action stats
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.three,
  },
  heroOverlayContent: {
    gap: Spacing.one,
  },
  joiningChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    marginBottom: Spacing.one,
  },
  joiningText: {
    color: '#F6D9CB',
    fontFamily: Fonts.rounded,
    fontSize: 11,
  },
  heroName: {
    color: '#FFF7F1',
    fontFamily: Fonts.rounded,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  heroLocation: {
    color: '#C8D4E0',
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    backgroundColor: 'rgba(10,5,2,0.96)',
  },
  actionStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
  },
  actionCount: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
  },
  actionLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },

  // Bio
  bioCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: Spacing.four,
  },
  profilePreviewLink: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  profilePreviewEyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  profilePreviewTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
  },
  bioText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 24,
  },

  // Info cards
  infoCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  infoHeading: {
    fontFamily: Fonts.rounded,
    fontSize: 20,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },

  // Contact rows
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  contactIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: {
    flex: 1,
    gap: 2,
  },
  contactLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  contactValue: {
    fontFamily: Fonts.sans,
    fontSize: 15,
  },

  // Reunion
  reunionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  reunionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  reunionStatus: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },

  // Tagged photos
  taggedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAllLink: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },
  taggedScroll: {
    marginHorizontal: -Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  taggedThumb: {
    marginRight: Spacing.two,
  },
  taggedThumbImg: {
    width: 130,
    height: 130,
    borderRadius: 16,
  },

  // Comments
  commentStack: {
    gap: Spacing.two,
  },
  commentBubble: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  commentAvatarText: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
  },
  commentBody: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  commentAuthor: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },

  // Composer
  commentInput: {
    minHeight: 110,
    textAlignVertical: 'top',
    paddingTop: Spacing.three,
  },
});
