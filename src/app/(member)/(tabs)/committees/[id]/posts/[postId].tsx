import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { BottomTabInset, Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import {
  createPostComment,
  getPostComments,
  getPostReactions,
  togglePostReaction,
  type PostComment,
} from '@/features/committees/api';
import { useColorScheme } from '@/hooks/use-color-scheme';

const MAX_COMMENT = 1000;

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function CommentRow({ c }: { c: PostComment }) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  return (
    <Card style={styles.commentRow}>
      <View style={styles.commentHeader}>
        <Text style={[styles.commentAuthor, { color: colors.text }]}>
          {c.author.name ?? 'Unknown'}
        </Text>
        <Text style={[styles.commentTime, { color: colors.textMuted }]}>
          {formatTime(c.createdAt)}
        </Text>
      </View>
      <Text style={[styles.commentBody, { color: colors.text }]}>{c.body}</Text>
    </Card>
  );
}

export default function CommitteePostDetailScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const params = useLocalSearchParams<{ id: string; postId: string }>();
  const postId = Number.parseInt(String(params.postId), 10);
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const [draft, setDraft] = React.useState('');

  const reactionsQuery = useQuery({
    queryKey: ['committees', 'post', postId, 'reactions'],
    enabled: Number.isFinite(postId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getPostReactions(token, postId);
    },
  });

  const commentsQuery = useQuery({
    queryKey: ['committees', 'post', postId, 'comments'],
    enabled: Number.isFinite(postId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getPostComments(token, postId);
    },
  });

  const toggleReaction = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return togglePostReaction(token, postId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committees', 'post', postId, 'reactions'] });
    },
  });

  const postComment = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return createPostComment(token, postId, draft.trim());
    },
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['committees', 'post', postId, 'comments'] });
    },
    onError: (err: Error) => {
      Alert.alert('Could not post comment', err.message);
    },
  });

  const trimmed = draft.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_COMMENT && !postComment.isPending;
  const liked = reactionsQuery.data?.likedByMe ?? false;
  const likeCount = reactionsQuery.data?.count ?? 0;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={commentsQuery.isRefetching}
              onRefresh={() => {
                void commentsQuery.refetch();
                void reactionsQuery.refetch();
              }}
              tintColor={colors.accent}
            />
          }>
          <BackLink label="Back" />

          <View style={styles.statsRow}>
            <Pressable
              onPress={() => toggleReaction.mutate()}
              disabled={toggleReaction.isPending}
              style={({ pressed }) => [
                styles.statBtn,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={18}
                color={liked ? colors.accent : colors.text}
              />
              <Text style={[styles.statText, { color: liked ? colors.accent : colors.text }]}>
                {likeCount} {likeCount === 1 ? 'like' : 'likes'}
              </Text>
            </Pressable>
            <View style={[styles.statBtn, { borderColor: colors.border }]}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.text} />
              <Text style={[styles.statText, { color: colors.text }]}>
                {commentsQuery.data?.total ?? 0}{' '}
                {(commentsQuery.data?.total ?? 0) === 1 ? 'comment' : 'comments'}
              </Text>
            </View>
          </View>

          {commentsQuery.isLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : commentsQuery.isError ? (
            <Card style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.danger }]}>
                {commentsQuery.error instanceof Error
                  ? commentsQuery.error.message
                  : 'Failed to load comments.'}
              </Text>
            </Card>
          ) : (commentsQuery.data?.comments ?? []).length === 0 ? (
            <Card style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No comments yet. Be the first to reply.
              </Text>
            </Card>
          ) : (
            (commentsQuery.data?.comments ?? []).map((c) => <CommentRow key={c.id} c={c} />)
          )}
        </ScrollView>

        <View
          style={[
            styles.composer,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a comment..."
            placeholderTextColor={colors.textMuted}
            multiline
            style={[
              styles.composerInput,
              { color: colors.text, backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            ]}
          />
          <Pressable
            onPress={() => postComment.mutate()}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: colors.accent,
                opacity: !canSubmit ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}>
            {postComment.isPending ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Ionicons name="send" size={18} color={colors.background} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
    paddingBottom: BottomTabInset + 80,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginVertical: Spacing.two,
  },
  statBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  statText: {
    fontSize: 13,
    fontWeight: '600',
  },
  commentRow: {
    padding: Spacing.three,
    gap: 6,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commentAuthor: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
  },
  commentTime: {
    fontSize: 12,
  },
  commentBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  empty: {
    padding: Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.two,
    borderTopWidth: 1,
    paddingBottom: BottomTabInset + 8,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
});
