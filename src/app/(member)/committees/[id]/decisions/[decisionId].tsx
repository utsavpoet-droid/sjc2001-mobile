import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { getCommitteeDecision, getCommitteeDetail } from '@/features/committees/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { CommitteeDecisionStatus } from '@shared/contracts/committees-contract';

const STATUS_LABEL: Record<CommitteeDecisionStatus, string> = {
  ACTIVE: 'Active',
  SUPERSEDED: 'Superseded',
  REVERSED: 'Reversed',
};

export default function DecisionDetailScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const params = useLocalSearchParams<{ id: string; decisionId: string }>();
  const committeeId = Number.parseInt(String(params.id), 10);
  const decisionId = Number.parseInt(String(params.decisionId), 10);
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

  const decisionQuery = useQuery({
    queryKey: ['committees', committeeId, 'decision', decisionId],
    enabled: Number.isFinite(committeeId) && Number.isFinite(decisionId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getCommitteeDecision(token, committeeId, decisionId);
    },
  });

  const decision = decisionQuery.data;

  if (decisionQuery.isLoading || !decision) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 64 }} />
      </Screen>
    );
  }

  const decided = new Date(decision.decidedOn).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const statusColor =
    decision.status === 'ACTIVE'
      ? colors.success
      : decision.status === 'SUPERSEDED'
      ? colors.textMuted
      : colors.danger;

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ gap: Spacing.three, paddingBottom: 124 }}>
        <BackLink label="Decisions" />
        <SectionTitle title={decision.title} subtitle={detailQuery.data?.name} />

        <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
          <View style={[styles.statusChip, { borderColor: statusColor }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {STATUS_LABEL[decision.status]}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.meta, { color: colors.textMuted }]}>Decided {decided}</Text>
          </View>
        </Card>

        <Card style={{ padding: Spacing.three }}>
          <Text style={[styles.summary, { color: colors.text }]}>{decision.summary}</Text>
        </Card>

        {decision.pollId ? (
          <Card style={{ padding: Spacing.three }}>
            <Text style={[styles.linkLabel, { color: colors.textSecondary }]}>Linked to poll</Text>
            <Text style={[styles.linkValue, { color: colors.text }]}>Poll #{decision.pollId}</Text>
          </Card>
        ) : null}

        {decision.supersededById ? (
          <Pressable
            onPress={() =>
              router.push(
                `/(member)/committees/${committeeId}/decisions/${decision.supersededById}`,
              )
            }
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
            <Card style={[styles.supersedeCard, { borderColor: colors.border }]}>
              <Ionicons name="arrow-forward-circle" size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.linkLabel, { color: colors.textSecondary }]}>
                  Superseded by
                </Text>
                <Text style={[styles.linkValue, { color: colors.text }]}>
                  Decision #{decision.supersededById}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Card>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meta: {
    fontSize: 13,
  },
  summary: {
    fontSize: 15,
    lineHeight: 22,
  },
  linkLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    marginBottom: 4,
  },
  linkValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  supersedeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.three,
    borderWidth: 1,
  },
});
