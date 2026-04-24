import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, GhostButton, PrimaryButton } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { getMyTravel, scanTravelImage, updateMyTravel } from '@/features/trips/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { requestContentJson } from '@/lib/api/client';

export default function EditTravelScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = parseInt(id ?? '0', 10);
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const [travelMode, setTravelMode] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [arrivalAirport, setArrivalAirport] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [departureAirport, setDepartureAirport] = useState('');
  const [scanning, setScanning] = useState(false);

  const travelQuery = useQuery({
    queryKey: ['trip-my-travel', tripId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getMyTravel(token, tripId);
    },
  });

  useEffect(() => {
    const t = travelQuery.data;
    if (!t) return;
    setTravelMode(t.travelMode ?? '');
    setArrivalTime(t.arrivalTime ? t.arrivalTime.slice(0, 16) : '');
    setArrivalAirport(t.arrivalAirport ?? '');
    setDepartureTime(t.departureTime ? t.departureTime.slice(0, 16) : '');
    setDepartureAirport(t.departureAirport ?? '');
  }, [travelQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return updateMyTravel(token, tripId, {
        travelMode: travelMode.trim() || null,
        arrivalTime: arrivalTime.trim() || null,
        arrivalAirport: arrivalAirport.trim().toUpperCase() || null,
        departureTime: departureTime.trim() || null,
        departureAirport: departureAirport.trim().toUpperCase() || null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trip-my-travel', tripId] });
      router.back();
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save travel details.');
    },
  });

  async function handleScan() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const filename = asset.fileName ?? `boarding-pass-${Date.now()}.jpg`;
    const contentType = asset.mimeType ?? 'image/jpeg';

    try {
      setScanning(true);
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

      const scanned = await scanTravelImage(token, tripId, presign.publicUrl);

      if (scanned.travelMode) setTravelMode(scanned.travelMode);
      if (scanned.arrivalTime) setArrivalTime(scanned.arrivalTime.slice(0, 16));
      if (scanned.arrivalAirport) setArrivalAirport(scanned.arrivalAirport.toUpperCase());
      if (scanned.departureTime) setDepartureTime(scanned.departureTime.slice(0, 16));
      if (scanned.departureAirport) setDepartureAirport(scanned.departureAirport.toUpperCase());

      Alert.alert('Scanned', 'Fields pre-filled — review before saving.');
    } catch (err) {
      Alert.alert('Scan failed', err instanceof Error ? err.message : 'Could not read the image.');
    } finally {
      setScanning(false);
    }
  }

  if (travelQuery.isLoading) {
    return (
      <Screen>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <BackLink />
        </View>

        <View style={styles.titleRow}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>My Travel Details</Text>
          <GhostButton onPress={() => void handleScan()} disabled={scanning}>
            {scanning ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <View style={styles.scanBtnInner}>
                <Ionicons name="camera-outline" size={15} color={colors.accent} />
                <Text style={[styles.scanBtnText, { color: colors.accent }]}>Scan</Text>
              </View>
            )}
          </GhostButton>
        </View>
        <Text style={[styles.screenSub, { color: colors.textSecondary }]}>
          Tap Scan to auto-fill from a boarding pass or flight confirmation photo.
        </Text>

        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Travel Mode</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            value={travelMode}
            onChangeText={setTravelMode}
            placeholder="e.g. Flying Delta DL 401"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionHead, { color: colors.text }]}>Arrival</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Date & Time</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            value={arrivalTime}
            onChangeText={setArrivalTime}
            placeholder="YYYY-MM-DDTHH:MM"
            placeholderTextColor={colors.textMuted}
            keyboardType="numbers-and-punctuation"
          />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Airport Code</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            value={arrivalAirport}
            onChangeText={(v) => setArrivalAirport(v.toUpperCase())}
            placeholder="e.g. JFK"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            maxLength={5}
          />
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionHead, { color: colors.text }]}>Departure</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Date & Time</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            value={departureTime}
            onChangeText={setDepartureTime}
            placeholder="YYYY-MM-DDTHH:MM"
            placeholderTextColor={colors.textMuted}
            keyboardType="numbers-and-punctuation"
          />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Airport Code</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            value={departureAirport}
            onChangeText={(v) => setDepartureAirport(v.toUpperCase())}
            placeholder="e.g. LAX"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            maxLength={5}
          />
        </Card>

        <PrimaryButton onPress={() => saveMutation.mutate()} busy={saveMutation.isPending}>
          Save Travel Details
        </PrimaryButton>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.four,
    paddingBottom: 124,
    gap: Spacing.three,
  },
  headerRow: {
    marginBottom: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  scanBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  scanBtnText: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },
  card: {
    gap: Spacing.two,
  },
  sectionHead: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
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
