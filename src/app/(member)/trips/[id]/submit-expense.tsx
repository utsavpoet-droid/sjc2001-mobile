import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
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
import { submitExpense } from '@/features/trips/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { requestContentJson } from '@/lib/api/client';
import type { ExpenseCategory } from '@shared/contracts/trips-contract';

const CATEGORIES: { key: ExpenseCategory; label: string; icon: string }[] = [
  { key: 'ACCOMMODATION', label: 'Stay', icon: '🏨' },
  { key: 'FOOD', label: 'Food', icon: '🍽️' },
  { key: 'TRANSPORT', label: 'Transport', icon: '🚗' },
  { key: 'ACTIVITIES', label: 'Activities', icon: '🎟️' },
  { key: 'ALCOHOL', label: 'Drinks', icon: '🍷' },
  { key: 'SUPPLIES', label: 'Supplies', icon: '🛍️' },
  { key: 'OTHER', label: 'Other', icon: '•••' },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SubmitExpenseScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = parseInt(id ?? '0', 10);
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('OTHER');
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return submitExpense(token, tripId, {
        title: title.trim(),
        category,
        date,
        totalAmount: parseFloat(amount) || 0,
        notes: notes.trim() || null,
        receiptUrl,
        splits: [],
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trip-expenses', tripId] });
      Alert.alert('Submitted', 'Expense submitted for admin review.');
      router.back();
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not submit expense.');
    },
  });

  async function pickReceipt() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const filename = asset.fileName ?? `receipt-${Date.now()}.jpg`;
    const contentType = asset.mimeType ?? 'image/jpeg';

    try {
      setUploading(true);
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');

      const presign = await requestContentJson<{ uploadUrl: string; publicUrl: string }>('/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, contentType }),
      });

      const fileRes = await fetch(asset.uri);
      const blob = await fileRes.blob();
      await fetch(presign.uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': contentType },
      });

      setReceiptUrl(presign.publicUrl);
      setReceiptName(filename);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setUploading(false);
    }
  }

  const canSubmit = title.trim().length > 0 && parseFloat(amount) > 0 && !uploading;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <BackLink />
        </View>

        <Text style={[styles.screenTitle, { color: colors.text }]}>Submit Expense</Text>

        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Title *</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Hotel Marriott"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
          <View style={styles.chipWrap}>
            {CATEGORIES.map((cat) => {
              const active = category === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => setCategory(cat.key)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.accentSoft : colors.surfaceMuted,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}>
                  <Text style={styles.chipEmoji}>{cat.icon}</Text>
                  <Text style={[styles.chipText, { color: active ? colors.accent : colors.textSecondary }]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card style={styles.card}>
          <View style={styles.twoCol}>
            <View style={styles.colItem}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Date *</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.colItem}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Amount ($) *</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any details for the admin..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
          />
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Receipt (optional)</Text>
          <Pressable
            onPress={() => void pickReceipt()}
            disabled={uploading}
            style={[styles.receiptBtn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name={receiptUrl ? 'checkmark-circle' : 'camera-outline'} size={18} color={receiptUrl ? colors.success : colors.accent} />
            <Text style={[styles.receiptBtnText, { color: receiptUrl ? colors.success : colors.accent }]}>
              {uploading ? 'Uploading…' : receiptUrl ? receiptName ?? 'Receipt attached' : 'Attach Receipt Photo'}
            </Text>
          </Pressable>
        </Card>

        <PrimaryButton
          onPress={() => mutation.mutate()}
          busy={mutation.isPending}
          disabled={!canSubmit}>
          Submit Expense
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
  multiline: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  twoCol: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  colItem: {
    flex: 1,
    gap: Spacing.one,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipEmoji: {
    fontSize: 13,
  },
  chipText: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderStyle: 'dashed',
  },
  receiptBtnText: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },
});
