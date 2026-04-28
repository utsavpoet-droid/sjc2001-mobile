import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
import {
  getCommitteeDetail,
  getCommitteeTask,
  updateCommitteeTask,
} from '@/features/committees/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type {
  CommitteeTaskPriority,
  CommitteeTaskStatus,
} from '@shared/contracts/committees-contract';

const STATUS_FLOW: CommitteeTaskStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'BLOCKED',
  'DONE',
  'CANCELLED',
];

const STATUS_LABEL: Record<CommitteeTaskStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

const PRIORITY_FLOW: CommitteeTaskPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const PRIORITY_LABEL: Record<CommitteeTaskPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export default function TaskDetailScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const params = useLocalSearchParams<{ id: string; taskId: string }>();
  const committeeId = Number.parseInt(String(params.id), 10);
  const taskId = Number.parseInt(String(params.taskId), 10);
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ['committees', committeeId, 'detail'],
    enabled: Number.isFinite(committeeId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getCommitteeDetail(token, committeeId);
    },
  });

  const taskQuery = useQuery({
    queryKey: ['committees', committeeId, 'task', taskId],
    enabled: Number.isFinite(committeeId) && Number.isFinite(taskId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getCommitteeTask(token, committeeId, taskId);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: {
      status?: CommitteeTaskStatus;
      priority?: CommitteeTaskPriority;
    }) => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return updateCommitteeTask(token, committeeId, taskId, patch);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['committees', committeeId, 'task', taskId], updated);
      queryClient.invalidateQueries({ queryKey: ['committees', committeeId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['committees', committeeId, 'feed'] });
    },
    onError: (err: Error) => {
      Alert.alert('Could not update task', err.message);
    },
  });

  const task = taskQuery.data;
  const caller = detailQuery.data?.caller;
  const isModerator = !!(caller?.isChair || caller?.isEditor || caller?.isSuperAdmin);

  if (taskQuery.isLoading || !task) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 64 }} />
      </Screen>
    );
  }

  const due = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;
  const overdue = task.dueDate ? new Date(task.dueDate).getTime() < Date.now() : false;
  const isDone = task.status === 'DONE' || task.status === 'CANCELLED';

  const handleStatusPress = () => {
    Alert.alert('Change status', undefined, [
      ...STATUS_FLOW.filter((s) => s !== task.status).map((s) => ({
        text: STATUS_LABEL[s],
        onPress: () => updateMutation.mutate({ status: s }),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const handlePriorityPress = () => {
    Alert.alert('Change priority', undefined, [
      ...PRIORITY_FLOW.filter((p) => p !== task.priority).map((p) => ({
        text: PRIORITY_LABEL[p],
        onPress: () => updateMutation.mutate({ priority: p }),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ gap: Spacing.three, paddingBottom: 124 }}>
        <BackLink label="Tasks" />
        <SectionTitle title={task.title} subtitle={detailQuery.data?.name} />

        {task.description ? (
          <Card style={{ padding: Spacing.three }}>
            <Text style={[styles.description, { color: colors.text }]}>{task.description}</Text>
          </Card>
        ) : null}

        <Card style={{ padding: Spacing.three, gap: Spacing.three }}>
          <Pressable
            onPress={handleStatusPress}
            disabled={updateMutation.isPending}
            style={({ pressed }) => [styles.fieldRow, { opacity: pressed ? 0.6 : 1 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Status</Text>
              <Text
                style={[
                  styles.fieldValue,
                  { color: colors.text, textDecorationLine: isDone ? 'line-through' : 'none' },
                ]}>
                {STATUS_LABEL[task.status]}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Pressable
            onPress={isModerator ? handlePriorityPress : undefined}
            disabled={!isModerator || updateMutation.isPending}
            style={({ pressed }) => [
              styles.fieldRow,
              { opacity: !isModerator ? 1 : pressed ? 0.6 : 1 },
            ]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Priority</Text>
              <Text style={[styles.fieldValue, { color: colors.text }]}>
                {PRIORITY_LABEL[task.priority]}
              </Text>
            </View>
            {isModerator ? (
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            ) : null}
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.fieldRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Due date</Text>
              <Text
                style={[
                  styles.fieldValue,
                  {
                    color: overdue && !isDone ? colors.danger : colors.text,
                  },
                ]}>
                {due ?? 'No due date'}
              </Text>
            </View>
          </View>
        </Card>

        <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Assignees</Text>
          {task.assignees.length === 0 ? (
            <Text style={[styles.fieldValue, { color: colors.textMuted }]}>Unassigned</Text>
          ) : (
            task.assignees.map((a) => (
              <Text key={a.id} style={[styles.fieldValue, { color: colors.text }]}>
                {a.memberUser?.member?.name ?? 'Unknown'}
              </Text>
            ))
          )}
        </Card>

        <Card style={{ padding: Spacing.three }}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Created</Text>
          <Text style={[styles.fieldValue, { color: colors.text }]}>
            {new Date(task.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </Card>

        {updateMutation.isPending ? (
          <ActivityIndicator color={colors.accent} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  fieldLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  divider: {
    height: 1,
  },
});
