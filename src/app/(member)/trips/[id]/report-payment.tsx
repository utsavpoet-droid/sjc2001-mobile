import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, PrimaryButton } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import {
  getMyTripBalance,
  getTripBalances,
  reportDirectPayment,
} from '@/features/trips/api';
import { computeSettlement } from '@/features/trips/settle-balances';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { TripBalance } from '@shared/contracts/trips-contract';

export default function ReportPaymentScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = parseInt(id ?? '0', 10);
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const myBalanceQuery = useQuery({
    queryKey: ['trip-balance-mine', tripId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getMyTripBalance(token, tripId);
    },
  });

  const allBalancesQuery = useQuery({
    queryKey: ['trip-balances', tripId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getTripBalances(token, tripId);
    },
  });

  const myMemberId = myBalanceQuery.data?.memberId ?? null;

  // Compute who this member should pay based on settlement plan
  const suggestedPayments = useMemo(() => {
    const balances: TripBalance[] = allBalancesQuery.data ?? [];
    const settlement = computeSettlement(balances);
    return settlement.filter((tx) => {
      const myBalance = balances.find((b) => b.memberId === myMemberId);
      return myBalance && tx.fromName === myBalance.name;
    });
  }, [allBalancesQuery.data, myMemberId]);

  // People who are owed money (possible payees)
  const payees = useMemo(() => {
    const balances: TripBalance[] = allBalancesQuery.data ?? [];
    return balances.filter((b) => b.memberId !== myMemberId && b.balance < -0.01);
  }, [allBalancesQuery.data, myMemberId]);

  const myBalance = myBalanceQuery.data?.balance ?? 0;
  const iOwe = myBalance > 0.01;

  const mutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      if (!selectedMemberId) throw new Error('Select who you paid');
      return reportDirectPayment(token, tripId, {
        toMemberId: selectedMemberId,
        amount: parseFloat(amount) || 0,
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trip-balance-mine', tripId] });
      void queryClient.invalidateQueries({ queryKey: ['trip-balances', tripId] });
      Alert.alert('Recorded', 'Your payment has been recorded and will update balances immediately.');
      router.back();
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not record payment.');
    },
  });

  const canSubmit = !!selectedMemberId && parseFloat(amount) > 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BackLink />

        <Text style={[styles.screenTitle, { color: colors.text }]}>Settle Up</Text>
        <Text style={[styles.screenSub, { color: colors.textSecondary }]}>
          Record a payment you made outside the app to settle your trip balance.
        </Text>

        {/* My balance */}
        <Card style={[styles.balanceCard, { borderColor: iOwe ? colors.danger + '66' : colors.success + '66' }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Your Balance</Text>
          <Text style={[styles.balanceAmount, { color: iOwe ? colors.danger : colors.success }]}>
            {iOwe
              ? `You owe $${myBalance.toFixed(2)}`
              : myBalance < -0.01
                ? `You're owed $${Math.abs(myBalance).toFixed(2)}`
                : 'Settled ✓'}
          </Text>
        </Card>

        {/* Suggested payments from settlement plan */}
        {suggestedPayments.length > 0 ? (
          <Card style={styles.suggestCard}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Suggested Payments</Text>
            {suggestedPayments.map((tx, i) => {
              const payee = allBalancesQuery.data?.find((b) => b.name === tx.toName);
              const isSelected = payee?.memberId === selectedMemberId;
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    if (payee?.memberId) {
                      setSelectedMemberId(payee.memberId);
                      setAmount(tx.amount.toFixed(2));
                    }
                  }}
                  style={[
                    styles.suggestRow,
                    {
                      backgroundColor: isSelected ? colors.accentSoft : colors.surfaceMuted,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}>
                  <View style={styles.suggestLeft}>
                    <Text style={[styles.suggestName, { color: colors.text }]}>{tx.toName}</Text>
                    <Text style={[styles.suggestHint, { color: colors.textMuted }]}>Tap to auto-fill</Text>
                  </View>
                  <Text style={[styles.suggestAmount, { color: isSelected ? colors.accent : colors.text }]}>
                    ${tx.amount.toFixed(2)}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
        ) : null}

        {/* Manual payee picker */}
        {payees.length > 0 ? (
          <Card style={styles.card}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Paid To</Text>
            <View style={styles.payeeList}>
              {payees.map((b) => {
                const isSelected = b.memberId === selectedMemberId;
                return (
                  <Pressable
                    key={b.memberId}
                    onPress={() => setSelectedMemberId(b.memberId ?? null)}
                    style={[
                      styles.payeeChip,
                      {
                        backgroundColor: isSelected ? colors.accentSoft : colors.surfaceMuted,
                        borderColor: isSelected ? colors.accent : colors.border,
                      },
                    ]}>
                    <Text style={[styles.payeeChipText, { color: isSelected ? colors.accent : colors.text }]}>
                      {b.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        ) : (
          !allBalancesQuery.isLoading && (
            <Card style={styles.card}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No one is currently owed money in this trip.
              </Text>
            </Card>
          )
        )}

        {/* Amount */}
        <Card style={styles.card}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Amount ($)</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />
        </Card>

        {/* Note */}
        <Card style={styles.card}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Note (optional)</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Paid via Venmo"
            placeholderTextColor={colors.textMuted}
          />
        </Card>

        <PrimaryButton
          onPress={() => mutation.mutate()}
          busy={mutation.isPending}
          disabled={!canSubmit}>
          Record Payment
        </PrimaryButton>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    paddingBottom: 124,
    gap: Spacing.three,
  },
  screenTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 28,
    marginTop: Spacing.one,
  },
  screenSub: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    marginTop: -Spacing.two,
  },
  balanceCard: {
    borderWidth: 1,
    gap: Spacing.one,
  },
  sectionLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  balanceAmount: {
    fontFamily: Fonts.rounded,
    fontSize: 26,
  },
  suggestCard: {
    gap: Spacing.two,
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  suggestLeft: {
    gap: 2,
  },
  suggestName: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },
  suggestHint: {
    fontFamily: Fonts.sans,
    fontSize: 11,
  },
  suggestAmount: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
  },
  card: {
    gap: Spacing.two,
  },
  payeeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  payeeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  payeeChipText: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: Fonts.sans,
    fontSize: 15,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
});
