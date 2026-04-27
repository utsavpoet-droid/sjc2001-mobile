import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import {
  getInvitableMembers,
  inviteMemberToCommittee,
  type InvitableMember,
} from '@/features/committees/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveBackendUrl } from '@/lib/api/bases';

function MemberPickerRow({
  member,
  onInvite,
  busy,
  invitedNow,
}: {
  member: InvitableMember;
  onInvite: (memberUserId: number) => void;
  busy: boolean;
  invitedNow: boolean;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const photo = member.photoUrl ? resolveBackendUrl(member.photoUrl) ?? member.photoUrl : null;
  const initials = (member.name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const subtitle = [member.city, member.country].filter(Boolean).join(', ');

  return (
    <Card style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatarImage} />
        ) : (
          <Text style={[styles.avatarInitials, { color: colors.accent }]}>{initials}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: colors.text }]}>{member.name ?? 'Unknown'}</Text>
        {subtitle ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {invitedNow ? (
        <View style={[styles.invitedChip, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="checkmark" size={14} color={colors.success} />
          <Text style={[styles.invitedText, { color: colors.success }]}>Invited</Text>
        </View>
      ) : (
        <Pressable
          disabled={busy}
          onPress={() => onInvite(member.memberUserId)}
          style={({ pressed }) => [
            styles.inviteBtn,
            { backgroundColor: colors.accent, opacity: busy ? 0.5 : pressed ? 0.85 : 1 },
          ]}>
          <Text style={[styles.inviteBtnText, { color: colors.background }]}>
            {busy ? '...' : 'Invite'}
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

export default function InviteMembersScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const params = useLocalSearchParams<{ id: string }>();
  const committeeId = Number.parseInt(String(params.id), 10);
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [invitedIds, setInvitedIds] = React.useState<Set<number>>(new Set());

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const searchQuery = useQuery({
    queryKey: ['committees', committeeId, 'invitable-members', debounced],
    enabled: Number.isFinite(committeeId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getInvitableMembers(token, committeeId, debounced);
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (memberUserId: number) => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return inviteMemberToCommittee(token, committeeId, { memberUserId });
    },
    onSuccess: (_, memberUserId) => {
      setInvitedIds((prev) => {
        const next = new Set(prev);
        next.add(memberUserId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['committees', committeeId, 'detail'] });
    },
    onError: (err: Error) => {
      Alert.alert('Could not send invitation', err.message);
    },
  });

  const results = (searchQuery.data ?? []) as InvitableMember[];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <BackLink label="Back" />
        <SectionTitle
          title="Invite a member"
          subtitle="Search the batch and send an invitation."
        />

        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginLeft: 12 }} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            autoCapitalize="words"
            style={[
              styles.searchInput,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          />
        </View>

        {searchQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
        ) : null}

        {!searchQuery.isLoading && results.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {debounced
                ? 'No matches. Try a different name.'
                : 'Start typing to search batchmates.'}
            </Text>
          </Card>
        ) : null}

        {results.map((m) => (
          <MemberPickerRow
            key={m.memberUserId}
            member={m}
            onInvite={(id) => inviteMutation.mutate(id)}
            busy={inviteMutation.isPending && inviteMutation.variables === m.memberUserId}
            invitedNow={invitedIds.has(m.memberUserId)}
          />
        ))}
      </ScrollView>

      {invitedIds.size > 0 ? (
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.doneBar,
            { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
          ]}>
          <Text style={[styles.doneText, { color: colors.background }]}>
            Done · {invitedIds.size} {invitedIds.size === 1 ? 'invite sent' : 'invites sent'}
          </Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
    paddingBottom: 124,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingLeft: 36,
    fontSize: 15,
    marginLeft: -28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
  },
  avatarInitials: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '700',
  },
  name: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  inviteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  inviteBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
  invitedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  invitedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  empty: {
    padding: Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
  doneBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 90,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneText: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '700',
  },
});
