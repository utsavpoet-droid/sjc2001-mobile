import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useGlobalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, Card, Input, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { BackLink } from '@/components/ui/back-link';
import { GifPicker } from '@/components/content/gif-picker';
import { Screen } from '@/components/ui/screen';
import { RichBody } from '@/components/content/rich-body';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getComments, getStory, postComment, postReactionToggle } from '@/features/content/api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveBackendUrl } from '@/lib/api/bases';
import { serializeComposerBody } from '@/lib/content/gif-tokens';

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
  const colors = Colors[resolveThemeMode(useColorScheme())];

  return (
    <Pressable onPress={onPress} style={styles.actionStat}>
      <Ionicons name={icon} size={18} color={active ? colors.accent : colors.textSecondary} />
      <Text style={[styles.actionCount, { color: active ? colors.accent : colors.text }]}>{count}</Text>
      <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

export default function StoryDetailScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const accessToken = useAuthStore((state) => state.accessToken);
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [gifUrls, setGifUrls] = useState<string[]>([]);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const commentInputRef = useRef<TextInput>(null);

  const storyQuery = useQuery({
    queryKey: ['story', id],
    queryFn: () => getStory(String(id), accessToken),
  });

  const commentsQuery = useQuery({
    queryKey: ['story-comments', id],
    queryFn: () => getComments({ entityType: 'story', entityId: String(id), page: 1, limit: 20 }),
  });

  const reactionMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return postReactionToggle(token, { entityType: 'story', entityId: String(id) });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['story', id] });
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
        entityType: 'story',
        entityId: String(id),
        body: serializeComposerBody(commentText, gifUrls),
      });
    },
    onSuccess: () => {
      setCommentText('');
      setGifUrls([]);
      void queryClient.invalidateQueries({ queryKey: ['story-comments', id] });
      void queryClient.invalidateQueries({ queryKey: ['story', id] });
    },
    onError: (error) => {
      Alert.alert('Unable to comment', error instanceof Error ? error.message : 'Try again.');
    },
  });

  if (storyQuery.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const story = storyQuery.data;
  if (!story) {
    return (
      <Screen>
        <Text style={{ color: colors.text }}>Story not found.</Text>
      </Screen>
    );
  }

  const comments =
    commentsQuery.data && typeof commentsQuery.data === 'object' && 'comments' in commentsQuery.data
      ? ((commentsQuery.data as { comments?: Array<{ id: number; body: string; author?: { name?: string } }> }).comments ?? [])
      : [];

  return (
    <Screen scroll>
      <BackLink label="Back to stories" />
      <SectionTitle eyebrow="Story Detail" title={story.author.name} subtitle={new Date(story.createdAt).toLocaleString()} />

      <Card style={styles.storyCard}>
        <View style={styles.storyHeader}>
          <Avatar name={story.author.name} uri={story.author.avatarUrl} size={52} />
          <View style={styles.storyHeaderText}>
            <Text style={[styles.storyAuthor, { color: colors.text }]}>{story.author.name}</Text>
            <Text style={[styles.storyMeta, { color: colors.textSecondary }]}>{new Date(story.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>
        <RichBody body={story.body} textStyle={styles.storyBodyText} />
        <View style={styles.actionsRow}>
          <ActionStat
            icon={story.likedByMe ? 'heart' : 'heart-outline'}
            label="Likes"
            count={story.reactionCount}
            active={story.likedByMe}
            onPress={() => reactionMutation.mutate()}
          />
          <ActionStat
            icon="chatbubble-ellipses-outline"
            label="Comments"
            count={story.commentCount}
            onPress={() => commentInputRef.current?.focus()}
          />
        </View>
      </Card>

      <View style={styles.commentStack}>
        {comments.map((comment) => (
          <Card key={comment.id}>
            <Text style={[styles.commentAuthor, { color: colors.text }]}>{comment.author?.name ?? 'Member'}</Text>
            <RichBody body={comment.body} />
          </Card>
        ))}
      </View>

      <Card style={styles.commentComposer}>
        <Text style={[styles.commentTitle, { color: colors.text }]}>Join the conversation</Text>
        <Input
          ref={commentInputRef}
          value={commentText}
          onChangeText={setCommentText}
          placeholder="Write a comment"
          multiline
          style={styles.multilineInput}
        />
        <View style={styles.commentToolbar}>
          <Pressable
            onPress={() => setGifPickerOpen(true)}
            style={[styles.toolbarButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}> 
            <Ionicons name="images-outline" size={16} color={colors.accent} />
            <Text style={[styles.toolbarButtonText, { color: colors.text }]}>GIF</Text>
          </Pressable>
        </View>
        {gifUrls[0] ? (
          <View style={[styles.gifPreviewCard, { backgroundColor: colors.backgroundSoft, borderColor: colors.border }]}> 
            <Image source={{ uri: resolveBackendUrl(gifUrls[0]) ?? gifUrls[0] }} style={styles.gifPreview} contentFit="cover" />
            <Pressable onPress={() => setGifUrls([])} style={styles.gifRemoveButton}>
              <Ionicons name="close-circle" size={20} color={colors.accent} />
            </Pressable>
          </View>
        ) : null}
        <PrimaryButton
          busy={commentMutation.isPending}
          disabled={!commentText.trim() && gifUrls.length === 0}
          onPress={() => commentMutation.mutate()}>
          Post Comment
        </PrimaryButton>
      </Card>

      <GifPicker
        visible={gifPickerOpen}
        onClose={() => setGifPickerOpen(false)}
        onSelect={(gifUrl) => setGifUrls([gifUrl])}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  storyCard: {
    gap: Spacing.three,
  },
  storyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  storyHeaderText: {
    flex: 1,
    gap: Spacing.half,
  },
  storyAuthor: {
    fontFamily: Fonts.rounded,
    fontSize: 20,
  },
  storyMeta: {
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  storyBodyText: {
    fontSize: 16,
    lineHeight: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  actionStat: {
    alignItems: 'center',
    gap: 4,
  },
  actionCount: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },
  actionLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  commentComposer: {
    gap: Spacing.two,
  },
  commentToolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
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
  toolbarButtonText: {
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
  commentTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
  },
  multilineInput: {
    minHeight: 120,
    paddingTop: Spacing.three,
    textAlignVertical: 'top',
  },
  commentStack: {
    gap: Spacing.two,
  },
  commentAuthor: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },
});
