import { useMutation, useQuery } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { getMemberActivity, postMemberActivitySeen } from '@/features/member/api';
import { useColorScheme } from '@/hooks/use-color-scheme';

function itemTitle(type: string) {
  switch (type) {
    case 'like':
      return 'Someone liked your card';
    case 'comment':
      return 'New comment on your card';
    case 'mention':
      return 'You were mentioned in a comment';
    case 'story_mention':
      return 'You were mentioned in a story';
    case 'news':
      return 'New article';
    case 'story':
      return 'New story';
    case 'gallery':
      return 'New gallery album';
    default:
      return 'Activity update';
  }
}

export default function ActivityScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);

  const activityQuery = useQuery({
    queryKey: ['member-activity'],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return getMemberActivity(token);
    },
  });

  const seenMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return postMemberActivitySeen(token);
    },
  });

  useEffect(() => {
    if (activityQuery.data && !seenMutation.isPending) {
      void seenMutation.mutate();
    }
  }, [activityQuery.data, seenMutation]);

  return (
    <Screen scroll>
      <BackLink label="Back to account" />
      <SectionTitle
        eyebrow="Activity"
        title="Your activity feed"
        subtitle="Reactions, mentions, comments, stories, albums, and fresh updates around the batch."
      />

      {activityQuery.isLoading ? <ActivityIndicator color={colors.accent} /> : null}

      <View style={styles.stack}>
        {(activityQuery.data?.items ?? []).map((item, index) => (
          <Card key={`${item.type}-${item.createdAt}-${index}`} style={styles.card}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{itemTitle(item.type)}</Text>
            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}> 
              {item.authorName ? `${item.authorName} · ` : ''}
              {new Date(item.createdAt).toLocaleString()}
            </Text>
            {item.title ? <Text style={[styles.cardBody, { color: colors.text }]}>{item.title}</Text> : null}
            {item.body ? <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{item.body}</Text> : null}
          </Card>
        ))}
        {!activityQuery.isLoading && (activityQuery.data?.items?.length ?? 0) === 0 ? (
          <Card>
            <Text style={[styles.cardBody, { color: colors.textSecondary }]}>No activity yet. Once the batch starts reacting and mentioning you, updates will show up here.</Text>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.one,
  },
  cardTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
  },
  cardMeta: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  cardBody: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
});
