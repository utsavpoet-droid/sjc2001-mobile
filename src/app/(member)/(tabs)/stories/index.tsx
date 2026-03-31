import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, router, type Href } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { Avatar, Card, GhostButton, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { RichBody } from '@/components/content/rich-body';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getStoriesPage, postReactionToggle } from '@/features/content/api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';

function formatStoryDate(value: string) {
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function StoryStat({
  icon,
  count,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  active?: boolean;
  onPress?: () => void;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];

  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        onPress?.();
      }}
      style={styles.storyStat}>
      <Ionicons name={icon} size={18} color={active ? colors.accent : colors.textSecondary} />
      <Text style={[styles.storyStatCount, { color: active ? colors.accent : colors.text }]}>{count}</Text>
    </Pressable>
  );
}

function openStory(storyId: string, event?: GestureResponderEvent) {
  event?.stopPropagation();
  router.push(`/(member)/stories/${storyId}` as Href);
}

export default function StoriesScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const accessToken = useAuthStore((state) => state.accessToken);
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['stories', 1],
    queryFn: () => getStoriesPage({ page: 1, limit: 20 }, accessToken),
  });

  const reactionMutation = useMutation({
    mutationFn: async (storyId: string) => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return postReactionToggle(token, { entityType: 'story', entityId: storyId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stories', 1] });
    },
    onError: (error) => {
      Alert.alert('Unable to react', error instanceof Error ? error.message : 'Try again.');
    },
  });

  return (
    <Screen scroll>
      <SectionTitle
        eyebrow="Stories"
        title="Share, react, and keep the stories alive."
        subtitle="Read the live story feed with reactions, comments, mentions, and GIF/image embeds from the website backend."
      />

      <Link href={'/(member)/stories/create' as Href} asChild>
        <Pressable>
          {({ pressed }) => (
            <Card style={[styles.composeCard, { backgroundColor: colors.text, borderColor: colors.text, transform: [{ scale: pressed ? 0.988 : 1 }] }]}>
              <View style={styles.composeRow}>
                <View style={[styles.composeIcon, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                  <Ionicons name="create-outline" size={18} color="#F7E3D8" />
                </View>
                <View style={styles.composeCopy}>
                  <Text style={styles.composeTitle}>Share something with the circle</Text>
                  <Text style={styles.composeText}>Post a memory, reunion update, tagged note, or GIF from your side.</Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color="#F3D7CA" />
              </View>
            </Card>
          )}
        </Pressable>
      </Link>

      {query.isLoading ? <ActivityIndicator color={colors.accent} /> : null}

      <View style={styles.stack}>
        {query.data?.stories.map((story) => (
          <Pressable key={story.id} onPress={() => openStory(story.id)}>
            {({ pressed }) => (
              <Card style={[styles.storyCard, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}>
                <View style={styles.storyHeader}>
                  <Avatar name={story.author.name} uri={story.author.avatarUrl} size={44} />
                  <View style={styles.storyHeaderText}>
                    <Text style={[styles.storyAuthor, { color: colors.text }]}>{story.author.name}</Text>
                    <Text style={[styles.storyMeta, { color: colors.textSecondary }]}>{formatStoryDate(story.createdAt)}</Text>
                  </View>
                  {story.isPinned ? (
                    <View style={[styles.pill, { backgroundColor: colors.accentSoft }]}> 
                      <Ionicons name="pin" size={12} color={colors.accent} />
                      <Text style={[styles.pillText, { color: colors.accent }]}>Pinned</Text>
                    </View>
                  ) : null}
                </View>
                <View style={[styles.storyBodyWrap, { backgroundColor: colors.backgroundSoft }]}>
                  <RichBody body={story.body} />
                </View>
                <View style={styles.footerRow}>
                  <View style={styles.storyPrompt}>
                    <View style={[styles.storyPromptDot, { backgroundColor: colors.accent }]} />
                    <Text style={[styles.storyPromptText, { color: colors.textMuted }]}>Open thread</Text>
                  </View>
                  <View style={styles.statRow}>
                    <StoryStat
                      icon={story.likedByMe ? 'heart' : 'heart-outline'}
                      count={story.reactionCount}
                      active={story.likedByMe}
                      onPress={() => reactionMutation.mutate(story.id)}
                    />
                    <StoryStat
                      icon={story.commentCount > 0 ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
                      count={story.commentCount}
                      active={story.commentCount > 0}
                      onPress={() => router.push(`/(member)/stories/${story.id}` as Href)}
                    />
                  </View>
                </View>
              </Card>
            )}
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  composeCard: {
    borderRadius: 30,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  composeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeCopy: {
    flex: 1,
    gap: 2,
  },
  composeTitle: {
    color: '#FFF6F0',
    fontFamily: Fonts.rounded,
    fontSize: 20,
  },
  composeText: {
    color: '#E8D7CF',
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  stack: {
    gap: Spacing.three,
  },
  storyCard: {
    gap: Spacing.three,
    borderRadius: 30,
  },
  storyHeader: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  storyHeaderText: {
    flex: 1,
    gap: 2,
  },
  storyAuthor: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
  },
  storyMeta: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: {
    fontFamily: Fonts.rounded,
    fontSize: 12,
  },
  storyBodyWrap: {
    borderRadius: 22,
    padding: Spacing.three,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storyPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storyPromptDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  storyPromptText: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
  storyStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  storyStatCount: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
  },
});
