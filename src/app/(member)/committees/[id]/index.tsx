import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import {
  getCommitteeDetail,
  getCommitteeFeed,
  getPostReactions,
  togglePostReaction,
} from '@/features/committees/api';
import { CommitteePollCard } from '@/features/committees/poll-card';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type {
  CommitteePostDto,
  CommitteePostType,
} from '@shared/contracts/committees-contract';

const POST_TYPE_LABEL: Record<CommitteePostType, string> = {
  MESSAGE: 'Message',
  ANNOUNCEMENT: 'Announcement',
  DECISION: 'Decision',
  POLL_REF: 'Poll',
  TASK_REF: 'Task',
  MEETING_REF: 'Meeting',
  SYSTEM: 'System',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function PostEngagementBar({ committeeId, postId }: { committeeId: number; postId: number }) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const reactionsQuery = useQuery({
    queryKey: ['committees', 'post', postId, 'reactions'],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getPostReactions(token, postId);
    },
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return togglePostReaction(token, postId);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['committees', 'post', postId, 'reactions'] });
      const prev = queryClient.getQueryData<{ count: number; likedByMe: boolean; likers: unknown[] }>([
        'committees',
        'post',
        postId,
        'reactions',
      ]);
      if (prev) {
        queryClient.setQueryData(['committees', 'post', postId, 'reactions'], {
          ...prev,
          count: prev.likedByMe ? Math.max(0, prev.count - 1) : prev.count + 1,
          likedByMe: !prev.likedByMe,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['committees', 'post', postId, 'reactions'], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['committees', 'post', postId, 'reactions'] });
    },
  });

  const liked = reactionsQuery.data?.likedByMe ?? false;
  const count = reactionsQuery.data?.count ?? 0;

  return (
    <View style={styles.engagementBar}>
      <Pressable
        onPress={() => toggleMutation.mutate()}
        disabled={toggleMutation.isPending}
        style={({ pressed }) => [
          styles.engagementBtn,
          { opacity: pressed ? 0.6 : 1 },
        ]}>
        <Ionicons
          name={liked ? 'heart' : 'heart-outline'}
          size={18}
          color={liked ? colors.accent : colors.textSecondary}
        />
        <Text style={[styles.engagementText, { color: liked ? colors.accent : colors.textSecondary }]}>
          {count > 0 ? count : 'Like'}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => router.push(`/(member)/committees/${committeeId}/posts/${postId}`)}
        style={({ pressed }) => [
          styles.engagementBtn,
          { opacity: pressed ? 0.6 : 1 },
        ]}>
        <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
        <Text style={[styles.engagementText, { color: colors.textSecondary }]}>
          Comment
        </Text>
      </Pressable>
    </View>
  );
}

