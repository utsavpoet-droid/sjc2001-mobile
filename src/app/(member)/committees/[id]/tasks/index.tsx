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
import { getCommitteeDetail, getCommitteeTasks } from '@/features/committees/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type {
  CommitteeTaskDto,
  CommitteeTaskPriority,
  CommitteeTaskStatus,
} from '@shared/contracts/committees-contract';

const STATUS_LABEL: Record<CommitteeTaskStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

const PRIORITY_LABEL: Record<CommitteeTaskPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

const STATUS_ORDER: CommitteeTaskStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'BLOCKED',
  'DONE',
  'CANCELLED',
];

function formatDue(iso: string | null): { label: string; overdue: boolean } | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  const overdue = ms < Date.now();
  const date = new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { label: date, overdue };
}

function TaskRow({ committeeId, task }: { committeeId: number; task: CommitteeTaskDto }) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const due = formatDue(task.dueDate);
  const isDone = task.status === 'DONE' || task.status === 'CANCELLED';
  const priorityColor =
    task.priority === 'URGENT'
      ? colors.danger
      : task.priority === 'HIGH'
      ? colors.accent
      : colors.textMuted;

  const assigneeNames = task.assignees
    .map((a) => a.memberUser?.member?.name)
    .filter((n): n is string => Boolean(n));
  const assigneeText =
    assigneeNames.length === 0
      ? 'Unassigned'
      : assigneeNames.length <= 2
      ? assigneeNames.join(', ')
      : `${assigneeNames[0]} +${assigneeNames.length - 1}`;

  return (
    <Pressable
      onPress={() =>
        router.push(`/(member)/committees/${committeeId}/tasks/${task.id}`)
      }
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <Card style={styles.row}>
        <View style={[styles.statusDot, { backgroundColor: priorityColor }]} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={[
              styles.title,
              { color: colors.text, textDecorationLine: isDone ? 'line-through' : 'none' },
            ]}>
            {task.title}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{assigneeText}</Text>
            {due ? (
              <>
                <Text style={[styles.metaDot, { color: colors.textMuted }]}>·</Text>
                <Text
                  style={[
                    styles.meta,
                    { color: due.overdue && !isDone ? colors.danger : colors.textMuted },
                  ]}>
                  {due.overdue && !isDone ? `Overdue ${due.label}` : `Due ${due.label}`}
                </Text>
              </>
            ) : null}
            {task.priority !== 'NORMAL' ? (
              <>
                <Text style={[styles.metaDot, { color: colors.textMuted }]}>·</Text>
                <Text style={[styles.meta, { color: priorityColor, fontWeight: '600' }]}>
                  {PRIORITY_LABEL[task.priority]}
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

export default function CommitteeTasksScreen() {
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

  const tasksQuery = useQuery({
    queryKey: ['committees', committeeId, 'tasks'],
    enabled: Number.isFinite(committeeId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getCommitteeTasks(token, committeeId);
    },
  });

  const tasks = tasksQuery.data ?? [];
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: tasks.filter((t) => t.status === status),
  })).filter((g) => g.items.length > 0);

  const canCreate =
    detailQuery.data?.caller.isMember || detailQuery.data?.caller.isChair;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={tasksQuery.isRefetching}
            onRefresh={() => void tasksQuery.refetch()}
            tintColor={colors.accent}
          />
        }>
        <BackLink label="Back" />
        <SectionTitle title="Tasks" subtitle={detailQuery.data?.name} />

        {canCreate ? (
          <Pressable
            onPress={() =>
              router.push(`/(member)/committees/${committeeId}/tasks/new`)
            }
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
            ]}>
            <Ionicons name="add" size={18} color={colors.background} />
            <Text style={[styles.ctaText, { color: colors.background }]}>New task</Text>
          </Pressable>
        ) : null}

        {tasksQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : null}

        {grouped.length === 0 && !tasksQuery.isLoading ? (
          <Card style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No tasks yet.
            </Text>
          </Card>
        ) : null}

        {grouped.map((group) => (
          <View key={group.status} style={{ gap: Spacing.two }}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {STATUS_LABEL[group.status]} · {group.items.length}
            </Text>
            {group.items.map((task) => (
              <TaskRow key={task.id} committeeId={committeeId} task={task} />
            ))}
          </View>
        ))}
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
  statusDot: {
    width: 6,
    height: 40,
    borderRadius: 3,
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  meta: {
    fontSize: 12,
  },
  metaDot: {
    fontSize: 12,
  },
  empty: {
    padding: Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
});
