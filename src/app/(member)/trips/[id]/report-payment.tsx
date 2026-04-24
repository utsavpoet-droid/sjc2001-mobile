import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { getMyTripBalance, reportPayment } from '@/features/trips/api';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ReportPaymentScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = parseInt(id ?? '0', 10);
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const balanceQuery = useQuery({
    queryKey: ['trip-balance-mine', tripId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getMyTripBalance(token, tripId);
    },
  });

  useEffect(() => {
    const bal = balanceQuery.data?.balance ?? 0;
    if (bal > 0) {
      setAmount(bal.toFixed(2));
    }
  }, [balanceQuery.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return reportPayment(token, tripId, {
        amount: parseFloat(amount) || 0,
        notes: notes.trim() || undefined,
        date: new Date().toISOString().slice(0, 10),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trip-balance-mine', tripId] });
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      Alert.alert('Reported', 'Payment reported — pending admin confirmation.');
      router.back();
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not report payment.');
    },
  });

  const balance = balanceQuery.data?.balance ?? 0;
  const balanceColor = balance > 0.01 ? colors.danger : balance < -0.01 ? colors.success : colors.textSecondary;
  const balanceLabel =
    balance > 0.01
      ? `You owe $${balance.toFixed(2)}`
      : balance < -0.01
        ? `You're owed $${Math.abs(balance).toFixed(2)}`
        : 'Settled ✓';

  const canSubmit = parseFloat(amount) > 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <BackLink />
        </View>

        <Text style={[styles.screenTitle, { color: colors.text }]}>Report Payment</Text>
        <Text style={[styles.screenSub, { color: colors.textSecondary }]}>
          Self-report a payment you made outside the app. An admin will confirm it.
        </Text>

        {balanceQuery.data ? (
          <Card style={[styles.balanceCard, { borderColor: balanceColor + '66' }]}>
            <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Current Balance</Text>
            <Text style={[styles.balanceAmount, { color: balanceColor }]}>{balanceLabel}</Text>
            {balanceQuery.data.hasPendingConfirmation ? (
              <Text style={[styles.pendingNote, { color: colors.textMuted }]}>
                You have a payment pending admin confirmation.
              </Text>
            ) : null}
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Amount ($) *</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Paid via Venmo"
            placeholderTextColor={colors.textMuted}
          />
        </Card>

        <PrimaryButton
          onPress={() => mutation.mutate()}
          busy={mutation.isPending}
          disabled={!canSubmit}>
          Report Payment
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
  headerRow: {
    marginBottom: Spacing.one,
  },
  screenTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 26,
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
  balanceLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  balanceAmount: {
    fontFamily: Fonts.rounded,
    fontSize: 24,
  },
  pendingNote: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  card: {
    gap: Spacing.two,
  },
  label: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: Fonts.sans,
    fontSize: 15,
  },
});