function PostCard({
  committeeId,
  post,
  canManagePolls,
}: {
  committeeId: number;
  post: CommitteePostDto;
  canManagePolls?: boolean;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const authorName = post.author?.member?.name ?? 'Unknown';
  const isAnnouncement = post.type === 'ANNOUNCEMENT';
  const isSystem = post.type === 'SYSTEM';

  return (
    <Card style={[styles.post, isAnnouncement && { borderColor: colors.accent, borderWidth: 1.5 }]}>
      <View style={styles.postHeader}>
        <Text style={[styles.author, { color: colors.text }]}>{authorName}</Text>
        {post.pinnedAt ? (
          <Ionicons name="pin" size={13} color={colors.accent} />
        ) : null}
        {!isSystem && post.type !== 'MESSAGE' ? (
          <View style={[styles.typeChip, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.typeChipText, { color: colors.accent }]}>
              {POST_TYPE_LABEL[post.type]}
            </Text>
          </View>
        ) : null}
        <Text style={[styles.time, { color: colors.textMuted }]}>
          {formatTime(post.createdAt)}
        </Text>
      </View>
      <Text style={[styles.body, { color: isSystem ? colors.textSecondary : colors.text }]}>
        {post.body}
      </Text>
      {post.type === 'POLL_REF' && post.poll ? (
        <CommitteePollCard
          committeeId={committeeId}
          poll={post.poll}
          canClose={canManagePolls}
        />
      ) : null}
      {post.type === 'TASK_REF' && post.task ? (
        <Pressable
          onPress={() =>
            router.push(`/(member)/committees/${committeeId}/tasks/${post.task!.id}`)
          }
          style={({ pressed }) => [
            styles.refCard,
            { borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 },
          ]}>
          <Ionicons name="checkbox-outline" size={16} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.refTitle, { color: colors.text }]}>{post.task.title}</Text>
            <Text style={[styles.refMeta, { color: colors.textMuted }]}>
              {post.task.status === 'DONE'
                ? 'Done'
                : post.task.status === 'CANCELLED'
                ? 'Cancelled'
                : post.task.status === 'IN_PROGRESS'
                ? 'In progress'
                : post.task.status === 'BLOCKED'
                ? 'Blocked'
                : 'Open'}
              {post.task.assignees.length > 0
                ? ` · ${post.task.assignees.length} ${post.task.assignees.length === 1 ? 'assignee' : 'assignees'}`
                : ''}
              {post.task.dueDate
                ? ` · due ${new Date(post.task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
      {post.type === 'DECISION' && post.decision ? (
        <Pressable
          onPress={() =>
            router.push(
              `/(member)/committees/${committeeId}/decisions/${post.decision!.id}`,
            )
          }
          style={({ pressed }) => [
            styles.refCard,
            { borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 },
          ]}>
          <Ionicons name="hammer-outline" size={16} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.refTitle, { color: colors.text }]} numberOfLines={2}>
              {post.decision.title}
            </Text>
            <Text style={[styles.refMeta, { color: colors.textMuted }]} numberOfLines={2}>
              {post.decision.summary}
            </Text>
            <Text style={[styles.refMeta, { color: colors.textMuted, marginTop: 2 }]}>
              {post.decision.status === 'ACTIVE'
                ? 'Active'
                : post.decision.status === 'SUPERSEDED'
                ? 'Superseded'
                : 'Reversed'}
              {' · '}
              {new Date(post.decision.decidedOn).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
      {!isSystem ? (
        <PostEngagementBar committeeId={committeeId} postId={post.id} />
      ) : null}
    </Card>
  );
}

export default function CommitteeFeedScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const params = useLocalSearchParams<{ id: string }>();
  const committeeId = Number.parseInt(String(params.id), 10);
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);

  const detailQuery = useQuery({
    queryKey: ['committees', committeeId, 'detail'],
    enabled: Number.isFinite(committeeId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getCommitteeDetail(token, committeeId);
    },
  });

  const feedQuery = useInfiniteQuery({
    queryKey: ['committees', committeeId, 'feed'],
    enabled: Number.isFinite(committeeId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getCommitteeFeed(token, committeeId, pageParam);
    },
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
  });

  const posts = (feedQuery.data?.pages ?? []).flatMap((p) => p.posts);
  const canPost = detailQuery.data?.caller.isMember || detailQuery.data?.caller.isChair;
  const canManagePolls =
    detailQuery.data?.caller.isChair ||
    detailQuery.data?.caller.isEditor ||
    detailQuery.data?.caller.isSuperAdmin;

  return (
    <Screen>
      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={feedQuery.isRefetching}
            onRefresh={() => void feedQuery.refetch()}
            tintColor={colors.accent}
          />
        }
        onEndReached={() => {
          if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
            void feedQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ gap: Spacing.three }}>
            <BackLink label="Committees" />
            {detailQuery.data ? (
              <View style={{ gap: 4 }}>
                <Text style={[styles.title, { color: colors.text }]}>{detailQuery.data.name}</Text>
                {detailQuery.data.description ? (
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {detailQuery.data.description}
                  </Text>
                ) : null}
                <View style={styles.headerLinks}>
                  <Pressable
                    onPress={() => router.push(`/(member)/committees/${committeeId}/members`)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                    <Text style={[styles.meta, { color: colors.accent }]}>
                      {detailQuery.data.members.length} members ›
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push(`/(member)/committees/${committeeId}/tasks`)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                    <Text style={[styles.meta, { color: colors.accent }]}>
                      {detailQuery.data._count?.tasks ?? 0} tasks ›
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      router.push(`/(member)/committees/${committeeId}/decisions`)
                    }
                    style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                    <Text style={[styles.meta, { color: colors.accent }]}>
                      {detailQuery.data._count?.decisions ?? 0} decisions ›
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      router.push(`/(member)/committees/${committeeId}/documents`)
                    }
                    style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                    <Text style={[styles.meta, { color: colors.accent }]}>
                      {detailQuery.data._count?.documents ?? 0} documents ›
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : detailQuery.isLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !feedQuery.isLoading ? (
            <Card style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No posts yet. Be the first to share something.
              </Text>
            </Card>
          ) : null
        }
        ListFooterComponent={
          feedQuery.isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
          ) : null
        }
        renderItem={({ item }) => (
          <PostCard committeeId={committeeId} post={item} canManagePolls={canManagePolls} />
        )}
      />

      {canPost ? (
        <Pressable
          onPress={() => {
            const isChair =
              detailQuery.data?.caller.isChair || detailQuery.data?.caller.isSuperAdmin;
            const options: Parameters<typeof Alert.alert>[2] = [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Post',
                onPress: () => router.push(`/(member)/committees/${committeeId}/compose`),
              },
              {
                text: 'Task',
                onPress: () => router.push(`/(member)/committees/${committeeId}/tasks/new`),
              },
            ];
            if (canManagePolls) {
              options.push({
                text: 'Poll',
                onPress: () => router.push(`/(member)/committees/${committeeId}/polls/new`),
              });
            }
            if (isChair) {
              options.push({
                text: 'Decision',
                onPress: () =>
                  router.push(`/(member)/committees/${committeeId}/decisions/new`),
              });
            }
            const canManageDocs =
              detailQuery.data?.caller.isChair ||
              detailQuery.data?.caller.isEditor ||
              detailQuery.data?.caller.isSuperAdmin;
            if (canManageDocs) {
              options.push({
                text: 'Document',
                onPress: () =>
                  router.push(`/(member)/committees/${committeeId}/documents/new`),
              });
            }
            Alert.alert('Create', 'Choose what to share', options);
          }}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
          ]}>
          <Ionicons name="add" size={28} color={colors.background} />
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
    paddingBottom: 124,
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  headerLinks: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 4,
  },
  post: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  author: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
    marginLeft: 'auto',
  },
  typeChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  typeChipText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  engagementBar: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127, 127, 127, 0.2)',
  },
  engagementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  engagementText: {
    fontSize: 13,
    fontWeight: '500',
  },
  empty: {
    padding: Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 110,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  refCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: Spacing.two,
  },
  refTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
  },
  refMeta: {
    fontSize: 12,
    marginTop: 2,
  },
});
