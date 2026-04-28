import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, GhostButton, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import {
  getDiscoverableCommittees,
  getMyCommittees,
  requestJoinCommittee,
} from '@/features/committees/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type {
  CommitteeDiscoverableDto,
  CommitteeSummaryDto,
} from '@shared/contracts/committees-contract';

function MyCommitteeRow({ c }: { c: CommitteeSummaryDto }) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  return (
    <Pressable
      onPress={() => router.push(`/(member)/committees/${c.id}`)}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <Card style={styles.row}>
        <View style={[styles.dot, { backgroundColor: c.colorHex || colors.accent }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.text }]}>{c.name}</Text>
          {c.description ? (
            <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={2}>
              {c.description}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}
            </Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>·</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {c.postCount} {c.postCount === 1 ? 'post' : 'posts'}
            </Text>
            {c.myRole === 'CHAIR' ? (
              <View style={[styles.chip, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.chipText, { color: colors.accent }]}>Chair</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Card>
    </Pressable>
  );
}

function DiscoverableRow({
  c,
  onJoin,
  joining,
}: {
  c: CommitteeDiscoverableDto;
  onJoin: (id: number) => void;
  joining: boolean;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const pending = c.pendingWorkflow;
  const pendingLabel = pending
    ? pending.kind === 'INVITATION'
      ? 'Invitation pending'
      : 'Awaiting approval'
    : null;

  return (
    <Card style={styles.row}>
      <View style={[styles.dot, { backgroundColor: c.colorHex || colors.accent }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: colors.text }]}>{c.name}</Text>
        {c.description ? (
          <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={2}>
            {c.description}
          </Text>
        ) : null}
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}
        </Text>
      </View>
      {pendingLabel ? (
        <View style={[styles.chip, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.chipText, { color: colors.textSecondary }]}>{pendingLabel}</Text>
        </View>
      ) : (
        <Pressable
          disabled={joining}
          onPress={() => onJoin(c.id)}
          style={({ pressed }) => [
            styles.joinBtn,
            {
              backgroundColor: colors.accent,
              opacity: joining ? 0.5 : pressed ? 0.82 : 1,
            },
          ]}>
          <Text style={[styles.joinText, { color: colors.background }]}>
            {joining ? '...' : 'Join'}
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

export default function CommitteesScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const myQuery = useQuery({
    queryKey: ['committees', 'mine'],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getMyCommittees(token);
    },
  });

  const discoverableQuery = useQuery({
    queryKey: ['committees', 'discoverable'],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getDiscoverableCommittees(token);
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (committeeId: number) => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return requestJoinCommittee(token, committeeId, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committees', 'discoverable'] });
    },
    onError: (err: Error) => {
      Alert.alert('Could not request to join', err.message);
    },
  });

  const isRefreshing = myQuery.isRefetching || discoverableQuery.isRefetching;
  const refreshAll = () => {
    void myQuery.refetch();
    void discoverableQuery.refetch();
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshAll}
            tintColor={colors.accent}
          />
        }>
        <BackLink label="Home" />
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <SectionTitle
              eyebrow="Silver Jubilee"
              title="Committees"
              subtitle="Coordinate on planning, decisions, and tasks."
            />
          </View>
          <GhostButton onPress={() => router.push('/(member)/committees/invitations')}>
            Invitations
          </GhostButton>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>My committees</Text>
        {myQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : myQuery.isError ? (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyText, { color: colors.danger }]}>
              {myQuery.error instanceof Error ? myQuery.error.message : 'Failed to load.'}
            </Text>
          </Card>
        ) : (myQuery.data ?? []).length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              You&apos;re not in any committees yet.
            </Text>
          </Card>
        ) : (
          (myQuery.data ?? []).map((c) => <MyCommitteeRow key={c.id} c={c} />)
        )}

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: Spacing.three }]}>
          Discover
        </Text>
        {discoverableQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : discoverableQuery.isError ? (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyText, { color: colors.danger }]}>
              {discoverableQuery.error instanceof Error
                ? discoverableQuery.error.message
                : 'Failed to load.'}
            </Text>
          </Card>
        ) : (discoverableQuery.data ?? []).length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No other committees to join right now.
            </Text>
          </Card>
        ) : (
          (discoverableQuery.data ?? []).map((c) => (
            <DiscoverableRow
              key={c.id}
              c={c}
              joining={joinMutation.isPending && joinMutation.variables === c.id}
              onJoin={(id) => joinMutation.mutate(id)}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.two,
    paddingBottom: 124,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
  },
  sectionLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  name: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
    fontWeight: '600',
  },
  desc: {
    fontSize: 13,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: 4,
  },
  meta: {
    fontSize: 12,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginLeft: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  joinBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  joinText: {
    fontWeight: '700',
    fontSize: 13,
  },
  emptyCard: {
    padding: Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
});
