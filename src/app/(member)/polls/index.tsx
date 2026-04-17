import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, GhostButton, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getPolls, postPollVote } from '@/features/content/api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';

type PollOption = {
  id: number;
  label: string;
  votes: number;
};

type Poll = {
  id: number;
  title: string;
  description?: string | null;
  isCompleted?: boolean;
  allowMultiple: boolean;
  maxSelections?: number | null;
  totalResponses: number;
  alreadyVoted?: boolean;
  myOptionIds?: number[];
  options: PollOption[];
};

export default function PollsScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const accessToken = useAuthStore((state) => state.accessToken);
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);
  const queryClient = useQueryClient();
  const [selections, setSelections] = useState<Record<number, number[]>>({});

  const pollsQuery = useQuery({
    queryKey: ['polls', accessToken],
    queryFn: () => getPolls(accessToken),
  });

  const voteMutation = useMutation({
    mutationFn: async ({ pollId, optionIds }: { pollId: number; optionIds: number[] }) => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return postPollVote(token, pollId, optionIds);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['polls'] });
    },
    onError: (error) => {
      Alert.alert('Unable to vote', error instanceof Error ? error.message : 'Try again.');
    },
  });

  const polls = useMemo(() => (Array.isArray(pollsQuery.data) ? (pollsQuery.data as Poll[]) : []), [pollsQuery.data]);

  function toggleOption(poll: Poll, optionId: number) {
    setSelections((current) => {
      const selected = current[poll.id] ?? poll.myOptionIds ?? [];
      if (!poll.allowMultiple) {
        return { ...current, [poll.id]: [optionId] };
      }
      const exists = selected.includes(optionId);
      const next = exists ? selected.filter((id) => id !== optionId) : [...selected, optionId];
      const max = poll.maxSelections ?? poll.options.length;
      return { ...current, [poll.id]: next.slice(0, max) };
    });
  }

  return (
    <Screen scroll>
      <BackLink label="Back to account" />
      <SectionTitle
        eyebrow="Polls"
        title="Batch polls"
        subtitle="Vote from the app and keep an eye on where the batch is leaning."
      />

      {pollsQuery.isLoading ? <ActivityIndicator color={colors.accent} /> : null}

      <View style={styles.stack}>
        {polls.map((poll) => {
          const selected = selections[poll.id] ?? poll.myOptionIds ?? [];
          const isCompleted = !!poll.isCompleted;
          const canVote = !isCompleted && !poll.alreadyVoted;
          return (
            <Card key={poll.id} style={styles.card}>
              <Text style={[styles.title, { color: colors.text }]}>{poll.title}</Text>
              {!isCompleted && poll.description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{poll.description}</Text> : null}
              {!isCompleted ? (
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {poll.totalResponses} responses · {poll.allowMultiple ? `Select up to ${poll.maxSelections ?? poll.options.length}` : 'Choose one'}
                </Text>
              ) : null}
              <View style={styles.optionStack}>
                {poll.options.map((option) => {
                  const checked = selected.includes(option.id);
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => (canVote ? toggleOption(poll, option.id) : undefined)}
                      style={({ pressed }) => [
                        styles.option,
                        {
                          borderColor: checked ? colors.accent : colors.border,
                          backgroundColor: checked ? colors.accentSoft : pressed ? colors.surfaceMuted : colors.surface,
                        },
                      ]}>
                      <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                      <Text style={[styles.optionVotes, { color: colors.textSecondary }]}>{option.votes} votes</Text>
                    </Pressable>
                  );
                })}
              </View>
              {canVote ? (
                <PrimaryButton
                  busy={voteMutation.isPending}
                  disabled={selected.length === 0}
                  onPress={() => voteMutation.mutate({ pollId: poll.id, optionIds: selected })}>
                  Submit Vote
                </PrimaryButton>
              ) : !isCompleted ? (
                <GhostButton>Vote recorded</GhostButton>
              ) : null}
            </Card>
          );
        })}
        {!pollsQuery.isLoading && polls.length === 0 ? (
          <Card>
            <Text style={[styles.description, { color: colors.textSecondary }]}>No active polls are available right now.</Text>
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
    gap: Spacing.two,
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 22,
  },
  description: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  optionStack: {
    gap: Spacing.two,
  },
  option: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: 4,
  },
  optionLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },
  optionVotes: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
});
