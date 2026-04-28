import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { createCommitteePoll, getCommitteeDetail } from '@/features/committees/api';
import { useColorScheme } from '@/hooks/use-color-scheme';

const MAX_QUESTION = 500;
const MAX_OPTIONS = 10;
const MAX_OPTION_LEN = 200;

export default function NewPollScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const params = useLocalSearchParams<{ id: string }>();
  const committeeId = Number.parseInt(String(params.id), 10);
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const [question, setQuestion] = React.useState('');
  const [options, setOptions] = React.useState<string[]>(['', '']);
  const [isMultiSelect, setIsMultiSelect] = React.useState(false);
  const [isAnonymous, setIsAnonymous] = React.useState(false);

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
      return createCommitteePoll(token, committeeId, {
        question: question.trim(),
        options: options.map((o) => o.trim()).filter(Boolean),
        isMultiSelect,
        isAnonymous,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committees', committeeId, 'feed'] });
      router.back();
    },
    onError: (err: Error) => {
      Alert.alert('Could not create poll', err.message);
    },
  });

  const trimmedQuestion = question.trim();
  const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
  const questionTooLong = trimmedQuestion.length > MAX_QUESTION;
  const canSubmit =
    trimmedQuestion.length > 0 &&
    !questionTooLong &&
    trimmedOptions.length >= 2 &&
    !createMutation.isPending;

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? value.slice(0, MAX_OPTION_LEN) : o)));
  };

  const addOption = () => {
    setOptions((prev) => (prev.length < MAX_OPTIONS ? [...prev, ''] : prev));
  };

  const removeOption = (index: number) => {
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  };

  return (
    <Screen scroll>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing.three }}>
        <BackLink label="Cancel" />
        <SectionTitle title="New poll" subtitle={detailQuery.data?.name} />

        <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Question</Text>
          <TextInput
            value={question}
            onChangeText={(v) => setQuestion(v.slice(0, MAX_QUESTION + 50))}
            multiline
            placeholder="What's your question?"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.questionInput,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          />
          <Text style={[styles.count, { color: questionTooLong ? colors.danger : colors.textMuted }]}>
            {trimmedQuestion.length} / {MAX_QUESTION}
          </Text>
        </Card>

        <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Options</Text>
          {options.map((opt, i) => (
            <View key={i} style={styles.optionRow}>
              <TextInput
                value={opt}
                onChangeText={(v) => updateOption(i, v)}
                placeholder={`Option ${i + 1}`}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.optionInput,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              />
              {options.length > 2 ? (
                <Pressable
                  onPress={() => removeOption(i)}
                  style={({ pressed }) => [styles.removeBtn, { opacity: pressed ? 0.5 : 1 }]}>
                  <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {options.length < MAX_OPTIONS ? (
            <Pressable
              onPress={addOption}
              style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
              <Text style={[styles.addBtnText, { color: colors.accent }]}>Add option</Text>
            </Pressable>
          ) : null}
        </Card>

        <Card style={styles.toggleCard}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: colors.text }]}>Allow multiple selections</Text>
            <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
              Members can pick more than one option.
            </Text>
          </View>
          <Switch
            value={isMultiSelect}
            onValueChange={setIsMultiSelect}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </Card>

        <Card style={styles.toggleCard}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: colors.text }]}>Anonymous voting</Text>
            <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
              Hide who voted for what. Counts are still visible.
            </Text>
          </View>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </Card>

        <PrimaryButton
          onPress={() => createMutation.mutate()}
          disabled={!canSubmit}
          busy={createMutation.isPending}>
          Create poll
        </PrimaryButton>
      </ScrollView>
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
  questionInput: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  count: {
    alignSelf: 'flex-end',
    fontSize: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  removeBtn: {
    padding: 4,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  addBtnText: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '600',
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  toggleTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
