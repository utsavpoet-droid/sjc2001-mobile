import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Image,
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
import { getCommitteeDetail } from '@/features/committees/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveBackendUrl } from '@/lib/api/bases';
import type { CommitteeMemberDto } from '@shared/contracts/committees-contract';

function MemberRow({ m }: { m: CommitteeMemberDto }) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const member = m.memberUser?.member;
  const photo = member?.photoUrl ? resolveBackendUrl(member.photoUrl) ?? member.photoUrl : null;
  const initials = (member?.name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
        <Text style={[styles.name, { color: colors.text }]}>{member?.name ?? 'Unknown'}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          Joined {new Date(m.addedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </Text>
      </View>
      {m.role === 'CHAIR' ? (
        <View style={[styles.chip, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.chipText, { color: colors.accent }]}>Chair</Text>
        </View>
      ) : null}
    </Card>
  );
}

export default function CommitteeMembersScreen() {
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

  const canInvite =
    detailQuery.data?.caller.isChair ||
    detailQuery.data?.caller.isEditor ||
    detailQuery.data?.caller.isSuperAdmin;

  const activeMembers = (detailQuery.data?.members ?? []).filter((m) => m.leftAt === null);
  const chairs = activeMembers.filter((m) => m.role === 'CHAIR');
  const others = activeMembers.filter((m) => m.role !== 'CHAIR');

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={detailQuery.isRefetching}
            onRefresh={() => void detailQuery.refetch()}
            tintColor={colors.accent}
          />
        }>
        <BackLink label="Back" />
        <SectionTitle
          title="Members"
          subtitle={detailQuery.data?.name}
        />

        {canInvite ? (
          <Pressable
            onPress={() => router.push(`/(member)/committees/${committeeId}/invite`)}
            style={({ pressed }) => [
              styles.inviteCta,
              { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
            ]}>
            <Ionicons name="person-add" size={18} color={colors.background} />
            <Text style={[styles.inviteCtaText, { color: colors.background }]}>Invite a member</Text>
          </Pressable>
        ) : null}

        {detailQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : null}

        {chairs.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Chairs</Text>
            {chairs.map((m) => (
              <MemberRow key={m.id} m={m} />
            ))}
          </>
        ) : null}

        {others.length > 0 ? (
          <>
            <Text
              style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: Spacing.three }]}>
              Members
            </Text>
            {others.map((m) => (
              <MemberRow key={m.id} m={m} />
            ))}
          </>
        ) : null}

        {activeMembers.length === 0 && !detailQuery.isLoading ? (
          <Card style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No active members.
            </Text>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
    paddingBottom: 124,
  },
  sectionLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.two,
  },
  inviteCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    marginVertical: Spacing.two,
  },
  inviteCtaText: {
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
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  empty: {
    padding: Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
});
