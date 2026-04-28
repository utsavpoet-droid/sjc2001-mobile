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
import { createCommitteePost, getCommitteeDetail } from '@/features/committees/api';
import { useColorScheme } from '@/hooks/use-color-scheme';

const MAX_BODY = 8000;

export default function ComposePostScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const params = useLocalSearchParams<{ id: string }>();
  const committeeId = Number.parseInt(String(params.id), 10);
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const [body, setBody] = React.useState('');
  const [asAnnouncement, setAsAnnouncement] = React.useState(false);

  const detailQuery = useQuery({
    queryKey: ['committees', committeeId, 'detail'],
    enabled: Number.isFinite(committeeId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getCommitteeDetail(token, committeeId);
    },
  });

  const canAnnounce = detailQuery.data?.caller.isChair || detailQuery.data?.caller.isSuperAdmin;

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return createCommitteePost(token, committeeId, {
        body: body.trim(),
        type: asAnnouncement ? 'ANNOUNCEMENT' : 'MESSAGE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committees', committeeId, 'feed'] });
      queryClient.invalidateQueries({ queryKey: ['committees', 'mine'] });
      router.back();
    },
    onError: (err: Error) => {
      Alert.alert('Could not post', err.message);
    },
  });

  const trimmed = body.trim();
  const tooLong = trimmed.length > MAX_BODY;
  const canSubmit = trimmed.length > 0 && !tooLong && !createMutation.isPending;

  return (
    <Screen scroll>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing.three }}>
        <BackLink label="Cancel" />
        <SectionTitle title="New post" subtitle={detailQuery.data?.name} />

        <Card style={{ padding: Spacing.three, gap: Spacing.three }}>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            placeholder="What would you like to share?"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.textarea,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          />
          <View style={styles.footer}>
            <Text style={[styles.count, { color: tooLong ? colors.danger : colors.textMuted }]}>
              {trimmed.length} / {MAX_BODY}
            </Text>
          </View>
        </Card>

        {canAnnounce ? (
          <Card style={styles.toggleCard}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleTitle, { color: colors.text }]}>Post as announcement</Text>
              <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
                Pinned to the top of the feed for all members.
              </Text>
            </View>
            <Switch
              value={asAnnouncement}
              onValueChange={setAsAnnouncement}
              trackColor={{ true: colors.accent, false: colors.border }}
            />
          </Card>
        ) : null}

        <PrimaryButton
          onPress={() => createMutation.mutate()}
          disabled={!canSubmit}
          busy={createMutation.isPending}>
          {asAnnouncement ? 'Post announcement' : 'Post'}
        </PrimaryButton>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  textarea: {
    minHeight: 160,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  count: {
    fontSize: 12,
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
