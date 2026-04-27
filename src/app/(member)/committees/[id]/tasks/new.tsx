import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { createCommitteeTask, getCommitteeDetail } from '@/features/committees/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { CommitteeTaskPriority } from '@shared/contracts/committees-contract';

const PRIORITIES: CommitteeTaskPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const PRIORITY_LABEL: Record<CommitteeTaskPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

const MAX_TITLE = 300;
const MAX_DESCRIPTION = 5000;

export default function NewTaskScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const params = useLocalSearchParams<{ id: string }>();
  const committeeId = Number.parseInt(String(params.id), 10);
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState<CommitteeTaskPriority>('NORMAL');
  const [dueDate, setDueDate] = React.useState<Date | null>(null);
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);
  const [assigneeIds, setAssigneeIds] = React.useState<Set<number>>(new Set());

  const detailQuery = useQuery({
    queryKey: ['committees', committeeId, 'detail'],
    enabled: Number.isFinite(committeeId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getCommitteeDetail(token, committeeId);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return createCommitteeTask(token, committeeId, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate?.toISOString(),
        assigneeIds: Array.from(assigneeIds),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committees', committeeId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['committees', committeeId, 'feed'] });
      router.back();
    },
    onError: (err: Error) => Alert.alert('Could not create task', err.message),
  });

  const trimmedTitle = title.trim();
  const titleTooLong = trimmedTitle.length > MAX_TITLE;
  const descTooLong = description.trim().length > MAX_DESCRIPTION;
  const canSubmit =
    trimmedTitle.length > 0 && !titleTooLong && !descTooLong && !createMutation.isPending;

  const activeMembers = (detailQuery.data?.members ?? []).filter((m) => m.leftAt === null);

  const toggleAssignee = (memberUserId: number) => {
    setAssigneeIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberUserId)) next.delete(memberUserId);
      else next.add(memberUserId);
      return next;
    });
  };

  return (
    <Screen scroll>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: Spacing.three, paddingBottom: 124 }}>
        <BackLink label="Cancel" />
        <SectionTitle title="New task" subtitle={detailQuery.data?.name} />

        <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
          <TextInput
            value={title}
            onChangeText={(v) => setTitle(v.slice(0, MAX_TITLE + 50))}
            placeholder="Task title"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          />
          <Text style={[styles.count, { color: titleTooLong ? colors.danger : colors.textMuted }]}>
            {trimmedTitle.length} / {MAX_TITLE}
          </Text>
        </Card>

        <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Optional details"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.textarea,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          />
          <Text style={[styles.count, { color: descTooLong ? colors.danger : colors.textMuted }]}>
            {description.trim().length} / {MAX_DESCRIPTION}
          </Text>
        </Card>

        <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => {
              const selected = priority === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  style={({ pressed }) => [
                    styles.priorityChip,
                    {
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected ? colors.accentSoft : colors.surface,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.priorityChipText,
                      { color: selected ? colors.accent : colors.textSecondary },
                    ]}>
                    {PRIORITY_LABEL[p]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Due date</Text>
          <Pressable
            onPress={() => setDatePickerOpen(true)}
            style={[
              styles.dateField,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}>
            <Ionicons name="calendar-outline" size={16} color={colors.accent} />
            <Text
              style={[
                styles.dateFieldText,
                { color: dueDate ? colors.text : colors.textMuted },
              ]}>
              {dueDate
                ? dueDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'No due date'}
            </Text>
            {dueDate ? (
              <Pressable
                onPress={() => setDueDate(null)}
                hitSlop={12}
                style={{ marginLeft: 'auto' }}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : (
              <Ionicons
                name="chevron-forward"
                size={14}
                color={colors.textMuted}
                style={{ marginLeft: 'auto' }}
              />
            )}
          </Pressable>
        </Card>

        <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Assignees</Text>
          {activeMembers.length === 0 ? (
            <Text style={[styles.helpText, { color: colors.textMuted }]}>
              Loading members…
            </Text>
          ) : (
            activeMembers.map((m) => {
              const memberUserId = m.memberUserId;
              const name = m.memberUser?.member?.name ?? 'Unknown';
              const selected = assigneeIds.has(memberUserId);
              return (
                <Pressable
                  key={m.id}
                  onPress={() => toggleAssignee(memberUserId)}
                  style={({ pressed }) => [
                    styles.assigneeRow,
                    {
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected ? colors.accentSoft : colors.surface,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}>
                  <Ionicons
                    name={selected ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={selected ? colors.accent : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.assigneeName,
                      {
                        color: colors.text,
                        fontWeight: selected ? '700' : '500',
                      },
                    ]}>
                    {name}
                  </Text>
                  {m.role === 'CHAIR' ? (
                    <Text style={[styles.chairTag, { color: colors.accent }]}>Chair</Text>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </Card>

        <PrimaryButton
          onPress={() => createMutation.mutate()}
          disabled={!canSubmit}
          busy={createMutation.isPending}>
          Create task
        </PrimaryButton>
      </ScrollView>

      <Modal visible={datePickerOpen} transparent animationType="slide">
        <View style={dateStyles.overlay}>
          <View style={[dateStyles.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[dateStyles.title, { color: colors.text }]}>Pick due date</Text>
            <DateTimePicker
              value={dueDate ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, date) => {
                if (date) setDueDate(date);
                if (Platform.OS === 'android') setDatePickerOpen(false);
              }}
              style={{ width: '100%' }}
            />
            <View style={dateStyles.actions}>
              <Pressable
                onPress={() => setDatePickerOpen(false)}
                style={[dateStyles.btn, { borderColor: colors.border }]}>
                <Text style={[dateStyles.btnText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => setDatePickerOpen(false)}
                style={[
                  dateStyles.btn,
                  { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}>
                <Text style={[dateStyles.btnText, { color: '#fff' }]}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: Fonts.rounded,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  textarea: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  count: {
    alignSelf: 'flex-end',
    fontSize: 12,
  },
  priorityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priorityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 999,
  },
  priorityChipText: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '600',
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  dateFieldText: {
    fontSize: 14,
  },
  helpText: {
    fontSize: 13,
  },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 10,
  },
  assigneeName: {
    flex: 1,
    fontSize: 14,
  },
  chairTag: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

const dateStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 12,
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
  },
});
