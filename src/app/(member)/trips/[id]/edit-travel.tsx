import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { Card, GhostButton, PrimaryButton } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { getMyTravel, getTripDetail, scanTravelImage, updateMyTravel } from '@/features/trips/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { requestContentJson } from '@/lib/api/client';

// Format a Date to local "MMM D, YYYY  h:mm AM/PM"
function fmtLocal(d: Date | null): string {
  if (!d) return 'Not set';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Convert local Date to ISO string preserving local timezone offset
function toLocalISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
  );
}

// Parse stored datetime string back to a Date treating it as wall-clock time.
// Strip any timezone suffix so the time is never converted — 09:55 stays 09:55.
function parseToDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const naive = s.replace(/Z$/, '').replace(/\.\d+$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  const d = new Date(naive);
  return isNaN(d.getTime()) ? null : d;
}

// iOS inline date+time picker inside a modal
function DateTimeModal({
  visible,
  label,
  value,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  label: string;
  value: Date | null;
  onConfirm: (d: Date) => void;
  onCancel: () => void;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const [picked, setPicked] = useState<Date>(value ?? new Date());

  useEffect(() => {
    if (visible) setPicked(value ?? new Date());
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modal.overlay}>
        <View style={[modal.sheet, { backgroundColor: colors.surface }]}>
          <Text style={[modal.title, { color: colors.text }]}>{label}</Text>
          <DateTimePicker
            value={picked}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, date) => { if (date) setPicked(date); }}
            style={{ width: '100%' }}
          />
          <View style={modal.actions}>
            <Pressable onPress={onCancel} style={[modal.btn, { borderColor: colors.border }]}>
              <Text style={[modal.btnText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => onConfirm(picked)} style={[modal.btn, { backgroundColor: colors.accent, borderColor: colors.accent }]}>
              <Text style={[modal.btnText, { color: '#fff' }]}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const [open, setOpen] = useState(false);

  return (
    <>
      <DateTimeModal
        visible={open}
        label={label}
        value={value}
        onConfirm={(d) => { onChange(d); setOpen(false); }}
        onCancel={() => setOpen(false)}
      />
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.dateField,
          { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
        ]}
      >
        <Ionicons name="calendar-outline" size={16} color={colors.accent} />
        <Text style={[styles.dateFieldText, { color: value ? colors.text : colors.textMuted }]}>
          {fmtLocal(value)}
        </Text>
        {value ? (
          <Pressable
            onPress={() => onChange(null)}
            hitSlop={12}
            style={{ marginLeft: 'auto' }}
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
        )}
      </Pressable>
    </>
  );
}

export default function EditTravelScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = parseInt(id ?? '0', 10);
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const [travelMode, setTravelMode] = useState('');
  const [arrivalTime, setArrivalTime] = useState<Date | null>(null);
  const [arrivalAirport, setArrivalAirport] = useState('');
  const [arrivalFlight, setArrivalFlight] = useState('');
  const [departureTime, setDepartureTime] = useState<Date | null>(null);
  const [departureAirport, setDepartureAirport] = useState('');
  const [departureFlight, setDepartureFlight] = useState('');
  const [scanning, setScanning] = useState(false);

  const travelQuery = useQuery({
    queryKey: ['trip-my-travel', tripId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getMyTravel(token, tripId);
    },
  });

  const tripQuery = useQuery({
    queryKey: ['trip', tripId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getTripDetail(token, tripId);
    },
  });
  const tz = tripQuery.data?.timezone ?? 'UTC';

  useEffect(() => {
    const t = travelQuery.data;
    if (!t) return;
    setTravelMode(t.travelMode ?? '');
    setArrivalTime(parseToDate(t.arrivalTime));
    setArrivalAirport(t.arrivalAirport ?? '');
    setArrivalFlight(t.arrivalFlight ?? '');
    setDepartureTime(parseToDate(t.departureTime));
    setDepartureAirport(t.departureAirport ?? '');
    setDepartureFlight(t.departureFlight ?? '');
  }, [travelQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return updateMyTravel(token, tripId, {
        travelMode: travelMode.trim() || null,
        arrivalTime: arrivalTime ? toLocalISO(arrivalTime) : null,
        arrivalAirport: arrivalAirport.trim().toUpperCase() || null,
        arrivalFlight: arrivalFlight.trim().toUpperCase() || null,
        departureTime: departureTime ? toLocalISO(departureTime) : null,
        departureAirport: departureAirport.trim().toUpperCase() || null,
        departureFlight: departureFlight.trim().toUpperCase() || null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trip-my-travel', tripId] });
      void queryClient.invalidateQueries({ queryKey: ['trip-attendees', tripId] });
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
      await fetch(presign.uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });

      const scanned = await scanTravelImage(token, tripId, presign.publicUrl);

      if (scanned.travelMode) setTravelMode(scanned.travelMode);
      if (scanned.arrivalTime) setArrivalTime(parseToDate(scanned.arrivalTime));
      if (scanned.arrivalAirport) setArrivalAirport(scanned.arrivalAirport.toUpperCase());
      if (scanned.arrivalFlight) setArrivalFlight(scanned.arrivalFlight.toUpperCase());
      if (scanned.departureTime) setDepartureTime(parseToDate(scanned.departureTime));
      if (scanned.departureAirport) setDepartureAirport(scanned.departureAirport.toUpperCase());
      if (scanned.departureFlight) setDepartureFlight(scanned.departureFlight.toUpperCase());

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
          Tap Scan to auto-fill from a boarding pass photo. Enter times exactly as printed on the pass — they&apos;ll be saved as <Text style={{ fontFamily: Fonts.rounded }}>{tz}</Text> wall-clock.
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
          <Text style={[styles.label, { color: colors.textSecondary }]}>Date & Time ({tz})</Text>
          <DateTimeField label="Arrival Date & Time" value={arrivalTime} onChange={setArrivalTime} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Airport Code</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            value={arrivalAirport}
            onChangeText={(v) => setArrivalAirport(v.toUpperCase())}
            placeholder="e.g. PSP"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            maxLength={5}
          />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Flight #</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            value={arrivalFlight}
            onChangeText={(v) => setArrivalFlight(v.toUpperCase())}
            placeholder="e.g. UA 873"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
          />
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionHead, { color: colors.text }]}>Departure</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Date & Time ({tz})</Text>
          <DateTimeField label="Departure Date & Time" value={departureTime} onChange={setDepartureTime} />
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
          <Text style={[styles.label, { color: colors.textSecondary }]}>Flight #</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            value={departureFlight}
            onChangeText={(v) => setDepartureFlight(v.toUpperCase())}
            placeholder="e.g. UA 874"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
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
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.three, paddingBottom: 124, gap: Spacing.three },
  headerRow: { marginBottom: Spacing.one },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  screenTitle: { fontFamily: Fonts.rounded, fontSize: 26 },
  screenSub: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19, marginTop: -Spacing.two },
  scanBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  scanBtnText: { fontFamily: Fonts.rounded, fontSize: 14 },
  card: { gap: Spacing.two },
  sectionHead: { fontFamily: Fonts.rounded, fontSize: 16 },
  label: { fontFamily: Fonts.sans, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontFamily: Fonts.sans, fontSize: 15 },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateFieldText: { fontFamily: Fonts.sans, fontSize: 15, flex: 1 },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.four, paddingBottom: 40 },
  title: { fontFamily: Fonts.rounded, fontSize: 18, marginBottom: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  btn: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 14, alignItems: 'center' },
  btnText: { fontFamily: Fonts.rounded, fontSize: 16 },
});
