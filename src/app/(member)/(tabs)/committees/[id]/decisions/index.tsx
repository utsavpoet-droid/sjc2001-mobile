import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { getCommitteeDecisions, getCommitteeDetail } from '@/features/committees/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type {
  CommitteeDecisionDto,
  CommitteeDecisionStatus,
} from '@shared/contracts/committees-contract';

const STATUS_LABEL: Record<CommitteeDecisionStatus, string> = {
  ACTIVE: 'Active',
  SUPERSEDED: 'Superseded',
  REVERSED: 'Reversed',
};

function DecisionRow({
  committeeId,
  decision,
}: {
  committeeId: number;
  decision: CommitteeDecisionDto;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const decided = new Date(decision.decidedOn).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const isInactive = decision.status !== 'ACTIVE';
  const statusColor =
    decision.status === 'ACTIVE'
      ? colors.success
      : decision.status === 'SUPERSEDED'
      ? colors.textMuted
      : colors.danger;

  return (
    <Pressable
      onPress={() =>
        router.push(`/(member)/committees/${committeeId}/decisions/${decision.id}`)
      }
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <Card style={styles.row}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {decision.title}
          </Text>
          <Text style={[styles.summary, { color: colors.textSecondary }]} numberOfLines={2}>
            {decision.summary}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={11} color={colors.textMuted} />
            <Text style={[styles.meta, { color: colors.textMuted }]}>{decided}</Text>
            {isInactive ? (
              <>
                <Text style={[styles.metaDot, { color: colors.textMuted }]}>·</Text>
                <Text style={[styles.meta, { color: statusColor, fontWeight: '600' }]}>
                  {STATUS_LABEL[decision.status]}
                </Text>
              </>
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Card>
    </Pressable>
  );
}

export default function CommitteeDecisionsScreen() {
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

  const decisionsQuery = useQuery({
    queryKey: ['committees', committeeId, 'decisions'],
    enabled: Number.isFinite(committeeId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getCommitteeDecisions(token, committeeId);
    },
  });

  const decisions = decisionsQuery.data ?? [];
  const active = decisions.filter((d) => d.status === 'ACTIVE');
  const archived = decisions.filter((d) => d.status !== 'ACTIVE');

  const canCreate = detailQuery.data?.caller.isChair || detailQuery.data?.caller.isSuperAdmin;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={decisionsQuery.isRefetching}
            onRefresh={() => void decisionsQuery.refetch()}
            tintColor={colors.accent}
          />
        }>
        <BackLink label="Back" />
        <SectionTitle title="Decisions" subtitle={detailQuery.data?.name} />

        {canCreate ? (
          <Pressable
            onPress={() =>
              router.push(`/(member)/committees/${committeeId}/decisions/new`)
            }
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
            ]}>
            <Ionicons name="hammer" size={18} color={colors.background} />
            <Text style={[styles.ctaText, { color: colors.background }]}>Record decision</Text>
          </Pressable>
        ) : null}

        {decisionsQuery.isLoading ? <ActivityIndicator color={colors.accent} /> : null}

        {decisions.length === 0 && !decisionsQuery.isLoading ? (
          <Card style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No decisions recorded yet.
            </Text>
          </Card>
        ) : null}

        {active.length > 0 ? (
          <View style={{ gap: Spacing.two }}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              Active · {active.length}
            </Text>
            {active.map((d) => (
              <DecisionRow key={d.id} committeeId={committeeId} decision={d} />
            ))}
          </View>
        ) : null}

        {archived.length > 0 ? (
          <View style={{ gap: Spacing.two }}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              History · {archived.length}
            </Text>
            {archived.map((d) => (
              <DecisionRow key={d.id} committeeId={committeeId} decision={d} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
    paddingBottom: 124,
  },
  sectionLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.two,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
  },
  ctaText: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '600',
  },
  summary: {
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  meta: {
    fontSize: 11,
  },
  metaDot: {
    fontSize: 11,
    marginHorizontal: 2,
  },
  empty: {
    padding: Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
});
