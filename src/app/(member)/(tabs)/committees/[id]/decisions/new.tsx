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
import { createCommitteeDecision, getCommitteeDetail } from '@/features/committees/api';
import { useColorScheme } from '@/hooks/use-color-scheme';

const MAX_TITLE = 300;
const MAX_SUMMARY = 5000;

export default function NewDecisionScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const params = useLocalSearchParams<{ id: string }>();
  const committeeId = Number.parseInt(String(params.id), 10);
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const [title, setTitle] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [decidedOn, setDecidedOn] = React.useState<Date>(new Date());
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);

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
      return createCommitteeDecision(token, committeeId, {
        title: title.trim(),
        summary: summary.trim(),
        decidedOn: decidedOn.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committees', committeeId, 'decisions'] });
      queryClient.invalidateQueries({ queryKey: ['committees', committeeId, 'feed'] });
      router.back();
    },
    onError: (err: Error) => Alert.alert('Could not record decision', err.message),
  });

  const trimmedTitle = title.trim();
  const trimmedSummary = summary.trim();
  const titleTooLong = trimmedTitle.length > MAX_TITLE;
  const summaryTooLong = trimmedSummary.length > MAX_SUMMARY;
  const canSubmit =
    trimmedTitle.length > 0 &&
    trimmedSummary.length > 0 &&
    !titleTooLong &&
    !summaryTooLong &&
    !createMutation.isPending;

  return (
    <Screen scroll>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: Spacing.three, paddingBottom: 124 }}>
        <BackLink label="Cancel" />
        <SectionTitle title="Record decision" subtitle={detailQuery.data?.name} />

        <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
          <TextInput
            value={title}
            onChangeText={(v) => setTitle(v.slice(0, MAX_TITLE + 50))}
            placeholder="Decision headline"
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
          <Text style={[styles.label, { color: colors.textSecondary }]}>Summary</Text>
          <TextInput
            value={summary}
            onChangeText={setSummary}
            multiline
            placeholder="What was decided and why."
            placeholderTextColor={colors.textMuted}
            style={[
              styles.textarea,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          />
          <Text
            style={[styles.count, { color: summaryTooLong ? colors.danger : colors.textMuted }]}>
            {trimmedSummary.length} / {MAX_SUMMARY}
          </Text>
        </Card>

        <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Decided on</Text>
          <Pressable
            onPress={() => setDatePickerOpen(true)}
            style={[
              styles.dateField,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}>
            <Ionicons name="calendar-outline" size={16} color={colors.accent} />
            <Text style={[styles.dateFieldText, { color: colors.text }]}>
              {decidedOn.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={colors.textMuted}
              style={{ marginLeft: 'auto' }}
            />
          </Pressable>
        </Card>

        <PrimaryButton
          onPress={() => createMutation.mutate()}
          disabled={!canSubmit}
          busy={createMutation.isPending}>
          Record decision
        </PrimaryButton>
      </ScrollView>

      <Modal visible={datePickerOpen} transparent animationType="slide">
        <View style={dateStyles.overlay}>
          <View style={[dateStyles.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[dateStyles.title, { color: colors.text }]}>Decided on</Text>
            <DateTimePicker
              value={decidedOn}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, date) => {
                if (date) setDecidedOn(date);
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
    minHeight: 140,
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
