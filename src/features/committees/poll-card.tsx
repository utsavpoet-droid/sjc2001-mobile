import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { closeCommitteePoll, voteOnCommitteePoll } from '@/features/committees/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { CommitteePollDto } from '@shared/contracts/committees-contract';

function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = target - now;
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 60) return diffMin >= 0 ? `closes in ${diffMin}m` : 'closed';
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) return diffH >= 0 ? `closes in ${diffH}h` : 'closed';
  const diffD = Math.round(diffH / 24);
  return diffD >= 0
    ? `closes in ${diffD}d`
    : `closed ${new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

interface PollCardProps {
  committeeId: number;
  poll: CommitteePollDto;
  /** When true, show a "Close poll" action. Pass canClose=isChair from parent. */
  canClose?: boolean;
}

export function CommitteePollCard({ committeeId, poll, canClose }: PollCardProps) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const [pendingIds, setPendingIds] = React.useState<Set<number>>(
    () => new Set(poll.myVoteOptionIds),
  );

  React.useEffect(() => {
    setPendingIds(new Set(poll.myVoteOptionIds));
  }, [poll.id, poll.myVoteOptionIds]);

  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.voteCount, 0);
  const isClosed =
    !!poll.closedAt || (poll.closesAt ? new Date(poll.closesAt).getTime() <= Date.now() : false);

  const voteMutation = useMutation({
    mutationFn: async (optionIds: number[]) => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return voteOnCommitteePoll(token, committeeId, poll.id, { optionIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committees', committeeId, 'feed'] });
      queryClient.invalidateQueries({ queryKey: ['committees', committeeId, 'poll', poll.id] });
    },
    onError: (err: Error) => {
      Alert.alert('Could not save vote', err.message);
      setPendingIds(new Set(poll.myVoteOptionIds));
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return closeCommitteePoll(token, committeeId, poll.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committees', committeeId, 'feed'] });
      queryClient.invalidateQueries({ queryKey: ['committees', committeeId, 'poll', poll.id] });
    },
    onError: (err: Error) => Alert.alert('Could not close poll', err.message),
  });

  const handleSelect = (optionId: number) => {
    if (isClosed || voteMutation.isPending) return;

    let next: Set<number>;
    if (poll.isMultiSelect) {
      next = new Set(pendingIds);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
    } else {
      next = new Set([optionId]);
    }
    setPendingIds(next);
    if (next.size > 0) {
      voteMutation.mutate(Array.from(next));
    }
  };

  const closeLabel = isClosed
    ? poll.closedAt
      ? 'Poll closed'
      : 'Voting ended'
    : formatRelative(poll.closesAt);

  return (
    <View
      style={[
        styles.wrapper,
        { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
      ]}>
      <View style={styles.header}>
        <Ionicons name="bar-chart" size={14} color={colors.accent} />
        <Text style={[styles.headerLabel, { color: colors.accent }]}>
          {poll.isMultiSelect ? 'Multi-select poll' : 'Poll'}
        </Text>
        {closeLabel ? (
          <Text style={[styles.headerMeta, { color: colors.textMuted }]}>· {closeLabel}</Text>
        ) : null}
      </View>

      <Text style={[styles.question, { color: colors.text }]}>{poll.question}</Text>

      <View style={{ gap: 8 }}>
        {poll.options.map((option) => {
          const selected = pendingIds.has(option.id);
          const pct = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
          const showResults = isClosed || pendingIds.size > 0;

          return (
            <Pressable
              key={option.id}
              disabled={isClosed || voteMutation.isPending}
              onPress={() => handleSelect(option.id)}
              style={({ pressed }) => [
                styles.option,
                {
                  borderColor: selected ? colors.accent : colors.border,
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}>
              {showResults ? (
                <View
                  style={[
                    styles.bar,
                    {
                      backgroundColor: selected ? colors.accentSoft : colors.surfaceMuted,
                      width: `${pct}%`,
                    },
                  ]}
                />
              ) : null}
              <View style={styles.optionRow}>
                <Ionicons
                  name={
                    selected
                      ? poll.isMultiSelect
                        ? 'checkbox'
                        : 'radio-button-on'
                      : poll.isMultiSelect
                      ? 'square-outline'
                      : 'radio-button-off'
                  }
                  size={18}
                  color={selected ? colors.accent : colors.textMuted}
                />
                <Text
                  style={[
                    styles.optionText,
                    { color: colors.text, fontWeight: selected ? '700' : '500' },
                  ]}>
                  {option.text}
                </Text>
                {showResults ? (
                  <Text style={[styles.optionPct, { color: colors.textSecondary }]}>
                    {option.voteCount} · {pct}%
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerMeta, { color: colors.textMuted }]}>
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          {poll.isAnonymous ? ' · anonymous' : ''}
        </Text>
        {voteMutation.isPending ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : null}
        {canClose && !isClosed ? (
          <Pressable
            onPress={() =>
              Alert.alert('Close this poll?', 'Members will no longer be able to vote.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Close poll', style: 'destructive', onPress: () => closeMutation.mutate() },
              ])
            }
            disabled={closeMutation.isPending}
            style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Text style={[styles.closeBtnText, { color: colors.danger }]}>
              {closeMutation.isPending ? 'Closing…' : 'Close'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerMeta: {
    fontSize: 11,
  },
  question: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  option: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  bar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
  },
  optionPct: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: 4,
  },
  footerMeta: {
    flex: 1,
    fontSize: 12,
  },
  closeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
