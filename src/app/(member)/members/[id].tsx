import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useGlobalSearchParams, type Href } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Input, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { BackLink } from '@/components/ui/back-link';
import { Screen } from '@/components/ui/screen';
import { RichBody } from '@/components/content/rich-body';
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
import { resolveBackendUrl } from '@/lib/api/bases';
import { mapMemberDetailFromWire } from '@/lib/api/wire-alignment';

type TaggedPhotosResponse = {
  summary?: {
    photoCount?: number;
    albumCount?: number;
  };
  photos?: Array<{
    photoId: number;
    photoUrl: string;
    albumTitle?: string | null;
    albumId?: number;
  }>;
};

type ReactionsResponse = {
  count?: number;
  likedByMe?: boolean;
};

function formatContribution(amount?: string) {
  if (!amount) return null;
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return amount;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(numeric);
}

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
  const backgroundColor = active ? '#F1D7CA' : 'rgba(255,255,255,0.08)';
  const borderColor = active ? '#F1D7CA' : 'rgba(255,255,255,0.12)';
  const iconColor = active ? '#172236' : '#E7CEC2';
  const countColor = active ? '#172236' : '#FFF7F2';
  const labelColor = active ? '#3A4A61' : '#CFD7E1';

  return (
    <Pressable onPress={onPress} style={[styles.actionStat, { backgroundColor, borderColor }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={[styles.actionCount, { color: countColor }]}>{count}</Text>
      <Text style={[styles.actionLabel, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

export default function MemberDetailScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const queryClient = useQueryClient();
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);
  const [commentBody, setCommentBody] = useState('');
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
    queryFn: () => getReactions({ entityType: 'member', entityId: String(id) }, useAuthStore.getState().accessToken),
  });

  const taggedPhotosQuery = useQuery({
    queryKey: ['member-tagged-photos', id],
    queryFn: () => getMemberTaggedPhotos(String(id)),
  });

  const reactionMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return postReactionToggle(token, { entityType: 'member', entityId: String(id) });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['member-reactions', id] });
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
        entityType: 'member',
        entityId: String(id),
        body: commentBody,
      });
    },
    onSuccess: () => {
      setCommentBody('');
      void queryClient.invalidateQueries({ queryKey: ['member-comments', id] });
    },
    onError: (error) => {
      Alert.alert('Unable to comment', error instanceof Error ? error.message : 'Try again.');
    },
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
    commentsQuery.data && typeof commentsQuery.data === 'object' && 'comments' in commentsQuery.data
      ? ((commentsQuery.data as { comments?: Array<{ id: number; body: string; author?: { name?: string } }> }).comments ?? [])
      : [];
  const reactions = (reactionsQuery.data ?? {}) as ReactionsResponse;
  const taggedPhotos = useMemo(
    () =>
      ((((taggedPhotosQuery.data ?? {}) as TaggedPhotosResponse).photos ?? [])).map((photo) => ({
        ...photo,
        resolvedUrl: resolveBackendUrl(photo.photoUrl ?? null),
      })),
    [taggedPhotosQuery.data],
  );
  const taggedSummary = ((taggedPhotosQuery.data ?? {}) as TaggedPhotosResponse).summary ?? {};

  return (
    <Screen scroll>
      <BackLink label="Back to directory" />
      <SectionTitle
        eyebrow="Contact Card"
        title={member.display_name || 'Member'}
        subtitle={member.location_label || 'SJC 2001 member directory'}
      />

      <Card style={[styles.heroCard, { backgroundColor: colors.text, borderColor: colors.text }] }>
        <View style={styles.heroTopRow}>
          <View style={styles.heroMeta}>
            <Text style={styles.heroKicker}>{contribution ? 'Contributor spotlight' : 'Silver Circle profile'}</Text>
            <Text style={styles.heroName}>{member.display_name || 'Member'}</Text>
            {member.location_label ? <Text style={styles.heroLocation}>{member.location_label}</Text> : null}
          </View>
          {member.isJoining ? (
            <View style={styles.joiningChip}>
              <Ionicons name="sparkles" size={12} color="#F6D9CB" />
              <Text style={styles.joiningText}>Joining</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.heroImageWrap}>
          {heroPhoto ? <Image source={{ uri: heroPhoto }} style={styles.heroPhoto} resizeMode="contain" /> : null}
        </View>

        {member.bioFromComments ? <Text style={styles.heroBody}>{member.bioFromComments}</Text> : null}

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
      </Card>

      <View style={styles.infoGrid}>
        <Card style={[styles.infoCard, { backgroundColor: colors.surface }] }>
          <Text style={[styles.metaHeading, { color: colors.text }]}>Contact</Text>
          {member.email ? <Text style={[styles.metaText, { color: colors.textSecondary }]}>Email: {member.email}</Text> : null}
          {member.phone ? <Text style={[styles.metaText, { color: colors.textSecondary }]}>Phone: {member.phone}</Text> : null}
          {member.location_label ? <Text style={[styles.metaText, { color: colors.textSecondary }]}>Location: {member.location_label}</Text> : null}
        </Card>
        <Card style={[styles.infoCard, { backgroundColor: colors.backgroundSoft }] }>
          <Text style={[styles.metaHeading, { color: colors.text }]}>Reunion status</Text>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {member.isJoining ? 'Marked as joining the reunion.' : 'No reunion attendance marked yet.'}
          </Text>
          {contribution ? <Text style={[styles.metaText, { color: colors.textSecondary }]}>Contribution: {contribution}</Text> : null}
        </Card>
      </View>

      {taggedPhotos.length > 0 ? (
        <Card style={styles.previewShell}>
          <View style={styles.previewHeader}>
            <Text style={[styles.metaHeading, { color: colors.text }]}>Tagged photos</Text>
            <Pressable onPress={() => router.push(`/(member)/members/${id}/tagged` as Href)}>
              <Text style={[styles.previewLink, { color: colors.accent }]}>View all</Text>
            </Pressable>
          </View>
          <View style={styles.previewRow}>
            {taggedPhotos.slice(0, 3).map((photo) =>
              photo.resolvedUrl ? (
                <Image key={photo.photoId} source={{ uri: photo.resolvedUrl }} style={styles.taggedPhoto} resizeMode="cover" />
              ) : null,
            )}
          </View>
        </Card>
      ) : null}

      <View style={styles.commentStack}>
        {comments.map((comment) => (
          <Card key={comment.id} style={[styles.commentCard, { backgroundColor: colors.surface }] }>
            <Text style={[styles.commentAuthor, { color: colors.text }]}>{comment.author?.name ?? 'Member'}</Text>
            <RichBody body={comment.body} />
          </Card>
        ))}
      </View>

      <Card style={[styles.commentComposer, { backgroundColor: colors.backgroundSoft }] }>
        <Text style={[styles.metaHeading, { color: colors.text }]}>Join the conversation</Text>
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
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 34,
    gap: Spacing.three,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  heroMeta: {
    flex: 1,
    gap: Spacing.one,
  },
  heroKicker: {
    color: '#EED8CE',
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroName: {
    color: '#FFF7F1',
    fontFamily: Fonts.rounded,
    fontSize: 32,
    lineHeight: 38,
  },
  heroLocation: {
    color: '#D4DCE5',
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
  },
  joiningChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  joiningText: {
    color: '#F6D9CB',
    fontFamily: Fonts.rounded,
    fontSize: 12,
  },
  heroImageWrap: {
    height: 240,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPhoto: {
    width: '100%',
    height: '100%',
  },
  heroBody: {
    color: '#E9EEF4',
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 23,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  actionStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionCount: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
  },
  actionLabel: {
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  infoGrid: {
    gap: Spacing.three,
  },
  infoCard: {
    borderRadius: 28,
  },
  metaHeading: {
    fontFamily: Fonts.rounded,
    fontSize: 20,
  },
  metaText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  previewShell: {
    borderRadius: 28,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLink: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },
  previewRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  taggedPhoto: {
    flex: 1,
    height: 110,
    borderRadius: 20,
  },
  commentStack: {
    gap: Spacing.three,
  },
  commentCard: {
    borderRadius: 24,
  },
  commentAuthor: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },
  commentComposer: {
    borderRadius: 28,
  },
  commentInput: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: Spacing.three,
  },
});
