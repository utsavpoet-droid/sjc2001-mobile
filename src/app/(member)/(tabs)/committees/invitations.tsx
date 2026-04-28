import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  getInvitationInbox,
  respondToInvitation,
  revokeOrWithdrawInvitation,
} from '@/features/committees/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { CommitteeInvitationDto } from '@shared/contracts/committees-contract';

type ActionPress = (id: number, decision: 'ACCEPTED' | 'DECLINED') => void;
type CancelPress = (committeeId: number, id: number) => void;

function statusLabel(status: CommitteeInvitationDto['status']): string {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'ACCEPTED':
      return 'Accepted';
    case 'DECLINED':
      return 'Declined';
    case 'REVOKED':
      return 'Revoked';
  }
}

function statusColor(
  status: CommitteeInvitationDto['status'],
  colors: { accent: string; success: string; danger: string; textMuted: string },
): string {
  if (status === 'PENDING') return colors.accent;
  if (status === 'ACCEPTED') return colors.success;
  if (status === 'DECLINED' || status === 'REVOKED') return colors.danger;
  return colors.textMuted;
}

function InvitationRow({
  inv,
  onRespond,
  busy,
}: {
  inv: CommitteeInvitationDto;
  onRespond: ActionPress;
  busy: boolean;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const inviter = inv.invitedByUser?.name ?? 'A chair';
  const isPending = inv.status === 'PENDING';

  return (
    <Card style={styles.row}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.title, { color: colors.text }]}>
          {inv.committee?.name ?? 'Committee'}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          Invited by {inviter}
        </Text>
        {inv.message ? (
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            “{inv.message}”
          </Text>
        ) : null}
        <Text style={[styles.status, { color: statusColor(inv.status, colors) }]}>
          {statusLabel(inv.status)}
        </Text>
      </View>
      {isPending ? (
        <View style={styles.actions}>
          <Pressable
            disabled={busy}
            onPress={() => onRespond(inv.id, 'ACCEPTED')}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: colors.accent,
                opacity: busy ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}>
            <Text style={[styles.actionText, { color: colors.background }]}>Accept</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => onRespond(inv.id, 'DECLINED')}
            style={({ pressed }) => [
              styles.actionBtnGhost,
              {
                borderColor: colors.border,
                opacity: busy ? 0.5 : pressed ? 0.7 : 1,
              },
            ]}>
            <Text style={[styles.actionText, { color: colors.text }]}>Decline</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

function PendingApprovalRow({
  inv,
  onRespond,
  busy,
}: {
  inv: CommitteeInvitationDto;
  onRespond: ActionPress;
  busy: boolean;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const requester = inv.invitedByUser?.name ?? `Member ${inv.invitedMemberUserId}`;
  const isPending = inv.status === 'PENDING';

  return (
    <Card style={styles.row}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.title, { color: colors.text }]}>
          {inv.committee?.name ?? 'Committee'}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {requester} requested to join
        </Text>
        {inv.message ? (
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            “{inv.message}”
          </Text>
        ) : null}
        <Text style={[styles.status, { color: statusColor(inv.status, colors) }]}>
          {statusLabel(inv.status)}
        </Text>
      </View>
      {isPending ? (
        <View style={styles.actions}>
          <Pressable
            disabled={busy}
            onPress={() => onRespond(inv.id, 'ACCEPTED')}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: colors.accent,
                opacity: busy ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}>
            <Text style={[styles.actionText, { color: colors.background }]}>Approve</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => onRespond(inv.id, 'DECLINED')}
            style={({ pressed }) => [
              styles.actionBtnGhost,
              {
                borderColor: colors.border,
                opacity: busy ? 0.5 : pressed ? 0.7 : 1,
              },
            ]}>
            <Text style={[styles.actionText, { color: colors.text }]}>Decline</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

function JoinRequestRow({
  inv,
  onCancel,
  busy,
}: {
  inv: CommitteeInvitationDto;
  onCancel: CancelPress;
  busy: boolean;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const isPending = inv.status === 'PENDING';

  return (
    <Card style={styles.row}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.title, { color: colors.text }]}>
          {inv.committee?.name ?? 'Committee'}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>You requested to join</Text>
        {inv.message ? (
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            “{inv.message}”
          </Text>
        ) : null}
        <Text style={[styles.status, { color: statusColor(inv.status, colors) }]}>
          {statusLabel(inv.status)}
        </Text>
      </View>
      {isPending ? (
        <Pressable
          disabled={busy}
          onPress={() => onCancel(inv.committeeId, inv.id)}
          style={({ pressed }) => [
            styles.actionBtnGhost,
            {
              borderColor: colors.border,
              opacity: busy ? 0.5 : pressed ? 0.7 : 1,
            },
          ]}>
          <Text style={[styles.actionText, { color: colors.text }]}>Withdraw</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

export default function InvitationsScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const inboxQuery = useQuery({
    queryKey: ['committees', 'invitations'],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getInvitationInbox(token);
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: number; decision: 'ACCEPTED' | 'DECLINED' }) => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return respondToInvitation(token, id, { decision });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committees', 'invitations'] });
      queryClient.invalidateQueries({ queryKey: ['committees', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['committees', 'discoverable'] });
    },
    onError: (err: Error) => {
      Alert.alert('Could not update', err.message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ committeeId, invitationId }: { committeeId: number; invitationId: number }) => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return revokeOrWithdrawInvitation(token, committeeId, invitationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committees', 'invitations'] });
      queryClient.invalidateQueries({ queryKey: ['committees', 'discoverable'] });
    },
    onError: (err: Error) => {
      Alert.alert('Could not withdraw', err.message);
    },
  });

  const onRespond: ActionPress = (id, decision) => {
    respondMutation.mutate({ id, decision });
  };

  const onCancel: CancelPress = (committeeId, invitationId) => {
    cancelMutation.mutate({ committeeId, invitationId });
  };

  const data = inboxQuery.data;
  const respondingId = respondMutation.isPending ? respondMutation.variables?.id : null;
  const cancellingId = cancelMutation.isPending ? cancelMutation.variables?.invitationId : null;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={inboxQuery.isRefetching}
            onRefresh={() => void inboxQuery.refetch()}
            tintColor={colors.accent}
          />
        }>
        <BackLink label="Committees" />
        <SectionTitle
          title="Invitations"
          subtitle="Chair invites and your pending join requests."
        />

        {inboxQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : null}

        {inboxQuery.isError ? (
          <Card style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.danger }]}>
              {inboxQuery.error instanceof Error ? inboxQuery.error.message : 'Failed to load.'}
            </Text>
          </Card>
        ) : null}

        {data ? (
          <>
            {(data.pendingApprovals?.length ?? 0) > 0 ? (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  Requests to approve
                </Text>
                {data.pendingApprovals!.map((inv) => (
                  <PendingApprovalRow
                    key={inv.id}
                    inv={inv}
                    onRespond={onRespond}
                    busy={respondingId === inv.id}
                  />
                ))}
              </>
            ) : null}

            <Text
              style={[
                styles.sectionLabel,
                { color: colors.textSecondary },
                (data.pendingApprovals?.length ?? 0) > 0 ? { marginTop: Spacing.three } : null,
              ]}>
              Invitations to you
            </Text>
            {data.invitations.length === 0 ? (
              <Card style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No invitations.
                </Text>
              </Card>
            ) : (
              data.invitations.map((inv) => (
                <InvitationRow
                  key={inv.id}
                  inv={inv}
                  onRespond={onRespond}
                  busy={respondingId === inv.id}
                />
              ))
            )}

            <Text
              style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: Spacing.three }]}>
              Your join requests
            </Text>
            {data.myJoinRequests.length === 0 ? (
              <Card style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No pending requests.
                </Text>
              </Card>
            ) : (
              data.myJoinRequests.map((inv) => (
                <JoinRequestRow
                  key={inv.id}
                  inv={inv}
                  onCancel={onCancel}
                  busy={cancellingId === inv.id}
                />
              ))
            )}
          </>
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
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    alignItems: 'flex-start',
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
  },
  message: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  actions: {
    gap: Spacing.two,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  actionBtnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionText: {
    fontWeight: '700',
    fontSize: 13,
  },
  empty: {
    padding: Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
});
