import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { BackLink } from '@/components/ui/back-link';
import { Card, GhostButton, PrimaryButton } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import {
  createTripTask,
  deleteTripTask,
  getTripAttendees,
  getTripTasks,
  updateTripTask,
} from '@/features/trips/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { TripAttendee, TripTask, TripTaskStatus } from '@shared/contracts/trips-contract';

const STATUS_ORDER: TripTaskStatus[] = ['IN_PROGRESS', 'OPEN', 'BLOCKED', 'DONE', 'CANCELLED'];
const STATUS_LABEL: Record<TripTaskStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

function formatDueDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TripTasksScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = parseInt(id ?? '0', 10);
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [composerOpen, setComposerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const tasksQuery = useQuery({
    queryKey: ['trip-tasks', tripId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getTripTasks(token, tripId);
    },
  });

  const attendeesQuery = useQuery({
    queryKey: ['trip-attendees', tripId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getTripAttendees(token, tripId);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: { taskId: number; status?: TripTaskStatus }) => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return updateTripTask(token, tripId, input.taskId, { status: input.status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trip-tasks', tripId] }),
    onError: (e) => Alert.alert('Update failed', e instanceof Error ? e.message : 'Try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      await deleteTripTask(token, tripId, taskId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trip-tasks', tripId] }),
    onError: (e) => Alert.alert('Delete failed', e instanceof Error ? e.message : 'Try again.'),
  });

  const grouped = useMemo(() => {
    const tasks = tasksQuery.data ?? [];
    const map = new Map<TripTaskStatus, TripTask[]>();
    for (const s of STATUS_ORDER) map.set(s, []);
    for (const task of tasks) {
      map.get(task.status)?.push(task);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        if (aDue !== bDue) return aDue - bDue;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    return map;
  }, [tasksQuery.data]);

  const attendeesById = useMemo(() => {
    const map = new Map<number, TripAttendee>();
    for (const a of attendeesQuery.data ?? []) {
      if (a.member?.id) map.set(a.member.id, a);
    }
    return map;
  }, [attendeesQuery.data]);

  const renderTask = (task: TripTask) => {
    const expanded = expandedId === task.id;
    const due = formatDueDate(task.dueDate);
    const isDone = task.status === 'DONE' || task.status === 'CANCELLED';
    const canChangeStatus = !!me && (
      task.createdById === me.id ||
      task.assignees.some((a) => a.memberUser.id === me.id) ||
      me.role === 'admin'
    );
    const canDelete = !!me && (task.createdById === me.id || me.role === 'admin');

    return (
      <Pressable
        key={task.id}
        onPress={() => setExpandedId(expanded ? null : task.id)}
        style={({ pressed }) => [
          styles.taskRow,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        <View style={styles.taskHeader}>
          <Pressable
            hitSlop={10}
            disabled={!canChangeStatus || updateMutation.isPending}
            onPress={() => {
              const next: TripTaskStatus = isDone ? 'OPEN' : 'DONE';
              updateMutation.mutate({ taskId: task.id, status: next });
            }}
            style={[
              styles.checkbox,
              {
                borderColor: isDone ? colors.success : colors.border,
                backgroundColor: isDone ? colors.success : 'transparent',
              },
            ]}>
            {isDone ? <Ionicons name="checkmark" size={16} color={colors.background} /> : null}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.taskTitle,
                {
                  color: colors.text,
                  textDecorationLine: isDone ? 'line-through' : 'none',
                  opacity: isDone ? 0.6 : 1,
                },
              ]}
              numberOfLines={expanded ? undefined : 2}>
              {task.title}
            </Text>
            <View style={styles.taskMeta}>
              {due ? (
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>Due {due}</Text>
              ) : null}
              {task.priority !== 'NORMAL' ? (
                <Text
                  style={[
                    styles.metaText,
                    { color: task.priority === 'URGENT' ? colors.danger : colors.accent },
                  ]}>
                  {task.priority}
                </Text>
              ) : null}
              {task.assignees.length > 0 ? (
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {task.assignees
                    .map((a) => a.memberUser.member?.name?.split(' ')[0] ?? 'Member')
                    .join(', ')}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {expanded ? (
          <View style={styles.taskBody}>
            {task.description ? (
              <Text style={[styles.description, { color: colors.text }]}>{task.description}</Text>
            ) : (
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                No description.
              </Text>
            )}
            {task.assignees.length > 0 ? (
              <View>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Assigned</Text>
                {task.assignees.map((a) => {
                  const attendee = attendeesById.get(a.memberUser.member?.id ?? -1);
                  const name = a.memberUser.member?.name ?? 'Member';
                  const status = attendee?.status;
                  return (
                    <Text key={a.id} style={[styles.assignee, { color: colors.text }]}>
                      {name}
                      {status === 'FORFEITED' ? ' (forfeited)' : ''}
                    </Text>
                  );
                })}
              </View>
            ) : null}
            {canDelete ? (
              <GhostButton
                onPress={() => {
                  Alert.alert('Delete task?', 'This cannot be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => deleteMutation.mutate(task.id),
                    },
                  ]);
                }}>
                Delete task
              </GhostButton>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    );
  };

  const tasks = tasksQuery.data ?? [];
  const showLoading = tasksQuery.isLoading && !tasks.length;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={tasksQuery.isFetching && !showLoading}
            onRefresh={() => tasksQuery.refetch()}
          />
        }>
        <BackLink label="Back to trip" />
        <View style={styles.header}>
          <Text style={[styles.heading, { color: colors.text }]}>Trip tasks</Text>
          <Text style={[styles.subheading, { color: colors.textSecondary }]}>
            Add to-dos for the team. Anyone on the trip can create tasks; the creator, assignees, and
            admins can change status or close them.
          </Text>
        </View>

        <PrimaryButton onPress={() => setComposerOpen(true)}>+ New task</PrimaryButton>

        {showLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : tasks.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No tasks yet. Tap <Text style={{ fontFamily: Fonts.rounded }}>+ New task</Text> to add
              the first one.
            </Text>
          </Card>
        ) : (
          STATUS_ORDER.map((status) => {
            const list = grouped.get(status) ?? [];
            if (list.length === 0) return null;
            return (
              <View key={status} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  {STATUS_LABEL[status]} · {list.length}
                </Text>
                {list.map(renderTask)}
              </View>
            );
          })
        )}
      </ScrollView>

      {composerOpen ? (
        <NewTaskComposer
          tripId={tripId}
          attendees={attendeesQuery.data ?? []}
          onClose={() => setComposerOpen(false)}
          onCreated={() => {
            setComposerOpen(false);
            void queryClient.invalidateQueries({ queryKey: ['trip-tasks', tripId] });
          }}
        />
      ) : null}
    </Screen>
  );
}

function NewTaskComposer({
  tripId,
  attendees,
  onClose,
  onCreated,
}: {
  tripId: number;
  attendees: TripAttendee[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [assigneeMemberIds, setAssigneeMemberIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const eligibleAttendees = attendees.filter(
    (a) => a.member && (a.status === 'CONFIRMED' || a.status === 'INVITED'),
  );

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Missing title', 'Give the task a short title.');
      return;
    }
    setSubmitting(true);
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      await createTripTask(token, tripId, {
        title: trimmed,
        description: description.trim() || null,
        dueDate: dueDate ? dueDate.toISOString() : null,
        assigneeMemberIds: assigneeMemberIds.length > 0 ? assigneeMemberIds : undefined,
      });
      onCreated();
    } catch (e) {
      Alert.alert('Could not create task', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <Text style={[styles.heading, { color: colors.text }]}>New task</Text>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Title *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Book the Airbnb"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add any context everyone should know."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              style={[
                styles.input,
                styles.multiline,
                { color: colors.text, borderColor: colors.border },
              ]}
            />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Due date</Text>
            <Pressable
              onPress={() => setShowPicker(true)}
              style={[styles.input, styles.pickerButton, { borderColor: colors.border }]}>
              <Text style={{ color: dueDate ? colors.text : colors.textSecondary }}>
                {dueDate ? dueDate.toLocaleDateString() : 'No due date'}
              </Text>
              {dueDate ? (
                <Pressable hitSlop={10} onPress={() => setDueDate(null)}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </Pressable>
            {showPicker ? (
              <DateTimePicker
                value={dueDate ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(_, picked) => {
                  if (Platform.OS !== 'ios') setShowPicker(false);
                  if (picked) setDueDate(picked);
                }}
              />
            ) : null}

            {eligibleAttendees.length > 0 ? (
              <View>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Assign to</Text>
                <View style={styles.chipRow}>
                  {eligibleAttendees.map((a) => {
                    const memberId = a.member!.id;
                    const selected = assigneeMemberIds.includes(memberId);
                    return (
                      <Pressable
                        key={a.id}
                        onPress={() =>
                          setAssigneeMemberIds((prev) =>
                            selected ? prev.filter((x) => x !== memberId) : [...prev, memberId],
                          )
                        }
                        style={[
                          styles.chip,
                          {
                            backgroundColor: selected ? colors.accent : 'transparent',
                            borderColor: selected ? colors.accent : colors.border,
                          },
                        ]}>
                        <Text
                          style={{
                            color: selected ? colors.background : colors.text,
                            fontFamily: Fonts.sans,
                          }}>
                          {a.member!.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[styles.helper, { color: colors.textSecondary }]}>
                  Tap to add or remove. Assignees only get notified once they sign in.
                </Text>
              </View>
            ) : null}

            <View style={{ height: Spacing.three }} />
            <PrimaryButton busy={submitting} onPress={() => void handleSubmit()}>
              Create task
            </PrimaryButton>
            <GhostButton onPress={onClose}>Cancel</GhostButton>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.one,
  },
  heading: {
    fontFamily: Fonts.rounded,
    fontSize: 26,
  },
  subheading: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  loading: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  empty: {
    padding: Spacing.three,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  taskRow: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  taskHeader: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  taskTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },
  taskMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: 4,
  },
  metaText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  taskBody: {
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  description: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  assignee: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalScroll: {
    padding: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  label: {
    fontFamily: Fonts.rounded,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontFamily: Fonts.sans,
    fontSize: 16,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  helper: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    marginTop: Spacing.one,
  },
});
